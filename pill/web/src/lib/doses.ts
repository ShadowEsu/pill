// Personal dose plan, derived from bottles: whose bottles they are, today's planned / taken / missed blocks, what is due next.
import type { Bottle, Delivery } from './types';
import type { TItem } from '../components/Timetable';
import { DAY, H, atClock, dayStart, hm } from './when';

/** The user's own bottles: not tied to a clinic delivery. */
export const myBottles = (bottles: Bottle[], deliveries: Delivery[]) => bottles.filter((b) => !deliveries.some((d) => d.bottleId === b.id));

export const takenToday = (b: Bottle, now: number) => b.takenAt.filter((t) => t >= dayStart(now));

/** Today's timetable: taken doses (mint), planned reminders still ahead (outline), reminders that passed untaken (amber).
 *  `lane` = bottle index (the lane carries the drug name); the block says the time and, with `withSub`, what happened. */
export function doseItems(bottles: Bottle[], now: number, withSub = true): TItem[] {
  const out: TItem[] = [];
  bottles.forEach((b, lane) => {
    const taken = takenToday(b, now);
    taken.forEach((t) => out.push({ at: t, dur: 30, label: hm(t), sub: withSub ? `taken · ${b.drug}` : undefined, kind: 'dose', to: '/medicines', lane }));
    if (b.reminder && !taken.length) {
      const at = atClock(b.reminder, now);
      const missed = now > at;
      out.push({ at, dur: 30, label: b.reminder, sub: withSub ? `${missed ? 'missed' : 'planned'} · ${b.drug}` : undefined, kind: missed ? 'missed' : 'planned', to: '/medicines', lane });
    }
  });
  return out;
}

/** A reminder and when it next falls. */
export interface NextDose { b: Bottle; at: number }

/** Next reminder not yet taken today; else the earliest one tomorrow. */
export function nextUp(bottles: Bottle[], now: number): NextDose | null {
  const plan = bottles.filter((b) => b.reminder).map((b) => ({ b, at: atClock(b.reminder!, now) }));
  const today = plan.filter((p) => p.at > now && !takenToday(p.b, now).length).sort((x, y) => x.at - y.at)[0];
  if (today) return today;
  const tomorrow = plan.map((p) => ({ ...p, at: p.at + DAY })).sort((x, y) => x.at - y.at)[0];
  return tomorrow ?? null;
}

/** Reminders due within the next 2 h, or already passed today, and not taken today. */
export const dueSoon = (bottles: Bottle[], now: number) =>
  bottles.filter((b) => b.reminder && !takenToday(b, now).length && atClock(b.reminder, now) <= now + 2 * H);
