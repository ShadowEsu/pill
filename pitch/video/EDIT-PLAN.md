# Pitch video edit plan (owner's night take, Palace of Fine Arts)

Source: `pitch/video-raw/preston-pitch-raw.mp4`: 179.42 s, h264 1024×576 with a −90° rotation side-data tag (displays **portrait 576×1024**), 600/19 fps (31.58), AAC 44.1 kHz stereo; video and audio streams both start at 0.000 s (no A/V offset to compensate). Output: **1080×1920**, 30 fps, h264 CRF 20, AAC 192k, faststart, loudnorm −16 LUFS.

**Status: v3 rendered** to `pitch/video/pill-pitch-90s.mp4` (2026-10-25 01:19). v3 is the response to the owner's note at 01:1x: "it's a bit delayed, fix it; make it more professional with text, not like sticker text; overall better vid." Everything is in `pitch/video/edit/` and generated from one cut list in `make_edit.py`.

```
bash pitch/video/edit/build.sh --preview   # seconds 0–10 → pitch/video/pill-pitch-preview10.mp4
bash pitch/video/edit/build.sh             # full 83.40 s → pitch/video/pill-pitch-90s.mp4
bash pitch/video/edit/build.sh --check     # graph dry run, 0.1 s to the null muxer
```

Retime anything: edit `CUTS` / `CARDS` in `make_edit.py` and run `python3 pitch/video/edit/make_edit.py` (rewrites `captions.ass`, `captions.srt`, `graph.txt`, `build.sh`, prints the table below and warns about any word cut off at a cut boundary).

## Sync: what was late, and the fix
- **Measured** with whisper `small.en --word_timestamps True` on the raw audio (`asr/audio16k.json`). I checked whisper against an energy-onset detector (10-ms RMS) on five clean onsets after a pause; they agree to within 0.06 s: "So why" 8.58 vs 8.54, "Alrighty" 104.28 vs 104.33, "So as the timer" 164.08 vs 164.05, "So watch out" 174.04 vs 173.98, "So what we built" 44.50 vs 44.46.
- **Gemini sentence starts vs real onsets** (40 sentences matched): mean offset **+0.02 s** (median +0.04 s), so there was no constant delay to shift out. The scatter was the problem: mean |error| 0.26 s, ranging from −0.73 s ("So watch out", caption early) to +0.69 s ("because in the final process", caption late).
- **The real cause of the delay** was v2's word pops. `words_timed()` spread each sentence's words evenly by letter count, so they drifted inside the sentence. Measured against whisper on 170 words: 24 % popped more than 0.25 s late (worst +0.94 s), 36 % more than 0.25 s early, and 90 % were within 1.02 s. The pop-ups inherited the same sentence starts.
- **v3:** no word pops. Each caption phrase starts on the whisper onset of its first word (floored to the centisecond, no fade-in, so it is already visible on the onset frame). Every card starts on the onset of its cue word ("FDA", "several", "pharmacy", "final", "prescription", "looks", "3D", "water", "push", "countdown", "Arduino", "red", "three", "check", "unable"). The words on screen come from the Gemini transcript where whisper mishears ("aspirin 81", "main head").
- Checked in the preview: at the "Why" onset (out 4.41 s) the frame at 4.44 s already shows "Why are we talking about pills?" with his mouth on the word.

## Cut list: 12 cuts + end card = 83.40 s (≤ 90 s)

