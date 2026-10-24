// Personal schedule: the day as a strip with a sliding now-line, the next three doses counting down to the second,
// what is due now, today's timetable (taken / planned / missed), a week of doses by hour as a heat map, and 14-day streaks.
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Timetable from '../components/Timetable';
import Heatmap, { type Heat } from '../components/Heatmap';
import MedIcon, { medColor } from '../components/MedIcon';
import Glyph from '../components/Glyph';
import { actions, useStore } from '../lib/store';
import { doseItems, dueSoon, myBottles, takenToday } from '../lib/doses';
import { DAY, H, atClock, dayStart, hm, hourOf, useNow } from '../lib/when';
import type { Bottle } from '../lib/types';
import '../components/viz.css';
import '../story.css';

const WIDE = '(min-width: 900px)';
const subscribeWide = (cb: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };
const S0 = 6, S1 = 23;   // the day strip's hours
const HOURS = Array.from({ length: S1 - S0 }, (_, i) => S0 + i);
const pad2 = (n: number) => String(n).padStart(2, '0');

/** The next `n` reminder times across all bottles: today's still ahead and untaken, then the following days. */
function upcoming(bottles: Bottle[], now: number, n: number) {
  const out: { b: Bottle; at: number }[] = [];
  for (const b of bottles) {
    if (!b.reminder) continue;
    for (let d = 0; d < n + 1; d++) {
      const at = atClock(b.reminder, now) + d * DAY;
      if (d === 0 && (at <= now || takenToday(b, now).length)) continue;
      out.push({ b, at });
    }
  }
  return out.sort((x, y) => x.at - y.at).slice(0, n);
}

/** The day from 06:00 to 23:00: dose marks at their times and an ink now-line that slides in to the present. */
function DayStrip({ bottles, now }: { bottles: Bottle[]; now: number }) {
  const pos = (t: number) => Math.max(0, Math.min(100, ((hourOf(t) - S0) / (S1 - S0)) * 100));
  const marks = bottles.flatMap((b): { b: Bottle; at: number; kind: 'taken' | 'missed' | 'planned' }[] => {
    const taken = takenToday(b, now);
    if (taken.length) return taken.map((t) => ({ b, at: t, kind: 'taken' }));
    if (!b.reminder) return [];
    const at = atClock(b.reminder, now);
    return [{ b, at, kind: at < now ? 'missed' : 'planned' }];
  });
  const h = hourOf(now);
  return (
    <div className="dstrip" role="img" aria-label={`Today from ${pad2(S0)}:00 to ${pad2(S1)}:00; now ${hm(now)}; ${marks.length} doses`}>
      <div className="dstrip-sky" aria-hidden="true" />
      <div className="dstrip-hours" aria-hidden="true">{HOURS.filter((x) => x % 3 === 0).map((x) => <span key={x} style={{ left: `${pos(dayStart(now) + x * H)}%` }}>{pad2(x)}</span>)}</div>
      <div className="dstrip-track" aria-hidden="true">
        <span className="dstrip-past" style={{ width: `${pos(now)}%` }} />
        {marks.map((m, i) => (
          <span key={m.b.id + m.at} className={'dstrip-mark ' + m.kind} style={{ left: `${pos(m.at)}%`, '--mi': medColor(m.b.drug), '--i': i } as React.CSSProperties} title={`${m.b.drug} ${hm(m.at)} · ${m.kind}`}>
            <MedIcon drug={m.b.drug} size={30} still />
            <b className="num">{hm(m.at)}</b>
          </span>
        ))}
        {h >= S0 && h <= S1 && <span className="dstrip-now" style={{ left: `${pos(now)}%` }}><i className="num">{hm(now)}</i></span>}
      </div>
    </div>
  );
}

function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return (
    <span className="cd num" aria-label={`in ${parts[0]} hours ${parts[1]} minutes`}>
      {parts.map((p, i) => <span key={i} className="cd-seg"><b key={p}>{pad2(p)}</b><small>{['h', 'm', 's'][i]}</small></span>)}
    </span>
  );
}

