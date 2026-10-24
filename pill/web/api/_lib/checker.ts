// The Gemini checker. One POST does the whole check and returns the step log (no SSE: the app animates the returned log).
//   readLabel     Gemini vision on the label photo (skipped when the app sends the bottle fields)
//   inspectFrames Gemini vision on ≤ 3 camera frames of the cup, strict JSON schema
//   lookupRecall  code tool: openFDA drug enforcement API by lot; the demo recall list when openFDA does not answer
//   crossCheck    code tool: expiry in the past? label drug = the reference being tested? lot format plausible?
//   reconcile     code tool: does what the camera saw fit what the sensor's numbers imply?
//   summarise     Gemini, ≤ 3 plain sentences, clause-filtered, must name the sensor verdict and end 'A pharmacist decides.'
// Gemini function-calling decides which code tools to call (lookupRecall, crossCheck, reconcile) and then writes the summary;
// any tool it skipped is run by the script afterwards and logged `by: 'script'`. If function calling fails, the whole thing
// runs scripted with a separate summary call (`agent: 'scripted'`).
// Precedence: the sensor verdict is copied from the request into the response and never changed. A summary that names a
// different verdict word, or not the sensor's, is replaced by the template.
// Privacy: images and fields live only for the request. Nothing is written to disk; the log line has step names and ms only.
import { GEMINI_CHECKER_MODEL, GEMINI_CHECKER_TOOLS_MODEL, GeminiError, geminiAvailable, geminiGenerate, imagePart, type GeminiContent, type GeminiFunctionDecl, type GeminiPart } from './gemini.js';
import { filterClauses } from './filter.js';
import { readLabel, type LabelFields } from './label.js';

export type Verdict = 'PASS' | 'NEEDS LAB' | 'UNABLE TO VERIFY';
const VERDICTS: Verdict[] = ['PASS', 'NEEDS LAB', 'UNABLE TO VERIFY'];
const RULES = ['U1', 'U2', 'U3', 'N1', 'N2', 'N3', 'P1'];
export const MAX_FRAMES = 3;
/** ≈ 300 KB of JPEG once base64-decoded. */
export const MAX_IMAGE_CHARS = 420_000;

export interface Sensor { verdict: Verdict; rule: string; plateau: number; band: [number, number] | null; glowRise: number; glowMin: number | null; drug: string }
export interface BottleIn { drug: string | null; lot: string | null; expiry: string | null; strength: string | null; maker: string | null }
export interface CheckInput { label: string | null; frames: string[]; runId: string | null; sensor: Sensor; bottle: BottleIn | null }

export interface FrameObservation {
  cupVisible: boolean;
  liquidClarity: 'clear' | 'hazy' | 'cloudy' | 'unknown';
  colour: 'none' | 'yellow' | 'other' | 'unknown';
  tabletState: 'intact' | 'breaking' | 'gone' | 'unknown';
  anomalies: string[];
  confidence: number;
}
export type RecallStatus = 'recall' | 'no_record' | 'unreachable' | 'unchecked';
export interface RecallResult { status: RecallStatus; source: 'openFDA' | 'demo list' | null; lot: string | null; id: string | null; product: string | null; note: string }
export interface CrossCheck { expiry: 'past' | 'current' | 'unknown'; drugMatches: 'yes' | 'no' | 'unknown'; lotPlausible: 'yes' | 'no' | 'unknown'; notes: string[] }
export interface Reconcile { agrees: 'yes' | 'no' | 'unclear'; expected: string; saw: string; note: string }
export interface Step { step: string; tool: string; by: 'gemini' | 'code' | 'app' | 'script'; status: 'ok' | 'skipped' | 'failed'; input: string; output: string; at: number; ms: number }

// ---------------------------------------------------------------- input

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** An image is sent either as the data URL itself or as `{image: dataUrl}`. */
const imageOf = (v: unknown) => (typeof v === 'string' ? v : str(record(v)?.image, MAX_IMAGE_CHARS + 1));

