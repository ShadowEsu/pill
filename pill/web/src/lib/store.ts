// App state. One store, persisted to localStorage, read with useStore(). No backend yet: every mutation is local.
// When FastAPI exists, these mutations become fetch calls with the same names (SOFTWARE-PLAN §4).
import { useSyncExternalStore } from 'react';
import type { Bottle, Delivery, LogLine, Mode, Run, Evaluation, Sample, Source, Activity } from './types';
import { DRUGS } from '../data/reference';
import { seedHistory, PEOPLE } from '../data/history';

export interface State {
  mode: Mode | null;            // null until onboarding
  bigText: boolean;             // personal mode default true
  easy: boolean;                // Easy mode: 125 % text, higher contrast, bigger hit areas, read-aloud on (easy.css)
  bottles: Bottle[];
  runs: Run[];
  deliveries: Delivery[];
  station: { id: string; online: boolean; calibratedAt: number | null; reference: string | null };
  activities: Activity[];
}

const KEY = 'pill.state.v2';
const seed = (): State => {
  const h = seedHistory();
  return { mode: null, bigText: false, easy: false, bottles: h.bottles, runs: h.runs, deliveries: h.deliveries, activities: h.activities, station: { id: 'STATION 01', online: true, calibratedAt: Date.now() - 3 * 3600e3, reference: 'riboflavin' } };
};

let state: State = (() => { try { const raw = localStorage.getItem(KEY); return raw ? { ...seed(), ...JSON.parse(raw) } : seed(); } catch { return seed(); } })();
const listeners = new Set<() => void>();
document.documentElement.classList.toggle('big', state.bigText);
document.documentElement.classList.toggle('easy', state.easy);
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
/** Push a named activity line. Actors come from PEOPLE (history.ts) or the current user ("You"). */
function activity(actor: string, text: string, kind: Activity['kind'], ref?: Activity['ref']) {
  const a: Activity = { id: 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), actor, text, kind, ref };
  set((s) => ({ activities: [a, ...s.activities].slice(0, 500) }));
}

