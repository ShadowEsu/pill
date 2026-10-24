// The station's own 7-inch screen (1024 × 600, landscape). One button; the run plays inline with the capsule, the curve,
// the light path and the timetable; the verdict holds for 20 s under a countdown ring, then the station is ready again.
// Idle for 30 s while ready (?idle=N overrides), it loops a 20 s attract sequence until someone taps or presses a key.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen, SrcBadge } from '../components/Shell';
import PillFill, { VERDICT_FILL } from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import RunPhases, { clock, phaseAt } from '../components/RunPhases';
import SensorPath, { GLOW_FULL } from '../components/SensorPath';
import SpinPill from '../components/SpinPill';
import FlowArrows from '../components/FlowArrows';
import { actions, useStore } from '../lib/store';
import { replayStream } from '../lib/stream';
import { absorbance, evaluate, progressPct } from '../lib/rules';
import { useMediaQuery, useReducedMotion } from '../lib/motion';
import { playSound, verdictSound } from '../lib/sound';
import { REFERENCES } from '../data/reference';
import type { Sample, Source, Verdict } from '../lib/types';
import '../story.css';

const REF = REFERENCES.riboflavin;
const HOLD_S = 20;
const SHORT = '(max-height: 700px)';
function onShortChange(l: () => void) {
  const m = window.matchMedia(SHORT);
  m.addEventListener('change', l);
  return () => m.removeEventListener('change', l);
}

/** Countdown ring for the verdict hold: the arc empties once a second, the seconds sit inside. */
function HoldRing({ left, colour }: { left: number; colour: string }) {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" role="img" aria-label={`Ready again in ${left} seconds`}>
      <circle cx="28" cy="28" r="23" fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="28" cy="28" r="23" fill="none" stroke={colour} strokeWidth="4" strokeLinecap="round" pathLength={HOLD_S} strokeDasharray={HOLD_S}
        transform="rotate(-90 28 28)" style={{ strokeDashoffset: HOLD_S - left, transition: 'stroke-dashoffset 1s linear' }} />
      <text x="28" y="32.5" textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 14, fill: 'var(--ink)' }}>{left}</text>
    </svg>
  );
}

const WORDS: Verdict[] = ['PASS', 'NEEDS LAB', 'UNABLE TO VERIFY'];
const BEATS = [
  'A quarter tablet goes into the water.',
  'It dissolves for three minutes while the paddle stirs.',
  'Two sensors read the light through it and the glow from it.',
  'Seven fixed rules choose one of three words.',
];
const LOOP_MS = 20000, BEAT_MS = LOOP_MS / BEATS.length, WORD_MS = 2500;

