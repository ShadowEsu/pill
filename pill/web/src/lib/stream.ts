// The station stream. One interface, two sources: replay and EventSource on the pay service's /station/stream.
// Screens subscribe and never care which one they got; the `src` badge comes from here, never hard-coded.
// Both sources walk the station's phases (SOFTWARE-PLAN §2): `state` events dark → blank → running, then samples, then one
// end. Before the samples, `pre` readings carry the dark and clear-water counts the station is taking.
import type { Sample, Source } from './types';
import { REPLAYS } from '../data/reference';
import { stationStatus } from './station';

/** The bridge's run states (pill/pay/src/station.ts RunState). */
export type StationState = 'idle' | 'dark' | 'blank' | 'running' | 'plateau' | 'timeout' | 'fault' | 'stopped' | 'lost';
export interface StateEvent { state: StationState; message: string | null }
/** One reading before the run starts: dark counts with the LEDs off, then the inline/90° counts on clear water.
 *  `blank` is the latched clear-water value once the station has latched it. */
export interface PreReading { state: 'dark' | 'blank'; dark0: number; dark90: number; adc0: number; adc90: number; blank: number | null; temp: number }

export interface StationStream {
  src: Source;
  subscribe: (fn: (s: Sample, all: Sample[]) => void) => () => void;
  onState: (fn: (e: StateEvent) => void) => () => void;
  onPre: (fn: (r: PreReading) => void) => () => void;
  onEnd: (fn: (all: Sample[]) => void) => () => void;
  /** Replay: the plateau window closed, so hand over the rest of the recording at once and end (the rules read all of it).
   *  Live: no-op; the station decides when its run ends. */
  finish: () => void;
  stop: () => void;
}

function hub<T>() {
  const fns = new Set<(v: T) => void>();
  return { on: (fn: (v: T) => void) => { fns.add(fn); return () => { fns.delete(fn); }; }, emit: (v: T) => fns.forEach((f) => f(v)) };
}

/** Wall-clock length of the pre-run phases in a replay, in ms. */
export interface ReplayPhases { dark: number; blank: number }

/** Replay a stored curve. `speed` 7.5 plays 180 s in 24 s, which is what the demo wants. `phases` (default on) plays the
 *  station's dark (3 s / speed) and clear-water (10 s / speed) phases first, with readings shaped like the recording's own
 *  dark and blank counts; pass explicit durations to hold each phase longer on screen. */
export function replayStream(key: keyof typeof REPLAYS, speed = 7.5, opts: { phases?: boolean | ReplayPhases } = {}): StationStream {
  const samples = REPLAYS[key].samples;
  const subs = new Set<(s: Sample, all: Sample[]) => void>();
  const states = hub<StateEvent>(), pres = hub<PreReading>(), ends = hub<Sample[]>();
  const all: Sample[] = [];
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let i = 0, done = false;
  const end = () => { if (done) return; done = true; ends.emit(all); };
  const push = (s: Sample) => { all.push(s); subs.forEach((f) => f(s, all)); };
  const tick = () => {
    if (done) return;
    if (i >= samples.length) { end(); return; }
    push(samples[i++]);
    later(tick, 1000 / speed);
  };
  const phases = opts.phases ?? true;
  if (phases) {
    const ms: ReplayPhases = phases === true ? { dark: 3000 / speed, blank: 10000 / speed } : phases;
    // seeded jitter so every replay reads the same dark and blank counts
    let seed = key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
    const s0 = samples[0];
    const dark = () => ({ dark0: Math.max(0, Math.round(s0.dark + rnd() * 3)), dark90: Math.max(0, Math.round(s0.dark - 3 + rnd() * 3)) });
    const temp = () => +(s0.temp + rnd() * 0.1).toFixed(1);
    const blankReads: number[] = [];
    later(() => states.emit({ state: 'dark', message: null }), 0);
    for (let k = 0; k < 3; k++) later(() => { const d = dark(); pres.emit({ state: 'dark', ...d, adc0: d.dark0, adc90: d.dark90, blank: null, temp: temp() }); }, (ms.dark * (k + 0.6)) / 3);
    later(() => states.emit({ state: 'blank', message: null }), ms.dark);
    for (let k = 0; k < 10; k++) later(() => {
      const adc0 = Math.round(s0.blank * (1 + rnd() * 0.006));
      blankReads.push(adc0);
      const latched = k === 9 ? Math.round(blankReads.reduce((a, b) => a + b, 0) / blankReads.length) : null;
      pres.emit({ state: 'blank', ...dark(), adc0, adc90: Math.round(s0.adc90 * (1 + rnd() * 0.006)), blank: latched, temp: temp() });
    }, ms.dark + (ms.blank * (k + 0.5)) / 10.5);
    later(() => { states.emit({ state: 'running', message: null }); tick(); }, ms.dark + ms.blank);
  } else later(tick, 300);
  return {
    src: 'replay',
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    onState: states.on,
    onPre: pres.on,
    onEnd: ends.on,
    finish: () => {
      if (done) return;
      timers.forEach(clearTimeout); timers.clear();
      while (i < samples.length) push(samples[i++]);
      end();
    },
    stop: () => { done = true; timers.forEach(clearTimeout); timers.clear(); },
  };
}

/** Live stream from the station (pay service SSE, lib/station.ts). Same shape. `src` is 'real' for a USB station and 'sim'
 *  for the service's simulator, so the badge never calls a simulation live. The stream ends once: on the service's `end`
 *  event, or when the connection drops; either way with the samples that arrived, and the rules decide (under 30 s → U3).
 *  The SSE carries samples only once the run is running, so while the station reads the dark and the clear water the
 *  station's own latest line (GET /station/status) is read once a second and handed over as `pre` readings. */
export function liveStream(url: string, src: Source = 'real', runId?: string): StationStream {
  const es = new EventSource(url);
  const subs = new Set<(s: Sample, all: Sample[]) => void>();
  const states = hub<StateEvent>(), pres = hub<PreReading>(), ends = hub<Sample[]>();
  const all: Sample[] = [];
  let done = false;
  let state: StationState = 'idle';
  let lastSeq = -1;
  const poll = window.setInterval(() => {
    if (state !== 'dark' && state !== 'blank') return;
    void stationStatus().then((s) => {
      const l = s?.last;
      if (done || !l || (runId && s.run?.id !== runId) || l.seq === lastSeq || (state !== 'dark' && state !== 'blank')) return;
      lastSeq = l.seq;
      pres.emit({
        state, dark0: l.dark[0], dark90: l.dark[1], adc0: l.adc0, adc90: l.adc90, temp: l.temp_c,
        blank: l.blank ? Math.max(1, l.blank[0] - l.dark[0]) : null,
      });
    });
  }, 1000);
  const finish = () => { if (done) return; done = true; clearInterval(poll); es.close(); ends.emit(all); };
  es.onmessage = (e) => { const s = JSON.parse(e.data) as Sample; all.push(s); subs.forEach((f) => f(s, all)); };
  es.addEventListener('state', (e) => {
    const ev = JSON.parse((e as MessageEvent<string>).data) as StateEvent;
    state = ev.state;
    states.emit(ev);
  });
  es.addEventListener('end', finish);
  es.onerror = finish;
  return {
    src,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    onState: states.on,
    onPre: pres.on,
    onEnd: ends.on,
    finish: () => {},
    stop: () => { done = true; clearInterval(poll); es.close(); },
  };
}
