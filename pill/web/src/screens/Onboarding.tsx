// One question: who is this for. Sets the mode (and big text for personal) and goes home.
// Hero: the spinning glyph pill; the tagline types itself once; hovering a card washes the page in its colour.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SpinPill from '../components/SpinPill';
import { actions } from '../lib/store';
import { useMediaQuery, useReducedMotion, useViewNavigate } from '../lib/motion';
import type { Mode } from '../lib/types';
import '../story.css';

const CHOICES: { mode: Mode; eyebrow: string; title: string; sub: string }[] = [
  { mode: 'medical', eyebrow: 'Medical', title: 'I’m a hospital, clinic or medical center', sub: 'Check deliveries by lot. The verdict holds the payment.' },
  { mode: 'personal', eyebrow: 'Personal', title: 'I’m using it for myself or my family', sub: 'One tablet per bottle. Reminders. Big text.' },
];
const TAGLINE = 'The box measures. Pill explains.';
const CHAR_MS = 40, TYPE_DELAY = 420;

/** The tagline, typed once at 40 ms a character after a short beat; static under reduced motion. */
function Typed({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let i = 0, id = 0;
    const tick = () => { i++; setN(i); if (i < text.length) id = window.setTimeout(tick, CHAR_MS); };
    id = window.setTimeout(tick, TYPE_DELAY);
    return () => clearTimeout(id);
  }, [text, reduce]);
  if (reduce) return <p className="onb-tag">{text}</p>;
  return (
    <p className="onb-tag" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      <span aria-hidden="true" className={'caret' + (n >= text.length ? ' gone' : '')} />
    </p>
  );
}

export default function Onboarding() {
  const nav = useViewNavigate();
  const wide = useMediaQuery('(min-width: 900px)');
  const [hover, setHover] = useState<Mode | null>(null);
  const choose = (m: Mode) => { actions.setMode(m); nav('/', { replace: true }); };
  return (
    <main className="screen onb" data-hover={hover ?? undefined}>
      <div className="onb-wash sky" aria-hidden="true" />
      <div className="onb-wash mint" aria-hidden="true" />
      <div className="onb-grid">
        <header className="onb-hero">
          <SpinPill glyphs size={wide ? 320 : 240} label="Pill, a spinning capsule drawn in ones and zeros" />
          <p className="serif onb-word">Pill</p>
          <Typed text={TAGLINE} />
        </header>
        <section className="onb-cards stagger" style={{ '--stagger-start': '180ms' } as React.CSSProperties} aria-label="Who is Pill for">
          <h1 className="eyebrow" style={{ fontWeight: 400, '--i': 0 } as React.CSSProperties}>Who is this for?</h1>
          {CHOICES.map((c, i) => (
            <button key={c.mode} type="button" className={'card onb-card ' + c.mode} style={{ '--i': i + 1 } as React.CSSProperties}
              onClick={() => choose(c.mode)}
              onPointerEnter={() => setHover(c.mode)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(c.mode)} onBlur={() => setHover(null)}>
              <span style={{ display: 'grid', gap: 6 }}>
                <span className="eyebrow">{c.eyebrow}</span>
                <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{c.title}</span>
                <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{c.sub}</span>
              </span>
              <span aria-hidden="true" className="onb-arrow">→</span>
            </button>
          ))}
          <div style={{ display: 'grid', justifyItems: 'center', marginTop: 8, '--i': 3 } as React.CSSProperties}>
            <Link to="/story" className="onb-story" aria-label="How Pill works: seven short chapters">
              <span className="play" aria-hidden="true">▶</span>
              <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                <span>How Pill works</span>
                <span className="sub">one quarter tablet · seven short chapters</span>
              </span>
            </Link>
          </div>
          <footer style={{ display: 'grid', gap: 6, justifyItems: 'center', marginTop: 4, '--i': 4 } as React.CSSProperties}>
            <p className="footnote">You can change this later in settings.</p>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/demo" className="mono" style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 12px' }}>Watch the 2-minute demo</Link>
              <Link to="/story" className="mono" style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 12px' }}>How Pill works</Link>
              <Link to="/kiosk" className="mono" style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 12px' }}>Station screen</Link>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
