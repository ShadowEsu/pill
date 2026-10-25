// Home. Medical: the deliveries desk (no longer at "/", kept for /home). Personal: Today — a big serif greeting, a dose ring
// that fills, three big cards (My medicines, Schedule, Check a bottle at the station), the Easy mode toggle, the next dose
// with a drawn clock, today's doses as capsule-shaped tiles, a mini timetable.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Screen, SplitTitle } from '../components/Shell';
import Timetable from '../components/Timetable';
import MedIcon, { medColor } from '../components/MedIcon';
import StatusRail from '../components/StatusRail';
import ActorAvatar from '../components/ActorAvatar';
import Glyph from '../components/Glyph';
import { actions, useStore } from '../lib/store';
import { useCountUp } from '../lib/count';
import { doseItems, myBottles, nextUp, takenToday, type NextDose } from '../lib/doses';
import { DAY, dayStart, hm, useNow } from '../lib/when';
import EmptyState, { SettingsLink } from '../components/EmptyState';
import EasyToggle from '../components/EasyToggle';
import type { Bottle, Delivery, Run } from '../lib/types';
import '../components/viz.css';
import '../story.css';

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
        <span aria-hidden="true" className="mini-switch" data-on={bigText} />
      </button>
      <Link to="/kiosk" style={cell}>Station screen</Link>
    </nav>
  );
}

