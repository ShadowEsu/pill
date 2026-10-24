// How Pill works (/story): seven chapters, one per screen. Phone: the illustration over the words, swipe or tap the arrows.
// Desktop: words left, illustration right; ← → / PageUp PageDown / Space / Home End. Each chapter's words stagger in on
// every visit; its illustration plays its intro only the first time. Reduced motion draws every end state at once.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { animate, stagger } from 'animejs';
import SpinPill from '../components/SpinPill';
import PillFill, { VERDICT_FILL } from '../components/PillFill';
import Curve from '../components/Curve';
import SensorPath, { GLOW_FULL } from '../components/SensorPath';
import FlowArrows from '../components/FlowArrows';
import Timetable, { type TItem } from '../components/Timetable';
import Sparkline from '../components/Sparkline';
import VerdictChip from '../components/VerdictChip';
import ReadAloud from '../components/ReadAloud';
import { useStore } from '../lib/store';
import { EASE, useMediaQuery, useReducedMotion } from '../lib/motion';
import { absorbance, curve, evaluate } from '../lib/rules';
import { playSound, verdictSound } from '../lib/sound';
import { atClock, useNow } from '../lib/when';
import { REFERENCES, REPLAYS } from '../data/reference';
import '../components/viz.css';
import '../story.css';

const REF = REFERENCES.riboflavin;
const WHO_2017 = 'https://www.who.int/news/item/28-11-2017-1-in-10-medical-products-in-developing-countries-is-substandard-or-falsified';

interface ArtProps { play: boolean; wide: boolean; text: string }

/* ---------- 1 · one in ten: ten tablets land; one of them is not what its label says ---------- */
function OneInTen({ play }: ArtProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [lit, setLit] = useState(!play);
  useLayoutEffect(() => {
    const caps = svg.current?.querySelectorAll<SVGGElement>('.cap-g');
    if (!play || !caps) return;
    caps.forEach((c) => { c.style.opacity = '0'; });
    const a = animate(caps, { opacity: [0, 1], translateY: [-22, 0], duration: 480, delay: stagger(70, { start: 250 }), ease: EASE });
    const t = window.setTimeout(() => setLit(true), 250 + 70 * 10 + 500);
    return () => { a.cancel(); clearTimeout(t); };
  }, [play]);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 16, width: '100%' }}>
      <svg ref={svg} className="one-in-ten" viewBox="0 0 400 210" role="img" aria-label="Ten tablets; one of them is marked with a question">
        {Array.from({ length: 10 }, (_, k) => {
          const odd = k === 7 && lit;
          const x = 40 + (k % 5) * 80, y = 62 + Math.floor(k / 5) * 96;
          return (
            <g key={k} className="cap-g">
              <g transform={`translate(${x} ${y}) rotate(-28)`}>
                <path className="cap" d="M0 -13 H-15 A13 13 0 0 0 -15 13 H0 Z" fill={odd ? 'var(--amber-tint)' : 'rgba(79,179,255,.22)'} stroke={odd ? 'var(--amber)' : 'var(--ink)'} strokeWidth="1.5" strokeDasharray={odd ? '3 3' : undefined} />
                <path className="cap" d="M0 -13 H15 A13 13 0 0 1 15 13 H0 Z" fill={odd ? 'var(--amber-tint)' : 'rgba(95,211,154,.26)'} stroke={odd ? 'var(--amber)' : 'var(--ink)'} strokeWidth="1.5" strokeDasharray={odd ? '3 3' : undefined} />
                <path d="M-18 -6 A8 8 0 0 1 -10 -10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
              </g>
              {odd && <text x={x} y={y - 26} textAnchor="middle" className="pop-in" style={{ fontFamily: 'var(--serif)', fontSize: 26, fill: 'var(--ink)' }}>?</text>}
            </g>
          );
        })}
      </svg>
      <p className="mono muted" style={{ fontSize: 12.5, textAlign: 'center' }}>Same box, same label, same lot number.</p>
    </div>
  );
}

