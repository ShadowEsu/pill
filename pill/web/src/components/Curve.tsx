// The run curve: inline absorbance A(t) in sky, 90° glow in mint, the reference band as a dotted sky rectangle.
// Re-rendered as samples arrive (180 points). `overlays` draws extra runs (calibration) one after another.
import { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { curve, features } from '../lib/rules';
import type { Reference, Sample } from '../lib/types';

const T_MAX = 180, A_MAX = 0.6;
const PAD = { l: 28, r: 8, t: 22, b: 20 };

export default function Curve({ samples, band, width = 320, height = 180, live = false, overlays, stagger = 120, onDrawn }: {
  samples: Sample[]; band: Reference | null; width?: number; height?: number; live?: boolean;
  overlays?: Sample[][]; stagger?: number; onDrawn?: () => void;
}) {
  const x = (t: number) => PAD.l + (Math.min(T_MAX, Math.max(0, t)) / T_MAX) * (width - PAD.l - PAD.r);
  const y = (a: number) => height - PAD.b - (Math.min(A_MAX + 0.02, Math.max(0, a)) / A_MAX) * (height - PAD.t - PAD.b);
  const line = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');

  const c = curve(samples);
  const aPath = line(c.map((p) => ({ t: p.t, v: p.a })));
  const gPath = line(c.map((p) => ({ t: p.t, v: p.g })));
  const tip = c.at(-1);

  const group = useRef<SVGGElement>(null);
  const done = useRef(onDrawn);
  useEffect(() => { done.current = onDrawn; });
  const overlayCount = overlays?.length ?? 0;
  useEffect(() => {
    const paths = group.current ? Array.from(group.current.querySelectorAll<SVGPathElement>('path')) : [];
    if (!paths.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paths.forEach((p) => { p.style.strokeDashoffset = '0'; });
      done.current?.();
      return;
    }
    const anims = paths.map((p) => animate(p, {
      strokeDashoffset: [1, 0], duration: 500, ease: 'outCubic', delay: Number(p.dataset.i) * stagger,
      onComplete: () => { if (p === paths.at(-1)) done.current?.(); },
    }));
    return () => anims.forEach((a) => a.cancel());
  }, [overlayCount, stagger]);

  const mono = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--muted)' } as const;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
      aria-label={`Absorbance and glow over ${tip ? Math.round(tip.t) : 0} seconds`}>
      {[0, 0.2, 0.4, 0.6].map((a) => (
        <g key={a}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(a)} y2={y(a)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD.l - 6} y={y(a) + 3.5} textAnchor="end" style={mono}>{a.toFixed(1).slice(1)}</text>
        </g>
      ))}
      {[0, 60, 120, 180].map((t) => (
        <text key={t} x={x(t)} y={height - 5} textAnchor={t === 0 ? 'start' : t === 180 ? 'end' : 'middle'} style={mono}>{t === 0 || t === 180 ? `${t} s` : t}</text>
      ))}
      {band && (
        <rect x={PAD.l} width={width - PAD.l - PAD.r} y={y(band.bandHigh)} height={y(band.bandLow) - y(band.bandHigh)}
          fill="var(--sky-tint)" stroke="var(--sky)" strokeWidth="1" strokeDasharray="2 3" />
      )}
      <g style={mono}>
        <line x1={PAD.l} x2={PAD.l + 14} y1={9} y2={9} stroke="var(--sky)" strokeWidth="2" strokeLinecap="round" />
        <text x={PAD.l + 19} y={12.5}>A(t) inline</text>
        <line x1={PAD.l + 96} x2={PAD.l + 110} y1={9} y2={9} stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" />
        <text x={PAD.l + 115} y={12.5}>glow 90°</text>
        {band && <>
          <rect x={PAD.l + 180} y={4.5} width={14} height={9} fill="var(--sky-tint)" stroke="var(--sky)" strokeDasharray="2 2" />
          <text x={PAD.l + 199} y={12.5}>band</text>
        </>}
      </g>
      {overlays && (
        <g ref={group} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {overlays.flatMap((s, i) => {
            const oc = curve(s);
            return [
              <path key={`g${i}`} data-i={i} d={line(oc.map((p) => ({ t: p.t, v: p.g })))} stroke="var(--mint)" strokeOpacity="0.5" strokeWidth="1.25" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />,
              <path key={`a${i}`} data-i={i} d={line(oc.map((p) => ({ t: p.t, v: p.a })))} stroke="var(--sky)" strokeOpacity="0.6" strokeWidth="1.25" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />,
            ];
          })}
        </g>
      )}
      {c.length > 1 && <>
        <path d={gPath} fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={aPath} fill="none" stroke="var(--sky)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </>}
      {live && tip && <>
        <circle cx={x(tip.t)} cy={y(tip.a)} r="6" fill="var(--sky-tint)" />
        <circle cx={x(tip.t)} cy={y(tip.a)} r="3" fill="var(--sky)" />
      </>}
    </svg>
  );
}

/** The numbers under the curve: temp, elapsed, plateau so far, glow rise; then the four station checks from the latest sample. */
export function RunReadout({ samples, strip = true, checks = true }: { samples: Sample[]; strip?: boolean; checks?: boolean }) {
  const last = samples.at(-1);
  const f = samples.length ? features(samples) : null;
  const cells: [string, string][] = [
    ['temp', last ? `${last.temp.toFixed(1)} °C` : '—'],
    ['elapsed', last ? `${Math.round(last.t)} s` : '—'],
    ['plateau', f ? f.plateau.toFixed(2) : '—'],
    ['glow', f ? `${f.glowRise >= 0 ? '+' : ''}${f.glowRise.toFixed(2)}` : '—'],
  ];
  const chips: [string, boolean | null, string, string][] = [
    ['LED', last ? last.led : null, 'LED ok', 'LED fault'],
    ['dark', last ? last.dark < last.blank * 0.05 : null, 'dark ok', 'dark high'],
    ['paddle', last ? last.paddle : null, 'paddle turning', 'paddle stopped'],
    ['lid', last ? last.lid : null, 'lid closed', 'lid open'],
  ];
  return (
    <div className="stack" style={{ gap: 12 }}>
      {strip && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {cells.map(([k, v]) => (
            <div key={k} style={{ background: 'var(--surface)', padding: '10px 10px 9px' }}>
              <p className="eyebrow" style={{ fontSize: 10, letterSpacing: '.06em' }}>{k}</p>
              <p className="mono" style={{ fontSize: 15, marginTop: 2, whiteSpace: 'nowrap' }}>{v}</p>
            </div>
          ))}
        </div>
      )}
      {checks && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {chips.map(([k, ok, yes, no]) => (
            <span key={k} className={'chip' + (ok === null ? '' : ok ? ' ok' : ' warn')}><span className="dot" />{ok === null ? `${k} —` : ok ? yes : no}</span>
          ))}
        </div>
      )}
    </div>
  );
}
