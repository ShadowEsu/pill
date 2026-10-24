// Home. Medical: the deliveries desk (no longer at "/", kept for /home). Personal: Today — next dose, a mini timetable, my bottles.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Timetable from '../components/Timetable';
import NextUp from '../components/NextUp';
import { actions, useStore } from '../lib/store';
import { doseItems, myBottles, nextUp, takenToday } from '../lib/doses';
import { hm, useNow } from '../lib/when';
import EmptyState, { SettingsLink } from '../components/EmptyState';
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

const rowLink: React.CSSProperties = { textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '12px 10px', margin: '0 -10px' };

function Medical() {
  const station = useStore((s) => s.station);
  const now = useNow();
  const deliveries = useStore((s) => s.deliveries);
  return (
    <Screen title="Deliveries" eyebrow={new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} right={<>
      <span className={'chip ' + (station.online ? 'ok' : '')}><span className="dot" />{station.id} · {station.online ? 'online' : 'offline'}</span>
      <SettingsLink />
    </>}>
      {deliveries.length > 0 && <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}
      <section className="card" style={{ padding: '4px 20px' }} aria-label="Latest deliveries">
        {deliveries.length === 0 && <EmptyState art="box" action={<Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}>No deliveries logged yet. Scan the first bottle of a delivery to start.</EmptyState>}
        {deliveries.slice(0, 3).map((d, i) => {
          const [cls, word] = OUTCOME[d.outcome];
          return (
            <Link key={d.id} to={`/delivery/${d.id}`} className="row-hover" style={{ ...rowLink, borderTop: i ? '1px solid var(--line)' : 0 }}>
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
      <div className="stack" style={{ gap: 12 }}>
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
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const now = useNow();
  const mine = myBottles(bottles, deliveries);
  const planned = mine.filter((b) => b.reminder || b.takenAt.length);
  const items = doseItems(planned, now, false).map((it) => ({ ...it, lane: 0 }));
  const hour = new Date(now).getHours();
  const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <main className="screen rise" style={{ gap: 16 }}>
      <header className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 style={{ fontSize: '2.2rem', letterSpacing: '-0.03em', marginTop: 4 }}>{greet}</h1>
        </div>
        <SettingsLink />
      </header>
      <NextUp next={nextUp(planned, now)} now={now} />
      {planned.length > 0 && (
        <section className="card panel" style={{ padding: '12px 14px', gap: 6 }} aria-label="Today">
          <div className="panel-head"><h2>Today</h2><Link to="/schedule" className="eyebrow" style={{ textDecoration: 'none', color: 'var(--sky-ink)' }}>Schedule <span className="pointer">→</span></Link></div>
          <Timetable label="Today's doses" items={items} start={6} end={22} nowLine horizontal rowPx={28} minSpan={3} now={now} />
        </section>
      )}
      <section className="stack" style={{ gap: 12 }} aria-label="My bottles">
        {mine.length === 0 && (
          <div className="card"><EmptyState art="bottle" action={<Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}>No bottles yet. Photograph a label and test one tablet from it.</EmptyState></div>
        )}
        {mine.slice(0, 4).map((b) => {
          const taken = takenToday(b, now);
          return (
            <div key={b.id} className="card lift" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', alignItems: 'center', borderLeft: `4px solid ${taken.length ? 'var(--mint)' : b.reminder ? 'var(--sky)' : 'var(--line-2)'}` }}>
              <Link to="/medicines" style={{ textDecoration: 'none', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ textTransform: 'capitalize' }}>{b.drug}</b> <span style={{ color: 'var(--ink-2)' }}>{b.strength}</span></span>
                <span className="mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)' }}>lot {b.lot}{b.reminder ? ` · ${b.reminder}` : ' · as needed'}</span>
              </Link>
              {taken.length
                ? <span className="chip ok"><span className="dot" />taken {hm(taken[0])}</span>
                : <button type="button" className="btn mint" style={{ width: 'auto', minHeight: 48, padding: '0 18px' }} onClick={() => actions.markTaken(b.id)} aria-label={`Taken ${b.drug}`}>Taken</button>}
              <span style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <VerdictChip run={runs.find((r) => r.id === b.runId)} />
                <RecallChip b={b} />
              </span>
            </div>
          );
        })}
        {mine.length > 4 && <Link to="/medicines" className="footnote" style={{ textDecoration: 'none' }}>All {mine.length} bottles <span className="pointer">→</span></Link>}
      </section>
      {mine.length > 0 && <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a new bottle</Link>}
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