export const actions = {
  activity,
  setMode(mode: Mode) { set({ mode, bigText: mode === 'personal' }); document.documentElement.classList.toggle('big', mode === 'personal'); },
  setBigText(bigText: boolean) { set({ bigText }); document.documentElement.classList.toggle('big', bigText); },
  setEasy(easy: boolean) { set({ easy }); document.documentElement.classList.toggle('easy', easy); },
  reset() { localStorage.removeItem(KEY); state = seed(); document.documentElement.classList.remove('easy'); listeners.forEach((l) => l()); },
  calibrate(reference: string) { set((s) => ({ station: { ...s.station, calibratedAt: Date.now(), reference } })); },

  addBottle(b: Omit<Bottle, 'id' | 'takenAt' | 'reminder' | 'runId' | 'usedFor'> & { usedFor?: string }): Bottle {
    const key = b.drug.toLowerCase();
    const bottle: Bottle = { id: 'b-' + Math.random().toString(36).slice(2, 8), takenAt: [], reminder: null, runId: null, usedFor: b.usedFor ?? DRUGS[key]?.usedFor ?? 'Ask your pharmacist what this is for.', ...b };
    set((s) => ({ bottles: [bottle, ...s.bottles] }));
    activity(PEOPLE.you, `scanned a ${bottle.drug} label · lot ${bottle.lot} · recall ${bottle.recall === 'no_record' ? 'no record' : bottle.recall}`, bottle.recall === 'recall' ? 'hold' : 'info', { kind: 'bottle', id: bottle.id });
    return bottle;
  },
  updateBottle(id: string, patch: Partial<Bottle>) { set((s) => ({ bottles: s.bottles.map((b) => (b.id === id ? { ...b, ...patch } : b)) })); },
  markTaken(id: string) { set((s) => ({ bottles: s.bottles.map((b) => (b.id === id ? { ...b, takenAt: [Date.now(), ...b.takenAt] } : b)) })); const b = state.bottles.find((x) => x.id === id); if (b) activity(PEOPLE.you, `took ${b.drug} ${b.strength}`, 'ok', { kind: 'bottle', id }); },

  startRun(r: { drug: string; lot: string; src: Source; bottleId?: string | null; deliveryId?: string | null; demo?: boolean }): Run {
    const run: Run = { id: 'r-' + Date.now().toString(36).slice(-5), src: r.src, drug: r.drug, lot: r.lot, startedAt: Date.now(), samples: [], evaluation: null, mode: state.mode ?? 'personal', ...(r.demo ? { demo: true } : {}) };
    set((s) => ({
      runs: [run, ...s.runs],
      bottles: r.bottleId ? s.bottles.map((b) => (b.id === r.bottleId ? { ...b, runId: run.id } : b)) : s.bottles,
      deliveries: r.deliveryId ? s.deliveries.map((d) => (d.id === r.deliveryId ? { ...d, runId: run.id } : d)) : s.deliveries,
    }));
    activity(PEOPLE.station, `started run ${run.id} · ¼ tablet from lot ${run.lot}`, 'info', { kind: 'run', id: run.id });
    return run;
  },
  /**
   * The guided demo's delivery, fresh for a new demo run: the previous demo's bottle, run and their activity lines go,
   * and the delivery goes back to just "logged" (pending, no bottle, no run, one log line). Returns its id.
   * Without this every demo run piled another TM-02 run, bottle and HOLD onto the same lot.
   */
  resetDemo(d: Pick<Delivery, 'id' | 'supplier' | 'drug' | 'lot' | 'amountUsd'>): string {
    const at = Date.now();
    const logged = `delivery logged · ${d.amountUsd.toFixed(2)} clinic → escrow (SANDBOX / TESTNET)`;
    const fresh: Delivery = { ...d, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at, text: logged, kind: 'money' }], demo: true };
    set((s) => {
      const gone = new Set([d.id, ...s.runs.filter((r) => r.demo).map((r) => r.id), ...s.bottles.filter((b) => b.demo).map((b) => b.id)]);
      return {
        runs: s.runs.filter((r) => !r.demo),
        bottles: s.bottles.filter((b) => !b.demo),
        deliveries: [fresh, ...s.deliveries.filter((x) => x.id !== d.id && !x.demo)],
        activities: s.activities.filter((a) => !(a.ref && gone.has(a.ref.id))),
      };
    });
    activity(PEOPLE.tech, `logged delivery ${d.lot} from ${d.supplier} · $${d.amountUsd.toLocaleString('en-US')} into escrow`, 'money', { kind: 'delivery', id: d.id });
    return d.id;
  },
  appendSamples(runId: string, samples: Sample[]) { set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? { ...r, samples } : r)) })); },
  finishRun(runId: string, evaluation: Evaluation) {
    set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? { ...r, evaluation } : r)) }));
    activity(PEOPLE.station, `finished run ${runId} · ${evaluation.verdict} · rule ${evaluation.rule}${evaluation.pct ? ` · ${evaluation.pct} % of reference` : ''}`, evaluation.verdict === 'PASS' ? 'ok' : 'hold', { kind: 'run', id: runId });
    activity(PEOPLE.claude, `wrote the two-sentence why for ${runId} (filtered)`, 'info', { kind: 'run', id: runId });
  },

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
        if (!bottle || bottle.recall === 'unreachable' || bottle.recall === 'unchecked') return { ...d, outcome: 'hold', clause: 'P6', log: [...d.log, line(`P6 recall ${bottle ? 'lookup unreachable' : 'not checked (no bottle attached)'} · HOLD until a lookup succeeds`, 'hold')] };
        if (ev.verdict === 'UNABLE TO VERIFY') return { ...d, outcome: 'escalate', clause: 'P3', log: [...d.log, line(`P3 ${ev.verdict} (${ev.rule}) · ESCALATE to a person · no money moves`, 'hold')] };
        if (ev.verdict === 'NEEDS LAB') return { ...d, outcome: 'hold', clause: 'P2', log: [...d.log, line(`P2 NEEDS LAB (${ev.rule}) · HOLD · lab referral drafted with the curve attached`, 'hold')] };
        if (d.amountUsd > 2000) return { ...d, outcome: 'escalate', clause: 'P5', log: [...d.log, line(`P5 amount ${d.amountUsd.toFixed(2)} above the cap 2,000.00 · ESCALATE`, 'hold')] };
        return { ...d, outcome: 'release', clause: 'P1', log: [...d.log, line(`P1 PASS (${ev.rule}) · no recall · within cap · RELEASE proposed · needs the pharmacist's tap`, 'ok')] };
      }),
    }));
    const d = state.deliveries.find((x) => x.id === deliveryId);
    if (d && d.clause) activity(PEOPLE.agent, `proposed ${d.outcome.toUpperCase()} for lot ${d.lot} · ${d.clause}`, d.outcome === 'release' ? 'ok' : 'hold', { kind: 'delivery', id: deliveryId });
  },
  /** The pharmacist tap. Only legal when the proposed outcome is release. */
  approve(deliveryId: string, who = PEOPLE.pharmacist) {
    const wired = Boolean(import.meta.env.VITE_PAY_URL);
    const tx = wired ? null : '0xsim' + Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6);
    let moved: Delivery | null = null;
    set((s) => ({
      deliveries: s.deliveries.map((d) => {
        if (d.id !== deliveryId || d.outcome !== 'release') return d;
        moved = d;
        return { ...d, outcome: 'released', log: [...d.log, { at: Date.now(), text: `${who} tapped RELEASE`, kind: 'ok' }, ...(tx ? [{ at: Date.now(), text: `USDC ${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} escrow → supplier · SIMULATED tx ${tx} · no CDP credentials, nothing moved · Nessie SANDBOX mirror`, kind: 'money' as const }] : [])] };
      }),
    }));
    if (moved) {
      const d = moved as Delivery;
      activity(who, `tapped RELEASE for lot ${d.lot}`, 'ok', { kind: 'delivery', id: deliveryId });
      if (tx) activity(PEOPLE.cdp, `SIMULATED: would move USDC ${d.amountUsd.toLocaleString('en-US')} escrow → ${d.supplier} · tx ${tx} · no credentials, nothing moved`, 'money', { kind: 'delivery', id: deliveryId });
    }
  },
  attachBottle(deliveryId: string, bottleId: string) { set((s) => ({ deliveries: s.deliveries.map((d) => (d.id === deliveryId ? { ...d, bottleId } : d)) })); },
};
