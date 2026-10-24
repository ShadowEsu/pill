// "next up → Riboflavin 20:00": the pointer card at the top of Today and Schedule.
import type { NextDose } from '../lib/doses';
import { DAY, dayStart } from '../lib/when';
import './viz.css';

export default function NextUp({ next, now }: { next: NextDose | null; now: number }) {
  if (!next) return null;
  const tomorrow = next.at >= dayStart(now) + DAY;
  const mins = Math.max(0, Math.round((next.at - now) / 60e3));
  return (
    <div className="card row rise" style={{ padding: '14px 18px', gap: 12, borderLeft: '4px solid var(--sky)' }} aria-label={`Next up: ${next.b.drug} at ${next.b.reminder}`}>
      <span className="eyebrow" style={{ flex: 'none' }}>next up</span>
      <span className="pointer" aria-hidden="true" style={{ fontSize: '1.2rem' }}>→</span>
      <span style={{ fontSize: '1.15rem', minWidth: 0 }}><b style={{ textTransform: 'capitalize' }}>{next.b.drug}</b> <span className="mono">{tomorrow ? 'tomorrow ' : ''}{next.b.reminder}</span></span>
      <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>in {mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`}</span>
    </div>
  );
}
