// Medical mode: every delivery, one row each, with the verdict of its tested tablet and the ship decision.
// Top: the pipeline as arrows (Logged → Tested → Policy → Released) with counts; each row's left rule is coloured by outcome.
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import OutcomeChip from '../components/OutcomeChip';
import FlowArrows from '../components/FlowArrows';
import { useStore } from '../lib/store';
import { DRUGS } from '../data/reference';
import type { Delivery } from '../lib/types';
import '../components/viz.css';

const ORDER: Record<Delivery['outcome'], number> = { pending: 0, escalate: 1, hold: 2, release: 3, released: 4 };
/** Left rule by outcome. Warm only for a held payment. */
const RULE: Record<Delivery['outcome'], string> = { pending: 'var(--sky)', release: 'var(--mint)', released: 'var(--mint-ink)', hold: 'var(--warm)', escalate: 'var(--amber)' };
/** ↗ money is leaving escrow (or about to, on a tap); → it is still in the pipeline. */
const POINTER: Record<Delivery['outcome'], string> = { pending: '→', release: '↗', released: '↗', hold: '→', escalate: '→' };

export default function Deliveries() {
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const rows = [...deliveries].sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome]);

  const counts = { pass: 0, lab: 0, unable: 0, none: 0 };
  for (const d of deliveries) {
    const v = runs.find((r) => r.id === d.runId)?.evaluation?.verdict;
    if (v === 'PASS') counts.pass++; else if (v === 'NEEDS LAB') counts.lab++; else if (v === 'UNABLE TO VERIFY') counts.unable++; else counts.none++;
  }
  const strip: { n: number; label: string; color: string }[] = [
    { n: counts.pass, label: 'PASS', color: 'var(--mint)' },
    { n: counts.lab, label: 'NEEDS LAB', color: 'var(--amber)' },
    { n: counts.unable, label: 'UNABLE', color: 'var(--grey)' },
    { n: counts.none, label: 'Untested', color: 'transparent' },
  ];
  const flow = {
    logged: deliveries.length,
    tested: deliveries.filter((d) => runs.find((r) => r.id === d.runId)?.evaluation).length,
    policy: deliveries.filter((d) => d.clause).length,
    released: deliveries.filter((d) => d.outcome === 'released').length,
    needsTap: deliveries.filter((d) => d.outcome === 'release').length,
  };

  return (
    <Screen title="Deliveries" eyebrow="Medical · incoming lots" back="/" right={<Link to="/log" className="chip" style={{ textDecoration: 'none' }}>Log</Link>}>
      <section className="card panel" aria-label="Pipeline">
        <div className="panel-head"><h2>Pipeline</h2><span className="eyebrow">{deliveries.length} lots · SANDBOX</span></div>
        <FlowArrows label="Delivery pipeline"
          nodes={[
            { id: 'logged', label: 'Logged', value: String(flow.logged), sub: 'into escrow', accent: 'var(--cb)' },
            { id: 'tested', label: 'Tested', value: String(flow.tested), sub: 'one tablet each', accent: 'var(--sky)' },
            { id: 'policy', label: 'Policy', value: String(flow.policy), sub: 'P1–P6 decided', accent: 'var(--c4)' },
            { id: 'released', label: 'Released', value: String(flow.released), sub: 'pharmacist tap', accent: 'var(--mint)' },
          ]}
          edges={[
            { from: 'logged', to: 'tested', label: `${flow.logged - flow.tested} to test`, live: flow.logged > flow.tested },
            { from: 'tested', to: 'policy', label: `${flow.tested - flow.policy} waiting`, live: flow.tested > flow.policy },
            { from: 'policy', to: 'released', label: `${flow.needsTap} to tap`, live: flow.needsTap > 0, color: 'var(--cb)' },
          ]} />
      </section>
      <div className="card" style={{ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }} aria-label="Verdict counts">
        {strip.map((s, i) => (
          <div key={s.label} style={{ padding: '14px 12px', borderLeft: i ? '1px solid var(--line)' : 0, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 24, lineHeight: 1 }}>{s.n}</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, border: s.color === 'transparent' ? '1px solid var(--line-2)' : 0, flex: 'none' }} />
              <span className="eyebrow" style={{ fontSize: 10, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontWeight: 600 }}>No deliveries yet.</p>
          <p className="muted" style={{ fontSize: 15 }}>When a supplier's delivery is logged, it appears here with its payment held in the SANDBOX escrow until a pharmacist releases it.</p>
        </div>
      ) : (
        <ul className="wide-2" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
          {rows.map((d, i) => {
            const ev = runs.find((r) => r.id === d.runId)?.evaluation ?? null;
            const drug = DRUGS[d.drug];
            return (
              <li key={d.id} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 50}ms`, contain: 'inline-size' }}>
                <Link to={`/delivery/${d.id}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', borderLeft: `4px solid ${RULE[d.outcome]}` }} aria-label={`${d.supplier}, lot ${d.lot}`}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600 }}>{d.supplier}</p>
                      <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>{drug?.name ?? d.drug} · <span className="mono" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>lot {d.lot}</span></p>
                    </div>
                    <span className="row" style={{ gap: 8, flex: 'none' }}><OutcomeChip outcome={d.outcome} /><span className={'pointer' + (POINTER[d.outcome] === '↗' ? ' up' : '')} aria-hidden="true" style={{ color: RULE[d.outcome] }}>{POINTER[d.outcome]}</span></span>
                  </div>
                  <p className="muted" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drug?.usedFor ?? 'No drug table entry.'}</p>
                  <hr className="hr" />
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <VerdictChip verdict={ev?.verdict} />
                      <span className="mono" style={{ fontSize: 13, whiteSpace: 'nowrap' }} title="Plateau as % of the reference band mean">{ev ? <>{ev.pct}%<span className="muted" style={{ fontSize: 11 }}> of ref</span></> : '—'}</span>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <p className="mono" style={{ fontSize: 13 }}>${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="eyebrow" style={{ fontSize: 9.5 }}>SANDBOX</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="footnote">Screening result, not a pharmacopeial test. Payments are SANDBOX / TESTNET.</p>
    </Screen>
  );
}
