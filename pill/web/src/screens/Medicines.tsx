// Personal mode: my bottles, what each is for, the one tested tablet, recall status, a reminder, and one-tap Taken.
// Motion: cards cascade in, each drug's pill floats and draws its outline, the bell draws in and swings when a reminder is set,
// Taken draws a check and counts the time in, a saved reminder glows softly once, and "Add" slides a sheet up from the bottom.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Action, Screen } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import MedIcon from '../components/MedIcon';
import Glyph from '../components/Glyph';
import { actions, useStore } from '../lib/store';
import { useCountUp } from '../lib/count';
import { DRUGS } from '../data/reference';
import type { Bottle } from '../lib/types';
import CalendarButton from '../components/CalendarButton';
import '../story.css';

const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function RecallChip({ b }: { b: Bottle }) {
  if (b.recall === 'recall') return <span className="chip bad"><span className="dot" />RECALL</span>;
  if (b.recall === 'unreachable') return <span className="chip"><span className="dot" />could not check</span>;
  if (b.recall === 'no_record') {
    const day = b.recallCheckedAt ? new Date(b.recallCheckedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    return <span className="chip ok"><span className="dot" />no recall record · checked {day}</span>;
  }
  return <span className="chip"><span className="dot" />recall not checked</span>;
}

function takenLine(takenAt: number[]) {
  const last = takenAt[0];
  if (!last) return 'Not taken yet today';
  const d = new Date(last);
  if (d.toDateString() === new Date().toDateString()) return `Taken today at ${clock(last)}`;
  return `Last taken ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${clock(last)}`;
}

/** "Taken today at HH:MM", the clock rolling up from 00:00 to the tap. */
function CountedTaken({ at }: { at: number }) {
  const d = new Date(at);
  const minutes = Math.round(useCountUp(d.getHours() * 60 + d.getMinutes(), 600));
  return <>Taken today at {clock(new Date(2000, 0, 1, 0, minutes).getTime())}</>;
}

/** A circle and a check, drawn stroke by stroke (pathLength 1) when `draw` is set. */
function Check({ draw }: { draw: boolean }) {
  return (
    <svg className={'med-check' + (draw ? ' draw' : '')} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.6" pathLength={1} />
      <path d="M6 10.4 8.7 13 14 7.4" pathLength={1} />
    </svg>
  );
}

/** A hand-drawn bell: draws in, and swings now and then while a reminder is set. */
function Bell({ on }: { on: boolean }) {
  return (
    <svg className={'bell' + (on ? ' on' : '')} viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <g className="bell-body">
        <path d="M16 5.5c-4.6 0-7.6 3.4-7.6 8v5.2l-2.4 3.6h20l-2.4-3.6v-5.2c0-4.6-3-8-7.6-8Z" pathLength={1} style={{ fill: on ? 'var(--mint-tint)' : 'none' }} />
        <path d="M16 3v2.5" pathLength={1} />
      </g>
      <path className="bell-clap" d="M13 25.5a3 3 0 0 0 6 0" pathLength={1} />
      {on && <><path className="bell-ring" d="M5 9.5a10 10 0 0 1 3-4.5" pathLength={1} /><path className="bell-ring" d="M27 9.5a10 10 0 0 0-3-4.5" pathLength={1} /></>}
    </svg>
  );
}

/** Bottom sheet for "Add another bottle": slides up, Escape or the backdrop closes it. */
function AddSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  // portalled to <body>: the routed screen column is its own stacking context, and the sheet must sit over the tab bar
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet card" role="dialog" aria-modal="true" aria-label="Add a medicine" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grab" aria-hidden="true" />
        <h2 className="serif" style={{ fontSize: 28, fontWeight: 400 }}>Add a medicine</h2>
        <Link to="/bottle" className="sheet-opt" autoFocus>
          <Glyph name="bottle" size={44} />
          <span><b>Scan a bottle label</b><span className="sub">Photograph the label; Pill reads the drug, lot and expiry and checks recalls.</span></span>
          <span className="pointer" aria-hidden="true">→</span>
        </Link>
        <Link to="/bottle" className="sheet-opt">
          <Glyph name="quarter" size={44} delay={120} />
          <span><b>Then test one tablet</b><span className="sub">A quarter tablet in the station, three minutes, one of three words.</span></span>
          <span className="pointer" aria-hidden="true">→</span>
        </Link>
        <button type="button" className="btn ghost" onClick={onClose}>Not now</button>
      </div>
    </div>,
    document.body,
  );
}

