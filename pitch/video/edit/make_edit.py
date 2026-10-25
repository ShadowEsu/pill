#!/usr/bin/env python3
"""Pill pitch cut, v3: generates captions.ass, captions.srt, graph.txt and build.sh from one cut list.

    python3 pitch/video/edit/make_edit.py        (no rendering; build.sh renders)

Timing comes from whisper word onsets (asr/audio16k.json: `whisper small.en --word_timestamps True` on the raw audio).
Every caption phrase starts on the onset of its first word, and every card starts on the onset of its cue word;
the wording comes from the Gemini transcript where whisper mishears (TRANSCRIPT.md).
Look: white Inter Medium sentence captions over a soft bottom scrim; lower-third text cards (2-px purple rule +
tracked caps label); no stickers, no per-word pops. The end card is v2's, unchanged.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
W, H = 1080, 1920
END_DUR = 4.0
CUT_D = 1 / FPS           # a "cut" is a one-frame xfade so the whole chain is one xfade/acrossfade ladder
DISS = round(8 / FPS, 3)  # 8-frame dissolve

# ── whisper word onsets ───────────────────────────────────────────────────────────────────────────
WORDS = [w for s in json.load(open(os.path.join(HERE, "asr", "audio16k.json")))["segments"] for w in s["words"]]
def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())
def onset(word, near, win=1.2):
    """Real onset (source seconds) of `word` nearest to `near`."""
    k = norm(word)
    c = [w for w in WORDS if norm(w["word"]) == k and abs(w["start"] - near) <= win]
    if not c:
        raise SystemExit(f"no whisper onset for {word!r} near {near}")
    return min(c, key=lambda w: abs(w["start"] - near))["start"]
def word_end(word, after, before):
    """End (source s) of the last `word` spoken in [after, before)."""
    k = norm(word)
    c = [w for w in WORDS if norm(w["word"]) == k and after <= w["start"] < before]
    return c[-1]["end"] if c else None

# ── cut list ──────────────────────────────────────────────────────────────────────────────────────
# src in/out = seconds of preston-pitch-raw.mp4. caps = (approx src time, phrase); the phrase starts on its first
# word's whisper onset (anchor= overrides the anchor word). join = transition INTO this cut.
CUTS = [
    # J-cut: audio 0:44.30–0:49.10 throughout; video shows him for `head` s ("So what we built is"), then cuts to the
    # station (2:05.10, purple chamber + UNO Q board) slowed to 0.75× with a subtle glow and slow push.
    dict(id="C1", name="Hook: what we built is Pill (J-cut to the hardware)", src=(44.30, 48.58), fx="hook", join=None,
         jcut=dict(head=0.90, src=125.10, speed=0.75),
         caps=[(44.50, "So what we built is Pill."), (46.66, "Pill is a hardware and software device.")]),
    dict(id="C2", name="Problem: why pills", src=(8.20, 13.60), fx="push", join=("fade", DISS), seated=True,
         caps=[(8.60, "Why are we talking about pills?"), (10.60, "Pills go through a very intense process"),
               (12.48, "with the FDA,")]),
    dict(id="C3", name="Problem: checked again, the pharmacy shelf", src=(13.80, 23.25), fx="push", join=("cut", CUT_D), seated=True,
         caps=[(14.22, "they have to go through this process several times"),
               (16.20, "before being checked out through a normal pharmacy,"), (18.48, "like Walgreens."),
               (19.84, "I got this from Walgreens: it's an aspirin 81.")]),
    dict(id="C4", name="Problem: the last step can fail", src=(27.65, 35.60), fx="push", join=("cut", CUT_D), seated=True,
         caps=[(27.66, "In the final process,"), (29.44, "some of them could be malfunctioned,"),
               (31.80, "people could have bad intentions and put different drugs in here.")]),
    dict(id="C5", name="App: the prescription, what the tablet looks like", src=(55.85, 63.40), fx="push", join=("fade", DISS),
         caps=[(56.08, "First we put in the prescription of the drug,"), (58.88, "and then we use it,"),
               (60.92, "as well as what it looks like.")]),
    dict(id="C6", name="Box: 3D-printed station, water to the mark", src=(68.35, 77.60), fx="push", join=("cut", CUT_D),
         caps=[(68.70, "What we have in this beautifully 3D-printed device:"),
               (72.08, "we're going to put some water in there."), (74.08, "There's going to be a marking, just like so.")]),
    dict(id="C7", name="Box: start, tablet in", src=(80.28, 84.30), fx="push", join=("cut", CUT_D),
         caps=[(80.34, "As I click start,"), (82.64, "I push this medicine in.", "I'm")]),
    dict(id="C8", name="App: the countdown", src=(104.15, 108.05), fx="push", join=("fade", DISS),
         caps=[(104.28, "Alrighty, now that it's ready,"), (106.28, "we will go through the countdown.")]),
    dict(id="C9", name="Box: the hardware", src=(112.30, 124.55), fx="push", join=("cut", CUT_D),
         caps=[(112.82, "As you see in this hardware,"), (114.46, "we use an Arduino UNO Q for the main head and CPU.", "we're"),
               (118.42, "It uses red, blue and white lights,"),
               (122.40, "as well as a photoresistor at the back.")]),
    dict(id="C10", name="Box: three colours, one measurement", src=(128.80, 133.80), fx="push", join=("cut", CUT_D),
         caps=[(129.08, "We use these three colours to find a good measurement.", "we're")]),
    dict(id="C11", name="Result: Unable to verify", src=(164.00, 170.20), fx="push", join=("fade", DISS),
         caps=[(164.10, "As the timer runs out,"), (166.78, "it's going to check."),
               (168.10, "And oh no: it's unable to verify.")]),
    # the reveal (owner, 01:3x: "don't cut that out"): continuous source between C11 and C12, his words verbatim
    dict(id="C11R", name="Reveal: a different medicine in the bottle", src=(170.20, 173.30), fx="push", join=("cut", CUT_D),
         caps=[(170.34, "Because guess what,"), (171.32, "I put morphine in here instead of aspirin.")]),
    dict(id="C12", name="Close: swallow the right pills", src=(173.30, 179.20), fx="push", join=("cut", CUT_D), seated=True,
         caps=[(174.04, "So watch out."), (176.76, "Please swallow the right pills."), (178.14, "Thank you.")]),
]
END_JOIN = ("fadeblack", 0.45)
PUSH = 0.04        # slow push-in over each cut (≤ 6 %)
HOOK_PUSH = 0.06   # the hardware shot
MUSIC_GAIN = 0.24  # v2's 0.34 minus 3 dB; ducked under the voice
WHOOSH_GAIN = 0.12 # one soft whoosh per card entry
CAP_MV = 300       # caption block bottom at y=1620
CAP_MV_HIGH = 800  # seated cuts (laptop screen in the lower third): bottom at y=1120, over his shirt, above the cards

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
    return round(c["out"] + (src - c["src"][0]), 3)
def cut_end(i):  # out time where cut i stops being the main picture
    c = CUTS[i]; nxt = CUTS[i + 1]["join"][1] if i + 1 < len(CUTS) else END_JOIN[1]
    return round(c["out"] + c["dur"] - nxt, 3)

# words cut off at a cut boundary (printed so the cut list can be fixed)
for c in CUTS:
    for w in WORDS:
        for edge in c["src"]:
            if w["start"] < edge < w["end"] - 0.05:
                print(f"WARN {c['id']}: '{w['word'].strip()}' ({w['start']:.2f}–{w['end']:.2f}) straddles {edge}")

# ── caption phrases on real onsets ────────────────────────────────────────────────────────────────
PHRASES, PHRASE_HIGH = [], []  # (out start, out end, text); caption sits high (seated cut)
for i, c in enumerate(CUTS):
    caps = [(e[0], e[1], e[2] if len(e) > 2 else e[1].split()[0]) for e in c["caps"]]  # (approx, text, anchor word)
    srcs = [onset(anchor, approx) for approx, _, anchor in caps]
    hold = c["out"] + c["dur"] if i == len(CUTS) - 1 else cut_end(i)  # the last line may run into the dip to black
    for k, ((approx, text, _), s0) in enumerate(zip(caps, srcs)):
        nxt = srcs[k + 1] if k + 1 < len(srcs) else c["src"][1]
        e = word_end(text.split()[-1], s0, nxt + 0.01)
        s1 = min(nxt, (e if e else nxt) + 0.45)
        a, b = max(c["out"], to_out(c["id"], s0)), min(hold, to_out(c["id"], s1))
        b = max(b, min(a + 0.9, to_out(c["id"], nxt), hold))
        PHRASES.append((a, b, text)); PHRASE_HIGH.append(bool(c.get("seated")))

# ── cards (lower-third: 2-px purple rule + tracked caps label), all on cue-word onsets ─────────────
# card(cut, approx src, cue word, label, until=(cut, src) | None → until the next card in the slot)
def at(cid, approx, word): return to_out(cid, onset(word, approx))
CARDS = [
    (at("C6", 70.22, "3D"), "THE STATION · 3D-PRINTED CHAMBER"),
    (at("C6", 73.24, "water"), "03 · WATER TO THE MARK"),
    (at("C7", 83.30, "push"), "04 · ADD THE TABLET"),
    (at("C8", 107.40, "countdown"), "05 · DISSOLVE AND MEASURE"),
    (at("C9", 115.04, "Arduino"), "ARDUINO UNO Q · MAIN BOARD"),
    (at("C9", 119.04, "red"), "RED · BLUE · WHITE LIGHT + PHOTORESISTOR"),
    (at("C10", 129.84, "three"), "THREE COLOURS · ONE MEASUREMENT"),
]
CARDS_C5 = [(at("C5", 57.04, "prescription"), "01 · ENTER THE PRESCRIPTION"),
            (at("C5", 61.94, "looks"), "02 · WHAT THE TABLET LOOKS LIKE")]
CARDS = sorted(CARDS_C5 + CARDS)
CARD_STOPS = {  # a card holds until the next card, or until its cut ends if that comes first
    "default": [cut_end(i) for i in range(len(CUTS))]}
# the problem, as one stacked list built in time with his words (held to the end of C4)
LIST_HEAD = (at("C2", 12.88, "FDA"), "HOW A PILL REACHES YOU")
LIST = [(at("C2", 12.88, "FDA"), "01 · FDA REVIEW"),
        (at("C3", 15.58, "several"), "02 · CHECKED AGAIN, SEVERAL TIMES"),
        (at("C3", 18.06, "pharmacy"), "03 · THE PHARMACY SHELF"),
        (at("C4", 28.66, "final"), "04 · THE LAST STEP CAN FAIL")]
LIST_END = cut_end(3)
# the three answers, a restrained list with one swatch each: shown on "check", "Unable to verify" lifts on "unable"
ANS_HEAD = (at("C11", 167.10, "check"), "06 · THE ANSWER")
ANSWERS = [("Passed the screen", "&H00559E2E&"), ("Needs lab testing", "&H00048ED9&"), ("Unable to verify", "&H008A8A8A&")]
ANS_LIFT = at("C11", 169.30, "unable")
ANS_END = at("C11R", 170.34, "because")  # the answers give way to the reveal card on "because"
REVEAL = at("C11R", 170.34, "because")
REVEAL_END = cut_end([c["id"] for c in CUTS].index("C11R")) + 1.2  # held into "So watch out"
REVEAL_TXT = ("THE REVEAL", "A different tablet in the Aspirin 81 bottle", "no match, no pass: Unable to verify")
HOOK_TITLE = at("C1", 45.58, "pill")

# ── captions.ass ──────────────────────────────────────────────────────────────────────────────────
PURPLE, WHITE, BLACK = "&H00FF5C7C&", "&H00FFFFFF&", "&H00000000&"
def ass_t(x):
    x = max(0.0, x); cs = int(x * 100 + 1e-6)  # floor to the centisecond: a cue never starts after its onset
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"
def wrap2(text, n=34):
    if len(text) <= n:
        return text
    best = min((abs(len(text[:m]) - len(text[m + 1:])), m) for m in range(len(text)) if text[m] == " ")[1]
    return text[:best] + r"\N" + text[best + 1:]
ev = []
def dlg(layer, a, b, style, tags, text, ml=0, mr=0, mv=0):
    ev.append(f"Dialogue: {layer},{ass_t(a)},{ass_t(b)},{style},,{ml},{mr},{mv},,{{{tags}}}{text}")
def soft(layer, a, b, style, tags, text, ml=0, mr=0, mv=0, dx=0, dy=3):
    """Crisp text over a blurred shadow copy (libass blurs the fill when there is no outline, so the shadow is a layer)."""
    sh = tags
    for m in re.finditer(r"\\(pos|move)\(([^)]*)\)", tags):
        v = [float(x) for x in m.group(2).split(",")]
        v[0] += dx; v[1] += dy
        if m.group(1) == "move":
            v[2] += dx; v[3] += dy
        sh = sh.replace(m.group(0), f"\\{m.group(1)}(" + ",".join(f"{x:g}" for x in v) + ")")
    if ml or mr or mv:  # margin-positioned (captions): shift the shadow copy by margins
        dlg(layer, a, b, style, sh + rf"\1c{BLACK}\1a&H60&\blur4", text, ml + dx, mr - dx, mv - dy)
    else:
        dlg(layer, a, b, style, sh + rf"\1c{BLACK}\1a&H60&\blur4", text)
    dlg(layer + 1, a, b, style, tags, text, ml, mr, mv)

# captions: sentence/phrase level, no fade-in (visible on the onset frame), 80-ms fade-out. On the seated cuts the
# laptop screen fills the lower third, so their captions sit higher, over his dark shirt, just above the card stack.
for (a, b, text), high in zip(PHRASES, PHRASE_HIGH):
    soft(4, a, b, "Cap", r"\fad(0,80)", wrap2(text), ml=90, mr=90, mv=CAP_MV_HIGH if high else CAP_MV)
# hook title: clean serif, no halo; fades up and rises 24 px over 300 ms on the word "Pill"
soft(4, HOOK_TITLE, CUTS[0]["dur"] - 0.05, "Hook", r"\an5\move(540,524,540,500,0,300)\fad(300,200)", "Pill", dy=4)
RULE = r"{\p1}m 0 0 l 96 0 96 2 0 2{\p0}"
X0 = 80
PAD = 24
PANEL_A = "&H6B&"  # black at 58 % opacity
EM = {" ": 0.26, "·": 0.32, ",": 0.32, "+": 0.67, "-": 0.40, ".": 0.30, ":": 0.30}
def textw(s, size, spacing=0):
    """Estimated advance width (Inter averages: caps 0.69 em, lowercase 0.55 em, digits 0.61 em)."""
    return sum((EM.get(ch) or (0.69 if ch.isupper() else 0.61 if ch.isdigit() else 0.55)) * size + spacing for ch in s)
def rrect(w, h, r=12):
    k = r * 0.552
    return (rf"{{\p1}}m {r} 0 l {w - r} 0 b {w - r + k:.1f} 0 {w} {r - k:.1f} {w} {r} l {w} {h - r} "
            rf"b {w} {h - r + k:.1f} {w - r + k:.1f} {h} {w - r} {h} l {r} {h} b {r - k:.1f} {h} 0 {h - r + k:.1f} 0 {h - r} "
            rf"l 0 {r} b 0 {r - k:.1f} {r - k:.1f} 0 {r} 0{{\p0}}")
def panel(a, b, top, w, h, fin=200, fout=160):
    """Soft dark rounded panel (12-px corners, 24-px padding, slightly blurred edge) behind a card or list."""
    dlg(2, a, b, "Rule", rf"\an7\pos({X0 - PAD},{top})\fad({fin},{fout})\1c{BLACK}\1a{PANEL_A}\blur2",
        rrect(round(w + 2 * PAD), round(h)))
def card(a, b, y, label, style="Label", rule=True, with_panel=True):
    if with_panel:
        panel(a, b, y - PAD, max(96, textw(label, 30, 4)), 14 + 34 + 2 * PAD)
    if rule:
        dlg(3, a, b, "Rule", rf"\an7\move({X0 - 40},{y},{X0},{y},0,200)\fad(200,160)\1c{PURPLE}", RULE)
    soft(4, a, b, style, rf"\an7\move({X0 - 24},{y + 14},{X0},{y + 14},0,200)\fad(200,160)", label, dy=2)
# single-slot cards at the lower third (above the caption block)
for k, (a, label) in enumerate(CARDS):
    stop = min(x for x in CARD_STOPS["default"] if x > a + 0.3)
    b = min(stop, CARDS[k + 1][0]) if k + 1 < len(CARDS) else stop
    card(a, b, 1300, label)
# the problem list
# the problem list: one panel that grows a row at a time (fixed width so it doesn't jitter)
card(LIST_HEAD[0], LIST_END, 1150, LIST_HEAD[1], style="ListHead", with_panel=False)
lw = max(textw(l, 30, 4) for _, l in LIST)
for k, (a, label) in enumerate(LIST):
    nxt = LIST[k + 1][0] if k + 1 < len(LIST) else LIST_END
    panel(a, nxt, 1150 - PAD, lw, (1196 + 52 * k + 34) - 1150 + 2 * PAD, fin=200 if k == 0 else 0, fout=160 if k == len(LIST) - 1 else 0)
    soft(4, a, LIST_END, "Label", rf"\an7\move({X0 - 24},{1196 + 52 * k},{X0},{1196 + 52 * k},0,200)\fad(200,160)", label, dy=2)
# the answers
a0 = ANS_HEAD[0]
card(a0, ANS_END, 1150, ANS_HEAD[1], style="ListHead", with_panel=False)
panel(a0, ANS_END, 1150 - PAD, 40 + max(textw(t, 40) for t, _ in ANSWERS), (1200 + 62 * 2 + 48) - 1150 + 2 * PAD)
for k, (txt, col) in enumerate(ANSWERS):
    y = 1200 + 62 * k
    last = k == len(ANSWERS) - 1
    dim = r"\alpha&H70&" + (rf"\t({int((ANS_LIFT - a0) * 1000)},{int((ANS_LIFT - a0) * 1000) + 200},\alpha&H00&)" if last else "")
    dlg(3, a0, ANS_END, "Rule", rf"\an7\move({X0 - 24},{y + 12},{X0},{y + 12},0,200)\fad(200,160)\1c{col}" + dim,
        r"{\p1}m 0 0 l 22 0 22 22 0 22{\p0}")
    soft(4, a0, ANS_END, "Answer", rf"\an7\move({X0 + 16},{y},{X0 + 40},{y},0,200)\fad(200,160)" + dim, txt, dy=2)
# the reveal: header + line + sub on one panel, same place as the answers list
card(REVEAL, REVEAL_END, 1150, REVEAL_TXT[0], with_panel=False)
panel(REVEAL, REVEAL_END, 1150 - PAD, max(textw(REVEAL_TXT[1], 36), textw(REVEAL_TXT[2], 28)), (1258 + 34) - 1150 + 2 * PAD)
soft(4, REVEAL, REVEAL_END, "Reveal", rf"\an7\move({X0 - 24},{1208},{X0},{1208},0,200)\fad(200,160)", REVEAL_TXT[1], dy=2)
soft(4, REVEAL, REVEAL_END, "RevealSub", rf"\an7\move({X0 - 24},{1258},{X0},{1258},0,200)\fad(200,160)", REVEAL_TXT[2], dy=2)
# end card text (v2, unchanged)
for (dy_, txt, st, d0) in ((880, "The box measures. Pill explains.", "CardSerif", 0.4),
                           (1500, "pill-site.vercel.app", "Card", 1.2), (1590, "github.com/ShadowEsu/pill", "Card", 1.4)):
    dlg(1, END_START + d0, TOTAL, st, rf"\an5\pos(540,{dy_})\fad(150,0)\fscx90\fscy90\t(0,160,\fscx100\fscy100)", txt)

ASS = f"""[Script Info]
; generated by make_edit.py — do not hand-edit, edit make_edit.py and re-run
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter Medium,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,90,90,300,1
Style: Hook,Instrument Serif,200,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1
Style: Label,Inter SemiBold,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,0,0,7,0,0,0,1
Style: ListHead,Inter SemiBold,24,&H33FFFFFF,&H33FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,0,7,0,0,0,1
Style: Answer,Inter Medium,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Reveal,Inter Medium,36,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: RevealSub,Inter Medium,28,&H26FFFFFF,&H26FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Rule,Inter Medium,20,&H00FF5C7C,&H00FF5C7C,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: CardSerif,Instrument Serif,96,&H00111111,&H00111111,&H00E6EFF4,&H00000000,0,1,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Card,Inter,58,&H00111111,&H00111111,&H00E6EFF4,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
open(os.path.join(HERE, "captions.ass"), "w").write(ASS)

