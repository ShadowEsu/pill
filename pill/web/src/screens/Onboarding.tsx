// One question: who is this for. Sets the mode (and big text for personal) and goes home.
import { Link, useNavigate } from 'react-router-dom';
import { actions } from '../lib/store';
import type { Mode } from '../lib/types';

const CHOICES: { mode: Mode; eyebrow: string; title: string; sub: string }[] = [
  { mode: 'medical', eyebrow: 'Medical', title: 'I’m a hospital, clinic or medical center', sub: 'Check deliveries by lot. The verdict holds the payment.' },
  { mode: 'personal', eyebrow: 'Personal', title: 'I’m using it for myself or my family', sub: 'One tablet per bottle. Reminders. Big text.' },
];

export default function Onboarding() {
  const nav = useNavigate();
  const choose = (m: Mode) => { actions.setMode(m); nav('/', { replace: true }); };
  return (
    <main className="screen" style={{ justifyContent: 'center', gap: 28 }}>
      <header className="rise" style={{ display: 'grid', gap: 8 }}>
        <p className="serif" style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-0.01em' }}>Pill</p>
        <p style={{ fontSize: 19, color: 'var(--ink-2)' }}>The box measures. Pill explains.</p>
      </header>
      <section className="stack" style={{ gap: 12 }} aria-label="Who is Pill for">
        <h1 className="eyebrow rise" style={{ fontWeight: 400, animationDelay: '40ms' }}>Who is this for?</h1>
        {CHOICES.map((c, i) => (
          <button key={c.mode} type="button" className="card rise" onClick={() => choose(c.mode)}
            style={{ animationDelay: `${120 + i * 80}ms`, minHeight: 120, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'grid', gap: 6 }}>
              <span className="eyebrow">{c.eyebrow}</span>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{c.title}</span>
              <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{c.sub}</span>
            </span>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>→</span>
          </button>
        ))}
      </section>
      <footer className="rise" style={{ display: 'grid', gap: 10, justifyItems: 'center', animationDelay: '300ms' }}>
        <p className="footnote">You can change this later in settings.</p>
        <Link to="/kiosk" className="mono" style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 12px' }}>Station screen</Link>
      </footer>
    </main>
  );
}