export default function Medicines() {
  const bottles = useStore((s) => s.bottles);
  const runs = useStore((s) => s.runs);
  const [tapped, setTapped] = useState<Record<string, number>>({});   // bottle id → tap count, replays the draw
  const [saved, setSaved] = useState<Record<string, number>>({});     // bottle id → save count, replays the glow
  const [adding, setAdding] = useState(false);

  return (
    <Screen title="My medicines" back="/" tone="mint" eyebrow={`${bottles.length} ${bottles.length === 1 ? 'bottle' : 'bottles'}`}
      art={bottles.length ? <span className="med-stack" aria-hidden="true">{bottles.slice(0, 3).map((b, i) => <MedIcon key={b.id} drug={b.drug} size={i ? 40 : 52} />)}</span> : <Glyph name="bottle" size={56} />}>
      <p className="card note-card" role="note">
        <Glyph name="station" size={34} />
        <span>Measuring a dose needs the station. This list does not re-test.</span>
      </p>

      {bottles.length === 0 ? (
        <div className="card stack reveal-in" style={{ textAlign: 'center', padding: 28, justifyItems: 'center' }}>
          <Glyph name="bottle" size={72} />
          <p style={{ fontSize: 20, fontWeight: 600 }}>No bottles yet. Scan one.</p>
          <p className="muted">Each bottle you add shows what it is for, its recall status and when you last took it.</p>
        </div>
      ) : (
        <ul className="wide-2 cascade med-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {bottles.map((b, i) => {
            const ev = runs.find((r) => r.id === b.runId)?.evaluation ?? null;
            const takenToday = !!b.takenAt[0] && new Date(b.takenAt[0]).toDateString() === new Date().toDateString();
            const tap = tapped[b.id];
            return (
              <li key={b.id} className={'card stack med-card' + (takenToday ? ' taken' : '')} style={{ gap: 12, '--i': Math.min(i, 6) } as React.CSSProperties}>
                <div className="med-head">
                  <MedIcon drug={b.drug} size={60} />
                  <div style={{ minWidth: 0 }}>
                    <h2 className="med-name">{DRUGS[b.drug.toLowerCase()]?.name ?? b.drug}</h2>
                    <p style={{ color: 'var(--ink-2)', marginTop: 2 }}>{b.strength} · <span className="mono" style={{ fontSize: '0.85em' }}>lot {b.lot}</span></p>
                  </div>
                </div>
                <p style={{ color: 'var(--ink-2)' }}>{b.usedFor}</p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {ev ? <VerdictChip verdict={ev.verdict} /> : <span className="chip"><span className="dot" />not tested, no station</span>}
                  <RecallChip b={b} />
                </div>
                {ev && <Link to={`/evaluation/${b.runId}`} className="footnote">See the tested tablet <span className="pointer" aria-hidden="true">→</span></Link>}
                <hr className="hr" />
                <label className="med-remind">
                  <Bell on={!!b.reminder} />
                  <span>Remind me at</span>
                  <input
                    type="time"
                    value={b.reminder ?? ''}
                    onChange={(e) => { actions.updateBottle(b.id, { reminder: e.target.value || null }); setSaved((s) => ({ ...s, [b.id]: (s[b.id] ?? 0) + 1 })); }}
                    className={'mono med-time' + (saved[b.id] ? ` med-saved-${saved[b.id] % 2}` : '')}
                    style={{ font: 'inherit', fontFamily: 'var(--mono)', color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', minHeight: 48 }}
                  />
                </label>
                <p className="footnote" style={{ marginTop: -4 }}>Reminders ring on this phone only.</p>
                {b.reminder && (
                  <CalendarButton compact summary={`Take ${b.drug} ${b.strength}`} description={`Lot ${b.lot}. ${b.usedFor}`} start={`${new Date().toISOString().slice(0, 10)}T${b.reminder}:00`} minutes={10} recurrenceDaily label="Add daily reminder to Google Calendar" />
                )}
                <button type="button" className="btn" aria-describedby={`taken-${b.id}`}
                  onClick={() => { actions.markTaken(b.id); setTapped((s) => ({ ...s, [b.id]: (s[b.id] ?? 0) + 1 })); }}>
                  {takenToday && <Check key={tap ?? 0} draw={!!tap} />}
                  Taken
                </button>
                <p id={`taken-${b.id}`} className="mono" role="status" style={{ textAlign: 'center', fontSize: 15, color: takenToday ? 'var(--ink)' : 'var(--muted)' }}>
                  {takenToday && <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)', marginRight: 8, verticalAlign: 'middle' }} />}
                  {tap && takenToday ? <CountedTaken key={tap} at={b.takenAt[0]} /> : takenLine(b.takenAt)}
                </p>
                {!ev && <Link to={`/place?bottle=${b.id}`} className="btn ghost" style={{ textDecoration: 'none' }}>Test one tablet</Link>}
              </li>
            );
          })}
        </ul>
      )}

      <Action>
        {bottles.length === 0
          ? <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>
          : <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => setAdding(true)}>Add another bottle</button>}
      </Action>
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
