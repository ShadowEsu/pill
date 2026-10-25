// Phase 3, drop: the whole tablet hangs over the chamber until it goes in through the lid's hole (a tap shows the drop,
// ripple rings where it lands), then the stick stirs 5 circles; the inline reading is drawn against the 6 % line the station
// waits for. Past 30 s with no drop, the prompt pulses.
import { useEffect, useState } from 'react';
import Cup from './Cup';
import { STATION } from '../PhaseRail';

export default function DropTablet({ inline, dropped, waited, prompt = null }: {
  /** inline reading now, as a share of the blank (1 = clean water) */ inline: number;
  dropped: boolean; /** seconds since the run started */ waited: number; /** the station's own words, when it asks */ prompt?: string | null;
}) {
  const [tapped, setTapped] = useState(false);
  const [ripple, setRipple] = useState(0);
  const falling = tapped || dropped;
  useEffect(() => { if (dropped) setRipple((r) => r + 1); }, [dropped]);
  const [rest, setRest] = useState(false);
  useEffect(() => {
    if (!falling) return;
    const id = window.setTimeout(() => setRest(true), 1100);
    return () => clearTimeout(id);
  }, [falling]);
  const fell = Math.max(0, (1 - inline) * 100);
  const late = !dropped && (waited >= STATION.dropWait || !!prompt);
  // the meter runs 100 % → 90 %: the 6 % line sits at 60 % of the track
  const share = Math.min(1, fell / 10);
  return (
    <div className="ph-in">
      <span className="eyebrow ph-eb">phase 3 · drop</span>
      <button type="button" className="ph-cupbtn" onClick={() => { setTapped(true); setRipple((r) => r + 1); }} aria-label="Show the tablet dropping in" disabled={falling}>
        <Cup size={150} stir={rest} tablet={rest ? 'in' : falling ? 'falling' : 'held'} ripple={ripple} label={rest ? 'The whole tablet in the water, stirred with the stick through the lid' : 'A whole tablet over the chamber of clean water'} />
      </button>
      <p className="serif ph-big">{dropped ? 'Dropped. Stir 5 circles.' : 'Drop the whole tablet in'}</p>
      <p className="ph-sub">{dropped ? 'The inline light dimmed past 6 %: something is in the water. Stir 5 circles with the stick, keep the lid closed; the clock is running.' : 'Through the hole in the lid, then stir 5 circles with the stick. The station watches the inline light fall by 6 %.'}</p>
      {late && <p className="ph-prompt" role="status">{prompt ?? 'Still waiting: drop the tablet now.'}</p>}
      <div className="ph-meter" role="meter" aria-label="Inline reading drop" aria-valuemin={0} aria-valuemax={10} aria-valuenow={+fell.toFixed(1)}>
        <div className="row between"><span className="eyebrow">inline light</span><span className="mono">{(inline * 100).toFixed(1)} % of the blank</span></div>
        <span className="ph-meter-track"><span className="ph-meter-fill" style={{ width: `${share * 100}%`, background: dropped ? 'var(--mint)' : 'var(--violet)' }} /><span className="ph-meter-limit" style={{ left: `${STATION.drop * 1000}%` }} /></span>
        <span className="ph-meter-cap mono">down {fell.toFixed(1)} % · needs 6 %{dropped ? ' · dropped' : ''}</span>
      </div>
      <span className="mono muted" style={{ fontSize: 12 }}>{Math.floor(waited)} s since the run started</span>
    </div>
  );
}