/* ---------- 2 · dissolving: the capsule fills over about three seconds ---------- */
function Dissolve({ play, wide }: ArtProps) {
  const [pct, setPct] = useState(play ? 0 : 100);
  useEffect(() => {
    if (!play) return;
    let v = 0;
    const id = window.setInterval(() => { v = Math.min(100, v + 3); setPct(v); if (v >= 100) clearInterval(id); }, 90);
    return () => clearInterval(id);
  }, [play]);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 12 }}>
      <PillFill pct={pct} size={wide ? 340 : 220} />
      <p className="mono muted" style={{ fontSize: 12.5 }}>¼ tablet · water · 3:00 stirring</p>
    </div>
  );
}

/* ---------- 3 · two sensors: the B2-07 replay plays through the light path and the curve ---------- */
const B2 = REPLAYS['B2-07'].samples;
function Sensors({ play, wide }: ArtProps) {
  const [n, setN] = useState(play ? 2 : B2.length);
  useEffect(() => {
    if (!play) return;
    let k = 2;
    const id = window.setInterval(() => { k = Math.min(B2.length, k + 3); setN(k); if (k >= B2.length) clearInterval(id); }, 50);
    return () => clearInterval(id);
  }, [play]);
  const s = B2.slice(0, n);
  const last = s[s.length - 1];
  return (
    <div style={{ width: '100%', maxWidth: wide ? 460 : 340, display: 'grid', gap: 12 }}>
      <div style={{ maxWidth: wide ? 420 : 280, width: '100%', margin: '0 auto' }}>
        <SensorPath led inline={last.adc0 / last.blank} glow={absorbance(last.blank, last.adc90) / GLOW_FULL} running />
      </div>
      <Curve samples={s} band={REF} width={420} height={wide ? 200 : 150} live={n < B2.length} />
    </div>
  );
}

/* ---------- 4 · three words: three real replays through the same seven rules ---------- */
const VERDICT_ROWS = [
  { key: 'B2-07', why: 'in the band, and the glow rose with it' },
  { key: 'TM-02', why: 'chalk: clouded the water, never glowed' },
  { key: 'B2-LID', why: 'the lid was opened at 0:41' },
].map((r) => {
  const samples = REPLAYS[r.key].samples;
  return { ...r, ev: evaluate(samples, REF), pts: curve(samples).filter((_, j) => j % 6 === 0).map((p) => p.a) };
});
const TINT = { PASS: 'var(--mint-tint)', 'NEEDS LAB': 'var(--amber-tint)', 'UNABLE TO VERIFY': 'var(--grey-tint)' } as const;

function ThreeWords({ play }: ArtProps) {
  const [on, setOn] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const cycle = useCallback((withSound: boolean) => {
    timers.current.forEach(clearTimeout);
    timers.current = [...VERDICT_ROWS.map((r, k) => window.setTimeout(() => { setOn(k); if (withSound) playSound(verdictSound(r.ev.verdict)); }, 700 + k * 1100)),
      window.setTimeout(() => setOn(null), 700 + VERDICT_ROWS.length * 1100 + 400)];
  }, []);
  useEffect(() => {
    if (play) cycle(true);
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, [play, cycle]);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 16, width: '100%' }}>
      <ul className="verdict-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {VERDICT_ROWS.map((r, k) => (
          <li key={r.key} className={'verdict-row' + (on === k ? ' on' : '')} style={{ '--row-c': VERDICT_FILL[r.ev.verdict], '--row-tint': TINT[r.ev.verdict] } as React.CSSProperties}>
            <span className="w">{r.ev.verdict}</span>
            <Sparkline values={r.pts} width={72} height={28} color="var(--sky)" domain={[0, 0.6]} band={[REF.bandLow, REF.bandHigh]} label={`Inline curve for replay ${r.key}`} />
            <span className="bar" />
            <span className="why">rule {r.ev.rule} · {r.why}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost" style={{ width: 'auto', minHeight: 44, fontSize: 15 }} onClick={() => cycle(true)}>Hear the three words</button>
    </div>
  );
}

/* ---------- 5 · the payment: clinic → escrow → supplier, released only by a tap ---------- */
const MONEY = [
  { label: 'Clinic', sub: 'pays in', accent: 'var(--c1)' },
  { label: 'Escrow', sub: 'USDC · TESTNET', accent: 'var(--amber)' },
  { label: 'Supplier', sub: 'paid on a tap', accent: 'var(--cb)' },
];

