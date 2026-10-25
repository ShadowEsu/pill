# Pitch video edit plan (owner's night take, Palace of Fine Arts)

Source: `pitch/video-raw/preston-pitch-raw.mp4`: 179.42 s, h264 1024×576 with a −90° rotation side-data tag (displays **portrait 576×1024**), 600/19 fps (31.58), AAC 44.1 kHz stereo. Output: **1080×1920**, 30 fps, h264 CRF 20, AAC 192k, faststart, loudnorm −16 LUFS.

**Status: v2 rendered** to `pitch/video/pill-pitch-90s.mp4` (2026-10-25 01:03, commit 037d74d + this doc). v2 = owner's notes at 00:55: "it's not really payment, it's the process I explained; more animations; I can't hear music; more fun, more pop-ups". The 402 chip is gone; the pop-ups now tell his two processes; louder original score + SFX. Everything below is in `pitch/video/edit/`, all generated from one cut list in `make_edit.py`.

```
bash pitch/video/edit/build.sh --preview   # seconds 0–10 (hook glow + first dip + captions) → pitch/video/pill-pitch-preview10.mp4
bash pitch/video/edit/build.sh             # full 82.21 s → pitch/video/pill-pitch-90s.mp4
bash pitch/video/edit/build.sh --check     # graph dry run, 0.1 s to the null muxer (passed 2026-10-25 after the J-cut/morphine fixes)
```

Retime anything: edit `CUTS` / `POPS` in `make_edit.py`, run `python3 pitch/video/edit/make_edit.py` (rewrites `captions.ass`, `captions.srt`, `graph.txt`, `build.sh` and prints this table).

## Transcript
`pitch/video/TRANSCRIPT.md`: Gemini `gemini-3.5-flash-lite` (43 timed sentences), cross-checked against `gemini-2.5-flash`; they agree to ~0.5 s. Machine timestamps: scrub each cut point once in the preview before the full render.

## Cut list: 12 cuts + end card = 82.21 s (target ≤ 90 s)

Hook first; then the problem in his words; the app and the box in the order he filmed them (the app sets up the water step, so moving the box first would break his demo); the three answers on the result; end card.

| # | Out in–out | Source in–out | Dur | Transition in | Effect | Captions (verbatim, lightly trimmed) |
|---|---|---|---|---|---|---|
| C1 Hook: what we built is Pill (J-cut to hardware glow) | 0:00.00–0:04.80 | audio 0:44.30–0:49.10; video 0:44.30–0:45.20 (him), then **2:05.10–2:08.03 at 0.75×** (station) | 4.80 | — | glow on the hardware shot | What we built… it's PILL. / Pill is a hardware and software device |
| C2 Problem: why pills | 0:04.55–0:09.95 | 0:08.20–0:13.60 | 5.40 | fadewhite 0.25s | grade | Why are we talking about pills? / Pills go through a very intense process with the FDA. |
| C3 Problem: pharmacy shelf, aspirin bottle | 0:09.92–0:19.37 | 0:13.80–0:23.25 | 9.45 | cut | grade | They go through this process several times before a normal pharmacy, / like Walgreens, / I got this from Walgreens: aspirin 81. |
| C4 Problem: the final step can fail | 0:19.33–0:27.28 | 0:27.65–0:35.60 | 7.95 | cut | punch | In the final process, some of them could be malfunctioned, / and people could have bad intentions and put different drugs in here. |
| C5 App: prescription + what the pill looks like | 0:27.06–0:34.61 | 0:55.85–1:03.40 | 7.55 | whip (smoothleft 0.22s) | grade | First we put in the prescription of the drug, / and then what it looks like. |
| C6 Box: 3D-printed station, water to the mark | 0:34.58–0:43.83 | 1:08.35–1:17.60 | 9.25 | cut | grade | What we have in this beautifully 3D printed device: / we put some water in there, to a marking, just like so. |
| C7 Box: start, sample in | 0:43.80–0:47.35 | 1:20.05–1:23.60 | 3.55 | cut | grade | As I click start, I push this medicine in. |
| C8 App: countdown / live curve | 0:47.13–0:50.58 | 1:44.15–1:47.60 | 3.45 | whip (smoothup 0.22s) | grade | Now that it's ready, we go through the countdown. |
| C9 Box: the hardware | 0:50.54–1:02.79 | 1:52.30–2:04.55 | 12.25 | cut | grade | We use an Arduino UNO Q for the main head and CPU. / Red, blue and white lights, and a photoresistor at the back. |
| C10 Box: three colours, one measurement | 1:02.76–1:07.56 | 2:08.70–2:13.50 | 4.80 | cut | punch | We use these three colors to find a good measurement. |
| C11 Result: Unable to verify | 1:07.34–1:13.54 | 2:44.00–2:50.20 | 6.20 | whip (smoothleft 0.22s) | grade | As the timer runs out, it's going to check. / And oh no: UNABLE TO VERIFY. |
| C12 Close: swallow the right pills | 1:13.51–1:18.66 | 2:53.30–2:58.45 | 5.15 | cut | grade | So watch out. / Please swallow the right pills. / Thank you. |
| END card | 1:18.21–1:22.21 | generated | 4.00 | dip (fadeblack 0.45s) | pill + 402 chip | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |

