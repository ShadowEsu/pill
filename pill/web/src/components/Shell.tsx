// Shared chrome. Every screen: <Screen title back eyebrow art tone>…<Action/></Screen>.
// Header: eyebrow with a live dot, a serif title whose words rise in one by one (40 ms apart, like the site),
// an optional art slot on the right and an optional soft colour wash (tone) behind the header.
import { Link, useNavigate } from 'react-router-dom';
import { Fragment, type CSSProperties } from 'react';
import type { Source } from '../lib/types';

export function SrcBadge({ src }: { src: Source | null }) {
  if (!src) return null;
  const text = src === 'real' ? 'LIVE SENSOR' : src === 'replay' ? 'REPLAY' : 'SIMULATED';
  return <span className={'chip ' + (src === 'real' ? 'live' : '')} aria-label={'Data source: ' + text}><span className="dot" />{text}</span>;
}

export type Tone = 'sky' | 'mint' | 'amber' | 'violet' | 'none';

/** Splits a title into words that rise in with a 40 ms stagger (CSS, `.title .tw`). Screen readers get the whole string. */
export function SplitTitle({ text, className = 'screen-title title', as: Tag = 'h1' }: { text: string; className?: string; as?: 'h1' | 'h2' }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span aria-hidden="true" className="tw" style={{ '--w': i } as CSSProperties}>{w}</span></Fragment>)}
    </Tag>
  );
}

export function Screen({ title, back, right, children, eyebrow, art, tone = 'none' }: { title?: string; back?: string | true; right?: React.ReactNode; children: React.ReactNode; eyebrow?: string; art?: React.ReactNode; tone?: Tone }) {
  const nav = useNavigate();
  return (
    <main className={'screen' + (tone !== 'none' ? ' tone-' + tone : '')}>
      {tone !== 'none' && <div className="screen-wash" aria-hidden="true" />}
      <div className="screen-head">
        <div className="row head-main" style={{ gap: 14 }}>
          {back && <button type="button" className="btn ghost back-btn" aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}>←</button>}
          <div className="head-text">
            {eyebrow && <p className="eyebrow"><span className="eb-dot" aria-hidden="true" />{eyebrow}</p>}
            {title && <SplitTitle key={title} text={title} />}
          </div>
        </div>
        {(right || art) && <div className="row head-side">{right}{art && <div className="head-art">{art}</div>}</div>}
      </div>
      {children}
    </main>
  );
}

/** Sticky bottom action area: the one thing to do on this screen. */
export function Action({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="action-bar" style={{ marginTop: 'auto', position: 'sticky', bottom: 0, paddingTop: 12, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
      {note && <p className="footnote" style={{ marginBottom: 10, textAlign: 'center' }}>{note}</p>}
      <div className="stack">{children}</div>
    </div>
  );
}

export function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="btn ghost" style={{ textDecoration: 'none' }}>{children}</Link>;
}
