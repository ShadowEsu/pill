// The guided demo's caption bar: a serif sentence per step whose words rise in, a mono step counter, a progress ring for the
// step, and pause / next / exit. Fixed to the bottom of the screen column (above the phone tab bar). `moment` washes the
// bar amber (step 3: the glow stays flat). Static under reduced motion.
import { useReducedMotion } from '../lib/motion';
import { Words } from './TypeIn';
import './cinema.css';

export default function Caption({ step, total, label, text, progress, paused, note, canNext, moment = false, onPause, onNext, onExit }: {
  step: number; total: number; label: string; text: string;
  /** 0–1 through the current step */ progress: number;
  paused: boolean; note?: string | null; canNext: boolean;
  /** the run's flat-glow moment: the bar washes amber */ moment?: boolean;
  onPause: () => void; onNext: () => void; onExit: () => void;
}) {
  const reduce = useReducedMotion();
  const pad = (n: number) => String(n).padStart(2, '0');
  const p = Math.max(0, Math.min(1, progress));
  return (
    <aside className="demo-caption" role="region" aria-label="Guided demo" data-demo-step={step} data-moment={moment || undefined}>
      <style>{`
        .demo-caption { position: fixed; z-index: 40; left: 0; right: 0; bottom: calc(62px + env(safe-area-inset-bottom)); padding: 0 10px 8px; pointer-events: none; }
        .demo-caption .box { pointer-events: auto; max-width: 860px; margin: 0 auto; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--line-2); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; transition: background .8s var(--ease), border-color .8s var(--ease); }
        .demo-caption .body { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 12px; padding: 10px 12px 12px 12px; align-items: center; }
        .demo-caption .say { font-family: var(--serif); font-size: clamp(1.08rem, 3.6vw, 1.45rem); line-height: 1.2; color: var(--ink); grid-column: 1 / -1; }
        .demo-caption .ctl { display: flex; gap: 6px; }
        .demo-caption .ctl button { min-height: 40px; min-width: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font: 500 13px var(--sans); cursor: pointer; transition: transform .2s var(--ease); }
        .demo-caption .ctl button:active { transform: scale(.95); }
        .demo-caption .ctl button:disabled { opacity: .45; cursor: default; }
        @media (min-width: 900px) { .demo-caption { left: 232px; bottom: 0; padding: 0 24px 18px; } }
        .app { padding-bottom: 190px; }
        @media (max-width: 899px) { .app .screen .action-bar { bottom: 196px; } }
      `}</style>
      <div className={'box' + (moment ? ' moment' : '')}>
        <div className="body">
          <svg className="cn-cap-ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="16" fill="none" stroke="var(--sky-tint)" strokeWidth="3.5" />
            <circle className="p" cx="20" cy="20" r="16" fill="none" stroke="var(--sky)" strokeWidth="3.5" strokeLinecap="round" pathLength={1} strokeDashoffset={1 - p} transform="rotate(-90 20 20)" />
            <text x="20" y="24" textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--ink)' }}>{pad(step)}</text>
          </svg>
          <p className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--ink)' }}>{pad(step)} / {pad(total)}</span> · {label}{paused ? ' · paused' : ''}{note ? ` · ${note}` : ''}
          </p>
          <div className="ctl">
            <button type="button" onClick={onPause} aria-pressed={paused} aria-label={paused ? 'Play the demo' : 'Pause the demo'}>{paused ? '▶' : '❚❚'}</button>
            <button type="button" onClick={onNext} disabled={!canNext} aria-label="Next step">Next</button>
            <button type="button" onClick={onExit} aria-label="Exit the demo">Exit</button>
          </div>
          <p className="say" aria-live="polite">{reduce ? text : <Words text={text} step={28} />}</p>
        </div>
      </div>
    </aside>
  );
}
