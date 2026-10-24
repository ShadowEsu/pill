// Empty states: a small line drawing, one sentence, the one thing to do next. Ink lines, colour only in soft fills.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../story.css';

export type EmptyArt = 'box' | 'bottle' | 'clock' | 'grid' | 'feed';

const ART: Record<EmptyArt, ReactNode> = {
  box: (
    <>
      <path d="M30 44 L60 30 L90 44 L60 58 Z" fill="var(--sky-tint)" />
      <path d="M30 44 V80 L60 94 V58 M90 44 V80 L60 94 M30 44 L60 30 L90 44 L60 58 Z" />
      <path d="M45 37 L75 51 V62" stroke="var(--sky-ink)" />
      <rect x="66" y="70" width="16" height="10" rx="2" transform="rotate(-25 74 75)" stroke="var(--ink-2)" />
    </>
  ),
  bottle: (
    <>
      <rect x="44" y="22" width="32" height="12" rx="3" fill="var(--mint-tint)" />
      <path d="M40 40 H80 V90 a6 6 0 0 1 -6 6 H46 a6 6 0 0 1 -6 -6 Z" />
      <rect x="44" y="22" width="32" height="12" rx="3" />
      <rect x="46" y="54" width="28" height="22" rx="3" fill="var(--sky-tint)" />
      <path d="M51 62 H69 M51 68 H63" stroke="var(--ink-2)" />
      <path d="M88 44 l6 -6 M92 54 h8 M88 64 l6 6" stroke="var(--mint-ink)" />
    </>
  ),
  clock: (
    <>
      <circle cx="60" cy="60" r="30" fill="var(--sky-tint)" />
      <circle cx="60" cy="60" r="30" />
      <path d="M60 42 V60 L72 68" stroke="var(--sky-ink)" />
      <path d="M22 98 H98" strokeDasharray="4 5" />
    </>
  ),
  grid: (
    <>
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={`${r}${c}`} x={26 + c * 18} y={36 + r * 18} width="14" height="14" rx="3" fill={r === 1 && c === 2 ? 'var(--mint-tint)' : 'none'} stroke={r === 1 && c === 2 ? 'var(--mint-ink)' : 'var(--line-2)'} />
      )))}
    </>
  ),
  feed: (
    <>
      <circle cx="36" cy="42" r="8" fill="var(--sky-tint)" />
      <path d="M52 40 H92 M52 46 H78" />
      <circle cx="36" cy="72" r="8" fill="var(--mint-tint)" />
      <path d="M52 70 H86 M52 76 H72" stroke="var(--line-2)" />
    </>
  ),
};

export default function EmptyState({ art, children, action }: { art: EmptyArt; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ART[art]}</svg>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** The gear in a screen header's right slot: a 44 px link to /settings. */
export function SettingsLink() {
  return (
    <Link to="/settings" className="gear" aria-label="Settings">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    </Link>
  );
}
