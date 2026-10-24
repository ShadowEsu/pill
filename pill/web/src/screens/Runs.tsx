// Every run, newest first: a little capsule filled to its % of reference, the verdict, lot, the inline curve against its band,
// time, source. Filter by verdict (the ink pill slides between chips). Phone: swipe a row left for Share / Open.
// Above the list: the data path (station → rules → why → policy) and a runs-per-hour heat map. New runs slide in at the top.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen, SrcBadge } from '../components/Shell';
import VerdictChip from '../components/VerdictChip';
import Sparkline from '../components/Sparkline';
import PillFill from '../components/PillFill';
import Heatmap, { type Heat } from '../components/Heatmap';
import FlowArrows from '../components/FlowArrows';
import Glyph from '../components/Glyph';
import { ShareSheet } from '../components/ShareCard';
import { useStore } from '../lib/store';
import { curve } from '../lib/rules';
import { REFERENCES } from '../data/reference';
import { PEOPLE } from '../data/history';
import type { Run, Verdict } from '../lib/types';
import { DAY, dayStart, hm, hourOf, useNow } from '../lib/when';
import '../components/viz.css';
import '../story.css';

type Filter = 'all' | Verdict;
const FILTERS: { k: Filter; label: string; cls: string }[] = [
  { k: 'all', label: 'All', cls: '' },
  { k: 'PASS', label: 'PASS', cls: 'ok' },
  { k: 'NEEDS LAB', label: 'NEEDS LAB', cls: 'warn' },
  { k: 'UNABLE TO VERIFY', label: 'UNABLE', cls: '' },
];
const H0 = 6, H1 = 20;
const OPEN_PX = 132;

/** The band a run was judged against: its drug's, else riboflavin's (chalk lots are screened against it), none for U1. */
const bandOf = (r: Run) => (r.evaluation?.rule === 'U1' ? null : REFERENCES[r.drug] ?? REFERENCES.riboflavin);

/** The ⋯ menu on a run row: Share (runs with a verdict) and Open. Escape or a tap outside closes it. */
function RowMenu({ run, onShare }: { run: Run; onShare: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!(e.target instanceof Node && box.current?.contains(e.target))) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box}>
      <button type="button" className="run-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`More for run ${run.id}`} onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div className="run-menu" role="menu" aria-label={`Run ${run.id}`}>
          {run.evaluation && <button type="button" role="menuitem" onClick={() => { setOpen(false); onShare(); }}>Share</button>}
          <Link role="menuitem" to={run.evaluation ? `/evaluation/${run.id}` : `/run/${run.id}`}>Open</Link>
        </div>
      )}
    </div>
  );
}

/** Horizontal drag on touch: the card follows the finger and snaps open (actions behind it) or shut. A drag never counts as a tap. */
function useSwipe() {
  const [x, setX] = useState(0);
  const drag = useRef<{ x0: number; y0: number; base: number; moved: boolean; axis: 'x' | 'y' | null } | null>(null);
  const suppress = useRef(false);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') return; drag.current = { x0: e.clientX, y0: e.clientY, base: x, moved: false, axis: null }; },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis !== 'x') return;
      d.moved = true;
      setX(Math.max(-OPEN_PX - 24, Math.min(0, d.base + dx)));
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      suppress.current = true;   // the click that may follow this drag; expires so a later tap still opens the run
      window.setTimeout(() => { suppress.current = false; }, 400);
      setX((v) => (v < -OPEN_PX / 2 ? -OPEN_PX : 0));
    },
    onPointerCancel: () => { drag.current = null; setX((v) => (v < -OPEN_PX / 2 ? -OPEN_PX : 0)); },
    // a drag is never a tap; a tap on a swiped-open card shuts it instead of opening the run
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppress.current && x === 0) return;
      e.preventDefault(); e.stopPropagation();
      if (suppress.current) suppress.current = false; else setX(0);
    },
  };
  return { x, close: () => setX(0), handlers };
}

