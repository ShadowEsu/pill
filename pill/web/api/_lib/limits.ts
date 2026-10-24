// Best-effort Gemini spend limits, in memory per instance (a Vercel instance or the local service). Cold starts and parallel
// instances each start from zero, so this bounds abuse; it is not an exact quota. Only counters are kept: no bodies.
//   per IP   10 requests / minute and 100 / UTC day
//   global   GEMINI_DAILY_CAP requests / UTC day (default 2000)
import type { IncomingMessage } from 'node:http';

const PER_MIN = 10;
const PER_DAY = 100;
const dailyCap = () => Number(process.env.GEMINI_DAILY_CAP) || 2000;

const day = () => new Date().toISOString().slice(0, 10);
let today = day();
let globalCount = 0;
const perIp = new Map<string, { minute: number[]; dayCount: number }>();

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

export function takeQuota(ip: string): { ok: true } | { ok: false; reason: string; retryAfterS: number } {
  const now = Date.now();
  if (day() !== today) { today = day(); globalCount = 0; perIp.clear(); }
  const midnight = Math.ceil((Date.parse(`${today}T00:00:00Z`) + 86_400_000 - now) / 1000);
  if (globalCount >= dailyCap()) return { ok: false, reason: 'daily Gemini cap reached for this service', retryAfterS: midnight };
  const e = perIp.get(ip) ?? { minute: [], dayCount: 0 };
  e.minute = e.minute.filter((t) => now - t < 60_000);
  if (e.dayCount >= PER_DAY) return { ok: false, reason: `more than ${PER_DAY} requests today from this address`, retryAfterS: midnight };
  if (e.minute.length >= PER_MIN) return { ok: false, reason: `more than ${PER_MIN} requests a minute from this address`, retryAfterS: Math.ceil((60_000 - (now - e.minute[0])) / 1000) };
  e.minute.push(now); e.dayCount++; globalCount++;
  perIp.set(ip, e);
  return { ok: true };
}
