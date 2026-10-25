#!/usr/bin/env python3
"""Original upbeat score + sound effects for the pitch cut (synthesised here, so no licence or attribution needed).

    pitch/video/edit/.venv/bin/python pitch/video/edit/make_music.py [seconds]

Writes work/music-fun.wav (116 BPM, F–C–Dm–Bb, kick / clap / hats / bass / pluck chords / bell hook) and
sfx/{pop,whoosh,ding,uhoh}.wav. 48 kHz, 16-bit stereo.
"""
import os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BPM = 116
BEAT = 60 / BPM
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0
rng = np.random.default_rng(7)


def write(path, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = x / max(1e-9, np.max(np.abs(x))) * 0.89
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print("wrote", os.path.relpath(path, HERE), f"{len(x) / SR:.2f}s")


def t_(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.003, r=0.2):
    t = t_(d); return np.minimum(1, t / a) * np.exp(-t / r)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def lowpass(x, fc):  # one-pole
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y
def highpass(x, fc): return x - lowpass(x, fc)


# ── drum and synth voices ──────────────────────────────────────────────────────────────────────
def kick():
    t = t_(0.32); f = 48 + 110 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11) * 0.95
def clap():
    t = t_(0.22); n = rng.standard_normal(len(t))
    bursts = sum(np.exp(-np.maximum(0, t - o) / 0.008) * (t >= o) for o in (0, 0.011, 0.022))
    return highpass(n, 900) * (0.6 * bursts + np.exp(-t / 0.07)) * 0.5
def hat(open_=False):
    t = t_(0.18 if open_ else 0.05); n = rng.standard_normal(len(t))
    return highpass(highpass(n, 6000), 6000) * np.exp(-t / (0.06 if open_ else 0.014)) * 0.22
def bass(m, d):
    t = t_(d); f = mtof(m)
    saw = 2 * ((t * f) % 1) - 1
    return lowpass(saw * 0.6 + np.sin(2 * np.pi * f * t) * 0.8, 700) * env(d, 0.004, d * 0.7) * 0.55
def pluck(m, d):
    t = t_(d); f = mtof(m)
    x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.6 for k in range(1, 6))
    return x * env(d, 0.002, 0.16) * 0.22
def bell(m, d):
    t = t_(d); f = mtof(m)
    x = np.sin(2 * np.pi * f * t + 1.8 * np.sin(2 * np.pi * f * 3.5 * t) * np.exp(-t / 0.25))
    return x * env(d, 0.002, 0.35) * 0.20


# ── arrangement ────────────────────────────────────────────────────────────────────────────────
N = int(DUR * SR) + SR
L = np.zeros(N); R = np.zeros(N)
def add(x, at, pan=0.0, g=1.0):
    i = int(at * SR); j = min(N, i + len(x)); seg = x[: j - i] * g
    L[i:j] += seg * np.sqrt((1 - pan) / 2) * 1.414; R[i:j] += seg * np.sqrt((1 + pan) / 2) * 1.414

CHORDS = [(65, [65, 69, 72, 77]), (60, [64, 67, 72, 76]), (62, [65, 69, 74, 77]), (58, [62, 65, 70, 74])]  # F C Dm Bb
HOOK = [77, None, 81, 79, None, 77, 74, None]   # 8ths over each two-bar phrase start
K, C, HH, HO = kick(), clap(), hat(), hat(True)
bars = int(DUR / (4 * BEAT)) + 1
for b in range(bars):
    t0 = b * 4 * BEAT
    root, chord = CHORDS[b % 4]
    intro = b < 1
    for q in range(4):
        tq = t0 + q * BEAT
        if not intro:
            add(K, tq, g=0.9)
            if q in (1, 3): add(C, tq, pan=0.1, g=0.75)
        for e in range(2):
            add(HO if e == 1 and q == 3 else HH, tq + e * BEAT / 2, pan=0.35 if e else -0.35, g=0.8 if e else 0.55)
    # bass: root on 1, octave bounce on the "and"s
    for k, (off, m) in enumerate([(0, root - 24), (1.5, root - 12), (2, root - 24), (3.5, root - 12)]):
        add(bass(m, BEAT * 0.9), t0 + off * BEAT, g=0 if intro else 1)
    # pluck chords on the off-beats
    for q in (0.5, 1.5, 2.5, 3.5):
        for n_, m in enumerate(chord):
            add(pluck(m, 0.4), t0 + q * BEAT + n_ * 0.006, pan=(-0.5 + n_ / 3), g=0.9)
    # bell hook every other bar
    if b % 2 == 0 and b >= 2:
        for k, m in enumerate(HOOK):
            if m: add(bell(m, 0.6), t0 + k * BEAT / 2, pan=0.2)

fade = np.ones(N); fi = int(0.3 * SR); fade[:fi] = np.linspace(0, 1, fi)
mix = np.stack([L * fade, R * fade], 1)[: int(DUR * SR)]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.6)  # gentle glue
write(os.path.join(HERE, "work", "music-fun.wav"), mix)

# ── sound effects ──────────────────────────────────────────────────────────────────────────────
t = t_(0.12)  # pop: quick upward blip
f = 500 + 900 * (1 - np.exp(-t / 0.02))
write(os.path.join(HERE, "sfx", "pop.wav"), np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035))
t = t_(0.45); n = rng.standard_normal(len(t))  # whoosh: noise swelling through a rising band
w = highpass(lowpass(n, 2500), 400) * np.sin(np.pi * t / 0.45) ** 2
write(os.path.join(HERE, "sfx", "whoosh.wav"), w)
d = (bell(84, 1.2) + 0.7 * np.concatenate([np.zeros(int(0.09 * SR)), bell(91, 1.2)])[: int(1.2 * SR)])  # ding: two bells
write(os.path.join(HERE, "sfx", "ding.wav"), d)
t = t_(0.9)  # uh-oh: two falling "wah" tones
seg = lambda m0, m1, d: np.sin(2 * np.pi * np.cumsum(np.linspace(mtof(m0), mtof(m1), int(d * SR))) / SR)
u = np.concatenate([seg(67, 66, 0.3) * env(0.3, 0.01, 0.25), np.zeros(int(0.05 * SR)), seg(63, 58, 0.55) * env(0.55, 0.01, 0.4)])
write(os.path.join(HERE, "sfx", "uhoh.wav"), lowpass(np.sign(u) * np.abs(u) ** 0.6, 1800))
