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
    dict(id="C2", name="Problem: why pills", src=(8.20, 13.60), fx="grade", join=("fadewhite", 0.25),
         caps=[(8.31, 9.92, "Why are we talking about pills?"),
               (10.38, 13.44, "Pills go through a very intense process with the FDA.")]),
    dict(id="C3", name="Problem: pharmacy shelf, aspirin bottle", src=(13.80, 23.25), fx="grade", join=("cut", CUT_D),
         caps=[(13.92, 18.53, "They go through this process several times before a normal pharmacy,"),
               (18.53, 19.47, "like Walgreens,"),
               (19.79, 23.02, "I got this from Walgreens: aspirin 81.")]),
    dict(id="C4", name="Problem: the final step can fail", src=(27.65, 35.60), fx="punch", join=("cut", CUT_D),
         caps=[(27.77, 31.30, "In the final process, some of them could be malfunctioned,"),
               (31.30, 35.41, "and people could have bad intentions and put different drugs in here.")]),
    dict(id="C5", name="App: prescription + what the pill looks like", src=(55.85, 63.40), fx="grade", join=("smoothleft", 0.22),
         caps=[(55.99, 58.75, "First we put in the prescription of the drug,"),
               (59.04, 63.23, "and then what it looks like.")]),
    dict(id="C6", name="Box: 3D-printed station, water to the mark", src=(68.35, 77.60), fx="grade", join=("cut", CUT_D),
         caps=[(68.48, 72.50, "What we have in this beautifully 3D printed device:"),
               (72.50, 77.39, "we put some water in there, to a marking, just like so.")]),
    dict(id="C7", name="Box: start, sample in", src=(80.05, 83.60), fx="grade", join=("cut", CUT_D),
         caps=[(80.16, 83.52, "As I click start, I push this medicine in.")]),
    dict(id="C8", name="App: countdown / live curve", src=(104.15, 107.60), fx="grade", join=("smoothup", 0.22),
         caps=[(104.26, 107.46, "Now that it's ready, we go through the countdown.")]),
    dict(id="C9", name="Box: the hardware", src=(112.30, 124.55), fx="grade", join=("cut", CUT_D),
         caps=[(112.42, 117.49, "We use an Arduino UNO Q for the main head and CPU."),
               (117.87, 124.39, "Red, blue and white lights, and a photoresistor at the back.")]),
    dict(id="C10", name="Box: three colours, one measurement", src=(128.70, 133.50), fx="punch", join=("cut", CUT_D),
         caps=[(128.82, 133.34, "We use these three colors to find a good measurement.")]),
    dict(id="C11", name="Result: Unable to verify", src=(164.00, 170.20), fx="grade", join=("smoothleft", 0.22),
         caps=[(164.12, 167.39, "As the timer runs out, it's going to check."),
               (168.12, 170.16, "And oh no: UNABLE TO VERIFY.")]),
    dict(id="C12", name="Close: swallow the right pills", src=(173.30, 178.45), fx="grade", join=("cut", CUT_D),
         caps=[(173.31, 174.27, "So watch out."),
               (175.74, 177.50, "Please swallow the right pills."),
               (177.73, 178.40, "Thank you.")]),
]
END_JOIN = ("fadeblack", 0.45)
EMPHASIS = {"PILL", "UNABLE", "TO", "VERIFY"}  # rendered in Instrument Serif italic, larger

# stickers: name -> (content w, h, offset x, y) inside the 1024² qlmanage PNG (see stickers/*.svg)
STK = {'answer-passed': (900, 204, 62, 410), 'answer-lab': (900, 204, 62, 410), 'answer-unable': (900, 204, 62, 410),
       'chip-box': (760, 204, 132, 410), 'chip-explains': (620, 204, 202, 410), 'chip-unoq': (700, 204, 162, 410),
       'chip-402': (1000, 204, 12, 410), 'pill': (600, 600, 212, 212), 'ring': (800, 600, 112, 212),
       'arrow': (500, 500, 262, 262)}
