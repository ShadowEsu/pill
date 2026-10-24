// The station's own 7-inch screen (1024 × 600, landscape). One button; the run plays inline with the capsule, the curve,
// the light path and the timetable; the verdict holds for 20 s under a countdown ring, then the station is ready again.
// Idle for 30 s while ready (?idle=N overrides), it loops a 20 s attract sequence until someone taps or presses a key:
// the site's binary pill on the dark navy panel, full bleed, with the three words cycling in serif and the four beats.
// Type is sized for 1024 × 600 at arm's length; the verdict word stamps in (the sound plays when the run ends).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen, SrcBadge } from '../components/Shell';
import PillFill, { VERDICT_FILL } from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import RunPhases, { clock, phaseAt } from '../components/RunPhases';
import SensorPath, { GLOW_FULL } from '../components/SensorPath';
import BinaryPill from '../components/BinaryPill';
import Stamp from '../components/Stamp';
import { actions, useStore } from '../lib/store';
import { replayStream } from '../lib/stream';
import { absorbance, evaluate, progressPct } from '../lib/rules';
import { useMediaQuery, useReducedMotion } from '../lib/motion';
import { playSound, verdictSound } from '../lib/sound';
import { REFERENCES } from '../data/reference';
import type { Sample, Source, Verdict } from '../lib/types';
import '../story.css';
import '../components/cinema.css';

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

/** Window size, for the full-bleed canvas. */
function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

