// The run: the capsule fills as the tablet dissolves, the curve draws, the station checks stay visible. Ends on the evaluation.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Action, Screen, SrcBadge } from '../components/Shell';
import PillFill from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import { actions, getState, useStore } from '../lib/store';
import { replayStream } from '../lib/stream';
import { evaluate, progressPct } from '../lib/rules';
import { DRUGS, REFERENCES, REPLAYS } from '../data/reference';
import type { Sample, Source } from '../lib/types';

const FAULT_WORDS: Record<string, string> = { lid_open: 'lid opened', led_fail: 'LED failed', temp_out: 'water temperature out of range', no_blank: 'no clear-water reading' };
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

export default function Run() {
  const { id = '' } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const asked = q.get('replay') ?? 'B2-07';
  const key = asked in REPLAYS ? asked : 'B2-07';
  const speed = Number(q.get('speed')) || 7.5;
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const personal = useStore((s) => s.mode) === 'personal';
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
  const faultIdx = samples.findIndex((s) => s.fault);
  const fault = faultIdx >= 0 ? samples[faultIdx] : null;
  const pctNow = ref ? progressPct(fault ? samples.slice(0, Math.max(1, faultIdx)) : samples, ref) : Math.round(((last?.t ?? 0) / 180) * 100);
  const status = !ref ? `No reference for ${DRUGS[run.drug]?.name.toLowerCase() ?? run.drug}. Recording anyway.`
    : pctNow < 5 ? 'filling the chamber' : pctNow < 60 ? 'dissolving' : pctNow < 95 ? 'settling' : 'holding';
  const faultText = fault ? `${FAULT_WORDS[fault.fault ?? ''] ?? (fault.fault ?? '').replace('_', ' ')} at ${clock(fault.t)}` : null;

  const retest = () => {
    const s = getState();
    const r = actions.startRun({ drug: run.drug, lot: run.lot, src: run.src, bottleId: s.bottles.find((b) => b.runId === id)?.id ?? null, deliveryId: s.deliveries.find((d) => d.runId === id)?.id ?? null });
    const next = new URLSearchParams(q);
    next.set('replay', key === 'B2-LID' ? 'B2-07' : key);
    nav(`/run/${r.id}?${next.toString()}`, { replace: true });
  };

  const details = (
    <div className="card rise stack" style={{ gap: 14 }}>
      <Curve samples={samples} band={ref} live={!run.evaluation && !fault} />
      <RunReadout samples={samples} checks={false} />
    </div>
  );

  return (
    <Screen title={run.evaluation ? 'Done' : fault ? 'Stopped' : 'Dissolving…'} eyebrow={`run ${run.id} · ${run.drug} · lot ${run.lot}`} back="/" right={<SrcBadge src={src ?? run.src} />}>
      <section className="stack" style={{ alignItems: 'center', gap: 8, padding: '4px 0 2px' }}>
        <PillFill pct={pctNow} verdict={run.evaluation?.verdict ?? null} fault={!!fault} size={personal ? 290 : 260} label={!!ref} />
        <p style={{ fontSize: personal ? 20 : 17, fontWeight: 500 }} aria-live="polite">{faultText ? `Stopped: ${faultText}.` : run.evaluation ? 'Finished.' : status}</p>
        <p className="mono muted" style={{ fontSize: 13 }}>{clock(last?.t ?? 0)} / 3:00{ref ? ` · ${pctNow} % of reference` : ''}</p>
      </section>

      {fault && (
        <div className="card rise stack" style={{ gap: 6, borderColor: 'rgba(154,160,166,.6)' }}>
          <p className="eyebrow">station fault</p>
          <p>The {FAULT_WORDS[fault.fault ?? ''] ?? 'station faulted'} at {clock(fault.t)}. {personal ? 'This reading cannot be used. Start again with a new piece of tablet.' : 'The curve after this point cannot be trusted; this run will end as UNABLE TO VERIFY (U2). Retest with a new tablet and the lid closed.'}</p>
        </div>
      )}

      {personal ? (
        <>
          <RunReadout samples={samples} strip={false} />
          <button type="button" className="btn ghost" aria-expanded={showCurve} onClick={() => setShowCurve((v) => !v)}>{showCurve ? 'Hide the curve' : 'Show the curve'}</button>
          {showCurve && details}
        </>
      ) : (
        <>
          {details}
          <RunReadout samples={samples} strip={false} />
        </>
      )}

      {(fault || (run.evaluation && !finishedHere)) && (
        <Action>
          {fault && <button type="button" className="btn" onClick={retest}>Retest</button>}
          {run.evaluation && !finishedHere && <button type="button" className={fault ? 'btn ghost' : 'btn'} onClick={() => nav(`/evaluation/${id}`)}>See the evaluation</button>}
        </Action>
      )}
    </Screen>
  );
}
