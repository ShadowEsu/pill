// Security properties of the Gemini functions (from the security re-check at 139760d): LOW-1 no upstream/key text in bodies, events or logs; LOW-2 filtered streaming; LOW-3 limiter keys and costs.
// Run: npm run test:security (no network: fetch is stubbed; the key is fake).
import { EventEmitter } from 'node:events';
const LIB = new URL('../../web/api/_lib', import.meta.url).pathname;
const FAKE_KEY = 'AIzaSyFAKEkeyFORsecurityPOC000000000000';
process.env.GEMINI_API_KEY = FAKE_KEY;
const { endpoint } = await import(`${LIB}/http.ts`);
const { labelRoute } = await import(`${LIB}/label.ts`);
const { checkRoute } = await import(`${LIB}/checker.ts`);
const { takeQuota, rateKey, routeCost } = await import(`${LIB}/limits.ts`);
const { assist, tipRoute } = await import(`${LIB}/follower.ts`);

let fails = 0;
const check = (ok: boolean, label: string) => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', label); };

// capture every log line: the key must not appear there either
const logs: string[] = [];
for (const k of ['log', 'error', 'warn'] as const) { const o = console[k]; console[k] = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); if (!String(a[0]).startsWith('[')) o(...a); }; }

function call(handler: (req: any, res: any) => Promise<void>, body: unknown, ip = '198.51.100.1') {
  return new Promise<{ status: number; body: string }>((resolve) => {
    const req: any = Object.assign(new EventEmitter(), { method: 'POST', headers: { host: 'pill.example', 'x-forwarded-for': ip }, body, socket: { remoteAddress: '127.0.0.1' } });
    const res: any = { headersSent: false, statusCode: 200, setHeader() {}, end(s?: string) { resolve({ status: this.statusCode, body: s ?? '' }); } };
    void handler(req, res);
  });
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const keyErr = JSON.stringify({ error: { code: 403, message: `Permission denied: Consumer 'api_key:${FAKE_KEY}' has been suspended.`, status: 'PERMISSION_DENIED' } });

// ---- LOW-1: every path, with upstream text that names the key ----
const upstreams: [string, typeof fetch][] = [
  ['HTTP 403 body names the key', (async () => new Response(keyErr, { status: 403 })) as typeof fetch],
  ['HTTP 400 body names the key', (async () => new Response(keyErr, { status: 400 })) as typeof fetch],
  ['fetch throws with the key in its message', (async () => { throw new Error(`connect failed for key=${FAKE_KEY}`); }) as typeof fetch],
  ['stream error chunk names the key', (async (u: string) => String(u).includes('stream')
    ? new Response(`data: ${keyErr}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    : new Response(keyErr, { status: 500 })) as typeof fetch],
];
const sensor = { verdict: 'NEEDS LAB', rule: 'N1', plateau: 0.4, band: [0.6, 0.9], glowRise: 0.1, drug: 'riboflavin' };
for (const [name, f] of upstreams) {
  globalThis.fetch = f;
  const out: string[] = [];
  out.push((await call(endpoint('label', labelRoute), { image: PNG }, '198.51.100.10')).body);
  out.push((await call(endpoint('check', checkRoute), { sensor, label: PNG, frames: [PNG], bottle: null }, '198.51.100.11')).body);
  out.push((await call(endpoint('assist-tip', tipRoute), { mode: 'medical', route: `/r-${name.length}`, screenContext: { n: name } }, '198.51.100.12')).body);
  const ev: unknown[] = [];
  await assist({ message: 'what does this mean?', mode: 'medical', bigText: false, route: '/x', screenContext: {}, history: [] }, (e: unknown) => ev.push(e));
  out.push(JSON.stringify(ev));
  const all = out.join('\n') + '\n' + logs.join('\n');
  check(!all.includes(FAKE_KEY) && !all.includes('api_key') && !all.includes('Permission denied'), `LOW-1 ${name}: no key or upstream text in label/check/tip bodies, assist events or logs`);
}
const reasons = JSON.stringify([...logs.join(' ').matchAll(/\[gemini [^\]]+\] \S+ \S+ (\w+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i));
console.log('INFO log reasons seen:', reasons);

// ---- LOW-2: no delta may carry a banned word or a dose clause, wherever the chunks split ----
const answers = [
  ['Yes, it is safe and you can take two tablets now. ', 'The screen shows PASS.'],
  ['Yes.', ' You can', ' take two. The result is N', 'EEDS LAB.'],
  ['This one looks gen', 'uine to me; the lab will confirm. It shows NEEDS LAB.'],
  ['The plateau is low. It is fine to take', ' this one, the sensor is ', 'wrong'],
  ['No boundary at all and it is guaranteed safe'],
];
for (const parts of answers) {
  const sse = parts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join('');
  globalThis.fetch = (async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })) as typeof fetch;
  const ev: any[] = [];
  await assist({ message: 'can I take two?', mode: 'personal', bigText: false, route: '/x', screenContext: {}, history: [] }, (e: any) => ev.push(e));
  const deltas = ev.filter((e) => e.type === 'delta').map((e) => e.text).join('');
  const bad = /\b(safe\w*|genuine\w*|guarantee\w*)\b|you\s+can\s+take|take\s+two|fine\s+to\s+take|sensor\s+is\s+wrong/i.test(deltas);
  check(!bad, `LOW-2 ${JSON.stringify(parts.join('')).slice(0, 60)}: streamed deltas = ${JSON.stringify(deltas).slice(0, 90)}`);
}

// ---- LOW-3: IPv6 per /64, IPv4-mapped unwrapped, /api/check weighted ----
let ok = 0;
for (let i = 0; i < 30; i++) for (let j = 0; j < 10; j++) if (takeQuota(rateKey(`2001:db8:1:2::${(i + 1).toString(16)}`)).ok) ok++;
check(ok === 10, `LOW-3 one /64, 30 addresses x 10 requests in a minute: ${ok} accepted (want 10)`);
check(rateKey('::ffff:203.0.113.9') === '203.0.113.9' && rateKey('2001:DB8:1:2:aaaa::1') === rateKey('2001:db8:1:2::ffff'), `LOW-3 keys: mapped ${rateKey('::ffff:203.0.113.9')}, /64 ${rateKey('2001:DB8:1:2:aaaa::1')}`);
const k = rateKey('203.0.113.50');
const checks = [0, 1, 2].map(() => takeQuota(k, routeCost('check')).ok);
check(JSON.stringify(checks) === '[true,true,false]', `LOW-3 /api/check costs ${routeCost('check')}: three checks in a minute -> ${JSON.stringify(checks)}`);

console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
