// The verdict, said once: the filled capsule in the verdict colour beside the word. Plus the two small pieces the evaluation is built from.
import { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import PillFill, { VERDICT_FILL } from './PillFill';
import type { Run, Evaluation } from '../lib/types';

export const SRC_TEXT = { real: 'LIVE SENSOR', replay: 'REPLAY', sim: 'SIMULATED' } as const;
export const VERDICT_CLASS = { PASS: 'verdict-pass', 'NEEDS LAB': 'verdict-needslab', 'UNABLE TO VERIFY': 'verdict-unable' } as const;

/** Three-step entrance (pill, word, numbers); each step 420 ms, 80 ms apart, all done by 580 ms. */
export const STEP = (i: number): React.CSSProperties => ({ animationDelay: `${i * 80}ms`, animationDuration: '420ms' });

export default function VerdictCard({ run, evaluation, size = 90, wordSize = 44 }: { run: Run; evaluation: Evaluation; size?: number; wordSize?: number }) {
  return (
    <section className="row" style={{ gap: 18, alignItems: 'center' }} aria-label={`Verdict: ${evaluation.verdict}`}>
      <div className="rise" style={{ ...STEP(0), flex: 'none' }}>
        <PillFill pct={100} verdict={evaluation.verdict} size={size} label={false} grid={false} />
      </div>
      <div className="rise" style={{ ...STEP(1), minWidth: 0 }}>
        <p className="eyebrow">rule {evaluation.rule} · run {run.id} · {SRC_TEXT[run.src]}</p>
        <h2 className="serif" data-verdict={evaluation.verdict} style={{ fontSize: wordSize, lineHeight: 1, letterSpacing: '-0.01em', fontWeight: 400, marginTop: 6 }}>{evaluation.verdict}</h2>
        <div style={{ width: 44, height: 3, borderRadius: 2, background: VERDICT_FILL[evaluation.verdict], marginTop: 10 }} />
      </div>
    </section>
  );
}

/** A number that counts up once on mount (static under reduced motion). */
export function CountUp({ value, decimals = 0, duration = 500, delay = 0 }: { value: number; decimals?: number; duration?: number; delay?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = value.toFixed(decimals); return; }
    const o = { v: 0 };
    node.textContent = (0).toFixed(decimals);
    const a = animate(o, { v: value, duration, delay, ease: 'outCubic', onUpdate: () => { node.textContent = o.v.toFixed(decimals); } });
    return () => { a.cancel(); };
  }, [value, decimals, duration, delay]);
  return <span ref={el}>{value.toFixed(decimals)}</span>;
}

/** One deciding number on a 0–max track: the shaded region is what passes (a band, or everything above a minimum). */
export function BandBar({ label, value, max, low, high, text }: { label: string; value: number; max: number; low: number | null; high: number | null; text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const pos = (v: number) => `${(Math.max(0, Math.min(max, v)) / max) * 100}%`;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row between" style={{ gap: 8 }}>
        <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{label}</span>
        {low != null && <span className="mono muted" style={{ fontSize: 12 }}>{value >= low && (high == null || value <= high) ? 'inside' : 'outside'}</span>}
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'rgba(22,24,27,.05)' }}>
        {low != null && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: pos(low), width: `calc(${pos(high ?? max)} - ${pos(low)})`, background: 'var(--sky-tint)', border: '1px dashed var(--sky)', borderRadius: 4 }} />
        )}
        <div style={{ position: 'absolute', top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1, background: 'var(--ink)', left: on ? pos(value) : '0%', transition: 'left .5s var(--ease)' }} />
      </div>
      <span className="mono" style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}
