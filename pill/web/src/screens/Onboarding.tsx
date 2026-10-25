// One question: who is this for. Sets the mode (and big text for personal) and goes home.
// Hero: the website's navy panel with the binary pill turning in it, the serif wordmark rising letter by letter and the
// tagline typing itself once. Below: two big mode cards with hand-drawn glyphs, the story card, and the way back to the site.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BinaryPill from '../components/BinaryPill';
import SpinPill from '../components/SpinPill';
import Glyph from '../components/Glyph';
import { actions } from '../lib/store';
import { useMediaQuery, useReducedMotion, useViewNavigate } from '../lib/motion';
import type { Mode } from '../lib/types';
import '../story.css';

type GlyphName = React.ComponentProps<typeof Glyph>['name'];
const CHOICES: { mode: Mode; eyebrow: string; title: string; sub: string; glyphs: [GlyphName, GlyphName]; points: string[] }[] = [
  { mode: 'medical', eyebrow: 'Medical', title: 'I’m a hospital, clinic or medical center', sub: 'Check deliveries by lot. The verdict holds the payment.', glyphs: ['clinic', 'pharmacist'], points: ['lots & deliveries', 'escrow · SANDBOX', 'decision log'] },
  { mode: 'personal', eyebrow: 'Personal', title: 'I’m using it for myself or my family', sub: 'One tablet per bottle. Reminders. Big text.', glyphs: ['tablet', 'calendar'], points: ['my bottles', 'reminders', 'big text'] },
];
const WORD = 'Pill';
const TAGLINE = 'The box measures. Pill explains.';
const SITE = 'https://pillmeifyoucan.health';
const CHAR_MS = 40, TYPE_DELAY = 620;

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
  if (reduce) return <p className="onb2-tag">{text}</p>;
  return (
    <p className="onb2-tag" aria-label={text}>
      <span className="ghost" aria-hidden="true">{text}</span>
      <span className="typed" aria-hidden="true">{text.slice(0, n)}<span className={'caret' + (n >= text.length ? ' gone' : '')} /></span>
    </p>
  );
}

export default function Onboarding() {
  const nav = useViewNavigate();
  const wide = useMediaQuery('(min-width: 900px)');
  const [hover, setHover] = useState<Mode | null>(null);
  const choose = (m: Mode) => { actions.setMode(m); nav('/', { replace: true }); };
  return (
    <main className="screen onb onb2" data-hover={hover ?? undefined}>
      <div className="onb-wash sky" aria-hidden="true" />
      <div className="onb-wash mint" aria-hidden="true" />
      <div className="onb2-grid">
        <header className="onb2-hero">
          {/* scale 1.95 keeps the whole capsule inside the frame at every point of its spin and sway */}
          <BinaryPill dark className="onb2-canvas" width={wide ? 560 : 350} height={wide ? 380 : 250} scale={1.95} label="Pill, a turning capsule printed in ones and zeros" />
          <div className="onb2-copy">
            <p className="onb2-eyebrow">Cal Hacks 13.0 · a lab-in-a-box for tablets</p>
            <h1 className="onb2-word" aria-label={WORD}>
              {WORD.split('').map((ch, i) => <span key={i} aria-hidden="true" style={{ '--i': i } as React.CSSProperties}>{ch}</span>)}
            </h1>
            <Typed text={TAGLINE} />
            <p className="onb2-cap">one tablet · one curve · one answer</p>
          </div>
        </header>

        <section className="onb2-side stagger" style={{ '--stagger-start': '260ms' } as React.CSSProperties} aria-label="Who is Pill for">
          <h2 className="onb2-q" style={{ '--i': 0 } as React.CSSProperties}>Who is this for?</h2>
          {CHOICES.map((c, i) => (
            <button key={c.mode} type="button" className={'card onb-card onb2-card ' + c.mode} style={{ '--i': i + 1 } as React.CSSProperties}
              onClick={() => choose(c.mode)}
              onPointerEnter={() => setHover(c.mode)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(c.mode)} onBlur={() => setHover(null)}>
              <span className="onb2-glyphs" aria-hidden="true">
                <Glyph name={c.glyphs[0]} size={wide ? 56 : 48} />
                <Glyph name={c.glyphs[1]} size={wide ? 40 : 34} />
              </span>
              <span className="onb2-text">
                <span className="eyebrow">{c.eyebrow}</span>
                <span className="t">{c.title}</span>
                <span className="s">{c.sub}</span>
                <span className="onb2-points">{c.points.map((p) => <span key={p} className="chip">{p}</span>)}</span>
              </span>
              <span aria-hidden="true" className="onb-arrow">→</span>
            </button>
          ))}

          <Link to="/story" className="card onb2-story" style={{ '--i': 3 } as React.CSSProperties} aria-label="How Pill works: seven short chapters">
            <span className="onb2-story-pill" aria-hidden="true"><SpinPill size={wide ? 84 : 72} /></span>
            <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span className="eyebrow">Story · 7 chapters</span>
              <span className="t">How Pill works</span>
              <span className="s">One whole tablet, two sensors, three words.</span>
            </span>
            <span aria-hidden="true" className="onb-arrow">▶</span>
          </Link>

          <footer className="onb2-foot" style={{ '--i': 4 } as React.CSSProperties}>
            <p className="footnote">You can change this later in settings.</p>
            <div className="onb2-links">
              <Link to="/demo">Watch the 2-minute demo</Link>
              <Link to="/story">How Pill works</Link>
              <Link to="/kiosk">Station screen</Link>
              <a href={SITE} target="_blank" rel="noopener noreferrer">About Pill · the website <span aria-hidden="true">↗</span></a>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
