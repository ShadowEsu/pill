// The Gemini checker, on screen: the steps it took as a vertical list (each glyph draws in, a spinner turns into a tick,
// the step's own ms on a chip), then the report card: label fields, recall, the frames it looked at with what Gemini saw
// as plain chips, whether that agrees with the sensor, the sensor's verdict word (unchanged: the sensor decides) and
// Gemini's short summary (clause-filtered on the server) with a read-aloud button.
// The steps come back in one response (no streaming); while it runs, the planned steps wait with spinners, then the real
// log plays back in order. Frames are data URLs held by the parent in memory only. Reduced motion: everything at once.
import { useCallback, useEffect, useRef, useState } from 'react';
import Glyph, { type GlyphName } from './Glyph';
import Stamp from './Stamp';
import ReadAloud from './ReadAloud';
import { runChecker, type CheckReport, type CheckRequest, type CheckSensor, type CheckStep } from '../lib/api';
import { playSound } from '../lib/sound';
import { prettyModel } from '../lib/follower';
import { useReducedMotion } from '../lib/motion';
import { REFERENCES } from '../data/reference';
import type { Run } from '../lib/types';
import './checker.css';

/** "gemini-3.5-flash-lite + gemini-2.5-flash" → "Gemini 3.5 Flash-Lite + Gemini 2.5 Flash" (the models that answered). */
const checkedBy = (models: string) => [...new Set(models.split(' + ').map(prettyModel))].join(' + ');

/** A step's JSON output as `key value · key value` (the raw JSON stays in the response for the record). */
function plainOutput(out: string): string {
  if (!out.startsWith('{')) return out;
  try {
    const o = JSON.parse(out) as Record<string, unknown>;
    return Object.entries(o).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => (typeof v === 'boolean' ? (v ? k : `no ${k}`) : `${k} ${Array.isArray(v) ? v.join(', ') : String(v)}`)).join(' · ');
  } catch { return out; }
}

const STEP_TEXT: Record<string, { title: string; glyph: GlyphName }> = {
  readLabel: { title: 'Read the label', glyph: 'bottle' },
  inspectFrames: { title: 'Look at the cup', glyph: 'cup' },
  lookupRecall: { title: 'Check for a recall', glyph: 'lab' },
  crossCheck: { title: 'Check expiry, drug and lot', glyph: 'calendar' },
  reconcile: { title: 'Compare with the sensor', glyph: 'sensor' },
  summarise: { title: 'Say it in plain words', glyph: 'pharmacist' },
};
const PLANNED = Object.keys(STEP_TEXT);
const BY_TEXT: Record<CheckStep['by'], string> = { gemini: 'gemini', code: 'code', app: 'from the app', script: 'code · script' };
const TICK_MS = 260;

/** The sensor numbers the checker compares against, from a finished run. */
export function sensorOf(run: Run): CheckSensor | null {
  const ev = run.evaluation;
  if (!ev) return null;
  const ref = REFERENCES[run.drug] ?? null;
  return { verdict: ev.verdict, rule: ev.rule, plateau: ev.plateau, band: ref ? [ref.bandLow, ref.bandHigh] : null, glowRise: ev.glowRise, glowMin: ref?.glowMin ?? null, drug: run.drug };
}

export type CheckState = { status: 'idle' } | { status: 'running' } | { status: 'done'; report: CheckReport } | { status: 'error'; error: string };

/** One check at a time; a newer request wins. The report lives in component state only. */
export function useChecker() {
  const [state, setState] = useState<CheckState>({ status: 'idle' });
  const token = useRef(0);
  const run = useCallback(async (req: CheckRequest) => {
    const t = ++token.current;
    setState({ status: 'running' });
    const r = await runChecker(req);
    if (t !== token.current) return;
    setState(r.mode === 'unavailable' ? { status: 'error', error: r.error } : { status: 'done', report: r });
  }, []);
  const reset = useCallback(() => { token.current++; setState({ status: 'idle' }); }, []);
  return { state, run, reset };
}

