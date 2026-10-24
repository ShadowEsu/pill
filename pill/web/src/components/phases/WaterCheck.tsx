// Phase 2, clear water: plain water in the cup with the paddle turning, a 10-s ring, the inline reading's stability as a
// CV % of the readings so far (mint under the station's 2 % limit), and the blank value latching when the reading holds.
// The station retries an unstable blank up to three times ('unstable, retry'); after that the run stops.
import Cup from './Cup';
import { STATION } from '../PhaseRail';
import type { PreReading } from '../../lib/stream';

export default function WaterCheck({ readings, progress, secs, latched, unstable = false, fault = null, onRetry }: {
  readings: PreReading[]; progress: number; secs: number; latched: number | null; unstable?: boolean; fault?: string | null; onRetry?: () => void;
}) {
  const xs = readings.slice(-10).map((r) => r.adc0);
  const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) : 0;
  const cv = mean > 0 ? (sd / mean) * 100 : 0;
  const steady = xs.length >= 2 && cv < STATION.blankCv;
  const R = 52, L = 2 * Math.PI * R;
  const last = readings.at(-1);
  return (
    <div className="ph-in">
      <span className="eyebrow ph-eb">phase 2 · clear water</span>
      <div className="ph-water">
        <Cup size={150} paddle={!fault} label="A cup of clear water with the paddle turning" />
        <div className="ph-ring-wrap sm">
          <svg viewBox="0 0 120 120" className="ph-ring" aria-hidden="true">
            <circle cx="60" cy="60" r={R} className="track" />
            <circle cx="60" cy="60" r={R} className="arc" strokeDasharray={L} strokeDashoffset={L * (1 - Math.max(0, Math.min(1, progress)))} transform="rotate(-90 60 60)" />
          </svg>
          <span className="ph-ring-num mono">{Math.min(10, secs).toFixed(0)}<small> / 10 s</small></span>
        </div>
      </div>
      {fault ? (
        <>
          <p className="serif ph-big">The water would not hold still.</p>
          <p className="ph-sub">Three clear-water readings in a row moved more than 2 %. Check the lid and that the cup is plain water, then retry.</p>
          <p className="mono ph-msg">{fault}</p>
          {onRetry && <button type="button" className="btn ph-retry" onClick={onRetry} data-action="retry">Retry the clear water</button>}
        </>
      ) : (
        <>
          <p className="serif ph-big">{latched != null ? 'Clear water, latched.' : 'Clear water first.'}</p>
          <p className="ph-sub">Plain water with the paddle on. This is the 100 % every later reading is measured against.</p>
        </>
      )}
      <div className="ph-meter" role="meter" aria-label="Blank stability, coefficient of variation" aria-valuemin={0} aria-valuemax={4} aria-valuenow={+cv.toFixed(2)}>
        <div className="row between"><span className="eyebrow">stability</span><span className="mono">CV {cv.toFixed(2)} % · under {STATION.blankCv} %</span></div>
        <span className="ph-meter-track"><span className="ph-meter-fill" style={{ width: `${Math.min(100, (cv / 4) * 100)}%`, minWidth: xs.length ? 4 : 0, background: steady ? 'var(--mint)' : 'var(--amber)' }} /><span className="ph-meter-limit" style={{ left: '50%' }} /></span>
        <span className="ph-meter-cap mono">{readings.length} / 10 readings{last ? ` · inline ${last.adc0}` : ''}</span>
      </div>
      <div className="row ph-chips">
        {unstable && !fault && <span className="chip pop-in" data-unstable><span className="dot" style={{ background: 'var(--amber)' }} />unstable, retry</span>}
        {latched != null
          ? <span className="chip ok pop-in ph-latch" data-latched={latched}><span className="dot" />blank {latched} counts latched</span>
          : !fault && <span className="chip live"><span className="dot" />holding the reading</span>}
      </div>
    </div>
  );
}