| # | Out in–out | Source in–out | Dur | Transition in | Captions (phrase starts on the first word's onset) |
|---|---|---|---|---|---|
| C1 Hook: what we built is Pill (J-cut to the hardware) | 0:00.00–0:04.28 | audio 0:44.30–0:48.58; video 0:44.30–0:45.20 (him), then 2:05.10 at 0.75× (station) | 4.28 | — | So what we built is Pill. / Pill is a hardware and software device. |
| C2 Problem: why pills | 0:04.01–0:09.41 | 0:08.20–0:13.60 | 5.40 | dissolve 8 fr | Why are we talking about pills? / Pills go through a very intense process / with the FDA, |
| C3 Problem: checked again, the pharmacy shelf | 0:09.38–0:18.83 | 0:13.80–0:23.25 | 9.45 | cut | they have to go through this process several times / before being checked out through a normal pharmacy, / like Walgreens. / I got this from Walgreens: it's an aspirin 81. |
| C4 Problem: the last step can fail | 0:18.80–0:26.75 | 0:27.65–0:35.60 | 7.95 | cut | In the final process, / some of them could be malfunctioned, / people could have bad intentions and put different drugs in here. |
| C5 App: the prescription, what the tablet looks like | 0:26.48–0:34.03 | 0:55.85–1:03.40 | 7.55 | dissolve 8 fr | First we put in the prescription of the drug, / and then we use it, / as well as what it looks like. |
| C6 Box: 3D-printed station, water to the mark | 0:34.00–0:43.25 | 1:08.35–1:17.60 | 9.25 | cut | What we have in this beautifully 3D-printed device: / we're going to put some water in there. / There's going to be a marking, just like so. |
| C7 Box: start, tablet in | 0:43.21–0:47.23 | 1:20.28–1:24.30 | 4.02 | cut | As I click start, / I push this medicine in. |
| C8 App: the countdown | 0:46.97–0:50.87 | 1:44.15–1:48.05 | 3.90 | dissolve 8 fr | Alrighty, now that it's ready, / we will go through the countdown. |
| C9 Box: the hardware | 0:50.83–1:03.08 | 1:52.30–2:04.55 | 12.25 | cut | As you see in this hardware, / we use an Arduino UNO Q for the main head and CPU. / It uses red, blue and white lights, / as well as a photoresistor at the back. |
| C10 Box: three colours, one measurement | 1:03.05–1:08.05 | 2:08.80–2:13.80 | 5.00 | cut | We use these three colours to find a good measurement. |
| C11 Result: Unable to verify | 1:07.78–1:13.98 | 2:44.00–2:50.20 | 6.20 | dissolve 8 fr | As the timer runs out, / it's going to check. / And oh no: it's unable to verify. |
| C12 Close: swallow the right pills | 1:13.95–1:19.85 | 2:53.30–2:59.20 | 5.90 | cut | So watch out. / Please swallow the right pills. / Thank you. |
| END card | 1:19.40–1:23.40 | generated | 4.00 | dip to black 0.45 s | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |

"cut" = a one-frame xfade (it keeps the whole chain one xfade/acrossfade ladder). The audio crossfades over the same duration at every join. I moved four boundaries off words whisper showed being clipped: C1 ends before "where" (48.58), C7 starts at "as I click" (80.28), C8 ends after "countdown" (108.05), C10 runs 128.80–133.80 so "here." finishes, and C12 runs to 179.20 so "Thank you." gets its full second.

**Left out on purpose**
- 0:36–0:44, "1.3 million people get injured from the right prescriptions, as well as 98,000 Americans": it doesn't match its sources (StatsVerify, `pitch/stats-verify.md`: 1.3M is injuries from medication *errors*, WHO 2017; 98,000 is the top of a 44,000–98,000 range of deaths from *all* medical errors in US hospitals, IOM 1999).
- 0:02–0:08 "highest exports and imports…": no source for the claim.
- 2:50.34–2:53.04 "because guess what, I put morphine in here instead of aspirin": cut, no caption.
- Caption trims, for reading speed only: "we're going to use" → "we use", "I'm going to push" → "I push", leading "So"/"And" dropped from some lines, "from what you see here" dropped from C10. Wording fix: "Arduino Uno" → "Arduino UNO Q" (the board on the station is an UNO Q).

