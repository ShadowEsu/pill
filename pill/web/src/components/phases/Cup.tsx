// The station's chamber, drawn for the phase scenes: the purple printed chamber with a clear cup of clean water inside,
// whose surface moves with PillFill's two-sine math at a low amplitude (no fill colour: it is clean water), the lid with its
// one hole, the stirring stick through that hole (stir: 5 hand circles; otherwise it rests still), and the whole tablet
// above it (held), falling in with ripple rings (falling), or resting on the bottom (in). One rAF loop moves the surface;
// reduced motion paints it once and the CSS animations stay off.
import { useEffect, useId, useRef } from 'react';
import { surface } from '../PillFill';

const LEVEL = 58; // water line in the 140 × 170 box
const GLASS = 'M16 18 L24 150 Q25.5 162 38 162 L102 162 Q114.5 162 116 150 L124 18';
const INNER = 'M18.5 18 L26.3 149 Q27.6 159.6 38.6 159.6 L101.4 159.6 Q112.4 159.6 113.7 149 L121.5 18 Z';

export default function Cup({ size = 180, stir = false, tablet = 'none', ripple = 0, tint = 'rgba(79,179,255,.07)', amp = 1.3, label }: {
  size?: number; /** the stick circles (the hand stir after the drop) */ stir?: boolean; tablet?: 'none' | 'held' | 'falling' | 'in';
  /** bump to ring the water once more */ ripple?: number;
  tint?: string; amp?: number; label: string;
}) {
  const id = 'cup' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const top = useRef<SVGPathElement>(null);
  const body = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);

  useEffect(() => {
    const paint = (ph: number) => {
      const s = surface(LEVEL, amp, ph);
      top.current?.setAttribute('d', s);
      body.current?.setAttribute('d', s + ' L140 170 L0 170 Z');
      back.current?.setAttribute('d', surface(LEVEL - 1.5, amp * 0.8, ph + Math.PI * 0.8));
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(0.6); return; }
    let raf = 0, ph = 0, last = performance.now();
    const loop = (now: number) => {
      ph += ((now - last) / 1000) * (stir ? 2.2 : 1.1);
      last = now;
      paint(ph);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [amp, stir]);

  return (
    <div className={`ph-cup tab-${tablet}${stir ? ' stirring' : ''}`} role="img" aria-label={label} style={{ width: size, height: size * (170 / 140) }}>
      <svg viewBox="0 -34 140 204" aria-hidden="true">
        <defs><clipPath id={id}><path d={INNER} /></clipPath></defs>
        <g clipPath={`url(#${id})`}>
          <path ref={body} fill={tint} />
          <path ref={back} fill="none" stroke="var(--sky)" strokeOpacity=".28" strokeWidth="1" />
          <path ref={top} fill="none" stroke="var(--sky)" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" />
          {/* the stick: through the lid's one hole to near the bottom, once the tablet is in; stirring swings it 5 times */}
          {tablet === 'in' && (
            <g className="ph-stick">
              <line x1="70" y1="-14" x2="70" y2="146" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" opacity=".75" />
            </g>
          )}
          {tablet === 'in' && <rect className="ph-rest" x="44" y="150" width="22" height="8" rx="4" fill="var(--mint-tint)" stroke="var(--ink)" strokeWidth="1.4" />}
          <g className="ph-fizz">
            <circle cx="62" cy="150" r="1.6" fill="var(--sky)" /><circle cx="76" cy="146" r="1.2" fill="var(--sky)" /><circle cx="69" cy="140" r="1" fill="var(--sky)" />
          </g>
        </g>
        <path d={GLASS} fill="none" stroke="var(--violet)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* the lid: one hole in the middle, the stick through it */}
        <path d="M10 10 H63 V18 H10 Z M77 10 H130 V18 H77 Z" fill="var(--violet)" opacity=".85" />
        {tablet === 'in' && <line className="ph-stick ph-stick-top" x1="70" y1="-14" x2="70" y2="20" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" opacity=".75" />}
        <path d="M30 40 L35 140" stroke="#fff" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" />
        <g key={ripple} className="ph-ripples" fill="none" stroke="var(--sky)">
          <ellipse cx="70" cy={LEVEL} rx="12" ry="2.6" strokeWidth="1.4" />
          <ellipse className="r2" cx="70" cy={LEVEL} rx="12" ry="2.6" strokeWidth="1.1" />
          <ellipse className="r3" cx="70" cy={LEVEL} rx="12" ry="2.6" strokeWidth=".8" />
        </g>
        {(tablet === 'held' || tablet === 'falling') && (
          <g className="ph-tab">
            <rect x="55" y="-22" width="30" height="11" rx="5.5" fill="var(--mint-tint)" stroke="var(--ink)" strokeWidth="2" />
            <path d="M70 -20 v7" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
          </g>
        )}
      </svg>
    </div>
  );
}
