// Best-effort Gemini spend limits, in memory per instance (a Vercel instance or the local service). Cold starts and parallel
// instances each start from zero, so this bounds abuse; it is not an exact quota. Only counters are kept: no bodies.
//   per address  10 units / minute and 100 units / UTC day (IPv6 counts per /64: one host usually holds the whole /64)
//   global       GEMINI_DAILY_CAP units / UTC day (default 2000)
// A request costs 1 unit; /api/check costs 5 (one check can make ~7 model calls: label, frames, agent rounds, summary).
import type { IncomingMessage } from 'node:http';

const PER_MIN = 10;
const PER_DAY = 100;
const COST: Record<string, number> = { check: 5 };
const dailyCap = () => Number(process.env.GEMINI_DAILY_CAP) || 2000;

const day = () => new Date().toISOString().slice(0, 10);
let today = day();
let globalCount = 0;
const perKey = new Map<string, { minute: number[]; dayCount: number }>();

export const routeCost = (route: string) => COST[route] ?? 1;

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/** The limiter key: an IPv4 address as is (IPv4-mapped IPv6 unwrapped), an IPv6 address as its /64 prefix. */
export function rateKey(ip: string): string {
  const a = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (mapped) return mapped[1];
  if (!a.includes(':')) return a;
  const [head, tail] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  // an embedded IPv4 tail (64:ff9b::1.2.3.4) fills two groups
  const size = (g: string[]) => g.reduce((n, x) => n + (x.includes('.') ? 2 : 1), 0);
  const groups = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - size(h) - size(t))).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}

/** Takes `units` from the key's minute and day budgets and from the global day cap, or says when to retry. */
export function takeQuota(key: string, units = 1): { ok: true } | { ok: false; reason: string; retryAfterS: number } {
  const now = Date.now();
  if (day() !== today) { today = day(); globalCount = 0; perKey.clear(); }
  const midnight = Math.ceil((Date.parse(`${today}T00:00:00Z`) + 86_400_000 - now) / 1000);
  if (globalCount + units > dailyCap()) return { ok: false, reason: 'daily Gemini cap reached for this service', retryAfterS: midnight };
  const e = perKey.get(key) ?? { minute: [], dayCount: 0 };
  e.minute = e.minute.filter((t) => now - t < 60_000);
  if (e.dayCount + units > PER_DAY) return { ok: false, reason: `more than ${PER_DAY} requests today from this address`, retryAfterS: midnight };
  if (e.minute.length + units > PER_MIN) {
    // wait until enough of the oldest units in the window have aged out
    const frees = e.minute[Math.min(e.minute.length - 1, e.minute.length + units - PER_MIN - 1)];
    return { ok: false, reason: `more than ${PER_MIN} requests a minute from this address`, retryAfterS: Math.max(1, Math.ceil((60_000 - (now - frees)) / 1000)) };
  }
  for (let k = 0; k < units; k++) e.minute.push(now);
  e.dayCount += units; globalCount += units;
  perKey.set(key, e);
  return { ok: true };
}
