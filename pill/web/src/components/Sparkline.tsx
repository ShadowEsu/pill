// A tiny line: 1.5 px stroke, soft area under it, a dot on the last point. Optional faint band (the reference band on run curves).
// `fluid` stretches to the container width; strokes and the dot keep their size (non-scaling stroke, dot = round cap).
// Motion: the line wipes in left to right (clip), the area fades up, the end dot pops and keeps a soft halo. Reduced motion: still.
import { useId } from 'react';
import './viz.css';

export default function Sparkline({ values, color = 'var(--sky)', width = 120, height = 28, band, domain, label, fluid = false }: {
  values: number[]; color?: string; width?: number; height?: number;
  band?: [number, number]; domain?: [number, number]; label?: string; fluid?: boolean;
}) {
  const gid = 'spk' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = domain?.[0] ?? Math.min(...values), hi = domain?.[1] ?? Math.max(...values);
  const span = hi - lo || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((Math.min(hi, Math.max(lo, v)) - lo) / span) * (height - pad * 2);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;
  const last = values.length - 1;
  return (
    <svg width={fluid ? '100%' : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={fluid ? 'none' : undefined} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {band && <rect x={0} width={width} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} style={{ fill: color, opacity: 0.22 }} rx={2} />}
      <path className="spk-area" d={area} fill={`url(#${gid})`} stroke="none" />
      <path className="spk-line" d={line} style={{ fill: 'none', stroke: color }} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path className="spk-halo" d={`M${x(last).toFixed(1)} ${y(values[last]).toFixed(1)} l0 0`} style={{ stroke: color }} strokeWidth={12} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path className="spk-dot" d={`M${x(last).toFixed(1)} ${y(values[last]).toFixed(1)} l0 0`} style={{ stroke: color }} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
