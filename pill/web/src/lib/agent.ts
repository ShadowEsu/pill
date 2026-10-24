// The policy agent's record, derived from the delivery logs (seeded history + live store). Nothing here is stored
// separately: a decision is a delivery log line that starts with a clause id (P1–P6), written by store.propose or the seed.
import type { Delivery } from './types';

export type DecisionKind = 'proposed' | 'held' | 'escalated';
export interface Decision {
  id: string; at: number; deliveryId: string; lot: string; supplier: string; amount: number;
  clause: string; kind: DecisionKind; asked: string; asksPerson: boolean; text: string;
}

/** What the agent asked, per clause (policy.md P1–P6). */
const ASKED: Record<string, { kind: DecisionKind; asked: string; person: boolean }> = {
  P1: { kind: 'proposed', asked: 'asked the pharmacist to tap release', person: true },
  P2: { kind: 'held', asked: 'drafted a lab referral with the curve attached', person: false },
  P3: { kind: 'escalated', asked: 'asked a person to retest or decide; no money moves', person: true },
  P4: { kind: 'held', asked: 'held for the recall; asked nobody to override it', person: false },
  P5: { kind: 'escalated', asked: 'asked a person to approve an amount above the cap', person: true },
  P6: { kind: 'held', asked: 'asked for a recall lookup that succeeds, or a person', person: true },
};

export function decisions(deliveries: Delivery[]): Decision[] {
  const out: Decision[] = [];
  for (const d of deliveries) {
    d.log.forEach((l, i) => {
      const clause = /^(P[1-6])\b/.exec(l.text)?.[1];
      if (!clause) return;
      const a = ASKED[clause];
      out.push({ id: `${d.id}-${i}`, at: l.at, deliveryId: d.id, lot: d.lot, supplier: d.supplier, amount: d.amountUsd, clause, kind: a.kind, asked: a.asked, asksPerson: a.person, text: l.text });
    });
  }
  return out.sort((x, y) => y.at - x.at);
}

export interface Scorecard { proposed: number; held: number; escalated: number; asked: number; releasedByPerson: number; movedByAgentAlone: number; total: number }

/** Counts over the record. `movedByAgentAlone` counts supplier payments with no person's tap logged before them in the same delivery. */
export function scorecard(deliveries: Delivery[], ds = decisions(deliveries)): Scorecard {
  let releasedByPerson = 0, movedByAgentAlone = 0;
  for (const d of deliveries) {
    let tapped = false;
    for (const l of d.log) {
      if (/tapped RELEASE/.test(l.text)) { tapped = true; releasedByPerson++; }
      if (l.kind === 'money' && /escrow → supplier/.test(l.text) && !tapped) movedByAgentAlone++;
    }
  }
  return {
    proposed: ds.filter((x) => x.kind === 'proposed').length,
    held: ds.filter((x) => x.kind === 'held').length,
    escalated: ds.filter((x) => x.kind === 'escalated').length,
    asked: ds.filter((x) => x.asksPerson).length,
    releasedByPerson, movedByAgentAlone, total: ds.length,
  };
}
