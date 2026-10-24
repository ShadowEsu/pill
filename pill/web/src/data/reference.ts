// Reference data and replay curves. The band here is a placeholder shaped like SOFTWARE-PLAN §3 until Saturday's ten runs land in runs/reference.json.
import type { Reference, Sample } from '../lib/types';

export const REFERENCES: Record<string, Reference> = {
  riboflavin: { drug: 'riboflavin', label: 'Riboflavin 100 mg (¼ tablet)', bandLow: 0.36, bandHigh: 0.47, bandMean: 0.415, glowMin: 0.12, scatterMax: 0.03, runs: 10, cv: 7 },
};

/** What the drug is used for, in plain words (grandparent-readable). Only drugs we might see this weekend. */
export const DRUGS: Record<string, { name: string; usedFor: string; reference: string | null }> = {
  riboflavin: { name: 'Riboflavin (vitamin B2)', usedFor: 'A vitamin. Used for B2 deficiency and sometimes to help prevent migraines.', reference: 'riboflavin' },
  'calcium carbonate': { name: 'Calcium carbonate (antacid)', usedFor: 'An antacid for heartburn, also a calcium supplement.', reference: null },
  acetaminophen: { name: 'Acetaminophen (paracetamol)', usedFor: 'For pain and fever.', reference: null },
  ibuprofen: { name: 'Ibuprofen', usedFor: 'For pain, fever and swelling.', reference: null },
  amoxicillin: { name: 'Amoxicillin', usedFor: 'An antibiotic for bacterial infections.', reference: null },
};

/** Seeded noise so replays look the same every time. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Build a 180 s curve: inline absorbance rises to `plateau` with time constant `tau`; glow rises to `glow`. Blank = 3200 counts. */
export function makeCurve(opts: { plateau: number; tau: number; glow: number; seed: number; fault?: { at: number; code: string }; temp?: number }): Sample[] {
  const r = rng(opts.seed);
  const blank = 3200, dark = 12;
  const out: Sample[] = [];
  for (let t = 0; t <= 180; t++) {
    const a = opts.plateau * (1 - Math.exp(-t / opts.tau)) + (r() - 0.5) * 0.012;
    const g = opts.glow * (1 - Math.exp(-t / (opts.tau * 1.1))) + (r() - 0.5) * 0.008;
    const fault = opts.fault && t >= opts.fault.at ? opts.fault.code : null;
    out.push({
      t, adc0: Math.round(blank / Math.pow(10, Math.max(0, a))), adc90: Math.round(blank / Math.pow(10, Math.max(0, g))),
      temp: +((opts.temp ?? 24.6) + (r() - 0.5) * 0.2).toFixed(1), dark, blank, led: true, paddle: true, lid: fault !== 'lid_open', fault,
    });
  }
  return out;
}

export const REPLAYS: Record<string, { label: string; drug: string; lot: string; samples: Sample[] }> = {
  'B2-07': { label: 'Riboflavin ¼ tablet, lot B2-07', drug: 'riboflavin', lot: 'B2-07', samples: makeCurve({ plateau: 0.42, tau: 38, glow: 0.33, seed: 7 }) },
  'TM-02': { label: 'Chalk antacid ¼ tablet, lot TM-02 (cloudy water reaches the band, no glow)', drug: 'riboflavin', lot: 'TM-02', samples: makeCurve({ plateau: 0.40, tau: 50, glow: 0.015, seed: 2 }) },
  'B2-LID': { label: 'Riboflavin, lid opened at 0:41', drug: 'riboflavin', lot: 'B2-09', samples: makeCurve({ plateau: 0.42, tau: 38, glow: 0.33, seed: 9, fault: { at: 41, code: 'lid_open' } }) },
  'AMX-01': { label: 'Amoxicillin, no reference', drug: 'amoxicillin', lot: 'AMX-01', samples: makeCurve({ plateau: 0.3, tau: 45, glow: 0.05, seed: 11 }) },
};