export function parseCheck(body: Record<string, unknown>): CheckInput | { error: string } {
  const s = record(body.sensor) ?? {};
  const verdict = VERDICTS.find((v) => v === s.verdict);
  if (!verdict) return { error: `sensor.verdict must be one of ${VERDICTS.join(' / ')}` };
  const rule = RULES.find((r) => r === s.rule);
  if (!rule) return { error: `sensor.rule must be one of ${RULES.join(', ')}` };
  const plateau = num(s.plateau), glowRise = num(s.glowRise);
  if (plateau === null || glowRise === null) return { error: 'sensor.plateau and sensor.glowRise must be numbers' };
  const lo = Array.isArray(s.band) && s.band.length === 2 ? num(s.band[0]) : null, hi = Array.isArray(s.band) ? num(s.band[1]) : null;
  const band: [number, number] | null = lo !== null && hi !== null ? [lo, hi] : null;
  const label = body.label === undefined || body.label === null ? null : imageOf(body.label);
  const frames = Array.isArray(body.frames) ? body.frames.map(imageOf).filter((f): f is string => typeof f === 'string') : [];
  if (frames.length > MAX_FRAMES) return { error: `at most ${MAX_FRAMES} frames` };
  if ([label, ...frames].some((i) => i && i.length > MAX_IMAGE_CHARS)) return { error: 'each image must be under 300 KB' };
  if ([label, ...frames].some((i) => i && !imagePart(i))) return { error: 'images must be data:image/jpeg|png|webp;base64 URLs' };
  const b = record(body.bottle);
  const bottle = b ? { drug: str(b.drug), lot: str(b.lot, 40), expiry: str(b.expiry, 20), strength: str(b.strength), maker: str(b.maker) } : null;
  return {
    label, frames, runId: str(body.runId, 40), bottle,
    sensor: { verdict, rule, plateau, band, glowRise, glowMin: num(s.glowMin), drug: str(s.drug) ?? 'riboflavin' },
  };
}

// ---------------------------------------------------------------- code tools

/** Mirrors the app's demo recall lot (src/screens/Bottle.tsx RECALL_LOT/RECALL_ID); used only when openFDA does not answer. */
const DEMO_RECALLS: Record<string, { id: string; product: string }> = {
  AS1413A: { id: 'D-1515-2016', product: 'Amoxicillin for oral suspension (demo list)' },
};

