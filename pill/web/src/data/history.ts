// Seven days of seeded history for the demo: deliveries, runs with real evaluations, bottles with dose logs, and a named activity feed.
// Deterministic (fixed seeds, times relative to "now" at module load) so every screenshot looks the same.
import type { Bottle, Delivery, Run, Activity, Sample } from '../lib/types';
import { evaluate } from '../lib/rules';
import { REFERENCES, makeCurve } from './reference';

const DAY = 86400e3, H = 3600e3;
const now = Date.now();
const startOfToday = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
const at = (daysAgo: number, hour: number, min = 0) => startOfToday - daysAgo * DAY + hour * H + min * 60e3;

export const PEOPLE = {
  pharmacist: 'A. Okafor, pharmacist',
  tech: 'M. Reyes, pharmacy tech',
  agent: 'Policy agent',
  station: 'Station 01',
  claude: 'Claude (why-writer)',
  openfda: 'openFDA',
  cdp: 'CDP wallet',
  nessie: 'Nessie sandbox',
  you: 'You',
} as const;

const SUPPLIERS = ['Northside Pharma Supply', 'Bayview Medical Wholesale', 'Golden Gate Rx Distribution', 'Mission Health Supply', 'Pacific Generics Co.'];

interface Spec { daysAgo: number; hour: number; lot: string; supplier: number; amount: number; kind: 'pass' | 'low' | 'chalk' | 'fault' | 'noref' | 'untested' | 'recall'; seed: number }
const SPECS: Spec[] = [
  { daysAgo: 6, hour: 9, lot: 'B2-01', supplier: 0, amount: 1180, kind: 'pass', seed: 101 },
  { daysAgo: 6, hour: 14, lot: 'TM-01', supplier: 1, amount: 420, kind: 'chalk', seed: 102 },
  { daysAgo: 5, hour: 10, lot: 'B2-02', supplier: 2, amount: 1320, kind: 'pass', seed: 103 },
  { daysAgo: 5, hour: 16, lot: 'B2-03', supplier: 0, amount: 980, kind: 'low', seed: 104 },
  { daysAgo: 4, hour: 9, lot: 'B2-04', supplier: 3, amount: 1500, kind: 'pass', seed: 105 },
  { daysAgo: 4, hour: 11, lot: 'B2-05', supplier: 4, amount: 760, kind: 'fault', seed: 106 },
  { daysAgo: 3, hour: 10, lot: 'B2-06', supplier: 2, amount: 1240, kind: 'pass', seed: 107 },
  { daysAgo: 3, hour: 15, lot: 'B2-08', supplier: 1, amount: 1100, kind: 'recall', seed: 108 },
  { daysAgo: 2, hour: 9, lot: 'B2-09', supplier: 0, amount: 1260, kind: 'pass', seed: 109 },
  { daysAgo: 2, hour: 13, lot: 'TM-03', supplier: 4, amount: 390, kind: 'chalk', seed: 110 },
  { daysAgo: 1, hour: 10, lot: 'B2-10', supplier: 3, amount: 1420, kind: 'pass', seed: 111 },
  { daysAgo: 1, hour: 17, lot: 'B2-11', supplier: 2, amount: 2350, kind: 'pass', seed: 112 },
];

function samplesFor(s: Spec): Sample[] | null {
  switch (s.kind) {
    case 'pass': case 'recall': return makeCurve({ plateau: 0.40 + ((s.seed % 5) * 0.012), tau: 36 + (s.seed % 4) * 2, glow: 0.30 + (s.seed % 3) * 0.015, seed: s.seed });
    case 'low': return makeCurve({ plateau: 0.29, tau: 44, glow: 0.19, seed: s.seed });
    case 'chalk': return makeCurve({ plateau: 0.40, tau: 50, glow: 0.015, seed: s.seed });
    case 'fault': return makeCurve({ plateau: 0.41, tau: 38, glow: 0.31, seed: s.seed, fault: { at: 52, code: 'lid_open' } });
    case 'noref': return makeCurve({ plateau: 0.3, tau: 45, glow: 0.05, seed: s.seed });
    default: return null;
  }
}

