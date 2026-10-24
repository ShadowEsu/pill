// The guard every Gemini route runs first (Vercel functions and the local service's /api/* mounts):
// POST only, origin check, Cache-Control: no-store, JSON body ≤ 1.5 MB, spend limits (429 {mode:'busy'}).
// Logs only `[api <route>] <status> <ms>ms`: never bodies, images or chat text.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { failReason } from './gemini.js';
import { clientIp, rateKey, routeCost, takeQuota } from './limits.js';

export type ApiReq = IncomingMessage & { body?: unknown };
/** `origins`: the local service passes its CORS list (app dev ports). Default (Vercel): same origin only. */
export interface EndpointOpts { origins?: Set<string> }

export const MAX_BODY_BYTES = 1_572_864;

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function logDone(route: string, status: number, t0: number) {
  console.log(`[api ${route}] ${status} ${Date.now() - t0}ms`);
}

function originAllowed(req: IncomingMessage, opts?: EndpointOpts): string | null | false {
  const origin = req.headers.origin;
  if (!origin) return null; // same-origin GET-less fetches and server-to-server calls send none
  if (opts?.origins?.has(origin)) return origin;
  try { return new URL(origin).host === req.headers.host ? origin : false; } catch { return false; }
}

async function readBody(req: ApiReq): Promise<unknown> {
  // Vercel and express.json() have already parsed it; otherwise read the stream with the size cap.
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body.length > MAX_BODY_BYTES ? Symbol.for('too-large') : JSON.parse(req.body);
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY_BYTES) return Symbol.for('too-large');
    chunks.push(c as Buffer);
  }
  return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

/** Returns the parsed JSON body, or null after it has answered the request itself (preflight, 4xx, 429). */
export async function guard(route: string, req: ApiReq, res: ServerResponse, opts?: EndpointOpts): Promise<Record<string, unknown> | null> {
  const t0 = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  const origin = originAllowed(req, opts);
  if (origin === false) { sendJson(res, 403, { mode: 'unavailable', error: 'cross-origin requests are not allowed' }); logDone(route, 403, t0); return null; }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return null; }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); sendJson(res, 405, { mode: 'unavailable', error: 'POST only' }); logDone(route, 405, t0); return null; }
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) { sendJson(res, 413, { mode: 'unavailable', error: 'body over 1.5 MB' }); logDone(route, 413, t0); return null; }
  let body: unknown;
  try { body = await readBody(req); } catch { sendJson(res, 400, { mode: 'unavailable', error: 'body is not JSON' }); logDone(route, 400, t0); return null; }
  if (body === Symbol.for('too-large')) { sendJson(res, 413, { mode: 'unavailable', error: 'body over 1.5 MB' }); logDone(route, 413, t0); return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { mode: 'unavailable', error: 'send a JSON object' }); logDone(route, 400, t0); return null; }
  const q = takeQuota(rateKey(clientIp(req)), routeCost(route));
  if (!q.ok) { res.setHeader('Retry-After', String(q.retryAfterS)); sendJson(res, 429, { mode: 'busy', error: q.reason, retryAfterS: q.retryAfterS }); logDone(route, 429, t0); return null; }
  return body as Record<string, unknown>;
}

/** guard → run → JSON answer; a thrown error is a 502 with a fixed reason (the detail is never sent; see failReason). */
export function endpoint(route: string, run: (body: Record<string, unknown>, req: ApiReq) => Promise<{ status?: number; body: unknown }>, opts?: EndpointOpts) {
  return async (req: ApiReq, res: ServerResponse) => {
    const t0 = Date.now();
    const body = await guard(route, req, res, opts);
    if (!body) return;
    let status = 200;
    try {
      const out = await run(body, req);
      status = out.status ?? 200;
      sendJson(res, status, out.body);
    } catch (e) {
      status = 502;
      sendJson(res, status, { mode: 'unavailable', error: failReason(route, e) });
    }
    logDone(route, status, t0);
  };
}
