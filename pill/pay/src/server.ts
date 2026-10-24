// pill-pay seller: POST /verify priced $0.05 USDC on Base Sepolia over x402, plus free health and escrow routes.
// Mode is chosen once at start, from the strongest thing the environment allows, and reported on every response:
//   cdp                → createX402Server (CDP Facilitator; needs CDP_API_KEY_ID, CDP_API_KEY_SECRET, X402_PAY_TO)
//   public-facilitator → @x402/express + @x402/evm against https://x402.org/facilitator (no account needed)
//   simulated          → a real-shaped 402 built with @x402/core; `X-PAYMENT: simulated` unlocks it; nothing settles
import express, { type NextFunction, type Request, type Response } from 'express';
import { CDP_FACILITATOR_URL, createX402Server } from '@coinbase/cdp-sdk/x402';
import { paymentMiddleware, paymentMiddlewareFromHTTPServer, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { encodePaymentRequiredHeader } from '@x402/core/http';
import type { PaymentRequired } from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { NETWORK, PORT, PRICE, PUBLIC_FACILITATOR, has, localWallet, missing, type Mode } from './env.ts';
import { REFERENCES, evaluate, parseCurve, type CurveInput } from './rules.ts';
import { accounts, escrowMode, move, type Move } from './escrow.ts';
import { calendarStatus, createEvent, type CalendarEventInput } from './calendar.ts';

const DESCRIPTION = 'Pill dissolution verdict for a curve';
const ROUTE = 'POST /verify';
const ORIGINS = new Set((process.env.CORS_ORIGINS || 'http://127.0.0.1:5183,http://localhost:5183,http://127.0.0.1:5186,http://localhost:5186,http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean));

const app = express();

// CORS for the app origins. The browser must be allowed to read the x402 headers.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT');
    res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PILL-MODE');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

// Parse every body as JSON regardless of content type (`curl -d` sends form-urlencoded by default).
app.use(express.json({ type: () => true, limit: '1mb' }));

// ---- choose the mode ----
async function pickMode(): Promise<{ mode: Mode; facilitator: string; payTo: string; why: string; gate: express.RequestHandler }> {
  const forced = process.env.MODE as Mode | undefined;
  const cdpMissing = missing('CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'X402_PAY_TO');

  if ((!forced || forced === 'cdp') && cdpMissing.length === 0) {
    const server = await createX402Server({
      environment: 'development',
      payToConfig: { type: 'address', evm: process.env.X402_PAY_TO as `0x${string}` },
      routes: { [ROUTE]: { price: PRICE, networks: [NETWORK], description: DESCRIPTION } },
    });
    return { mode: 'cdp', facilitator: CDP_FACILITATOR_URL, payTo: server.payToEvmAddress ?? process.env.X402_PAY_TO!, why: 'CDP key and X402_PAY_TO present', gate: paymentMiddlewareFromHTTPServer(server) };
  }
  if (forced === 'cdp') throw new Error(`MODE=cdp but missing ${cdpMissing.join(', ')}`);

  const payTo = process.env.X402_PAY_TO || localWallet().address;
  const cdpWhy = `no CDP facilitator: missing ${cdpMissing.join(', ')}`;

  if (forced !== 'simulated') {
    const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: PUBLIC_FACILITATOR })).register(NETWORK, new ExactEvmScheme());
    try {
      const timeout = Promise.withResolvers<never>();
      const timer = setTimeout(() => timeout.reject(new Error('timeout after 8 s')), 8000);
      await Promise.race([resourceServer.initialize(), timeout.promise]).finally(() => clearTimeout(timer));
      const routes = { [ROUTE]: { accepts: [{ scheme: 'exact', price: PRICE, network: NETWORK, payTo }], description: DESCRIPTION, mimeType: 'application/json' } };
      return { mode: 'public-facilitator', facilitator: PUBLIC_FACILITATOR, payTo, why: cdpWhy, gate: paymentMiddleware(routes, resourceServer) };
    } catch (e) {
      if (forced === 'public-facilitator') throw new Error(`public facilitator ${PUBLIC_FACILITATOR} unreachable: ${(e as Error).message}`);
      console.warn(`public facilitator ${PUBLIC_FACILITATOR} unreachable (${(e as Error).message}); falling back to MODE=simulated`);
    }
  }

  // simulated: same requirements the real scheme would advertise (asset + atomic amount from @x402/evm), no facilitator.
  const asset = await new ExactEvmScheme().parsePrice(PRICE, NETWORK);
  const gate: express.RequestHandler = (req, res, next) => {
    if (!(req.method === 'POST' && req.path === '/verify')) return next();
    if (req.header('x-payment') === 'simulated') return next();
    const body: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required (SIMULATED: no facilitator; retry with header X-PAYMENT: simulated)',
      resource: { url: `${req.protocol}://${req.get('host')}${req.originalUrl}`, description: DESCRIPTION, mimeType: 'application/json' },
      accepts: [{ scheme: 'exact', network: NETWORK, asset: asset.asset, amount: asset.amount, payTo, maxTimeoutSeconds: 300, extra: { ...(asset.extra ?? {}), simulated: true } }],
    };
    res.status(402).setHeader('PAYMENT-REQUIRED', encodePaymentRequiredHeader(body)).json({ mode: 'simulated', error: body.error });
  };
  return { mode: 'simulated', facilitator: 'none (simulated)', payTo, why: forced === 'simulated' ? 'MODE=simulated' : `${cdpWhy}; public facilitator unreachable`, gate };
}