export async function lookupRecall(lotIn: string | null): Promise<RecallResult> {
  const lot = lotIn?.trim().toUpperCase() ?? null;
  if (!lot) return { status: 'unchecked', source: null, lot: null, id: null, product: null, note: 'no lot to look up' };
  if (!/\d/.test(lot)) return { status: 'unchecked', source: null, lot, id: null, product: null, note: 'lot has no digits (a placeholder?), not looked up' };
  const demo = DEMO_RECALLS[lot];
  try {
    const url = `https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(`code_info:"${lot.replace(/"/g, '')}"`)}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (res.status === 404) return { status: 'no_record', source: 'openFDA', lot, id: null, product: null, note: 'openFDA has no enforcement record for this lot' };
    if (!res.ok) throw new Error(`openFDA ${res.status}`);
    const j = (await res.json()) as { results?: { recall_number?: string; product_description?: string; status?: string }[] };
    const r = j.results?.[0];
    if (!r) return { status: 'no_record', source: 'openFDA', lot, id: null, product: null, note: 'openFDA has no enforcement record for this lot' };
    return { status: 'recall', source: 'openFDA', lot, id: r.recall_number ?? null, product: r.product_description?.slice(0, 90) ?? null, note: `openFDA recall ${r.recall_number ?? ''} (${r.status ?? 'status unknown'})`.trim() };
  } catch {
    if (demo) return { status: 'recall', source: 'demo list', lot, id: demo.id, product: demo.product, note: 'openFDA did not answer; found on the demo recall list' };
    return { status: 'unreachable', source: 'demo list', lot, id: null, product: null, note: 'openFDA did not answer; not on the demo recall list' };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function crossCheck(label: { drug: string | null; lot: string | null; expiry: string | null }, referenceDrug: string, now = new Date()): CrossCheck {
  const notes: string[] = [];
  let expiry: CrossCheck['expiry'] = 'unknown';
  const m = label.expiry ? /^(\d{4})-(\d{1,2})/.exec(label.expiry) : null;
  if (m) {
    const ym = Number(m[1]) * 12 + Number(m[2]) - 1, nowYm = now.getUTCFullYear() * 12 + now.getUTCMonth();
    expiry = ym < nowYm ? 'past' : 'current';
    notes.push(expiry === 'past' ? `expiry ${label.expiry} is in the past` : `expiry ${label.expiry} has not passed`);
  } else notes.push('no readable expiry');
  let drugMatches: CrossCheck['drugMatches'] = 'unknown';
  if (label.drug) {
    const a = norm(label.drug), b = norm(referenceDrug);
    drugMatches = a.includes(b) || b.includes(a) ? 'yes' : 'no';
    notes.push(drugMatches === 'yes' ? `label drug matches the ${referenceDrug} reference` : `label says ${label.drug}, the run used the ${referenceDrug} reference`);
  } else notes.push('no drug name read');
  let lotPlausible: CrossCheck['lotPlausible'] = 'unknown';
  if (label.lot) {
    lotPlausible = /^(?=.*\d)[A-Z0-9][A-Z0-9-]{2,15}$/i.test(label.lot.trim()) ? 'yes' : 'no';
    notes.push(lotPlausible === 'yes' ? `lot ${label.lot} has a usual format` : `lot ${label.lot} has an unusual format`);
  } else notes.push('no lot read');
  return { expiry, drugMatches, lotPlausible, notes };
}

/** What the sensor's numbers imply the cup should look like, against what the camera saw. Never touches the verdict. */
export function reconcile(sensor: Sensor, seen: FrameObservation | null): Reconcile {
  const glowRose = sensor.glowMin !== null ? sensor.glowRise >= sensor.glowMin : sensor.glowRise > 0.05;
  const expected = sensor.verdict === 'UNABLE TO VERIFY' ? 'nothing in particular (no result)' : glowRose ? 'yellow-tinted liquid (riboflavin glows)' : 'cloudy or white liquid, no yellow (no glow)';
  if (!seen) return { agrees: 'unclear', expected, saw: 'no frames', note: 'No camera frames were sent, so there is nothing to compare.' };
  const saw = `${seen.liquidClarity} liquid, colour ${seen.colour}, tablet ${seen.tabletState}`;
  if (!seen.cupVisible || seen.confidence < 0.4 || (seen.colour === 'unknown' && seen.liquidClarity === 'unknown'))
    return { agrees: 'unclear', expected, saw, note: 'The camera could not see the cup clearly enough to compare.' };
  if (sensor.verdict === 'UNABLE TO VERIFY') return { agrees: 'unclear', expected, saw, note: 'The sensor gave no result, so there is nothing to compare with.' };
  const yellow = seen.colour === 'yellow';
  const cloudy = seen.liquidClarity === 'cloudy' || seen.liquidClarity === 'hazy';
  if (glowRose) {
    if (yellow) return { agrees: 'yes', expected, saw, note: 'The liquid looks yellow, which fits the glow the sensor measured.' };
    if (seen.colour === 'none' || seen.colour === 'other') return { agrees: 'no', expected, saw, note: `The sensor measured a glow, but the liquid looks ${cloudy ? 'cloudy and ' : ''}not yellow.` };
    return { agrees: 'unclear', expected, saw, note: 'The colour of the liquid is hard to tell.' };
  }
  if (yellow) return { agrees: 'no', expected, saw, note: 'The liquid looks yellow, but the sensor measured no glow.' };
  if (cloudy) return { agrees: 'yes', expected, saw, note: 'The liquid looks cloudy with no yellow, which fits no glow.' };
  return { agrees: 'unclear', expected, saw, note: 'The liquid looks clear; nothing may have dissolved yet in these frames.' };
}

// ---------------------------------------------------------------- Gemini steps

const FRAME_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cupVisible: { type: 'BOOLEAN' },
    liquidClarity: { type: 'STRING', enum: ['clear', 'hazy', 'cloudy', 'unknown'] },
    colour: { type: 'STRING', enum: ['none', 'yellow', 'other', 'unknown'] },
    tabletState: { type: 'STRING', enum: ['intact', 'breaking', 'gone', 'unknown'] },
    anomalies: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER' },
  },
  required: ['cupVisible', 'liquidClarity', 'colour', 'tabletState', 'anomalies', 'confidence'],
};
const FRAME_PROMPT = [
  'These are 1 to 3 photos of a tablet dissolution screening test: a small clear cup of water, a quarter tablet dissolving in it.',
  'Describe only what is visible. liquidClarity: clear, hazy, cloudy, or unknown. colour: the tint of the liquid itself, none (colourless or white/milky), yellow, other, or unknown.',
  'tabletState: intact, breaking (crumbling, fizzing), gone (dissolved), or unknown. cupVisible: is a cup or glass of liquid in view.',
  'anomalies: up to 3 short phrases for things that would spoil a test (no cup, lid open, blurry, foreign object, spilled); empty list if none.',
  'confidence: 0 to 1, how sure you are of the whole description. If a value cannot be seen, use unknown. Do not judge the medicine.',
].join('\n');

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T => (allowed.includes(v as T) ? (v as T) : ('unknown' as T));

