// Shared Gemini REST client (generativelanguage v1beta generateContent), used by the Vercel functions in pill/web/api and
// mounted by the local pill-pay service. The key (GEMINI_API_KEY) stays server-side; nothing is written to disk and nothing
// about the content is logged. Callers get either a result or a thrown GeminiError with a short reason.
// Model routing is env-driven (no code change when billing lands):
//   GEMINI_CHECKER_MODEL        checker vision + summary + label reads   default gemini-3.1-pro-preview
//   GEMINI_CHECKER_TOOLS_MODEL  checker function-calling rounds          default gemini-3.1-pro-preview-customtools
//   GEMINI_FOLLOWER_MODEL       follower chat (its own module)           default gemini-3.5-flash
//   GEMINI_FALLBACK_MODELS      tried in order after the first model fails (429 quota, timeout, 5xx, bad reply)
//                               default gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash
// Each model attempt gets at most 20 s (some models hang far longer) inside the caller's overall deadline.
import { setTimeout as sleep } from 'node:timers/promises';

export const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
export const GEMINI_CHECKER_MODEL = process.env.GEMINI_CHECKER_MODEL || 'gemini-3.1-pro-preview';
export const GEMINI_CHECKER_TOOLS_MODEL = process.env.GEMINI_CHECKER_TOOLS_MODEL || 'gemini-3.1-pro-preview-customtools';
export const MAX_OUTPUT_TOKENS = 700;
export const ATTEMPT_TIMEOUT_MS = 20_000;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { functionCall: { name: string; args?: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } }
  | Record<string, unknown>;
export interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }
export interface GeminiFunctionDecl { name: string; description: string; parameters?: Record<string, unknown> }

export interface GeminiRequest {
  system?: string;
  /** One user turn. Use `contents` instead for multi-turn (chat history, function-calling loops). */
  parts?: GeminiPart[];
  contents?: GeminiContent[];
  tools?: GeminiFunctionDecl[];
  /** responseMimeType application/json; `schema` adds a responseSchema (OpenAPI subset). */
  json?: boolean;
  schema?: Record<string, unknown>;
  model?: string;
  temperature?: number;
  /** Capped at MAX_OUTPUT_TOKENS (700); thinking tokens count against it. */
  maxOutputTokens?: number;
  thinking?: 'minimal' | 'low' | 'medium' | 'high';
  /** Overall deadline across the whole fallback chain (default 45 s); each model attempt is capped at 20 s. */
  timeoutMs?: number;
}

export interface GeminiResult {
  text: string;
  /** Parsed reply when `json` was asked for (first balanced {...}); null when not JSON. */
  json: Record<string, unknown> | null;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  /** The model turn verbatim (keeps thought signatures) — append it to `contents` for the next function-calling round. */
  content: GeminiContent;
  model: string;
  ms: number;
}

export class GeminiError extends Error {
  constructor(message: string, readonly status: number | null = null) { super(message); this.name = 'GeminiError'; }
}

export const geminiAvailable = () => Boolean(process.env.GEMINI_API_KEY);

const DATA_URL = /^data:(image\/(?:png|jpeg|jpg|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/;
/** `data:image/...;base64,...` → inline_data part, or null when it is not an image data URL. */
export function imagePart(dataUrl: unknown): GeminiPart | null {
  const m = typeof dataUrl === 'string' ? DATA_URL.exec(dataUrl) : null;
  return m ? { inline_data: { mime_type: m[1] === 'image/jpg' ? 'image/jpeg' : m[1], data: m[2] } } : null;
}

/** First balanced {...} in a reply (models sometimes wrap JSON in prose or fences). */
export function firstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { const v = JSON.parse(text.slice(start, i + 1)); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
    }
  }
  return null;
}

/** Models tried in order: the asked/default model, then GEMINI_FALLBACK_MODELS. Free-tier quotas are per model per day. */
export function geminiModelChain(model?: string): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([model || GEMINI_DEFAULT_MODEL, ...fallbacks])];
}

/** Gemini 2.x takes a token budget; 3.x takes a level ('minimal' is Flash-only, Pro gets 'low'). Thinking tokens count
 *  against the 700-token output cap. */
export function thinkingConfigFor(model: string, level: NonNullable<GeminiRequest['thinking']>): Record<string, unknown> {
  if (/^gemini-2\./.test(model)) return { thinkingBudget: level === 'minimal' ? 0 : level === 'low' ? 256 : 512 };
  if (/-pro/.test(model) && level === 'minimal') return { thinkingLevel: 'low' };
  return { thinkingLevel: level };
}

