// The capsule that fills as the tablet dissolves. One rAF loop moves the level, the liquid surface (two offset sine waves
// summed, with a bright meniscus line), the number, the ring gauge and the running effects (bubbles that rise faster as
// the fill climbs, light caustics, glass highlight, shimmer, dissolving particles, pulse rings); no React re-render per frame.
// Reduced motion: the loop never starts; the static end state is painted once and every effect node stays hidden.
import { useEffect, useId, useRef } from 'react';
import type { Verdict } from '../lib/types';

export const VERDICT_FILL: Record<Verdict, string> = { PASS: 'var(--mint)', 'NEEDS LAB': 'var(--amber)', 'UNABLE TO VERIFY': 'var(--grey)' };

// Capsule geometry in a 140 × 300 box: a cap (top half, a hair wider) over a body (bottom half).
const TOP = 4, BOTTOM = 296;
const CAP = 'M12 152 V62 A58 58 0 0 1 128 62 V152 Z';
const BODY = 'M14 140 V240 A56 56 0 0 0 126 240 V140 Z';
const BODY_EDGE = 'M14 152 V240 A56 56 0 0 0 126 240 V152';
const AMP = 3;
// Ring gauge around the capsule.
const CX = 70, CY = 150, RING_R = 158;
const TICKS = [25, 50, 75];
const PULSE_AT = [25, 50, 75, 100];
const N_BUBBLES = 9, N_PARTS = 6, N_PULSES = 3, N_CAUSTICS = 4;
const PULSE_MS = 1200;

interface Bubble { x: number; y: number; r: number; vy: number; ph: number; y0: number }
interface Part { x: number; y: number; vy: number; s: number; rot: number; vr: number; wait: number; melt: number }
interface Pulse { t0: number; color: string }

