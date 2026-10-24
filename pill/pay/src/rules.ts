// Port of web/src/lib/rules.ts + web/src/data/reference.ts (logic identical; keep in sync).
// The seven rules, in order. Deterministic; no model sets a verdict.

export interface Sample {
  t: number;
  adc0: number;
  adc90: number;
  temp: number;
  dark: number;
  blank: number;
  led: boolean;
  paddle: boolean;
  lid: boolean;
  fault: string | null;
}

export type Verdict = 'PASS' | 'NEEDS LAB' | 'UNABLE TO VERIFY';
export type RuleId = 'U1' | 'U2' | 'U3' | 'N1' | 'N2' | 'N3' | 'P1';

export interface Reference {
  drug: string;
  label: string;
  bandLow: number;
  bandHigh: number;
  bandMean: number;
  glowMin: number;
  scatterMax: number;
  runs: number;
  cv: number;
}

export interface Evaluation {
  verdict: Verdict;
  rule: RuleId;
  plateau: number;
  glowRise: number;
  scatter: number;
  pct: number;
  temp: number;
  fault: string | null;
  why: string;
  nextStep: string;
  ship: 'yes' | 'hold' | 'ask';
}

export const absorbance = (blank: number, now: number) => (now > 0 && blank > 0 ? Math.log10(blank / now) : 0);

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const std = (xs: number[]) => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

export function curve(samples: Sample[]) {
  return samples.map((s) => ({ t: s.t, a: absorbance(s.blank, s.adc0), g: absorbance(s.blank, s.adc90) }));
}

/** Plateau = median of the last 20 s of inline absorbance; scatter = SD of the last 30 s; glowRise = last-20 s median of 90° minus first-10 s median. */
export function features(samples: Sample[]) {
  const c = curve(samples);
  const last20 = c.filter((p) => p.t >= (c.at(-1)?.t ?? 0) - 20);
  const last30 = c.filter((p) => p.t >= (c.at(-1)?.t ?? 0) - 30);
  const first10 = c.filter((p) => p.t <= 10);
  return {
    plateau: median(last20.map((p) => p.a)),
    scatter: std(last30.map((p) => p.a)),
    glowRise: median(last20.map((p) => p.g)) - median(first10.map((p) => p.g)),
    temp: samples.at(-1)?.temp ?? 0,
    fault: samples.find((s) => s.fault)?.fault ?? null,
  };
}

export function evaluate(samples: Sample[], ref: Reference | null): Evaluation {
  const f = features(samples);
  const pct = ref ? Math.min(120, Math.round((f.plateau / ref.bandMean) * 100)) : 0;
  const mk = (verdict: Verdict, rule: RuleId, why: string, nextStep: string, ship: Evaluation['ship']): Evaluation => ({ verdict, rule, plateau: +f.plateau.toFixed(3), glowRise: +f.glowRise.toFixed(3), scatter: +f.scatter.toFixed(3), pct, temp: +f.temp.toFixed(1), fault: f.fault, why, nextStep, ship });

  if (!ref) return mk('UNABLE TO VERIFY', 'U1', 'There is no reference band for this drug on this station. Nothing was measured against anything, so there is no result to act on.', 'calibrate a reference first', 'ask');
  if (f.fault) return mk('UNABLE TO VERIFY', 'U2', `The station reported a fault (${f.fault.replace('_', ' ')}) during the run, so the curve cannot be trusted. Fix the station and retest with a new tablet.`, 'retest', 'ask');
  const span = samples.length ? samples[samples.length - 1].t - samples[0].t : 0;
  if (span < 30) return mk('UNABLE TO VERIFY', 'U3', `Only ${Math.max(0, Math.round(span))} s of samples arrived; a curve needs at least 30 s before it can be compared. Retest with a new tablet.`, 'retest', 'ask');
  if (f.scatter > ref.scatterMax) return mk('UNABLE TO VERIFY', 'U3', `The reading never settled: scatter ${f.scatter.toFixed(3)} is above the limit ${ref.scatterMax}. Retest with a new tablet and the lid closed the whole time.`, 'retest', 'ask');
  if (f.plateau < ref.bandLow) return mk('NEEDS LAB', 'N1', `The plateau ${f.plateau.toFixed(2)} sits below the reference band ${ref.bandLow}–${ref.bandHigh}, so this tablet dissolved less than the reference did. Send this lot to a lab; do not use this result to clear it.`, 'send to lab', 'hold');
  if (f.glowRise < ref.glowMin) return mk('NEEDS LAB', 'N2', `The inline channel moved but the 90° glow did not rise (${f.glowRise.toFixed(3)} vs ${ref.glowMin}), which is what chalk does and riboflavin does not. Send this lot to a lab.`, 'send to lab', 'hold');
  if (f.plateau > ref.bandHigh) return mk('NEEDS LAB', 'N3', `The plateau ${f.plateau.toFixed(2)} sits above the reference band ${ref.bandLow}–${ref.bandHigh}, so something absorbed more light than the reference. Send this lot to a lab.`, 'send to lab', 'hold');
  return mk('PASS', 'P1', `The plateau ${f.plateau.toFixed(2)} is inside the reference band ${ref.bandLow}–${ref.bandHigh} and the 90° glow rose with it. Proceed under clinic policy; this is a screening result, not a lab test.`, 'proceed under clinic policy', 'yes');
}

