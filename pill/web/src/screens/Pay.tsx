// Pay with USDC on Base Sepolia (TESTNET). The pay service opens a checkout order (amount + the station's address); any
// wallet pays it with a plain USDC transfer (QR / EIP-681 link). The status comes only from the service's chain watcher:
// it turns paid when the transfer is in Base Sepolia's USDC Transfer log, with the real tx hash. Nothing is simulated.
// Query: ?purpose=verify|escrow-release|donation&run=<id> prefills a new order; ?order=<id> reopens one.
// On top: the policy agent and the money column (FlowDiagram, compact) with one delivery's path lit from its outcome:
// ?delivery=<id>, else the delivery of ?run=, else the newest delivery the policy has decided, else the newest one.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Shell';
import FlowDiagram, { deliveryPath } from '../components/FlowDiagram';
import { useStore } from '../lib/store';
import Qr from '../components/Qr';
import { PAY_URL, type Unavailable } from '../lib/api';
import { CHECKOUT_PURPOSES, createCheckout, getCheckout, payWithAgent, watchCheckout, type AgentPayAnswer, type CheckoutOrder, type CheckoutPurpose } from '../lib/checkout';

const FOR: Record<CheckoutPurpose, string> = { verify: 'A verdict (POST /verify)', 'escrow-release': 'Escrow release', donation: 'Donation' };
const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`;
const LINK = { color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 } as const;

function StatusChip({ order }: { order: CheckoutOrder }) {
  if (order.status === 'paid') return <span className="chip ok" role="status"><span className="dot" />PAID ON CHAIN</span>;
  if (order.status === 'expired') return <span className="chip" role="status"><span className="dot" />EXPIRED</span>;
  return <span className="chip live beat" role="status"><span className="dot" />AWAITING PAYMENT</span>;
}

function AgentAnswer({ answer }: { answer: AgentPayAnswer | Unavailable | 'busy' }) {
  if (answer === 'busy') return <p className="footnote">Asking the agent wallet…</p>;
  if (answer.mode === 'cdp') {
    return <p className="footnote">Sent <a style={LINK} href={answer.explorer} target="_blank" rel="noreferrer">{short(answer.tx)}</a> from the agent wallet {short(answer.from)}. The status above changes only when the transfer is on chain.</p>;
  }
  return <p className="footnote">Not available: {'why' in answer ? answer.why : answer.error}. Nothing was sent.</p>;
}

export default function Pay() {
  const [params, setParams] = useSearchParams();
  const purpose = CHECKOUT_PURPOSES.find((p) => p === params.get('purpose')) ?? 'verify';
  const runId = params.get('run');
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentPayAnswer | Unavailable | 'busy' | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const deliveries = useStore((s) => s.deliveries);
  const asked = params.get('delivery');
  const current = deliveries.find((d) => d.id === asked) ?? (runId ? deliveries.find((d) => d.runId === runId) : undefined)
    ?? deliveries.find((d) => d.outcome !== 'pending') ?? deliveries[0];

  const open = useCallback(async (reopen: string | null) => {
    setError(null); setAgent(null); setOrder(null);
    const o = reopen ? await getCheckout(reopen) : await createCheckout({ purpose, runId });
    if ('mode' in o) { setError(o.error); return; }
    setOrder(o);
    setParams((p) => { p.set('purpose', o.purpose); p.set('order', o.id); return p; }, { replace: true });
  }, [purpose, runId, setParams]);

  useEffect(() => {
    if (!PAY_URL || started.current) return;
    started.current = true;
    void open(params.get('order'));
  }, [open, params]);

  const orderId = order?.id;
  useEffect(() => (orderId ? watchCheckout(orderId, setOrder) : undefined), [orderId]);

  const copy = async () => {
    if (!order) return;
    try { await navigator.clipboard.writeText(order.payTo); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  };
  const askAgent = async () => {
    if (!order) return;
    setAgent('busy');
    setAgent(await payWithAgent(order.id));
  };

  return (
    <Screen title="Pay with USDC · TESTNET" eyebrow="Checkout · Base Sepolia" tone="violet" back>
      <section className="card stack" style={{ gap: 10 }} aria-label="Where the money goes">
        <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
          <h2 className="serif" style={{ fontWeight: 400, fontSize: '1.5rem' }}>Where the money goes</h2>
          {current
            ? <Link to={`/delivery/${current.id}`} className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>lit: lot {current.lot} · {current.outcome} →</Link>
            : <span className="mono muted" style={{ fontSize: 12 }}>no delivery logged yet</span>}
        </div>
        <FlowDiagram compact active={current ? deliveryPath(current.outcome) : []} label="The policy agent and the money on Coinbase CDP server wallets" />
        <Link to="/verify#how" className="footnote" style={{ color: 'var(--ink)' }}>The whole diagram, with the x402 lane and the models →</Link>
      </section>
      {!PAY_URL ? (
        <section className="card stack">
          <span className="chip"><span className="dot" />SERVICE NOT CONNECTED</span>
          <p style={{ margin: 0 }}>The pay service is not connected to this app (no <code className="mono">VITE_PAY_URL</code>), so there is no address and no QR here. Nothing on this screen is pretend.</p>
        </section>
      ) : !order ? (
        <section className="card stack" aria-busy={!error}>
          {error ? (
            <>
              <span className="chip bad"><span className="dot" />NO ORDER</span>
              <p style={{ margin: 0 }}>The pay service did not open a checkout: {error}. No address is shown because none was issued.</p>
              <button type="button" className="btn ghost" onClick={() => void open(null)}>Try again</button>
            </>
          ) : <p style={{ margin: 0 }}>Opening a checkout on Base Sepolia…</p>}
        </section>
      ) : (
        <div className="wide-2">
          <section className="card stack" style={{ alignItems: 'center', gap: 14 }}>
            <p className="row" style={{ margin: 0, alignItems: 'baseline', gap: 8 }}>
              <span className="big-num num">{order.amountUsdc}</span>
              <span style={{ fontWeight: 600 }}>USDC</span>
              <span className="chip">TESTNET</span>
            </p>
            <Qr value={order.uri} size={260} label={`QR code: send ${order.amountUsdc} test USDC on Base Sepolia to ${order.payTo}`} />
            <p className="footnote" style={{ margin: 0, textAlign: 'center' }}>Scan with Coinbase Wallet or MetaMask set to Base Sepolia.</p>
          </section>

          <section className="card stack" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <StatusChip order={order} />
              {order.status === 'awaiting' && <span className="footnote">expires {new Date(order.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>

            {order.status === 'paid' && order.paid ? (
              <dl className="kv" style={{ margin: 0 }}>
                <dt>Tx</dt><dd><a style={LINK} href={order.paid.explorer} target="_blank" rel="noreferrer">{short(order.paid.txHash)}</a></dd>
                <dt>Block</dt><dd>{order.paid.blockNumber ?? 'pending'}</dd>
                <dt>From</dt><dd>{short(order.paid.from)}</dd>
                <dt>Received</dt><dd>{order.paid.valueUsdc} USDC</dd>
                <dt>Seen</dt><dd>{new Date(order.paid.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
              </dl>
            ) : order.status === 'awaiting' ? (
              <p className="footnote" style={{ margin: 0 }}>
                Watching Base Sepolia from block <span className="num">{order.createdBlock}</span>{order.scannedBlock >= order.createdBlock && <>; read up to <span className="num">{order.scannedBlock}</span></>}.
                {order.lastError && <> Chain read failed, retrying: {order.lastError}</>}
              </p>
            ) : <p className="footnote" style={{ margin: 0 }}>No transfer arrived within 30 minutes. Open a new checkout to pay.</p>}

            <div className="stack" style={{ gap: 6 }}>
              <span className="footnote">Send {order.amountUsdc} USDC to</span>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <code className="mono" style={{ flex: 1, minWidth: 0, wordBreak: 'break-all', fontSize: 14 }}>{order.payTo}</code>
                <button type="button" className="btn ghost" style={{ width: 'auto', minHeight: 40, padding: '0 14px', fontSize: 14 }} onClick={() => void copy()} aria-label="Copy address">{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>

            <dl className="kv" style={{ margin: 0 }}>
              <dt>For</dt><dd>{FOR[order.purpose]}{order.runId ? ` · ${order.runId}` : ''}</dd>
              <dt>Network</dt><dd>Base Sepolia · {order.chainId}</dd>
              <dt>Token</dt><dd>USDC {short(order.asset)}</dd>
            </dl>

            <div className="stack">
              {order.status === 'awaiting' && <a className="btn" href={order.uri} style={{ textDecoration: 'none' }}>Open in wallet</a>}
              <a className="btn ghost" href={order.basescan} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>View on Basescan</a>
              {order.status === 'awaiting'
                ? <button type="button" className="btn ghost" disabled={agent === 'busy' || order.agentTx !== null} onClick={() => void askAgent()}>Pay with the station's agent wallet</button>
                : <button type="button" className="btn ghost" onClick={() => void open(null)}>New checkout</button>}
              {agent && <AgentAnswer answer={agent} />}
              {!agent && order.agentTx && <p className="footnote">The agent wallet sent {short(order.agentTx)}; waiting for the chain.</p>}
            </div>
          </section>
        </div>
      )}

      <p className="footnote" style={{ margin: 0 }}>
        What this is: a TESTNET checkout on Base Sepolia. Test USDC has no value; get some at{' '}
        <a style={LINK} href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a>. The status turns paid only when a real transfer of at least the amount to this address appears in the chain's USDC transfer log. Nothing here is simulated.
      </p>
    </Screen>
  );
}
