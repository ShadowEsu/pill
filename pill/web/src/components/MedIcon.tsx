// A drug drawn as its pill: a two-tone capsule or a scored round tablet, in the drug's series colour (--c1…--c6).
// Colour lives in the fills only; the outline is ink. Draws its outline in on mount and floats gently (both off under reduced motion).
import { useId } from 'react';

type Shape = 'capsule' | 'tablet';
const KNOWN: Record<string, [number, Shape]> = {
  riboflavin: [1, 'capsule'],
  amoxicillin: [2, 'capsule'],
  'calcium carbonate': [6, 'tablet'],
  acetaminophen: [4, 'tablet'],
  ibuprofen: [5, 'tablet'],
};

function lookup(drug: string): [number, Shape] {
  const key = drug.toLowerCase().trim();
  if (KNOWN[key]) return KNOWN[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [(h % 6) + 1, h % 2 ? 'tablet' : 'capsule'];
}

/** The series colour for a drug, as a CSS var, e.g. `var(--c1)`. */
export const medColor = (drug: string) => `var(--c${lookup(drug)[0]})`;

export default function MedIcon({ drug, size = 44, shape, still = false }: { drug: string; size?: number; shape?: Shape; still?: boolean }) {
  const [n, auto] = lookup(drug);
  const kind = shape ?? auto;
  const c = `var(--c${n})`;
  const clip = 'mi' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span className={'med-icon' + (still ? ' still' : '')} style={{ width: size, height: size, '--mi': c } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size}>
        {kind === 'capsule' ? (
          <g transform="rotate(-35 24 24)">
            <clipPath id={clip}><rect x="6" y="15" width="36" height="18" rx="9" /></clipPath>
            <g clipPath={`url(#${clip})`}>
              <rect x="6" y="15" width="18" height="18" style={{ fill: c }} />
              <rect x="24" y="15" width="18" height="18" style={{ fill: `color-mix(in srgb, ${c} 26%, #fff)` }} />
              <rect x="10" y="18" width="12" height="3" rx="1.5" fill="#fff" opacity=".55" />
            </g>
            <rect className="mi-line" x="6" y="15" width="36" height="18" rx="9" pathLength={1} />
            <path className="mi-line" d="M24 15 V33" pathLength={1} />
          </g>
        ) : (
          <g>
            <ellipse cx="24" cy="27.5" rx="16" ry="6" fill="rgba(22,24,27,.08)" />
            <circle cx="24" cy="23" r="15" style={{ fill: `color-mix(in srgb, ${c} 34%, #fff)` }} />
            <path d="M24 8 A15 15 0 0 1 24 38 Z" style={{ fill: c, opacity: 0.55 }} />
            <circle className="mi-line" cx="24" cy="23" r="15" pathLength={1} />
            <path className="mi-line" d="M14.5 23 H33.5" pathLength={1} />
            <path d="M15 17 A11 11 0 0 1 21 12.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          </g>
        )}
      </svg>
    </span>
  );
}
