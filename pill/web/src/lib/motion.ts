// Motion helpers. One easing (cubic-bezier(.2,.7,.2,1)), ≤ 600 ms except idle loops, nothing bounces.
// Every helper honours prefers-reduced-motion by jumping to the end state.
import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { animate, cubicBezier, stagger, type JSAnimation } from 'animejs';

export const EASE = cubicBezier(0.2, 0.7, 0.2, 1);
export const EASE_CSS = 'cubic-bezier(.2,.7,.2,1)';
const REDUCE_Q = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia(REDUCE_Q).matches;

/** Live media-query match. */
export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery(REDUCE_Q);

type Targets = string | Element | Element[] | NodeListOf<Element>;
export interface StaggerOpts { root?: ParentNode; y?: number; x?: number; step?: number; delay?: number; duration?: number }

/** Fades and lifts each target in, `step` ms apart (animejs). Returns the animation, or null under reduced motion. */
export function staggerIn(targets: Targets, { root = document, y = 10, x = 0, step = 60, delay = 0, duration = 420 }: StaggerOpts = {}): JSAnimation | null {
  const els = typeof targets === 'string' ? Array.from(root.querySelectorAll(targets)) : targets instanceof Element ? [targets] : Array.from(targets);
  if (!els.length || prefersReducedMotion()) return null;
  return animate(els, { opacity: [0, 1], translateY: [y, 0], translateX: [x, 0], duration: Math.min(duration, 600), delay: stagger(step, { start: delay }), ease: EASE });
}

/** The route-enter motion (fade + 8 px rise, 320 ms) for an element that mounts outside `.screen`. */
export function pageEnter(el: Element | null): JSAnimation | null {
  if (!el || prefersReducedMotion()) return null;
  return animate(el, { opacity: [0, 1], translateY: [8, 0], duration: 320, ease: EASE });
}

type VTDocument = Document & { startViewTransition?: (update: () => Promise<void> | void) => unknown };

/**
 * navigate() wrapped in document.startViewTransition when the browser has it. BrowserRouter commits inside a React
 * transition, so the update callback resolves on the first DOM mutation after navigating (or 300 ms, whichever first).
 * Without the API, or under reduced motion, it is a plain navigate and the CSS `.screen` enter still plays.
 */
export function useViewNavigate() {
  const nav = useNavigate();
  return useCallback((to: To, opts?: NavigateOptions) => {
    const d = document as VTDocument;
    if (typeof d.startViewTransition !== 'function' || prefersReducedMotion()) { nav(to, opts); return; }
    d.startViewTransition(() => new Promise<void>((resolve) => {
      const done = () => { mo.disconnect(); clearTimeout(timer); resolve(); };
      const mo = new MutationObserver(done);
      mo.observe(document.body, { childList: true, subtree: true });
      const timer = window.setTimeout(done, 300);
      nav(to, opts);
    }));
  }, [nav]);
}
