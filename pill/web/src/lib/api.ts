// Typed calls to the pill-pay service (VITE_PAY_URL). Each helper returns the service's own answer, or
// {mode:'unavailable', error} when the URL is not set or the service does not answer: the screens fall back on that.
import type { Run, RuleId, Verdict } from './types';
import { absorbance } from './rules';

export const PAY_URL = (import.meta.env.VITE_PAY_URL as string | undefined)?.replace(/\/$/, '') || null;
/** Gemini routes (/api/label, /api/check, /api/assist): the local service when VITE_PAY_URL is set, else the app's own
 *  Vercel functions on the same origin. Payments never go through the functions. */
export const AI_BASE = PAY_URL ?? '';

export type Unavailable = { mode: 'unavailable'; error: string };

async function postTo<T>(base: string, path: string, body: unknown, timeoutMs: number): Promise<T | Unavailable> {
  try {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    const j = (await res.json()) as T | (Unavailable & { retryAfterS?: number });
    if (res.ok) return j as T;
    const err = j as Unavailable;
    return { mode: 'unavailable', error: res.status === 429 ? `busy: ${err.error ?? 'too many requests'}, try again in a minute` : err.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { mode: 'unavailable', error: (e as Error).message };
  }
}

const post = <T>(path: string, body: unknown, timeoutMs: number): Promise<T | Unavailable> =>
  PAY_URL ? postTo<T>(PAY_URL, path, body, timeoutMs) : Promise.resolve({ mode: 'unavailable', error: 'no VITE_PAY_URL' });

/** Gemini routes: the local service when VITE_PAY_URL is set, the app's own /api functions otherwise. */
export const aiPost = <T>(path: string, body: unknown, timeoutMs: number) => postTo<T>(AI_BASE, path, body, timeoutMs);

// ---- POST /api/label (Gemini vision) ----

export interface LabelRead { drug: string | null; strength: string | null; lot: string | null; maker: string | null; expiry: string | null; confidence: number; model: 'gemini'; model_id: string; mode: 'live' }

/** `image`: a JPEG data URL from lib/camera (≤ 300 KB); the photo never leaves memory. */
export const readLabel = (image: string) => aiPost<LabelRead>('/api/label', { image }, 35_000);

// ---- POST /why (Claude, clause-filtered) ----

export interface WhyInput {
  verdict: Verdict; rule: RuleId; plateau: number; band: [number, number] | null; glowMin: number | null; scatterMax: number | null;
  glowRise: number; scatter: number; temp: number; fault: string | null; recall: string; mode: 'medical' | 'personal';
}
export interface WhyLive { why: string; plain?: string; model: 'claude'; model_id: string; filtered: true; dropped: string[]; contradiction: boolean; mode: 'live' }
export interface WhyTemplate { why: string; plain?: string; model: 'template'; filtered: boolean; dropped: string[]; mode: 'template'; reason: string }

export const fetchWhy = (input: WhyInput) => post<WhyLive | WhyTemplate>('/why', input, 25_000);

// ---- POST /speak (ElevenLabs) ----

/** mp3 blob from ElevenLabs, or unavailable (no key on the service, no service). */
export async function speakRemote(text: string): Promise<Blob | Unavailable> {
  if (!PAY_URL) return { mode: 'unavailable', error: 'no VITE_PAY_URL' };
  try {
    const res = await fetch(`${PAY_URL}/speak`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(20_000) });
    if (res.ok && res.headers.get('content-type')?.startsWith('audio/')) return await res.blob();
    const j = (await res.json().catch(() => ({}))) as Partial<Unavailable>;
    return { mode: 'unavailable', error: j.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { mode: 'unavailable', error: (e as Error).message };
  }
}

let speechProbe: Promise<'elevenlabs' | 'unavailable'> | null = null;
/** Which voice the service offers, asked once per page load from GET /health. */
export function serviceVoice() {
  speechProbe ??= PAY_URL
    ? fetch(`${PAY_URL}/health`, { signal: AbortSignal.timeout(8_000) }).then((r) => r.json()).then((h: { speech?: string }): 'elevenlabs' | 'unavailable' => (h.speech === 'elevenlabs' ? 'elevenlabs' : 'unavailable')).catch(() => 'unavailable' as const)
    : Promise.resolve('unavailable' as const);
  return speechProbe;
}

// ---- GET /nessie/accounts (Capital One Nessie SANDBOX mirror) ----

export interface NessieAccounts { mode: 'sandbox'; label: 'SANDBOX'; customer_id: string; accounts: { role: 'clinic' | 'escrow' | 'supplier'; nickname: string; id: string; balance: number }[] }
export interface NessieTransfer { mode: 'sandbox'; transfer_id: string | null; from: string; to: string; amount: number }

export async function nessieAccounts(): Promise<NessieAccounts | { mode: 'unavailable'; reason: string }> {
  if (!PAY_URL) return { mode: 'unavailable', reason: 'no VITE_PAY_URL' };
  try {
    const res = await fetch(`${PAY_URL}/nessie/accounts`, { signal: AbortSignal.timeout(15_000) });
    return (await res.json()) as NessieAccounts | { mode: 'unavailable'; reason: string };
  } catch (e) {
    return { mode: 'unavailable', reason: (e as Error).message };
  }
}

// ---- POST /ask (Claude, answers only from the record the app sends; clause-filtered) ----

export interface AskAnswer { answer: string; model: 'claude' | 'template'; model_id?: string; filtered: boolean; dropped: string[]; mode: 'live' | 'template'; reason?: string }

export const askPill = (question: string, mode: 'medical' | 'personal', context: Record<string, unknown>) =>
  post<AskAnswer>('/ask', { question, mode, context }, 30_000);

// ---- Tiger Data (TimescaleDB hypertable of station samples; only when the service has TIGER_URL) ----

export type TigerStatus = { mode: 'live'; rows: number; runs: number; last: string | null } | { mode: 'unavailable'; reason?: string; error?: string };

export async function getTigerStatus(): Promise<TigerStatus> {
  if (!PAY_URL) return { mode: 'unavailable', reason: 'no VITE_PAY_URL' };
  try {
    const res = await fetch(`${PAY_URL}/tiger/status`, { signal: AbortSignal.timeout(10_000) });
    return (await res.json()) as TigerStatus;
  } catch (e) {
    return { mode: 'unavailable', reason: (e as Error).message };
  }
}

/** One batched insert of a run's curve: t, inline absorbance, 90° glow absorbance, water temperature. */
export const postSamples = (run: Run, station = 'STATION 01') =>
  post<{ mode: 'live'; inserted: number }>('/tiger/samples', {
    run_id: run.id, station, started_at: run.startedAt,
    samples: run.samples.map((s) => ({ t: s.t, abs: +absorbance(s.blank, s.adc0).toFixed(4), glow: +absorbance(s.blank, s.adc90).toFixed(4), temp: s.temp })),
  }, 15_000);

// ---- POST /api/check (the Gemini checker; mirrors api/_lib/checker.ts CheckReport) ----

export interface CheckSensor { verdict: Verdict; rule: RuleId; plateau: number; band: [number, number] | null; glowRise: number; glowMin: number | null; drug: string }
export interface CheckStep { step: string; tool: string; by: 'gemini' | 'code' | 'app' | 'script'; status: 'ok' | 'skipped' | 'failed'; input: string; output: string; at: number; ms: number }
export interface FrameObservation {
  cupVisible: boolean; liquidClarity: 'clear' | 'hazy' | 'cloudy' | 'unknown'; colour: 'none' | 'yellow' | 'other' | 'unknown';
  tabletState: 'intact' | 'breaking' | 'gone' | 'unknown'; anomalies: string[]; confidence: number;
}
export interface CheckReport {
  mode: 'live' | 'partial';
  agent: 'gemini function-calling' | 'scripted';
  agentError: string | null;
  model: string | null;
  runId: string | null;
  /** the sensor verdict, unchanged */
  verdict: Verdict;
  sensor: CheckSensor;
  label: { drug: string | null; strength: string | null; lot: string | null; maker: string | null; expiry: string | null; source: 'gemini' | 'given'; confidence: number | null } | null;
  recall: { status: 'recall' | 'no_record' | 'unreachable' | 'unchecked'; source: 'openFDA' | 'demo list' | null; lot: string | null; id: string | null; product: string | null; note: string };
  crossCheck: { expiry: 'past' | 'current' | 'unknown'; drugMatches: 'yes' | 'no' | 'unknown'; lotPlausible: 'yes' | 'no' | 'unknown'; notes: string[] };
  frames: FrameObservation | null;
  reconcile: { agrees: 'yes' | 'no' | 'unclear'; expected: string; saw: string; note: string };
  summary: { text: string; by: 'gemini' | 'template'; filtered: true; dropped: string[]; rejected: string | null };
  steps: CheckStep[];
  totalMs: number;
  notice: string;
}
export interface CheckRequest {
  label?: { image: string };
  frames?: string[];
  runId?: string;
  sensor: CheckSensor;
  /** fields the app already has (a saved bottle, or the run's own drug and lot); skips the label read */
  bottle?: { drug: string; lot: string; expiry?: string; strength?: string; maker?: string };
}

export const runChecker = (req: CheckRequest) => aiPost<CheckReport>('/api/check', req, 70_000);
