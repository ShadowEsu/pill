// App state. One store, persisted to localStorage, read with useStore(). No backend yet: every mutation is local.
// When FastAPI exists, these mutations become fetch calls with the same names (SOFTWARE-PLAN §4).
import { useSyncExternalStore } from 'react';
import type { Bottle, Delivery, LogLine, Mode, Run, Evaluation, Sample, Source } from './types';
import { DRUGS } from '../data/reference';

export interface State {
  mode: Mode | null;            // null until onboarding
  bigText: boolean;             // personal mode default true
  bottles: Bottle[];
  runs: Run[];
  deliveries: Delivery[];
  station: { id: string; online: boolean; calibratedAt: number | null; reference: string | null };
}

const KEY = 'pill.state.v1';
const seed = (): State => ({
  mode: null,
  bigText: false,
  bottles: [],
  runs: [],
  deliveries: [
    { id: 'd-1041', supplier: 'Northside Pharma Supply', drug: 'riboflavin', lot: 'B2-07', amountUsd: 1240, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at: Date.now() - 3600e3, text: 'delivery logged · 1,240.00 clinic → escrow (SANDBOX / TESTNET)', kind: 'money' }] },
    { id: 'd-1042', supplier: 'Bayview Medical Wholesale', drug: 'calcium carbonate', lot: 'TM-02', amountUsd: 480, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at: Date.now() - 1800e3, text: 'delivery logged · 480.00 clinic → escrow (SANDBOX / TESTNET)', kind: 'money' }] },
  ],
  station: { id: 'STATION 01', online: true, calibratedAt: null, reference: 'riboflavin' },
});

let state: State = (() => { try { const raw = localStorage.getItem(KEY); return raw ? { ...seed(), ...JSON.parse(raw) } : seed(); } catch { return seed(); } })();
const listeners = new Set<() => void>();
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => sel(state), () => sel(state));
}
export const getState = () => state;

/* ---------- actions ---------- */
export const actions = {
  setMode(mode: Mode) { set({ mode, bigText: mode === 'personal' }); document.documentElement.classList.toggle('big', mode === 'personal'); },
  setBigText(bigText: boolean) { set({ bigText }); document.documentElement.classList.toggle('big', bigText); },
  reset() { localStorage.removeItem(KEY); state = seed(); listeners.forEach((l) => l()); },

  addBottle(b: Omit<Bottle, 'id' | 'takenAt' | 'reminder' | 'runId' | 'usedFor'> & { usedFor?: string }): Bottle {
    const key = b.drug.toLowerCase();
    const bottle: Bottle = { id: 'b-' + Math.random().toString(36).slice(2, 8), takenAt: [], reminder: null, runId: null, usedFor: b.usedFor ?? DRUGS[key]?.usedFor ?? 'Ask your pharmacist what this is for.', ...b };
    set((s) => ({ bottles: [bottle, ...s.bottles] }));
    return bottle;
  },
  updateBottle(id: string, patch: Partial<Bottle>) { set((s) => ({ bottles: s.bottles.map((b) => (b.id === id ? { ...b, ...patch } : b)) })); },
  markTaken(id: string) { set((s) => ({ bottles: s.bottles.map((b) => (b.id === id ? { ...b, takenAt: [Date.now(), ...b.takenAt] } : b)) })); },

  startRun(r: { drug: string; lot: string; src: Source; bottleId?: string | null; deliveryId?: string | null }): Run {
    const run: Run = { id: 'r-' + String(1000 + state.runs.length + 1), src: r.src, drug: r.drug, lot: r.lot, startedAt: Date.now(), samples: [], evaluation: null, mode: state.mode ?? 'personal' };
    set((s) => ({
      runs: [run, ...s.runs],
      bottles: r.bottleId ? s.bottles.map((b) => (b.id === r.bottleId ? { ...b, runId: run.id } : b)) : s.bottles,
      deliveries: r.deliveryId ? s.deliveries.map((d) => (d.id === r.deliveryId ? { ...d, runId: run.id } : d)) : s.deliveries,
    }));
    return run;
  },
  appendSamples(runId: string, samples: Sample[]) { set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? { ...r, samples } : r)) })); },
  finishRun(runId: string, evaluation: Evaluation) { set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? { ...r, evaluation } : r)) })); },

  /** Policy (deterministic, policy.md P1–P6). Sets the proposed outcome; release still needs the tap. */
  propose(deliveryId: string) {
    set((s) => ({
      deliveries: s.deliveries.map((d) => {
        if (d.id !== deliveryId) return d;
        const run = s.runs.find((r) => r.id === d.runId);
        const bottle = s.bottles.find((b) => b.id === d.bottleId);
        const ev = run?.evaluation;
        const line = (text: string, kind: LogLine['kind']): LogLine => ({ at: Date.now(), text, kind });
        if (!ev) return d;
        if (bottle?.recall === 'recall') return { ...d, outcome: 'hold', clause: 'P4', log: [...d.log, line(`P4 recall record for lot ${d.lot} · HOLD regardless of verdict`, 'hold')] };
        if (bottle?.recall === 'unreachable') return { ...d, outcome: 'hold', clause: 'P6', log: [...d.log, line('P6 recall lookup unreachable · HOLD until a lookup succeeds', 'hold')] };
        if (ev.verdict === 'UNABLE TO VERIFY') return { ...d, outcome: 'escalate', clause: 'P3', log: [...d.log, line(`P3 ${ev.verdict} (${ev.rule}) · ESCALATE to a person · no money moves`, 'hold')] };
        if (ev.verdict === 'NEEDS LAB') return { ...d, outcome: 'hold', clause: 'P2', log: [...d.log, line(`P2 NEEDS LAB (${ev.rule}) · HOLD · lab referral drafted with the curve attached`, 'hold')] };
        if (d.amountUsd > 2000) return { ...d, outcome: 'escalate', clause: 'P5', log: [...d.log, line(`P5 amount ${d.amountUsd.toFixed(2)} above the cap 2,000.00 · ESCALATE`, 'hold')] };
        return { ...d, outcome: 'release', clause: 'P1', log: [...d.log, line(`P1 PASS (${ev.rule}) · no recall · within cap · RELEASE proposed · needs the pharmacist's tap`, 'ok')] };
      }),
    }));
  },
  /** The pharmacist tap. Only legal when the proposed outcome is release. */
  approve(deliveryId: string, who = 'pharmacist') {
    set((s) => ({
      deliveries: s.deliveries.map((d) => {
        if (d.id !== deliveryId || d.outcome !== 'release') return d;
        const tx = '0x' + Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6);
        return { ...d, outcome: 'released', log: [...d.log, { at: Date.now(), text: `${who} tapped RELEASE`, kind: 'ok' }, { at: Date.now(), text: `USDC ${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} escrow → supplier · Base Sepolia tx ${tx} (TESTNET) · Nessie SANDBOX mirror ok`, kind: 'money' }] };
      }),
    }));
  },
  attachBottle(deliveryId: string, bottleId: string) { set((s) => ({ deliveries: s.deliveries.map((d) => (d.id === deliveryId ? { ...d, bottleId } : d)) })); },
};
