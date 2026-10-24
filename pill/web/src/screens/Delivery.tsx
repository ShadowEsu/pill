// One delivery: the held money, the tested tablet, the policy proposal, the pharmacist's tap, the log.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { animate } from 'animejs';
import { Action, Screen, SrcBadge } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import OutcomeChip from '../components/OutcomeChip';
import { actions, useStore } from '../lib/store';
import { DRUGS, REFERENCES } from '../data/reference';
import { PEOPLE } from '../data/history';
import type { Delivery as D, LogLine } from '../lib/types';
import CalendarButton from '../components/CalendarButton';

const usd = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CAP = 2000;
const PAY_URL = (import.meta.env.VITE_PAY_URL as string | undefined)?.replace(/\/$/, '') || null;

/** After the tap: ask the pill-pay service to move escrow → supplier on Base Sepolia, and log exactly what it reports. */
async function releaseOnChain(url: string, d: D) {
  const ref = { kind: 'delivery' as const, id: d.id };
  try {
    const res = await fetch(`${url}/escrow/release`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deliveryId: d.id, amount: d.amountUsd }) });
    const r = (await res.json()) as { mode?: string; tx?: string; explorer?: string; amount_usdc?: string; moved?: boolean; confirmation?: string; note?: string; error?: string };
    if (!res.ok || !r.tx) actions.activity(PEOPLE.cdp, `escrow service refused the release for lot ${d.lot}: ${r.error ?? res.statusText} · nothing moved`, 'info', ref);
    else if (r.mode === 'cdp') actions.activity(PEOPLE.cdp, `released ${r.amount_usdc} USDC escrow → ${d.supplier} on Base Sepolia (TESTNET) · ${r.confirmation} · tx ${r.tx} · ${r.explorer}`, 'money', ref);
    else actions.activity(PEOPLE.cdp, `escrow service is SIMULATED: ${r.note ?? 'no CDP credentials; nothing moved'} · ref ${r.tx} · no explorer link`, 'info', ref);
  } catch (e) {
    actions.activity(PEOPLE.cdp, `escrow service at ${url} did not answer (${(e as Error).message}) · nothing moved`, 'info', ref);
  }
}

/** Policy clauses, verbatim (policy.md P1–P6). */
const CLAUSES: Record<string, string> = {
  P1: 'A release needs PASS, no recall record for the lot, amount within the spend cap, and the pharmacist\u2019s tap.',
  P2: 'NEEDS LAB: hold, and draft the lab referral with the curve attached.',
  P3: 'UNABLE TO VERIFY: escalate to a person; no money moves.',
  P4: 'A recall hit holds the payment regardless of the verdict.',
  P5: 'Amount above the cap: escalate.',
  P6: 'Recall lookup unreachable: hold until a lookup succeeds or a human overrides.',
};

/** Left hairline per log kind: money is Coinbase blue, hold is warm, ok is mint. */
const KIND: Record<LogLine['kind'], string> = { info: 'var(--line-2)', ok: 'var(--mint)', hold: 'var(--warm)', money: 'var(--cb)' };

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts a number up from 0 once, under 600 ms; static with reduced motion. */
function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [v, setV] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced()) { setV(to); return; }
    const o = { v: 0 };
    const a = animate(o, { v: to, duration: 550, ease: 'outCubic', onUpdate: () => setV(o.v) });
    return () => { a.pause(); };
  }, [to]);
  return <>{v.toFixed(decimals)}</>;
}

function LogList({ lines }: { lines: LogLine[] }) {
  if (!lines.length) return <p className="footnote">Nothing logged yet.</p>;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {lines.map((l, i) => (
        <li key={i} className="mono" style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10, padding: '8px 0 8px 10px', borderLeft: `2px solid ${KIND[l.kind]}`, borderTop: i ? '1px solid var(--line)' : 0, fontSize: 12, lineHeight: 1.45 }}>
          <span className="muted">{new Date(l.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <span style={{ color: 'var(--ink)', overflowWrap: 'anywhere' }}>{l.text}</span>
        </li>
      ))}
    </ol>
  );
}

