// Personal schedule: what is next, today's timetable (taken / planned / missed), two weeks of doses as a heat map, streaks.
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Timetable from '../components/Timetable';
import Heatmap, { type Heat } from '../components/Heatmap';
import NextUp from '../components/NextUp';
import { actions, useStore } from '../lib/store';
import { doseItems, dueSoon, myBottles, nextUp } from '../lib/doses';
import { DAY, atClock, dayStart, hm, hourOf, useNow } from '../lib/when';
import '../components/viz.css';

const WIDE = '(min-width: 900px)';
const subscribeWide = (cb: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

export default function Schedule() {
  const bottles = useStore((s) => s.bottles);
  const deliveries = useStore((s) => s.deliveries);
  const now = useNow();
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
  const mine = myBottles(bottles, deliveries).filter((b) => b.reminder || b.takenAt.length);
  const items = doseItems(mine, now);
  const hrs = [...items.map((i) => hourOf(i.at)), hourOf(now)];
  const start = Math.max(0, Math.min(6, Math.floor(Math.min(...hrs)))), end = Math.min(24, Math.max(22, Math.ceil(Math.max(...hrs) + 0.5)));
  const due = dueSoon(mine, now);

  const days = Array.from({ length: 14 }, (_, i) => dayStart(now) - (13 - i) * DAY);
  const took = (bi: number, c: number) => mine[bi].takenAt.some((t) => t >= days[c] && t < days[c] + DAY);
  const value = (r: number, c: number): Heat => {
    const b = mine[r];
    if (took(r, c)) return 4;
    if (!b.reminder) return null;
    return days[c] === dayStart(now) && now < atClock(b.reminder, now) ? 0 : 1;
  };
  const taken14 = (r: number) => days.filter((_, c) => took(r, c)).length;
  return (
    <Screen title="Schedule" eyebrow={new Date(now).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}>
      <NextUp next={nextUp(mine, now)} now={now} />

      {due.length > 0 && (
        <section className="stack" aria-label="Due now">
          {due.map((b) => {
            const late = atClock(b.reminder!, now) < now;
            return (
              <div key={b.id} className="card row between" style={{ padding: '12px 16px', borderLeft: `4px solid ${late ? 'var(--amber)' : 'var(--mint)'}` }}>
                <span style={{ fontSize: '1.1rem' }}><b style={{ textTransform: 'capitalize' }}>{b.drug}</b> <span className="mono" style={{ fontSize: 13 }}>{b.reminder}</span>{late && <span className="chip warn" style={{ marginLeft: 8 }}><span className="dot" />late</span>}</span>
                <button type="button" className="btn mint" style={{ width: 'auto', flex: 'none' }} onClick={() => actions.markTaken(b.id)}>Taken now</button>
              </div>
            );
          })}
        </section>
      )}

      <div className="wide-2" style={{ gridTemplateColumns: wide ? '1fr' : undefined }}>
        <section className="card panel" aria-label="Today">
          <div className="panel-head"><h2>Today</h2><span className="eyebrow">{String(start).padStart(2, '0')}:00–{String(end).padStart(2, '0')}:00</span></div>
          {mine.length === 0 ? <p className="muted">No reminders yet. Add one from <Link to="/medicines">Medicines</Link>.</p> : (
            <Timetable label="Today's doses" items={items} start={start} end={end} nowLine now={now}
              lanes={mine.map((b) => b.drug)} horizontal={wide} hourPx={32} rowPx={40} minSpan={wide ? 1.6 : undefined} />
          )}
          <div className="legend">
            <span><i style={{ background: 'var(--mint-tint)', boxShadow: 'inset 3px 0 var(--mint)' }} />taken</span>
            <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--sky)' }} />planned</span>
            <span><i style={{ background: 'var(--amber-tint)', boxShadow: 'inset 0 0 0 1.5px var(--amber)' }} />missed</span>
          </div>
        </section>

        <section className="card panel" aria-label="Doses taken, last 14 days">
          <div className="panel-head"><h2>Doses taken</h2><span className="eyebrow">14 days</span></div>
          <Heatmap label="Doses taken, last 14 days" rows={mine.length} cols={14} rowWidth={92} cellHeight={26}
            rowLabels={mine.map((b) => b.drug)} colLabels={days.map((d) => String(new Date(d).getDate()))}
            value={value}
            cellText={(r, c) => { const v = value(r, c); const b = mine[r]; const t = b.takenAt.find((x) => x >= days[c] && x < days[c] + DAY); return `${b.drug} · ${new Date(days[c]).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${v === 4 ? `taken ${hm(t!)}` : v === 1 ? `missed ${b.reminder}` : v === 0 ? `due ${b.reminder}` : 'no plan'}`; }}
            legend={[{ v: 4, label: 'taken' }, { v: 1, label: 'missed' }, { v: 0, label: 'later today' }, { v: null, label: 'no plan' }]} />
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
            {mine.map((b, r) => (
              <li key={b.id} style={{ fontSize: '1rem' }}>
                <b style={{ textTransform: 'capitalize' }}>{b.drug}</b>: {b.reminder ? <>{taken14(r)} of the last 14 days</> : <>{taken14(r)} doses in 14 days, as needed</>}
                <span className="bar" style={{ display: 'flex', marginTop: 4, height: 6 }}><span style={{ width: `${(taken14(r) / 14) * 100}%`, background: 'var(--mint)' }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