function RunRow({ r, now, fresh, i, onShare }: { r: Run; now: number; fresh: boolean; i: number; onShare: () => void }) {
  const sw = useSwipe();
  const band = bandOf(r);
  const pts = curve(r.samples).filter((_, j) => j % 6 === 0).map((p) => p.a);
  const ev = r.evaluation;
  const to = ev ? `/evaluation/${r.id}` : `/run/${r.id}`;
  const when = (dayStart(r.startedAt) === dayStart(now) ? 'Today' : new Date(r.startedAt).toLocaleDateString('en-US', { weekday: 'short' })) + ' ' + hm(r.startedAt);
  const pct = ev ? (ev.pct || 0) : Math.min(100, Math.round((r.samples.length / 180) * 100));
  return (
    <li className={'run-li rrow-li' + (fresh ? ' fresh' : '') + (sw.x ? ' swiped' : '')} style={{ '--i': Math.min(i, 10) } as React.CSSProperties}>
      <div className="rrow-actions" aria-hidden={sw.x === 0}>
        {ev && <button type="button" tabIndex={sw.x ? 0 : -1} onClick={() => { sw.close(); onShare(); }}>Share</button>}
        <Link to={to} tabIndex={sw.x ? 0 : -1}>Open</Link>
      </div>
      <Link to={to} className="card rrow" aria-label={`Run ${r.id}, lot ${r.lot}, ${ev?.verdict ?? 'running'}`}
        style={{ transform: sw.x ? `translateX(${sw.x}px)` : undefined }} {...sw.handlers}>
        <span className="rrow-pill" aria-hidden="true"><PillFill pct={pct} verdict={ev?.verdict ?? null} fault={!!ev && ev.verdict === 'UNABLE TO VERIFY' && !ev.pct} size={52} label={false} ring={false} grid={false} running={!ev} /></span>
        <span className="rrow-main">
          <span className="lot mono">{r.lot} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{r.id}</span></span>
          <span className="drug">{r.drug}{ev ? ` · rule ${ev.rule}` : ''}</span>
          <span className="rrow-chips">{ev ? <VerdictChip verdict={ev.verdict} /> : <span className="chip live"><span className="dot" />running</span>}<SrcBadge src={r.src} /></span>
        </span>
        <span className="rrow-pct num" title="Plateau as % of the reference band mean">{ev?.pct ? <>{ev.pct}<span className="muted"> %</span></> : '—'}</span>
        <span className="rrow-spark"><Sparkline values={pts} width={72} height={30} color="var(--sky)" domain={[0, 0.6]} band={band ? [band.bandLow, band.bandHigh] : undefined} label={`Inline curve for ${r.id}`} /></span>
        <span className="rrow-time mono muted">{when}</span>
      </Link>
      <RowMenu run={r} onShare={onShare} />
    </li>
  );
}

export default function Runs() {
  const runs = useStore((s) => s.runs);
  const acts = useStore((s) => s.activities);
  const deliveries = useStore((s) => s.deliveries);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const [sharing, setSharing] = useState<Run | null>(null);
  const [seen] = useState(() => new Set(runs.map((r) => r.id)));
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
    <Screen title="Runs" tone="sky" eyebrow={`${runs.length} runs · ${evaluated} with a verdict`} art={<span className="runs-art" aria-hidden="true"><Glyph name="cup" size={52} /><Glyph name="sensor" size={40} delay={200} /></span>}>
      <Link to="/run/new?replay=B2-07" className="btn cta-fit" style={{ textDecoration: 'none' }}>New run (replay B2-07) <span className="pointer" style={{ color: 'inherit' }}>→</span></Link>

      <div className="wide-2">
        <section className="card panel" aria-label="Data path">
          <div className="panel-head"><h2>Data path</h2><span className="eyebrow">sensor → verdict → policy</span></div>
          <FlowArrows label="Data path" token
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
      </div>

      <div className="filters slide-filters" role="group" aria-label="Filter by verdict">
        {FILTERS.map((f) => (
          <button key={f.k} type="button" className={'chip ' + f.cls} aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>
            {f.k !== 'all' && <span className="dot" />}{f.label} <span className="fcount">{count(f.k)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? <p className="card muted">No runs with this verdict.</p> : (
        <ul key={filter} className="rrows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((r, i) => <RunRow key={r.id} r={r} now={now} i={i} fresh={!seen.has(r.id)} onShare={() => setSharing(r)} />)}
        </ul>
      )}
      <p className="footnote">Screening result, not a pharmacopeial test. The capsule fills to the run's % of reference; the faint band on each curve is the band it was judged against. On a phone, swipe a run left for Share and Open.</p>
      {sharing && <ShareSheet run={sharing} onClose={() => setSharing(null)} />}
    </Screen>
  );
}
