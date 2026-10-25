# Pitch video edit plan (owner's night take, Palace of Fine Arts)

Source: `pitch/video-raw/preston-pitch-raw.mp4`: 179.42 s, h264 1024×576 with a −90° rotation side-data tag (displays **portrait 576×1024**), 600/19 fps (31.58), AAC 44.1 kHz stereo. Output: **1080×1920**, 30 fps, h264 CRF 20, AAC 192k, faststart, loudnorm −14 LUFS.

**Status: prepared, NOT rendered** (quiet hours). Everything below is in `pitch/video/edit/`, all generated from one cut list in `make_edit.py`.

```
bash pitch/video/edit/build.sh --preview   # seconds 0–10 (hook glow + first dip + captions) → pitch/video/pill-pitch-preview10.mp4
bash pitch/video/edit/build.sh             # full 85.39 s → pitch/video/pill-pitch-90s.mp4
bash pitch/video/edit/build.sh --check     # graph dry run, 0.1 s to the null muxer (already passed 2026-10-24 23:57)
```

Retime anything: edit `CUTS` / `POPS` in `make_edit.py`, run `python3 pitch/video/edit/make_edit.py` (rewrites `captions.ass`, `captions.srt`, `graph.txt`, `build.sh` and prints this table).

## Transcript
`pitch/video/TRANSCRIPT.md`: Gemini `gemini-3.5-flash-lite` (43 timed sentences), cross-checked against `gemini-2.5-flash`; they agree to ~0.5 s. Machine timestamps: scrub each cut point once in the preview before the full render.

## Cut list: 11 cuts + end card = 85.39 s (target ≤ 90 s)

Hook first; then the problem in his words; the app and the box in the order he filmed them (the app sets up the water step, so moving the box first would break his demo); the three answers on the result; end card.

| # | Out in–out | Source in–out | Dur | Transition in | Effect | Captions (verbatim, lightly trimmed) |
|---|---|---|---|---|---|---|
| C1 Hook: what we built is Pill (hardware glow) | 0:00.00–0:04.80 | 0:44.30–0:49.10 | 4.80 | — | glow | So what we built… it's PILL. / Pill is a hardware and software device |
| C2 Problem: why pills | 0:04.55–0:09.95 | 0:08.20–0:13.60 | 5.40 | fadewhite 0.25s | grade | So why are we talking about pills? / Pills go through a very intense process with the FDA. |
| C3 Problem: pharmacy shelf, aspirin bottle | 0:09.92–0:19.37 | 0:13.80–0:23.25 | 9.45 | cut | grade | They go through this process several times before a normal pharmacy, / like Walgreens, / I got this from Walgreens: aspirin 81. |
| C4 Problem: the final step can fail | 0:19.33–0:27.28 | 0:27.65–0:35.60 | 7.95 | cut | punch | In the final process, some of them could be malfunctioned, / and people could have bad intentions and put different drugs in here. |
| C5 App: prescription + what the pill looks like | 0:27.06–0:34.61 | 0:55.85–1:03.40 | 7.55 | whip (smoothleft 0.22s) | grade | First we put in the prescription of the drug, / and then what it looks like. |
| C6 Box: 3D-printed station, water to the mark | 0:34.58–0:43.83 | 1:08.35–1:17.60 | 9.25 | cut | grade | What we have in this beautifully 3D printed device: / we put some water in there, to a marking, just like so. |
| C7 Box: start, sample in | 0:43.80–0:47.35 | 1:20.05–1:23.60 | 3.55 | cut | grade | As I click start, I push this medicine in. |
| C8 App: countdown / live curve | 0:47.13–0:50.58 | 1:44.15–1:47.60 | 3.45 | whip (smoothup 0.22s) | grade | Now that it's ready, we go through the countdown. |
| C9 Box: the hardware | 0:50.54–1:02.79 | 1:52.30–2:04.55 | 12.25 | cut | grade | We use an Arduino UNO Q for the main head and CPU. / Red, blue and white lights, and a photoresistor at the back. |
| C10 Box: three colours, one measurement | 1:02.76–1:07.56 | 2:08.70–2:13.50 | 4.80 | cut | punch | We use these three colors to find a good measurement. |
| C11 Result: Unable to verify | 1:07.34–1:21.84 | 2:44.00–2:58.50 | 14.50 | whip (smoothleft 0.22s) | grade | As the timer runs out, it's going to check. / And oh no: UNABLE TO VERIFY. / Because I put morphine in here instead of aspirin. / So watch out. / Please swallow the right pills. / Thank you. |
| END card | 1:21.39–1:25.39 | generated | 4.00 | dip (fadeblack 0.45s) | pill + 402 chip | The box measures. Pill explains. / pill-site.vercel.app / github.com/ShadowEsu/pill |

