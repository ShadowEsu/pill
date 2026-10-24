// Home. Medical: the deliveries desk. Personal: my medicines, big and short. Both end with the same settings row.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';
import type { Bottle, Delivery, Run } from '../lib/types';

const OUTCOME: Record<Delivery['outcome'], [string, string]> = {
  pending: ['', 'pending'],
  release: ['ok', 'release · needs tap'],
  hold: ['bad', 'hold'],
  escalate: ['warn', 'escalate'],
  released: ['ok', 'released'],
};

const VERDICT_CLASS = { PASS: 'verdict-pass', 'NEEDS LAB': 'verdict-needslab', 'UNABLE TO VERIFY': 'verdict-unable' } as const;

function VerdictChip({ run }: { run: Run | undefined }) {
  if (!run) return <span className="chip">not tested</span>;
  if (!run.evaluation) return <span className="chip">no result yet</span>;
  return <span className={'chip ' + VERDICT_CLASS[run.evaluation.verdict]}>{run.evaluation.verdict}</span>;
}

function RecallChip({ b }: { b: Bottle }) {
  if (b.recall === 'recall') return <span className="chip bad"><span className="dot" />RECALL</span>;
  if (b.recall === 'no_record') return <span className="chip ok"><span className="dot" />no recall</span>;
  if (b.recall === 'unreachable') return <span className="chip warn"><span className="dot" />recall check failed</span>;
  return <span className="chip"><span className="dot" />recall not checked</span>;
}

/** Earliest reminder still ahead today, else the earliest tomorrow. */
function nextReminder(bottles: Bottle[]) {
  const withTime = bottles.filter((b) => b.reminder).sort((a, b) => a.reminder!.localeCompare(b.reminder!));
  if (!withTime.length) return null;
  const d = new Date();
  const now = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return withTime.find((b) => b.reminder! >= now) ?? withTime[0];
}

function Settings() {
  const bigText = useStore((s) => s.bigText);
  const cell: React.CSSProperties = { minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 6px', fontSize: 14, fontWeight: 500, textDecoration: 'none', textAlign: 'center', lineHeight: 1.2 };
  return (
    <nav aria-label="Settings" className="card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', boxShadow: 'none', overflow: 'hidden' }}>
      <Link to="/welcome" style={cell}>Change who I am</Link>
      <button type="button" role="switch" aria-checked={bigText} onClick={() => actions.setBigText(!bigText)}
        style={{ ...cell, border: 0, borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)', background: 'none', cursor: 'pointer' }}>
        Big text
        <span aria-hidden="true" style={{ width: 34, height: 20, borderRadius: 999, flex: 'none', position: 'relative', background: bigText ? 'var(--mint)' : 'var(--grey-tint)', transition: 'background .25s var(--ease)' }}>
          <span style={{ position: 'absolute', top: 2, left: bigText ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .25s var(--ease)' }} />
        </span>
      </button>
      <Link to="/kiosk" style={cell}>Station screen</Link>
    </nav>
  );
}

const rowLink: React.CSSProperties = { textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '12px 0' };

function Medical() {
  const station = useStore((s) => s.station);
  const deliveries = useStore((s) => s.deliveries);
  return (
    <Screen title="Deliveries" right={
      <span className={'chip ' + (station.online ? 'ok' : '')}><span className="dot" />{station.id} · {station.online ? 'online' : 'offline'}</span>
    }>
      <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>
      <section className="card" style={{ padding: '6px 18px' }} aria-label="Latest deliveries">
        {deliveries.length === 0 && <p className="muted" style={{ padding: '14px 0' }}>No deliveries logged yet.</p>}
        {deliveries.slice(0, 3).map((d, i) => {
          const [cls, word] = OUTCOME[d.outcome];
          return (
            <Link key={d.id} to={`/delivery/${d.id}`} style={{ ...rowLink, borderTop: i ? '1px solid var(--line)' : 0 }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.supplier}</span>
                <span className="mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>lot {d.lot} · {d.drug}</span>
                <span className="mono" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="muted">SANDBOX</span></span>
              </span>
              <span className={'chip ' + cls}><span className="dot" />{word}</span>
            </Link>
          );
        })}
      </section>
      <div className="stack">
        <Link to="/deliveries" className="btn ghost" style={{ textDecoration: 'none' }}>All deliveries</Link>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Link to="/log" className="btn ghost" style={{ textDecoration: 'none', padding: '0 12px' }}>Decision log</Link>
          <Link to="/verify" className="btn ghost" style={{ textDecoration: 'none', padding: '0 12px' }}>Pay for a verdict</Link>
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}><Settings /></div>
    </Screen>
  );
}

function Personal() {
  const bottles = useStore((s) => s.bottles);
  const runs = useStore((s) => s.runs);
  const next = nextReminder(bottles);
  return (
    <main className="screen rise" style={{ gap: 14 }}>
      <h1 style={{ fontSize: '2.2rem', letterSpacing: '-0.03em', minHeight: 44, display: 'flex', alignItems: 'center' }}>My medicines</h1>
      <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a new bottle</Link>
      {next && (
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--sky)', boxShadow: '0 0 0 4px var(--sky-tint)', flex: 'none' }} />
          <p style={{ fontSize: '1.15rem' }}>Next: <b>{next.drug}</b> at <span className="mono">{next.reminder}</span></p>
        </div>
      )}
      <section className="card" style={{ padding: '4px 18px' }} aria-label="My bottles">
        {bottles.length === 0 && (
          <p style={{ padding: '16px 0', fontSize: '1.05rem', color: 'var(--ink-2)' }}>No bottles yet. Photograph a label to add one.</p>
        )}
        {bottles.slice(0, 3).map((b, i) => (
          <Link key={b.id} to="/medicines" style={{ display: 'block', textDecoration: 'none', padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
            <span style={{ display: 'block', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <b>{b.drug}</b> <span style={{ color: 'var(--ink-2)' }}>{b.strength}</span>
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)', marginRight: 'auto' }}>lot {b.lot}</span>
              <VerdictChip run={runs.find((r) => r.id === b.runId)} />
              <RecallChip b={b} />
            </span>
          </Link>
        ))}
        {bottles.length > 3 && (
          <Link to="/medicines" className="footnote" style={{ display: 'block', padding: '10px 0 12px', borderTop: '1px solid var(--line)', textDecoration: 'none' }}>
            All {bottles.length} bottles →
          </Link>
        )}
      </section>
      <Link to="/ask" className="btn ghost" style={{ textDecoration: 'none' }}>Ask Pill</Link>
      <div style={{ marginTop: 'auto' }}><Settings /></div>
    </main>
  );
}

export default function Home() {
  const mode = useStore((s) => s.mode);
  const bigText = useStore((s) => s.bigText);
  // The store persists bigText but nothing re-applies the <html> class after a reload; keep it in sync here.
  useEffect(() => { document.documentElement.classList.toggle('big', bigText); }, [bigText]);
  return mode === 'medical' ? <Medical /> : <Personal />;
}
