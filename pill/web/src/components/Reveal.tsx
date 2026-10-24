// Fade-and-rise once, the first time the element scrolls into view. Reduced motion (or no IntersectionObserver): shown as is.
import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface RevealProps { children: ReactNode; delay?: number; y?: number; as?: keyof React.JSX.IntrinsicElements; className?: string; style?: CSSProperties }

export default function Reveal({ children, delay = 0, y = 10, as = 'div', className, style }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<'wait' | 'in' | 'still'>(() => (typeof IntersectionObserver === 'undefined' || prefersReducedMotion() ? 'still' : 'wait'));

  useEffect(() => {
    const el = ref.current;
    if (state !== 'wait' || !el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('in'); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [state]);

  const cls = [state === 'wait' ? 'reveal-wait' : state === 'in' ? 'reveal-in' : '', className].filter(Boolean).join(' ');
  return createElement(as, { ref, className: cls || undefined, style: { ...style, '--reveal-y': `${y}px`, animationDelay: delay ? `${delay}ms` : undefined } as CSSProperties }, children);
}
