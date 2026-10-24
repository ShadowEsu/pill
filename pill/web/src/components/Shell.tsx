// Shared chrome. Every screen: <Screen title back>…<Action/></Screen>. Keep it boring; the screens carry the design.
import { Link, useNavigate } from 'react-router-dom';
import type { Source } from '../lib/types';

export function SrcBadge({ src }: { src: Source | null }) {
  if (!src) return null;
  const text = src === 'real' ? 'LIVE SENSOR' : src === 'replay' ? 'REPLAY' : 'SIMULATED';
  return <span className={'chip ' + (src === 'real' ? 'live' : '')} aria-label={'Data source: ' + text}><span className="dot" />{text}</span>;
}

export function Screen({ title, back, right, children, eyebrow }: { title?: string; back?: string | true; right?: React.ReactNode; children: React.ReactNode; eyebrow?: string }) {
  const nav = useNavigate();
  return (
    <main className="screen rise">
      <div className="screen-head">
        <div className="row" style={{ gap: 14 }}>
          {back && <button type="button" className="btn ghost" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 14 }} aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}>←</button>}
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h1 className="screen-title">{title}</h1>}
          </div>
        </div>
        <div className="row">{right}</div>
      </div>
      {children}
    </main>
  );
}

/** Sticky bottom action area: the one thing to do on this screen. */
export function Action({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div style={{ marginTop: 'auto', position: 'sticky', bottom: 0, paddingTop: 12, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
      {note && <p className="footnote" style={{ marginBottom: 10, textAlign: 'center' }}>{note}</p>}
      <div className="stack">{children}</div>
    </div>
  );
}

export function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="btn ghost" style={{ textDecoration: 'none' }}>{children}</Link>;
}