## v3 style
- **Captions:** phrase level, white Inter Medium 48 px (a static instance cut from the variable font by `make_fonts.py`), at most 2 lines (balanced manual break at about 34 characters), no box, no outline, no per-word colour. The soft shadow is a separate blurred black copy (`\blur4`, 3 px down, about 60 % opacity), because libass would blur the fill itself if there is no outline. 80-ms fade-out, no fade-in. **Placement is fixed per cut:** on the seated cuts (C2, C3, C4, C12), where the laptop screen and its own text fill the lower third, captions sit high (MarginV 800, block bottom at y=1120), over his dark shirt and just above the card stack. Everywhere else they sit low (MarginV 300, bottom at y=1620).
- **Bottom scrim:** a soft black gradient from y=980 down, rising to 73 % opacity by about y=1310, under the captions and cards (it is generated once and looped; off for the end card). It keeps white text readable over the bright laptop screen that fills the lower third of his seated shots.
- **Lower-third cards** (they replace every v2 sticker and emoji): a 2-px brand-purple rule (96 px wide) over a tracked-caps label in Inter SemiBold 30 (+4 letter spacing), both sliding 24–40 px from the left with a 200-ms fade; one card at a time at y≈1300. Cards: 01 · ENTER THE PRESCRIPTION (on "prescription") · 02 · WHAT THE TABLET LOOKS LIKE ("looks") · THE STATION · 3D-PRINTED CHAMBER ("3D") · 03 · WATER TO THE MARK ("water") · 04 · ADD THE TABLET ("push") · 05 · DISSOLVE AND MEASURE ("countdown") · ARDUINO UNO Q · MAIN BOARD ("Arduino") · RED · BLUE · WHITE LIGHT + PHOTORESISTOR ("red") · THREE COLOURS · ONE MEASUREMENT ("three").
- **Problem list (C2–C4):** one stacked list in the same style. A small header, "HOW A PILL REACHES YOU", sits under the rule, then lines appear on his words: 01 · FDA REVIEW ("FDA" 0:08.69) · 02 · CHECKED AGAIN, SEVERAL TIMES ("several" 0:11.16) · 03 · THE PHARMACY SHELF ("pharmacy" 0:13.64) · 04 · THE LAST STEP CAN FAIL ("final" 0:19.81). It holds to the end of C4.
- **The three answers (C11):** header "06 · THE ANSWER" with the rule, then three rows, each with one small square swatch (green / amber / grey) and the verdict words exactly: Passed the screen · Needs lab testing · Unable to verify. They appear dimmed on "check" (1:10.88); "Unable to verify" lifts to full on "unable" (1:13.08) and the list holds into "So watch out".
- **Panels:** every card, the problem list and the answers list sit on a soft dark rounded panel: 12-px corners, black at 58 % opacity, 24-px padding, `\blur2` edge, fading with the card. The problem-list panel grows by one row each time a line appears, at a fixed width. White caps and the swatches stay readable over the bright laptop screen.
- **Hook:** "Pill" in Instrument Serif 200 px, white with the soft shadow, no halo. It fades up and rises 24 px over 300 ms on the spoken word "Pill" (1.28 s). The hardware shot gets the only glow: a σ=28 blur screen-blended at 25 %, a 6 % slow push and a soft vignette.
- **Motion:** every other cut has a slow 1.00→1.04 push-in and a light grade (contrast 1.04, saturation 1.06, gamma 1.03). Joins are straight cuts or 8-frame dissolves (C1→C2, C4→C5, C7→C8, C10→C11); the end card comes in on a 0.45-s dip to black. The v2 whips, punch-ins, shake and white flash are gone.

## Music + SFX
DEBATE's original score from `make_music.py`, `work/music-fun.wav` (116 BPM, synthesised, nothing sampled, no licence needed), at gain 0.24 (v2's 0.34 minus 3 dB). It ducks lightly under his voice (`sidechaincompress` threshold 0.05, ratio 3, 20/300 ms), with a 0.3-s fade-in and a 1.6-s fade-out. The only sound effect is a soft whoosh (gain 0.12) arriving 0.12 s before each card, the list header and the answers header (11 in total). The pop, uh-oh and ding are gone. Final `loudnorm I=-16:TP=-1.5:LRA=11`. Regenerate the score and SFX on another machine with `.venv/bin/python make_music.py 90` (both are gitignored).

