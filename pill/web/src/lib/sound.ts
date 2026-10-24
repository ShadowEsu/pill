// Pill sounds, synthesised with WebAudio (no files). Call playSound(name) from anywhere; it is a no-op until the first
// user gesture on the page (the AudioContext is created inside that pointerdown, never earlier) and while
// localStorage['pill.sound'] === 'off' ('on' is the default).
//
//   tick     a station check turns green; pass { step } to rise a semitone per check (Place)
//   rise     a run starts (Place Start, Kiosk Start)
//   chime    PASS: two soft sine notes
//   low      NEEDS LAB, or a hold: one low triangle note
//   neutral  UNABLE TO VERIFY: a short filtered noise burst
//   tap      a button press, very quiet
//
// Verdict screens: playSound(verdictSound(ev.verdict)).
import { useCallback, useSyncExternalStore } from 'react';
import type { Verdict } from './types';

export type SoundName = 'tick' | 'rise' | 'chime' | 'low' | 'neutral' | 'tap';

const KEY = 'pill.sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
const listeners = new Set<() => void>();

const readOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
let on = readOn();

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === 'undefined') return null;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

/** The first pointerdown (or key press) on the page is the gesture that allows audio. */
function unlock() {
  unlocked = true;
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('keydown', unlockKey, true);
  if (on) ensureCtx()?.resume().catch(() => {});
}
function unlockKey(e: KeyboardEvent) { if (e.key !== 'Escape') unlock(); }
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlockKey, true);
  window.addEventListener('storage', (e) => { if (e.key === KEY) { on = readOn(); listeners.forEach((l) => l()); } });
}

export const soundOn = () => on;

export function setSoundOn(value: boolean) {
  on = value;
  try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* private mode: the session still respects it */ }
  if (value && unlocked) ensureCtx()?.resume().catch(() => {});
  listeners.forEach((l) => l());
}

/** One enveloped oscillator: quick attack, exponential decay. */
function tone(c: AudioContext, out: AudioNode, { type, freq, to, at = 0, dur, gain, attack = 0.008 }: { type: OscillatorType; freq: number; to?: number; at?: number; dur: number; gain: number; attack?: number }) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.85);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(c: AudioContext, out: AudioNode, dur: number, gain: number) {
  const n = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const semis = (base: number, n: number) => base * Math.pow(2, n / 12);

export function playSound(name: SoundName, opts: { step?: number } = {}) {
  if (!on || !unlocked) return;
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const out = master;
  switch (name) {
    case 'tick': tone(c, out, { type: 'sine', freq: semis(1046.5, (opts.step ?? 0) * 2), dur: 0.09, gain: 0.05, attack: 0.003 }); break;
    case 'rise':
      tone(c, out, { type: 'sine', freq: 330, to: 880, dur: 0.6, gain: 0.06, attack: 0.05 });
      tone(c, out, { type: 'sine', freq: 660, to: 1320, dur: 0.6, gain: 0.015, attack: 0.05 });
      break;
    case 'chime':
      tone(c, out, { type: 'sine', freq: 659.25, dur: 1.1, gain: 0.08, attack: 0.012 });
      tone(c, out, { type: 'sine', freq: 987.77, at: 0.16, dur: 1.4, gain: 0.07, attack: 0.012 });
      break;
    case 'low': tone(c, out, { type: 'triangle', freq: 174.61, dur: 0.9, gain: 0.12, attack: 0.02 }); break;
    case 'neutral': noise(c, out, 0.22, 0.07); break;
    case 'tap': tone(c, out, { type: 'triangle', freq: 620, dur: 0.035, gain: 0.02, attack: 0.002 }); break;
  }
}

/** The verdict's sound: PASS → chime, NEEDS LAB → low, UNABLE TO VERIFY → neutral. */
export const verdictSound = (v: Verdict): SoundName => (v === 'PASS' ? 'chime' : v === 'NEEDS LAB' ? 'low' : 'neutral');

/** { on, setOn, play } for settings toggles and screens. */
export function useSound() {
  const value = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, soundOn, soundOn);
  const play = useCallback((name: SoundName, opts?: { step?: number }) => playSound(name, opts), []);
  return { on: value, setOn: setSoundOn, play };
}