"cut" = a one-frame xfade (keeps the whole chain one xfade/acrossfade ladder). Audio crossfades with the same duration at every join.

**Left out on purpose**
- 0:36–0:44, "1.3 million people get injured from the right prescriptions, as well as 98,000 Americans": it doesn't match its sources (StatsVerify, `pitch/stats-verify.md`: 1.3M is injuries from medication *errors*, WHO 2017; 98,000 is the top of a 44,000–98,000 range of deaths from *all* medical errors in US hospitals, IOM 1999). Cutting it is the honest fix. If the owner wants it back, add the cut with the corrected caption: "Medication errors injure approx. 1.3M people/yr in the US (WHO 2017). Medical errors in US hospitals: est. 44,000–98,000 deaths/yr (IOM 1999)."
- 0:02–0:08 "highest exports and imports…": the two models disagree on the words and there's no source for the claim.
- Caption edits beyond trimming filler: "Arduino Uno" → "Arduino UNO Q" (the board on the station is an UNO Q).

**Owner checks in the preview (I could not look at frames tonight: decoding stills counts as a render)**
1. C1 (0:44.3–0:49.1): is the station in frame while he says "what we built, it's Pill"? If he's on camera instead, swap C1's source to 1:08.35–1:12.80 (the "beautifully 3D printed device" shot) and keep the glow on it; the "PILL" title still lands.
2. C11 "I put morphine in here instead of aspirin": if the chamber held a stand-in, change that caption to what was actually used (e.g. "(demo: a different sample)") so the video doesn't claim a controlled substance was tested.
3. Gemini timestamps are ±0.5 s: if a word is clipped, nudge that cut's `src` in `make_edit.py`.

## Effects per cut
- **C1 glow (the "This is Pill" moment):** upscale to 2160×3840 → `zoompan` 1.00→1.30 over the first 3.3 s, then holds (slow push in), then `split` into three: base, a `gblur σ=34` copy tinted violet (`colorchannelmixer`) blended `screen` at 0.62 (the glow), and an `edgedetect` ink-line copy blended `multiply` at 0.35 (the cartoon outline); then `eq` contrast 1.14 / sat 1.30 and `vignette PI/3.2` (focus). Overlays: the hand-drawn ring sticker pops round the station at 0.15 s; the serif-italic **"Pill"** title (Instrument Serif, violet halo + paper outline, −4° tilt) pops 40→118→100 % at 0.75 s. Exits with a 0.25 s dip to white.
- **grade** (all other cuts): `eq` contrast 1.05, saturation 1.10, gamma 1.04 (night footage lift).
- **punch** (C4, C10): static 8 % punch-in, the "zoom cut" on the line that matters.
- **Pop-ups** (`stickers/*.png`, spring-in: 70 px drop with a damped bounce + 0.12 s alpha fade, 0.18 s fade out): ring @0:00.15 (C1) · pill glyph @0:16.02 at "aspirin 81" (C3) · "The box measures." @0:27.21 then violet "Pill explains." @0:28.01 (C5, the website) · arrow at the water mark @0:41.03 (C6) · ring round the live curve @0:47.28 (C8) · "UNO Q · 1 line/s" @0:50.84 (C9) · the three answers stacked at "Unable to verify": "Passed the screen" @1:11.44 and "Needs lab testing" @1:11.59 dimmed to 45 %, "Unable to verify" @1:11.74 full and larger (C11) · end card pill @1:21.69 and "402 Payment Required · TESTNET" @1:22.29.
- **Captions** (`captions.ass`, libass, burned in last): 2–3-word groups, centred at y=1150 (inside the Meta/TikTok safe area), Inter Bold 86 px ink on a paper sticker outline (13 px) with a soft shadow; each group pops in 82→106→100 %; the spoken word flips to white ink on a violet fill and pops to 116 % for 180 ms, then returns to ink-on-paper. "PILL" and "UNABLE TO VERIFY" switch to Instrument Serif Italic. Colour only in fills; words are black or white.

