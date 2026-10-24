// Guided demo ("/demo"): two minutes on the real screens for the judging table. Bottle (demo label) → Place → Run TM-02
// (cloudy chalk reaches the band, no glow) → Evaluation NEEDS LAB N2 → Delivery held + lab referral → Dashboard.
// <DemoDriver/> lives in the app frame (it must survive route changes): it navigates on a timer, does what the person at
// the station would do (attach the bottle, start the run, run policy) through the same store actions, and shows <Caption/>.
// It never edits a screen. sessionStorage['pill.demo'] = '1' while it runs, so a screen can tell. `?speed=2` plays faster.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Caption from '../components/Caption';
import SpinPill from '../components/SpinPill';
import { actions, getState, useStore } from '../lib/store';
import { postSamples } from '../lib/api';
import { playSound } from '../lib/sound';
import { absorbance } from '../lib/rules';
import type { Mode, Run } from '../lib/types';

const DELIVERY = 'd-1042';          // seeded: Bayview Medical Wholesale, calcium carbonate lot TM-02, $480 in escrow
const RUN_SPEED = 7.5;             // the Run screen's own default replay speed (samples per second)
const MOMENT_T = 105;              // seconds into the TM-02 replay when the cloudy reading reaches the band edge
const KEY = 'pill.demo.state';

interface DemoState { on: boolean; step: number; paused: boolean; speed: number; bottleId: string | null; runId: string | null; proposed: boolean; prevMode: Mode | null; tiger: string | null }
const OFF: DemoState = { on: false, step: 0, paused: false, speed: 1, bottleId: null, runId: null, proposed: false, prevMode: null, tiger: null };

