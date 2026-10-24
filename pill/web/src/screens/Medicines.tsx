// Personal mode: my bottles, what each is for, the one tested tablet, recall status, a reminder, and one-tap Taken.
import { Link } from 'react-router-dom';
import { Action, NavLink, Screen } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import { actions, useStore } from '../lib/store';
import { DRUGS } from '../data/reference';
import type { Bottle } from '../lib/types';

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

export default function Medicines() {
  const bottles = useStore((s) => s.bottles);
  const runs = useStore((s) => s.runs);

  return (
    <Screen title="My medicines" back="/">
      <p className="card" role="note" style={{ padding: '14px 16px', fontSize: 15, color: 'var(--ink-2)', borderLeft: '3px solid var(--sky)' }}>
        Measuring a dose needs the station. This list does not re-test.
      </p>

      {bottles.length === 0 ? (
        <div className="card stack" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontSize: 20, fontWeight: 600 }}>No bottles yet. Scan one.</p>
          <p className="muted">Each bottle you add shows what it is for, its recall status and when you last took it.</p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14 }}>
          {bottles.map((b, i) => {
            const ev = runs.find((r) => r.id === b.runId)?.evaluation ?? null;
            const takenToday = !!b.takenAt[0] && new Date(b.takenAt[0]).toDateString() === new Date().toDateString();
            return (
              <li key={b.id} className="card stack rise" style={{ gap: 12, animationDelay: `${Math.min(i, 6) * 50}ms` }}>
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
                    onChange={(e) => actions.updateBottle(b.id, { reminder: e.target.value || null })}
                    className="mono"
                    style={{ font: 'inherit', fontFamily: 'var(--mono)', color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', minHeight: 48 }}
                  />
                </label>
                <p className="footnote" style={{ marginTop: -4 }}>Reminders ring on this phone only.</p>
                <button type="button" className="btn" onClick={() => actions.markTaken(b.id)} aria-describedby={`taken-${b.id}`}>
                  Taken
                </button>
                <p id={`taken-${b.id}`} className="mono" role="status" style={{ textAlign: 'center', fontSize: 15, color: takenToday ? 'var(--ink)' : 'var(--muted)' }}>
                  {takenToday && <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--mint)', marginRight: 8, verticalAlign: 'middle' }} />}
                  {takenLine(b.takenAt)}
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
