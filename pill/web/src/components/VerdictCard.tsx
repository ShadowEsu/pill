// The verdict, said once: the filled capsule in the verdict colour beside the word. Plus the two small pieces the evaluation is built from.
import { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import PillFill, { VERDICT_FILL } from './PillFill';
import type { Run, Evaluation, Reference, RuleId } from '../lib/types';

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

/** Which channel decided: inline A(t) and the 90° glow each feed the rule; the deciding arrow carries the verdict colour and flows. */
const DECIDERS: Record<RuleId, { inline: boolean; glow: boolean; caption: string }> = {
  P1: { inline: true, glow: true, caption: 'both channels agreed: plateau inside the band and the glow rose' },
  N1: { inline: true, glow: false, caption: 'the inline channel decided: plateau below the band' },
  N3: { inline: true, glow: false, caption: 'the inline channel decided: plateau above the band' },
  N2: { inline: false, glow: true, caption: 'the 90° channel decided: the inline reading moved, the glow did not' },
  U3: { inline: true, glow: false, caption: 'the inline channel never settled: scatter above the limit' },
  U2: { inline: false, glow: false, caption: 'neither channel: the station faulted during the run' },
  U1: { inline: false, glow: false, caption: 'neither channel: there is no reference to compare against' },
};
const CH_CSS = `.ch-flow { stroke-dasharray: 3 8; animation: ch-flow .8s linear infinite; } @keyframes ch-flow { to { stroke-dashoffset: -11; } } @media (prefers-reduced-motion: reduce) { .ch-flow { animation: none; } }`;

export function Channels({ evaluation, reference }: { evaluation: Evaluation; reference: Reference | null }) {
  const d = DECIDERS[evaluation.rule];
  const colour = VERDICT_FILL[evaluation.verdict];
  const inBand = reference ? evaluation.plateau >= reference.bandLow && evaluation.plateau <= reference.bandHigh : null;
  const rose = reference ? evaluation.glowRise >= reference.glowMin : null;
  const rows = [
    { key: 'inline', y: 34, name: 'inline · A(t)', swatch: 'var(--sky)', on: d.inline,
      text: `${evaluation.plateau.toFixed(2)} ${inBand == null ? '' : inBand ? 'in band ✓' : evaluation.plateau < (reference?.bandLow ?? 0) ? 'below band' : 'above band'}` },
    { key: 'glow', y: 104, name: '90° · glow', swatch: 'var(--mint)', on: d.glow,
      text: `${evaluation.glowRise >= 0 ? '+' : ''}${evaluation.glowRise.toFixed(2)} ${rose == null ? '' : rose ? 'rose ✓' : 'flat'}` },
  ];
  const mono = { fontFamily: 'var(--mono)', fontSize: 12, fill: 'var(--ink-2)' } as const;
  return (
    <figure style={{ margin: 0 }} className="stack">
      <style href="pm-channels" precedence="pm">{CH_CSS}</style>
      <svg viewBox="0 0 360 138" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Two channels; ${d.caption}`}>
        {rows.map((r) => {
          const stroke = r.on ? colour : 'var(--line-2)';
          const path = `M140 ${r.y} C 182 ${r.y}, 192 69, 228 69`;
          return (
            <g key={r.key}>
              <rect x="4" y={r.y - 22} width="132" height="44" rx="10" fill="var(--surface)" stroke={r.on ? 'var(--ink)' : 'var(--line-2)'} strokeWidth="1.2" />
              <rect x="14" y={r.y - 9} width="4" height="18" rx="2" fill={r.swatch} />
              <text x="26" y={r.y - 3} style={{ ...mono, fill: 'var(--ink)' }}>{r.name}</text>
              <text x="26" y={r.y + 12} style={mono}>{r.text}</text>
              <path d={path} fill="none" stroke={stroke} strokeWidth={r.on ? 2.5 : 1.5} strokeDasharray={r.on ? undefined : '3 4'} strokeLinecap="round" />
              {r.on && <path className="ch-flow" d={path} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />}
            </g>
          );
        })}
        <polygon points="232,69 222,64 222,74" fill={d.inline || d.glow ? colour : 'var(--line-2)'} />
        <rect x="234" y="44" width="122" height="50" rx="12" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" />
        <rect x="234" y="44" width="6" height="50" rx="3" fill={colour} />
        <text x="250" y="64" style={{ ...mono, fill: 'var(--muted)' }}>rule {evaluation.rule}</text>
        <text x="250" y="82" style={{ fontFamily: 'var(--mono)', fontSize: evaluation.verdict === 'UNABLE TO VERIFY' ? 9.5 : 13, fill: 'var(--ink)' }}>{evaluation.verdict}</text>
      </svg>
      <figcaption className="footnote">{d.caption}.</figcaption>
    </figure>
  );
}