let demo: DemoState = (() => { try { return { ...OFF, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') }; } catch { return OFF; } })();
const listeners = new Set<() => void>();
function setDemo(patch: Partial<DemoState>) {
  demo = { ...demo, ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(demo));
  sessionStorage.setItem('pill.demo', demo.on ? '1' : '0');
  listeners.forEach((l) => l());
}
const useDemo = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => demo);

// The step clock lives outside React state too: external-store updates render synchronously, while plain timer-driven
// state updates were observed to stop committing in headless Chromium after a screen's entry animation.
let clock = { step: -1, ms: 0 };
const clockListeners = new Set<() => void>();
function tickClock(step: number, dms: number) {
  clock = { step, ms: (clock.step === step ? clock.ms : 0) + dms };
  clockListeners.forEach((l) => l());
}
const useClock = () => useSyncExternalStore((l) => { clockListeners.add(l); return () => clockListeners.delete(l); }, () => clock);

interface Step {
  key: string; label: string;
  /** ms at speed 1; the run step instead waits for the run to finish */ ms: number | 'run';
  say: (run: Run | undefined) => string;
  /** navigate, and do what the person at the station would do; returns a cleanup */ enter: (go: NavigateFunction, path: string) => (() => void) | void;
}

const STEPS: Step[] = [
  {
    key: 'bottle', label: 'the label', ms: 18_000,
    say: () => 'A $480 delivery of calcium carbonate arrives, lot TM-02. The tech photographs the label; Pill reads the lot and checks openFDA for a recall.',
    enter: (go) => {
      go('/bottle?demo=tm-02');
      // press "Use the demo label", as the tech would without a camera
      const t = window.setTimeout(() => [...document.querySelectorAll('button')].find((b) => /demo label/i.test(b.textContent ?? ''))?.click(), 1500 / demo.speed);
      return () => clearTimeout(t);
    },
  },
  {
    key: 'place', label: 'place the tablet', ms: 12_000,
    say: () => 'One quarter tablet goes into the water. Before it starts, the station checks its light, its dark reading, the paddle and the lid.',
    enter: (go) => {
      const s = getState();
      const delivery = s.deliveries.some((d) => d.id === DELIVERY) ? DELIVERY : null;
      let bottleId = demo.bottleId && s.bottles.some((b) => b.id === demo.bottleId) ? demo.bottleId : null;
      if (!bottleId) {
        bottleId = actions.addBottle({ drug: 'calcium carbonate', strength: '500 mg', lot: 'TM-02', maker: 'GSK', expiry: '2026-11', recall: 'no_record', recallCheckedAt: Date.now() }).id;
        if (delivery) actions.attachBottle(delivery, bottleId);
        setDemo({ bottleId });
      }
      go(`/place?bottle=${bottleId}${delivery ? `&delivery=${delivery}` : ''}`);
    },
  },
  {
    key: 'run', label: 'run TM-02', ms: 'run',
    say: (run) => {
      const t = run?.samples.at(-1)?.t ?? 0;
      return run?.evaluation || t >= MOMENT_T
        ? 'The moment: cloudy chalk pushes the blue reading up to the band, but nothing glows. Riboflavin would. This lot NEEDS LAB.'
        : 'Two light paths watch the water. Straight through, blue light shows how much has dissolved. At 90°, a second sensor watches for riboflavin\u2019s glow.';
    },
    enter: (go) => {
      const s = getState();
      let id = demo.runId && s.runs.some((r) => r.id === demo.runId) ? demo.runId : null;
      if (!id) {
        playSound('rise');
        id = actions.startRun({ drug: 'calcium carbonate', lot: 'TM-02', src: 'replay', bottleId: demo.bottleId, deliveryId: s.deliveries.some((d) => d.id === DELIVERY) ? DELIVERY : null }).id;
        setDemo({ runId: id });
      }
      go(`/run/${id}?replay=TM-02&speed=${RUN_SPEED * demo.speed}`);
    },
  },
  {
    key: 'evaluation', label: 'the verdict', ms: 18_000,
    say: () => 'NEEDS LAB, rule N2: the blue channel moved, the glow did not. Pill never says what the tablet is. It says what the light did, and who should look next.',
    enter: (go, path) => { if (path !== `/evaluation/${demo.runId}`) go(`/evaluation/${demo.runId}`, { replace: true }); },
  },
  {
    key: 'delivery', label: 'the policy agent', ms: 20_000,
    say: () => 'The policy agent reads clause P2: hold the $480 in escrow and draft a lab referral with the curve attached. It cannot release money. Only a pharmacist\u2019s tap can.',
    enter: (go) => {
      const has = getState().deliveries.some((d) => d.id === DELIVERY);
      if (has && !demo.proposed) { actions.propose(DELIVERY); setDemo({ proposed: true }); }
      go(has ? `/delivery/${DELIVERY}` : '/deliveries');
    },
  },
  {
    key: 'dashboard', label: 'the dashboard', ms: 18_000,
    say: () => 'The hold lands on the dashboard: the timetable, the lot heat map, the money path, and who did what. Every step has a name and a time.',
    enter: (go) => go('/'),
  },
];

function stop(go: NavigateFunction, to: string) {
  const prev = demo.prevMode;
  setDemo({ ...OFF, speed: demo.speed });
  if (prev && prev !== getState().mode) actions.setMode(prev);
  go(to);
}

/** Mounted once in the app frame; renders nothing unless the demo is on. */
export function DemoDriver() {
  const d = useDemo();
  const go = useNavigate();
  const { pathname } = useLocation();
  const run = useStore((s) => (d.runId ? s.runs.find((r) => r.id === d.runId) : undefined));
  const step = STEPS[d.step];
  // speed-scaled ms spent in the current step; a new step reads as 0 until the clock ticks for it
  const c = useClock();
  const elapsed = c.step === d.step ? c.ms : 0;
  const pathRef = useRef(pathname);
  const doneAt = useRef<number | null>(null);

  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  // enter a step: navigate, do its action, sound
  useEffect(() => {
    if (!d.on || !step) return;
    doneAt.current = null;
    if (step.key !== 'run' && step.key !== 'evaluation') playSound('tick', { step: d.step });
    return step.enter(go, pathRef.current) ?? undefined;
  }, [d.on, d.step, step, go]);

  // clock (speed-scaled, paused-aware)
  useEffect(() => {
    if (!d.on || d.paused) return;
    let last = Date.now();
    const id = window.setInterval(() => { const now = Date.now(); tickClock(d.step, (now - last) * d.speed); last = now; }, 200);
    return () => clearInterval(id);
  }, [d.on, d.paused, d.speed, d.step]);

  // after the run: one batched insert of its curve into Tiger Data (only when the service has TIGER_URL)
  useEffect(() => {
    if (!d.on || !run?.evaluation || d.tiger) return;
    setDemo({ tiger: 'Tiger Data: sending…' });
    void postSamples(run).then((r) => setDemo({ tiger: r.mode === 'live' ? `Tiger Data: ${r.inserted} rows` : 'Tiger Data: unavailable' }));
  }, [d.on, run, d.tiger]);

  const ms = step && step.ms !== 'run' ? step.ms : 0;
  // advance
  useEffect(() => {
    if (!d.on || d.paused || !step) return;
    if (step.ms === 'run') {
      if (!run?.evaluation) return;
      doneAt.current ??= elapsed;
      // the Run screen moves itself to the evaluation 900 ms after the end; follow it
      if (elapsed - doneAt.current < 1500 * d.speed) return;
    } else if (elapsed < ms) return;
    if (d.step + 1 < STEPS.length) setDemo({ step: d.step + 1 });
    else { playSound('neutral'); stop(go, '/'); }
  }, [d.on, d.paused, d.step, d.speed, step, run, elapsed, ms, go]);

  if (!d.on || !step) return null;
  const t = run?.samples.at(-1)?.t ?? 0;
  const progress = step.ms === 'run' ? (run?.evaluation ? 1 : t / 180) : elapsed / ms;
  const last = run?.samples.at(-1);
  const note = step.key === 'run' && last ? `glow ${absorbance(last.blank, last.adc90).toFixed(3)}` : step.key === 'evaluation' || step.key === 'delivery' ? d.tiger : step.key === 'bottle' ? 'demo label' : step.key === 'dashboard' ? 'SANDBOX / TESTNET' : null;
  return (
    <Caption step={d.step + 1} total={STEPS.length} label={step.label} text={step.say(run)} progress={progress} paused={d.paused} note={note}
      canNext={step.ms !== 'run' || !!run?.evaluation}
      onPause={() => setDemo({ paused: !d.paused })}
      onNext={() => (d.step + 1 < STEPS.length ? setDemo({ step: d.step + 1 }) : stop(go, '/'))}
      onExit={() => stop(go, '/demo')} />
  );
}

const SPEEDS = [1, 2, 4];

export default function Demo() {
  const [q] = useSearchParams();
  const d = useDemo();
  const go = useNavigate();
  const asked = Number(q.get('speed'));
  const [speed, setSpeed] = useState(asked >= 0.5 && asked <= 8 ? asked : 1);

  const start = () => {
    const prev = getState().mode;
    if (prev !== 'medical') actions.setMode('medical');
    playSound('tap');
    setDemo({ ...OFF, on: true, speed, prevMode: prev });
  };

  useEffect(() => { if (q.get('autoplay') === '1' && !demo.on) start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Math.round((STEPS.reduce((a, s) => a + (s.ms === 'run' ? (180 / RUN_SPEED) * 1000 + 1500 : s.ms), 0)) / speed / 1000);
  return (
    <Screen title="The two-minute demo" eyebrow="for the judging table" back="/">
      <section className="card decor-dots stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <SpinPill size={84} label="Pill" />
          <p className="serif" style={{ fontSize: 'clamp(1.35rem, 4.6vw, 1.9rem)', lineHeight: 1.15 }}>One delivery, start to hold, on the real screens.</p>
        </div>
        <ol className="stack" style={{ gap: 8, margin: 0, paddingLeft: 22 }}>
          {STEPS.map((s, i) => <li key={s.key}><span className="mono muted" style={{ fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span> {s.label}{s.key === 'run' ? ': cloudy chalk reaches the band, no glow' : ''}</li>)}
        </ol>
        <p className="footnote">Seeded week plus one live replay of lot TM-02. The label is the demo label, money is SANDBOX / TESTNET, and the run is a recorded curve (the chip on the run says REPLAY). Turn sound on.</p>
      </section>
      <div className="row" role="group" aria-label="Speed" style={{ gap: 8 }}>
        {SPEEDS.includes(speed) ? null : <span className="chip" aria-pressed>{speed}×</span>}
        {SPEEDS.map((s) => <button key={s} type="button" className="chip" aria-pressed={speed === s} onClick={() => setSpeed(s)} style={{ cursor: 'pointer', minHeight: 40 }}>{s}×</button>)}
        <span className="mono muted" style={{ fontSize: 12 }}>about {total < 90 ? `${total} s` : `${Math.round(total / 6) / 10} min`}</span>
      </div>
      {d.on
        ? <button type="button" className="btn ghost" onClick={() => stop(go, '/demo')}>The demo is running · stop it</button>
        : <button type="button" className="btn" onClick={start} data-demo-start>Start the demo</button>}
    </Screen>
  );
}
