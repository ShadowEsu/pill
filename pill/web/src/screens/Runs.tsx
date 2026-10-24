// Every run, newest first: verdict, lot, % of reference, the inline curve against its band, time, source. Filter by verdict.
// Above the list: the data path (station → rules → why → policy) and a runs-per-hour heat map.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen, SrcBadge } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import Sparkline from '../components/Sparkline';
import Heatmap, { type Heat } from '../components/Heatmap';
import FlowArrows from '../components/FlowArrows';
import { useStore } from '../lib/store';
import { curve } from '../lib/rules';
import { REFERENCES } from '../data/reference';
import { PEOPLE } from '../data/history';
import type { Run, Verdict } from '../lib/types';
import { DAY, dayStart, hm, hourOf, useNow } from '../lib/when';
import '../components/viz.css';

type Filter = 'all' | Verdict;
const FILTERS: { k: Filter; label: string; cls: string }[] = [
  { k: 'all', label: 'All', cls: '' },
  { k: 'PASS', label: 'PASS', cls: 'ok' },
  { k: 'NEEDS LAB', label: 'NEEDS LAB', cls: 'warn' },
  { k: 'UNABLE TO VERIFY', label: 'UNABLE', cls: '' },
];
const H0 = 6, H1 = 20;

/** The band a run was judged against: its drug's, else riboflavin's (chalk lots are screened against it), none for U1. */
const bandOf = (r: Run) => (r.evaluation?.rule === 'U1' ? null : REFERENCES[r.drug] ?? REFERENCES.riboflavin);

