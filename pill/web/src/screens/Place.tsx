// Place the tablet. A three-step timetable (place → close → start), the light path the checks prove out, the station
// pre-checks, the one instruction, then Start.
// The checks are simulated until the live stream reports led/dark/paddle/lid; ?live=1 skips the simulation.
// When the pay service reports a station (/station/status), a 'Station online' chip shows and Start runs it for real
// (Run.tsx ?station=1); otherwise Start plays the replay.
// Motion: each check draws its checkmark with a rising tick; the light path's arrows draw in once the LED is green; a quarter
// tablet keeps dropping into the cup with ripple rings; Start pulses softly once every check is green.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Checklist from '../components/Checklist';
import SensorPath from '../components/SensorPath';
import Glyph from '../components/Glyph';
import { Action, Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';
import { stationStatus, type StationStatus } from '../lib/station';
import { playSound } from '../lib/sound';
import ReadAloud from '../components/ReadAloud';
import '../components/cinema.css';

const STEPS = [
  { key: 'place', text: 'Drop in a quarter tablet', color: 'var(--c1)' },
  { key: 'close', text: 'Close the lid', color: 'var(--c4)' },
  { key: 'start', text: 'Press Start', color: 'var(--c2)' },
];
const CHECK_MS = 600;

function Steps({ at }: { at: number }) {
  return (
    <div className="stack" style={{ gap: 6 }} role="list" aria-label={`Step ${at + 1} of 3: ${STEPS[at].key}`}>
      <div style={{ position: 'relative', height: 14 }}>
        <span className="mono" aria-hidden="true" style={{ position: 'absolute', left: `${((at + 0.5) / STEPS.length) * 100}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: 12, lineHeight: 1, transition: 'left .5s var(--ease)' }}>▼</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: '0 12px' }}>
        {STEPS.map((s, i) => (
          <div key={s.key} role="listitem" aria-current={i === at ? 'step' : undefined} className="stack" style={{ gap: 6, minWidth: 0 }}>
            <span style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: `color-mix(in srgb, ${s.color} 22%, transparent)` }}>
              <span style={{ position: 'absolute', inset: 0, background: s.color, transformOrigin: 'left', transform: i <= at ? 'none' : 'scaleX(0)', transition: 'transform .6s var(--ease)' }} />
            </span>
            <span className="mono" style={{ fontSize: 11, color: i === at ? 'var(--ink)' : 'var(--muted)', fontWeight: i === at ? 600 : 400 }}>{i + 1} · {s.key}</span>
            <span style={{ fontSize: 13, color: i === at ? 'var(--ink-2)' : 'var(--muted)', lineHeight: 1.25 }}>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHECKS = [
  { label: 'LED baseline', hint: 'Blue light through clear water' },
  { label: 'Dark reading', hint: 'Sensors with the light off' },
  { label: 'Paddle turning', hint: 'Stirring the water' },
  { label: 'Lid closed', hint: 'No outside light' },
];

/** The cup glyph with a quarter tablet that keeps dropping in: ripple rings where it lands, a little fizz under the surface. */
function Cup({ size = 150 }: { size?: number }) {
  return (
    <div className="cn-cup" role="img" aria-label="A quarter tablet dropping into a cup of water">
      <div className="cn-cup-box" style={{ width: size, height: size }}>
        <Glyph name="cup" size={size} />
        {/* same 48-unit grid as the glyph: water line at y ≈ 28 */}
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <g fill="none" strokeLinecap="round">
            <ellipse className="ripple" cx="24" cy="28.2" rx="5" ry="1.3" stroke="var(--sky)" strokeWidth=".7" />
            <ellipse className="ripple r2" cx="24" cy="28.2" rx="5" ry="1.3" stroke="var(--sky)" strokeWidth=".55" />
            <ellipse className="ripple r3" cx="24" cy="28.2" rx="5" ry="1.3" stroke="var(--sky)" strokeWidth=".4" />
          </g>
          <circle className="fizz" cx="22" cy="38" r=".7" fill="var(--sky)" />
          <circle className="fizz f2" cx="26" cy="40" r=".55" fill="var(--sky)" />
          <circle className="fizz f3" cx="24.5" cy="36" r=".5" fill="var(--sky)" />
          <g className="tab">
            <path d="M21.5 0 V-5.5 A5.5 5.5 0 0 1 27 0 Z" fill="var(--mint-tint)" stroke="var(--ink)" strokeWidth=".9" strokeLinejoin="round" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default function Place() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const live = params.has('live');
  const bottleId = params.get('bottle');
  const deliveryId = params.get('delivery');
  const bottle = useStore((s) => s.bottles.find((b) => b.id === bottleId));
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (live) return;
    const ids = CHECKS.map((_, i) => window.setTimeout(() => { setDone(i + 1); playSound('tick', { step: i }); }, CHECK_MS * (i + 1)));
    return () => ids.forEach(clearTimeout);
  }, [live]);

  // the physical station (pay service /station/status); null = none, and Start plays the replay as before
  const [station, setStation] = useState<StationStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () => void stationStatus().then((s) => { if (alive) setStation(s); });
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const drug = bottle?.drug ?? 'Riboflavin';
  const lot = bottle?.lot ?? 'B2-07';
  const allDone = done >= CHECKS.length;

  const start = () => {
    playSound('rise');
    if (station) {
      // Run asks the station for dark → blank → start, then streams it (Run.tsx, ?station=1)
      const q = new URLSearchParams({ station: '1', drug: drug.toLowerCase(), lot });
      if (bottle) q.set('bottle', bottle.id);
      if (deliveryId) q.set('delivery', deliveryId);
      nav(`/run/new?${q.toString()}`);
      return;
    }
    const run = actions.startRun({ drug: drug.toLowerCase(), lot, src: 'replay', bottleId: bottle?.id ?? null, deliveryId });
    nav(`/run/${run.id}?replay=${drug.toLowerCase() === 'calcium carbonate' ? 'TM-02' : 'B2-07'}`);
  };

  return (
    <Screen title="Place the tablet" back tone="mint" art={<Glyph name="tablet" size={48} />}>
      <div className="row" style={{ gap: 8, marginTop: -6, flexWrap: 'wrap', alignItems: 'center' }}>
        <p className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          {drug}{bottle?.strength ? ' ' + bottle.strength : ''} · lot {lot}{deliveryId ? ` · delivery ${deliveryId}` : ''}
        </p>
        {station && (
          <span className="chip ok pop-in" data-station={station.mode} title={station.port ?? undefined}>
            <span className="dot" />Station online{station.mode === 'sim' ? ' · simulated' : ''}
          </span>
        )}
      </div>
      <div className="wide-2">
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <section className="card stack cn-field" style={{ gap: 6 }}>
            <span className="eyebrow">three steps</span>
            <Steps at={allDone ? 2 : done >= 2 ? 1 : 0} />
          </section>
          <section className="card tile stack cn-field" style={{ gap: 8, '--tile-accent': allDone ? 'var(--sky)' : 'var(--grey)', animationDelay: '60ms', transition: 'box-shadow .5s var(--ease)' } as React.CSSProperties}>
            <div className="row between"><span className="eyebrow">light path</span><span className={'chip' + (allDone ? ' ok pop-in' : ' live')}><span className="dot" />{allDone ? 'ready' : 'checking'}</span></div>
            {/* keyed so the arrows draw in again the moment the LED proves out */}
            <SensorPath key={done >= 1 ? 'lit' : 'dark'} led={done >= 1} glow={0} inline={1} running={allDone} />
          </section>
          <div className="stack cn-field" style={{ gap: 8, animationDelay: '120ms' }}>
            <div className="row between">
              <span className="eyebrow">Station checks · {Math.min(done, CHECKS.length)} of {CHECKS.length}</span>
              <span className="chip"><span className="dot" />{live ? 'from the station' : 'simulated'}</span>
            </div>
            <Checklist items={CHECKS.map((c, i) => ({ ...c, done: i < done }))} />
          </div>
        </div>
        <section className="card decor-dots cn-field" style={{ display: 'grid', gap: 12, animationDelay: '160ms' }}>
          <Cup size={150} />
          <p style={{ fontSize: '1.45rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Drop one quarter tablet into the water. Close the lid.
          </p>
          <ReadAloud text="Drop one quarter tablet into the water. Close the lid. Then press Start." size={56} />
        </section>
      </div>
      <Action note="About three minutes. Keep the lid closed.">
        <button type="button" className={'btn' + (allDone ? ' cn-ready' : '')} disabled={!allDone} onClick={start}>
          {allDone ? 'Start' : live ? 'Waiting for the station…' : `Checking the station… ${Math.min(done, CHECKS.length)}/${CHECKS.length}`}
        </button>
      </Action>
    </Screen>
  );
}