function Mark({ status, spinning }: { status: CheckStep['status']; spinning: boolean }) {
  if (spinning) return <span className="ck-mark" aria-label="working"><span className="cn-spin" /></span>;
  return <span className={'ck-mark ' + status} aria-label={status}>{status === 'ok' ? '✓' : status === 'failed' ? '!' : '–'}</span>;
}

function StepList({ steps, phase }: { steps: CheckStep[] | null; phase: number }) {
  if (!steps) return (
    <ol className="ck-steps" aria-label="Checker steps" data-checker="running">
      {PLANNED.map((k, i) => (
        <li key={k} className={'ck-step in' + (i ? ' wait' : '')} style={{ animationDelay: `${i * 70}ms` }}>
          <Glyph name={STEP_TEXT[k].glyph} size={40} delay={i * 70} />
          <div><div className="ck-title">{STEP_TEXT[k].title}</div><div className="ck-out">waiting for Gemini…</div></div>
          <div className="ck-meta"><Mark status="ok" spinning /></div>
        </li>
      ))}
    </ol>
  );
  return (
    <ol className="ck-steps" aria-label="Checker steps" data-checker="steps">
      {steps.map((s, i) => {
        if (phase < 2 * i) return null;
        const done = phase >= 2 * i + 1;
        const t = STEP_TEXT[s.step] ?? { title: s.step, glyph: 'station' as GlyphName };
        return (
          <li key={`${s.step}-${i}`} className="ck-step in" data-step={s.step} data-status={done ? s.status : 'running'}>
            <Glyph name={t.glyph} size={40} />
            <div style={{ minWidth: 0 }}>
              <div className="ck-title">{t.title}</div>
              <div className="ck-out" title={s.tool}>{s.tool.split(' · ')[0]} · {s.status === 'ok' ? plainOutput(s.output) : s.status === 'skipped' ? `skipped: ${s.input}` : `failed: ${s.output}`}</div>
            </div>
            <div className="ck-meta">
              <Mark status={s.status} spinning={!done} />
              {done && <span className="chip pop-in" title={`started at +${s.at} ms`}>{s.ms} ms</span>}
              {done && <span className="mono muted" style={{ fontSize: 10.5 }}>{BY_TEXT[s.by]}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const RECALL_CHIP: Record<CheckReport['recall']['status'], string> = { recall: 'bad', no_record: 'ok', unreachable: 'warn', unchecked: '' };
const AGREE_TEXT: Record<CheckReport['reconcile']['agrees'], string> = { yes: 'yes', no: 'no', unclear: 'unclear' };

function Report({ r, frames }: { r: CheckReport; frames: string[] }) {
  const f = r.frames;
  const recallText = r.recall.status === 'recall' ? `RECALL · ${r.recall.source}${r.recall.id ? ` ${r.recall.id}` : ''}`
    : r.recall.status === 'no_record' ? `no recall record · ${r.recall.source}`
      : r.recall.status === 'unreachable' ? 'recall lookup did not answer' : 'recall not checked (no lot)';
  return (
    <section className="card ck-report cn-field" aria-label="Checker report" data-checker="report" data-agrees={r.reconcile.agrees} data-verdict={r.verdict}>
      <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="eyebrow">checker report</span>
        <span className="chip live" title={r.model ?? 'no model'}><span className="dot" />{r.model ? checkedBy(r.model) : 'no model'} · {r.agent === 'gemini function-calling' ? 'tools' : 'scripted'} · {(r.totalMs / 1000).toFixed(1)} s</span>
      </div>

      <div className={'ck-agree ' + r.reconcile.agrees} data-agrees={r.reconcile.agrees}>
        <span className="ck-bar" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0 }}>
          Agrees with the sensor: {AGREE_TEXT[r.reconcile.agrees]}
          <span style={{ display: 'block', fontSize: 16, fontWeight: 400, color: 'var(--ink-2)', marginTop: 4 }}>{r.reconcile.note}</span>
        </span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">sensor verdict</span>
        <div><Stamp verdict={r.verdict} size={34} sound={false} /></div>
        <p className="footnote">The sensor decides. The checker explains and never changes this word.</p>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="eyebrow">in plain words</span>
          <span className="chip live" data-summary-by={r.summary.by}><span className="dot" />{r.summary.by === 'gemini' ? 'gemini' : 'template'} · filtered</span>
        </div>
        <p className="ck-summary" data-summary>{r.summary.text}</p>
        <ReadAloud text={r.summary.text} label="Read the summary aloud" size={56} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">label{r.label ? ` · ${r.label.source === 'gemini' ? `read by gemini${r.label.confidence !== null ? ` · ${Math.round(r.label.confidence * 100)} %` : ''}` : 'from the app'}` : ''}</span>
        {r.label
          ? <div className="ck-chips">
              {(['drug', 'strength', 'lot', 'expiry', 'maker'] as const).map((k) => <span key={k} className="chip"><span className="muted">{k}</span> {r.label![k] ?? '—'}</span>)}
            </div>
          : <p className="footnote">No label photo or saved bottle.</p>}
        <div className="ck-chips">
          <span className={'chip ' + RECALL_CHIP[r.recall.status]} data-recall={r.recall.status} title={r.recall.note}><span className="dot" />{recallText}</span>
          {r.crossCheck.notes.map((n) => <span key={n} className="chip">{n}</span>)}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">what the camera saw</span>
        {frames.length > 0 && <div className="ck-thumbs">{frames.map((src, i) => <img key={i} src={src} alt={`Frame ${i + 1} of the cup`} />)}</div>}
        {f
          ? <div className="ck-chips" data-frames>
              <span className="chip">cup {f.cupVisible ? 'in view' : 'not in view'}</span>
              <span className="chip">liquid {f.liquidClarity}</span>
              <span className="chip">colour {f.colour}</span>
              <span className="chip">tablet {f.tabletState}</span>
              <span className="chip">confidence {Math.round(f.confidence * 100)} %</span>
              {f.anomalies.map((a) => <span key={a} className="chip warn"><span className="dot" />{a}</span>)}
            </div>
          : <p className="footnote">No frames were checked.</p>}
        <p className="footnote">Expected: {r.reconcile.expected}.</p>
      </div>

      <p className="footnote">{r.notice} Photos were not saved.</p>
    </section>
  );
}

export default function Checker({ state, frames }: { state: CheckState; frames: string[] }) {
  const reduce = useReducedMotion();
  const report = state.status === 'done' ? state.report : null;
  const total = report ? 2 * report.steps.length : 0;
  const [play, setPlay] = useState<{ report: CheckReport | null; phase: number }>({ report: null, phase: 0 });
  const phase = play.report === report ? play.phase : 0;

  useEffect(() => {
    if (!report) return;
    if (reduce) { setPlay({ report, phase: total }); return; }
    let p = 0;
    setPlay({ report, phase: 0 });
    const id = window.setInterval(() => {
      p++;
      if (p % 2 === 1) playSound('tick', { step: (p - 1) / 2 });
      setPlay({ report, phase: p });
      if (p >= total) clearInterval(id);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [report, total, reduce]);

  if (state.status === 'idle') return null;
  if (state.status === 'error') return (
    <section className="card stack cn-field" style={{ gap: 8 }} role="status" data-checker="error">
      <span className="eyebrow">checker</span>
      <p style={{ fontSize: 18 }}>The checker is not available right now ({state.error}). The sensor result above still stands.</p>
    </section>
  );
  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card stack" style={{ gap: 6 }} aria-live="polite">
        <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
          {report?.model
            ? <span className="serif" style={{ fontSize: 20, lineHeight: 1.2 }} data-checked-by={report.model}>Checked by {checkedBy(report.model)}</span>
            : <span className="eyebrow">gemini checker</span>}
          {state.status === 'running'
            ? <span className="chip live beat"><span className="dot" />checking · about 5–20 s</span>
            : <span className="chip ok"><span className="dot" />{report!.steps.length} steps</span>}
        </div>
        <StepList steps={report?.steps ?? null} phase={phase} />
      </section>
      {report && phase >= total && <Report r={report} frames={frames} />}
    </div>
  );
}
