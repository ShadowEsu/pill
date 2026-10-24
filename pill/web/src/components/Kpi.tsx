// One KPI tile: accent bar on top, a mono value that counts up on mount, a trend arrow with its delta, and a sparkline.
import { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import Sparkline from './Sparkline';
import './viz.css';

export default function Kpi({ label, value, prefix = '', unit, trend, delta, series, accent, tag, goodWhen = 'up', warnOnBad = false }: {
  label: string; value: number; prefix?: string; unit?: string;
  /** signed change; sign picks the arrow */ trend?: number;
  /** delta text, e.g. "+3 vs prior 3 days" */ delta?: string;
  series?: number[]; accent: string; tag?: string;
  /** which direction is good news (held money going up is not) */ goodWhen?: 'up' | 'down';
  /** bad news in warm red; only for held money (red is reserved for recall / held), otherwise muted */ warnOnBad?: boolean;
}) {
  const out = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => prefix + Math.round(n).toLocaleString('en-US');
  useEffect(() => {
    const el = out.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(value); return; }
    const o = { v: 0 };
    const a = animate(o, { v: value, duration: 1100, ease: 'outExpo', onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { el.textContent = fmt(value); } });
    return () => { a.cancel(); el.textContent = fmt(value); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefix]);

  const dir = trend === undefined || trend === 0 ? 'flat' : trend > 0 ? 'up' : 'down';
  const good = dir === 'flat' ? 'flat' : dir === goodWhen ? 'up' : warnOnBad ? 'down' : 'flat';
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return (
    <section className="card tile kpi rise" style={{ ['--tile-accent' as string]: accent }} aria-label={`${label}: ${fmt(value)}${unit ? ' ' + unit : ''}`}>
      {tag && <span className="kpi-tag">{tag}</span>}
      <p className="kpi-label">{label}</p>
      <p className="kpi-value"><span ref={out} data-kpi-value={value}>{fmt(value)}</span>{unit && <span className="kpi-unit">{unit}</span>}</p>
      {(trend !== undefined || delta) && (
        <p className={'kpi-trend trend-' + good}>
          <span className={'arrow ' + dir} aria-hidden="true">{arrow}</span>
          <span className="note">{delta}</span>
        </p>
      )}
      {series && series.length > 1 && <div style={{ marginTop: 4 }}><Sparkline values={series} color={accent} width={160} height={26} fluid /></div>}
    </section>
  );
}