// ---- reference data (web/src/data/reference.ts) ----

export const REFERENCES: Record<string, Reference> = {
  riboflavin: { drug: 'riboflavin', label: 'Riboflavin 100 mg (¼ tablet)', bandLow: 0.36, bandHigh: 0.47, bandMean: 0.415, glowMin: 0.12, scatterMax: 0.03, runs: 10, cv: 7 },
};

/** Seeded noise so replays look the same every time. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Build a 180 s curve: inline absorbance rises to `plateau` with time constant `tau`; glow rises to `glow`. Blank = 3200 counts. */
export function makeCurve(opts: { plateau: number; tau: number; glow: number; seed: number; fault?: { at: number; code: string }; temp?: number }): Sample[] {
  const r = rng(opts.seed);
  const blank = 3200, dark = 12;
  const out: Sample[] = [];
  for (let t = 0; t <= 180; t++) {
    const a = opts.plateau * (1 - Math.exp(-t / opts.tau)) + (r() - 0.5) * 0.012;
    const g = opts.glow * (1 - Math.exp(-t / (opts.tau * 1.1))) + (r() - 0.5) * 0.008;
    const fault = opts.fault && t >= opts.fault.at ? opts.fault.code : null;
    out.push({
      t, adc0: Math.round(blank / Math.pow(10, Math.max(0, a))), adc90: Math.round(blank / Math.pow(10, Math.max(0, g))),
      temp: +((opts.temp ?? 24.6) + (r() - 0.5) * 0.2).toFixed(1), dark, blank, led: true, paddle: true, lid: fault !== 'lid_open', fault,
    });
  }
  return out;
}

export const REPLAYS: Record<string, { label: string; drug: string; lot: string; samples: Sample[] }> = {
  'B2-07': { label: 'Riboflavin ¼ tablet, lot B2-07', drug: 'riboflavin', lot: 'B2-07', samples: makeCurve({ plateau: 0.42, tau: 38, glow: 0.33, seed: 7 }) },
  'TM-02': { label: 'Chalk antacid ¼ tablet, lot TM-02 (cloudy water reaches the band, no glow)', drug: 'riboflavin', lot: 'TM-02', samples: makeCurve({ plateau: 0.40, tau: 50, glow: 0.015, seed: 2 }) },
  'B2-LID': { label: 'Riboflavin, lid opened at 0:41', drug: 'riboflavin', lot: 'B2-09', samples: makeCurve({ plateau: 0.42, tau: 38, glow: 0.33, seed: 9, fault: { at: 41, code: 'lid_open' } }) },
  'AMX-01': { label: 'Amoxicillin, no reference', drug: 'amoxicillin', lot: 'AMX-01', samples: makeCurve({ plateau: 0.3, tau: 45, glow: 0.05, seed: 11 }) },
};

// ---- request parsing (service-only) ----

/** Absorbance points {t, a, g} (what the app's Verify screen sends) → raw samples at blank 3200, so evaluate() sees the same numbers. */
export function samplesFromPoints(points: { t: number; a: number; g: number }[]): Sample[] {
  const blank = 3200;
  return points.map((p) => ({ t: p.t, adc0: Math.round(blank / Math.pow(10, Math.max(0, p.a))), adc90: Math.round(blank / Math.pow(10, Math.max(0, p.g))), temp: 24.6, dark: 12, blank, led: true, paddle: true, lid: true, fault: null }));
}

export type CurveInput = { lot: string; drug: string; source: 'replay' | 'body'; samples: Sample[] };

/** Accepts `{curve: 'B2-07'}` (a stored replay), `{drug, samples: Sample[]}` (raw station lines) or `{drug, samples: {t,a,g}[]}` (absorbance points). */
export function parseCurve(body: unknown): CurveInput | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.curve === 'string') {
    const r = REPLAYS[b.curve];
    if (!r) return { error: `unknown curve "${b.curve}"; known: ${Object.keys(REPLAYS).join(', ')}` };
    return { lot: r.lot, drug: r.drug, source: 'replay', samples: r.samples };
  }
  if (typeof b.drug === 'string' && Array.isArray(b.samples) && b.samples.length >= 2) {
    const xs = b.samples as Record<string, unknown>[];
    const lot = typeof b.lot === 'string' ? b.lot : 'unlabelled';
    if (xs.every((x) => typeof x?.t === 'number' && typeof x?.adc0 === 'number' && typeof x?.adc90 === 'number' && typeof x?.blank === 'number')) {
      return { lot, drug: b.drug.toLowerCase(), source: 'body', samples: xs as unknown as Sample[] };
    }
    if (xs.every((x) => typeof x?.t === 'number' && typeof x?.a === 'number' && typeof x?.g === 'number')) {
      return { lot, drug: b.drug.toLowerCase(), source: 'body', samples: samplesFromPoints(xs as { t: number; a: number; g: number }[]) };
    }
    return { error: 'samples must be station lines {t, adc0, adc90, blank, …} or absorbance points {t, a, g}' };
  }
  return { error: 'send {"curve":"B2-07"} or {"drug":"riboflavin","samples":[…]}' };
}

// ---- clause filter: one copy, shared with the Vercel functions ----
export { BANNED, filterClauses } from '../../web/api/_lib/filter.ts';
