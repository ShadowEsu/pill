// Streaming Gemini (generativelanguage v1beta :streamGenerateContent?alt=sse). Yields text deltas as they arrive; thought
// parts and thought signatures are skipped. Same key, model chain, token cap and error type as gemini.ts; nothing is
// written or logged.
// Until the first text arrives, a failing model falls through to the next one in geminiModelChain(): 429 (free-tier quota
// is per model per day), 404, 5xx, or no first text within FIRST_TEXT_MS (some preview models hang). After text has
// streamed, a failure throws: the caller decides what to show.
import { GeminiError, MAX_OUTPUT_TOKENS, coolDown, geminiModelChain, isCooling, thinkingConfigFor, type GeminiContent } from './gemini.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FIRST_TEXT_MS = 12_000;

export interface GeminiStreamRequest {
  system?: string;
  contents: GeminiContent[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Whole call, all models included (default 20 s). */
  timeoutMs?: number;
  /** Aborts the upstream request (the browser went away). */
  signal?: AbortSignal;
  /** Called once with the model that is answering, before its first delta. */
  onModel?: (model: string) => void;
}

type Chunk = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string }; error?: { message?: string } };

/** Marks a failure that may move on to the next model (nothing has streamed yet). */
class NextModel extends Error {}

export async function* geminiStream(req: GeminiStreamRequest): AsyncGenerator<string, { model: string; finish: string | null }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('no GEMINI_API_KEY on the service');
  const timeoutMs = req.timeoutMs ?? 20_000;
  const overall = AbortSignal.timeout(timeoutMs);
  const body = (model: string) => {
    const b: Record<string, unknown> = {
      contents: req.contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: Math.min(req.maxOutputTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
        thinkingConfig: thinkingConfigFor(model, 'minimal'),   // short answers; thinking tokens count against the cap
      },
    };
    if (req.system) b.systemInstruction = { parts: [{ text: req.system }] };
    return JSON.stringify(b);
  };

  let last = 'gemini unreachable';
  const chain = geminiModelChain(req.model);
  const ready = chain.filter((m) => !isCooling(m));
  for (const model of ready.length ? ready : chain) {
    if (overall.aborted || req.signal?.aborted) break;
    const first = new AbortController();
    const timer = setTimeout(() => first.abort(), FIRST_TEXT_MS);
    const signal = AbortSignal.any([overall, first.signal, ...(req.signal ? [req.signal] : [])]);
    let any = false, finish: string | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    try {
      let res: globalThis.Response;
      try {
        res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
          method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: body(model), signal,
        });
      } catch (e) {
        if (first.signal.aborted) { coolDown(model, 120); throw new NextModel(`gemini ${model}: no answer in ${FIRST_TEXT_MS / 1000} s`); }
        throw e;
      }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as Chunk;
        const msg = `gemini ${res.status} (${model}): ${(j.error?.message ?? res.statusText).slice(0, 160)}`;
        if (res.status === 429) coolDown(model, 60);
        if (res.status === 429 || res.status === 404 || res.status >= 500) throw new NextModel(msg);
        throw new GeminiError(msg, res.status);
      }
      reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        let chunk: ReadableStreamReadResult<string>;
        try { chunk = await reader.read(); } catch (e) {
          if (!any && first.signal.aborted) throw new NextModel(`gemini ${model}: no text in ${FIRST_TEXT_MS / 1000} s`);
          throw e;
        }
        if (chunk.done) break;
        buf += chunk.value;
        let cut: number;
        while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) {
          const event = buf.slice(0, cut);
          buf = buf.slice(cut).replace(/^\r?\n\r?\n/, '');
          const data = event.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
          if (!data) continue;
          let c: Chunk;
          try { c = JSON.parse(data) as Chunk; } catch { continue; }
          if (c.error) throw new GeminiError(`gemini (${model}): ${(c.error.message ?? 'stream error').slice(0, 200)}`);
          if (c.promptFeedback?.blockReason) throw new GeminiError(`gemini blocked the prompt (${c.promptFeedback.blockReason})`);
          const cand = c.candidates?.[0];
          if (cand?.finishReason) finish = cand.finishReason;
          for (const p of cand?.content?.parts ?? []) {
            if (typeof p.text !== 'string' || !p.text || p.thought) continue;
            if (!any) { any = true; clearTimeout(timer); req.onModel?.(model); }
            yield p.text;
          }
        }
      }
      if (!any) throw new NextModel(`gemini ${model} returned no text${finish ? ` (${finish})` : ''}`);
      return { model, finish };
    } catch (e) {
      if (e instanceof NextModel) { last = e.message; continue; }
      if (e instanceof GeminiError) throw e;
      const err = e as Error;
      throw new GeminiError(overall.aborted ? `gemini timed out after ${timeoutMs} ms` : `gemini stream broke: ${err.message}`);
    } finally {
      clearTimeout(timer);
      if (reader) void reader.cancel().catch(() => {});   // closes the upstream request if the caller stopped early
    }
  }
  throw new GeminiError(overall.aborted ? `gemini timed out after ${timeoutMs} ms` : last);
}
