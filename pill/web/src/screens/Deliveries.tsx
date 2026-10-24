// Medical mode: every delivery, one card each: supplier initials, the lot, a status rail (logged → tested → decision) whose
// segments fill in order, the verdict of its tested tablet and the amount. Held lots sit on a soft amber wash; warm red only for
// a recall. Top: the pipeline as arrows with a travelling token, and the verdict counts rolling up over a proportion bar.
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import OutcomeChip from '../components/OutcomeChip';
import FlowArrows from '../components/FlowArrows';
import StatusRail from '../components/StatusRail';
import ActorAvatar from '../components/ActorAvatar';
import Glyph from '../components/Glyph';
import { useStore } from '../lib/store';
import { useCountUp } from '../lib/count';
import { DRUGS } from '../data/reference';
import type { Delivery, Verdict } from '../lib/types';
import '../components/viz.css';
import '../story.css';

const ORDER: Record<Delivery['outcome'], number> = { pending: 0, escalate: 1, hold: 2, release: 3, released: 4 };
const DECISION: Record<Delivery['outcome'], string> = { pending: 'waiting', release: 'release · needs a tap', released: 'released by a person', hold: 'held', escalate: 'asked a person' };
const VERDICT_C: Record<Verdict, string> = { PASS: 'var(--mint)', 'NEEDS LAB': 'var(--amber)', 'UNABLE TO VERIFY': 'var(--grey)' };

function Count({ n }: { n: number }) {
  return <>{Math.round(useCountUp(n, 900))}</>;
}

export default function Deliveries() {
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const bottles = useStore((s) => s.bottles);
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
    { n: counts.none, label: 'Untested', color: 'var(--line-2)' },
  ];
  const flow = {
    logged: deliveries.length,
    tested: deliveries.filter((d) => runs.find((r) => r.id === d.runId)?.evaluation).length,
    policy: deliveries.filter((d) => d.clause).length,
    released: deliveries.filter((d) => d.outcome === 'released').length,
    needsTap: deliveries.filter((d) => d.outcome === 'release').length,
  };

  return (
    <Screen title="Deliveries" tone="violet" eyebrow="Medical · incoming lots" back="/"
      art={<span className="runs-art" aria-hidden="true"><Glyph name="supplier" size={52} /><Glyph name="escrow" size={40} delay={200} /></span>}
      right={<Link to="/log" className="chip" style={{ textDecoration: 'none' }}>Log</Link>}>
      <div className="wide-2">
        <section className="card panel" aria-label="Pipeline">
          <div className="panel-head"><h2>Pipeline</h2><span className="eyebrow">{deliveries.length} lots · SANDBOX</span></div>
          <FlowArrows label="Delivery pipeline" token
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
        <section className="card panel" aria-label="Verdict counts">
          <div className="panel-head"><h2>Verdicts</h2><span className="eyebrow">one tablet per lot</span></div>
          <div className="vstrip">
            {strip.map((s, i) => (
              <div key={s.label} style={{ '--sc': s.color, '--k': i } as React.CSSProperties}>
                <span className="num vstrip-n"><Count n={s.n} /></span>
                <span className="vstrip-l"><i />{s.label}</span>
              </div>
            ))}
          </div>
          <div className="vbar" aria-hidden="true">
            {strip.filter((s) => s.n).map((s, i) => <span key={s.label} style={{ flexGrow: s.n, background: s.color, '--k': i } as React.CSSProperties} />)}
          </div>
          <p className="footnote">Screening result, not a pharmacopeial test.</p>
        </section>
      </div>

      {rows.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', padding: 28, justifyItems: 'center' }}>
          <Glyph name="supplier" size={72} />
          <p style={{ fontWeight: 600 }}>No deliveries yet.</p>
          <p className="muted" style={{ fontSize: 15 }}>When a supplier's delivery is logged, it appears here with its payment held in the SANDBOX escrow until a pharmacist releases it.</p>
        </div>
      ) : (
        <ul className="wide-2 cascade" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14 }}>
          {rows.map((d, i) => {
            const ev = runs.find((r) => r.id === d.runId)?.evaluation ?? null;
            const drug = DRUGS[d.drug];
            const recall = d.clause === 'P4' || bottles.find((b) => b.id === d.bottleId)?.recall === 'recall';
            const held = d.outcome === 'hold' || d.outcome === 'escalate';
            const wash = recall ? ' recall' : held ? ' held' : d.outcome === 'released' ? ' released' : '';
            const decisionC = recall ? 'var(--warm)' : held ? 'var(--amber)' : 'var(--mint)';
            return (
              <li key={d.id} style={{ contain: 'inline-size', '--i': Math.min(i, 8) } as React.CSSProperties}>
                <Link to={`/delivery/${d.id}`} className={'card del-card' + wash} aria-label={`${d.supplier}, lot ${d.lot}`}>
                  <div className="del-top">
                    <ActorAvatar actor={d.supplier} />
                    <div style={{ minWidth: 0 }}>
                      <p className="del-sup">{d.supplier}</p>
                      <p style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{drug?.name ?? d.drug} · <span className="mono" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>lot {d.lot}</span></p>
                    </div>
                    <span className="row" style={{ gap: 6, flex: 'none' }}>
                      {recall && <span className="chip bad"><span className="dot" />RECALL</span>}
                      <OutcomeChip outcome={d.outcome} />
                    </span>
                  </div>
                  <StatusRail label={`Lot ${d.lot}: logged, tested, decision`} delay={Math.min(i, 8) * 70} steps={[
                    { label: 'logged', done: true, color: 'var(--cb)', sub: 'escrow' },
                    { label: 'tested', done: !!ev, color: ev ? VERDICT_C[ev.verdict] : 'var(--sky)', sub: ev ? ev.verdict : undefined },
                    { label: 'decision', done: d.outcome !== 'pending', color: decisionC, sub: d.outcome !== 'pending' ? `${d.clause ? d.clause + ' · ' : ''}${DECISION[d.outcome]}` : undefined },
                  ]} />
                  <div className="del-foot">
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <VerdictChip verdict={ev?.verdict} />
                      <span className="num" style={{ fontSize: 13, whiteSpace: 'nowrap' }} title="Plateau as % of the reference band mean">{ev ? <>{ev.pct}%<span className="muted" style={{ fontSize: 11 }}> of ref</span></> : '—'}</span>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <p className="num del-amt">${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