/** Phone-width money path: three nodes on one line, the dashes marching toward the supplier. */
function MoneyStrip() {
  return (
    <div className="money-strip" role="img" aria-label="Money path: clinic pays into escrow; escrow pays the supplier on a tap">
      {MONEY.map((n, k) => (
        <Fragment key={n.label}>
          {k > 0 && <svg className="ms-arrow" viewBox="0 0 28 12" aria-hidden="true"><path className="shaft" d="M0 6 H19" /><path d="M18 1 L28 6 L18 11 Z" fill="var(--cb)" /><circle className="ms-token" cx="0" cy="6" r="3" style={{ '--k': k } as React.CSSProperties} /></svg>}
          <span className="ms-node" style={{ '--accent': n.accent } as React.CSSProperties}><b>{n.label}</b><span>{n.sub}</span></span>
        </Fragment>
      ))}
    </div>
  );
}

function Payment({ play, wide }: ArtProps) {
  return (
    <div className={'stack' + (play ? ' stagger' : '')} style={{ gap: 16, width: '100%', maxWidth: 480 }}>
      <div style={{ '--i': 0 } as React.CSSProperties}>
        {wide ? (
          <FlowArrows label="Money path: clinic to escrow to supplier" token
            nodes={MONEY.map((n) => ({ id: n.label, ...n }))}
            edges={[{ from: 'Clinic', to: 'Escrow', label: 'held', live: true, color: 'var(--cb)' }, { from: 'Escrow', to: 'Supplier', label: 'tap', live: true, color: 'var(--cb)' }]} />
        ) : <MoneyStrip />}
      </div>
      <ul className="policy-lines" style={{ listStyle: 'none', margin: 0, padding: 0, '--i': 1 } as React.CSSProperties}>
        <li><VerdictChip verdict="PASS" /><span>release proposed; a pharmacist taps</span></li>
        <li><VerdictChip verdict="NEEDS LAB" /><span><b>HOLD</b> · lab referral drafted</span></li>
        <li><VerdictChip verdict="UNABLE TO VERIFY" /><span><b>ESCALATE</b> · a person decides</span></li>
      </ul>
      <div className="row tap-row" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap', '--i': 2 } as React.CSSProperties}>
        <span className="tap-mock" aria-hidden="true"><span>Release</span><span className="mono" style={{ fontSize: 11, opacity: .7 }}>TESTNET</span></span>
        <span className="mono muted" style={{ fontSize: 12 }}>only a person can do this</span>
      </div>
    </div>
  );
}

