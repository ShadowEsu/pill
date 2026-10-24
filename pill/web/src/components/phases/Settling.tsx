// Phase 5, settling: the curve zoomed on its last 30 s with the 20-s plateau window shaded, a window bar that fills as the
// reading holds flat, the |dA/dt| readout against the station's ε, and a 'holding' pulse. The station calls the plateau when
// the least-squares slope over the window falls under ε; then the rail ticks Verdict.
import { STATION, type CurveMarks } from '../PhaseRail';
import { curve } from '../../lib/rules';
import type { Reference, Sample } from '../../lib/types';

const W = 320, H = 150, P = { l: 34, r: 10, t: 12, b: 22 };

export default function Settling({ samples, band, marks, moment = false }: { samples: Sample[]; band: Reference | null; marks: CurveMarks; moment?: boolean }) {
  const f = samples.findIndex((s) => s.fault);
  const c = curve(f < 0 ? samples : samples.slice(0, f));
  const tl = c.at(-1)?.t ?? 0;
  const t0 = Math.max(0, tl - 30);
  const pts = c.filter((p) => p.t >= t0);
  const as = pts.map((p) => p.a);
  const mid = as.length ? (Math.min(...as) + Math.max(...as)) / 2 : 0;
  const half = Math.max(0.03, as.length ? (Math.max(...as) - Math.min(...as)) / 2 + 0.008 : 0.03);
  const lo = mid - half, hi = mid + half;
  const x = (t: number) => P.l + ((t - t0) / 30) * (W - P.l - P.r);
  const y = (a: number) => P.t + (1 - (a - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.a).toFixed(1)}`).join(' ');
  const plateau = marks.plateau != null;
  const slope = marks.slope;
  const held = Math.round(marks.window * STATION.window);
  const bandIn = band && band.bandHigh > lo && band.bandLow < hi;
  return (
    <div className="ph-in">
      <span className="eyebrow ph-eb">phase 5 · settling</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="ph-zoom" role="img" aria-label={`The last 30 seconds of the curve, absorbance ${as.at(-1)?.toFixed(3) ?? '—'}`}>
        <rect x={x(Math.max(t0, tl - STATION.window))} y={P.t} width={x(tl) - x(Math.max(t0, tl - STATION.window))} height={H - P.t - P.b} className="ph-win" />
        {bandIn && band && <rect x={P.l} width={W - P.l - P.r} y={y(Math.min(hi, band.bandHigh))} height={Math.max(0, y(Math.max(lo, band.bandLow)) - y(Math.min(hi, band.bandHigh)))} className="ph-band" />}
        {[lo + half * 0.25, mid, hi - half * 0.25].map((a) => (
          <g key={a}><line x1={P.l} x2={W - P.r} y1={y(a)} y2={y(a)} className="ph-grid" /><text x={P.l - 4} y={y(a) + 3} className="ph-axis" textAnchor="end">{a.toFixed(3)}</text></g>
        ))}
        <path d={path} className="ph-line" />
        {pts.length > 0 && <circle cx={x(tl)} cy={y(pts.at(-1)!.a)} r="4" className="ph-head-dot" />}
        <text x={P.l} y={H - 6} className="ph-axis">−30 s</text>
        <text x={x(Math.max(t0, tl - STATION.window))} y={H - 6} className="ph-axis" textAnchor="middle">window</text>
        <text x={W - P.r} y={H - 6} className="ph-axis" textAnchor="end">now</text>
      </svg>
      <p className="serif ph-big">{plateau ? 'Plateau.' : 'Holding still.'}</p>
      <p className="ph-sub">{plateau ? 'The reading held flat for the whole 20-second window. The rules read the curve next.' : 'The tablet is nearly done. The station waits for 20 seconds in which the reading barely moves.'}</p>
      {moment && <p className="ph-moment-note">The glow channel stayed flat the whole time.</p>}
      <div className="ph-meter" role="meter" aria-label="Plateau window" aria-valuemin={0} aria-valuemax={STATION.window} aria-valuenow={held}>
        <div className="row between"><span className="eyebrow">plateau window</span><span className="mono">{held} / {STATION.window} s flat</span></div>
        <span className="ph-meter-track ph-window"><span className="ph-meter-fill" style={{ width: `${marks.window * 100}%`, background: 'var(--c4)' }} /></span>
        <span className="ph-meter-cap mono">dA/dt {slope == null ? '—' : `${slope < 0 ? '−' : ''}${Math.abs(slope).toFixed(4)}`} /s · under {STATION.eps.toFixed(3)}</span>
      </div>
      <span className={'chip ph-holding' + (plateau ? ' ok' : ' live')}><span className="dot" />{plateau ? 'plateau reached' : 'holding'}</span>
    </div>
  );
}
