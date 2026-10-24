// The run's rail: Prepare, then the station's six phases (RunPhases.PHASES) with their times. The active segment fills in
// real time, finished ones get a tick, the serif name and a mono clock say where the run is. Phone: one horizontal rail,
// sticky under the header. Desktop (layout 'auto', ≥ 900 px): a left column, one row per phase.
// Sounds: `tick` on every phase change, `rise` when Dissolving starts (never on first paint).
// Also the curve reading the rail needs: where the 6 % drop landed, when the reading started to settle, the 20-s plateau
// window (the same least-squares |dA/dt| < ε test the station bridge runs, pill/pay/src/station.ts `finished`).
import { useEffect, useRef, type CSSProperties } from 'react';
import { PHASES, type PhaseKey } from './RunPhases';
import { STAMP_TONE } from './Stamp';
import { playSound } from '../lib/sound';
import { absorbance } from '../lib/rules';
import type { Sample, Verdict } from '../lib/types';
import '../phases.css';

export type RailKey = 'prepare' | PhaseKey;
const PREPARE = { key: 'prepare', name: 'Prepare', short: 'prep', dur: 'checks', color: 'var(--c2)' } as const;
const WEIGHT: Record<RailKey, number> = { prepare: 0.9, dark: 0.9, blank: 1, drop: 0.9, dissolve: 1.35, settle: 1, verdict: 1.05 };

/** The station's numbers (pill/pay/src/station.ts): 6 % inline drop, 20-s window, ε = 0.001 /s, no plateau before 60 s. */
export const STATION = { drop: 0.06, window: 20, eps: 0.001, minT: 60, settleEps: 0.002, flatEps: 0.0015, dropWait: 30, leakMax: 100, blankCv: 2 } as const;

/** Least-squares slope of inline absorbance over the samples with t in [from, to]; null with fewer than `min` points. */
function slopeOf(c: { t: number; a: number }[], from: number, to: number, min: number) {
  let n = 0, st = 0, sa = 0;
  for (const p of c) if (p.t >= from && p.t <= to) { n++; st += p.t; sa += p.a; }
  if (n < min) return null;
  const mt = st / n, ma = sa / n;
  let num = 0, den = 0;
  for (const p of c) if (p.t >= from && p.t <= to) { num += (p.t - mt) * (p.a - ma); den += (p.t - mt) ** 2; }
  return num / (den || 1);
}

export interface CurveMarks {
  /** t of the first sample 6 % under the blank */ drop: number | null;
  /** t the 20-s slope first fell under 2ε (≥ 60 s) */ settle: number | null;
  /** t the station's plateau test passed */ plateau: number | null;
  /** the 20-s slope now, absorbance per second */ slope: number | null;
  /** share of the last 20 s that reads flat (10-s slope under 1.5ε), 1 once the plateau test passed */ window: number;
  /** inline reading now as a share of the blank */ inline: number;
}

/** Reads the curve the way the station does. Samples from the first fault on are ignored. */
export function curveMarks(samples: Sample[]): CurveMarks {
  const f = samples.findIndex((s) => s.fault);
  const ok = f < 0 ? samples : samples.slice(0, f);
  const last = ok.at(-1);
  const inline = last && last.blank > 0 ? last.adc0 / last.blank : 1;
  const d = ok.find((s) => s.blank > 0 && s.adc0 <= s.blank * (1 - STATION.drop));
  const drop = d ? d.t : null;
  const c = ok.map((s) => ({ t: s.t, a: absorbance(s.blank, s.adc0) }));
  const min = STATION.window * 0.75;
  let settle: number | null = null, plateau: number | null = null;
  if (drop != null) for (const p of c) {
    if (p.t < STATION.minT) continue;
    const k = slopeOf(c, p.t - STATION.window, p.t, min);
    if (k == null) continue;
    if (settle == null && Math.abs(k) < STATION.settleEps) settle = p.t;
    if (Math.abs(k) < STATION.eps) { plateau = p.t; settle ??= p.t; break; }
  }
  const tl = last?.t ?? 0;
  const slope = c.length ? slopeOf(c, tl - STATION.window, tl, min) : null;
  let flat = 0, all = 0;
  for (const p of c) if (p.t > tl - STATION.window) {
    all++;
    const k = slopeOf(c, p.t - 10, p.t, 8);
    if (k != null && Math.abs(k) < STATION.flatEps) flat++;
  }
  const window = plateau != null ? 1 : settle != null && all ? Math.min(0.97, flat / STATION.window) : 0;
  return { drop, settle, plateau, slope, window, inline };
}

export default function PhaseRail({ at, progress, clock, note = null, fault = false, verdict = null, layout = 'auto', sound = true, prepare = true, className = '' }: {
  at: RailKey; progress: number; clock: string; note?: string | null; fault?: boolean; verdict?: Verdict | null;
  layout?: 'auto' | 'row'; sound?: boolean; prepare?: boolean; className?: string;
}) {
  const segs = prepare ? [PREPARE, ...PHASES] : [...PHASES];
  const idx = segs.findIndex((s) => s.key === at);
  const cur = segs[idx] ?? segs[0];
  const prev = useRef(at);
  useEffect(() => {
    if (prev.current === at) return;
    prev.current = at;
    if (!sound) return;
    playSound('tick', { step: idx });
    if (at === 'dissolve') window.setTimeout(() => playSound('rise'), 160);
  }, [at, idx, sound]);

  const step = at === 'prepare' ? 'before the run' : `${PHASES.findIndex((p) => p.key === at) + 1} of 6`;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <nav className={`ph-rail ph-${layout}${fault ? ' is-fault' : ''} ${className}`} aria-label={`Run phases: ${cur.name}, ${step}${fault ? ', stopped' : ''}`}>
      <div className="ph-head">
        <span className="ph-step mono">{step}</span>
        <span key={cur.key} className="ph-name serif">{fault ? `${cur.name}: stopped` : cur.name}</span>
        <span className="ph-clock mono" aria-live="off">{clock}</span>
      </div>
      {note && <p className="ph-note" aria-live="polite">{note}</p>}
      <ol className="ph-segs">
        {segs.map((s, i) => {
          const state = i < idx || (i === idx && at === 'verdict' && verdict) ? 'done' : i === idx ? (fault ? 'stopped' : 'now') : fault ? 'lost' : 'next';
          const color = s.key === 'verdict' && verdict ? STAMP_TONE[verdict] : s.color;
          return (
            <li key={s.key} className={`ph-seg is-${state}`} aria-current={state === 'now' ? 'step' : undefined}
              style={{ '--c': color, '--p': state === 'done' ? 1 : state === 'now' || state === 'stopped' ? p : 0, '--w': WEIGHT[s.key] } as CSSProperties}>
              <span className="ph-dot" aria-hidden="true">
                {state === 'done' && <svg viewBox="0 0 12 12"><path d="M2.6 6.3 5 8.6 9.4 3.6" /></svg>}
              </span>
              <span className="ph-bar" aria-hidden="true"><span className="ph-fill" /></span>
              <span className="ph-lab"><span className="ph-full">{s.name}</span><span className="ph-short">{s.short}</span></span>
              <span className="ph-dur mono">{s.dur}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