"cut" = a one-frame xfade (keeps the whole chain one xfade/acrossfade ladder). Audio crossfades with the same duration at every join.

**Left out on purpose**
- 0:36–0:44, "1.3 million people get injured from the right prescriptions, as well as 98,000 Americans": it doesn't match its sources (StatsVerify, `pitch/stats-verify.md`: 1.3M is injuries from medication *errors*, WHO 2017; 98,000 is the top of a 44,000–98,000 range of deaths from *all* medical errors in US hospitals, IOM 1999). Cutting it is the honest fix. If the owner wants it back, add the cut with the corrected caption: "Medication errors injure approx. 1.3M people/yr in the US (WHO 2017). Medical errors in US hospitals: est. 44,000–98,000 deaths/yr (IOM 1999)."
- 0:02–0:08 "highest exports and imports…": the two models disagree on the words and there's no source for the claim.
- 2:50.38–2:52.41 "Because guess what, I put morphine in here instead of aspirin": cut (C11 ends after "unable to verify", C12 picks up at "So watch out"), caption deleted.
- Caption edits beyond trimming filler: "Arduino Uno" → "Arduino UNO Q" (the board on the station is an UNO Q); leading "So" dropped from the hook and C2 captions (reading speed); "Please swallow the right pills." starts at "Um" (2:55.74) so it gets 1.76 s.

