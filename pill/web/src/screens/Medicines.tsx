// Personal mode: my bottles, what each is for, the one tested tablet, recall status, a reminder, and one-tap Taken.
// Motion: cards stagger in; Taken draws a check and counts the time in; a saved reminder glows softly once.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, NavLink, Screen } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import { actions, useStore } from '../lib/store';
import { useCountUp } from '../lib/motion';
import { DRUGS } from '../data/reference';
import type { Bottle } from '../lib/types';
import CalendarButton from '../components/CalendarButton';

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

export default function Medicines() {
  const bottles = useStore((s) => s.bottles);
  const runs = useStore((s) => s.runs);
  const [tapped, setTapped] = useState<Record<string, number>>({});   // bottle id → tap count, replays the draw
  const [saved, setSaved] = useState<Record<string, number>>({});     // bottle id → save count, replays the glow

  return (
    <Screen title="My medicines" back="/">
      <p className="card" role="note" style={{ padding: '14px 16px', fontSize: 15, color: 'var(--ink-2)', borderLeft: '3px solid var(--sky)' }}>
        Measuring a dose needs the station. This list does not re-test.
      </p>

      {bottles.length === 0 ? (
        <div className="card stack reveal-in" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontSize: 20, fontWeight: 600 }}>No bottles yet. Scan one.</p>
          <p className="muted">Each bottle you add shows what it is for, its recall status and when you last took it.</p>
        </div>
      ) : (
        <ul className="stack stagger" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14, '--stagger-start': '80ms' } as React.CSSProperties}>
          {bottles.map((b, i) => {
            const ev = runs.find((r) => r.id === b.runId)?.evaluation ?? null;
            const takenToday = !!b.takenAt[0] && new Date(b.takenAt[0]).toDateString() === new Date().toDateString();
            const tap = tapped[b.id];
            return (
              <li key={b.id} className="card stack" style={{ gap: 12, '--i': Math.min(i, 6) } as React.CSSProperties}>
                <div>
                  <h2 style={{ fontSize: 22 }}>{DRUGS[b.drug.toLowerCase()]?.name ?? b.drug}</h2>
                  <p style={{ color: 'var(--ink-2)', marginTop: 4 }}>{b.strength} · <span className="mono" style={{ fontSize: '0.85em' }}>lot {b.lot}</span></p>
                </div>
                <p style={{ color: 'var(--ink-2)' }}>{b.usedFor}</p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {ev ? <VerdictChip verdict={ev.verdict} /> : <span className="chip"><span className="dot" />not tested, no station</span>}
                  <RecallChip b={b} />
                </div>
                {ev && <Link to={`/evaluation/${b.runId}`} className="footnote">See the tested tablet</Link>}
                <hr className="hr" />
                <label className="row between" style={{ gap: 12 }}>
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
                {!ev && <NavLink to={`/place?bottle=${b.id}`}>Test one tablet</NavLink>}
              </li>
            );
          })}
        </ul>
      )}

      <Action>
        {bottles.length === 0
          ? <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>
          : <NavLink to="/bottle">Add another bottle</NavLink>}
      </Action>
    </Screen>
  );
}