/** The idle loop: the pill spinning in each verdict's light, the three words, the four beats along a flow strip. */
function Attract({ onWake }: { onWake: () => void }) {
  const reduce = useReducedMotion();
  const narrow = useMediaQuery('(max-width: 720px)');
  const short = useMediaQuery(SHORT);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t0 = performance.now();
    const id = window.setInterval(() => setMs((performance.now() - t0) % LOOP_MS), 200);
    return () => clearInterval(id);
  }, [reduce]);
  useEffect(() => {
    window.addEventListener('keydown', onWake);
    return () => window.removeEventListener('keydown', onWake);
  }, [onWake]);
  const beat = Math.floor(ms / BEAT_MS);
  const word = WORDS[Math.floor(ms / WORD_MS) % WORDS.length];
  const ids = ['tablet', 'water', 'sensors', 'verdict'];
  return (
    <div className="attract" role="button" tabIndex={0} aria-label="Station idle. Tap anywhere to begin." onClick={onWake}>
      <div className="attract-main">
        <SpinPill size={narrow ? 180 : short ? 260 : 340} speed={1.4} verdict={reduce ? null : word} label="Pill, spinning" />
        <div className="attract-words">
          <p className="eyebrow">STATION 01 · three words, never a guess</p>
          {reduce
            ? <p className="attract-word" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>PASS · NEEDS LAB · UNABLE TO VERIFY</p>
            : <p className="attract-word" aria-hidden="true"><span key={word + Math.floor(ms / WORD_MS)}>{word}</span></p>}
          <div style={{ width: 64, height: 4, borderRadius: 2, background: reduce ? 'var(--sky)' : VERDICT_FILL[word], transition: 'background .6s var(--ease)' }} />
          <p className="attract-beat">{BEATS[beat]}</p>
          <p className="attract-cta">Drop one quarter tablet to begin</p>
        </div>
      </div>
      <div className="attract-foot">
        <FlowArrows label="How a run goes"
          nodes={[
            { id: 'tablet', label: '¼ tablet', sub: 'in the water', accent: beat === 0 ? 'var(--sky)' : 'var(--line-2)' },
            { id: 'water', label: 'Dissolve', sub: '3 min, stirred', accent: beat === 1 ? 'var(--sky)' : 'var(--line-2)' },
            { id: 'sensors', label: 'Two sensors', sub: 'inline + 90°', accent: beat === 2 ? 'var(--mint)' : 'var(--line-2)' },
            { id: 'verdict', label: 'Three words', sub: 'seven rules', accent: beat === 3 ? 'var(--mint)' : 'var(--line-2)' },
          ]}
          edges={ids.slice(1).map((to, k) => ({ from: ids[k], to, live: !reduce && beat >= k + 1, color: beat === k + 1 ? 'var(--sky-ink)' : undefined }))} />
        <p className="footnote" style={{ textAlign: 'center' }}>Tap anywhere to begin · screening result, not a pharmacopeial test</p>
      </div>
    </div>
  );
}

