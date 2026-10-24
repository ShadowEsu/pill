// Number count-up. Eased (the one app easing), counts from 0 on mount and from the shown value on change.
// prefers-reduced-motion: returns the target straight away.
import { useEffect, useRef, useState } from 'react';
import { EASE, useReducedMotion } from './motion';

export function useCountUp(target: number, ms = 900, from = 0): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? target : from);
  const cur = useRef(shown);
  useEffect(() => {
    if (reduce || ms <= 0 || !Number.isFinite(target)) { cur.current = target; const id = requestAnimationFrame(() => setShown(target)); return () => cancelAnimationFrame(id); }
    const start = cur.current, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      cur.current = start + (target - start) * EASE(p);
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return shown;
}
