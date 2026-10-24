// One KPI tile: accent bar on top, a mono value that counts up (useCountUp), a trend arrow that draws itself in next to
// its delta, and a sparkline that wipes in.
import { useCountUp } from '../lib/count';
import Sparkline from './Sparkline';
import './viz.css';

const ARROW = {
  up: 'M7 12V2.5M2.8 6.6L7 2.4l4.2 4.2',
  down: 'M7 2v9.5M2.8 7.4L7 11.6l4.2-4.2',
  flat: 'M1.5 7h10M7.6 2.8L11.8 7l-4.2 4.2',
} as const;

export default function Kpi({ label, value, prefix = '', unit, trend, delta, series, accent, tag, goodWhen = 'up', warnOnBad = false }: {
  label: string; value: number; prefix?: string; unit?: string;
  /** signed change; sign picks the arrow */ trend?: number;
  /** delta text, e.g. "+3 vs prior 3 days" */ delta?: string;
  series?: number[]; accent: string; tag?: string;
  /** which direction is good news (held money going up is not) */ goodWhen?: 'up' | 'down';
  /** bad news in warm red; only for held money (red is reserved for recall / held), otherwise muted */ warnOnBad?: boolean;
}) {
  const fmt = (n: number) => prefix + Math.round(n).toLocaleString('en-US');
  const shown = useCountUp(value, 1100);

  const dir = trend === undefined || trend === 0 ? 'flat' : trend > 0 ? 'up' : 'down';
  const good = dir === 'flat' ? 'flat' : dir === goodWhen ? 'up' : warnOnBad ? 'down' : 'flat';
  return (
    <section className="card tile kpi rise" style={{ ['--tile-accent' as string]: accent }} aria-label={`${label}: ${fmt(value)}${unit ? ' ' + unit : ''}`}>
      {tag && <span className="kpi-tag">{tag}</span>}
      <p className="kpi-label">{label}</p>
      <p className="kpi-value"><span data-kpi-value={value}>{fmt(shown)}</span>{unit && <span className="kpi-unit">{unit}</span>}</p>
      {(trend !== undefined || delta) && (
        <p className={'kpi-trend trend-' + good}>
          <svg className={'arrow ' + dir} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d={ARROW[dir]} pathLength={1} /></svg>
          <span className="note">{delta}</span>
        </p>
      )}
      {series && series.length > 1 && <div style={{ marginTop: 4 }}><Sparkline values={series} color={accent} width={160} height={26} fluid /></div>}
    </section>
  );
}
