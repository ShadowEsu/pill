// The follower assistant's client side: its two settings, the compact screen context it sends with every question
// (built from the store for the current route, ≤ 1.5 KB), the suggested questions per route, and the calls to
// /api/assist (SSE stream) and /api/assist-tip (one sentence, cached 60 s here and on the server).
// Nothing here persists the conversation: the transcript lives in the Follower component's memory only.
import { useSyncExternalStore } from 'react';
import { AI_BASE } from './api';
import { getState, type State } from './store';
import { REFERENCES, DRUGS } from '../data/reference';
import type { Mode } from './types';

/* ---------------- settings (localStorage, defaults: follower on, voice off) ---------------- */

const ON_KEY = 'pill.follower.on', VOICE_KEY = 'pill.follower.voice', OPEN_KEY = 'pill.follower';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage off */ } };

let settings = { on: read(ON_KEY) !== 'off', voice: read(VOICE_KEY) === 'on' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const followerSettings = {
  setOn(on: boolean) { settings = { ...settings, on }; write(ON_KEY, on ? 'on' : 'off'); emit(); },
  setVoice(voice: boolean) { settings = { ...settings, voice }; write(VOICE_KEY, voice ? 'on' : 'off'); emit(); },
};
export const useFollowerSettings = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => settings);

/** Open/closed survives reloads (localStorage['pill.follower'] = 'open' | 'closed'); the transcript does not. */
export const readOpen = () => read(OPEN_KEY) === 'open';
export const writeOpen = (open: boolean) => write(OPEN_KEY, open ? 'open' : 'closed');

/* ---------------- screen context ---------------- */

const SCREEN: Record<string, string> = {
  '': 'Home', home: 'Today (home)', bottle: 'Scan a bottle label', place: 'Place the tablet in the station', run: 'A run in progress',
  runs: 'All runs', evaluation: 'A run result', deliveries: 'Deliveries in escrow', delivery: 'One delivery and its payment',
  medicines: 'My medicines', schedule: 'Reminder schedule', activity: 'Activity feed', log: 'Dose log', calibration: 'Station calibration',
  verify: 'Paid verify (x402)', ask: 'Ask Pill', settings: 'Settings', agent: 'Agent record', pay: 'Checkout', check: 'Camera check',
  story: 'How Pill works', welcome: 'Welcome', demo: 'Guided demo',
};

const MAX_CTX = 1500;
const name = (drug: string) => DRUGS[drug]?.name ?? drug;

function evaluationCtx(s: State, id: string) {
  const run = s.runs.find((r) => r.id === id);
  if (!run) return { missing: `no run ${id} on this device` };
  const ev = run.evaluation;
  const ref = REFERENCES[run.drug] ?? REFERENCES[s.station.reference ?? ''] ?? null;
  const d = s.deliveries.find((x) => x.runId === id);
  const b = s.bottles.find((x) => x.runId === id);
  return {
    run: run.id, drug: name(run.drug), lot: run.lot, source: run.src,
    ...(ev ? {
      verdict: ev.verdict, rule: ev.rule, pct: ev.pct, plateau: ev.plateau, band: ev.rule !== 'U1' && ref ? [ref.bandLow, ref.bandHigh] : null,
      glowRise: ev.glowRise, glowMin: ref?.glowMin ?? null, scatter: ev.scatter, temp: ev.temp, fault: ev.fault, why: ev.why, nextStep: ev.nextStep,
    } : { verdict: null, status: 'still running' }),
    recall: b ? b.recall : 'unchecked',
    delivery: d ? { id: d.id, supplier: d.supplier, amountUsd: d.amountUsd, outcome: d.outcome, clause: d.clause } : null,
  };
}

function deliveryCtx(s: State, id: string) {
  const d = s.deliveries.find((x) => x.id === id);
  if (!d) return { missing: `no delivery ${id}` };
  const ev = s.runs.find((r) => r.id === d.runId)?.evaluation;
  const b = s.bottles.find((x) => x.id === d.bottleId);
  return {
    delivery: d.id, supplier: d.supplier, drug: name(d.drug), lot: d.lot, amountUsd: d.amountUsd, money: 'SANDBOX / TESTNET',
    outcome: d.outcome, clause: d.clause, verdict: ev?.verdict ?? null, rule: ev?.rule ?? null, recall: b?.recall ?? 'unchecked',
    log: d.log.slice(-4).map((l) => l.text.slice(0, 160)),
  };
}

