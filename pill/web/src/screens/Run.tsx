// The run, as the station does it (SOFTWARE-PLAN §2, pill/pay/src/station.ts): lights off (3 s, the box must read dark) →
// clear water (10 s, the blank has to hold under 2 % CV) → drop the tablet (the inline light falls 6 %) → dissolving (the
// capsule fills, the curve draws, the 90° glow meter) → settling (20 s with |dA/dt| under ε) → verdict. The PhaseRail on
// top (phone) or at the left (desktop) walks those phases; one scene card morphs between them. Ends on the evaluation.
// Replays play the same choreography (lib/stream replayStream phases); a live station (?station=1 → ?srun=) maps the
// bridge's `state` events onto the rail and its fault message shows in the scene. A fault before the tablet goes in
// (light leak, unstable water) stays on its scene with a Retry instead of moving on.
// 'Let the checker watch' (a tap, never automatic) opens the camera and takes 3 frames of the cup a second apart (or a
// chosen photo/video); they stay in memory for the Gemini checker on the evaluation screen.
// Dissolving: the capsule grows in to the column width; beside it a dark "90° glow" meter lights mint only when riboflavin
// glows (chalk leaves it dark). The moment: once the glow has stayed flat past 40 s while something dissolves, a quiet
// amber wash spreads behind the capsule and the status turns into one serif sentence.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Action, Screen, SrcBadge, type Tone } from '../components/Shell';
import CameraCapture from '../components/CameraCapture';
import { getRunFrames, setRunFrames } from '../lib/camera';
import PillFill from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import RunPhases, { PHASES, clock, phaseAt, type PhaseKey } from '../components/RunPhases';
import PhaseRail, { curveMarks } from '../components/PhaseRail';
import DarkCheck from '../components/phases/DarkCheck';
import WaterCheck from '../components/phases/WaterCheck';
import DropTablet from '../components/phases/DropTablet';
import Settling from '../components/phases/Settling';
import SensorPath, { GLOW_FULL } from '../components/SensorPath';
import { Words } from '../components/TypeIn';
import { actions, getState, useStore } from '../lib/store';
import { liveStream, replayStream, type PreReading, type StateEvent, type StationStream } from '../lib/stream';
import { startStationRun, stationStreamUrl } from '../lib/station';
import { absorbance, evaluate, progressPct } from '../lib/rules';
import { playSound } from '../lib/sound';
import { DRUGS, REFERENCES, REPLAYS } from '../data/reference';
import type { Sample, Source } from '../lib/types';
import '../components/cinema.css';

const FAULT_WORDS: Record<string, string> = { lid_open: 'lid opened', led_fail: 'LED failed', temp_out: 'water temperature out of range', no_blank: 'no clear-water reading' };
const WIDE = '(min-width: 900px)';
const MOMENT = 'Something is dissolving. Nothing is glowing.';
const ORDER = PHASES.map((p) => p.key);
/** Each phase stays on screen at least this long: a fast replay can move faster than the eye. */
const DWELL = 1300;
const TITLE: Record<PhaseKey, string> = { dark: 'Lights off', blank: 'Clear water', drop: 'Drop the tablet', dissolve: 'Dissolving…', settle: 'Settling…', verdict: 'Done' };
const TONE: Record<PhaseKey, Tone> = { dark: 'violet', blank: 'sky', drop: 'sky', dissolve: 'sky', settle: 'violet', verdict: 'none' };
function onWideChange(l: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', l);
  return () => m.removeEventListener('change', l);
}

/** The 90° channel as a vertical meter: dark track, mint light rising with the glow once it is above the 0.05 noise floor
 *  (chalk leaves it dark), a bulb that lights at the reference's glow minimum. */
function GlowMeter({ glow, lit, on }: { glow: number; lit: boolean; on: boolean }) {
  const g = Math.max(0, Math.min(1, glow));
  return (
    <div className="cn-meter" role="meter" aria-label="90 degree glow" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g * 100)}>
      <span className="eyebrow" style={{ fontSize: 9.5, letterSpacing: '.06em' }}>90°</span>
      <span className="cn-meter-track">
        {[0.25, 0.5, 0.75].map((k) => <span key={k} className="cn-meter-tick" style={{ bottom: `${k * 100}%` }} />)}
        <span className="cn-meter-fill" style={{ height: lit ? `${g * 100}%` : 0, opacity: lit ? 1 : 0 }} />
      </span>
      <span className={'cn-meter-bulb' + (on ? ' on' : '')} />
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{Math.round(g * 100)} %</span>
    </div>
  );
}

