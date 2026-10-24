// A three-step rail (logged → tested → decision): each segment fills with its colour once reached, one after another.
// Words stay ink; colour lives in the segment fills and the dots. The current step's dot breathes. Reduced motion: filled at once.
export interface RailStep { label: string; done: boolean; color: string; sub?: string }

export default function StatusRail({ steps, label, delay = 0 }: { steps: RailStep[]; label: string; delay?: number }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="srail" aria-label={label} style={{ '--srail-delay': `${delay}ms` } as React.CSSProperties}>
      {steps.map((s, i) => (
        <li key={s.label} className={'srail-step' + (s.done ? ' done' : '') + (i === current ? ' now' : '')} style={{ '--sc': s.color, '--k': i } as React.CSSProperties}
          aria-label={`${s.label}: ${s.done ? s.sub ?? 'done' : 'not yet'}`}>
          <span className="srail-track" aria-hidden="true"><span className="srail-fill" /></span>
          <span className="srail-dot" aria-hidden="true" />
          <span className="srail-lbl">{s.label}</span>
          {s.sub && <span className="srail-sub">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
}
