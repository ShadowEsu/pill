// Station pre-checks as a quiet list: a ring that fills mint when the check is done. Things-3 calm, no bounce.
export interface ChecklistItem { label: string; done: boolean; hint?: string }

export default function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="card" style={{ listStyle: 'none', margin: 0, padding: '4px 18px' }} aria-label="Station checks">
      {items.map((it, i) => (
        <li key={it.label} className="row" style={{ minHeight: 56, borderTop: i ? '1px solid var(--line)' : 0, gap: 14 }}>
          <span aria-hidden="true" style={{
            width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
            border: '1.5px solid ' + (it.done ? 'var(--mint)' : 'var(--line-2)'),
            background: it.done ? 'var(--mint)' : 'transparent',
            boxShadow: it.done ? '0 0 0 4px var(--mint-tint)' : 'none',
            transition: 'background .3s var(--ease), border-color .3s var(--ease), box-shadow .3s var(--ease)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: it.done ? 1 : 0, transition: 'opacity .3s var(--ease)' }}>
              <path d="M2.5 6.2 5 8.6 9.6 3.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500, fontSize: '1.05rem' }}>{it.label}</span>
            {it.hint && <span className="footnote" style={{ display: 'block' }}>{it.hint}</span>}
          </span>
          <span className="mono" style={{ fontSize: 12, color: it.done ? 'var(--ink-2)' : 'var(--muted)' }}>{it.done ? 'ok' : 'waiting'}</span>
        </li>
      ))}
    </ul>
  );
}