# pop-ups: (cut id or "END", src time (or seconds into end card), sticker, on-screen width, x, y, dur, alpha)
POPS = [
    ("C3", 19.90, "pill", 300, 720, 330, 3.2, 1.0),
    ("C5", 56.00, "chip-box", 640, 60, 300, 7.2, 1.0),
    ("C5", 56.80, "chip-explains", 520, 480, 480, 6.4, 1.0),
    ("C6", 74.80, "arrow", 360, 640, 760, 2.6, 1.0),
    ("C8", 104.30, "ring", 360, 410, 735, 3.2, 1.0),  # ≤35 % of frame width, round the dial on the laptop (≈590,870 at 1:45)
    ("C9", 112.60, "chip-unoq", 600, 240, 300, 6.0, 1.0),
    ("C11", 168.10, "answer-passed", 760, 160, 300, 4.6, 0.45),
    ("C11", 168.25, "answer-lab", 760, 160, 480, 4.45, 0.45),
    ("C11", 168.40, "answer-unable", 860, 110, 660, 4.3, 1.0),
    ("END", 0.30, "pill", 420, 330, 360, 3.7, 1.0),
    ("END", 0.90, "chip-402", 860, 110, 1240, 3.1, 1.0),
]
MUSIC_TICKS = [22.5, 39.5, 51.5, 62.5, 87.0, 102.0, 123.0, 141.0, 151.0]  # film score's scene ticks, muted here

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
for i, c in enumerate(CUTS):
    if c["fx"] == "glow":  # head on the speaker (graded), then the slowed hardware shot with glow + push-in + vignette
        fc.append(f"[{i}:v]trim=0:{JC['head']:.3f},setpts=PTS-STARTPTS,{BASE},{GRADE},format=yuv420p,settb=1/{FPS}[hd]")
        fc.append(f"[{iHW}:v]setpts=(PTS-STARTPTS)/{JC['speed']},fps={FPS},scale={2 * W}:{2 * H}:flags=bicubic,"
                  f"zoompan=z='min(1+0.0030*on\\,1.30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
                  f"setsar=1,format=gbrp,split=3[h0][h1][h2]")
        fc.append("[h1]gblur=sigma=34,colorchannelmixer=rr=0.85:gg=0.62:bb=1.30[hg]")
        fc.append("[h2]edgedetect=low=0.06:high=0.18:mode=wires,negate,gblur=sigma=1.1[he]")
        fc.append("[h0][hg]blend=all_mode=screen:all_opacity=0.62[hs]")
        fc.append("[hs][he]blend=all_mode=multiply:all_opacity=0.35[hc]")
        fc.append(f"[hc]eq=contrast=1.14:saturation=1.30,vignette=angle=PI/3.2,format=yuv420p,settb=1/{FPS}[hw]")
        fc.append(f"[hd][hw]concat=n=2:v=1:a=0,trim=0:{c['dur']:.3f},settb=1/{FPS}[v{i}]")
    elif c["fx"] == "punch":  # static 8% punch-in ("zoom cut")
        fc.append(f"[{i}:v]fps={FPS},scale={round(W * 1.08 / 2) * 2}:{round(H * 1.08 / 2) * 2}:flags=lanczos,"
                  f"crop={W}:{H},setsar=1,{GRADE},format=yuv420p,settb=1/{FPS}[v{i}]")
    else:
        fc.append(f"[{i}:v]{BASE},{GRADE},format=yuv420p,settb=1/{FPS}[v{i}]")
    fc.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,afftdn=nr=10,asetpts=PTS-STARTPTS[a{i}]")