export async function inspectFrames(frames: string[], timeoutMs = 25_000): Promise<{ observation: FrameObservation; model: string }> {
  const parts: GeminiPart[] = [{ text: FRAME_PROMPT }, ...frames.map((f) => imagePart(f)!)];
  const r = await geminiGenerate({ parts, json: true, schema: FRAME_SCHEMA, timeoutMs, model: GEMINI_CHECKER_MODEL });
  const o = r.json;
  if (!o) throw new GeminiError('frame reply was not JSON');
  const anomalies = Array.isArray(o.anomalies) ? o.anomalies.filter((a): a is string => typeof a === 'string').slice(0, 3)
    .map((a) => filterClauses(a.slice(0, 60))).filter((f) => !f.fellBack).map((f) => f.text) : [];
  const c = num(o.confidence);
  const observation: FrameObservation = {
    cupVisible: o.cupVisible === true,
    liquidClarity: pick(o.liquidClarity, ['clear', 'hazy', 'cloudy', 'unknown'] as const),
    colour: pick(o.colour, ['none', 'yellow', 'other', 'unknown'] as const),
    tabletState: pick(o.tabletState, ['intact', 'breaking', 'gone', 'unknown'] as const),
    anomalies, confidence: c === null ? 0 : Math.max(0, Math.min(1, c)),
  };
  return { observation, model: r.model };
}

const ENDING = 'A pharmacist decides.';
const AGENT_SYSTEM = [
  "You are Pill's checker agent. A tablet screening station (the sensor) has already given a verdict. You cannot change it; you explain it.",
  'You get JSON: the sensor result, the label fields, and what the camera saw in the cup.',
  'First call the tools lookupRecall, crossCheck and reconcile, once each (you may call them together). They read the label fields and camera result themselves.',
  'Then write the summary for a pharmacist and for an older person: at most 3 short sentences, plain grade-8 words.',
  'Use the sensor verdict word exactly as given (PASS, NEEDS LAB or UNABLE TO VERIFY) and never any other verdict word.',
  'Say whether the camera agrees with the sensor. Mention a recall, a past expiry or a drug mismatch only if a tool found one.',
  `The last sentence must be exactly: ${ENDING}`,
  "Never describe the medicine's quality, authenticity or safety. Do not use the words safe, genuine, fake, counterfeit, authentic, verified, certified or guaranteed. This is not medical advice.",
  'Reply with the summary text only, no JSON, no lists.',
].join('\n');

const TOOLS: GeminiFunctionDecl[] = [
  { name: 'lookupRecall', description: "Look up FDA drug recall (enforcement) records for the label's lot number. Returns status recall / no_record / unreachable / unchecked (no lot).", parameters: { type: 'OBJECT', properties: {} } },
  { name: 'crossCheck', description: "Check the label's fields: is the expiry in the past, does the label drug match the reference drug the sensor tested against, is the lot format plausible.", parameters: { type: 'OBJECT', properties: {} } },
  { name: 'reconcile', description: "Compare what the camera saw in the cup with what the sensor's numbers imply. Returns agrees yes/no/unclear.", parameters: { type: 'OBJECT', properties: {} } },
];

const VERDICT_WORDS = /\b(PASS|NEEDS LAB|UNABLE TO VERIFY)\b/g;