function localNote(d: D, want: 'hold' | 'ask') {
  if (d.outcome === 'released') return 'Already released. This note is kept on this screen only.';
  if (want === 'hold') return d.outcome === 'hold' ? `Already held under ${d.clause}. No money moves.` : 'Noted: you would rather hold. Nothing moves unless someone taps Release; policy stays as proposed.';
  return d.outcome === 'escalate' ? `Already sent to a person under ${d.clause}. No money moves.` : 'Noted: ask a person before shipping. Nothing moves unless someone taps Release.';
}

export default function Delivery() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const d = useStore((s) => s.deliveries.find((x) => x.id === id));
  const run = useStore((s) => (d?.runId ? s.runs.find((r) => r.id === d.runId) : undefined));
  const bottle = useStore((s) => (d?.bottleId ? s.bottles.find((b) => b.id === d.bottleId) : undefined));
  const [note, setNote] = useState<string | null>(null);
  const releaseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (d?.outcome === 'released' && releaseRef.current && !reduced()) {
      animate(releaseRef.current, { opacity: [0, 1], translateY: [8, 0], duration: 450, ease: 'outCubic' });
    }
  }, [d?.outcome]);

  if (!d) {
    return (
      <Screen title="Delivery" back="/deliveries">
        <div className="card stack"><p>No delivery with id <span className="mono">{id}</span>.</p></div>
        <Action><Link to="/deliveries" className="btn" style={{ textDecoration: 'none' }}>All deliveries</Link></Action>
      </Screen>
    );
  }

  const ev = run?.evaluation ?? null;
  const drug = DRUGS[d.drug];
  const ref = run ? REFERENCES[DRUGS[run.drug]?.reference ?? run.drug] ?? null : null;
  const money = [...d.log].reverse().find((l) => l.kind === 'money' && /tx /.test(l.text));
  const tx = money?.text.match(/tx (\S+)/)?.[1] ?? null;
  const released = d.outcome === 'released';
  const proposed = d.outcome !== 'pending';
  const recall = bottle?.recall ?? 'unchecked';

  return (
    <Screen eyebrow={`Delivery · lot ${d.lot}`} title={d.supplier} back="/deliveries" right={run ? <SrcBadge src={run.src} /> : undefined}>
      <p style={{ color: 'var(--ink-2)', marginTop: -8 }}>{drug?.name ?? d.drug}<span className="muted"> · {drug?.usedFor ?? 'No drug table entry.'}</span></p>

      {/* money: the only card with the Coinbase-blue hairline */}
      <section className="card stack" style={{ borderTop: '2px solid var(--cb)' }} aria-label="Payment">
        <div className="row between">
          <span className="eyebrow">{released ? 'Released' : 'Held in escrow'}</span>
          <span className="chip"><span className="dot" style={{ background: 'var(--cb)' }} />SANDBOX / TESTNET</span>
        </div>
        <p><span className="mono" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>${usd(d.amountUsd)}</span> <span className="muted" style={{ fontSize: 15 }}>{released ? 'released' : 'held'} · SANDBOX</span></p>
        <dl className="kv">
          <dt>Rail</dt><dd>USDC TESTNET · Base Sepolia</dd>
          <dt>Mirror</dt><dd>Nessie SANDBOX</dd>
          <dt style={{ whiteSpace: 'nowrap' }}>Spend cap</dt><dd>{usd(CAP)}</dd>
        </dl>
      </section>

      {/* the tested tablet */}
      {ev && run ? (
        <section className="card stack" aria-label="Evaluation">
          <div className="row between">
            <VerdictChip verdict={ev.verdict} />
            <span className="mono muted" style={{ fontSize: 12 }}>rule {ev.rule} · {run.id}</span>
          </div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
            <span className="big-num"><CountUp to={ev.pct} />%</span>
            <span className="muted" style={{ fontSize: 14, paddingBottom: 6 }}>of the reference plateau</span>
          </div>
          <dl className="kv">
            <dt>Plateau</dt><dd>{ev.plateau.toFixed(3)}</dd>
            <dt>Reference band</dt><dd>{ref ? `${ref.bandLow.toFixed(2)}–${ref.bandHigh.toFixed(2)}` : '—'}</dd>
            <dt>90° glow rise</dt><dd>{ev.glowRise.toFixed(3)}{ref ? ` (min ${ref.glowMin})` : ''}</dd>
            <dt>Scatter</dt><dd>{ev.scatter.toFixed(3)}</dd>
            <dt>Water</dt><dd>{ev.temp.toFixed(1)} °C</dd>
            <dt>Recall record</dt><dd>{recall === 'recall' ? 'RECALL' : recall === 'no_record' ? 'none' : recall === 'unreachable' ? 'could not check' : 'not checked'}</dd>
          </dl>
          <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>{ev.why}</p>
          <p className="footnote">Screening result, not a pharmacopeial test.</p>
        </section>
      ) : run ? (
        <section className="card stack">
          <p>A tablet from this lot is being measured.</p>
          <Link to={`/run/${run.id}`} className="btn ghost" style={{ textDecoration: 'none' }}>Watch the run</Link>
        </section>
      ) : (
        <section className="card stack">
          <VerdictChip verdict={null} />
          <p style={{ color: 'var(--ink-2)' }}>No tablet from this lot has been measured. Money stays held until one is.</p>
        </section>
      )}

      {/* policy */}
      {proposed && d.clause && (
        <section className="card stack rise" aria-label="Policy proposal">
          <div className="row between">
            <span className="eyebrow">Policy proposes</span>
            <OutcomeChip outcome={d.outcome} />
          </div>
          <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '2px solid var(--line-2)' }}>
            <span className="mono" style={{ fontSize: 13, marginRight: 8 }}>{d.clause}</span>
            <span>{CLAUSES[d.clause]}</span>
          </blockquote>
          {d.clause === 'P2' && (
            <CalendarButton compact summary={`Lab referral · lot ${d.lot} (${d.supplier})`} description={`NEEDS LAB on one tablet from this delivery. Curve and raw trace attached in Pill. Payment held in escrow (SANDBOX / TESTNET).`} start={`${new Date(Date.now() + 86400e3).toISOString().slice(0, 10)}T10:00:00`} minutes={30} label="Book the lab drop-off in Google Calendar" />
          )}
        </section>
      )}

      {released && (
        <div ref={releaseRef} className="card row" style={{ alignItems: 'flex-start' }} aria-label="Released">
          <span aria-hidden style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--mint-tint)', border: '1px solid var(--mint)', display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.4l2.6 2.6L11 4.6" fill="none" stroke="var(--mint-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <p style={{ fontWeight: 600 }}>USDC {usd(d.amountUsd)} escrow → supplier</p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>Base Sepolia tx {tx ?? '—'} · TESTNET · Nessie SANDBOX mirror</p>
          </div>
        </div>
      )}

      {note && <p className="card rise" role="status" style={{ fontSize: 15, padding: 14 }}>{note}</p>}

      <section className="stack" aria-label="Decision log">
        <div className="row between"><h2 style={{ fontSize: 17 }}>Decision log</h2><Link to="/log" className="footnote">All deliveries</Link></div>
        <div className="card" style={{ padding: '6px 14px' }}><LogList lines={d.log} /></div>
        <p className="footnote">Software proposes. A pharmacist releases. Every line is logged.</p>
      </section>

      <Action>
        {!run && <button type="button" className="btn" onClick={() => nav(`/bottle?delivery=${d.id}`)}>Test a tablet from this delivery</button>}
        {run && !proposed && <button type="button" className="btn" disabled={!ev} onClick={() => actions.propose(d.id)}>Run policy</button>}
        {proposed && !released && (
          <>
            <button type="button" className="btn mint" disabled={d.outcome !== 'release'} onClick={() => { actions.approve(d.id); if (PAY_URL) void releaseOnChain(PAY_URL, d); }} aria-describedby="release-why">
              Release ${usd(d.amountUsd)}
            </button>
            <p id="release-why" className="footnote" style={{ textAlign: 'center' }}>{d.outcome === 'release' ? 'Your tap moves TESTNET USDC to the supplier.' : `Release is off: ${d.clause} decided ${d.outcome}.`}</p>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setNote(localNote(d, 'hold'))}>Hold instead</button>
              <button type="button" className="btn ghost" onClick={() => setNote(localNote(d, 'ask'))}>Ask a person</button>
            </div>
          </>
        )}
        {released && <Link to="/deliveries" className="btn ghost" style={{ textDecoration: 'none' }}>Back to deliveries</Link>}
      </Action>
    </Screen>
  );
}