export default function Kiosk() {
  const [q] = useSearchParams();
  const speed = Number(q.get('speed')) || 7.5;
  const idleS = Number(q.get('idle')) || 30;
  const [runId, setRunId] = useState<string | null>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [attract, setAttract] = useState(false);
  const lastInput = useRef(0);
  const run = useStore((s) => (runId ? s.runs.find((r) => r.id === runId) : undefined));
  // The 7-inch panel is 600 px tall: the capsule shrinks there so the whole station fits one screen.
  const short = useSyncExternalStore(onShortChange, () => window.matchMedia(SHORT).matches);

  // Attract mode: only while ready (no run, no verdict hold); any pointer or key input restarts the idle clock.
  useEffect(() => {
    lastInput.current = Date.now();
    const touch = () => { lastInput.current = Date.now(); };
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('keydown', touch, true);
    const id = window.setInterval(() => { if (!runId && Date.now() - lastInput.current > idleS * 1000) setAttract(true); }, 1000);
    return () => { window.removeEventListener('pointerdown', touch, true); window.removeEventListener('keydown', touch, true); clearInterval(id); };
  }, [runId, idleS]);
  const wake = useCallback(() => { lastInput.current = Date.now(); setAttract(false); }, []);

  useEffect(() => {
    if (!runId) return;
    const stream = replayStream('B2-07', speed);
    setSrc(stream.src);
    let all: Sample[] = [];
    let dirty = false;
    const off = stream.subscribe((_s, a) => { all = a; dirty = true; });
    const flush = window.setInterval(() => { if (dirty) { dirty = false; actions.appendSamples(runId, all.slice()); } }, 250);
    const offEnd = stream.onEnd((a) => {
      clearInterval(flush);
      actions.appendSamples(runId, a.slice());
      const ev = evaluate(a, REF);
      actions.finishRun(runId, ev);
      playSound(verdictSound(ev.verdict));
      setLeft(HOLD_S);
    });
    return () => { stream.stop(); off(); offEnd(); clearInterval(flush); };
  }, [runId, speed]);

  useEffect(() => {
    if (left === null) return;
    const t = window.setTimeout(() => {
      if (left > 1) { setLeft(left - 1); return; }
      setRunId(null); setSrc(null); setLeft(null);
    }, 1000);
    return () => clearTimeout(t);
  }, [left]);

  const samples = run?.samples ?? [];
  const last = samples.at(-1);
  const t = last?.t ?? 0;
  const ev = run?.evaluation ?? null;
  const pct = progressPct(samples, REF);
  const phase = phaseAt(t);
  const running = !!run && !ev;
  const status = !run ? 'ready' : phase.status;
  const doing = !run ? 'Place a quarter tablet, close the lid, press Start.' : `${phase.doing[0].toUpperCase()}${phase.doing.slice(1)}.`;

  return (
    <Screen title="Pill" eyebrow={`STATION 01 · ${REF.label}`} right={src ? <SrcBadge src={src} /> : <span className="chip ok"><span className="dot" />ready</span>}>
      <div className="wide-2" style={{ flex: 1, minHeight: 0, alignItems: 'center' }}>
        <section className="card glass decor-dots" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 20, minWidth: 0, padding: '22px 16px' }}>
          {ev ? (
            <>
              <div className="rise" style={{ flex: 'none' }}><PillFill pct={100} verdict={ev.verdict} size={short ? 180 : 230} /></div>
              <div className="rise stack" style={{ gap: 10, minWidth: 0, flex: '1 1 200px', animationDelay: '80ms' }}>
                <p className="eyebrow">rule {ev.rule} · run {run?.id}</p>
                <h2 className="serif" data-verdict={ev.verdict} style={{ fontSize: ev.verdict === 'PASS' ? 88 : 56, lineHeight: 0.95, fontWeight: 400, letterSpacing: '-0.01em' }}>{ev.verdict}</h2>
                <div style={{ width: 56, height: 3, borderRadius: 2, background: VERDICT_FILL[ev.verdict] }} />
                <p className="mono" style={{ fontSize: 15 }}>{ev.pct} % of reference</p>
                <p style={{ color: 'var(--ink-2)' }}>Next: {ev.nextStep}.</p>
                <p className="footnote">Screening result, not a pharmacopeial test.</p>
                <div className="row" style={{ gap: 10 }}>
                  <HoldRing left={left ?? 0} colour={VERDICT_FILL[ev.verdict]} />
                  <span className="mono muted" style={{ fontSize: 13 }}>ready again in {left ?? 0} s</span>
                </div>
              </div>
            </>
          ) : (
            <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
              <PillFill pct={pct} size={short ? 220 : 320} running={running} />
              <p className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{status}</p>
              <p style={{ fontSize: 18, textAlign: 'center', color: 'var(--ink-2)', maxWidth: 420 }} aria-live="polite">{doing}</p>
              <p className="mono muted" style={{ fontSize: 14 }}>{clock(t)} / 3:00{run ? ` · ${pct} % of reference` : ''}</p>
            </div>
          )}
        </section>
        <section className="card stack" style={{ gap: 8, minWidth: 0 }}>
          <div className="row between"><span className="eyebrow">absorbance</span><span className="mono muted" style={{ fontSize: 12 }}>{last ? `${last.temp.toFixed(1)} °C` : '—'}</span></div>
          <Curve samples={samples} band={REF} width={460} height={160} live={running} />
          <hr className="hr" />
          <div className="row between"><span className="eyebrow">light path</span><span className="mono muted" style={{ fontSize: 12 }}>{running ? 'reading once a second' : 'idle'}</span></div>
          <div style={{ maxWidth: short ? 280 : 330, width: '100%', margin: '0 auto' }}>
            <SensorPath led={last?.led ?? !!run} inline={last ? last.adc0 / last.blank : 1} glow={last ? absorbance(last.blank, last.adc90) / GLOW_FULL : 0} running={running} />
          </div>
          <RunReadout samples={samples} strip={false} />
        </section>
      </div>
      <section className="card" style={{ padding: '12px 18px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}><RunPhases t={t} legend={false} big /></div>
        <button type="button" className="btn" style={{ flex: '1 0 280px', width: 'auto' }} disabled={running} onClick={() => { setLeft(null); playSound('rise'); setRunId(actions.startRun({ drug: 'riboflavin', lot: 'B2-07', src: 'replay' }).id); }}>
          {running ? `Running · ${clock(t)} / 3:00` : ev ? 'Start again (replay B2-07)' : 'Start (replay B2-07)'}
        </button>
      </section>
      {attract && !runId && <Attract onWake={wake} />}
    </Screen>
  );
}