function Medical() {
  const station = useStore((s) => s.station);
  const now = useNow();
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  return (
    <Screen title="Deliveries" tone="sky" art={<Glyph name="supplier" size={56} />} eyebrow={new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} right={<>
      <span className={'chip ' + (station.online ? 'ok' : '')}><span className="dot" />{station.id} · {station.online ? 'online' : 'offline'}</span>
      <SettingsLink />
    </>}>
      {deliveries.length > 0 && <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}
      <section className="card cascade" style={{ padding: '4px 20px' }} aria-label="Latest deliveries">
        {deliveries.length === 0 && <EmptyState art="box" action={<Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}>No deliveries logged yet. Scan the first bottle of a delivery to start.</EmptyState>}
        {deliveries.slice(0, 3).map((d, i) => {
          const [cls, word] = OUTCOME[d.outcome];
          const ev = runs.find((r) => r.id === d.runId)?.evaluation;
          return (
            <Link key={d.id} to={`/delivery/${d.id}`} className="row-hover home-del" style={{ borderTop: i ? '1px solid var(--line)' : 0, '--i': i } as React.CSSProperties}>
              <ActorAvatar actor={d.supplier} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.supplier}</span>
                <span className="mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>lot {d.lot} · {d.drug}</span>
                <span className="num" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="muted">SANDBOX</span></span>
                <StatusRail label={`Lot ${d.lot} status`} delay={i * 120} steps={[
                  { label: 'logged', done: true, color: 'var(--cb)' },
                  { label: 'tested', done: !!ev, color: 'var(--sky)', sub: ev?.verdict },
                  { label: 'decision', done: d.outcome !== 'pending', color: d.outcome === 'hold' || d.outcome === 'escalate' ? 'var(--amber)' : 'var(--mint)', sub: word },
                ]} />
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

/** Taken / planned today as a ring that fills; the count rolls up. */
function DoseRing({ taken, planned }: { taken: number; planned: number }) {
  const total = Math.max(planned, taken, 1);
  const pct = useCountUp((taken / total) * 100, 1100);
  const n = Math.round(useCountUp(taken, 900));
  const R = 42, C = 2 * Math.PI * R;
  return (
    <div className="dose-ring" role="img" aria-label={`${taken} of ${Math.max(planned, taken)} doses taken today`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} className="track" />
        <circle cx="50" cy="50" r={R} className="fill" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct / 100) }} />
        {Array.from({ length: Math.max(planned, taken) }, (_, k) => {
          const a = ((k + 0.5) / Math.max(planned, taken, 1)) * 2 * Math.PI - Math.PI / 2;
          return <circle key={k} cx={50 + Math.cos(a) * R} cy={50 + Math.sin(a) * R} r="2.4" className={'tick' + (k < taken ? ' on' : '')} />;
        })}
      </svg>
      <span className="dose-ring-n"><b className="num">{n}</b><span>/{Math.max(planned, taken)}</span></span>
      <span className="dose-ring-l">taken today</span>
    </div>
  );
}

/** A hand-drawn clock whose hands sweep to the dose time. */
function Clock({ at }: { at: number }) {
  const d = new Date(at);
  const hDeg = ((d.getHours() % 12) + d.getMinutes() / 60) * 30, mDeg = d.getMinutes() * 6;
  return (
    <svg className="draw-clock" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" className="face" />
      <path className="rim" d="M32 5.2c14.6-.3 27 11.6 26.9 26.6.1 15-12 27.3-26.8 27.1C17 59.3 4.9 46.8 5.2 31.9 5.3 17 17.5 5.4 32 5.2Z" pathLength={1} />
      {[0, 90, 180, 270].map((a) => <path key={a} className="tick" d="M32 9.5v3.5" transform={`rotate(${a} 32 32)`} pathLength={1} />)}
      <path className="hand h" d="M32 32V19" style={{ '--deg': `${hDeg}deg` } as React.CSSProperties} />
      <path className="hand m" d="M32 32V12" style={{ '--deg': `${mDeg}deg` } as React.CSSProperties} />
      <circle cx="32" cy="32" r="2.4" className="pin" />
    </svg>
  );
}

function NextCard({ next, now }: { next: NextDose | null; now: number }) {
  if (!next) return null;
  const tomorrow = next.at >= dayStart(now) + DAY;
  const mins = Math.max(0, Math.round((next.at - now) / 60e3));
  return (
    <section className="card next-card" aria-label={`Next up: ${next.b.drug} at ${next.b.reminder}`} style={{ '--mi': medColor(next.b.drug) } as React.CSSProperties}>
      <Clock at={next.at} />
      <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
        <span className="eyebrow">next up</span>
        <span className="next-drug"><b>{next.b.drug}</b> <span className="num">{tomorrow ? 'tomorrow ' : ''}{next.b.reminder}</span></span>
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="chip beat live"><span className="dot" />reminder on</span>
          <span className="mono muted" style={{ fontSize: 12.5 }}>in {mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`}</span>
        </span>
      </div>
    </section>
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
  const takenN = mine.filter((b) => takenToday(b, now).length).length;
  const plannedN = mine.filter((b) => b.reminder).length;
  return (
    <main className="screen home tone-mint">
      <div className="screen-wash" aria-hidden="true" />
      <header className="home-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow"><span className="eb-dot" aria-hidden="true" />{new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <SplitTitle text={greet} className="home-greet title" />
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          {mine.length > 0 && <DoseRing taken={takenN} planned={plannedN} />}
          <SettingsLink />
        </div>
      </header>
      <nav className="home-cards cascade" aria-label="My medicines, schedule and the station">
        <Link to="/medicines" className="card home-card" style={{ '--i': 0 } as React.CSSProperties} data-home-card="medicines">
          <Glyph name="bottle" size={48} />
          <span><b>My medicines</b><span className="sub">{mine.length ? `${mine.length} ${mine.length === 1 ? 'bottle' : 'bottles'} · what the station tested` : 'What the station tested'}</span></span>
          <span className="pointer" aria-hidden="true">→</span>
        </Link>
        <Link to="/schedule" className="card home-card" style={{ '--i': 1 } as React.CSSProperties} data-home-card="schedule">
          <Glyph name="calendar" size={48} delay={120} />
          <span><b>Schedule</b><span className="sub">{plannedN ? `${takenN} of ${plannedN} taken today · reminders` : 'Set times and reminders'}</span></span>
          <span className="pointer" aria-hidden="true">→</span>
        </Link>
        <Link to="/station" className="card home-card dark" style={{ '--i': 2 } as React.CSSProperties} data-home-card="station">
          <Glyph name="station" size={48} delay={240} />
          <span><b>Check a bottle at the station</b><span className="sub">Lights off, clean water, the whole tablet, a verdict</span></span>
          <span className="pointer" aria-hidden="true">→</span>
        </Link>
      </nav>
      <EasyToggle />
      <NextCard next={nextUp(planned, now)} now={now} />

      <section className="stack" style={{ gap: 12 }} aria-label="My bottles">
        <div className="panel-head"><h2 className="serif" style={{ fontWeight: 400, fontSize: '1.7rem' }}>Today’s doses</h2>{mine.length > 0 && <Link to="/medicines" className="eyebrow" style={{ textDecoration: 'none', color: 'var(--sky-ink)' }}>Medicines <span className="pointer">→</span></Link>}</div>
        {mine.length === 0 && (
          <div className="card"><EmptyState art="bottle" action={<Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}>No bottles yet. Photograph a label and test one tablet from it.</EmptyState></div>
        )}
        <div className="wide-2 cascade" style={{ gap: 12 }}>
          {mine.slice(0, 4).map((b, i) => {
            const taken = takenToday(b, now);
            return (
              <div key={b.id} className={'dose-tile' + (taken.length ? ' taken' : '')} style={{ '--mi': medColor(b.drug), '--i': i } as React.CSSProperties}>
                <span className="dose-half" aria-hidden="true" />
                <Link to="/medicines" className="dose-main">
                  <MedIcon drug={b.drug} size={54} />
                  <span style={{ minWidth: 0 }}>
                    <span className="dose-name"><b>{b.drug}</b> <span style={{ color: 'var(--ink-2)' }}>{b.strength}</span></span>
                    <span className="mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)' }}>lot {b.lot}{b.reminder ? ` · ${b.reminder}` : ' · as needed'}</span>
                  </span>
                </Link>
                {taken.length
                  ? <span className="chip ok dose-done"><span className="dot" />taken {hm(taken[0])}</span>
                  : <button type="button" className="btn mint dose-btn" onClick={() => actions.markTaken(b.id)} aria-label={`Taken ${b.drug}`}>Taken</button>}
                <span className="dose-chips">
                  <VerdictChip run={runs.find((r) => r.id === b.runId)} />
                  <RecallChip b={b} />
                </span>
              </div>
            );
          })}
        </div>
        {mine.length > 4 && <Link to="/medicines" className="footnote" style={{ textDecoration: 'none' }}>All {mine.length} bottles <span className="pointer">→</span></Link>}
      </section>
      {planned.length > 0 && (
        <section className="card panel" style={{ padding: '12px 14px', gap: 6 }} aria-label="Today">
          <div className="panel-head"><h2>Today</h2><Link to="/schedule" className="eyebrow" style={{ textDecoration: 'none', color: 'var(--sky-ink)' }}>Schedule <span className="pointer">→</span></Link></div>
          <Timetable label="Today's doses" items={items} start={6} end={22} nowLine horizontal rowPx={28} minSpan={3} now={now} />
        </section>
      )}
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
