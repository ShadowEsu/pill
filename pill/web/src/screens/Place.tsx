// Prepare: phase 0 of the run. The PhaseRail starts here (Prepare filling as the station pre-checks go green, the six
// station phases waiting after it), so Prepare → Run reads as one sequence. Then the light path the checks prove out, the
// pre-checks, the one instruction (plain water in, lid closed, the tablet waits for its phase), then Start.
// The checks are simulated until the live stream reports led/dark/paddle/lid; ?live=1 skips the simulation.
// When the pay service reports a station (/station/status), a 'Station online' chip shows and Start runs it for real
// (Run.tsx ?station=1); otherwise Start plays the replay.
// Motion: each check draws its checkmark with a rising tick; the light path's arrows draw in once the LED is green; the
// quarter tablet hovers over the clear water; Start pulses softly once every check is green.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Checklist from '../components/Checklist';
import SensorPath from '../components/SensorPath';
import Glyph from '../components/Glyph';
import PhaseRail from '../components/PhaseRail';
import Cup from '../components/phases/Cup';
import { Action, Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';
import { stationStatus, type StationStatus } from '../lib/station';
import { playSound } from '../lib/sound';
import ReadAloud from '../components/ReadAloud';
import '../components/cinema.css';

const CHECK_MS = 600;
const CHECKS = [
  { label: 'LED baseline', hint: 'Blue light through clear water' },
  { label: 'Dark reading', hint: 'Sensors with the light off' },
  { label: 'Paddle turning', hint: 'Stirring the water' },
  { label: 'Lid closed', hint: 'No outside light' },
];
const SAY = 'Fill the cup with plain water and close the lid. Keep one quarter tablet ready: the station asks for it after the clear-water check.';

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
  const checked = Math.min(done, CHECKS.length);
  const allDone = checked >= CHECKS.length;

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
    <Screen title="Prepare" back tone="mint" art={<Glyph name="tablet" size={48} />}>
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
      <div className="ph-run">
        <PhaseRail at="prepare" progress={checked / CHECKS.length} clock={`${checked} / ${CHECKS.length} checks`} sound={false}
          note={allDone ? 'Ready. Start runs the six phases below, about two minutes.' : 'The station checks itself before the run.'} />
        <div className="wide-2">
          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            <div className="stack cn-field" style={{ gap: 8 }}>
              <div className="row between">
                <span className="eyebrow">Station checks · {checked} of {CHECKS.length}</span>
                <span className="chip"><span className="dot" />{live ? 'from the station' : 'simulated'}</span>
              </div>
              <Checklist items={CHECKS.map((c, i) => ({ ...c, done: i < done }))} />
            </div>
            <section className="card tile stack cn-field" style={{ gap: 8, '--tile-accent': allDone ? 'var(--sky)' : 'var(--grey)', animationDelay: '60ms', transition: 'box-shadow .5s var(--ease)' } as React.CSSProperties}>
              <div className="row between"><span className="eyebrow">light path</span><span className={'chip' + (allDone ? ' ok pop-in' : ' live')}><span className="dot" />{allDone ? 'ready' : 'checking'}</span></div>
              {/* keyed so the arrows draw in again the moment the LED proves out */}
              <SensorPath key={done >= 1 ? 'lit' : 'dark'} led={done >= 1} glow={0} inline={1} running={allDone} />
            </section>
          </div>
          <section className="card decor-dots cn-field" style={{ display: 'grid', gap: 12, justifyItems: 'center', animationDelay: '160ms' }}>
            <span className="eyebrow" style={{ justifySelf: 'start' }}>phase 0 · prepare</span>
            <div style={{ paddingTop: 30 }}><Cup size={140} tablet="held" label="A cup of plain water with a quarter tablet waiting above it" /></div>
            <p style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, justifySelf: 'stretch' }}>
              Fill the cup with plain water. Close the lid.
            </p>
            <p style={{ color: 'var(--ink-2)', justifySelf: 'stretch' }}>Keep one quarter tablet ready: the station asks for it after the clear-water check.</p>
            <ReadAloud text={SAY} size={56} />
          </section>
        </div>
      </div>
      <Action note="About two minutes: lights off, clear water, then the tablet. Keep the lid closed.">
        <button type="button" className={'btn' + (allDone ? ' cn-ready' : '')} disabled={!allDone} onClick={start}>
          {allDone ? 'Start' : live ? 'Waiting for the station…' : `Checking the station… ${checked}/${CHECKS.length}`}
        </button>
      </Action>
    </Screen>
  );
}
