// The capsule that fills as the tablet dissolves. One rAF loop moves the level, the wave and the number; no React re-render per frame.
import { useEffect, useId, useRef } from 'react';
import type { Verdict } from '../lib/types';

export const VERDICT_FILL: Record<Verdict, string> = { PASS: 'var(--mint)', 'NEEDS LAB': 'var(--amber)', 'UNABLE TO VERIFY': 'var(--grey)' };

// Capsule geometry in a 140 × 300 box: a cap (top half, a hair wider) over a body (bottom half).
const TOP = 4, BOTTOM = 296;
const CAP = 'M12 152 V62 A58 58 0 0 1 128 62 V152 Z';
const BODY = 'M14 140 V240 A56 56 0 0 0 126 240 V140 Z';
const BODY_EDGE = 'M14 152 V240 A56 56 0 0 0 126 240 V152';
const AMP = 3;

function wave(level: number, amp: number, phase: number) {
  let d = `M0 ${level + amp * Math.sin(phase)}`;
  for (let x = 5; x <= 140; x += 5) d += ` L${x} ${(level + amp * Math.sin((x / 70) * 2 * Math.PI + phase)).toFixed(2)}`;
  return d + ' L140 300 L0 300 Z';
}

export default function PillFill({ pct, verdict = null, fault = false, size = 300, label = true, grid }: {
  pct: number; verdict?: Verdict | null; fault?: boolean; size?: number; label?: boolean; grid?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const front = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const num = useRef<SVGTSpanElement>(null);
  const shown = useRef<number | null>(null);
  const amp = useRef(0);
  const phase = useRef(0);
  const showGrid = grid ?? size >= 200;
  const target = Math.max(0, Math.min(100, pct));
  const settled = verdict != null || fault;
  const color = verdict ? VERDICT_FILL[verdict] : fault ? 'var(--grey)' : 'var(--sky)';

  useEffect(() => {
    const paint = () => {
      const v = shown.current ?? 0;
      const y = BOTTOM - (v / 100) * (BOTTOM - TOP);
      const visible = v > 0.2;
      front.current?.setAttribute('d', visible ? wave(y, amp.current, phase.current) : '');
      back.current?.setAttribute('d', visible ? wave(y - 2, amp.current, phase.current + Math.PI * 0.8) : '');
      if (num.current) num.current.textContent = String(Math.round(v));
    };
    const ampTarget = settled || target <= 0 || target >= 100 ? 0 : AMP;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { shown.current = target; amp.current = 0; paint(); return; }
    if (shown.current == null) shown.current = 0;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = shown.current ?? 0;
      shown.current = Math.abs(target - s) < 0.05 ? target : s + (target - s) * Math.min(1, dt * 5);
      amp.current += (ampTarget - amp.current) * Math.min(1, dt * 3);
      if (Math.abs(ampTarget - amp.current) < 0.02) amp.current = ampTarget;
      phase.current += dt * 2.4;
      paint();
      if (shown.current === target && amp.current === 0 && ampTarget === 0) return;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, settled]);

  const vb = showGrid ? '-30 -10 200 320' : '8 0 124 300';
  const [, , w, h] = vb.split(' ').map(Number);
  return (
    <svg viewBox={vb} width={(size * w) / h} height={size} role="img" aria-label={`${Math.round(target)} percent dissolved`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={`clip${id}`}><path d={CAP} /><path d={BODY} /></clipPath>
        {showGrid && <>
          <pattern id={`dots${id}`} width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="0.9" fill="rgba(22,24,27,.16)" /></pattern>
          <radialGradient id={`fade${id}`}><stop offset="0.35" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <mask id={`mask${id}`}><rect x="-30" y="-10" width="200" height="320" fill={`url(#fade${id})`} /></mask>
        </>}
      </defs>
      {showGrid && <rect x="-30" y="-10" width="200" height="320" fill={`url(#dots${id})`} mask={`url(#mask${id})`} />}
      <path d={BODY} fill="#fff" />
      <path d={CAP} fill="#fff" />
      <g clipPath={`url(#clip${id})`}>
        <path ref={back} style={{ fill: color, opacity: 0.35, transition: 'fill .5s var(--ease)' }} />
        <path ref={front} style={{ fill: color, opacity: 0.9, transition: 'fill .5s var(--ease)' }} />
        <rect x="24" y="44" width="7" height="200" rx="3.5" fill="#fff" opacity="0.45" />
        <path d="M30 70 A42 42 0 0 1 58 26" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      </g>
      <path d={BODY_EDGE} fill="none" stroke="var(--ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={CAP} fill="none" stroke="var(--ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {label && (
        <text x="70" y="214" textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }} fill="var(--ink)">
          <tspan ref={num} fontSize="40">{Math.round(target)}</tspan>
          <tspan fontSize="18" fill="var(--ink-2)" dx="2">%</tspan>
        </text>
      )}
    </svg>
  );
}