/** The precedence guard: filtered, ≤ 3 sentences, names the sensor verdict and no other, ends with ENDING. null = use the template. */
export function acceptSummary(raw: string, verdict: Verdict): { text: string; dropped: string[] } | null {
  const f = filterClauses(raw.replace(/\s+/g, ' '));
  if (f.fellBack) return null;
  const words = [...f.text.matchAll(VERDICT_WORDS)].map((m) => m[1]);
  if (!words.includes(verdict) || words.some((w) => w !== verdict)) return null;
  const sentences = f.text.split(/(?<=[.!?])\s+/).filter((s) => s && s !== ENDING);
  const body = sentences.slice(0, 2);
  if (!body.join(' ').includes(verdict)) return null;
  return { text: `${body.join(' ')} ${ENDING}`, dropped: f.dropped };
}

export function templateSummary(verdict: Verdict, rec: Reconcile, recall: RecallResult): string {
  const first = recall.status === 'recall' ? `The sensor result is ${verdict}, and this lot has a recall record.` : `The sensor result is ${verdict}.`;
  const second = rec.agrees === 'yes' ? 'The camera saw what this result expects.'
    : rec.agrees === 'no' ? 'The camera saw something different from what this result expects, so show this to a pharmacist.'
      : 'The camera could not tell either way.';
  return `${first} ${second} ${ENDING}`;
}

// ---------------------------------------------------------------- the run

const brief = (o: unknown) => JSON.stringify(o).slice(0, 160);

export interface CheckReport {
  mode: 'live' | 'partial';
  agent: 'gemini function-calling' | 'scripted';
  agentError: string | null;
  model: string | null;
  runId: string | null;
  /** The sensor verdict, copied from the request. Nothing in the check changes it. */
  verdict: Verdict;
  sensor: Sensor;
  label: (BottleIn & { source: 'gemini' | 'given'; confidence: number | null }) | null;
  recall: RecallResult;
  crossCheck: CrossCheck;
  frames: FrameObservation | null;
  reconcile: Reconcile;
  summary: { text: string; by: 'gemini' | 'template'; filtered: true; dropped: string[]; rejected: string | null };
  steps: Step[];
  totalMs: number;
  notice: string;
}