/** The idle loop: the binary pill on the navy panel, the three words cycling in serif, the four beats with a progress strip. */
function Attract({ onWake }: { onWake: () => void }) {
  const reduce = useReducedMotion();
  const narrow = useMediaQuery('(max-width: 720px)');
  const { w, h } = useViewport();
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
  const wordAt = Math.floor(ms / WORD_MS);
  const word = WORDS[wordAt % WORDS.length];
  // the pill sits right of the words on the 1024 × 600 panel, behind them on a phone
  const cw = narrow ? w : Math.round(w * 0.64), ch = narrow ? Math.round(h * 0.62) : h;
  return (
    <div className="cn-attract" role="button" tabIndex={0} aria-label="Station idle. Tap anywhere to begin." onClick={onWake}>
      <BinaryPill width={cw} height={ch} dark scale={narrow ? 3.4 : 2.5} className="cn-attract-pill" label="Pill, drawn in ones and zeros" />
      <div className="cn-attract-main">
        <p className="eyebrow">STATION 01 · three words, never a guess</p>
        {reduce
          ? <p className="cn-attract-word" style={{ fontSize: 'clamp(40px, 6vw, 64px)', minHeight: 0 }}>PASS · NEEDS LAB · UNABLE TO VERIFY</p>
          : <p className="cn-attract-word" aria-hidden="true"><span key={wordAt}>{word}</span></p>}
        <div className="cn-attract-bar" style={{ background: reduce ? 'var(--sky)' : VERDICT_FILL[word] }} />
        <p key={beat} className="cn-attract-beat cn-field">{BEATS[beat]}</p>
        <div className="cn-dots" aria-hidden="true" style={{ '--beat': `${BEAT_MS}ms` } as React.CSSProperties}>
          {BEATS.map((_, i) => <i key={i + (i === beat ? '-on' : '')} className={i === beat ? 'on' : i < beat ? 'past' : undefined} style={i < beat ? { background: 'rgba(255,255,255,.8)' } : undefined} />)}
        </div>
        <p className="cn-attract-cta">Drop one quarter tablet to begin</p>
      </div>
      <div className="cn-attract-foot">
        <span>Tap anywhere to begin · screening result, not a pharmacopeial test</span>
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
  const startBtn = (
    <button type="button" className={'btn' + (!running ? ' cn-ready' : '')} style={{ flex: short ? 'none' : '1 0 280px', width: short ? '100%' : 'auto', minHeight: short ? 64 : 72, fontSize: 22 }} disabled={running} onClick={() => { setLeft(null); playSound('rise'); setRunId(actions.startRun({ drug: 'riboflavin', lot: 'B2-07', src: 'replay' }).id); }}>
      {running ? `Running · ${clock(t)} / 3:00` : ev ? 'Start again (replay B2-07)' : 'Start (replay B2-07)'}
    </button>
  );

  return (
    <Screen title="Pill" eyebrow={`STATION 01 · ${REF.label}`} tone={ev ? (ev.verdict === 'PASS' ? 'mint' : ev.verdict === 'NEEDS LAB' ? 'amber' : 'none') : 'sky'}
      right={src ? <SrcBadge src={src} /> : <span className="chip ok beat"><span className="dot" />ready</span>}>
      <div className="wide-2 cn-kiosk" style={{ flex: 1, minHeight: 0, alignItems: 'center' }}>
        <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        <section className={'card glass decor-dots cn-hero' + (ev ? ' cn-verdict-hero' : '')} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 20, minWidth: 0, padding: short ? '14px 16px' : '22px 16px', '--hero': ev ? `color-mix(in srgb, ${VERDICT_FILL[ev.verdict]} 35%, transparent)` : undefined } as React.CSSProperties}>
          {ev ? (
            <>
              <div className="cn-pillwrap" style={{ flex: 'none' }}><PillFill pct={100} verdict={ev.verdict} size={short ? 190 : 240} /></div>
              <div className="rise stack" style={{ gap: 10, minWidth: 0, flex: '1 1 200px', animationDelay: '80ms' }}>
                <p className="eyebrow" style={{ fontSize: 13 }}>rule {ev.rule} · run {run?.id}</p>
                <h2 style={{ fontWeight: 400 }}><Stamp verdict={ev.verdict} size={ev.verdict === 'PASS' ? 88 : 54} sound={false} delay={120} /></h2>
                <p className="mono" style={{ fontSize: 18 }}>{ev.pct} % of reference</p>
                <p style={{ color: 'var(--ink-2)', fontSize: 20 }}>Next: {ev.nextStep}.</p>
                <p className="footnote">Screening result, not a pharmacopeial test.</p>
                <div className="row" style={{ gap: 10 }}>
                  <HoldRing left={left ?? 0} colour={VERDICT_FILL[ev.verdict]} />
                  <span className="mono muted" style={{ fontSize: 15 }}>ready again in {left ?? 0} s</span>
                </div>
              </div>
            </>
          ) : (
            <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
              <div className="cn-pillwrap"><PillFill pct={pct} size={short ? 180 : 330} running={running} /></div>
              <p className="serif" style={{ fontSize: short ? 42 : 46, lineHeight: 1 }}>{status}</p>
              <p style={{ fontSize: 21, textAlign: 'center', color: 'var(--ink-2)', maxWidth: 440, lineHeight: 1.3 }} aria-live="polite">{doing}</p>
              <p className="mono muted" style={{ fontSize: 16 }}>{clock(t)} / 3:00{run ? ` · ${pct} % of reference` : ''}</p>
            </div>
          )}
        </section>
        {short && startBtn}
        </div>
        <section className="card stack" style={{ gap: short ? 6 : 8, minWidth: 0, padding: short ? '12px 16px' : undefined }}>
          <div className="row between"><span className="eyebrow">absorbance</span><span className="mono muted" style={{ fontSize: 12 }}>{last ? `${last.temp.toFixed(1)} °C` : '—'}</span></div>
          <Curve samples={samples} band={REF} width={460} height={short ? 118 : 160} live={running} />
          <hr className="hr" />
          <div className="row between"><span className="eyebrow">light path</span><span className="mono muted" style={{ fontSize: 12 }}>{running ? 'reading once a second' : 'idle'}</span></div>
          <div style={{ maxWidth: short ? 240 : 330, width: '100%', margin: '0 auto' }}>
            <SensorPath led={last?.led ?? !!run} inline={last ? last.adc0 / last.blank : 1} glow={last ? absorbance(last.blank, last.adc90) / GLOW_FULL : 0} running={running} />
          </div>
          {short
            ? <div className="cn-phases" style={{ paddingTop: 4 }}><RunPhases t={t} legend={false} big /></div>
            : <RunReadout samples={samples} strip={false} />}
        </section>
      </div>
      {!short && (
        <section className="card cn-phases" style={{ padding: '12px 18px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}><RunPhases t={t} legend={false} big /></div>
          {startBtn}
        </section>
      )}
      {attract && !runId && <Attract onWake={wake} />}
    </Screen>
  );
}
