// Semicircle gauge, 0–120 % of the reference plateau. The band (what passes) is the sky-tinted arc. On mount the value
// arc sweeps from 0 while the needle swings and the reading counts up; on arrival a soft ring ticks out at the tip.
import { useEffect, useState } from 'react';
import type { Verdict } from '../lib/types';
import { useCountUp } from '../lib/count';
import { VERDICT_FILL } from './PillFill';
import './viz.css';

const MAX = 120, CX = 110, CY = 112, R = 84;
const polar = (v: number, r: number) => {
  const a = Math.PI - (Math.max(0, Math.min(MAX, v)) / MAX) * Math.PI;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arc = (from: number, to: number, r: number) => {
  const a = polar(from, r), b = polar(to, r);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
};

export default function Gauge({ pct, low = 87, high = 113, verdict = null, width = 220, empty = 'no reference' }: {
  pct: number | null; low?: number; high?: number; verdict?: Verdict | null; width?: number;
  /** Shown in place of the reading when pct is null. */ empty?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const v = pct ?? 0;
  const deg = on ? (Math.max(0, Math.min(MAX, v)) / MAX) * 180 : 0;
  const counted = useCountUp(on ? v : 0, 900);
  const shown = on && Math.abs(counted - v) < 0.01 ? pct : Math.round(counted);
  const tipAt = polar(v, R - 14);
  const colour = verdict ? VERDICT_FILL[verdict] : 'var(--sky)';
  const mono = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--muted)' } as const;
  return (
    <svg viewBox="0 0 220 136" style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto' }} role="img"
      aria-label={pct == null ? 'No reading against a reference' : `${pct} percent of the reference plateau; band ${low} to ${high} percent`}>
      <path d={arc(0, MAX, R)} fill="none" stroke="rgba(22,24,27,.06)" strokeWidth="16" strokeLinecap="butt" />
      <path d={arc(low, high, R)} fill="none" stroke="var(--sky-tint)" strokeWidth="16" />
      <path d={arc(low, high, R + 8)} fill="none" stroke="var(--sky)" strokeWidth="1" strokeDasharray="2 3" />
      <path d={arc(low, high, R - 8)} fill="none" stroke="var(--sky)" strokeWidth="1" strokeDasharray="2 3" />
      {pct != null && <path d={arc(0, Math.max(0.5, Math.min(MAX, v)), R - 14)} fill="none" stroke={colour} strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: on ? 0 : 1, transition: 'stroke-dashoffset .9s var(--ease)' }} />}
      {[0, 30, 60, 90, 120].map((t) => {
        const a = polar(t, R + 10), b = polar(t, R + 14), l = t === 60 ? polar(t, R + 21) : { x: polar(t, R).x, y: CY + 12 };
        return (
          <g key={t}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-2)" strokeWidth="1" opacity="0.6" />
            {(t === 0 || t === 60 || t === 120) && <text x={l.x} y={l.y + 3.5} textAnchor="middle" style={mono}>{t}</text>}
          </g>
        );
      })}
      {[low, high].map((t) => {
        const l = polar(t, R - 26);
        return <text key={t} x={l.x} y={l.y + 3.5} textAnchor="middle" style={{ ...mono, fill: 'var(--sky-ink)' }}>{t}</text>;
      })}
      {pct != null && (
        <g style={{ transform: `rotate(${deg}deg)`, transformBox: 'view-box', transformOrigin: `${CX}px ${CY}px`, transition: 'transform .9s var(--ease)' }}>
          <line x1={CX} y1={CY} x2={CX - R + 4} y2={CY} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {pct != null && on && <circle className="gauge-tick" cx={tipAt.x} cy={tipAt.y} r="5" fill="none" stroke={colour} strokeWidth="2" />}
      {pct != null && on && <circle className="gauge-dot" cx={tipAt.x} cy={tipAt.y} r="3.5" fill={colour} stroke="var(--surface)" strokeWidth="1.5" />}
      <circle cx={CX} cy={CY} r="6" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
      <text x={CX} y={CY + 22} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 12, fill: 'var(--ink)' }}>{pct == null ? empty : `${shown} % · band ${low}–${high}`}</text>
    </svg>
  );
}