/** The liquid's top edge: two sines at different frequencies and speeds, so the surface never looks like one rigid wave. */
export function surface(level: number, amp: number, phase: number) {
  const yAt = (x: number) => level + amp * (0.65 * Math.sin((x / 70) * 2 * Math.PI + phase) + 0.35 * Math.sin((x / 70) * 4.6 * Math.PI - phase * 1.6 + 1));
  let d = `M0 ${yAt(0).toFixed(2)}`;
  for (let x = 5; x <= 140; x += 5) d += ` L${x} ${yAt(x).toFixed(2)}`;
  return d;
}
const wave = (level: number, amp: number, phase: number) => surface(level, amp, phase) + ' L140 300 L0 300 Z';
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Sky at 0 %, drifting toward a sky/mint blend near 100 %. */
function liquidColor(v: number) {
  const k = clamp01(v / 100) * 0.55;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgb(${mix(79, 95)}, ${mix(179, 211)}, ${mix(255, 154)})`;
}
const bottomAt = (x: number) => 240 + Math.sqrt(Math.max(0, 56 * 56 - (x - 70) ** 2));

export default function PillFill({ pct, verdict = null, fault = false, size = 300, label = true, grid, ring, running }: {
  pct: number; verdict?: Verdict | null; fault?: boolean; size?: number; label?: boolean; grid?: boolean;
  /** Ring gauge around the capsule (default on at ≥ 200 px). */ ring?: boolean;
  /** Running effects; default: on until a verdict or fault arrives. */ running?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const front = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const liq = useRef<SVGPathElement>(null);
  const num = useRef<SVGTSpanElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const head = useRef<SVGGElement>(null);
  const hl = useRef<SVGEllipseElement>(null);
  const shimmer = useRef<SVGRectElement>(null);
  const surf = useRef<SVGPathElement>(null);
  const causticsG = useRef<SVGGElement>(null);
  const bubblesG = useRef<SVGGElement>(null);
  const partsG = useRef<SVGGElement>(null);
  const pulsesG = useRef<SVGGElement>(null);
  const live = useRef({ shown: null as number | null, amp: 0, phase: 0, fx: 0, time: 0, bubbles: [] as Bubble[], parts: [] as Part[], pulses: [] as Pulse[], lastColor: null as string | null });

  const showGrid = grid ?? size >= 200;
  const showRing = ring ?? size >= 200;
  const target = Math.max(0, Math.min(100, pct));
  const settled = verdict != null || fault;
  const active = (running ?? true) && !settled;
  const color = verdict ? VERDICT_FILL[verdict] : fault ? 'var(--grey)' : null;

  useEffect(() => {
    const L = live.current;
    const ringColor = color ?? 'var(--sky)';
    const paint = (v: number) => {
      const y = BOTTOM - (v / 100) * (BOTTOM - TOP);
      const visible = v > 0.2;
      const d = visible ? wave(y, L.amp, L.phase) : '';
      front.current?.setAttribute('d', d);
      liq.current?.setAttribute('d', d || 'M0 0');
      back.current?.setAttribute('d', visible ? wave(y - 2, L.amp, L.phase + Math.PI * 0.8) : '');
      surf.current?.setAttribute('d', visible && v < 99.5 ? surface(y, L.amp, L.phase) : '');
      const cs = causticsG.current?.children;
      if (cs) for (let i = 0; i < cs.length; i++) {
        const el = cs[i] as SVGEllipseElement;
        const t = L.time * (0.5 + i * 0.13) + i * 1.7;
        const cy = y + 18 + ((i * 37 + 20) % Math.max(20, BOTTOM - y - 30));
        el.setAttribute('cx', (70 + 34 * Math.sin(t) * (i % 2 ? 1 : -1)).toFixed(1));
        el.setAttribute('cy', cy.toFixed(1));
        el.setAttribute('rx', (10 + 5 * Math.sin(t * 1.7)).toFixed(1));
        el.setAttribute('ry', (3 + 1.5 * Math.cos(t * 1.3)).toFixed(1));
        el.style.opacity = visible ? String(0.35 * L.fx * (0.6 + 0.4 * Math.sin(t * 2.1))) : '0';
      }
      const fill = color ?? liquidColor(v);
      for (const el of [front.current, back.current]) if (el) { el.style.fill = fill; el.style.transition = color ? 'fill .6s var(--ease)' : 'none'; }
      if (num.current) num.current.textContent = String(Math.round(v));
      if (arc.current) { arc.current.style.strokeDashoffset = String(100 - v); arc.current.style.stroke = ringColor; }
      if (head.current) head.current.setAttribute('transform', `rotate(${v * 3.6} ${CX} ${CY})`);
      if (head.current) head.current.style.opacity = visible ? '1' : '0';
      // glass highlight orbiting the capsule every 6 s
      if (hl.current) {
        const th = (L.time / 6) * Math.PI * 2;
        hl.current.setAttribute('cx', (CX + 34 * Math.cos(th)).toFixed(1));
        hl.current.setAttribute('cy', (CY + 96 * Math.sin(th)).toFixed(1));
        hl.current.style.opacity = String(0.85 * L.fx);
      }
      // shimmer sweep across the liquid every 3 s
      if (shimmer.current) {
        const c = L.time % 3;
        const sx = -70 + (c / 1.3) * 280;
        shimmer.current.setAttribute('transform', `translate(${sx.toFixed(1)} 0) skewX(-18)`);
        shimmer.current.style.opacity = c < 1.3 ? String(L.fx) : '0';
      }
      const bs = bubblesG.current?.children;
      if (bs) for (let i = 0; i < bs.length; i++) {
        const b = L.bubbles[i]; const el = bs[i] as SVGCircleElement;
        if (!b || L.fx === 0 || !visible) { el.style.opacity = '0'; continue; }
        el.setAttribute('cx', (b.x + 2 * Math.sin(L.time * 3 + b.ph)).toFixed(1));
        el.setAttribute('cy', b.y.toFixed(1));
        el.setAttribute('r', b.r.toFixed(1));
        el.style.opacity = String(0.8 * L.fx * clamp01((b.y - y) / 34) * clamp01((b.y0 - b.y) / 10));
      }
      const ps = partsG.current?.children;
      if (ps) for (let i = 0; i < ps.length; i++) {
        const p = L.parts[i]; const el = ps[i] as SVGRectElement;
        if (!p || L.fx === 0 || p.wait > 0) { el.style.opacity = '0'; continue; }
        el.setAttribute('x', (p.x - p.s / 2).toFixed(1));
        el.setAttribute('y', (p.y - p.s / 2).toFixed(1));
        el.setAttribute('width', p.s.toFixed(1));
        el.setAttribute('height', p.s.toFixed(1));
        el.setAttribute('transform', `rotate(${p.rot.toFixed(0)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        el.style.opacity = String(0.3 * L.fx * (1 - clamp01(p.melt / 0.5)));
      }
      const rs = pulsesG.current?.children;
      if (rs) {
        const now = performance.now();
        for (let i = 0; i < rs.length; i++) {
          const p = L.pulses[i]; const el = rs[i] as SVGCircleElement;
          if (!p) { el.style.opacity = '0'; continue; }
          const a = clamp01((now - p.t0) / PULSE_MS);
          const e = 1 - (1 - a) ** 3;
          el.setAttribute('r', (64 + e * 118).toFixed(1));
          el.setAttribute('stroke-width', (5 * (1 - a) + 0.75).toFixed(2));
          el.style.stroke = p.color;
          el.style.opacity = String(0.85 * (1 - a));
        }
      }
    };

    const ampTarget = settled || target <= 0 || target >= 100 ? 0 : AMP;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { L.shown = target; L.amp = 0; L.fx = 0; L.pulses = []; paint(target); return; }
    if (L.shown == null) L.shown = 0;
    else if (color && showRing && L.lastColor !== color) L.pulses = [...L.pulses, { t0: performance.now(), color }].slice(-N_PULSES); // the verdict lands: one pulse in its colour
    L.lastColor = color;

    const rnd = Math.random;
    const respawnBubble = (b: Bubble | undefined, level: number): Bubble => {
      const x = 30 + rnd() * 80;
      const y0 = bottomAt(x) - 4 - rnd() * 16;
      const nb = { x, y0, y: y0, r: 2 + rnd() * 3.4, vy: 16 + rnd() * 26, ph: rnd() * Math.PI * 2 };
      if (!b && level < y0) nb.y = level + rnd() * (y0 - level); // first frame: spread through the liquid
      return nb;
    };
    // Tablet bits start in the top half, above the surface, and fall in.
    const respawnPart = (level: number, first: boolean): Part => {
      const hi = Math.min(110, level - 24);
      return {
        x: 34 + rnd() * 72, y: hi < 14 ? hi : 14 + rnd() * (hi - 14), vy: 26 + rnd() * 30, s: 4.5 + rnd() * 3.5,
        rot: rnd() * 90, vr: (rnd() - 0.5) * 180, wait: first ? rnd() * 1.2 : 0.15 + rnd() * 0.9, melt: 0,
      };
    };

    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      L.time += dt;
      const prev = L.shown ?? 0;
      L.shown = Math.abs(target - prev) < 0.05 ? target : prev + (target - prev) * Math.min(1, dt * 5);
      if (showRing) for (const th of PULSE_AT) if (prev < th - 0.05 && L.shown >= th - 0.05) {
        L.pulses = [...L.pulses, { t0: now, color: color ?? 'var(--sky)' }].slice(-N_PULSES);
      }
      L.pulses = L.pulses.filter((p) => now - p.t0 < PULSE_MS);
      L.amp += (ampTarget - L.amp) * Math.min(1, dt * 3);
      if (Math.abs(ampTarget - L.amp) < 0.02) L.amp = ampTarget;
      L.phase += dt * 2.4;
      const fxTarget = active ? 1 : 0;
      L.fx += (fxTarget - L.fx) * Math.min(1, dt * 4);
      if (Math.abs(fxTarget - L.fx) < 0.01) L.fx = fxTarget;

      const level = BOTTOM - (L.shown / 100) * (BOTTOM - TOP);
      if (L.fx > 0) {
        for (let i = 0; i < N_BUBBLES; i++) {
          let b = L.bubbles[i];
          if (!b || b.y < level + 3) b = L.bubbles[i] = respawnBubble(b, level);
          b.y -= b.vy * dt * (0.6 + 1.6 * L.shown / 100); // the fizz picks up as the fill climbs
        }
        for (let i = 0; i < N_PARTS; i++) {
          let p = L.parts[i];
          if (!p) p = L.parts[i] = respawnPart(level, true);
          if (p.wait > 0) { p.wait -= dt; continue; }
          if (p.y >= level - 1) { p.melt += dt; p.y += p.vy * 0.25 * dt; if (p.melt >= 0.5) L.parts[i] = respawnPart(level, false); continue; }
          p.y += p.vy * dt; p.rot += p.vr * dt;
        }
      }
      paint(L.shown);
      const idle = L.shown === target && L.amp === ampTarget && L.fx === 0 && !L.pulses.length && ampTarget === 0;
      if (idle) return;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, settled, active, color, showRing]);

  const vb = showRing ? '-102 -22 344 344' : showGrid ? '-30 -10 200 320' : '8 0 124 300';
  const [vx, vy, w, h] = vb.split(' ').map(Number);
  const ticks = TICKS.map((p) => {
    const a = (p * 3.6 - 90) * (Math.PI / 180);
    return { p, x1: CX + (RING_R - 7) * Math.cos(a), y1: CY + (RING_R - 7) * Math.sin(a), x2: CX + (RING_R + 7) * Math.cos(a), y2: CY + (RING_R + 7) * Math.sin(a) };
  });
  return (
    <svg viewBox={vb} width={(size * w) / h} height={size} role="img" aria-label={`${Math.round(target)} percent dissolved`} style={{ display: 'block', overflow: 'visible', maxWidth: '100%', height: 'auto' }}>
      <defs>
        <clipPath id={`clip${id}`}><path d={CAP} /><path d={BODY} /></clipPath>
        <clipPath id={`liq${id}`}><path ref={liq} d="M0 0" /></clipPath>
        <radialGradient id={`hl${id}`}><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id={`sh${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {showGrid && <>
          <pattern id={`dots${id}`} width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="0.9" fill="rgba(22,24,27,.16)" /></pattern>
          <radialGradient id={`fade${id}`}><stop offset="0.35" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <mask id={`mask${id}`}><rect x={vx} y={vy} width={w} height={h} fill={`url(#fade${id})`} /></mask>
        </>}
      </defs>
      {showGrid && <rect x={vx} y={vy} width={w} height={h} fill={`url(#dots${id})`} mask={`url(#mask${id})`} />}
      {showRing && (
        <g>
          <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle ref={arc} cx={CX} cy={CY} r={RING_R} fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round"
            pathLength={100} strokeDasharray="100 100" style={{ strokeDashoffset: 100 - target, transition: 'stroke .6s var(--ease)' }} transform={`rotate(-90 ${CX} ${CY})`} />
          {ticks.map((t) => <line key={t.p} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />)}
          <line x1={CX} y1={CY - RING_R - 7} x2={CX} y2={CY - RING_R + 7} stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
          <g ref={head} transform={`rotate(${target * 3.6} ${CX} ${CY})`}>
            <circle cx={CX} cy={CY - RING_R} r="9" fill="var(--sky-tint)" />
            <circle cx={CX} cy={CY - RING_R} r="4.5" fill="#fff" stroke={color ?? 'var(--sky)'} strokeWidth="2" />
          </g>
          <g ref={pulsesG} fill="none">
            {Array.from({ length: N_PULSES }, (_, i) => <circle key={i} cx={CX} cy={CY} r="104" stroke="var(--sky)" style={{ opacity: 0 }} />)}
          </g>
        </g>
      )}
      <path d={BODY} fill="#fff" />
      <path d={CAP} fill="#fff" />
      <g clipPath={`url(#clip${id})`}>
        <path ref={back} style={{ fill: color ?? 'var(--sky)', opacity: 0.35 }} />
        <path ref={front} style={{ fill: color ?? 'var(--sky)', opacity: 0.9 }} />
        <path ref={surf} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
        <g clipPath={`url(#liq${id})`}>
          <g ref={causticsG} fill={`url(#hl${id})`}>
            {Array.from({ length: N_CAUSTICS }, (_, i) => <ellipse key={i} cx="70" cy="250" rx="10" ry="3" style={{ opacity: 0 }} />)}
          </g>
          <rect ref={shimmer} x="0" y="0" width="44" height="300" fill={`url(#sh${id})`} style={{ opacity: 0 }} />
          <g ref={bubblesG} fill="#fff" stroke="rgba(255,255,255,.9)" strokeWidth="0.6">
            {Array.from({ length: N_BUBBLES }, (_, i) => <circle key={i} cx="70" cy="280" r="2" fillOpacity="0.7" style={{ opacity: 0 }} />)}
          </g>
        </g>
        <g ref={partsG} fill="var(--sky-ink)">
          {Array.from({ length: N_PARTS }, (_, i) => <rect key={i} x="70" y="40" width="3" height="3" style={{ opacity: 0 }} />)}
        </g>
        <ellipse ref={hl} cx={CX + 34} cy={CY} rx="16" ry="40" fill={`url(#hl${id})`} style={{ opacity: 0 }} />
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
