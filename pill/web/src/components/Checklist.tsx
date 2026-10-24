// Station pre-checks as a quiet list. A waiting check has a sky arc circling its ring; when it turns green the ring pops
// mint, the checkmark draws itself (SVG stroke) and the row flashes once. Reduced motion: drawn, no flash.
import './cinema.css';

export interface ChecklistItem { label: string; done: boolean; hint?: string }

export default function Checklist({ items }: { items: ChecklistItem[] }) {
  const next = items.findIndex((it) => !it.done);
  return (
    <ul className="card" style={{ listStyle: 'none', margin: 0, padding: '4px 18px' }} aria-label="Station checks">
      {items.map((it, i) => (
        <li key={it.label} className={'row cn-check-row' + (it.done ? ' on' : '')} style={{ minHeight: 58, borderTop: i ? '1px solid var(--line)' : 0, gap: 14, marginInline: -18, paddingInline: 18 }}>
          <span aria-hidden="true" className={'cn-check-ring' + (it.done ? ' on' : i === next ? ' wait' : '')}>
            <svg width="13" height="13" viewBox="0 0 12 12">
              <path d="M2.5 6.2 5 8.6 9.6 3.6" pathLength={1} fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500, fontSize: '1.05rem' }}>{it.label}</span>
            {it.hint && <span className="footnote" style={{ display: 'block' }}>{it.hint}</span>}
          </span>
          <span className="mono" style={{ fontSize: 12, color: it.done ? 'var(--ink-2)' : 'var(--muted)' }}>{it.done ? 'ok' : i === next ? 'checking' : 'waiting'}</span>
        </li>
      ))}
    </ul>
  );
}
