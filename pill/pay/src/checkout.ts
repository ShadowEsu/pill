// Checkout on Base Sepolia (TESTNET): an order names an amount of test USDC and the station's address; anybody pays it
// with a plain USDC transfer (QR / EIP-681 link from any wallet). A watcher reads the USDC contract's Transfer logs to that
// address from the public RPC and marks the order paid only when a matching transfer is on chain. Nothing is simulated:
// no route here sets `paid` except the chain log watcher and a real x402 settlement reported by the payment middleware.
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { BaseError, createPublicClient, formatUnits, http, parseAbiItem, parseUnits, type HttpTransport, type Log, type PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { EXPLORER_TX, NETWORK, USDC_BASE_SEPOLIA } from './env.ts';

export const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
export const CHAIN_ID = 84532 as const;
export const PURPOSES = ['verify', 'escrow-release', 'donation'] as const;
export type Purpose = (typeof PURPOSES)[number];
export type Status = 'awaiting' | 'paid' | 'expired';

const DEFAULT_USDC = '0.05';
const MAX_USDC = 1; // TESTNET cap per order (also bounds what the agent wallet may send for one order)
const TTL_MS = 30 * 60_000;
const POLL_MS = 6000;
const MAX_SPAN = 2000n; // blocks per getLogs call; shrinks to the RPC's own limit (sepolia.base.org allows 200)
const CALLS_PER_TICK = 20;
const KEEP = 200;
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export type ChainClient = PublicClient<HttpTransport, typeof baseSepolia>;
export function makeClient(url = RPC_URL): ChainClient {
  return createPublicClient({ chain: baseSepolia, transport: http(url, { retryCount: 1, timeout: 15_000 }) });
}

export interface Payment { txHash: `0x${string}`; from: string; blockNumber: number | null; value: string; valueUsdc: string; seenAt: string; explorer: string }
export interface Order {
  id: string;
  purpose: Purpose;
  runId: string | null;
  source: 'qr' | 'x402';
  payTo: `0x${string}`;
  asset: typeof USDC_BASE_SEPOLIA;
  chainId: typeof CHAIN_ID;
  network: typeof NETWORK;
  amount: string; // atomic, 6 decimals
  amountUsdc: string;
  createdAt: string;
  expiresAt: string;
  createdBlock: number;
  scannedBlock: number; // highest block whose Transfer logs were read for this order
  status: Status;
  uri: string; // EIP-681
  basescan: string;
  paid: Payment | null;
  agentTx: string | null; // a transfer the agent wallet sent for this order (the watcher still decides `paid`)
  checkedAt: string | null;
  lastError: string | null;
  label: 'TESTNET';
}

/** EIP-681 ERC-20 transfer link: wallets open it as "send <amount> USDC to <payTo> on Base Sepolia". */
export const eip681 = (payTo: string, amount: string) => `ethereum:${USDC_BASE_SEPOLIA}@${CHAIN_ID}/transfer?address=${payTo}&uint256=${amount}`;
export const basescanAddress = (payTo: string) => `https://sepolia.basescan.org/address/${payTo}#tokentxns`;

/** 0 < amount ≤ 1 USDC with at most 6 decimals, as a canonical decimal string; or an error. */
export function parseAmount(v: unknown): { usdc: string; atomic: bigint } | { error: string } {
  const s = v === undefined || v === null || v === '' ? DEFAULT_USDC : typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return { error: 'amountUsdc must be a decimal with at most 6 places' };
  const atomic = parseUnits(s, 6);
  if (atomic <= 0n || atomic > parseUnits(String(MAX_USDC), 6)) return { error: `amountUsdc must be above 0 and at most ${MAX_USDC} (TESTNET cap)` };
  return { usdc: formatUnits(atomic, 6), atomic };
}

function short(e: unknown) {
  const msg = e instanceof BaseError ? e.shortMessage : e instanceof Error ? e.message : String(e);
  return msg.split('\n')[0].slice(0, 200);
}
/** The block span an RPC says it allows for eth_getLogs (sepolia.base.org: "limited to a 200 range"); 0n = unknown limit. */
function rangeLimit(e: unknown) {
  const text = e instanceof BaseError ? `${e.message} ${e.details}` : String(e);
  const m = /limited to a (\d+) range|block range (?:is )?(?:too large|exceeds)[^\d]*(\d+)?/i.exec(text);
  return m ? BigInt(m[1] ?? m[2] ?? 0) : null;
}

export class CheckoutBook extends EventEmitter<{ change: [Order] }> {
  private orders = new Map<string, Order>();
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<void> | null = null;
  private fails = 0;
  private span = MAX_SPAN;
  readonly client: ChainClient;
  private readonly file: string | null;
  private readonly autostart: boolean;
  private readonly pollMs: number;
  private readonly ttlMs: number;

  constructor(opts: { client?: ChainClient; file?: string | null; autostart?: boolean; pollMs?: number; ttlMs?: number } = {}) {
    super();
    this.client = opts.client ?? makeClient();
    this.file = opts.file === undefined ? fileURLToPath(new URL('../data/checkouts.json', import.meta.url)) : opts.file;
    this.autostart = opts.autostart ?? true;
    this.pollMs = opts.pollMs ?? POLL_MS;
    this.ttlMs = opts.ttlMs ?? TTL_MS;
    if (this.file && existsSync(this.file)) {
      for (const o of JSON.parse(readFileSync(this.file, 'utf8')) as Order[]) this.orders.set(o.id, o);
    }
    this.wake();
  }

  get(id: string) { return this.orders.get(id) ?? null; }
  list(n = 20) { return [...this.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, n); }
  private claimedBy(tx: string) { for (const o of this.orders.values()) if (o.paid?.txHash.toLowerCase() === tx.toLowerCase()) return o; return null; }

  async create(input: { purpose: Purpose; runId?: string | null; amountUsdc?: unknown; payTo: `0x${string}`; createdBlock?: number }): Promise<Order> {
    const amt = parseAmount(input.amountUsdc);
    if ('error' in amt) throw new Error(amt.error);
    const createdBlock = input.createdBlock ?? Number(await this.client.getBlockNumber());
    const now = Date.now();
    const o: Order = {
      id: 'co_' + randomBytes(6).toString('hex'),
      purpose: input.purpose, runId: input.runId ?? null, source: 'qr',
      payTo: input.payTo, asset: USDC_BASE_SEPOLIA, chainId: CHAIN_ID, network: NETWORK,
      amount: amt.atomic.toString(), amountUsdc: amt.usdc,
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + this.ttlMs).toISOString(),
      createdBlock, scannedBlock: createdBlock - 1, status: 'awaiting',
      uri: eip681(input.payTo, amt.atomic.toString()), basescan: basescanAddress(input.payTo),
      paid: null, agentTx: null, checkedAt: null, lastError: null, label: 'TESTNET',
    };
    this.orders.set(o.id, o);
    this.changed(o);
    this.wake();
    return o;
  }

  /** Remember that the agent wallet sent a transfer for this order. Does not change the status. */
  noteAgentTx(id: string, tx: string) {
    const o = this.orders.get(id);
    if (!o) return;
    o.agentTx = tx;
    this.changed(o);
    this.wake();
  }

  /**
   * A real x402 settlement (the payment middleware's afterSettle hook): record it as a paid order so the list shows it,
   * and claim its tx hash so the watcher never credits the same transfer to a QR order. If the watcher got there first,
   * that QR order goes back to awaiting (the transfer was the x402 payment, not the QR one).
   */
  recordSettlement(s: { txHash: `0x${string}`; payer: string | null; amount: string; payTo: `0x${string}`; purpose?: Purpose; runId?: string | null }) {
    const prior = this.claimedBy(s.txHash);
    if (prior?.source === 'x402') return prior;
    if (prior) { prior.paid = null; prior.status = 'awaiting'; prior.scannedBlock = prior.createdBlock - 1; this.changed(prior); }
    const now = new Date().toISOString();
    const o: Order = {
      id: 'co_' + randomBytes(6).toString('hex'), purpose: s.purpose ?? 'verify', runId: s.runId ?? null, source: 'x402',
      payTo: s.payTo, asset: USDC_BASE_SEPOLIA, chainId: CHAIN_ID, network: NETWORK,
      amount: s.amount, amountUsdc: formatUnits(BigInt(s.amount), 6), createdAt: now, expiresAt: now, createdBlock: 0, scannedBlock: 0,
      status: 'paid', uri: eip681(s.payTo, s.amount), basescan: basescanAddress(s.payTo),
      paid: { txHash: s.txHash, from: s.payer ?? 'unknown', blockNumber: null, value: s.amount, valueUsdc: formatUnits(BigInt(s.amount), 6), seenAt: now, explorer: EXPLORER_TX + s.txHash },
      agentTx: null, checkedAt: now, lastError: null, label: 'TESTNET',
    };
    this.orders.set(o.id, o);
    this.changed(o);
    void this.client.waitForTransactionReceipt({ hash: s.txHash, timeout: 60_000 }).then((r) => {
      o.paid!.blockNumber = Number(r.blockNumber);
      o.createdBlock = o.scannedBlock = Number(r.blockNumber);
      this.changed(o);
    }).catch((e) => { o.lastError = `receipt: ${short(e)}`; this.changed(o); });
    this.wake();
    return o;
  }

  /** One watcher pass: read Transfer(to = payTo) logs from each awaiting order's next unscanned block to latest. */
  tick(): Promise<void> {
    return (this.ticking ??= this.scan().finally(() => { this.ticking = null; }));
  }

  private async scan() {
    const awaiting = [...this.orders.values()].filter((o) => o.status === 'awaiting');
    if (!awaiting.length) return;
    const checkedAt = new Date().toISOString();
    try {
      const latest = await this.client.getBlockNumber();
      const groups = Map.groupBy(awaiting, (o) => o.payTo.toLowerCase());
      let calls = 0;
      for (const group of groups.values()) {
        let from = BigInt(Math.min(...group.map((o) => o.scannedBlock + 1)));
        while (from <= latest && calls < CALLS_PER_TICK) {
          const to = from + this.span - 1n < latest ? from + this.span - 1n : latest;
          calls++;
          let logs;
          try {
            logs = await this.client.getLogs({ address: USDC_BASE_SEPOLIA, event: TRANSFER, args: { to: group[0].payTo }, fromBlock: from, toBlock: to });
          } catch (e) {
            const limit = rangeLimit(e);
            if (limit !== null && this.span > 1n) { this.span = limit > 0n && limit < this.span ? limit : this.span / 2n; continue; }
            throw e;
          }
          logs.sort((a, b) => Number(a.blockNumber! - b.blockNumber!) || a.logIndex! - b.logIndex!);
          for (const log of logs) this.claim(log, group);
          for (const o of group) if (o.status === 'awaiting' && o.scannedBlock < Number(to)) o.scannedBlock = Number(to);
          from = to + 1n;
        }
      }
      const now = Date.now();
      for (const o of awaiting) {
        o.checkedAt = checkedAt;
        const hadError = o.lastError !== null;
        o.lastError = null;
        // Expire only once the chain has been read up to now, so a late scan never hides a real payment.
        if (o.status === 'awaiting' && now > Date.parse(o.expiresAt) && BigInt(o.scannedBlock) >= latest) { o.status = 'expired'; this.changed(o); }
        else if (hadError) this.changed(o);
      }
      this.fails = 0;
      this.persist();
    } catch (e) {
      this.fails++;
      const msg = `Base Sepolia RPC: ${short(e)}`;
      for (const o of awaiting) {
        o.checkedAt = checkedAt;
        if (o.lastError !== msg) { o.lastError = msg; this.changed(o); }
      }
    }
  }

  private claim(log: Log<bigint, number, false, typeof TRANSFER>, group: Order[]) {
    const { from, value } = log.args;
    const hash = log.transactionHash!;
    if (value === undefined || this.claimedBy(hash)) return;
    const block = Number(log.blockNumber);
    // The newest order opened at or before the transfer's block: the one the payer was most likely looking at.
    const o = group
      .filter((g) => g.status === 'awaiting' && g.createdBlock <= block && g.scannedBlock < block && BigInt(g.amount) <= value)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!o) return;
    o.status = 'paid';
    o.scannedBlock = block;
    o.paid = { txHash: hash, from: from!, blockNumber: block, value: value.toString(), valueUsdc: formatUnits(value, 6), seenAt: new Date().toISOString(), explorer: EXPLORER_TX + hash };
    this.changed(o);
  }

  private changed(o: Order) {
    this.persist();
    this.emit('change', o);
  }

  private persist() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.list(KEEP), null, 2));
  }

  /** Poll every 6 s while any order is awaiting; back off (×2 per failure, ≤ 60 s) while the RPC errors. */
  private wake() {
    if (!this.autostart || this.timer || ![...this.orders.values()].some((o) => o.status === 'awaiting')) return;
    const delay = Math.min(60_000, this.pollMs * 2 ** Math.min(this.fails, 4));
    this.timer = setTimeout(() => { void this.tick().finally(() => { this.timer = null; this.wake(); }); }, delay);
    this.timer.unref();
  }
}

