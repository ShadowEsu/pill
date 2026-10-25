// Personal schedule, built to be read from arm's length: one big row per medicine with its time, one "I took it" tap
// per dose (logged to the dose log), "Remind me" (a browser notification at that time every day while Pill is open in a
// tab) and the Google Calendar event (pill-pay → the connected Google account; its status chip at the top). Then the day
// as a strip with a sliding now-line, the next three doses counting down to the second, today's timetable
// (taken / planned / missed), a week of doses by hour as a heat map, and 14-day streaks.
import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Timetable from '../components/Timetable';
import Heatmap, { type Heat } from '../components/Heatmap';
import MedIcon, { medColor } from '../components/MedIcon';
import Glyph from '../components/Glyph';
import CalendarButton, { CalendarChip, useCalendarStatus } from '../components/CalendarButton';
import ReadAloud from '../components/ReadAloud';
import { actions, useStore } from '../lib/store';
import { doseItems, myBottles, takenToday } from '../lib/doses';
import { setReminder, useReminders } from '../lib/reminders';
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

/** One big row per medicine, earliest time first; as-needed medicines last. */
function DoseRows({ bottles, now }: { bottles: Bottle[]; now: number }) {
  const cal = useCalendarStatus();
  const rem = useReminders();
  const easy = useStore((s) => s.easy);
  const [asked, setAsked] = useState<string | null>(null);
  const rows = [...bottles].sort((a, b) => (a.reminder ?? '99:99').localeCompare(b.reminder ?? '99:99'));
  const d = new Date(now);
  const today = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;   // local date for the calendar event
  const blocked = rem.permission === 'denied' || rem.permission === 'unsupported';
  return (
    <section className="stack" style={{ gap: 12 }} aria-label="My doses today" data-dose-rows>
      <div className="panel-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 className="serif" style={{ fontWeight: 400, fontSize: '1.9rem' }}>My doses today</h2>
        <CalendarChip cal={cal} />
      </div>
      {rows.length === 0 && <p className="card" style={{ padding: 20, fontSize: 20 }}>No medicines yet. Add one from <Link to="/medicines">My medicines</Link>.</p>}
      <ul className="dose-rows">
        {rows.map((b) => {
          const taken = takenToday(b, now);
          const at = b.reminder ? atClock(b.reminder, now) : null;
          const doneToday = !!b.reminder && taken.length > 0;
          const late = at != null && !doneToday && now > at;
          const ringing = rem.on.includes(b.id);
          const status = doneToday ? `Taken today at ${hm(taken[0])}`
            : at == null ? (taken.length ? `As needed · last taken ${hm(taken[0])}` : 'As needed')
            : late ? `Not taken yet · due at ${b.reminder}`
            : `Due at ${b.reminder}`;
          return (
            <li key={b.id} className={'card dose-row' + (doneToday ? ' taken' : '') + (late ? ' late' : '')} data-dose-row={b.id}>
              <div className="dose-row-head">
                <MedIcon drug={b.drug} size={52} still />
                <div style={{ minWidth: 0 }}>
                  <p className="dose-row-name">{b.drug} <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>{b.strength}</span></p>
                  <p className="dose-row-sub">{b.usedFor}</p>
                </div>
                <span className="dose-row-time" aria-label={b.reminder ? `at ${b.reminder}` : 'as needed'}>{b.reminder ?? '—'}</span>
              </div>
              <p className="dose-row-status row" role="status" style={{ gap: 10 }}>
                <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none', background: doneToday ? 'var(--mint)' : late ? 'var(--amber)' : 'var(--grey)' }} />
                {status}
              </p>
              <div className="dose-row-actions">
                {doneToday
                  ? <span className="chip ok" style={{ justifyContent: 'center', minHeight: 64, fontSize: 18 }}><span className="dot" />Taken at {hm(taken[0])}</span>
                  : <button type="button" className="btn mint" onClick={() => actions.markTaken(b.id)} data-action="took-it">I took it</button>}
                <button type="button" className={'btn ' + (ringing ? 'sky' : 'ghost')} aria-pressed={ringing} disabled={!b.reminder || (blocked && !ringing)} data-action="remind"
                  onClick={async () => { const p = await setReminder(b.id, !ringing); setAsked(p); }}>
                  {ringing ? 'Reminder on' : 'Remind me'}
                </button>
              </div>
              {b.reminder
                ? <CalendarButton compact summary={`Take ${b.drug} ${b.strength}`} description={`Lot ${b.lot}. ${b.usedFor}`} start={`${today}T${b.reminder}:00`} minutes={10} recurrenceDaily label="Add to Google Calendar, every day" />
                : <p className="footnote">Set a time in <Link to="/medicines">My medicines</Link> to get reminders.</p>}
              {easy && <ReadAloud text={`${b.drug} ${b.strength}. ${status}.`} size={56} />}
            </li>
          );
        })}
      </ul>
      <p className="footnote" role="note" style={{ fontSize: 16 }}>
        Remind me pops up a notification on this device at the dose time, every day, while Pill is open in a browser tab. Close the tab and it stays quiet; the Google Calendar event reminds you either way.
        {rem.permission === 'denied' && ' Notifications are blocked for Pill in this browser; allow them in the site settings to use Remind me.'}
        {rem.permission === 'unsupported' && ' This browser has no notifications; use Google Calendar instead.'}
        {asked === 'default' && ' The browser did not answer the notification question; tap Remind me again.'}
      </p>
    </section>
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
  const all = myBottles(bottles, deliveries);
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
      <DoseRows bottles={all} now={now} />

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
