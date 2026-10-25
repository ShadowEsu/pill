#!/usr/bin/env python3
"""Generates captions.ass and build.sh for the owner's pitch cut from one cut list.

Edit CUTS (source in/out, caption phrases with source times from the Gemini transcript) and re-run:
    python3 pitch/video/edit/make_edit.py
No rendering happens here; build.sh does the render.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
W, H = 1080, 1920
END_DUR = 4.0
CUT_D = 1 / FPS  # a "cut" is a one-frame xfade so the whole chain is one xfade/acrossfade ladder

# ── cut list ──────────────────────────────────────────────────────────────────────────────────────
# src in/out in seconds of preston-pitch-raw.mp4; caps = (src_start, src_end, text) from the transcript
# (gemini-3.5-flash-lite, cross-checked against gemini-2.5-flash), lightly trimmed; join = transition INTO this cut.
CUTS = [
    # J-cut: audio is 0:44.30–0:49.10 throughout; video shows him for `head` s ("So what we built"), then at "it's Pill"
    # cuts to the station (2:05.10, inside his hardware walk-through: purple chamber + UNO Q board) slowed to 0.75×.
    dict(id="C1", name="Hook: what we built is Pill (J-cut to hardware glow)", src=(44.30, 49.10), fx="glow", join=None,
         jcut=dict(head=0.90, src=125.10, speed=0.75),
         caps=[(44.43, 45.72, "What we built… it's PILL."), (46.37, 49.04, "Pill is a hardware and software device")]),
    dict(id="C2", name="Problem: why pills", src=(8.20, 13.60), fx="push", join=("fadewhite", 0.25),
         caps=[(8.31, 9.92, "Why are we talking about pills?"),
               (10.38, 13.44, "Pills go through a very intense process with the FDA.")]),
    dict(id="C3", name="Problem: pharmacy shelf, aspirin bottle", src=(13.80, 23.25), fx="push", join=("cut", CUT_D),
         caps=[(13.92, 18.53, "They go through this process several times before a normal pharmacy,"),
               (18.53, 19.47, "like Walgreens,"),
               (19.79, 23.02, "I got this from Walgreens: aspirin 81.")]),
    dict(id="C4", name="Problem: the final step can fail", src=(27.65, 35.60), fx="punch", join=("cut", CUT_D),
         caps=[(27.77, 31.30, "In the final process, some of them could be malfunctioned,"),
               (31.30, 35.41, "and people could have bad intentions and put different drugs in here.")]),
    dict(id="C5", name="App: prescription + what the pill looks like", src=(55.85, 63.40), fx="push", join=("smoothleft", 0.22),
         caps=[(55.99, 58.75, "First we put in the prescription of the drug,"),
               (59.04, 63.23, "and then what it looks like.")]),
    dict(id="C6", name="Box: 3D-printed station, water to the mark", src=(68.35, 77.60), fx="push", join=("cut", CUT_D),
         caps=[(68.48, 72.50, "What we have in this beautifully 3D printed device:"),
               (72.50, 77.39, "we put some water in there, to a marking, just like so.")]),
    dict(id="C7", name="Box: start, sample in", src=(80.05, 83.60), fx="punch", join=("cut", CUT_D),
         caps=[(80.16, 83.52, "As I click start, I push this medicine in.")]),
    dict(id="C8", name="App: countdown / live curve", src=(104.15, 107.60), fx="push", join=("smoothup", 0.22),
         caps=[(104.26, 107.46, "Now that it's ready, we go through the countdown.")]),
    dict(id="C9", name="Box: the hardware", src=(112.30, 124.55), fx="push", join=("cut", CUT_D),
         caps=[(112.42, 117.49, "We use an Arduino UNO Q for the main head and CPU."),
               (117.87, 124.39, "Red, blue and white lights, and a photoresistor at the back.")]),
    dict(id="C10", name="Box: three colours, one measurement", src=(128.70, 133.50), fx="punch", join=("cut", CUT_D),
         caps=[(128.82, 133.34, "We use these three colors to find a good measurement.")]),
    dict(id="C11", name="Result: Unable to verify", src=(164.00, 170.20), fx="shake", join=("smoothleft", 0.22),
         shake_at=168.12,  # "oh no": 0.5-s shake + white flash
         caps=[(164.12, 167.39, "As the timer runs out, it's going to check."),
               (168.12, 170.16, "And oh no: UNABLE TO VERIFY.")]),
    dict(id="C12", name="Close: swallow the right pills", src=(173.30, 178.45), fx="push", join=("cut", CUT_D),
         caps=[(173.31, 174.27, "So watch out."),
               (175.74, 177.50, "Please swallow the right pills."),
               (177.73, 178.40, "Thank you.")]),
]
END_JOIN = ("fadeblack", 0.45)
EMPHASIS = {"PILL", "UNABLE", "TO", "VERIFY"}  # rendered in Instrument Serif italic, larger

# stickers: name -> (content w, h, offset x, y). stickers/*.svg sit inside 1024² PNGs (render_stickers.mjs);
# stickers/pop-*.png are cropped to their content (render_pops.mjs), so their box is the whole PNG.
STK = {'answer-passed': (900, 204, 62, 410), 'answer-lab': (900, 204, 62, 410), 'answer-unable': (900, 204, 62, 410),
       'chip-unoq': (700, 204, 162, 410), 'pill': (600, 600, 212, 212), 'ring': (800, 600, 112, 212),
       'arrow': (500, 500, 262, 262)}
def png_size(p):
    with open(p, "rb") as f:
        head = f.read(24)
    return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
for f in sorted(os.listdir(os.path.join(HERE, "stickers"))):
    if f.startswith("pop-") and f.endswith(".png"):
        w_, h_ = png_size(os.path.join(HERE, "stickers", f)); STK[f[:-4]] = (w_, h_, 0, 0)
# sound effects (make_music.py writes them): a pop on every sticker, a whoosh on every whip, uh-oh on the verdict, ding on the end
SFX = ["pop", "whoosh", "ding", "uhoh"]
SFX_GAIN = {"pop": 0.30, "whoosh": 0.40, "ding": 0.45, "uhoh": 0.50}
MUSIC_GAIN = 0.34  # music-fun.wav is ~-14 LUFS; this sits it ~10 dB under the voice before the light duck

# ── timeline ──────────────────────────────────────────────────────────────────────────────────────
for c in CUTS:
    c["dur"] = round(c["src"][1] - c["src"][0], 3)
starts, t = [], 0.0
for i, c in enumerate(CUTS):
    if i:
        t -= c["join"][1]
    starts.append(round(t, 3)); t += c["dur"]
END_START = round(t - END_JOIN[1], 3)
TOTAL = round(END_START + END_DUR, 3)
for c, s in zip(CUTS, starts):
    c["out"] = s
BYID = {c["id"]: c for c in CUTS}

def to_out(cid, src):
    if cid == "END":
        return END_START + src
    c = BYID[cid]
    return c["out"] + (src - c["src"][0])

# ── pop-ups (after the timeline so durations can run "until" a point in another cut) ──────────────────
# tuple: (cut id or "END", src time (or seconds into end card), sticker, on-screen width, x, y, dur, alpha)
def P(cid, st, name, y, h, x=None, dur=None, to=None, alpha=1.0):
    cw, ch = STK[name][:2]
    wd = round(h * cw / ch / 2) * 2
    x = (W - wd) // 2 if x is None else x
    T0 = to_out(cid, st)
    d = (to_out(*to) - T0) if to else dur
    return (cid, st, name, wd, x, y, round(d, 2), alpha)
C4_END, C5_END, C6_END, C7_END = ("C4", 35.55), ("C5", 63.35), ("C6", 77.55), ("C7", 83.55)
C9_END, C10_END, C11_END = ("C9", 124.50), ("C10", 133.45), ("C11", 170.15)
POPS = [
    # the supply-chain process from his intro: each check stacks up over the laptop (below the captions, clear of his face)
    P("C2", 8.40, "pop-think", y=200, h=220, x=790, dur=1.8),
    P("C2", 10.60, "pop-fda", y=1250, h=88, x=60, to=C4_END),
    P("C3", 14.50, "pop-checked", y=1350, h=88, x=60, to=C4_END),
    P("C3", 18.60, "pop-pharmacy", y=1450, h=88, x=60, to=C4_END),
    P("C3", 19.90, "pill", y=600, h=300, x=760, dur=3.2),
    P("C4", 27.80, "pop-last", y=1550, h=88, x=60, to=C4_END),
    P("C4", 31.40, "pop-swap", y=1650, h=88, x=60, to=C4_END),
    # the Pill process, step by step as he walks it
    P("C5", 56.00, "pop-step1", y=150, h=110, to=("C5", 59.00)),
    P("C5", 59.04, "pop-step2", y=150, h=110, to=C5_END),
    P("C6", 68.60, "pop-3d", y=320, h=130, x=60, dur=3.8),
    P("C6", 72.50, "pop-step3", y=150, h=110, to=C6_END),
    P("C6", 73.40, "pop-drop", y=420, h=200, x=820, dur=2.0),
    P("C6", 74.80, "arrow", y=760, h=360, x=640, dur=2.6),
    P("C7", 80.16, "pop-step4", y=150, h=110, to=C7_END),
    P("C7", 81.20, "pop-eyes", y=330, h=200, x=820, dur=2.0),
    P("C8", 104.26, "pop-step5", y=150, h=110, to=C10_END),
    P("C8", 104.30, "ring", y=735, h=270, x=410, dur=3.2),  # round the dial on the laptop (≈590,870 at 1:45)
    P("C8", 104.60, "pop-timer", y=330, h=200, x=820, dur=2.6),
    P("C9", 112.60, "chip-unoq", y=300, h=136, x=240, dur=5.2),
    P("C9", 117.90, "pop-lights", y=330, h=120, x=60, to=C9_END),
    P("C10", 128.90, "pop-measure", y=330, h=130, to=C10_END),
    P("C11", 164.40, "pop-eyes", y=380, h=200, x=820, dur=2.6),
    P("C11", 168.12, "pop-step6", y=150, h=110, to=C11_END),
    P("C11", 168.10, "answer-passed", y=300, h=172, x=160, dur=4.6, alpha=0.45),
    P("C11", 168.25, "answer-lab", y=480, h=172, x=160, dur=4.45, alpha=0.45),
    P("C11", 168.40, "answer-unable", y=660, h=195, x=110, dur=4.3),
    P("C11", 168.60, "pop-grimace", y=860, h=190, x=60, dur=3.0),
    P("C12", 175.80, "pill", y=380, h=280, x=760, dur=2.4),
    P("END", 0.30, "pill", y=360, h=420, x=330, dur=3.7),
    P("END", 0.90, "pop-end", y=1240, h=120, dur=3.1),
]

# ── captions.ass ──────────────────────────────────────────────────────────────────────────────────
INK, PAPER, PURPLE, WHITE = "&H00111111&", "&H00E6EFF4&", "&H00FF5C7C&", "&H00FFFFFF&"

def ass_t(x):
    x = max(0.0, x); h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def words_timed(t0, t1, text):
    ws = text.split(); wts = [len(re.sub(r'\W', '', w)) + 2 for w in ws]; tot = sum(wts)
    out, a = [], t0
    for w, k in zip(ws, wts):
        b = a + (t1 - t0) * k / tot; out.append((a, b, w)); a = b
    return out

def chunks(words, n=3):
    out, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) == n or re.search(r'[.,:;?!…]$', w[2]):
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out

events, groups = [], []
for c in CUTS:
    lo, hi = c["out"], c["out"] + c["dur"]
    for (s0, s1, text) in c["caps"]:
        t0, t1 = max(lo, to_out(c["id"], s0)), min(hi - 0.02, to_out(c["id"], s1))
        for ch in chunks(words_timed(t0, t1, text)):
            a, b = ch[0][0], ch[-1][1]  # no tail pad: consecutive groups share one position and must not overlap
            parts = []
            for (wa, wb, w) in ch:
                o1, o2 = int((wa - a) * 1000), int((wb - a) * 1000)
                bare = re.sub(r'[^\w]', '', w).upper()
                face = r"\fnInstrument Serif\i1\b0\fs118" if bare in EMPHASIS else ""
                parts.append("{" + face + rf"\1c{INK}\3c{PAPER}\t({o1},{o1 + 1},\1c{WHITE}\3c{PURPLE})"
                             rf"\t({o1},{o1 + 90},\fscx116\fscy116)\t({o1 + 90},{o1 + 180},\fscx100\fscy100)"
                             rf"\t({o2},{o2 + 1},\1c{INK}\3c{PAPER})" + "}" + w.replace("{", "(").replace("}", ")"))
            head = r"{\an5\pos(540,1150)\fad(70,60)\fscx82\fscy82\t(0,110,\fscx106\fscy106)\t(110,190,\fscx100\fscy100)}"
            groups.append((a, b, head + " ".join(parts)))
for k, (a, b, body) in enumerate(groups):  # one caption position: a group ends where the next begins (cuts overlap in xfades)
    b = min(b, groups[k + 1][0]) if k + 1 < len(groups) else b
    events.append(f"Dialogue: 1,{ass_t(a)},{ass_t(b)},Cap,,0,0,0,,{body}")

# hook title: giant serif "Pill" with soft purple glow (layer 0 = blurred halo, layer 1 = ink on paper)
hk0 = CUTS[0]["jcut"]["head"]  # lands on the cut to the hardware ("it's Pill")
for layer, tags in ((0, rf"\bord26\blur14\3c{PURPLE}\1c{PURPLE}\alpha&H40&"), (2, rf"\bord10\blur1\3c{PAPER}\1c{INK}")):
    events.append(f"Dialogue: {layer},{ass_t(hk0)},{ass_t(CUTS[0]['dur'] - 0.1)},Hook,,0,0,0,,"
                  r"{\an5\pos(540,420)\fad(60,120)\fscx40\fscy40\t(0,140,\fscx118\fscy118)\t(140,260,\fscx100\fscy100)\frz-4"
                  + tags + "}Pill")
# end card text
for (dy, txt, st, d0) in ((880, "The box measures. Pill explains.", "CardSerif", 0.4),
                          (1500, "pill-site.vercel.app", "Card", 1.2), (1590, "github.com/ShadowEsu/pill", "Card", 1.4)):
    events.append(f"Dialogue: 1,{ass_t(END_START + d0)},{ass_t(TOTAL)},{st},,0,0,0,,"
                  rf"{{\an5\pos(540,{dy})\fad(150,0)\fscx90\fscy90\t(0,160,\fscx100\fscy100)}}{txt}")

ASS = f"""[Script Info]
; generated by make_edit.py — do not hand-edit, edit make_edit.py and re-run
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter,86,&H00111111,&H00111111,&H00E6EFF4,&H59000000,-1,0,0,0,100,100,0,0,1,13,6,5,90,90,0,1
Style: Hook,Instrument Serif,300,&H00111111,&H00111111,&H00E6EFF4,&H59000000,0,1,0,0,100,100,0,0,1,10,8,5,40,40,0,1
Style: CardSerif,Instrument Serif,96,&H00111111,&H00111111,&H00E6EFF4,&H00000000,0,1,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Card,Inter,58,&H00111111,&H00111111,&H00E6EFF4,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
open(os.path.join(HERE, "captions.ass"), "w").write(ASS)