const picked = await pickMode();
const { mode, facilitator, payTo } = picked;

app.use((_req, res, next) => { res.setHeader('X-PILL-MODE', mode); next(); });

// ---- free routes ----
app.get('/health', (_req, res) => {
  res.json({ mode, facilitator, network: NETWORK, payTo, price: PRICE, why: picked.why, escrow: escrowMode(), has, label: 'TESTNET' });
});

app.get('/escrow/accounts', async (_req, res, next) => {
  try { res.json({ ...(await accounts()), verify_mode: mode }); } catch (e) { next(e); }
});

// ---- Google Calendar (Composio, the connected account on this Mac) ----
app.get('/calendar/status', async (_req, res) => { res.json(await calendarStatus()); });
app.post('/calendar/event', async (req, res) => {
  const b = (req.body ?? {}) as Partial<CalendarEventInput>;
  if (typeof b.summary !== 'string' || !b.summary.trim() || typeof b.start !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(b.start)) {
    res.status(400).json({ ok: false, error: 'summary and start (YYYY-MM-DDTHH:mm:ss) are required' });
    return;
  }
  const r = await createEvent({ summary: b.summary.slice(0, 120), description: typeof b.description === 'string' ? b.description.slice(0, 1000) : undefined, start: b.start, minutes: typeof b.minutes === 'number' ? Math.min(240, Math.max(5, b.minutes)) : 30, recurrenceDaily: Boolean(b.recurrenceDaily) });
  res.status(r.ok ? 200 : 502).json(r);
});

for (const kind of ['hold', 'release', 'refund'] as Move[]) {
  app.post(`/escrow/${kind}`, async (req, res, next) => {
    const { deliveryId, amount } = (req.body ?? {}) as { deliveryId?: unknown; amount?: unknown };
    if (typeof deliveryId !== 'string' || typeof amount !== 'number' || !(amount > 0)) {
      res.status(400).json({ mode: escrowMode(), error: 'send {"deliveryId": string, "amount": number (invoice dollars)}' });
      return;
    }
    try {
      const r = await move(kind, deliveryId, amount);
      console.log(`[escrow ${r.body.mode}] ${kind} ${deliveryId} $${amount} → ${'tx' in r.body ? r.body.tx : r.body.error}`);
      res.status(r.status).json(r.body);
    } catch (e) { next(e); }
  });
}

// ---- paid route ----
// Validate before the payment gate so nobody pays for a malformed body.
app.post('/verify', (req, res, next) => {
  const parsed = parseCurve(req.body);
  if ('error' in parsed) { res.status(400).json({ mode, error: parsed.error, note: 'no payment asked' }); return; }
  res.locals.curve = parsed;
  // The x402 middleware answers 402 with `{}`; name the mode and the way to pay in that body too (price stays in the header).
  const json = res.json.bind(res);
  res.json = (b: unknown) => json(res.statusCode === 402 && b && typeof b === 'object' ? { mode, network: NETWORK, price: PRICE, facilitator, pay_with: 'npm run buy -- --url <this url>', ...b } : b);
  next();
});

app.use(picked.gate);

app.post('/verify', (_req, res) => {
  const c = res.locals.curve as CurveInput;
  const ref = REFERENCES[c.drug] ?? null;
  const ev = evaluate(c.samples, ref);
  const runId = `v-${c.lot}-${Date.now().toString(36)}`;
  console.log(`[verify ${mode}] ${runId} ${ev.verdict} ${ev.rule}`);
  res.json({
    mode,
    verdict: ev.verdict, rule: ev.rule, plateau: ev.plateau, band: ref ? [ref.bandLow, ref.bandHigh] : null, pct: ev.pct,
    glow_rise: ev.glowRise, scatter: ev.scatter, why: ev.why, next_step: ev.nextStep,
    run_id: runId, lot: c.lot, drug: c.drug, curve_source: c.source, samples: c.samples.length,
    facilitator, network: NETWORK, price: PRICE,
    settlement: mode === 'simulated' ? 'SIMULATED: nothing was paid or settled' : 'settled by the facilitator after this body is built; the tx hash is in the PAYMENT-RESPONSE header',
    note: 'Screening result, not a pharmacopeial test.',
  });
});

app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.type === 'entity.parse.failed' ? 400 : err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ mode, error: status === 400 ? 'body is not JSON; no payment asked' : err.message });
});

app.listen(PORT, () => {
  console.log(`pill-pay on http://localhost:${PORT}  mode=${mode}  (${picked.why})`);
  console.log(`  POST /verify  ${PRICE} USDC on ${NETWORK} (Base Sepolia, TESTNET) → payTo ${payTo}`);
  console.log(`  facilitator   ${facilitator}`);
  console.log(`  escrow        ${escrowMode()}${escrowMode() === 'simulated' ? ' (no CDP credentials; /escrow/* moves nothing)' : ''}`);
});