function routeCtx(s: State, seg: string[], mode: Mode): Record<string, unknown> {
  const [head = '', id = ''] = seg;
  switch (head) {
    case 'evaluation': return evaluationCtx(s, id);
    case 'delivery': return deliveryCtx(s, id);
    case 'run': {
      const r = s.runs.find((x) => x.id === id);
      return r ? { run: r.id, drug: name(r.drug), lot: r.lot, seconds: r.samples.at(-1)?.t ?? 0, samples: r.samples.length, verdict: r.evaluation?.verdict ?? null } : { missing: `no run ${id}` };
    }
    case 'runs': return { runs: s.runs.slice(0, 10).map((r) => ({ id: r.id, drug: name(r.drug), lot: r.lot, verdict: r.evaluation?.verdict ?? 'running', rule: r.evaluation?.rule ?? null })) };
    case 'deliveries': return { deliveries: s.deliveries.slice(0, 8).map((d) => ({ id: d.id, supplier: d.supplier, lot: d.lot, amountUsd: d.amountUsd, outcome: d.outcome, clause: d.clause })), money: 'SANDBOX / TESTNET' };
    case 'medicines': case 'schedule': case 'log': case 'home':
      return { medicines: s.bottles.slice(0, 8).map((b) => ({ name: `${b.drug} ${b.strength}`, usedFor: b.usedFor.slice(0, 90), reminder: b.reminder, recall: b.recall, tested: b.runId ? s.runs.find((r) => r.id === b.runId)?.evaluation?.verdict ?? 'running' : 'not tested' })) };
    case '':
      return mode === 'medical'
        ? { runs: s.runs.length, needsLab: s.runs.filter((r) => r.evaluation?.verdict === 'NEEDS LAB').length, unable: s.runs.filter((r) => r.evaluation?.verdict === 'UNABLE TO VERIFY').length, held: s.deliveries.filter((d) => d.outcome === 'hold' || d.outcome === 'escalate').length, pending: s.deliveries.filter((d) => d.outcome === 'pending').length, station: s.station.online ? 'online' : 'offline' }
        : routeCtx(s, ['home'], mode);
    case 'calibration': case 'place': return { station: s.station.id, online: s.station.online, reference: s.station.reference, calibratedAt: s.station.calibratedAt ? new Date(s.station.calibratedAt).toISOString().slice(0, 16) : null };
    default: return {};
  }
}

/** Compact JSON for the current route; list items are dropped from the end until it fits in 1.5 KB. */
export function screenContext(pathname: string): Record<string, unknown> {
  const s = getState();
  const mode: Mode = s.mode ?? 'personal';
  const seg = pathname.split('/').filter(Boolean);
  const ctx: Record<string, unknown> = { screen: SCREEN[seg[0] ?? ''] ?? seg[0], mode, ...routeCtx(s, seg, mode) };
  const lists = Object.keys(ctx).filter((k) => Array.isArray(ctx[k]));
  while (JSON.stringify(ctx).length > MAX_CTX && lists.some((k) => (ctx[k] as unknown[]).length > 1)) {
    const k = lists.reduce((a, b) => ((ctx[a] as unknown[]).length >= (ctx[b] as unknown[]).length ? a : b));
    ctx[k] = (ctx[k] as unknown[]).slice(0, -1);
  }
  if (JSON.stringify(ctx).length > MAX_CTX && typeof ctx.why === 'string') ctx.why = ctx.why.slice(0, 200);
  return ctx;
}

/* ---------------- suggested questions ---------------- */

export const READ_IT = 'Read it to me';

export function suggestions(pathname: string, mode: Mode): string[] {
  const s = getState();
  const [head = '', id = ''] = pathname.split('/').filter(Boolean);
  const personal = mode === 'personal';
  if (head === 'evaluation') {
    const v = s.runs.find((r) => r.id === id)?.evaluation?.verdict ?? 'this result';
    return personal ? [`What does ${v} mean for me?`, 'What should I do next?', READ_IT] : [`What does ${v} mean here?`, 'What happens to the payment?', READ_IT];
  }
  if (head === 'delivery') return ['Why is this payment where it is?', 'What happens to the payment?', READ_IT];
  if (head === 'deliveries') return ['Which payments are held?', 'What does a hold mean?', READ_IT];
  if (head === 'runs') return ['Which runs need a lab?', 'What do the three verdicts mean?', READ_IT];
  if (head === 'run') return ['What is the station measuring?', 'What happens when it finishes?', READ_IT];
  if (head === 'medicines' || head === 'schedule' || head === 'home' || (head === '' && personal)) return ['What are my reminders?', 'What is each medicine for?', READ_IT];
  if (head === 'bottle' || head === 'check') return ['What does Pill read from the label?', 'What is a recall check?', READ_IT];
  return ['What is this screen?', 'What can you help with?', READ_IT];
}

