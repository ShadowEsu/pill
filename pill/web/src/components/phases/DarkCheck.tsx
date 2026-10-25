// Phase 1, lights off: the card goes navy (the box with its lid closed), a thin ring counts the 3 s, the dark counts tick in
// mono, and a light-leak meter holds dark0 against the station's 100-count limit. A fault (light got in) asks about the lid.
import Glyph from '../Glyph';
import { STATION } from '../PhaseRail';
import type { PreReading } from '../../lib/stream';

export default function DarkCheck({ readings, progress, secs, fault = null, onRetry }: {
  readings: PreReading[]; progress: number; secs: number; fault?: string | null; onRetry?: () => void;
}) {
  const last = readings.at(-1);
  const leak = last ? last.dark0 / STATION.leakMax : 0;
  const R = 52, L = 2 * Math.PI * R;
  if (fault) {
    return (
      <div className="ph-in ph-fault">
        <span className="ph-lid"><Glyph name="station" size={72} /></span>
        <p className="serif ph-big">Is the lid closed?</p>
        <p className="ph-sub">Light got into the box while the station read the dark, so it stopped before the tablet went in.</p>
        <p className="mono ph-msg">{fault}</p>
        {onRetry && <button type="button" className="btn ph-retry" onClick={onRetry} data-action="retry">Close the lid and retry</button>}
      </div>
    );
  }
  return (
    <div className="ph-in">
      <span className="eyebrow ph-eb">phase 1 · lights off</span>
      <div className="ph-ring-wrap">
        <svg viewBox="0 0 120 120" className="ph-ring" aria-hidden="true">
          <circle cx="60" cy="60" r={R} className="track" />
          <circle cx="60" cy="60" r={R} className="arc" strokeDasharray={L} strokeDashoffset={L * (1 - Math.max(0, Math.min(1, progress)))} transform="rotate(-90 60 60)" />
        </svg>
        <span className="ph-ring-num mono">{Math.min(3, secs).toFixed(1)}<small> / 3 s</small></span>
      </div>
      <p className="serif ph-big">The box goes dark.</p>
      <p className="ph-sub">All three LEDs (white, blue, red) are off. The sensors read the dark, so the station knows what nothing looks like.</p>
      <dl className="ph-reads mono" aria-live="off">
        <div><dt>dark0</dt><dd key={`a${readings.length}`} className="ph-tickval">{last ? last.dark0 : '—'}</dd></div>
        <div><dt>dark90</dt><dd key={`b${readings.length}`} className="ph-tickval">{last ? last.dark90 : '—'}</dd></div>
        <div><dt>readings</dt><dd>{readings.length} / 3</dd></div>
      </dl>
      <div className="ph-meter" role="meter" aria-label="Light leak" aria-valuemin={0} aria-valuemax={STATION.leakMax} aria-valuenow={last?.dark0 ?? 0}>
        <div className="row between"><span className="eyebrow">light leak</span><span className="mono">{last ? last.dark0 : 0} / {STATION.leakMax} counts</span></div>
        <span className="ph-meter-track"><span className="ph-meter-fill" style={{ width: `${Math.min(100, leak * 100)}%`, background: leak < 0.6 ? 'var(--mint)' : 'var(--amber)' }} /><span className="ph-meter-limit" /></span>
        <span className="ph-meter-cap mono">{leak < 1 ? 'dark enough' : 'over the limit'}</span>
      </div>
    </div>
  );
}