export function seedHistory(): { deliveries: Delivery[]; runs: Run[]; bottles: Bottle[]; activities: Activity[] } {
  const deliveries: Delivery[] = [];
  const runs: Run[] = [];
  const bottles: Bottle[] = [];
  const activities: Activity[] = [];
  const act = (t: number, actor: string, text: string, kind: Activity['kind'], ref?: Activity['ref']) => activities.push({ id: 'a-' + activities.length, at: t, actor, text, kind, ref });

  SPECS.forEach((s, i) => {
    const t0 = at(s.daysAgo, s.hour);
    const drug = s.lot.startsWith('TM') ? 'calcium carbonate' : 'riboflavin';
    const id = 'd-' + (1020 + i);
    const d: Delivery = { id, supplier: SUPPLIERS[s.supplier], drug, lot: s.lot, amountUsd: s.amount, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at: t0, text: `delivery logged · ${s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} clinic → escrow (SANDBOX / TESTNET)`, kind: 'money' }] };
    act(t0, PEOPLE.tech, `logged delivery ${s.lot} from ${d.supplier} · $${s.amount.toLocaleString('en-US')} into escrow`, 'money', { kind: 'delivery', id });
    const bottle: Bottle = { id: 'b-' + (200 + i), drug, strength: drug === 'riboflavin' ? '100 mg' : '500 mg', lot: s.lot, maker: drug === 'riboflavin' ? "Nature's Bounty" : 'GSK', expiry: '2027-03', usedFor: drug === 'riboflavin' ? 'A vitamin. Used for B2 deficiency and sometimes to help prevent migraines.' : 'An antacid for heartburn, also a calcium supplement.', recall: s.kind === 'recall' ? 'recall' : 'no_record', recallCheckedAt: t0 + 4 * 60e3, runId: null, takenAt: [], reminder: null };
    act(t0 + 3 * 60e3, PEOPLE.tech, `photographed the ${s.lot} label · Gemini read 5 fields`, 'info', { kind: 'bottle', id: bottle.id });
    act(t0 + 4 * 60e3, PEOPLE.openfda, s.kind === 'recall' ? `RECALL record found for lot ${s.lot}` : `no recall record for lot ${s.lot}`, s.kind === 'recall' ? 'hold' : 'info', { kind: 'bottle', id: bottle.id });
    d.bottleId = bottle.id;
    const samples = samplesFor(s);
    if (samples) {
      const rid = 'r-' + (900 + i);
      const ref = REFERENCES[drug] ?? REFERENCES.riboflavin; // chalk lots are tested against the riboflavin band (the two-channel story)
      const ev = evaluate(samples, s.kind === 'noref' ? null : ref);
      runs.push({ id: rid, src: 'replay', drug, lot: s.lot, startedAt: t0 + 6 * 60e3, samples, evaluation: ev, mode: 'medical' });
      bottle.runId = rid; d.runId = rid;
      act(t0 + 6 * 60e3, PEOPLE.station, `started run ${rid} · whole tablet from ${s.lot}`, 'info', { kind: 'run', id: rid });
      act(t0 + 9 * 60e3, PEOPLE.station, `finished run ${rid} · ${ev.verdict} · rule ${ev.rule} · ${ev.pct ? ev.pct + ' % of reference' : 'no reference'}`, ev.verdict === 'PASS' ? 'ok' : 'hold', { kind: 'run', id: rid });
      act(t0 + 9 * 60e3 + 20e3, PEOPLE.claude, `wrote the two-sentence why for ${rid} (filtered)`, 'info', { kind: 'run', id: rid });
      // policy
      const tP = t0 + 10 * 60e3;
      if (bottle.recall === 'recall') { d.outcome = 'hold'; d.clause = 'P4'; d.log.push({ at: tP, text: `P4 recall record for lot ${s.lot} · HOLD regardless of verdict`, kind: 'hold' }); act(tP, PEOPLE.agent, `proposed HOLD for ${s.lot} · P4 recall`, 'hold', { kind: 'delivery', id }); }
      else if (ev.verdict === 'UNABLE TO VERIFY') { d.outcome = 'escalate'; d.clause = 'P3'; d.log.push({ at: tP, text: `P3 ${ev.verdict} (${ev.rule}) · ESCALATE to a person · no money moves`, kind: 'hold' }); act(tP, PEOPLE.agent, `escalated ${s.lot} · P3 ${ev.rule}`, 'hold', { kind: 'delivery', id }); }
      else if (ev.verdict === 'NEEDS LAB') { d.outcome = 'hold'; d.clause = 'P2'; d.log.push({ at: tP, text: `P2 NEEDS LAB (${ev.rule}) · HOLD · lab referral drafted with the curve attached`, kind: 'hold' }); act(tP, PEOPLE.agent, `proposed HOLD for ${s.lot} · P2 · lab referral drafted`, 'hold', { kind: 'delivery', id }); }
      else if (s.amount > 2000) { d.outcome = 'escalate'; d.clause = 'P5'; d.log.push({ at: tP, text: `P5 amount ${s.amount.toFixed(2)} above the cap 2,000.00 · ESCALATE`, kind: 'hold' }); act(tP, PEOPLE.agent, `escalated ${s.lot} · P5 amount above cap`, 'hold', { kind: 'delivery', id }); }
      else {
        d.outcome = 'released'; d.clause = 'P1';
        const tx = '0x' + (s.seed * 2654435761 % 0xffff).toString(16).padStart(4, '0') + '…' + (s.seed * 40503 % 0xffff).toString(16).padStart(4, '0');
        d.log.push({ at: tP, text: `P1 PASS (${ev.rule}) · no recall · within cap · RELEASE proposed · needs the pharmacist's tap`, kind: 'ok' });
        d.log.push({ at: tP + 7 * 60e3, text: `${PEOPLE.pharmacist} tapped RELEASE`, kind: 'ok' });
        d.log.push({ at: tP + 7 * 60e3 + 2e3, text: `USDC ${s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} escrow → supplier · Base Sepolia tx ${tx} (TESTNET) · Nessie SANDBOX mirror ok`, kind: 'money' });
        act(tP, PEOPLE.agent, `proposed RELEASE for ${s.lot} · P1`, 'ok', { kind: 'delivery', id });
        act(tP + 7 * 60e3, PEOPLE.pharmacist, `tapped RELEASE for ${s.lot}`, 'ok', { kind: 'delivery', id });
        act(tP + 7 * 60e3 + 2e3, PEOPLE.cdp, `moved USDC ${s.amount.toLocaleString('en-US')} escrow → ${d.supplier} · tx ${tx} (TESTNET)`, 'money', { kind: 'delivery', id });
      }
    }
    deliveries.push(d); bottles.push(bottle);
  });

  // two deliveries still pending for the live demo
  deliveries.unshift(
    { id: 'd-1041', supplier: 'Northside Pharma Supply', drug: 'riboflavin', lot: 'B2-07', amountUsd: 1240, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at: now - 50 * 60e3, text: 'delivery logged · 1,240.00 clinic → escrow (SANDBOX / TESTNET)', kind: 'money' }] },
    { id: 'd-1042', supplier: 'Bayview Medical Wholesale', drug: 'calcium carbonate', lot: 'TM-02', amountUsd: 480, bottleId: null, runId: null, outcome: 'pending', clause: null, log: [{ at: now - 30 * 60e3, text: 'delivery logged · 480.00 clinic → escrow (SANDBOX / TESTNET)', kind: 'money' }], demo: true },
  );
  act(now - 50 * 60e3, PEOPLE.tech, 'logged delivery B2-07 from Northside Pharma Supply · $1,240 into escrow', 'money', { kind: 'delivery', id: 'd-1041' });
  act(now - 30 * 60e3, PEOPLE.tech, 'logged delivery TM-02 from Bayview Medical Wholesale · $480 into escrow', 'money', { kind: 'delivery', id: 'd-1042' });
  act(now - 3 * H, PEOPLE.station, 'calibrated · 10 reference runs · CV 7 % · band 0.36–0.47', 'ok');

  // personal bottles with two weeks of doses (for the dose heat map and the schedule)
  const personal: Bottle[] = [
    { id: 'b-p1', drug: 'riboflavin', strength: '100 mg', lot: 'B2-06', maker: "Nature's Bounty", expiry: '2027-03', usedFor: 'A vitamin. Used for B2 deficiency and sometimes to help prevent migraines.', recall: 'no_record', recallCheckedAt: at(3, 10), runId: 'r-906', takenAt: [], reminder: '08:00' },
    { id: 'b-p2', drug: 'calcium carbonate', strength: '500 mg', lot: 'TM-03', maker: 'GSK', expiry: '2026-11', usedFor: 'An antacid for heartburn, also a calcium supplement.', recall: 'no_record', recallCheckedAt: at(2, 13), runId: 'r-909', takenAt: [], reminder: '20:00' },
    { id: 'b-p3', drug: 'acetaminophen', strength: '500 mg', lot: 'AC-118', maker: 'Kirkland', expiry: '2026-08', usedFor: 'For pain and fever.', recall: 'no_record', recallCheckedAt: at(1, 9), runId: null, takenAt: [], reminder: null },
  ];
  for (let dAgo = 13; dAgo >= 1; dAgo--) {
    if (dAgo % 5 !== 0) personal[0].takenAt.push(at(dAgo, 8, 2 + (dAgo % 7)));
    if (dAgo % 3 !== 1) personal[1].takenAt.push(at(dAgo, 20, 5 + (dAgo % 9)));
    if (dAgo % 4 === 0) personal[2].takenAt.push(at(dAgo, 14, 10));
  }
  personal.forEach((b) => b.takenAt.sort((x, y) => y - x));

  activities.sort((x, y) => y.at - x.at);
  return { deliveries, runs, bottles: [...personal, ...bottles], activities };
}