## End card (1:19.40–1:23.40, 4 s): unchanged from v2
Paper background `#F4EFE6` · pill glyph · "The box measures. Pill explains." (Instrument Serif Italic 96) · "① tablet · one cup · three answers" line · **pill-site.vercel.app** · **github.com/ShadowEsu/pill**.

## Assets (`pitch/video/edit/`)
- `make_edit.py`: the one source of truth (cut list, caption phrases, cards, timing from `asr/audio16k.json`); it generates `captions.ass` (121 events), `captions.srt` (33 phrase cues plus the URL, for YouTube/Devpost upload), `graph.txt` and `build.sh`.
- `asr/audio16k.json`: whisper `small.en` word timestamps for the raw audio (from a 16-kHz mono WAV made with `ffmpeg -ac 1 -ar 16000`).
- `make_fonts.py`: cuts static `fonts/Inter-Medium.ttf` and `fonts/Inter-SemiBold.ttf` out of `Inter-Variable.ttf` (fonttools in `.venv`), because libass draws a variable font at its default instance. Other fonts: Inter (variable) and Instrument Serif Regular + Italic from github.com/google/fonts (OFL).
- `stickers/pill.png` and `stickers/pop-end.png` are used on the end card only. The other sticker PNGs and `render_pops.mjs` / `render_stickers.mjs` are v1/v2 leftovers that v3 doesn't use.
- `transcribe.sh`: the Gemini Files API transcription script (source of the caption wording).
- `bin/ffmpeg` (gitignored): static ffmpeg 9.0.2 with libass; `build.sh` fetches it if it's missing.

Checks run (v3, 2026-10-25 01:17–01:20; panels + per-cut caption placement re-rendered 01:23: video 83.40 s, audio 83.50 s, frames viewed at 21, 58.5 and 73.5 s): `bash -n build.sh` and `build.sh --check` OK. One 10-s preview, frames viewed at 1.5 s (hardware shot, serif "Pill", caption), 3 s, 7 s, 4.44 s (caption visible on the "Why" onset) and 9.6 s (problem list). Then one full render (59 s wall): `pill-pitch-90s.mp4`, 43.8 MB, video 83.40 s / 2502 frames, audio 83.50 s (the extra 0.1 s is AAC frame padding), integrated −16.1 LUFS, LRA 2.6 LU. Frames viewed at 20 s (full problem list + caption), 48 s (countdown caption), 72 s (answers list) and 82 s (end card). `caption_check.py --max-chars 34`: 4 cues over 20 characters/s (21–25), because the captions follow his fast speech.

## Trend notes (sources opened 2026-10-24)
- Word-by-word captions with an active-word highlight are the dominant creator look (zellahq.com, "Best Caption Styles for Short-Form Video", rev. 2026-10-23: https://zellahq.com/blog/best-caption-styles-for-short-form-video/). v3 drops it on purpose: the owner asked for a more professional, less sticker-like look, and word timing drifted.
- Keep captions clear of the platform UI: bottom ~250–320 px and right ~120 px on TikTok, bottom ~250 px and top ~108 px on Reels (same source). → caption block bottom at y=1620, MarginV 300.
- Treat the caption style like a logo: one font, one accent, one position (same source). → Inter + Instrument Serif, purple only on the rule, fixed position.
- Keep text out of the bottom 20 % on TikTok (videocaptions.ai, "TikTok Captions and Subtitles", updated 2026-05-16: https://www.videocaptions.ai/captions-for/tiktok). → captions end 300 px above the bottom edge.
- Open mid-action with on-screen text repeating the spoken hook (StoryCut, "150 Viral TikTok Hooks", 2026-04-02: https://www.storycut.com/blog/tiktok-hook-generator-guide). → C1 cuts to the station at 0.9 s and the "Pill" title lands on the spoken word.
