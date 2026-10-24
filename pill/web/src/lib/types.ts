// Shared contract for the Pill app. Keep in sync with SOFTWARE-PLAN.md §2 (ESP32 JSON) and §4 (endpoints).

export type Source = 'real' | 'replay' | 'sim';

/** One line from the station, once a second. adc0 = inline (blue absorbance), adc90 = 90° (green glow). */
export interface Sample {
  t: number;          // seconds since run start
  adc0: number;       // raw inline reading, counts
  adc90: number;      // raw 90° reading, counts
  temp: number;       // water °C
  dark: number;       // dark-current reading at the start, counts
  blank: number;      // inline reading with clear water, counts
  led: boolean;       // LED baseline ok
  paddle: boolean;    // stepper turning
  lid: boolean;       // lid closed
  fault: string | null; // 'lid_open' | 'led_fail' | 'temp_out' | 'no_blank' | null
}

export type Verdict = 'PASS' | 'NEEDS LAB' | 'UNABLE TO VERIFY';
export type RuleId = 'U1' | 'U2' | 'U3' | 'N1' | 'N2' | 'N3' | 'P1';

export interface Reference {
  drug: string;               // 'riboflavin'
  label: string;              // 'Riboflavin 100 mg (¼ tablet)'
  bandLow: number;            // plateau band, absorbance
  bandHigh: number;
  bandMean: number;
  glowMin: number;            // minimum rise in 90° glow (absorbance units) for P1
  scatterMax: number;         // max residual scatter for a usable curve
  runs: number;               // reference runs behind the band
  cv: number;                 // % coefficient of variation of the reference plateaus
}

export interface Evaluation {
  verdict: Verdict;
  rule: RuleId;
  plateau: number;            // absorbance at plateau (median of last 20 s)
  glowRise: number;           // 90° absorbance rise over the run
  scatter: number;            // residual scatter of the last 30 s
  pct: number;                // plateau / bandMean × 100, capped at 120
  temp: number;
  fault: string | null;
  why: string;                // two sentences, deterministic template until Claude is wired (filtered)
  nextStep: string;           // 'proceed under clinic policy' | 'send to lab' | 'retest'
  ship: 'yes' | 'hold' | 'ask'; // clinic word for release / hold / escalate
}

export interface Run {
  id: string;
  src: Source;
  drug: string;
  lot: string;
  startedAt: number;          // ms epoch
  samples: Sample[];
  evaluation: Evaluation | null;
  mode: Mode;
}

export type Mode = 'medical' | 'personal';

export interface Bottle {
  id: string;
  drug: string;               // 'Riboflavin'
  strength: string;           // '100 mg'
  lot: string;
  maker: string;
  expiry: string;             // 'YYYY-MM'
  usedFor: string;            // plain words, from the drug table
  recall: RecallStatus;
  recallCheckedAt: number | null;
  runId: string | null;       // the one tested tablet
  takenAt: number[];          // dose log (personal)
  reminder: string | null;    // 'HH:MM' (personal)
}

export type RecallStatus = 'no_record' | 'recall' | 'unreachable' | 'unchecked';

export interface Delivery {
  id: string;
  supplier: string;
  drug: string;
  lot: string;
  amountUsd: number;          // SANDBOX / TESTNET
  bottleId: string | null;
  runId: string | null;
  outcome: 'pending' | 'release' | 'hold' | 'escalate' | 'released';
  clause: string | null;      // 'P1'…'P6'
  log: LogLine[];
}

export interface LogLine {
  at: number;
  text: string;
  kind: 'info' | 'ok' | 'hold' | 'money';
}