export type AgentPay = (payTo: `0x${string}`, atomic: bigint) => Promise<{ mode: 'unavailable'; why: string } | { mode: 'cdp'; from: string; tx: string; explorer: string }>;

/** Routes: POST /checkout, GET /checkout, GET /checkout/:id, GET /checkout/:id/stream (SSE), POST /checkout/:id/pay-with-agent. */
export function checkoutRouter(book: CheckoutBook, opts: { payTo: `0x${string}`; agentPay: AgentPay }) {
  const r = express.Router();

  r.post('/checkout', async (req, res) => {
    const b: Record<string, unknown> = req.body && typeof req.body === 'object' ? req.body : {};
    const purpose = PURPOSES.find((p) => p === b.purpose);
    if (!purpose) { res.status(400).json({ error: `purpose must be one of ${PURPOSES.join(', ')}` }); return; }
    const runId = b.runId ?? null;
    if (runId !== null && (typeof runId !== 'string' || runId.length > 80)) { res.status(400).json({ error: 'runId must be a string up to 80 characters' }); return; }
    const amt = parseAmount(b.amountUsdc);
    if ('error' in amt) { res.status(400).json({ error: amt.error }); return; }
    try {
      res.status(201).json(await book.create({ purpose, runId, amountUsdc: amt.usdc, payTo: opts.payTo }));
    } catch (e) {
      res.status(503).json({ mode: 'unavailable', error: `Base Sepolia RPC unreachable, no order created: ${short(e)}` });
    }
  });

  r.get('/checkout', (_req, res) => { res.json({ orders: book.list(20), payTo: opts.payTo, rpc: RPC_URL, label: 'TESTNET' }); });

  r.get('/checkout/:id', (req, res) => {
    const o = book.get(req.params.id);
    if (!o) { res.status(404).json({ error: 'no such order' }); return; }
    res.json(o);
  });

  r.get('/checkout/:id/stream', (req, res) => {
    const o = book.get(req.params.id);
    if (!o) { res.status(404).json({ error: 'no such order' }); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(o)}\n\n`);
    const onChange = (c: Order) => { if (c.id === o.id) res.write(`data: ${JSON.stringify(c)}\n\n`); };
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    book.on('change', onChange);
    req.on('close', () => { clearInterval(ping); book.off('change', onChange); });
  });

  r.post('/checkout/:id/pay-with-agent', async (req, res) => {
    const o = book.get(req.params.id);
    if (!o) { res.status(404).json({ error: 'no such order' }); return; }
    if (o.status !== 'awaiting') { res.status(409).json({ error: `order is ${o.status}; nothing sent` }); return; }
    if (o.agentTx) { res.status(409).json({ error: `the agent wallet already sent ${o.agentTx} for this order; waiting for the chain`, tx: o.agentTx }); return; }
    try {
      const sent = await opts.agentPay(o.payTo, BigInt(o.amount));
      if (sent.mode === 'unavailable') { res.json({ ...sent, sent: false, note: 'nothing was sent; pay by QR from any Base Sepolia wallet instead' }); return; }
      book.noteAgentTx(o.id, sent.tx);
      res.json({ ...sent, sent: true, note: 'sent from the agent wallet (TESTNET); this order turns paid when the watcher sees the transfer on chain' });
    } catch (e) {
      res.status(502).json({ mode: 'cdp', sent: false, error: short(e) });
    }
  });

  return r;
}