# ── build.sh ──────────────────────────────────────────────────────────────────────────────────────
inputs, fc = [], []
for c in CUTS:
    inputs.append(f'-ss {c["src"][0]:.3f} -t {c["dur"]:.3f} -i "$SRC"')
NC = len(CUTS)
iEND, iSIL, iMUS, iHW = NC, NC + 1, NC + 2, NC + 3
JC = CUTS[0]["jcut"]
inputs += [f'-f lavfi -t {END_DUR} -i "color=c=0xF4EFE6:s={W}x{H}:r={FPS}"',
           f'-f lavfi -t {END_DUR} -i "anullsrc=r=48000:cl=stereo"', '-i "$MUSIC"',
           f'-ss {JC["src"]:.3f} -t {(CUTS[0]["dur"] - JC["head"]) * JC["speed"]:.3f} -i "$SRC"']
GRADE = "eq=contrast=1.04:saturation=1.06:gamma=1.03"
BASE = f"fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1"
# Every segment is forced to its exact nominal length (clone-pad the last frame, then trim): the 31.58-fps VFR source
# otherwise loses a frame here and there, a later xfade offset lands past its input's end and the video stops early.
def fit(d): return f"tpad=stop_mode=clone:stop_duration=2,trim=duration={d:.3f},setpts=PTS-STARTPTS"
def afit(d): return f"apad=whole_dur={d:.3f},atrim=duration={d:.3f},asetpts=PTS-STARTPTS"
def push(p, d): return (f"scale=w='trunc({W}*(1+{p}*t/{d:.3f})/2)*2':h=-2:eval=frame:flags=bicubic,crop={W}:{H},setsar=1")
for i, c in enumerate(CUTS):
    if c["fx"] == "hook":  # him for `head` s, then the slowed hardware shot: slow push, subtle glow, soft vignette
        hw = round(c["dur"] - JC["head"], 3)
        fc.append(f"[{i}:v]trim=0:{JC['head']:.3f},setpts=PTS-STARTPTS,{BASE},{GRADE},format=yuv420p,{fit(JC['head'])},settb=1/{FPS}[hd]")
        fc.append(f"[{iHW}:v]setpts=(PTS-STARTPTS)/{JC['speed']},{BASE},{push(HOOK_PUSH, hw)},format=gbrp,split=2[h0][h1]")
        fc.append("[h1]gblur=sigma=28[hg]")
        fc.append("[h0][hg]blend=all_mode=screen:all_opacity=0.25,eq=contrast=1.06:saturation=1.12,"
                  f"vignette=angle=PI/4.5,format=yuv420p,{fit(hw)},settb=1/{FPS}[hw]")
        fc.append(f"[hd][hw]concat=n=2:v=1:a=0,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
    else:
        fc.append(f"[{i}:v]{BASE},{push(PUSH, c['dur'])},{GRADE},format=yuv420p,{fit(c['dur'])},settb=1/{FPS}[v{i}]")
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
# soft bottom scrim under captions and cards (one generated frame, looped), off for the end card
SCRIM_Y, SCRIM_H = 980, H - 980
fc.append(f"color=c=black:s={W}x{SCRIM_H}:r={FPS}:d=0.04,format=rgba,"
          f"geq=r='0':g='0':b='0':a='185*pow(min(Y/({SCRIM_H}*0.36),1),2)*(3-2*min(Y/({SCRIM_H}*0.36),1))',"
          f"loop=loop=-1:size=1:start=0,trim=duration={END_START:.3f},setpts=N/{FPS}/TB[scrim]")
fc.append(f"{pv}[scrim]overlay=x=0:y={SCRIM_Y}:eof_action=pass:format=auto[vs]")
vcur = "[vs]"
# end card (v2, unchanged): pill glyph + "one tablet · one cup · three answers" line, spring-in
END_POPS = [("pill", 330, 360, 420, 0.30, 3.7), ("pop-end", None, 1240, 120, 0.90, 3.1)]
pop_inputs = []
STK = {"pill": (600, 600, 212, 212), "pop-end": (1270, 194, 0, 0)}
for j, (name, x, y, h, st, dur) in enumerate(END_POPS):
    idx = iHW + 1 + j
    cw, ch, ox, oy = STK[name]
    wd = round(h * cw / ch / 2) * 2
    x = (W - wd) // 2 if x is None else x
    T0 = round(END_START + st, 3)
    hd = wd * ch / cw
    pop_inputs.append(f'-loop 1 -framerate {FPS} -t {dur:.2f} -i stickers/{name}.png')
    fc.append(f"[{idx}:v]format=rgba,crop={cw}:{ch}:{ox}:{oy},"
              f"scale=w='trunc({wd}*(1-0.45*exp(-t*8)*cos(t*22))/2)*2':h=-2:eval=frame:flags=bicubic,"
              f"fade=t=in:st=0:d=0.10:alpha=1,fade=t=out:st={dur - 0.18:.2f}:d=0.18:alpha=1,setpts=PTS-STARTPTS+{T0}/TB[p{j}]")
    fc.append(f"{vcur}[p{j}]overlay=x='{x}+({wd}-overlay_w)/2':y='{y}+({hd:.0f}-overlay_h)/2+40*exp(-(t-{T0})*10)*cos((t-{T0})*18)':"
              f"eval=frame:enable='between(t,{T0},{T0 + dur:.3f})':eof_action=pass[o{j}]")
    vcur = f"[o{j}]"
fc.append(f"{vcur}ass=captions.ass:fontsdir=fonts,format=yuv420p[vout]")
# audio: voice ladder + v2's score, 3 dB lower and ducked under the voice + a soft whoosh on each card entry; -16 LUFS
whooshes = sorted({round(a, 3) for a, _ in CARDS} | {round(LIST_HEAD[0], 3), round(a0, 3), round(REVEAL, 3)})
iWH = iHW + 1 + len(END_POPS)
fc.append(f"{pa}asplit=2[vo][vsc]")
fc.append(f"[{iMUS}:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
          f"volume={MUSIC_GAIN},afade=t=in:st=0:d=0.3,afade=t=out:st={TOTAL - 1.6:.2f}:d=1.6[mu]")
fc.append("[mu][vsc]sidechaincompress=threshold=0.05:ratio=3:attack=20:release=300:makeup=1[duck]")
fc.append(f"[{iWH}:a]aresample=48000,aformat=channel_layouts=stereo,volume={WHOOSH_GAIN},asplit={len(whooshes)}"
          + "".join(f"[w{m}]" for m in range(len(whooshes))))
for m, t0 in enumerate(whooshes):
    ms = int(round(max(0.0, t0 - 0.12) * 1000))  # the whoosh swells into the card's arrival
    fc.append(f"[w{m}]adelay={ms}|{ms}[wd{m}]")
fc.append("".join(f"[wd{m}]" for m in range(len(whooshes))) + f"amix=inputs={len(whooshes)}:normalize=0:duration=longest[sfx]")
fc.append("[vo][duck][sfx]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]")

graph = ";\n".join(fc)
open(os.path.join(HERE, "graph.txt"), "w").write(graph + "\n")
ins = " \\\n  ".join(inputs + pop_inputs + ["-i sfx/whoosh.wav"])
BUILD = f"""#!/usr/bin/env bash
# Pill pitch cut v3: {NC} cuts + {END_DUR:.0f}-s end card = {TOTAL:.2f} s, 1080x1920 (source is portrait: 1024x576 with -90° rotation).
# Generated by make_edit.py (edit the cut list there, re-run it, never hand-edit the graph).
#   bash pitch/video/edit/build.sh            full render  -> pitch/video/pill-pitch-90s.mp4
#   bash pitch/video/edit/build.sh --preview  seconds 0-10 -> pitch/video/pill-pitch-preview10.mp4
#   bash pitch/video/edit/build.sh --check    filtergraph dry run: 0.1 s to the null muxer, no encode
set -euo pipefail
cd "$(dirname "$0")"
SRC=../../video-raw/preston-pitch-raw.mp4
MUSIC=${{MUSIC:-work/music-fun.wav}}   # original score synthesised by make_music.py (116 BPM), no licence needed
FF=${{FFMPEG:-bin/ffmpeg}}          # needs libass (the 'ass' filter); Homebrew's ffmpeg 8.1.2 has none
if ! "$FF" -hide_banner -filters 2>/dev/null | grep ' ass ' >/dev/null; then
  echo "fetching a static ffmpeg with libass into bin/ (martin-riedl.de, macOS arm64)"
  mkdir -p bin && curl -sSfL -o bin/ffmpeg.zip https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
  (cd bin && unzip -o -q ffmpeg.zip && rm ffmpeg.zip && chmod +x ffmpeg && xattr -c ffmpeg 2>/dev/null || true)
  FF=bin/ffmpeg
fi
[ -f "$MUSIC" ] && [ -f sfx/whoosh.wav ] || {{ echo "missing $MUSIC or sfx/whoosh.wav: run .venv/bin/python make_music.py 90"; exit 1; }}
[ -f fonts/Inter-Medium.ttf ] && [ -f fonts/Inter-SemiBold.ttf ] || {{ echo "missing static Inter: run .venv/bin/python make_fonts.py"; exit 1; }}
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

# ── captions.srt (same phrases, for YouTube/Devpost upload) ─────────────────────────────────────────
def srt_t(x):
    ms = int(round(x * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
with open(os.path.join(HERE, "captions.srt"), "w") as f:
    for k, (a, b, text) in enumerate(PHRASES + [(END_START + 0.9, TOTAL, "pill-site.vercel.app")], 1):
        f.write(f"{k}\n{srt_t(a)} --> {srt_t(b)}\n{wrap2(text).replace(chr(92) + 'N', chr(10))}\n\n")

# ── table for EDIT-PLAN.md ─────────────────────────────────────────────────────────────────────────
def mmss(x): return f"{int(x // 60)}:{x % 60:05.2f}"
print("| # | Out in–out | Source in–out | Dur | Transition in | Captions (phrase starts on the first word's onset) |")
print("|---|---|---|---|---|---|")
for c in CUTS:
    j = "—" if not c["join"] else ("cut" if c["join"][0] == "cut" else f'dissolve {round(c["join"][1] * FPS)} fr')
    print(f'| {c["id"]} {c["name"]} | {mmss(c["out"])}–{mmss(c["out"] + c["dur"])} | {mmss(c["src"][0])}–{mmss(c["src"][1])} | '
          f'{c["dur"]:.2f} | {j} | ' + " / ".join(e[1] for e in c["caps"]) + " |")
print(f"| END card | {mmss(END_START)}–{mmss(TOTAL)} | generated | {END_DUR:.2f} | dip to black {END_JOIN[1]:.2f}s | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |")
print(f"TOTAL {TOTAL:.2f}s; {len(PHRASES)} caption phrases; {len(ev)} ASS events")
print("CARDS:", [(round(a, 2), l) for a, l in CARDS])
print("LIST:", [(round(a, 2), l) for a, l in LIST], "ANSWERS at", round(a0, 2), "lift", round(ANS_LIFT, 2), "TITLE", round(HOOK_TITLE, 2))
print("PHRASES:", [(round(a, 2), round(b, 2), t[:24]) for a, b, t in PHRASES])