fc.append(f"[{iEND}:v]format=yuv420p,setsar=1,settb=1/{FPS}[v{NC}]")
fc.append(f"[{iSIL}:a]aformat=channel_layouts=stereo[a{NC}]")
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
# pop-up stickers
pop_inputs = []
for j, (cid, st, name, wd, x, y, dur, alpha) in enumerate(POPS):
    idx = iHW + 1 + j
    T0 = round(to_out(cid, st), 3)
    cw, ch, ox, oy = STK[name]
    pop_inputs.append(f'-loop 1 -framerate {FPS} -t {dur:.2f} -i stickers/{name}.png')
    am = f",colorchannelmixer=aa={alpha}" if alpha < 1 else ""
    fc.append(f"[{idx}:v]format=rgba,crop={cw}:{ch}:{ox}:{oy},scale={wd}:-1:flags=lanczos{am},"
              f"fade=t=in:st=0:d=0.12:alpha=1,fade=t=out:st={dur - 0.18:.2f}:d=0.18:alpha=1,setpts=PTS-STARTPTS+{T0}/TB[p{j}]")
    nv = f"[o{j}]"
    fc.append(f"{vcur}[p{j}]overlay=x={x}:y='{y}+70*exp(-(t-{T0})*12)*cos((t-{T0})*20)':"
              f"enable='between(t,{T0},{T0 + dur:.3f})':eof_action=pass{nv}")
    vcur = nv
fc.append(f"{vcur}ass=captions.ass:fontsdir=fonts,format=yuv420p[vout]")
# audio: voice ladder + film score ducked under it (sidechain), score ticks muted, loudness to -14 LUFS
tick_mute = "+".join(f"between(t,{tk - 0.01:.2f},{tk + 0.09:.2f})" for tk in MUSIC_TICKS if tk < TOTAL)
fc.append(f"{pa}asplit=2[vo][vsc]")
fc.append(f"[{iMUS}:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
          f"volume=0:enable='{tick_mute}',volume=0.55,afade=t=in:st=0:d=0.4,afade=t=out:st={TOTAL - 1.6:.2f}:d=1.6[mu]")
fc.append("[mu][vsc]sidechaincompress=threshold=0.025:ratio=9:attack=15:release=380:makeup=1[duck]")
fc.append("[vo][duck]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")

graph = ";\n".join(fc)
open(os.path.join(HERE, "graph.txt"), "w").write(graph + "\n")
ins = " \\\n  ".join(inputs + pop_inputs)
BUILD = f"""#!/usr/bin/env bash
# Pill pitch cut: {NC} cuts + {END_DUR:.0f}-s end card = {TOTAL:.2f} s, 1080x1920 (source is portrait: 1024x576 with -90° rotation).
# Generated by make_edit.py (edit the cut list there, re-run it, never hand-edit the graph).
#   bash pitch/video/edit/build.sh            full render  -> pitch/video/pill-pitch-90s.mp4
#   bash pitch/video/edit/build.sh --preview  seconds 0-10 -> pitch/video/pill-pitch-preview10.mp4
#   bash pitch/video/edit/build.sh --check    filtergraph dry run: 0.1 s to the null muxer, no encode
set -euo pipefail
cd "$(dirname "$0")"
SRC=../../video-raw/preston-pitch-raw.mp4
MUSIC=../../film/work/music.wav   # the film's own generated score (96 BPM pad/bass/pluck), no licence needed
FF=${{FFMPEG:-bin/ffmpeg}}          # needs libass (the 'ass' filter); Homebrew's ffmpeg 8.1.2 has none
if ! "$FF" -hide_banner -filters 2>/dev/null | grep ' ass ' >/dev/null; then
  echo "fetching a static ffmpeg with libass into bin/ (martin-riedl.de, macOS arm64)"
  mkdir -p bin && curl -sSfL -o bin/ffmpeg.zip https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
  (cd bin && unzip -o -q ffmpeg.zip && rm ffmpeg.zip && chmod +x ffmpeg && xattr -c ffmpeg 2>/dev/null || true)
  FF=bin/ffmpeg
fi
[ -f "$MUSIC" ] || {{ echo "missing $MUSIC (pitch/film/work is untracked; re-run pitch/film/render.mjs or set MUSIC=)"; exit 1; }}
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
print(f"| END card | {mmss(END_START)}–{mmss(TOTAL)} | generated | {END_DUR:.2f} | {END_JOIN[0]} {END_JOIN[1]:.2f}s | pill + 402 chip | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |")
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
