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
import { CLAUDE_MODEL, GEMINI_MODEL, aiHas, ask, escrowLog, explainWhy, parseAsk, parseEscrow, parseWhy, readLabel } from './ai.ts';
import { nessieAccounts, nessieMode, nessieTransfer, setupNessie } from './nessie.ts';
import { MAX_SPEAK_CHARS, speak, speechMode } from './speech.ts';
import { initTiger, insertSamples, parseSamples, plateauCurve, tigerMode, tigerStatus } from './tiger.ts';

const DESCRIPTION = 'Pill dissolution verdict for a curve';
const ROUTE = 'POST /verify';
const ORIGINS = new Set((process.env.CORS_ORIGINS || 'http://127.0.0.1:5183,http://localhost:5183,http://127.0.0.1:5186,http://localhost:5186,http://127.0.0.1:5189,http://localhost:5189,http://127.0.0.1:5191,http://localhost:5191,http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean));

const app = express();

// CORS for the app origins. The browser must be allowed to read the x402 headers.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT');
    res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PILL-MODE, X-PILL-VOICE');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

// Parse every body as JSON regardless of content type (`curl -d` sends form-urlencoded by default). 1 MB cap (a label photo is downscaled in the app first).
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
  res.json({
    mode, facilitator, network: NETWORK, payTo, price: PRICE, why: picked.why, escrow: escrowMode(), has, label: 'TESTNET',
    ai: { claude: aiHas().claude ? CLAUDE_MODEL : 'unavailable', gemini: aiHas().gemini ? GEMINI_MODEL : 'unavailable' },
    nessie: nessieMode(), speech: speechMode(), tiger: tigerMode(),
  });
});

// ---- model features (keys stay in .env; every model text passes the clause filter) ----
// Gemini reads the label photo in memory; nothing is written to disk.
app.post('/label', async (req, res) => {
  const r = await readLabel((req.body as { image?: unknown } | undefined)?.image);
  if (r.mode === 'live') console.log(`[label gemini] ${r.drug ?? '?'} ${r.strength ?? '?'} lot ${r.lot ?? '?'} conf ${r.confidence}`);
  else console.warn(`[label] unavailable: ${r.error}`);
  res.json(r);
});

app.post('/why', async (req, res) => {
  const w = parseWhy(req.body);
  if ('error' in w) { res.status(400).json({ mode: 'unavailable', error: w.error }); return; }
  const r = await explainWhy(w);
  console.log(`[why ${r.mode}] ${w.verdict} ${w.rule}${r.mode === 'template' ? ` (${r.reason})` : ''}${r.dropped.length ? ` · dropped ${r.dropped.length}` : ''}`);
  res.json(r);
});

app.post('/escrow-log', async (req, res) => {
  const i = parseEscrow(req.body);
  if ('error' in i) { res.status(400).json({ mode: 'unavailable', error: i.error }); return; }
  const r = await escrowLog(i);
  console.log(`[escrow-log ${r.mode}] ${i.verdict} proposed ${i.proposed} → ${r.outcome} ${r.clause_id}${r.guards.length ? ` · ${r.guards.join('; ')}` : ''}`);
  res.json(r);
});

// Ask Pill: answers only from the record the app sends (and the fixed rule/policy texts); clause-filtered.
app.post('/ask', async (req, res) => {
  const i = parseAsk(req.body);
  if ('error' in i) { res.status(400).json({ mode: 'unavailable', error: i.error }); return; }
  const r = await ask(i);
  console.log(`[ask ${r.mode}] ${i.mode} · ${i.question.length} chars${r.mode === 'template' ? ` (${r.reason})` : ''}${r.dropped.length ? ` · dropped ${r.dropped.length}` : ''}`);
  res.json(r);
});

// ---- Tiger Data (TimescaleDB hypertable of station samples; TIGER_URL only) ----
app.get('/tiger/status', async (_req, res) => { res.json(await tigerStatus()); });
app.post('/tiger/samples', async (req, res) => {
  const i = parseSamples(req.body);
  if ('error' in i) { res.status(400).json({ mode: 'unavailable', error: i.error }); return; }
  res.json(await insertSamples(i));
});
app.get('/tiger/plateau/:run_id', async (req, res) => { res.json(await plateauCurve(req.params.run_id)); });

app.post('/speak', async (req, res) => {
  const text = (req.body as { text?: unknown } | undefined)?.text;
  if (typeof text !== 'string' || !text.trim()) { res.status(400).json({ mode: 'unavailable', error: 'send {"text": string}' }); return; }
  await speak(text.trim().slice(0, MAX_SPEAK_CHARS), res);
});

app.get('/nessie/accounts', async (_req, res) => { res.json(await nessieAccounts()); });

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
  app.post(`/escrow/${kind}`, async (req, res) => {
    const { deliveryId, amount } = (req.body ?? {}) as { deliveryId?: unknown; amount?: unknown };
    if (typeof deliveryId !== 'string' || typeof amount !== 'number' || !(amount > 0)) {
      res.status(400).json({ mode: escrowMode(), error: 'send {"deliveryId": string, "amount": number (invoice dollars)}' });
      return;
    }
    // USDC rail first; the Nessie SANDBOX mirror runs unless the USDC rail refused the request (cap, bad input).
    let usdc: { status: number; body: Record<string, unknown> };
    try { usdc = await move(kind, deliveryId, amount); }
    catch (e) { usdc = { status: 502, body: { kind, deliveryId, mode: escrowMode(), moved: false, error: `USDC rail failed: ${(e as Error).message}` } }; }
    const nessie = usdc.status === 400 ? { mode: 'skipped' as const, reason: 'USDC rail refused this move' } : await nessieTransfer(kind, deliveryId, amount);
    console.log(`[escrow ${usdc.body.mode}] ${kind} ${deliveryId} $${amount} → ${usdc.body.tx ?? usdc.body.error} · nessie ${nessie.mode}${'transfer_id' in nessie ? ` ${nessie.transfer_id}` : ''}`);
    res.status(usdc.status).json({ ...usdc.body, nessie });
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
  if (err.type === 'entity.too.large') { res.status(413).json({ mode: 'unavailable', error: 'body over 1 MB; send a smaller image' }); return; }
  const status = err.type === 'entity.parse.failed' ? 400 : err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ mode, error: status === 400 ? 'body is not JSON; no payment asked' : err.message });
});

app.listen(PORT, () => {
  console.log(`pill-pay on http://localhost:${PORT}  mode=${mode}  (${picked.why})`);
  console.log(`  POST /verify  ${PRICE} USDC on ${NETWORK} (Base Sepolia, TESTNET) → payTo ${payTo}`);
  console.log(`  facilitator   ${facilitator}`);
  console.log(`  escrow        ${escrowMode()}${escrowMode() === 'simulated' ? ' (no CDP credentials; /escrow/* moves nothing)' : ''}`);
  console.log(`  models        claude ${aiHas().claude ? CLAUDE_MODEL : 'unavailable'} · gemini ${aiHas().gemini ? GEMINI_MODEL : 'unavailable'} · speech ${speechMode()}`);
  void setupNessie().then((r) => console.log(`  nessie        ${r ? `SANDBOX customer ${r.customer}` : nessieMode()}`));
  void initTiger().then((r) => console.log(`  tiger         ${r.mode === 'live' ? 'live (samples hypertable ready)' : `unavailable (${r.reason})`}`));
});
