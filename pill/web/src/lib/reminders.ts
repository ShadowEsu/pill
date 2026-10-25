// "Remind me": a browser notification at a bottle's reminder time, every day, while Pill is open in a tab (the Notification
// API has no alarms of its own; a closed tab rings nothing, and the screens say so). Which bottles ring is kept in
// localStorage['pill.remind']; the clock (started once from main.tsx) looks every 20 s and rings each bottle at most once a
// day, and never after that day's dose was logged.
import { useSyncExternalStore } from 'react';
import { getState } from './store';
import { atClock, dayStart } from './when';

const KEY = 'pill.remind', RANG = 'pill.remind.rang';
export type Permission = NotificationPermission | 'unsupported';

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const permission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

let snap = { on: read<string[]>(KEY, []), permission: permission() };
const listeners = new Set<() => void>();
const emit = () => { snap = { on: read<string[]>(KEY, []), permission: permission() }; listeners.forEach((l) => l()); };

export const useReminders = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snap);

/** Turns a bottle's daily notification on (asking for permission first when needed) or off. Resolves to the permission. */
export async function setReminder(bottleId: string, on: boolean): Promise<Permission> {
  let p = permission();
  if (on && p === 'default') p = await Notification.requestPermission();
  const ids = read<string[]>(KEY, []).filter((x) => x !== bottleId);
  write(KEY, on && p === 'granted' ? [...ids, bottleId] : ids);
  emit();
  return p;
}

/** Rings every reminder that is due now. */
function ring(now = Date.now()) {
  if (permission() !== 'granted') return;
  const on = read<string[]>(KEY, []);
  const rang = read<Record<string, number>>(RANG, {});
  const today = dayStart(now);
  for (const b of getState().bottles) {
    if (!on.includes(b.id) || !b.reminder) continue;
    const at = atClock(b.reminder, now);
    // due, not rung today, not already taken today, and not more than an hour late (an old tab waking up stays quiet)
    if (now < at || now > at + 3600e3 || (rang[b.id] ?? 0) >= today || b.takenAt.some((t) => t >= today)) continue;
    rang[b.id] = now;
    const n = new Notification(`Time for ${b.drug} ${b.strength}`, { body: `${b.reminder} · lot ${b.lot}. Open Pill and tap "I took it".`, tag: `pill-${b.id}` });
    n.onclick = () => { window.focus(); n.close(); };
  }
  write(RANG, rang);
}

let started = false;
/** Starts the reminder clock for this tab (idempotent). */
export function startReminderClock() {
  if (started) return;
  started = true;
  window.setInterval(ring, 20_000);
  ring();
}
