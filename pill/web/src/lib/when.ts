// Small shared helpers for the dashboard screens: local-day maths, time labels, money, and where an activity ref leads.
import { useEffect, useState } from 'react';
import type { Activity } from './types';

/** Wall clock that re-renders every `every` ms (the timetable "now" line, due-soon buttons). */
export function useNow(every = 60e3) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

export const H = 3600e3, DAY = 86400e3;

export const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Hours since local midnight, e.g. 14.5 for 14:30. */
export const hourOf = (t: number) => (t - dayStart(t)) / H;
export const hm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dateLong = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

/** "Today", "Yesterday", or "Wed 21 Oct". */
export function dayLabel(t: number, now = Date.now()) {
  const d = Math.round((dayStart(now) - dayStart(t)) / DAY);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const usd = (n: number, cents = false) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

/** 'HH:MM' on the day of `t` as ms epoch. */
export const atClock = (hhmm: string, t = Date.now()) => { const [h, m] = hhmm.split(':').map(Number); return dayStart(t) + h * H + m * 60e3; };

export function refTo(ref: Activity['ref']): string | null {
  if (!ref) return null;
  if (ref.kind === 'run') return `/evaluation/${ref.id}`;
  if (ref.kind === 'delivery') return `/delivery/${ref.id}`;
  return '/medicines';
}