/* ---------- 6 · grandparents: big words, a reminder, read aloud ---------- */
function AtHome({ text, wide }: ArtProps) {
  const now = useNow();
  const items: TItem[] = [
    { at: atClock('08:00', now), dur: 10, label: '08:00', sub: 'taken', kind: 'dose', lane: 0 },
    { at: atClock('20:00', now), dur: 10, label: '20:00', sub: 'reminder', kind: 'planned', lane: 0 },
  ];
  return (
    <div className="stack" style={{ gap: 12, width: '100%', maxWidth: 420 }}>
      <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--sky)', boxShadow: 'none', display: 'grid', gap: 4 }}>
        <span className="eyebrow">next up</span>
        <span style={{ fontSize: wide ? '2rem' : '1.6rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Riboflavin <span className="mono" style={{ fontWeight: 400 }}>20:00</span></span>
        <span style={{ color: 'var(--ink-2)' }}>A vitamin. Tested: <b>{VERDICT_ROWS[0].ev.verdict}</b>, {VERDICT_ROWS[0].ev.pct} % of reference.</span>
      </div>
      <div className="card" style={{ padding: '12px 14px', boxShadow: 'none' }}>
        <Timetable label="Today's doses" items={items} start={6} end={22} nowLine horizontal rowPx={28} minSpan={3} now={now} />
      </div>
      <div style={{ display: 'grid', justifyItems: 'center' }}><ReadAloud text={text} label="Read this aloud" size={56} /></div>
    </div>
  );
}

/* ---------- 7 · what it is not ---------- */
function Limits({ wide }: ArtProps) {
  return (
    <div className="isnot">
      <div style={{ display: 'grid', placeItems: 'center' }}><SpinPill glyphs size={wide ? 200 : 96} label="Pill, drawn in ones and zeros" /></div>
      <div className="isnot-cols">
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Pill is</span>
          <ul>
            <li><span>+</span><span>a first look at a lot, in three minutes</span></li>
            <li><span>+</span><span>a record of every run and every decision</span></li>
            <li><span>+</span><span>a reason to send a lot to a lab</span></li>
          </ul>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Pill is not</span>
          <ul>
            <li><span>−</span><span>a pharmacopeial test</span></li>
            <li><span>−</span><span>a lab, or a diagnosis</span></li>
            <li><span>−</span><span>a judge of drugs it has no reference for</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface Chapter { name: string; line: string; body: string; src?: ReactNode; Art: ComponentType<ArtProps>; dots?: boolean }
const CHAPTERS: Chapter[] = [
  { name: 'One in ten', line: '1 in 10 medical products in low- and middle-income countries is substandard or falsified.',
    body: 'Most of them look like the right tablet. The pharmacist who signs for a box has a label, a lot number and a delivery note, and no way to see inside.',
    src: <>Source: <a href={WHO_2017} target="_blank" rel="noopener noreferrer">WHO, 2017</a></>, Art: OneInTen, dots: true },
  { name: 'Dissolve', line: 'A tablet cannot lie about dissolving.',
    body: 'Drop a quarter tablet into water and stir for three minutes. The right dose of the right medicine colours the water by a known amount, at a known pace. Too little, too slow or nothing at all, and the curve shows it.', Art: Dissolve },
  { name: 'Two sensors', line: 'Two sensors, one answer.',
    body: 'A blue light shines straight through the cup, and the inline sensor reads how much it dims: the absorbance. A second sensor at 90° watches for riboflavin’s green glow. Chalk can cloud the water enough to dim the beam. It cannot glow.', Art: Sensors, dots: true },
  { name: 'Three words', line: 'Three words, never a guess.',
    body: 'PASS when the plateau lands in the reference band and the glow rises with it. NEEDS LAB when the run was clean but the curve is wrong. UNABLE TO VERIFY when the run cannot be trusted, or there is no reference. Seven fixed rules choose the word; Claude only explains it.', Art: ThreeWords },
  { name: 'The payment', line: 'The verdict holds the payment.',
    body: 'In a clinic, each delivery’s payment waits in escrow. A PASS lets the policy agent propose a release, and a pharmacist still taps to send it. NEEDS LAB holds the money; UNABLE TO VERIFY asks a person. The model can only make a decision more careful, never release money.',
    src: <>USDC on Base Sepolia (TESTNET), mirrored in the Capital One Nessie SANDBOX.</>, Art: Payment, dots: true },
  { name: 'At home', line: 'For grandparents too.',
    body: 'Personal mode is the same station in bigger words. Photograph a label, test one tablet per bottle, get a reminder in your calendar when a dose is due, and have the words read aloud.', Art: AtHome },
  { name: 'Honest limits', line: 'What it is not.',
    body: 'Pill is a screening step, not a pharmacopeial test. Today it carries one reference drug, riboflavin; anything without a reference band comes back UNABLE TO VERIFY. Its job is to say which lots should go to a lab, and to keep a record of why.', Art: Limits, dots: true },
];
const N = CHAPTERS.length;
const pad = (k: number) => String(k).padStart(2, '0');

function ChapterView({ idx, dir, seen, wide }: { idx: number; dir: number; seen: Set<number>; wide: boolean }) {
  const reduce = useReducedMotion();
  const [play] = useState(() => !reduce && !seen.has(idx));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { seen.add(idx); }, [seen, idx]);
  useLayoutEffect(() => {
    const els = ref.current?.querySelectorAll<HTMLElement>('[data-enter]');
    if (reduce || !els?.length) return;
    els.forEach((e) => { e.style.opacity = '0'; });
    const a = animate(els, { opacity: [0, 1], translateX: [dir * 28, 0], duration: 520, delay: stagger(80), ease: EASE });
    return () => { a.cancel(); };
  }, [dir, reduce]);
  const c = CHAPTERS[idx];
  const { Art } = c;
  return (
    <article ref={ref} className="story-ch" role="group" aria-roledescription="chapter" aria-label={`${idx + 1} of ${N}: ${c.name}`}>
      <div className={'story-art' + (c.dots ? ' dots' : '')} data-enter>
        <div className="story-par"><Art play={play} wide={wide} text={`${c.line} ${c.body}`} /></div>
      </div>
      <div className="story-copy">
        <span className="story-ghost" aria-hidden="true">{pad(idx + 1)}</span>
        <p className="story-num" data-enter><b>{pad(idx + 1)}</b> / {pad(N)} · {c.name}</p>
        <h2 className="story-line" data-enter>{c.line}</h2>
        <p className="story-body" data-enter>{c.body}</p>
        {c.src && <p className="story-src" data-enter>{c.src}</p>}
      </div>
    </article>
  );
}

export default function Story() {
  const [q, setQ] = useSearchParams();
  const nav = useNavigate();
  const mode = useStore((s) => s.mode);
  const wide = useMediaQuery('(min-width: 900px)');
  const i = Math.max(0, Math.min(N - 1, (Number(q.get('c')) || 1) - 1));
  const [dir, setDir] = useState(1);
  const [seen] = useState(() => new Set<number>());
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const stage = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  /** Parallax: the art leans toward the pointer (mouse) or follows a swipe (touch); the ghosted number drifts the other way. */
  const lean = (px: number, py: number, drag: number) => {
    const el = stage.current;
    if (!el || reduce) return;
    el.style.setProperty('--px', px.toFixed(3));
    el.style.setProperty('--py', py.toFixed(3));
    el.style.setProperty('--drag', `${Math.round(drag)}px`);
  };
  // On a phone the chapter can scroll under the controls: the art slides a little slower than the words.
  useEffect(() => {
    const el = stage.current;
    if (!el || reduce) return;
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--sy', String(Math.round(window.scrollY))); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [reduce]);
  const last = i === N - 1;

  const go = useCallback((k: number) => {
    const n = Math.max(0, Math.min(N - 1, k));
    if (n === i) return;
    setDir(n > i ? 1 : -1);
    playSound('tap');
    setQ({ c: String(n + 1) }, { replace: true });
  }, [i, setQ]);
  const start = useCallback(() => { playSound('rise'); nav(mode ? '/bottle' : '/welcome'); }, [mode, nav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select')) return;
      const onControl = !!el?.closest('button, a');
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(N - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i]);

  return (
    <main className="screen story">
      <header className="story-head">
        <p className="eyebrow">How Pill works</p>
        <Link to={mode ? '/' : '/welcome'}>Close ✕</Link>
      </header>
      <section ref={stage} className="story-stage" aria-roledescription="story" aria-label="How Pill works, seven chapters" aria-live="polite"
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          const s = swipe.current;
          if (s && e.pointerType !== 'mouse') { lean(0, 0, (e.clientX - s.x) * 0.35); return; }
          const r = e.currentTarget.getBoundingClientRect();
          lean(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1, 0);
        }}
        onPointerLeave={() => lean(0, 0, 0)}
        onPointerCancel={() => { swipe.current = null; lean(0, 0, 0); }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          lean(0, 0, 0);
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(i + (dx < 0 ? 1 : -1));
        }}>
        <ChapterView key={i} idx={i} dir={dir} seen={seen} wide={wide} />
      </section>
      <nav className="story-foot" aria-label="Chapters">
        <button type="button" className="btn ghost" aria-label="Previous chapter" disabled={i === 0} onClick={() => go(i - 1)}>←</button>
        <div className="story-dots">
          {CHAPTERS.map((c, k) => (
            <button key={c.name} type="button" className={'story-dot' + (seen.has(k) ? ' seen' : '')} aria-label={`Chapter ${k + 1}: ${c.name}`} aria-current={k === i ? 'step' : undefined} onClick={() => go(k)}><i /></button>
          ))}
        </div>
        {last
          ? <button type="button" className="btn" onClick={start}>Start</button>
          : <button type="button" className="btn" aria-label="Next chapter" onClick={() => go(i + 1)}>→</button>}
      </nav>
    </main>
  );
}