export default function Schedule() {
  const bottles = useStore((s) => s.bottles);
  const deliveries = useStore((s) => s.deliveries);
  const now = useNow();
  const tick = useNow(1000);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
  const mine = myBottles(bottles, deliveries).filter((b) => b.reminder || b.takenAt.length);
  const items = doseItems(mine, now);
  const hrs = [...items.map((i) => hourOf(i.at)), hourOf(now)];
  const start = Math.max(0, Math.min(6, Math.floor(Math.min(...hrs)))), end = Math.min(24, Math.max(22, Math.ceil(Math.max(...hrs) + 0.5)));
  const due = dueSoon(mine, now);
  const next = upcoming(mine, tick, 3);

  const days = Array.from({ length: 14 }, (_, i) => dayStart(now) - (13 - i) * DAY);
  const took = (bi: number, c: number) => mine[bi].takenAt.some((t) => t >= days[c] && t < days[c] + DAY);
  const taken14 = (r: number) => days.filter((_, c) => took(r, c)).length;

  // a week of doses by hour: taken in that hour (any bottle), a reminder that passed untaken, or nothing planned
  const week = days.slice(-7);
  const inHour = (d: number, hr: number) => mine.flatMap((b) => b.takenAt).filter((t) => t >= week[d] + hr * H && t < week[d] + (hr + 1) * H).length;
  const remindAt = (hr: number) => mine.filter((b) => b.reminder && Number(b.reminder.slice(0, 2)) === hr);
  const hourHeat = (d: number, c: number): Heat => {
    const hr = HOURS[c];
    if (week[d] + hr * H > now) return null;
    const n = inHour(d, hr);
    if (n) return n > 1 ? 4 : 3;
    return remindAt(hr).length ? 1 : 0;
  };
  const dayName = (t: number) => (t === dayStart(now) ? 'Today' : new Date(t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));

  return (
    <Screen title="Schedule" tone="sky" eyebrow={new Date(now).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} art={<Glyph name="calendar" size={56} />}>
      <section className="card panel dstrip-card" aria-label="Today at a glance">
        <div className="panel-head"><h2>Today</h2><span className="eyebrow">{pad2(S0)}:00–{pad2(S1)}:00</span></div>
        <DayStrip bottles={mine} now={tick} />
      </section>

      {next.length > 0 && (
        <section className="wide-3 cascade" aria-label="Next doses">
          {next.map((n, i) => (
            <div key={n.b.id + n.at} className={'card next3' + (i === 0 ? ' first' : '')} style={{ '--mi': medColor(n.b.drug), '--i': i } as React.CSSProperties}>
              <div className="row" style={{ gap: 12 }}>
                <MedIcon drug={n.b.drug} size={44} />
                <div style={{ minWidth: 0 }}>
                  <p className="eyebrow">{i === 0 ? 'next up' : n.at >= dayStart(tick) + DAY ? 'tomorrow' : 'later today'}</p>
                  <p className="next3-drug"><b>{n.b.drug}</b> <span className="num">{n.b.reminder}</span></p>
                </div>
              </div>
              <Countdown ms={n.at - tick} />
            </div>
          ))}
        </section>
      )}

      {due.length > 0 && (
        <section className="stack" aria-label="Due now">
          {due.map((b) => {
            const late = atClock(b.reminder!, now) < now;
            return (
              <div key={b.id} className={'card due-card' + (late ? ' late' : '')}>
                <span className="row" style={{ gap: 12, minWidth: 0 }}>
                  <MedIcon drug={b.drug} size={40} />
                  <span style={{ fontSize: '1.1rem' }}><b style={{ textTransform: 'capitalize' }}>{b.drug}</b> <span className="mono" style={{ fontSize: 13 }}>{b.reminder}</span>{late && <span className="chip warn beat" style={{ marginLeft: 8 }}><span className="dot" />late</span>}</span>
                </span>
                <button type="button" className="btn mint" style={{ width: 'auto', flex: 'none' }} onClick={() => actions.markTaken(b.id)}>Taken now</button>
              </div>
            );
          })}
        </section>
      )}

      <div className="wide-2" style={{ gridTemplateColumns: wide ? '1.1fr 1fr' : undefined }}>
        <section className="card panel" aria-label="Today's doses">
          <div className="panel-head"><h2>Doses by bottle</h2><span className="eyebrow">{String(start).padStart(2, '0')}:00–{String(end).padStart(2, '0')}:00</span></div>
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

        <section className="card panel" aria-label="Doses by hour, last 7 days">
          <div className="panel-head"><h2>Doses by hour</h2><span className="eyebrow">7 days</span></div>
          <Heatmap label="Doses by hour, last 7 days" rows={7} cols={HOURS.length} rowWidth={58} cellHeight={20}
            rowLabels={week.map(dayName)} colLabels={HOURS.map((x) => (x % 3 ? '' : pad2(x)))}
            value={hourHeat}
            cellText={(d, c) => { const v = hourHeat(d, c); const hr = HOURS[c]; return `${dayName(week[d])} ${pad2(hr)}:00 · ${v === null ? 'later' : v >= 3 ? `${inHour(d, hr)} taken` : v === 1 ? `missed ${remindAt(hr).map((b) => b.drug).join(', ')}` : 'nothing planned'}`; }}
            legend={[{ v: 3, label: 'taken' }, { v: 4, label: '2+' }, { v: 1, label: 'missed' }, { v: 0, label: 'none planned' }, { v: null, label: 'later' }]} />
          <ul className="stack streaks" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
            {mine.map((b, r) => (
              <li key={b.id} style={{ '--mi': medColor(b.drug), '--i': r } as React.CSSProperties}>
                <span className="row" style={{ gap: 8 }}><MedIcon drug={b.drug} size={22} still /><b style={{ textTransform: 'capitalize' }}>{b.drug}</b><span className="muted" style={{ fontSize: '.9rem' }}>{b.reminder ? <>{taken14(r)} of the last 14 days</> : <>{taken14(r)} doses in 14 days, as needed</>}</span></span>
                <span className="streak-bar"><span style={{ width: `${(taken14(r) / 14) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