// Models that failed with a quota 429 or hung, and when to try them again. In memory, per instance.
const coolingUntil = new Map<string, number>();
export const isCooling = (model: string) => (coolingUntil.get(model) ?? 0) > Date.now();
export function coolDown(model: string, seconds: number) { coolingUntil.set(model, Date.now() + seconds * 1000); }

type GeminiReply = {
  candidates?: { content?: { role?: string; parts?: Record<string, unknown>[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; details?: { retryDelay?: string }[] };
};

/** One model, one attempt (plus one quick retry on a 5xx). Throws GeminiError; the caller decides whether to fall through. */
async function attempt(model: string, key: string, req: GeminiRequest, contents: GeminiContent[], timeoutMs: number): Promise<GeminiResult> {
  const t0 = Date.now();
  // Output is capped at 700 tokens (cost bound). Thinking tokens count against that cap (a plain default call spent 500
  // on thoughts), so thinking is 'minimal' unless the caller asks for more.
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0,
    maxOutputTokens: Math.min(MAX_OUTPUT_TOKENS, req.maxOutputTokens ?? MAX_OUTPUT_TOKENS),
    thinkingConfig: thinkingConfigFor(model, req.thinking ?? 'minimal'),
  };
  if (req.json && !req.tools?.length) {
    generationConfig.responseMimeType = 'application/json';
    if (req.schema) generationConfig.responseSchema = req.schema;
  }
  const body: Record<string, unknown> = { contents, generationConfig };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  if (req.tools?.length) body.tools = [{ functionDeclarations: req.tools }];
  const call = () => fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs - (Date.now() - t0))),
  });
  let res: globalThis.Response;
  try {
    res = await call();
    // 503 'high demand' spikes are short: one retry inside the same attempt.
    if (res.status >= 500 && Date.now() - t0 < timeoutMs - 3_000) { await sleep(600); res = await call(); }
  } catch (e) {
    const err = e as Error;
    if (err.name === 'TimeoutError') { coolDown(model, 120); throw new GeminiError(`${model} timed out after ${timeoutMs} ms`); }
    throw new GeminiError(`gemini unreachable: ${err.message}`);
  }
  const j = (await res.json().catch(() => ({}))) as GeminiReply;
  if (res.status === 429) {
    // quota for this model: cool it down for the delay Google names (default 60 s)
    coolDown(model, Number(/^(\d+)/.exec(j.error?.details?.find((d) => d.retryDelay)?.retryDelay ?? '')?.[1] ?? 60));
    throw new GeminiError(`gemini 429 on ${model}: quota exceeded`, 429);
  }
  if (!res.ok) throw new GeminiError(`gemini ${res.status} on ${model}: ${(j.error?.message ?? res.statusText).slice(0, 160)}`, res.status);
  if (j.promptFeedback?.blockReason) throw new GeminiError(`gemini blocked the prompt (${j.promptFeedback.blockReason})`);
  const cand = j.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  if (!parts.length) throw new GeminiError(`${model} returned no content${cand?.finishReason ? ` (${cand.finishReason})` : ''}`);
  const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => String(p.text)).join('').trim();
  const functionCalls = parts.flatMap((p) => {
    const fc = p.functionCall;
    if (!fc || typeof fc !== 'object' || !('name' in fc) || typeof fc.name !== 'string') return [];
    const args = 'args' in fc && fc.args && typeof fc.args === 'object' ? (fc.args as Record<string, unknown>) : {};
    return [{ name: fc.name, args }];
  });
  return {
    text, json: req.json ? firstJson(text) : null, functionCalls,
    content: { role: 'model', parts: parts as GeminiPart[] }, model, ms: Date.now() - t0,
  };
}

/** Tries the model chain in order (skipping cooling models while any other is ready) until one answers. */
export async function geminiGenerate(req: GeminiRequest): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('no GEMINI_API_KEY on the service');
  const contents = req.contents ?? [{ role: 'user' as const, parts: req.parts ?? [] }];
  if (!contents.length || contents.every((c) => !c.parts.length)) throw new GeminiError('nothing to send');
  const deadline = Date.now() + (req.timeoutMs ?? 45_000);
  const chain = geminiModelChain(req.model);
  const ready = chain.filter((m) => !isCooling(m));
  let lastError: GeminiError | null = null;
  for (const model of ready.length ? ready : chain) {
    const left = deadline - Date.now();
    if (left < 1_500) break;
    try {
      return await attempt(model, key, req, contents, Math.min(ATTEMPT_TIMEOUT_MS, left));
    } catch (e) {
      lastError = e instanceof GeminiError ? e : new GeminiError((e as Error).message);
      if (lastError.message.startsWith('gemini blocked')) throw lastError;
    }
  }
  throw lastError ?? new GeminiError('gemini: no time left for any model');
}
