// The station stream. One interface, two sources: replay (now) and EventSource on /stream (when the backend exists).
// Screens subscribe and never care which one they got; the `src` badge comes from here, never hard-coded.
import type { Sample, Source } from './types';
import { REPLAYS } from '../data/reference';

export interface StationStream {
  src: Source;
  subscribe: (fn: (s: Sample, all: Sample[]) => void) => () => void;
  onEnd: (fn: (all: Sample[]) => void) => () => void;
  stop: () => void;
}

/** Replay a stored curve. `speed` 7.5 plays 180 s in 24 s, which is what the demo wants. */
export function replayStream(key: keyof typeof REPLAYS, speed = 7.5): StationStream {
  const samples = REPLAYS[key].samples;
  const subs = new Set<(s: Sample, all: Sample[]) => void>();
  const ends = new Set<(all: Sample[]) => void>();
  const all: Sample[] = [];
  let i = 0;
  let timer: number | undefined;
  const tick = () => {
    if (i >= samples.length) { ends.forEach((f) => f(all)); return; }
    const s = samples[i++];
    all.push(s);
    subs.forEach((f) => f(s, all));
    timer = window.setTimeout(tick, 1000 / speed);
  };
  timer = window.setTimeout(tick, 300);
  return {
    src: 'replay',
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    onEnd: (fn) => { ends.add(fn); return () => ends.delete(fn); },
    stop: () => { clearTimeout(timer); },
  };
}

/** Live stream from the backend (SSE). Same shape; wired when FastAPI `/stream` exists. */
export function liveStream(url = '/stream'): StationStream {
  const es = new EventSource(url);
  const subs = new Set<(s: Sample, all: Sample[]) => void>();
  const ends = new Set<(all: Sample[]) => void>();
  const all: Sample[] = [];
  es.onmessage = (e) => { const s = JSON.parse(e.data) as Sample; all.push(s); subs.forEach((f) => f(s, all)); };
  es.addEventListener('end', () => ends.forEach((f) => f(all)));
  return {
    src: 'real',
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    onEnd: (fn) => { ends.add(fn); return () => ends.delete(fn); },
    stop: () => es.close(),
  };
}
