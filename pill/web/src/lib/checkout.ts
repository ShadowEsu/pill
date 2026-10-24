// Checkout on the pill-pay service (Base Sepolia, TESTNET): open an order, follow its status, ask the agent wallet to pay.
// Every helper returns the service's own answer or {mode:'unavailable', error}; nothing here invents a payment.
import { PAY_URL, type Unavailable } from './api';

export type CheckoutPurpose = 'verify' | 'escrow-release' | 'donation';
export type CheckoutStatus = 'awaiting' | 'paid' | 'expired';

export interface CheckoutPayment { txHash: string; from: string; blockNumber: number | null; value: string; valueUsdc: string; seenAt: string; explorer: string }
export interface CheckoutOrder {
  id: string;
  purpose: CheckoutPurpose;
  runId: string | null;
  source: 'qr' | 'x402';
  payTo: string;
  asset: string;
  chainId: 84532;
  amount: string;
  amountUsdc: string;
  createdAt: string;
  expiresAt: string;
  createdBlock: number;
  scannedBlock: number;
  status: CheckoutStatus;
  uri: string;
  basescan: string;
  paid: CheckoutPayment | null;
  agentTx: string | null;
  checkedAt: string | null;
  lastError: string | null;
  label: 'TESTNET';
}

export type AgentPayAnswer =
  | { mode: 'unavailable'; why: string; sent: false; note: string }
  | { mode: 'cdp'; sent: true; from: string; tx: string; explorer: string; note: string };

export const CHECKOUT_PURPOSES: CheckoutPurpose[] = ['verify', 'escrow-release', 'donation'];
const POLL_MS = 4000;

async function call<T>(path: string, init?: RequestInit): Promise<T | Unavailable> {
  if (!PAY_URL) return { mode: 'unavailable', error: 'no VITE_PAY_URL' };
  try {
    const res = await fetch(`${PAY_URL}${path}`, { ...init, headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
    const j: unknown = await res.json();
    if (res.ok) return j as T;
    const error = j && typeof j === 'object' && 'error' in j && typeof j.error === 'string' ? j.error : `HTTP ${res.status}`;
    return { mode: 'unavailable', error };
  } catch (e) {
    return { mode: 'unavailable', error: (e as Error).message };
  }
}

export const createCheckout = (input: { purpose: CheckoutPurpose; runId?: string | null }) =>
  call<CheckoutOrder>('/checkout', { method: 'POST', body: JSON.stringify({ purpose: input.purpose, runId: input.runId || undefined }) });

export const getCheckout = (id: string) => call<CheckoutOrder>(`/checkout/${encodeURIComponent(id)}`);

export const payWithAgent = (id: string) => call<AgentPayAnswer>(`/checkout/${encodeURIComponent(id)}/pay-with-agent`, { method: 'POST', body: '{}' });

/**
 * Follow an order: Server-Sent Events from GET /checkout/:id/stream; if the stream closes or never opens, poll
 * GET /checkout/:id every 4 s. Stops once the order is paid or expired. Returns the unsubscribe.
 */
export function watchCheckout(id: string, onOrder: (o: CheckoutOrder) => void): () => void {
  if (!PAY_URL) return () => {};
  let stopped = false;
  let timer: number | undefined;
  let es: EventSource | null = null;
  // An order that is paid or expired never changes again.
  const poll = async () => {
    if (stopped) return;
    const o = await getCheckout(id);
    if (stopped) return;
    if (!('mode' in o)) { onOrder(o); if (o.status !== 'awaiting') return; }
    timer = window.setTimeout(poll, POLL_MS);
  };
  if (typeof EventSource === 'function') {
    es = new EventSource(`${PAY_URL}/checkout/${encodeURIComponent(id)}/stream`);
    es.onmessage = (ev) => {
      const o = JSON.parse(ev.data) as CheckoutOrder;
      onOrder(o);
      if (o.status !== 'awaiting') { es?.close(); es = null; }
    };
    es.onerror = () => { es?.close(); es = null; if (timer === undefined) void poll(); };
  } else void poll();
  return () => { stopped = true; es?.close(); window.clearTimeout(timer); };
}
