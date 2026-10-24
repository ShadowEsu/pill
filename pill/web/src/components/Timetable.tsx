// Timetable: blocks placed by time of day, coloured by kind, with an ink dashed "now" line.
// Vertical (default): hours down the left, lanes across. `horizontal`: hours across, lanes down (desktop).
// Overlapping blocks in a lane share the space (greedy columns), so a busy 10:00 stays readable.
import { Link } from 'react-router-dom';
import type { Activity } from '../lib/types';
import { hm, hourOf, refTo } from '../lib/when';
import './viz.css';

export type TKind = 'run' | 'delivery' | 'release' | 'dose' | 'planned' | 'missed' | 'hold' | 'ask' | 'calibration';
export interface TItem { at: number; dur?: number; label: string; sub?: string; kind: TKind; ref?: Activity['ref']; to?: string; lane?: number }

interface Placed { it: TItem; s: number; e: number; col: number; cols: number }

/** Greedy column packing in hour units; `minSpan` is the smallest visual extent a block takes. */
function pack(items: TItem[], minSpan: number): Placed[] {
  const sorted = items.map((it) => { const s = hourOf(it.at); return { it, s, e: s + Math.max((it.dur ?? 10) / 60, minSpan), col: 0, cols: 1 }; }).sort((a, b) => a.s - b.s);
  let cluster: Placed[] = [], ends: number[] = [], clusterEnd = -Infinity;
  const flush = () => { cluster.forEach((p) => { p.cols = ends.length; }); cluster = []; ends = []; };
  for (const p of sorted) {
    if (p.s >= clusterEnd) flush();
    let col = ends.findIndex((e) => e <= p.s);
    if (col < 0) { col = ends.length; ends.push(p.e); } else ends[col] = p.e;
    p.col = col; cluster.push(p); clusterEnd = Math.max(clusterEnd, p.e);
  }
  flush();
  return sorted;
}

function Block({ p, style }: { p: Placed; style: React.CSSProperties }) {
  const to = p.it.to ?? refTo(p.it.ref);
  const title = `${hm(p.it.at)} · ${p.it.label}${p.it.sub ? ' · ' + p.it.sub : ''}`;
  const body = <><b>{p.it.label}</b>{p.it.sub && <span>{p.it.sub}</span>}</>;
  const cls = 'tt-block k-' + p.it.kind;
  return to ? <Link to={to} className={cls} style={style} title={title} aria-label={title}>{body}</Link> : <div className={cls} style={style} title={title}>{body}</div>;
}

export default function Timetable({ items, start, end, nowLine = false, horizontal = false, lanes, hourPx = 40, rowPx = 34, minSpan, label, now }: {
  items: TItem[]; start: number; end: number; nowLine?: boolean; horizontal?: boolean;
  lanes?: string[]; hourPx?: number; rowPx?: number; label: string; now: number;
  /** smallest block extent in hours (horizontal default 0.9; vertical = 28 px) */ minSpan?: number;
}) {
  const span = end - start;
  const laneNames = lanes ?? [''];
  const hours = Array.from({ length: span + 1 }, (_, i) => start + i);
  const step = horizontal ? (span > 12 ? 2 : 1) : hourPx < 28 ? 2 : 1;
  const nowH = hourOf(now);
  const showNow = nowLine && nowH >= start && nowH <= end;
  const byLane = laneNames.map((_, li) => pack(items.filter((it) => (it.lane ?? 0) === li && hourOf(it.at) >= start && hourOf(it.at) < end), minSpan ?? (horizontal ? 0.9 : 28 / hourPx)));

  if (horizontal) {
    const pct = (h: number) => `${((h - start) / span) * 100}%`;
    const laneRows = byLane.map((ps) => Math.max(1, ...ps.map((p) => p.cols)));
    return (
      <div className="tt h" role="group" aria-label={label} style={{ gridTemplateColumns: lanes ? '120px 1fr' : '1fr', rowGap: 0 }}>
        {lanes && <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {laneNames.map((n, i) => <div key={n + i} className="tt-lane-head" style={{ height: laneRows[i] * rowPx + 6 }} title={n}>{n}</div>)}
        </div>}
        <div style={{ position: 'relative', paddingTop: 22, paddingBottom: showNow ? 20 : 0, marginRight: 8 }}>
          {hours.map((h) => <span key={h} className="tt-line" style={{ left: pct(h), top: 18 }} />)}
          {hours.filter((h) => (h - start) % step === 0).map((h) => <span key={'l' + h} className="tt-hour" style={{ left: pct(h) }}>{String(h).padStart(2, '0')}</span>)}
          <div className="tt-lanes">
            {byLane.map((ps, li) => (
              <div key={li} className="tt-lane" style={{ height: laneRows[li] * rowPx + 6 }}>
                {ps.map((p, i) => <Block key={i} p={p} style={{ left: pct(Math.min(p.s, end - (p.e - p.s))), width: `calc(${((p.e - p.s) / span) * 100}% - 2px)`, top: 3 + p.col * rowPx, height: rowPx - 4, animationDelay: `${i * 40}ms` }} />)}
              </div>
            ))}
          </div>
          {showNow && <div className="tt-now" style={{ left: pct(nowH), top: 18 }}><span className="tt-now-label">{hm(now)}</span></div>}
        </div>
      </div>
    );
  }

  const height = span * hourPx;
  const px = (h: number) => (h - start) * hourPx;
  return (
    <div className="tt" role="group" aria-label={label} style={{ gridTemplateColumns: '44px 1fr' }}>
      {lanes && <><span /><div className="tt-lanes" style={{ gridTemplateColumns: `repeat(${laneNames.length}, minmax(0, 1fr))` }}>{laneNames.map((n, i) => <div key={n + i} className="tt-lane-head">{n}</div>)}</div></>}
      <div className="tt-axis" style={{ height }}>
        {hours.filter((h) => (h - start) % step === 0).map((h) => <span key={h} className="tt-hour" style={{ top: px(h) }}>{String(h).padStart(2, '0')}:00</span>)}
      </div>
      <div style={{ position: 'relative', height }}>
        {hours.map((h) => <span key={h} className="tt-line" style={{ top: px(h) }} />)}
        <div className="tt-lanes" style={{ gridTemplateColumns: `repeat(${laneNames.length}, minmax(0, 1fr))`, height: '100%' }}>
          {byLane.map((ps, li) => (
            <div key={li} className="tt-lane">
              {ps.map((p, i) => <Block key={i} p={p} style={{ top: px(Math.min(p.s, end - (p.e - p.s))), height: Math.max(2, (p.e - p.s) * hourPx - 2), left: `calc(${(p.col / p.cols) * 100}% + 3px)`, width: `calc(${100 / p.cols}% - 6px)`, animationDelay: `${i * 40}ms` }} />)}
            </div>
          ))}
        </div>
        {showNow && <div className="tt-now" style={{ top: px(nowH) }}><span className="tt-now-label">{hm(now)}</span></div>}
      </div>
    </div>
  );
}