## Music
The film's own generated score, `pitch/film/work/music.wav` (158 s, 96 BPM soft pad, sine bass on the bar, quiet pluck: rendered by `pitch/film/film.html` `renderAudio()`; original, so no licence or attribution needed). It's used from 0:00. Its scene ticks (22.5, 39.5, 51.5, 62.5 s) are muted with a volume envelope.
- **Cue points:** 0:00 score in at full under the hook (0.4 s fade-in) · from ~0:00.8 ducked under his voice by `sidechaincompress` (threshold 0.025, ratio 9, attack 15 ms, release 380 ms) · lifts in his pauses (whips at 0:27.1, 0:47.1, 1:07.3) · 1:21.4 voice ends, score comes back up under the end card · 1:23.8 1.6 s fade-out.
- Voice: high-pass 90 Hz + light `afftdn` (outdoor wind/noise); final `loudnorm I=-14 TP=-1.5 LRA=11`.
- `pitch/film/work/` is untracked: the render needs this machine (or `MUSIC=/path/to.wav bash build.sh`).

## End card (1:21.39–1:25.39, 4 s)
Paper background `#F4EFE6` · pill glyph · "The box measures. Pill explains." (Instrument Serif Italic 96) · "402 Payment Required · TESTNET" chip (x402 on Base Sepolia testnet) · **pill-site.vercel.app** · **github.com/ShadowEsu/pill** (Inter Bold 58).

## Assets (`pitch/video/edit/`)
- `make_edit.py`: the one source of truth (cut list, captions, pop-ups) → generates the four files below
- `build.sh` (`--preview` 0–10 s, `--check` dry run) and `graph.txt` (the filter_complex: 11 `-ss/-t` inputs, glow chain, xfade/acrossfade ladder, 12 overlays with `enable='between(t,…)'`, `ass` burn-in, ducked score, loudnorm)
- `captions.ass` (80 word-pop events + hook title + end card text), `captions.srt` (25 sentence cues for YouTube/Devpost upload)
- `fonts/`: Inter (variable) and Instrument Serif Regular + Italic TTFs from github.com/google/fonts (OFL)
- `stickers/`: SVG sources + 1024² PNGs from `qlmanage` (alpha): pill, ring, arrow, the three answer chips, 402 chip, UNO Q chip, "The box measures." / "Pill explains."
- `transcribe.sh`: the Gemini Files API transcription script
- `bin/ffmpeg` (gitignored): static ffmpeg 9.0.2 with libass from ffmpeg.martin-riedl.de, because Homebrew's ffmpeg 8.1.2 has no `ass`/`subtitles` filter. `build.sh` fetches it again if it's missing.

Checks run tonight: `bash -n build.sh` OK; `build.sh --check` configured the full graph (libass 0.17.5 loaded all three fonts, "5 styles, 80 events") and pushed 3 frames through to the null muxer in 1.0 s; `caption_check.py captions.srt`: 25 cues, 5 flags (4 over 20 cps because he talks fast and the captions are verbatim, 1 cue at 0.72 s, "So watch out."). Not run: any encode.

## Trend notes (sources opened 2026-10-24)
- Word-by-word captions with an active-word highlight are the dominant short-form look; keep 2–4 words on screen, never a full sentence (zellahq.com, "Best Caption Styles for Short-Form Video", rev. 2026-10-23: https://zellahq.com/blog/best-caption-styles-for-short-form-video/). → 2–3-word groups with a highlighted spoken word.
- Put captions big in the lower-middle third and clear of the platform UI: bottom ~250–320 px and right ~120 px on TikTok, bottom ~250 px and top ~108 px on Reels (same source). → y=1150 on a 1920 frame.
- Treat the caption style like a logo: one font, one highlight colour, one position, kept across clips (same source). → Inter + Instrument Serif, violet fill, fixed position, matching the site and deck.
- The single-word pop with a Bounce/ScaleUp entrance is the signature TikTok style; use 2–3 words per page and keep text out of the bottom 20 % (videocaptions.ai, "TikTok Captions and Subtitles", updated 2026-05-16: https://www.videocaptions.ai/captions-for/tiktok). → scale pops on every group and word.
- Open mid-action, not on a static frame, with bold animated text repeating the spoken hook and a quick zoom as a visual interrupt (StoryCut, "150 Viral TikTok Hooks", 2026-04-02: https://www.storycut.com/blog/tiktok-hook-generator-guide). → C1 opens on the station with the push-in and the "Pill" title, before any problem setup.
