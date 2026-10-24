// Place the tablet. A three-step timetable (place → close → start), the light path the checks prove out, the station
// pre-checks, the one instruction, then Start.
// The checks are simulated until the live stream reports led/dark/paddle/lid; ?live=1 skips the simulation.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Checklist from '../components/Checklist';
import SensorPath from '../components/SensorPath';
import { Action, Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';

const STEPS = [
  { key: 'place', text: 'Drop in a quarter tablet', color: 'var(--c1)' },
  { key: 'close', text: 'Close the lid', color: 'var(--c4)' },
  { key: 'start', text: 'Press Start', color: 'var(--c2)' },
];

function Steps({ at }: { at: number }) {
  return (
    <div className="stack" style={{ gap: 6 }} role="list" aria-label={`Step ${at + 1} of 3: ${STEPS[at].key}`}>
      <div style={{ position: 'relative', height: 14 }}>
        <span className="mono" aria-hidden="true" style={{ position: 'absolute', left: `${((at + 0.5) / STEPS.length) * 100}%`, bottom: 0, transform: 'translateX(-50%)', fontSize: 12, lineHeight: 1, transition: 'left .4s var(--ease)' }}>▼</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: '0 12px' }}>
        {STEPS.map((s, i) => (
          <div key={s.key} role="listitem" aria-current={i === at ? 'step' : undefined} className="stack" style={{ gap: 6, minWidth: 0 }}>
            <span style={{ height: 8, borderRadius: 4, background: i <= at ? s.color : `color-mix(in srgb, ${s.color} 22%, transparent)`, transition: 'background .4s var(--ease)' }} />
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

function Drawing() {
  return (
    <svg viewBox="0 0 220 128" width="100%" style={{ maxHeight: 128 }} role="img" aria-label="A quarter tablet dropping into a cup of water, the lid above">
      <g fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* lid, lifted */}
        <rect x="68" y="8" width="84" height="8" rx="3" />
        <rect x="102" y="3" width="16" height="5" rx="2" />
        {/* quarter tablet, falling */}
        <path d="M100 20 v6 M108 19 v6" stroke="var(--line-2)" />
        <path d="M104 48 V34 A14 14 0 0 1 118 48 Z" fill="var(--mint-tint)" stroke="var(--ink)" />
        {/* water, then the cup */}
        <path d="M75 78 L79 118 a4 4 0 0 0 4 4 h54 a4 4 0 0 0 4 -4 L145 78 z" fill="var(--sky-tint)" stroke="none" />
        <path d="M75 78 q8 -4 16 0 t16 0 t16 0 t16 0 t6 0" stroke="var(--sky)" />
        <path d="M72 60 l7 58 a4 4 0 0 0 4 4 h54 a4 4 0 0 0 4 -4 l7 -58" />
      </g>
    </svg>
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
    const ids = CHECKS.map((_, i) => window.setTimeout(() => setDone(i + 1), 500 * (i + 1)));
    return () => ids.forEach(clearTimeout);
  }, [live]);

  const drug = bottle?.drug ?? 'Riboflavin';
  const lot = bottle?.lot ?? 'B2-07';
  const allDone = done >= CHECKS.length;

  const start = () => {
    const run = actions.startRun({ drug: drug.toLowerCase(), lot, src: 'replay', bottleId: bottle?.id ?? null, deliveryId });
    nav(`/run/${run.id}?replay=${drug.toLowerCase() === 'calcium carbonate' ? 'TM-02' : 'B2-07'}`);
  };

  return (
    <Screen title="Place the tablet" back>
      <p className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: -6 }}>
        {drug}{bottle?.strength ? ' ' + bottle.strength : ''} · lot {lot}{deliveryId ? ` · delivery ${deliveryId}` : ''}
      </p>
      <div className="wide-2">
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <section className="card stack" style={{ gap: 6 }}>
            <span className="eyebrow">three steps</span>
            <Steps at={allDone ? 2 : done >= 2 ? 1 : 0} />
          </section>
          <section className="card tile stack" style={{ gap: 8, '--tile-accent': allDone ? 'var(--sky)' : 'var(--grey)' } as React.CSSProperties}>
            <div className="row between"><span className="eyebrow">light path</span><span className="mono muted" style={{ fontSize: 12 }}>{allDone ? 'ready' : 'checking'}</span></div>
            <SensorPath led={allDone} glow={0} inline={1} />
          </section>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row between">
              <span className="eyebrow">Station checks</span>
              <span className="chip"><span className="dot" />{live ? 'from the station' : 'simulated'}</span>
            </div>
            <Checklist items={CHECKS.map((c, i) => ({ ...c, done: i < done }))} />
          </div>
        </div>
        <section className="rise card decor-dots" style={{ display: 'grid', gap: 12, animationDelay: '120ms' }}>
          <Drawing />
          <p style={{ fontSize: '1.45rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Drop one quarter tablet into the water. Close the lid.
          </p>
        </section>
      </div>
      <Action note="About three minutes. Keep the lid closed.">
        <button type="button" className="btn" disabled={!allDone} onClick={start}>
          {allDone ? 'Start' : live ? 'Waiting for the station…' : 'Checking the station…'}
        </button>
      </Action>
    </Screen>
  );
}