export default function Run() {
  const { id = '' } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const asked = q.get('replay') ?? 'B2-07';
  const key = asked in REPLAYS ? asked : 'B2-07';
  const speed = Number(q.get('speed')) || 7.5;
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const personal = useStore((s) => s.mode) === 'personal';
  const wide = useSyncExternalStore(onWideChange, () => window.matchMedia(WIDE).matches);
  const [src, setSrc] = useState<Source | null>(null);
  const [finishedHere, setFinishedHere] = useState(false);
  const [showCurve, setShowCurve] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watched, setWatched] = useState(() => getRunFrames(id).length);
  const created = useRef(false);
  // the station's phases as they arrive: its state, when it changed, the dark and clear-water readings, the latched blank
  const [bridge, setBridge] = useState<StateEvent | null>(null);
  const [stateAt, setStateAt] = useState(() => Date.now());
  const [darkR, setDarkR] = useState<PreReading[]>([]);
  const [blankR, setBlankR] = useState<PreReading[]>([]);
  const [latched, setLatched] = useState<number | null>(null);
  const [unstable, setUnstable] = useState(false);
  const [preFault, setPreFault] = useState<{ phase: 'dark' | 'blank'; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const streamRef = useRef<StationStream | null>(null);
  const finishing = useRef(false);

  // /run/new (or an unknown id): make the run, then land on its real id. ?station=1 asks the pay service's station for a
  // run first (dark → blank → start); the station's run id rides along as ?srun=. No station → the replay, as before.
  useEffect(() => {
    if (run || created.current) return;
    created.current = true;
    const rep = REPLAYS[key];
    const make = (live: { runId: string; src: Source } | null) => {
      const next = new URLSearchParams(q);
      next.delete('station');
      if (live) next.set('srun', live.runId);
      const r = live
        ? actions.startRun({ drug: q.get('drug') ?? rep.drug, lot: q.get('lot') ?? rep.lot, src: live.src, bottleId: q.get('bottle'), deliveryId: q.get('delivery') })
        : actions.startRun({ drug: rep.drug, lot: rep.lot, src: 'replay', bottleId: q.get('bottle'), deliveryId: q.get('delivery') });
      nav(`/run/${r.id}?${next.toString()}`, { replace: true });
    };
    if (q.has('station')) void startStationRun().then(make);
    else make(null);
  }, [run, key, q, nav]);

  // a station run streams its samples from the pay service; everything else replays, phases first (held long enough to see)
  const srun = q.get('srun');
  const liveSrc: Source | null = run && srun && run.src !== 'replay' ? run.src : null;
  const refDrug = liveSrc ? run?.drug ?? '' : REPLAYS[key]?.drug ?? run?.drug ?? '';
  const ref = run ? REFERENCES[refDrug] ?? null : null;
  const needsStream = !!run && !run.evaluation;
  const preMs = useMemo(() => (liveSrc ? { dark: 3000, blank: 10000 } : { dark: Math.max(3000 / speed, 1800), blank: Math.max(10000 / speed, 3200) }), [liveSrc, speed]);
  useEffect(() => {
    if (!needsStream) return;
    const stream = liveSrc && srun ? liveStream(stationStreamUrl(srun), liveSrc, srun) : replayStream(key, speed, { phases: preMs });
    streamRef.current = stream;
    finishing.current = false;
    setSrc(stream.src);
    setBridge(null); setDarkR([]); setBlankR([]); setLatched(null); setUnstable(false); setPreFault(null); setFinishedHere(false);
    let cur: StateEvent['state'] = 'idle';
    let all: Sample[] = [];
    let dirty = false;
    const off = stream.subscribe((s, a) => { all = a; dirty = true; setLatched((v) => v ?? (s.blank > 0 ? s.blank : null)); });
    const offState = stream.onState((e) => {
      if (e.state === 'fault' && (cur === 'dark' || cur === 'blank')) setPreFault({ phase: cur, message: e.message ?? 'the station stopped' });
      if (e.state === 'blank' && e.message) setUnstable(true);
      if (e.state !== cur && (e.state === 'dark' || e.state === 'blank' || e.state === 'running')) { cur = e.state; setStateAt(Date.now()); }
      setBridge(e);
    });
    const offPre = stream.onPre((r) => {
      if (r.state === 'dark') setDarkR((a) => [...a, r]);
      else { setBlankR((a) => [...a, r].slice(-30)); if (r.blank != null) setLatched(r.blank); }
    });
    const flush = window.setInterval(() => { if (dirty) { dirty = false; actions.appendSamples(id, all.slice()); } }, 250);
    const offEnd = stream.onEnd((a) => {
      clearInterval(flush);
      actions.appendSamples(id, a.slice());
      actions.finishRun(id, evaluate(a, REFERENCES[refDrug] ?? null));
      setFinishedHere(true);
    });
    return () => { stream.stop(); off(); offState(); offPre(); offEnd(); clearInterval(flush); streamRef.current = null; };
  }, [id, needsStream, key, speed, liveSrc, srun, refDrug, preMs]);

  // the soft chime when the clear-water blank latches
  useEffect(() => { if (latched != null) playSound('tick', { step: 3 }); }, [latched]);

  const samples = useMemo(() => run?.samples ?? [], [run?.samples]);
  const marks = useMemo(() => curveMarks(samples), [samples]);
  const last = samples.at(-1);
  const t = last?.t ?? 0;
  const faultIdx = samples.findIndex((s) => s.fault);
  const fault = faultIdx >= 0 ? samples[faultIdx] : null;
  const evaluation = run?.evaluation ?? null;

  // where the run is: the station's own state before the paddle starts, then the curve (6 % drop, settling, plateau)
  const curvePhase: PhaseKey = marks.drop == null ? 'drop' : marks.settle == null ? 'dissolve' : 'settle';
  const target: PhaseKey = preFault ? preFault.phase
    : fault ? curvePhase
    : evaluation ? 'verdict'
    : !bridge || bridge.state === 'idle' || bridge.state === 'dark' ? 'dark'
    : bridge.state === 'blank' ? 'blank'
    : marks.plateau != null ? 'verdict'
    : curvePhase;
  const happened: Record<PhaseKey, boolean> = { dark: true, blank: true, drop: true, dissolve: marks.drop != null, settle: marks.settle != null, verdict: true };
  const [shown, setShown] = useState<PhaseKey | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const happenedKey = ORDER.filter((k) => happened[k]).join();
  useEffect(() => {
    if (!run) return;
    const ti = ORDER.indexOf(target), si = shown ? ORDER.indexOf(shown) : -1;
    // first paint (or a retest that started over): no walk-through
    if (si < 0 || ti < si || !needsStream && !finishedHere) { if (shown !== target) { setShown(target); setShownAt(Date.now()); } return; }
    if (ti === si) return;
    let next = si + 1;
    while (next < ti && !happenedKey.split(',').includes(ORDER[next])) next++;
    const hold = DWELL + (shown === 'blank' && latched == null ? 900 : 0);
    const timer = window.setTimeout(() => { setShown(ORDER[next]); setShownAt(Date.now()); }, Math.max(0, hold - (Date.now() - shownAt)));
    return () => clearTimeout(timer);
  }, [run, target, shown, shownAt, happenedKey, latched, needsStream, finishedHere]);
  const at: PhaseKey = shown ?? target;

  // the replay ends where the station would: the plateau window closed, so the rest of the recording is handed over at once
  useEffect(() => {
    if (liveSrc || fault || marks.plateau == null || finishing.current || !streamRef.current) return;
    finishing.current = true;
    streamRef.current.finish();
  }, [liveSrc, fault, marks.plateau]);

  // a wall clock for the two timed pre-run phases
  useEffect(() => {
    if (at !== 'dark' && at !== 'blank') return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [at]);

  // the verdict is on the rail: move to the evaluation (a fault before the tablet went in stays put, with its Retry)
  useEffect(() => {
    if (!finishedHere || preFault || at !== target) return;
    const timer = window.setTimeout(() => nav(`/evaluation/${id}`, { replace: true }), 1100);
    return () => clearTimeout(timer);
  }, [finishedHere, preFault, at, target, id, nav]);

  if (!run) return <Screen title="Starting…"><p className="muted">Preparing the run.</p></Screen>;

  const phase = phaseAt(t, { drop: marks.drop, settle: marks.settle, end: evaluation ? t : null });
  const pctNow = ref ? progressPct(fault ? samples.slice(0, Math.max(1, faultIdx)) : samples, ref) : Math.round((t / 180) * 100);
  const running = !evaluation && !fault;
  const glowNow = last ? absorbance(last.blank, last.adc90) : 0;
  const glowFlat = phase.key === 'dissolve' && t > 40 && glowNow < 0.05;
  const glowRising = phase.key === 'dissolve' && glowNow >= 0.05;
  // the moment: the glow has stayed flat past 40 s while the tablet dissolves; it holds until the verdict lands
  const moment = !fault && !!ref && t > 40 && glowNow < 0.05 && phase.key !== 'drop' && (running || evaluation?.rule === 'N2');
  const happening = glowFlat ? 'something is dissolving; the glow channel is staying flat'
    : glowRising ? 'riboflavin is leaving the tablet; the glow channel is rising'
    : phase.key === 'settle' && !ref ? 'the reading is settling; there is no band to compare against'
    : phase.doing;
  const faultText = fault ? `${FAULT_WORDS[fault.fault ?? ''] ?? (fault.fault ?? '').replace('_', ' ')} at ${clock(fault.t)}` : null;
  const statusWord = faultText ? 'stopped' : evaluation ? 'finished' : phase.status;
  const statusLine = faultText ? `Stopped: ${faultText}.`
    : evaluation ? `Finished: ${evaluation.verdict}, rule ${evaluation.rule}.`
    : !ref ? `No reference for ${DRUGS[run.drug]?.name.toLowerCase() ?? run.drug}. Recording anyway; ${happening}.`
    : `${happening[0].toUpperCase()}${happening.slice(1)}.`;

  // the rail: how far into the current phase, and its clock in station seconds
  const live = bridge?.state === at;
  const preP = (ms: number) => (live ? Math.max(0, Math.min(1, (now - stateAt) / ms)) : ORDER.indexOf(at) < ORDER.indexOf(target) ? 1 : 0);
  const progress = at === 'dark' ? preP(preMs.dark)
    : at === 'blank' ? preP(preMs.blank)
    : at === 'drop' ? (marks.drop != null ? 1 : Math.min(1, (1 - marks.inline) / 0.06))
    : at === 'dissolve' ? (ref ? pctNow / 100 : Math.min(1, t / 110))
    : at === 'settle' ? marks.window
    : 1;
  const railClock = at === 'dark' ? `${(progress * 3).toFixed(1)} / 3 s`
    : at === 'blank' ? `${Math.floor(progress * 10)} / 10 s`
    : at === 'drop' ? (marks.drop != null ? `dropped at ${clock(marks.drop)}` : `${clock(t)} waiting`)
    : at === 'dissolve' ? `${clock(t)}${ref ? ` · ${pctNow} %` : ''}`
    : at === 'settle' ? `${clock(t)} · ${Math.round(marks.window * 20)} / 20 s flat`
    : evaluation ? `${marks.plateau != null ? `plateau ${clock(marks.plateau)}` : clock(t)} · rule ${evaluation.rule}` : clock(t);
  const railNote = preFault ? preFault.message
    : faultText ? (bridge?.state === 'fault' && bridge.message ? `Stopped: ${bridge.message}.` : `Stopped: ${faultText}.`)
    : bridge?.message && bridge.state !== 'plateau' && bridge.state !== 'timeout' && !(marks.drop != null && /drop/i.test(bridge.message)) ? bridge.message
    : null;
  const axisT = at === 'dark' ? -13 + 3 * progress : at === 'blank' ? -10 + 10 * progress : t;

  const retest = async () => {
    const s = getState();
    const links = { bottleId: s.bottles.find((b) => b.runId === id)?.id ?? null, deliveryId: s.deliveries.find((d) => d.runId === id)?.id ?? null };
    const next = new URLSearchParams(q);
    next.delete('srun');
    // a station run retests on the station; if it has gone away, the retest is a replay and says so
    const again = liveSrc ? await startStationRun() : null;
    if (again) next.set('srun', again.runId);
    else next.set('replay', key === 'B2-LID' ? 'B2-07' : key);
    const r = actions.startRun({ drug: run.drug, lot: run.lot, src: again ? again.src : liveSrc ? 'replay' : run.src, ...links });
    nav(`/run/${r.id}?${next.toString()}`, { replace: true });
  };

  const curveCard = (
    <div key="curve" className="card tile stack cn-field" style={{ '--tile-accent': 'var(--c1)', gap: 10 } as React.CSSProperties}>
      <div className="row between"><span className="eyebrow">absorbance · live</span><span className="mono muted" style={{ fontSize: 12 }}>{samples.length} samples</span></div>
      <Curve samples={samples} band={ref} live={running} />
    </div>
  );
  const sensorCard = (
    <div key="sensor" className={'card tile stack cn-field' + (wide ? ' cn-sensor-big' : '')} style={{ '--tile-accent': moment ? 'var(--amber)' : 'var(--c2)', gap: 10, animationDelay: '60ms' } as React.CSSProperties}>
      <div className="row between"><span className="eyebrow">light path</span><span className="mono muted" style={{ fontSize: 12 }}>{running ? 'reading once a second' : 'idle'}</span></div>
      <SensorPath led={at === 'dark' ? false : last?.led ?? true} inline={last ? last.adc0 / last.blank : 1} glow={glowNow / GLOW_FULL} running={running && at !== 'dark'} />
      {moment && <p className="footnote cn-field">Inline: the light is dimming, so something is in the water. 90°: dark. Riboflavin would glow here.</p>}
    </div>
  );

  const heroScene = at === 'dissolve' || at === 'verdict';
  const sceneWash = moment && (at === 'dissolve' || at === 'settle');
  const scene = at === 'dark' ? <DarkCheck key="dark" readings={darkR} progress={progress} secs={progress * 3} fault={preFault?.phase === 'dark' ? preFault.message : null} onRetry={retest} />
    : at === 'blank' ? <WaterCheck key="blank" readings={blankR} progress={progress} secs={progress * 10} latched={latched} unstable={unstable} fault={preFault?.phase === 'blank' ? preFault.message : null} onRetry={retest} />
    : at === 'drop' ? <DropTablet key="drop" inline={marks.inline} dropped={marks.drop != null} waited={t} prompt={bridge?.message && /drop/i.test(bridge.message) ? bridge.message : null} />
    : at === 'settle' ? <Settling key="settle" samples={samples} band={ref} marks={marks} moment={moment} />
    : (
      <div key="dissolve" className="ph-in" style={{ maxWidth: 'none', gap: 6 }}>
        <div className="cn-hero-row">
          <div className="cn-pillwrap">
            <PillFill pct={pctNow} verdict={evaluation?.verdict ?? null} fault={!!fault} size={wide ? 380 : 420} label={!!ref} running={running} />
          </div>
          {ref && <GlowMeter glow={glowNow / GLOW_FULL} lit={glowNow >= 0.05} on={glowNow >= ref.glowMin} />}
        </div>
        <p className="serif" style={{ fontSize: personal ? 38 : 34, lineHeight: 1, marginTop: 6 }}>{statusWord}</p>
        {moment && !evaluation
          ? <p className="cn-moment" aria-live="polite"><Words text={MOMENT} step={90} /></p>
          : <p style={{ fontSize: personal ? 19 : 16, color: 'var(--ink-2)', textAlign: 'center', maxWidth: 420, minHeight: '2.9em' }} aria-live="polite">{statusLine}</p>}
        <p className="mono muted" style={{ fontSize: 13 }}>{clock(t)} / 3:00{ref ? ` · ${pctNow} % of reference` : ''}</p>
      </div>
    );

  return (
    <Screen title={preFault || (fault && at !== 'verdict') ? 'Stopped' : TITLE[at]} eyebrow={`run ${run.id} · ${run.drug} · lot ${run.lot}`} back="/" right={<SrcBadge src={src ?? run.src} />}
      tone={moment && at !== 'verdict' ? 'amber' : TONE[at]}>
      <div className="ph-run">
        <PhaseRail at={at} progress={progress} clock={railClock} note={railNote} fault={!!preFault || !!fault} verdict={at === 'verdict' ? evaluation?.verdict ?? null : null} />
        <div className="wide-2 cn-run">
          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            <section className={`card ph-scene ph-s-${at} cn-hero${heroScene ? ' glass decor-dots' : ''}${sceneWash ? ' moment' : ''}`} data-phase={at} data-moment={moment || undefined} aria-label={`${PHASES.find((p) => p.key === at)?.name} scene`}>
              <span className="cn-wash" aria-hidden="true" />
              {scene}
            </section>
            {!watching && at !== 'dark' && at !== 'blank' && !preFault && (
              <div className="stack" style={{ gap: 6, width: '100%' }}>
                <button type="button" className="btn ghost" data-action="watch" onClick={() => setWatching(true)} style={{ minHeight: 52 }}>
                  {watched ? 'Let the checker watch again' : 'Let the checker watch'}
                </button>
                {watched > 0 && <span className="chip ok" style={{ alignSelf: 'center' }} data-watched={watched}><span className="dot" />{watched} frame{watched === 1 ? '' : 's'} kept for the checker · not saved</span>}
              </div>
            )}
            {watching && (
              <CameraCapture count={3} title="The checker watches the cup" onCancel={() => setWatching(false)}
                onFrames={(f) => { setRunFrames(run.id, f); setWatched(Math.min(3, f.length)); setWatching(false); }} />
            )}
            <section className="card stack cn-phases" style={{ gap: 6 }}>
              <div className="row between"><span className="eyebrow">timetable</span><span className="mono muted" style={{ fontSize: 12 }}>{liveSrc ? `${liveSrc === 'sim' ? 'simulated station' : 'live station'} · 1 line/s` : `${speed}× replay`}</span></div>
              <RunPhases t={axisT} marks={{ drop: marks.drop, settle: marks.settle, end: evaluation && !fault ? t : null }} fault={fault ? fault.t : preFault ? axisT : null} done={at === 'verdict' && !fault} big={personal} />
            </section>
            {fault && !preFault && (
              <div className="card stack cn-field" style={{ gap: 6, borderColor: 'rgba(154,160,166,.6)' }}>
                <p className="eyebrow">station fault</p>
                <p>The {FAULT_WORDS[fault.fault ?? ''] ?? 'station faulted'} at {clock(fault.t)}. {personal ? 'This reading cannot be used. Start again with a new piece of tablet.' : 'The curve after this point cannot be trusted; this run will end as UNABLE TO VERIFY (U2). Retest with a new tablet and the lid closed.'}</p>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            {personal ? (
              <>
                <RunReadout samples={samples} strip={false} />
                <button type="button" className="btn ghost" aria-expanded={showCurve} onClick={() => setShowCurve((v) => !v)}>{showCurve ? 'Hide the curve' : 'Show the curve'}</button>
                {showCurve && <>{curveCard}{sensorCard}<RunReadout samples={samples} checks={false} /></>}
              </>
            ) : (
              <>
                {wide ? <>{sensorCard}{curveCard}</> : <>{curveCard}{sensorCard}</>}
                <RunReadout samples={samples} />
              </>
            )}
          </div>
        </div>
      </div>

      {(fault || preFault || (evaluation && !finishedHere)) && (
        <Action>
          {fault && !preFault && <button type="button" className="btn" onClick={retest}>Retest</button>}
          {evaluation && (!finishedHere || preFault) && <button type="button" className={fault || preFault ? 'btn ghost' : 'btn'} onClick={() => nav(`/evaluation/${id}`)}>See the evaluation</button>}
        </Action>
      )}
    </Screen>
  );
}
