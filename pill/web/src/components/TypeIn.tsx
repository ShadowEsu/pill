// Text that types itself in, character by character, with a caret while it types. Reduced motion: the whole text at once.
// `onDone` fires once at the end. Re-types when `text` changes.
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../lib/motion';

export function useTyped(text: string, cps = 60, delay = 0, onDone?: () => void): string {
  const reduce = useReducedMotion();
  // progress is stored with the text it belongs to, so a new text starts from nothing without a reset render
  const [typed, setTyped] = useState({ text: '', n: 0 });
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (reduce) { done.current?.(); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const n = Math.max(0, Math.min(text.length, Math.floor(((t - t0) / 1000) * cps)));
      setTyped({ text, n });
      if (n < text.length) raf = requestAnimationFrame(tick);
      else done.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, cps, delay, reduce]);
  if (reduce) return text;
  return typed.text === text ? text.slice(0, typed.n) : '';
}

export default function TypeIn({ text, cps = 60, delay = 0, className, style, onDone }: { text: string; cps?: number; delay?: number; className?: string; style?: React.CSSProperties; onDone?: () => void }) {
  const shown = useTyped(text, cps, delay, onDone);
  const typing = shown.length < text.length;
  return (
    <span className={'cn-typed' + (className ? ' ' + className : '')} style={style} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
      {typing && <span className="caret" aria-hidden="true" />}
    </span>
  );
}

/** A sentence whose words rise in one after another (the site's word-split entrance). Re-runs when the text changes. */
export function Words({ text, step = 55, delay = 0, className, style }: { text: string; step?: number; delay?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span key={text} className={className} style={style} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true"><span className="w" style={{ animationDelay: `${delay + i * step}ms` }}>{w}</span>{' '}</span>
      ))}
    </span>
  );
}