export async function runCheck(input: CheckInput): Promise<CheckReport> {
  const t0 = Date.now();
  // the whole check fits in 50 s (the Vercel function allows 60): perception gets 25 s, the agent the rest
  const left = () => t0 + 50_000 - Date.now();
  const steps: Step[] = [];
  const log = (s: Omit<Step, 'at' | 'ms'>, start: number) => { steps.push({ ...s, at: start - t0, ms: Date.now() - start }); };
  const live = geminiAvailable();
  /** every Gemini model that answered (free-tier quota can move a call to a fallback model) */
  const models = new Set<string>();

  // (a) + (d) perception, in parallel
  const labelP = (async () => {
    const start = Date.now();
    if (input.bottle && (input.bottle.drug || input.bottle.lot)) {
      log({ step: 'readLabel', tool: 'bottle fields', by: 'app', status: 'ok', input: 'fields sent by the app', output: brief(input.bottle) }, start);
      return { ...input.bottle, source: 'given' as const, confidence: null as number | null };
    }
    if (!input.label) { log({ step: 'readLabel', tool: 'gemini vision', by: 'gemini', status: 'skipped', input: 'no label photo', output: 'skipped' }, start); return null; }
    const r = await readLabel(input.label, 25_000);
    if (r.mode !== 'live') { log({ step: 'readLabel', tool: 'gemini vision', by: 'gemini', status: 'failed', input: '1 label photo', output: r.error }, start); return null; }
    const f: LabelFields = r;
    models.add(r.model_id);
    log({ step: 'readLabel', tool: `gemini vision · ${r.model_id}`, by: 'gemini', status: 'ok', input: '1 label photo', output: brief({ drug: f.drug, strength: f.strength, lot: f.lot, maker: f.maker, expiry: f.expiry, confidence: f.confidence }) }, start);
    return { drug: f.drug, lot: f.lot, expiry: f.expiry, strength: f.strength, maker: f.maker, source: 'gemini' as const, confidence: f.confidence };
  })();
  const framesP = (async () => {
    const start = Date.now();
    if (!input.frames.length) { log({ step: 'inspectFrames', tool: 'gemini vision', by: 'gemini', status: 'skipped', input: 'no frames', output: 'skipped' }, start); return null; }
    if (!live) { log({ step: 'inspectFrames', tool: 'gemini vision', by: 'gemini', status: 'failed', input: `${input.frames.length} frame(s)`, output: 'no GEMINI_API_KEY on the service' }, start); return null; }
    try {
      const { observation: o, model } = await inspectFrames(input.frames);
      models.add(model);
      log({ step: 'inspectFrames', tool: `gemini vision · ${model}`, by: 'gemini', status: 'ok', input: `${input.frames.length} frame(s)`, output: brief(o) }, start);
      return o;
    } catch (e) {
      log({ step: 'inspectFrames', tool: 'gemini vision', by: 'gemini', status: 'failed', input: `${input.frames.length} frame(s)`, output: (e as Error).message }, start);
      return null;
    }
  })();
  const [label, seen] = await Promise.all([labelP, framesP]);
  const fields = { drug: label?.drug ?? null, lot: label?.lot ?? null, expiry: label?.expiry ?? null };

  // (b) (c) (e) code tools; Gemini chooses them through function calling when it can. The tools always run on the fields
  // the label read (or the app) produced, never on values the model typed into its call: a model once passed lot
  // "unknown", which matched an unrelated openFDA recall. The model's arguments are only noted in the step log.
  const got: { recall?: RecallResult; cross?: CrossCheck; rec?: Reconcile } = {};
  const argNote = (args: Record<string, unknown>) => (Object.keys(args).length ? ` (model asked ${brief(args)})` : '');
  const toolRecall = async (args: Record<string, unknown>, by: Step['by']) => {
    const start = Date.now();
    const r = got.recall = await lookupRecall(fields.lot);
    log({ step: 'lookupRecall', tool: 'openFDA / demo list', by, status: fields.lot ? 'ok' : 'skipped', input: `lot ${fields.lot ?? '— (no label)'}${argNote(args)}`, output: `${r.status} · ${r.source ?? 'no source'}${r.id ? ` · ${r.id}` : ''}` }, start);
    return r;
  };
  const toolCross = (args: Record<string, unknown>, by: Step['by']) => {
    const start = Date.now();
    const c = got.cross = crossCheck(fields, input.sensor.drug);
    log({ step: 'crossCheck', tool: 'code', by, status: fields.drug || fields.lot || fields.expiry ? 'ok' : 'skipped', input: `${brief(fields)}${argNote(args)}`, output: c.notes.join('; ') }, start);
    return c;
  };
  const toolReconcile = (by: Step['by']) => {
    const start = Date.now();
    const r = got.rec = reconcile(input.sensor, seen);
    log({ step: 'reconcile', tool: 'code', by, status: 'ok', input: `sensor ${input.sensor.verdict} ${input.sensor.rule} · glow ${input.sensor.glowRise}`, output: `agrees ${r.agrees} · ${r.note}` }, start);
    return r;
  };
  const runTool = async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (name === 'lookupRecall') return { ...(await toolRecall(args, 'gemini')) };
    if (name === 'crossCheck') return { ...toolCross(args, 'gemini') };
    if (name === 'reconcile') return { ...toolReconcile('gemini'), sensorVerdict: input.sensor.verdict };
    return { error: `no tool named ${name}` };
  };

  let agent: 'gemini function-calling' | 'scripted' = 'scripted';
  let agentModel: string | undefined;
  let summaryRaw: string | null = null;
  let agentError: string | null = null;
  const context = {
    sensor: { verdict: input.sensor.verdict, rule: input.sensor.rule, plateau: input.sensor.plateau, band: input.sensor.band, glow_rise: input.sensor.glowRise, glow_min: input.sensor.glowMin, reference_drug: input.sensor.drug },
    label: label ? { drug: label.drug, strength: label.strength, lot: label.lot, maker: label.maker, expiry: label.expiry } : null,
    camera: seen,
  };
  if (live) {
    const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }];
    try {
      for (let round = 0; round < 4 && left() > 8_000; round++) {
        const start = Date.now();
        // the same model for every round once one answered: thought signatures belong to the model that wrote them
        const r = await geminiGenerate({ system: AGENT_SYSTEM, contents, tools: TOOLS, timeoutMs: Math.min(25_000, left() - 6_000), model: agentModel ?? GEMINI_CHECKER_TOOLS_MODEL });
        agentModel = r.model;
        models.add(r.model);
        if (!r.functionCalls.length) {
          summaryRaw = r.text;
          log({ step: 'summarise', tool: `gemini · ${r.model}`, by: 'gemini', status: r.text ? 'ok' : 'failed', input: 'tool results', output: r.text ? 'summary written (filtered below)' : 'empty reply' }, start);
          break;
        }
        agent = 'gemini function-calling';
        contents.push(r.content);
        const responses: GeminiPart[] = [];
        for (const fc of r.functionCalls) responses.push({ functionResponse: { name: fc.name, response: await runTool(fc.name, fc.args) } });
        contents.push({ role: 'user', parts: responses });
      }
    } catch (e) {
      agentError = (e as Error).message;
    }
  }
  // anything the agent did not call runs scripted, in order
  const recallR = got.recall ?? await toolRecall({}, 'script');
  const crossR = got.cross ?? toolCross({}, 'script');
  const recR = got.rec ?? toolReconcile('script');

  // (f) summary: the agent's final text, or one plain call when function calling did not finish
  if (live && summaryRaw === null && left() > 3_000) {
    const start = Date.now();
    try {
      const r = await geminiGenerate({ system: AGENT_SYSTEM.replace(/^First call.*$/m, 'The tool results are already in the JSON.'), parts: [{ text: JSON.stringify({ ...context, recall: recallR, crossCheck: crossR, reconcile: recR }) }], timeoutMs: Math.min(20_000, left()), model: GEMINI_CHECKER_MODEL });
      summaryRaw = r.text;
      models.add(r.model);
      log({ step: 'summarise', tool: `gemini · ${r.model}`, by: 'gemini', status: 'ok', input: 'tool results', output: 'summary written (filtered below)' }, start);
    } catch (e) {
      log({ step: 'summarise', tool: 'gemini', by: 'gemini', status: 'failed', input: 'tool results', output: (e as Error).message }, start);
    }
  }
  const accepted = summaryRaw ? acceptSummary(summaryRaw, input.sensor.verdict) : null;
  const summary: CheckReport['summary'] = accepted
    ? { text: accepted.text, by: 'gemini', filtered: true, dropped: accepted.dropped, rejected: null }
    : { text: templateSummary(input.sensor.verdict, recR, recallR), by: 'template', filtered: true, dropped: [], rejected: summaryRaw ? 'the model summary failed the verdict/word check' : live ? 'no model summary' : 'no GEMINI_API_KEY on the service' };
  if (!live) steps.push({ step: 'summarise', tool: 'template', by: 'code', status: 'ok', input: 'tool results', output: 'template summary (no Gemini key)', at: Date.now() - t0, ms: 0 });

  steps.sort((a, b) => a.at - b.at);
  const totalMs = Date.now() - t0;
  console.log(`[check] ${steps.map((s) => `${s.step}:${s.status}:${s.ms}ms`).join(' ')} total ${totalMs}ms`);
  return {
    mode: live ? 'live' : 'partial',
    agent, agentError,
    model: models.size ? [...models].join(' + ') : null,
    runId: input.runId,
    // the sensor decides: copied from the request, never changed by anything above
    verdict: input.sensor.verdict,
    sensor: input.sensor,
    label: label ? { drug: label.drug, strength: label.strength, lot: label.lot, maker: label.maker, expiry: label.expiry, source: label.source, confidence: label.confidence } : null,
    recall: recallR, crossCheck: crossR, frames: seen, reconcile: recR,
    summary, steps, totalMs,
    notice: 'Not medical advice. The sensor result stands; a pharmacist or doctor decides.',
  };
}

/** POST /api/check */
export async function checkRoute(body: Record<string, unknown>) {
  const input = parseCheck(body);
  if ('error' in input) return { status: 400, body: { mode: 'unavailable', error: input.error } };
  return { body: await runCheck(input) };
}