export default function Runs() {
  const runs = useStore((s) => s.runs);
  const acts = useStore((s) => s.activities);
  const deliveries = useStore((s) => s.deliveries);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const sorted = [...runs].sort((a, b) => b.startedAt - a.startedAt);
  const shown = filter === 'all' ? sorted : sorted.filter((r) => r.evaluation?.verdict === filter);
  const count = (f: Filter) => (f === 'all' ? runs.length : runs.filter((r) => r.evaluation?.verdict === f).length);

  const days = Array.from({ length: 7 }, (_, i) => dayStart(now) - (6 - i) * DAY);
  const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
  const perCell = (r: number, c: number) => runs.filter((x) => x.startedAt >= days[r] && x.startedAt < days[r] + DAY && Math.floor(hourOf(x.startedAt)) === hours[c]).length;
  const heat = (r: number, c: number): Heat => {
    if (days[r] + hours[c] * 3600e3 > now) return null;
    const n = perCell(r, c);
    return n === 0 ? 0 : n === 1 ? 3 : 4;
  };
  const dayName = (t: number) => (t === dayStart(now) ? 'Today' : new Date(t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));

  const evaluated = runs.filter((r) => r.evaluation).length;
  const whys = acts.filter((a) => a.actor === PEOPLE.claude).length;
  const proposals = deliveries.filter((d) => d.clause).length;
  const running = runs.some((r) => !r.evaluation && now - r.startedAt < 10 * 60e3);

  return (
    <Screen title="Runs" eyebrow={`${runs.length} runs · ${evaluated} with a verdict`}>
      <Link to="/run/new?replay=B2-07" className="btn cta-fit" style={{ textDecoration: 'none' }}>New run (replay B2-07) <span className="pointer" style={{ color: 'inherit' }}>→</span></Link>

      <section className="card panel" aria-label="Data path">
        <div className="panel-head"><h2>Data path</h2><span className="eyebrow">sensor → verdict → policy</span></div>
        <FlowArrows label="Data path"
          nodes={[
            { id: 'station', label: 'Station 01', value: String(runs.length), sub: 'runs · 1 sample / s', accent: 'var(--c1)' },
            { id: 'rules', label: 'Seven rules', value: String(evaluated), sub: 'verdicts · no model', accent: 'var(--c2)' },
            { id: 'claude', label: 'Claude', value: String(whys), sub: 'whys · filtered', accent: 'var(--c4)' },
            { id: 'policy', label: 'Policy agent', value: String(proposals), sub: 'proposals · P1–P6', accent: 'var(--c3)' },
          ]}
          edges={[
            { from: 'station', to: 'rules', label: 'curve', live: running },
            { from: 'rules', to: 'claude', label: 'verdict' },
            { from: 'claude', to: 'policy', label: 'why' },
          ]} />
      </section>

      <section className="card panel decor-dots" aria-label="Runs per hour and day">
        <div className="panel-head"><h2>Runs per hour × day</h2><span className="eyebrow">06:00–20:00</span></div>
        <Heatmap label="Runs per hour and day" rows={7} cols={hours.length} rowWidth={58} cellHeight={18}
          rowLabels={days.map(dayName)} colLabels={hours.map((h) => (h % 2 ? '' : String(h).padStart(2, '0')))}
          value={heat}
          cellText={(r, c) => { const n = perCell(r, c); return `${dayName(days[r])} ${String(hours[c]).padStart(2, '0')}:00 · ${heat(r, c) === null ? 'later today' : `${n} run${n === 1 ? '' : 's'}`}`; }}
          legend={[{ v: 0, label: '0 runs' }, { v: 3, label: '1' }, { v: 4, label: '2+' }, { v: null, label: 'not yet' }]} />
      </section>

      <div className="filters" role="group" aria-label="Filter by verdict">
        {FILTERS.map((f) => (
          <button key={f.k} type="button" className={'chip ' + f.cls} aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>
            {f.k !== 'all' && <span className="dot" />}{f.label} <span style={{ opacity: .6 }}>{count(f.k)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? <p className="card muted">No runs with this verdict.</p> : (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
          {shown.map((r, i) => {
            const band = bandOf(r);
            const pts = curve(r.samples).filter((_, j) => j % 6 === 0).map((p) => p.a);
            const ev = r.evaluation;
            const when = (dayStart(r.startedAt) === dayStart(now) ? 'Today' : new Date(r.startedAt).toLocaleDateString('en-US', { weekday: 'short' })) + ' ' + hm(r.startedAt);
            return (
              <li key={r.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link to={ev ? `/evaluation/${r.id}` : `/run/${r.id}`} className="card run-row" aria-label={`Run ${r.id}, lot ${r.lot}, ${ev?.verdict ?? 'running'}`}>
                  <span className="c-chip">{ev ? <VerdictChip verdict={ev.verdict} /> : <span className="chip live"><span className="dot" />running</span>}<span className="c-pct-inline mono" style={{ fontSize: 12 }}>{ev?.pct ? `${ev.pct} %` : ''}</span><span className="c-pct-inline"><SrcBadge src={r.src} /></span></span>
                  <span className="c-main" style={{ minWidth: 0 }}>
                    <span className="lot mono" style={{ display: 'block' }}>{r.lot} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{r.id}</span></span>
                    <span className="drug" style={{ display: 'block', textTransform: 'capitalize' }}>{r.drug}{ev ? ` · rule ${ev.rule}` : ''}</span>
                  </span>
                  <span className="c-pct mono" style={{ fontSize: 13 }} title="Plateau as % of the reference band mean">{ev?.pct ? <>{ev.pct}<span className="muted"> %</span></> : '—'}</span>
                  <span className="c-spark"><Sparkline values={pts} width={60} height={24} color="var(--sky)" domain={[0, 0.6]} band={band ? [band.bandLow, band.bandHigh] : undefined} label={`Inline curve for ${r.id}`} /></span>
                  <span className="c-time mono muted" style={{ fontSize: 12 }}>{when}</span>
                  <span className="c-src"><SrcBadge src={r.src} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="footnote">Screening result, not a pharmacopeial test. The faint band on each curve is the reference band it was judged against.</p>
    </Screen>
  );
}