# ── build.sh ──────────────────────────────────────────────────────────────────────────────────────
inputs, fc = [], []
for c in CUTS:
    inputs.append(f'-ss {c["src"][0]:.3f} -t {c["dur"]:.3f} -i "$SRC"')
NC = len(CUTS)
iEND, iSIL, iMUS = NC, NC + 1, NC + 2
inputs += [f'-f lavfi -t {END_DUR} -i "color=c=0xF4EFE6:s={W}x{H}:r={FPS}"',
           f'-f lavfi -t {END_DUR} -i "anullsrc=r=48000:cl=stereo"', '-i "$MUSIC"']
iHW = NC + 3  # the hook's hardware shot (J-cut video)
JC = CUTS[0]["jcut"]
inputs.append(f'-ss {JC["src"]:.3f} -t {(CUTS[0]["dur"] - JC["head"]) * JC["speed"]:.3f} -i "$SRC"')
GRADE = "eq=contrast=1.05:saturation=1.10:gamma=1.04"
BASE = f"fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1"
# Every segment is forced to its exact nominal length (clone-pad the last frame, then trim). Without this, the 31.58-fps VFR
# source loses a frame or two per segment in -ss/-t + fps=30; the deficit accumulates past the 1-frame "cut" xfades, a later
# xfade's offset lands beyond the end of its first input and the video ends early (the 2026-10-25 render stopped at 62.77 s).
def fit(d): return f"tpad=stop_mode=clone:stop_duration=2,trim=duration={d:.3f},setpts=PTS-STARTPTS"
def afit(d): return f"apad=whole_dur={d:.3f},atrim=duration={d:.3f},asetpts=PTS-STARTPTS"
for i, c in enumerate(CUTS):
    if c["fx"] == "glow":  # head on the speaker (graded), then the slowed hardware shot with glow + push-in + vignette
        fc.append(f"[{i}:v]trim=0:{JC['head']:.3f},setpts=PTS-STARTPTS,{BASE},{GRADE},format=yuv420p,{fit(JC['head'])},settb=1/{FPS}[hd]")
        fc.append(f"[{iHW}:v]setpts=(PTS-STARTPTS)/{JC['speed']},fps={FPS},scale={2 * W}:{2 * H}:flags=bicubic,"
                  f"zoompan=z='min(1+0.0030*on\\,1.30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
                  f"setsar=1,format=gbrp,split=3[h0][h1][h2]")
        fc.append("[h1]gblur=sigma=34,colorchannelmixer=rr=0.85:gg=0.62:bb=1.30[hg]")
        fc.append("[h2]edgedetect=low=0.06:high=0.18:mode=wires,negate,gblur=sigma=1.1[he]")
        fc.append("[h0][hg]blend=all_mode=screen:all_opacity=0.62[hs]")
        fc.append("[hs][he]blend=all_mode=multiply:all_opacity=0.35[hc]")
        fc.append(f"[hc]eq=contrast=1.14:saturation=1.30,vignette=angle=PI/3.2,format=yuv420p,{fit(c['dur'] - JC['head'])},settb=1/{FPS}[hw]")
        fc.append(f"[hd][hw]concat=n=2:v=1:a=0,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    elif c["fx"] == "punch":  # static 8% punch-in ("zoom cut")
        fc.append(f"[{i}:v]fps={FPS},scale={round(W * 1.08 / 2) * 2}:{round(H * 1.08 / 2) * 2}:flags=lanczos,"
                  f"crop={W}:{H},setsar=1,{GRADE},format=yuv420p,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    elif c["fx"] == "shake":  # 8% punch-in; at shake_at a 0.5-s decaying shake and a 0.12-s white flash
        s = c["shake_at"] - c["src"][0]
        fc.append(f"[{i}:v]fps={FPS},scale={round(W * 1.08 / 2) * 2}:{round(H * 1.08 / 2) * 2}:flags=lanczos,"
                  f"crop={W}:{H}:x='(iw-ow)/2+if(between(t,{s:.2f},{s + 0.5:.2f}),26*exp(-(t-{s:.2f})*6)*sin((t-{s:.2f})*70),0)':"
                  f"y='(ih-oh)/2+if(between(t,{s:.2f},{s + 0.5:.2f}),18*exp(-(t-{s:.2f})*6)*cos((t-{s:.2f})*55),0)',"
                  f"setsar=1,{GRADE},eq=brightness=0.35:enable='between(t,{s:.2f},{s + 0.12:.2f})',"
                  f"format=yuv420p,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    elif c["fx"] == "push":  # slow push-in, 1.00 -> 1.06 over the cut
        fc.append(f"[{i}:v]{BASE},scale=w='trunc({W}*(1+0.06*t/{c['dur']:.3f})/2)*2':h=-2:eval=frame:flags=bicubic,"
                  f"crop={W}:{H},setsar=1,{GRADE},format=yuv420p,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    else:
        fc.append(f"[{i}:v]{BASE},{GRADE},format=yuv420p,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    fc.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,afftdn=nr=10,asetpts=PTS-STARTPTS,{afit(c['dur'])}[a{i}]")
fc.append(f"[{iEND}:v]format=yuv420p,setsar=1,{fit(END_DUR)},settb=1/{FPS}[v{NC}]")
fc.append(f"[{iSIL}:a]aformat=channel_layouts=stereo,{afit(END_DUR)}[a{NC}]")
joins = [c["join"] for c in CUTS[1:]] + [END_JOIN]
segstarts = starts[1:] + [END_START]
pv, pa = "[v0]", "[a0]"
for k, ((tr, d), off) in enumerate(zip(joins, segstarts), start=1):
    trn = "fade" if tr == "cut" else tr
    nv, na = f"[x{k}]", f"[y{k}]"
    fc.append(f"{pv}[v{k}]xfade=transition={trn}:duration={d:.3f}:offset={off:.3f}{nv}")
    fc.append(f"{pa}[a{k}]acrossfade=d={d:.3f}:c1=tri:c2=tri{na}")
    pv, pa = nv, na
vcur = pv
# pop-up stickers: spring in from 55 % scale with a damped overshoot plus a small drop, fade out
pop_inputs, sfx_events = [], []
for j, (cid, st, name, wd, x, y, dur, alpha) in enumerate(POPS):
    idx = iHW + 1 + j
    T0 = round(to_out(cid, st), 3)
    cw, ch, ox, oy = STK[name]
    hd = wd * ch / cw
    pop_inputs.append(f'-loop 1 -framerate {FPS} -t {dur:.2f} -i stickers/{name}.png')
    am = f",colorchannelmixer=aa={alpha}" if alpha < 1 else ""
    fc.append(f"[{idx}:v]format=rgba,crop={cw}:{ch}:{ox}:{oy}{am},"
              f"scale=w='trunc({wd}*(1-0.45*exp(-t*8)*cos(t*22))/2)*2':h=-2:eval=frame:flags=bicubic,"
              f"fade=t=in:st=0:d=0.10:alpha=1,fade=t=out:st={dur - 0.18:.2f}:d=0.18:alpha=1,setpts=PTS-STARTPTS+{T0}/TB[p{j}]")
    nv = f"[o{j}]"
    fc.append(f"{vcur}[p{j}]overlay=x='{x}+({wd}-overlay_w)/2':y='{y}+({hd:.0f}-overlay_h)/2+40*exp(-(t-{T0})*10)*cos((t-{T0})*18)':"
              f"eval=frame:enable='between(t,{T0},{T0 + dur:.3f})':eof_action=pass{nv}")
    vcur = nv
    sfx_events.append(("pop", T0))
fc.append(f"{vcur}ass=captions.ass:fontsdir=fonts,format=yuv420p[vout]")
for (tr, d), off in zip(joins, segstarts):
    if tr != "cut" and tr != "fadeblack":
        sfx_events.append(("whoosh", max(0.0, off - 0.15)))
sfx_events.append(("uhoh", round(to_out("C11", 168.05), 3)))
sfx_events.append(("ding", round(END_START + 0.30, 3)))
iSFX = iHW + 1 + len(POPS)
sfx_inputs = [f'-i sfx/{s}.wav' for s in SFX]
# audio: voice ladder + upbeat score (lightly ducked under the voice, up in the gaps) + SFX, loudness to -16 LUFS
fc.append(f"{pa}asplit=2[vo][vsc]")
fc.append(f"[{iMUS}:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
          f"volume={MUSIC_GAIN},afade=t=in:st=0:d=0.3,afade=t=out:st={TOTAL - 1.6:.2f}:d=1.6[mu]")
fc.append("[mu][vsc]sidechaincompress=threshold=0.05:ratio=3:attack=20:release=300:makeup=1[duck]")
sfx_labels = []
for k, s in enumerate(SFX):
    ev = [t for n, t in sfx_events if n == s]
    if not ev:
        continue
    fc.append(f"[{iSFX + k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={SFX_GAIN[s]},asplit={len(ev)}"
              + "".join(f"[{s}{m}]" for m in range(len(ev))))
    for m, t in enumerate(ev):
        ms = int(round(t * 1000))
        fc.append(f"[{s}{m}]adelay={ms}|{ms}[{s}d{m}]"); sfx_labels.append(f"[{s}d{m}]")
fc.append("".join(sfx_labels) + f"amix=inputs={len(sfx_labels)}:normalize=0:duration=longest[sfx]")
fc.append("[vo][duck][sfx]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]")

graph = ";\n".join(fc)
open(os.path.join(HERE, "graph.txt"), "w").write(graph + "\n")
ins = " \\\n  ".join(inputs + pop_inputs + sfx_inputs)
BUILD = f"""#!/usr/bin/env bash
# Pill pitch cut: {NC} cuts + {END_DUR:.0f}-s end card = {TOTAL:.2f} s, 1080x1920 (source is portrait: 1024x576 with -90° rotation).
# Generated by make_edit.py (edit the cut list there, re-run it, never hand-edit the graph).
#   bash pitch/video/edit/build.sh            full render  -> pitch/video/pill-pitch-90s.mp4
#   bash pitch/video/edit/build.sh --preview  seconds 0-10 -> pitch/video/pill-pitch-preview10.mp4
#   bash pitch/video/edit/build.sh --check    filtergraph dry run: 0.1 s to the null muxer, no encode
set -euo pipefail
cd "$(dirname "$0")"
SRC=../../video-raw/preston-pitch-raw.mp4
MUSIC=${{MUSIC:-work/music-fun.wav}}   # original upbeat score synthesised by make_music.py (116 BPM), no licence needed
FF=${{FFMPEG:-bin/ffmpeg}}          # needs libass (the 'ass' filter); Homebrew's ffmpeg 8.1.2 has none
if ! "$FF" -hide_banner -filters 2>/dev/null | grep ' ass ' >/dev/null; then
  echo "fetching a static ffmpeg with libass into bin/ (martin-riedl.de, macOS arm64)"
  mkdir -p bin && curl -sSfL -o bin/ffmpeg.zip https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
  (cd bin && unzip -o -q ffmpeg.zip && rm ffmpeg.zip && chmod +x ffmpeg && xattr -c ffmpeg 2>/dev/null || true)
  FF=bin/ffmpeg
fi
[ -f "$MUSIC" ] && [ -f sfx/pop.wav ] || {{ echo "missing $MUSIC or sfx/: run .venv/bin/python make_music.py 90"; exit 1; }}
MODE=${{1:-full}}
case "$MODE" in
  --preview) OUTARGS=(-t 10 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart ../pill-pitch-preview10.mp4) ;;
  --check)   OUTARGS=(-t 0.1 -f null -) ;;
  full)      OUTARGS=(-c:v libx264 -preset medium -crf 20 -profile:v high -pix_fmt yuv420p -r {FPS} -c:a aac -b:a 192k -ar 48000 -movflags +faststart ../pill-pitch-90s.mp4) ;;
  *) echo "usage: build.sh [--preview|--check]"; exit 2 ;;
esac
"$FF" -hide_banner -y -nostdin \\
  {ins} \\
  -/filter_complex graph.txt \\
  -map "[vout]" -map "[aout]" "${{OUTARGS[@]}}"
[ "$MODE" = --check ] || ls -la ../pill-pitch-*.mp4
"""
open(os.path.join(HERE, "build.sh"), "w").write(BUILD)
os.chmod(os.path.join(HERE, "build.sh"), 0o755)

# ── table for EDIT-PLAN.md ───────────────────────────────────────────────────────────────────────
def mmss(x): return f"{int(x // 60)}:{x % 60:05.2f}"
print("| # | Out in–out | Source in–out | Dur | Transition in | Effect | Captions (verbatim, lightly trimmed) |")
print("|---|---|---|---|---|---|---|")
for c in CUTS:
    j = "—" if not c["join"] else f'{c["join"][0]} {c["join"][1]:.2f}s'
    print(f'| {c["id"]} {c["name"]} | {mmss(c["out"])}–{mmss(c["out"] + c["dur"])} | {mmss(c["src"][0])}–{mmss(c["src"][1])} | '
          f'{c["dur"]:.2f} | {j} | {c["fx"]} | ' + " / ".join(t for _, _, t in c["caps"]) + " |")
print(f"| END card | {mmss(END_START)}–{mmss(TOTAL)} | generated | {END_DUR:.2f} | {END_JOIN[0]} {END_JOIN[1]:.2f}s | pill + 'one tablet · one cup · three answers' chip + ding | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |")
print(f"TOTAL {TOTAL:.2f}s; {len(events)} caption events")
print("POPS:", [(n, round(to_out(c, s), 2)) for c, s, n, *_ in POPS])

# ── captions.srt (sentence cues for YouTube/Devpost upload; the burned-in ASS is the word-pop version) ──
def srt_t(x):
    ms = int(round(x * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
def wrap(s, n=42):
    if len(s) <= n: return s
    cut = s.rfind(" ", 0, len(s) // 2 + 8); return s[:cut] + "\n" + s[cut + 1:]
cues = []
for c in CUTS:
    for (s0, s1, text) in c["caps"]:
        cues.append((max(c["out"], to_out(c["id"], s0)), min(c["out"] + c["dur"], to_out(c["id"], s1)), text))
cues.append((END_START + 0.9, TOTAL, "pill-site.vercel.app"))
with open(os.path.join(HERE, "captions.srt"), "w") as f:
    for k, (a, b, text) in enumerate(cues, 1):
        nxt = cues[k][0] if k < len(cues) else TOTAL
        b = min(max(b, a + 0.9), nxt)  # >= 0.9 s where the gap allows, never overlapping the next cue
        f.write(f"{k}\n{srt_t(a)} --> {srt_t(b)}\n{wrap(text)}\n\n")