**Owner checks in the preview**
1. C1 hardware shot, 2:05.10–2:08.03 slowed to 0.75× (frame duplication, no `minterpolate`): picked from inside his hardware walk-through ("since this is black and there are no lights inside…", the stretch C9/C10 don't use) without seeing frames. If the chamber and board don't fill the frame there, change `jcut.src` in `make_edit.py` (e.g. 75.0 for the chamber being lowered over the UNO Q at 1:15) and re-run it.
2. Gemini timestamps are ±0.5 s: if a word is clipped, nudge that cut's `src` in `make_edit.py`.

## Effects per cut
- **C1 J-cut + glow (the "This is Pill" moment):** his audio runs 0:44.30–0:49.10 throughout. Video: 0.9 s of him (graded) on "So what we built", then at "it's Pill" a straight cut to the station shot 2:05.10–2:08.03 slowed to 0.75× (`setpts=(PTS-STARTPTS)/0.75`, `fps=30`, no interpolation) = 3.9 s. On that shot: upscale to 2160×3840 → `zoompan` 1.00→1.30 over 3.3 s, then holds (slow push in), then `split` into three: base, a `gblur σ=34` copy tinted violet (`colorchannelmixer`) blended `screen` at 0.62 (the glow), and an `edgedetect` ink-line copy blended `multiply` at 0.35 (the cartoon outline); then `eq` contrast 1.14 / sat 1.30 and `vignette PI/3.2` (focus). No ring on the hook (the glow, zoom and title carry it); the serif-italic **"Pill"** title (Instrument Serif, violet halo + paper outline, −4° tilt) pops 40→118→100 % on the cut at 0.90 s. Exits with a 0.25 s dip to white.
- **grade** (under every cut's motion): `eq` contrast 1.05, saturation 1.10, gamma 1.04 (night footage lift).
- **punch** (C4, C7, C10): static 8 % punch-in, the "zoom cut" on the line that matters.
- **Pop-ups v2** (`stickers/pop-*.png` from `render_pops.mjs`, cropped to content; each springs in from 55 % scale with a damped overshoot and a 40-px drop, fades out, and plays a pop): **supply-chain process** stacked over the laptop below the captions, each staying to the end of C4: "✓ FDA process" @0:06.95 · "✓ Checked again… and again" @0:10.62 · "✓ Pharmacy shelf" @0:14.72 · amber "? The last step can fail" @0:19.48 · amber "! Wrong drug inside?" @0:23.08 (his words: "some of them could be malfunctioned… put different drugs in here") · **Pill process tracker** at the top: "Step 1 of 6 · Prescription" @0:27.21 → 2 What it looks like → 3 Water to the line → 4 Tablet in → 5 Countdown (held through the hardware) → 6 The answer @1:11.46 · extras: 🤔 at "why pills", "3D-printed ✨", 💧, 👀, ⏱️, "red · blue · white" light dots, "3 lights → 1 reading", the three answers (kept), 😬 at "oh no", pill at "swallow the right pills". Removed: "The box measures." / "Pill explains." chips over C5 (the line stays on the end card) and the "402 Payment Required" chip.
- **Motion v2:** `push` = slow 1.00→1.06 push-in on every talking cut; `punch` on C4, C7, C10; C11 `shake` = 0.5-s decaying shake + 0.12-s white flash at "oh no".
- **Captions** (`captions.ass`, libass, burned in last): 2–3-word groups, centred at y=1150 (inside the Meta/TikTok safe area), Inter Bold 86 px ink on a paper sticker outline (13 px) with a soft shadow; each group pops in 82→106→100 %; the spoken word flips to white ink on a violet fill and pops to 116 % for 180 ms, then returns to ink-on-paper. "PILL" and "UNABLE TO VERIFY" switch to Instrument Serif Italic. Colour only in fills; words are black or white.

## Music + SFX (v2)
`make_music.py` synthesises an original upbeat score, `work/music-fun.wav` (116 BPM, F–C–Dm–Bb: kick, clap, hats, bass, off-beat pluck chords, bell hook every other bar; no licence or attribution needed because nothing is sampled), plus `sfx/{pop,whoosh,ding,uhoh}.wav`. Run with the local venv: `uv venv -p 3.11 .venv && uv pip install -p .venv/bin/python numpy && .venv/bin/python make_music.py 90` (both outputs are gitignored, regenerate on another machine).
- Mix: score at gain 0.34 (≈ −23 LUFS before the mix), light duck under his voice (`sidechaincompress` threshold 0.05, ratio 3, 20/300 ms), 0.3-s fade-in, 1.6-s fade-out; pop on every sticker, whoosh before each whip / fadewhite, uh-oh on "oh no", ding on the end card; `loudnorm I=-16`.
- Measured on the v2 render: integrated −15.6 LUFS; end card (score + ding, no voice) −18.4 LUFS vs −16 LUFS in speech windows, so the score is plainly audible in every gap and sits roughly 7–10 dB under the voice.

## End card (1:18.21–1:22.21, 4 s)
Paper background `#F4EFE6` · pill glyph · "The box measures. Pill explains." (Instrument Serif Italic 96) · chip "① tablet · one cup · three answers" with a ding · **pill-site.vercel.app** · **github.com/ShadowEsu/pill** (Inter Bold 58).

## Assets (`pitch/video/edit/`)
- `make_edit.py`: the one source of truth (cut list, captions, pop-ups) → generates the four files below
- `build.sh` (`--preview` 0–10 s, `--check` dry run) and `graph.txt` (the filter_complex: 12 cut inputs + the hook's hardware input via `-ss/-t`, J-cut concat + glow chain, xfade/acrossfade ladder, 11 overlays with `enable='between(t,…)'`, `ass` burn-in, ducked score, loudnorm)
- `captions.ass` (75 word-pop events + hook title + end card text), `captions.srt` (24 sentence cues for YouTube/Devpost upload)
- `fonts/`: Inter (variable) and Instrument Serif Regular + Italic TTFs from github.com/google/fonts (OFL)
- `stickers/`: SVG sources + 1024² RGBA PNGs with transparent backgrounds, rendered by `render_stickers.mjs` (puppeteer-core from `pitch/film/node_modules`, `omitBackground`, the bundled fonts): pill, ring, arrow, the three answer chips, 402 chip, UNO Q chip, "The box measures." / "Pill explains."
- `transcribe.sh`: the Gemini Files API transcription script
- `bin/ffmpeg` (gitignored): static ffmpeg 9.0.2 with libass from ffmpeg.martin-riedl.de, because Homebrew's ffmpeg 8.1.2 has no `ass`/`subtitles` filter. `build.sh` fetches it again if it's missing.

Checks run (v2, 2026-10-25 01:03): `make_edit.py` + `build.sh --check` OK; 10-s preview frames viewed (hook glow, 🤔, FDA chip); full render 47 s → `pill-pitch-90s.mp4` (58.2 MB): video 82.20 s, audio 82.30 s, −15.6 LUFS; frames viewed at 23.3, 36.7, 43.3, 47.7, 56.7, 71.7, 72.2, 81.3 s (process stack, steps 3/5/6, 3D chip, timer, lights, answers + flash + 😬, end card without 402).

## Trend notes (sources opened 2026-10-24)
- Word-by-word captions with an active-word highlight are the dominant short-form look; keep 2–4 words on screen, never a full sentence (zellahq.com, "Best Caption Styles for Short-Form Video", rev. 2026-10-23: https://zellahq.com/blog/best-caption-styles-for-short-form-video/). → 2–3-word groups with a highlighted spoken word.
- Put captions big in the lower-middle third and clear of the platform UI: bottom ~250–320 px and right ~120 px on TikTok, bottom ~250 px and top ~108 px on Reels (same source). → y=1150 on a 1920 frame.
- Treat the caption style like a logo: one font, one highlight colour, one position, kept across clips (same source). → Inter + Instrument Serif, violet fill, fixed position, matching the site and deck.
- The single-word pop with a Bounce/ScaleUp entrance is the signature TikTok style; use 2–3 words per page and keep text out of the bottom 20 % (videocaptions.ai, "TikTok Captions and Subtitles", updated 2026-05-16: https://www.videocaptions.ai/captions-for/tiktok). → scale pops on every group and word.
- Open mid-action, not on a static frame, with bold animated text repeating the spoken hook and a quick zoom as a visual interrupt (StoryCut, "150 Viral TikTok Hooks", 2026-04-02: https://www.storycut.com/blog/tiktok-hook-generator-guide). → C1 cuts to the station at 0.9 s with the push-in and the "Pill" title, before any problem setup.
