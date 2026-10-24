// The station's own 7-inch screen (1024 × 600, landscape). One button; the run plays inline; the verdict holds for 20 s, then the station is ready again.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Action, Screen, SrcBadge } from '../components/Shell';
import PillFill from '../components/PillFill';
import Curve, { RunReadout } from '../components/Curve';
import { VERDICT_FILL } from '../components/PillFill';
import { actions, useStore } from '../lib/store';
import { replayStream } from '../lib/stream';
import { evaluate, progressPct } from '../lib/rules';
import { REFERENCES } from '../data/reference';
import type { Sample, Source } from '../lib/types';

const REF = REFERENCES.riboflavin;
const HOLD_S = 20;

export default function Kiosk() {
  const [q] = useSearchParams();
  const speed = Number(q.get('speed')) || 7.5;
  const [runId, setRunId] = useState<string | null>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const run = useStore((s) => (runId ? s.runs.find((r) => r.id === runId) : undefined));

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
      actions.finishRun(runId, evaluate(a, REF));
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
  const ev = run?.evaluation ?? null;
  const pct = progressPct(samples, REF);
  const status = !run ? 'Place a quarter tablet, close the lid, press Start.'
    : pct < 5 ? 'filling the chamber' : pct < 60 ? 'dissolving' : pct < 95 ? 'settling' : 'holding';
  const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

  return (
    <Screen title="Pill" eyebrow={`STATION 01 · ${REF.label}`} right={src ? <SrcBadge src={src} /> : <span className="chip ok"><span className="dot" />ready</span>}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, minWidth: 0 }}>
          {ev ? (
            <>
              <div className="rise" style={{ flex: 'none' }}><PillFill pct={100} verdict={ev.verdict} size={320} grid={false} /></div>
              <div className="rise stack" style={{ gap: 10, minWidth: 0, animationDelay: '80ms' }}>
                <p className="eyebrow">rule {ev.rule} · run {run?.id}</p>
                <h2 className="serif" data-verdict={ev.verdict} style={{ fontSize: ev.verdict === 'PASS' ? 96 : 64, lineHeight: 0.95, fontWeight: 400, letterSpacing: '-0.01em' }}>{ev.verdict}</h2>
                <div style={{ width: 56, height: 3, borderRadius: 2, background: VERDICT_FILL[ev.verdict] }} />
                <p className="mono" style={{ fontSize: 15 }}>{ev.pct} % of reference</p>
                <p style={{ color: 'var(--ink-2)' }}>Next: {ev.nextStep}.</p>
                <p className="footnote">Screening result, not a pharmacopeial test.</p>
                <p className="mono muted" style={{ fontSize: 13 }}>ready again in {left ?? 0} s</p>
              </div>
            </>
          ) : (
            <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
              <PillFill pct={pct} size={320} />
              <p style={{ fontSize: 20, fontWeight: 500, textAlign: 'center' }} aria-live="polite">{status}</p>
              <p className="mono muted" style={{ fontSize: 14 }}>{clock(last?.t ?? 0)} / 3:00</p>
            </div>
          )}
        </section>
        <section className="card stack" style={{ gap: 14, alignSelf: 'center', minWidth: 0 }}>
          <Curve samples={samples} band={REF} width={460} height={210} live={!!run && !ev} />
          <RunReadout samples={samples} />
        </section>
      </div>
      <Action>
        <button type="button" className="btn" disabled={!!run && !ev} onClick={() => { setLeft(null); setRunId(actions.startRun({ drug: 'riboflavin', lot: 'B2-07', src: 'replay' }).id); }}>
          {run && !ev ? `Running · ${clock(last?.t ?? 0)} / 3:00` : ev ? 'Start again (replay B2-07)' : 'Start (replay B2-07)'}
        </button>
      </Action>
    </Screen>
  );
}
