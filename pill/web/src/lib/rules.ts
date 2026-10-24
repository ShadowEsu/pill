// The seven rules, in order. Deterministic; no model sets a verdict. SOFTWARE-PLAN.md §1.
import type { Evaluation, Reference, Sample, Verdict, RuleId } from './types';

export const absorbance = (blank: number, now: number) => (now > 0 && blank > 0 ? Math.log10(blank / now) : 0);

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const std = (xs: number[]) => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

export function curve(samples: Sample[]) {
  return samples.map((s) => ({ t: s.t, a: absorbance(s.blank, s.adc0), g: absorbance(s.blank, s.adc90) }));
}

/** Plateau = median of the last 20 s of inline absorbance; scatter = SD of the last 30 s; glowRise = last-20 s median of 90° minus first-10 s median. */
export function features(samples: Sample[]) {
  const c = curve(samples);
  const last20 = c.filter((p) => p.t >= (c.at(-1)?.t ?? 0) - 20);
  const last30 = c.filter((p) => p.t >= (c.at(-1)?.t ?? 0) - 30);
  const first10 = c.filter((p) => p.t <= 10);
  return {
    plateau: median(last20.map((p) => p.a)),
    scatter: std(last30.map((p) => p.a)),
    glowRise: median(last20.map((p) => p.g)) - median(first10.map((p) => p.g)),
    temp: samples.at(-1)?.temp ?? 0,
    fault: samples.find((s) => s.fault)?.fault ?? null,
  };
}

export function evaluate(samples: Sample[], ref: Reference | null): Evaluation {
  const f = features(samples);
  const pct = ref ? Math.min(120, Math.round((f.plateau / ref.bandMean) * 100)) : 0;
  const mk = (verdict: Verdict, rule: RuleId, why: string, nextStep: string, ship: Evaluation['ship']): Evaluation => ({ verdict, rule, plateau: +f.plateau.toFixed(3), glowRise: +f.glowRise.toFixed(3), scatter: +f.scatter.toFixed(3), pct, temp: +f.temp.toFixed(1), fault: f.fault, why, nextStep, ship });

  if (!ref) return mk('UNABLE TO VERIFY', 'U1', 'There is no reference band for this drug on this station. Nothing was measured against anything, so there is no result to act on.', 'calibrate a reference first', 'ask');
  if (f.fault) return mk('UNABLE TO VERIFY', 'U2', `The station reported a fault (${f.fault.replace('_', ' ')}) during the run, so the curve cannot be trusted. Fix the station and retest with a new tablet.`, 'retest', 'ask');
  const span = samples.length ? samples[samples.length - 1].t - samples[0].t : 0;
  if (span < 30) return mk('UNABLE TO VERIFY', 'U3', `Only ${Math.max(0, Math.round(span))} s of samples arrived; a curve needs at least 30 s before it can be compared. Retest with a new tablet.`, 'retest', 'ask');
  if (f.scatter > ref.scatterMax) return mk('UNABLE TO VERIFY', 'U3', `The reading never settled: scatter ${f.scatter.toFixed(3)} is above the limit ${ref.scatterMax}. Retest with a new tablet and the lid closed the whole time.`, 'retest', 'ask');
  if (f.plateau < ref.bandLow) return mk('NEEDS LAB', 'N1', `The plateau ${f.plateau.toFixed(2)} sits below the reference band ${ref.bandLow}–${ref.bandHigh}, so this tablet dissolved less than the reference did. Send this lot to a lab; do not use this result to clear it.`, 'send to lab', 'hold');
  if (f.glowRise < ref.glowMin) return mk('NEEDS LAB', 'N2', `The inline channel moved but the 90° glow did not rise (${f.glowRise.toFixed(3)} vs ${ref.glowMin}), which is what chalk does and riboflavin does not. Send this lot to a lab.`, 'send to lab', 'hold');
  if (f.plateau > ref.bandHigh) return mk('NEEDS LAB', 'N3', `The plateau ${f.plateau.toFixed(2)} sits above the reference band ${ref.bandLow}–${ref.bandHigh}, so something absorbed more light than the reference. Send this lot to a lab.`, 'send to lab', 'hold');
  return mk('PASS', 'P1', `The plateau ${f.plateau.toFixed(2)} is inside the reference band ${ref.bandLow}–${ref.bandHigh} and the 90° glow rose with it. Proceed under clinic policy; this is a screening result, not a lab test.`, 'proceed under clinic policy', 'yes');
}

/** Progress for the pill fill: inline absorbance as a share of the band mean, 0–100. */
export function progressPct(samples: Sample[], ref: Reference | null) {
  if (!ref || !samples.length) return 0;
  const last = samples.at(-1)!;
  return Math.max(0, Math.min(100, Math.round((absorbance(last.blank, last.adc0) / ref.bandMean) * 100)));
}

/** Clause-level word filter (code, not prompt). Drops clauses with banned words; falls back to the template if too much is lost. */
const BANNED = /\b(safe\w*|genuine\w*|fake\w*|counterfeit\w*|authentic\w*|verified|certified|guarantee\w*)\b/i;
export function filterWhy(text: string, fallback: string) {
  const clauses = text.split(/(?<=[.;:,—])\s+|\s+(?=\b(?:but|and|so)\b)/);
  const kept = clauses.filter((c) => !BANNED.test(c));
  if (kept.length < clauses.length / 2) return fallback;
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}