/* ---------------- calls ---------------- */

/** 'gemini-3.1-pro-preview' → 'Gemini 3.1 Pro', 'gemini-3.5-flash' → 'Gemini 3.5 Flash', '…-flash-lite' → '… Flash-Lite'. */
export function prettyModel(id: string): string {
  const m = /^(?:models\/)?gemini-(\d+(?:\.\d+)?)-(pro|flash)(-lite)?/i.exec(id);
  return m ? `Gemini ${m[1]} ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}${m[3] ? '-Lite' : ''}` : id;
}

export interface Turn { role: 'user' | 'model'; text: string }
export interface Done { mode: 'live' | 'template'; model: string; filtered: true; dropped: number; disclaimer: boolean; ms: number; error?: string }
export type AssistResult = { ok: true; text: string; done: Done; replaced: boolean } | { ok: false; busy: boolean; stopped: boolean; error: string };

interface Body { message: string; mode: Mode; bigText: boolean; route: string; screenContext: Record<string, unknown>; history: Turn[] }

/** The service gives up after 20 s across its model chain; the client stops waiting a little after that. */
const CLIENT_TIMEOUT_MS = 24_000;

/** POST /api/assist and read the SSE stream: `model` names who answers, `delta` appends, `replace` swaps in the filtered
 *  text, `done` closes. `signal` is the person's Stop. */
export async function streamAssist(body: Body, on: { text: (text: string) => void; model: (model: string) => void }, stop: AbortSignal): Promise<AssistResult> {
  const signal = AbortSignal.any([stop, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]);
  const fail = (error: string) => ({ ok: false as const, busy: false, stopped: stop.aborted, error: stop.aborted ? 'stopped' : signal.aborted ? 'no answer in time' : error });
  let res: Response;
  try {
    res = await fetch(`${AI_BASE}/api/assist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    return fail(`assistant unreachable (${(e as Error).message})`);
  }
  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; mode?: string };
    return { ok: false, busy: res.status === 429, stopped: false, error: j.error ?? `HTTP ${res.status}` };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '', text = '', done: Done | null = null, replaced = false;
  try {
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += value;
      let cut: number;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, cut); buf = buf.slice(cut + 2);
        const data = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!data) continue;
        const e = JSON.parse(data.slice(5)) as { type: string; text?: string; model?: string } & Partial<Done>;
        if (e.type === 'model' && e.model) on.model(e.model);
        else if (e.type === 'delta' && e.text) { text += e.text; on.text(text); }
        else if (e.type === 'replace' && typeof e.text === 'string') { text = e.text; replaced = true; on.text(text); }
        else if (e.type === 'done') done = e as unknown as Done;
      }
    }
  } catch (e) {
    return fail(`stream broke (${(e as Error).message})`);
  }
  if (!done) return fail('the answer stopped before it finished');
  return { ok: true, text, done, replaced };
}

export interface Tip { tip: string; mode: 'live' | 'template'; model: string; cached: boolean; filtered: true; dropped: number }
const tipCache = new Map<string, { at: number; tip: Tip }>();

/** One sentence for the screen. Cached here 60 s per route + context so route hopping does not spend the quota. */
export async function fetchTip(route: string, mode: Mode, bigText: boolean, ctx: Record<string, unknown>): Promise<Tip | { mode: 'busy' | 'unavailable'; error: string }> {
  const key = `${route}|${mode}|${bigText ? 1 : 0}|${JSON.stringify(ctx)}`;
  const hit = tipCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return { ...hit.tip, cached: true };
  try {
    const res = await fetch(`${AI_BASE}/api/assist-tip`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ route, mode, bigText, screenContext: ctx }), signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) });
    const j = (await res.json()) as Tip & { error?: string; mode: string };
    if (!res.ok) return { mode: res.status === 429 ? 'busy' : 'unavailable', error: j.error ?? `HTTP ${res.status}` };
    if (j.mode === 'live') tipCache.set(key, { at: Date.now(), tip: j });
    return j;
  } catch (e) {
    return { mode: 'unavailable', error: (e as Error).message };
  }
}
