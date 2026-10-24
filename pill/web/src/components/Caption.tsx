// The guided demo's caption bar: a serif sentence per step, a mono step counter, the step's progress, and
// pause / next / exit. Fixed to the bottom of the screen column (above the phone tab bar). Static under reduced motion.
import { useReducedMotion } from '../lib/motion';

export default function Caption({ step, total, label, text, progress, paused, note, canNext, onPause, onNext, onExit }: {
  step: number; total: number; label: string; text: string;
  /** 0–1 through the current step */ progress: number;
  paused: boolean; note?: string | null; canNext: boolean;
  onPause: () => void; onNext: () => void; onExit: () => void;
}) {
  const reduce = useReducedMotion();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <aside className="demo-caption" role="region" aria-label="Guided demo" data-demo-step={step}>
      <style>{`
        .demo-caption { position: fixed; z-index: 40; left: 0; right: 0; bottom: calc(62px + env(safe-area-inset-bottom)); padding: 0 10px 8px; pointer-events: none; }
        .demo-caption .box { pointer-events: auto; max-width: 860px; margin: 0 auto; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--line-2); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
        .demo-caption .bar { height: 3px; background: var(--sky-tint); }
        .demo-caption .bar i { display: block; height: 100%; background: var(--sky); transition: width .25s linear; }
        .demo-caption .body { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding: 10px 12px 12px 16px; align-items: center; }
        .demo-caption .say { font-family: var(--serif); font-size: clamp(1.08rem, 3.6vw, 1.45rem); line-height: 1.2; color: var(--ink); grid-column: 1 / -1; }
        .demo-caption .ctl { display: flex; gap: 6px; }
        .demo-caption .ctl button { min-height: 40px; min-width: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font: 500 13px var(--sans); cursor: pointer; }
        .demo-caption .ctl button:disabled { opacity: .45; cursor: default; }
        .demo-caption .say.swap { animation: demo-say .45s var(--ease) both; }
        @keyframes demo-say { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (min-width: 900px) { .demo-caption { left: 232px; bottom: 0; padding: 0 24px 18px; } }
        @media (prefers-reduced-motion: reduce) { .demo-caption .say.swap { animation: none; } .demo-caption .bar i { transition: none; } }
        .app { padding-bottom: 190px; }
        @media (max-width: 899px) { .app .screen .action-bar { bottom: 196px; } }
      `}</style>
      <div className="box">
        <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} /></div>
        <div className="body">
          <p className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--ink)' }}>{pad(step)} / {pad(total)}</span> · {label}{paused ? ' · paused' : ''}{note ? ` · ${note}` : ''}
          </p>
          <div className="ctl">
            <button type="button" onClick={onPause} aria-pressed={paused} aria-label={paused ? 'Play the demo' : 'Pause the demo'}>{paused ? '▶' : '❚❚'}</button>
            <button type="button" onClick={onNext} disabled={!canNext} aria-label="Next step">Next</button>
            <button type="button" onClick={onExit} aria-label="Exit the demo">Exit</button>
          </div>
          <p key={text} className={'say' + (reduce ? '' : ' swap')} aria-live="polite">{text}</p>
        </div>
      </div>
    </aside>
  );
}
