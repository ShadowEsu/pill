// The run: the capsule fills as the tablet dissolves, the timetable walks fill → dissolve → settle → hold, the curve draws,
// the light path shows which channel is moving, the station checks stay visible. Ends on the evaluation.
// Motion: the capsule grows in to the column width; beside it a dark "90° glow" meter lights mint only when riboflavin
// glows (chalk leaves it dark). The moment: once the glow has stayed flat past 40 s while something dissolves, a quiet
// amber wash spreads behind the capsule and the status turns into one serif sentence. The current timetable block pulses.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Action, Screen, SrcBadge } from '../components/Shell';
import PillFill from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import RunPhases, { clock, phaseAt } from '../components/RunPhases';
import SensorPath, { GLOW_FULL } from '../components/SensorPath';
import { Words } from '../components/TypeIn';
import { actions, getState, useStore } from '../lib/store';
import { replayStream } from '../lib/stream';
import { absorbance, evaluate, progressPct } from '../lib/rules';
import { DRUGS, REFERENCES, REPLAYS } from '../data/reference';
import type { Sample, Source } from '../lib/types';
import '../components/cinema.css';

const FAULT_WORDS: Record<string, string> = { lid_open: 'lid opened', led_fail: 'LED failed', temp_out: 'water temperature out of range', no_blank: 'no clear-water reading' };
const WIDE = '(min-width: 900px)';
const MOMENT = 'Something is dissolving. Nothing is glowing.';
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
  const created = useRef(false);

  // /run/new (or an unknown id): make the run from the replay, then land on its real id.
  useEffect(() => {
    if (run || created.current) return;
    created.current = true;
    const rep = REPLAYS[key];
    const r = actions.startRun({ drug: rep.drug, lot: rep.lot, src: 'replay', bottleId: q.get('bottle'), deliveryId: q.get('delivery') });
    nav(`/run/${r.id}?${q.toString()}`, { replace: true });
  }, [run, key, q, nav]);

  const ref = run ? REFERENCES[REPLAYS[key]?.drug ?? run.drug] ?? null : null;
  const needsStream = !!run && !run.evaluation;
  useEffect(() => {
    if (!needsStream) return;
    const stream = replayStream(key, speed);
    setSrc(stream.src);
    let all: Sample[] = [];
    let dirty = false;
    const off = stream.subscribe((_s, a) => { all = a; dirty = true; });
    const flush = window.setInterval(() => { if (dirty) { dirty = false; actions.appendSamples(id, all.slice()); } }, 250);
    const offEnd = stream.onEnd((a) => {
      clearInterval(flush);
      actions.appendSamples(id, a.slice());
      const r = getState().runs.find((x) => x.id === id);
      actions.finishRun(id, evaluate(a, REFERENCES[REPLAYS[key]?.drug ?? r?.drug ?? ''] ?? null));
      setFinishedHere(true);
    });
    return () => { stream.stop(); off(); offEnd(); clearInterval(flush); };
  }, [id, needsStream, key, speed]);

  useEffect(() => {
    if (!finishedHere) return;
    const t = window.setTimeout(() => nav(`/evaluation/${id}`, { replace: true }), 900);
    return () => clearTimeout(t);
  }, [finishedHere, id, nav]);

  if (!run) return <Screen title="Starting…"><p className="muted">Preparing the run.</p></Screen>;

  const samples = run.samples;
  const last = samples.at(-1);
  const t = last?.t ?? 0;
  const faultIdx = samples.findIndex((s) => s.fault);
  const fault = faultIdx >= 0 ? samples[faultIdx] : null;
  const pctNow = ref ? progressPct(fault ? samples.slice(0, Math.max(1, faultIdx)) : samples, ref) : Math.round((t / 180) * 100);
  const phase = phaseAt(t);
  const running = !run.evaluation && !fault;
  const glowNow = last ? absorbance(last.blank, last.adc90) : 0;
  const glowFlat = phase.key === 'dissolve' && t > 40 && glowNow < 0.05;
  const glowRising = phase.key === 'dissolve' && glowNow >= 0.05;
  // the moment: the glow has stayed flat past 40 s while the tablet dissolves; it holds until the verdict lands
  const moment = !fault && !!ref && t > 40 && glowNow < 0.05 && phase.key !== 'fill' && (running || run.evaluation?.rule === 'N2');
  const happening = glowFlat ? 'something is dissolving; the glow channel is staying flat'
    : glowRising ? 'riboflavin is leaving the tablet; the glow channel is rising'
    : phase.key === 'settle' && !ref ? 'the reading is settling; there is no band to compare against'
    : phase.doing;
  const faultText = fault ? `${FAULT_WORDS[fault.fault ?? ''] ?? (fault.fault ?? '').replace('_', ' ')} at ${clock(fault.t)}` : null;
  const statusWord = faultText ? 'stopped' : run.evaluation ? 'finished' : phase.status;
  const statusLine = faultText ? `Stopped: ${faultText}.`
    : run.evaluation ? `Finished: ${run.evaluation.verdict}, rule ${run.evaluation.rule}.`
    : !ref ? `No reference for ${DRUGS[run.drug]?.name.toLowerCase() ?? run.drug}. Recording anyway; ${happening}.`
    : `${happening[0].toUpperCase()}${happening.slice(1)}.`;

  const retest = () => {
    const s = getState();
    const r = actions.startRun({ drug: run.drug, lot: run.lot, src: run.src, bottleId: s.bottles.find((b) => b.runId === id)?.id ?? null, deliveryId: s.deliveries.find((d) => d.runId === id)?.id ?? null });
    const next = new URLSearchParams(q);
    next.set('replay', key === 'B2-LID' ? 'B2-07' : key);
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
      <SensorPath led={last?.led ?? true} inline={last ? last.adc0 / last.blank : 1} glow={glowNow / GLOW_FULL} running={running} />
      {moment && <p className="footnote cn-field">Inline: the light is dimming, so something is in the water. 90°: dark. Riboflavin would glow here.</p>}
    </div>
  );

  return (
    <Screen title={run.evaluation ? 'Done' : fault ? 'Stopped' : 'Dissolving…'} eyebrow={`run ${run.id} · ${run.drug} · lot ${run.lot}`} back="/" right={<SrcBadge src={src ?? run.src} />}
      tone={moment ? 'amber' : run.evaluation ? 'none' : 'sky'}>
      <div className="wide-2 cn-run">
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <section className={'card glass decor-dots stack cn-hero' + (moment ? ' moment' : '')} data-moment={moment || undefined} style={{ alignItems: 'center', gap: 6, padding: '18px 12px 16px' }}>
            <span className="cn-wash" aria-hidden="true" />
            <div className="cn-hero-row">
              <div className="cn-pillwrap">
                <PillFill pct={pctNow} verdict={run.evaluation?.verdict ?? null} fault={!!fault} size={wide ? 380 : 420} label={!!ref} running={running} />
              </div>
              {ref && <GlowMeter glow={glowNow / GLOW_FULL} lit={glowNow >= 0.05} on={glowNow >= ref.glowMin} />}
            </div>
            <p className="serif" style={{ fontSize: personal ? 38 : 34, lineHeight: 1, marginTop: 6 }}>{statusWord}</p>
            {moment && !run.evaluation
              ? <p className="cn-moment" aria-live="polite"><Words text={MOMENT} step={90} /></p>
              : <p style={{ fontSize: personal ? 19 : 16, color: 'var(--ink-2)', textAlign: 'center', maxWidth: 420, minHeight: '2.9em' }} aria-live="polite">{statusLine}</p>}
            {moment && !run.evaluation && <p className="footnote" style={{ textAlign: 'center', maxWidth: 380 }}>{statusLine}</p>}
            <p className="mono muted" style={{ fontSize: 13 }}>{clock(t)} / 3:00{ref ? ` · ${pctNow} % of reference` : ''}</p>
          </section>
          <section className="card stack cn-phases" style={{ gap: 6 }}>
            <div className="row between"><span className="eyebrow">timetable</span><span className="mono muted" style={{ fontSize: 12 }}>{speed}× replay</span></div>
            <RunPhases t={t} fault={fault ? fault.t : null} big={personal} />
          </section>
          {fault && (
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

      {(fault || (run.evaluation && !finishedHere)) && (
        <Action>
          {fault && <button type="button" className="btn" onClick={retest}>Retest</button>}
          {run.evaluation && !finishedHere && <button type="button" className={fault ? 'btn ghost' : 'btn'} onClick={() => nav(`/evaluation/${id}`)}>See the evaluation</button>}
        </Action>
      )}
    </Screen>
  );
}
