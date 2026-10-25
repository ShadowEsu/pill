# Film v2 ("At the table" Pill Gate segment): status, stopped 20:05 on the browser/render freeze

## Done (on disk)
- **Capture:** `work/gate.webm` (66 s, 390×844) and `work/gate.mp4` (all-intra copy). Recorded with `record-gate.mjs` against the replay server on :8001: Welcome → Bottle (`aspirin-label.jpg`) → Tablet (`aspirin-tablet.jpg`) → Measure (quick: clean-water check → tablet in → 24 s of dissolving) → Cancel before the 60-s auto stop (so no new scan and no model spend) → the existing result `scan_1024_191752_f0c2` (stamp: Unable to verify, no reference profile for aspirin). Step times are in `work/gate-marks.json`. `work/` is gitignored, so the capture is on this Mac only.
- **Voice-over:** `vo/13-gate.aiff` (12.3 s, Samantha, rate 175): "One tablet, one cup, sixty seconds. The board streams light readings once a second; the app decides. Three answers only: passed the screen, needs lab testing, or unable to verify." `vo/14-gate-short.aiff` for the 8-s version. Both gitignored like the other AIFFs.
- **Still layers** (from `gate-layers.html`): `work/gate/bg0–5.png` (paper, "Pill · AT THE TABLE", the chip "PILL GATE · STATION APP · REPLAY (NOT LIVE)", the step list Bottle / Tablet / Water / Dissolving / Result with the current step marked), `frame.png` (rounded phone corners), `cap0–2.png` (the three burned captions), `chip4/6/12.png` ("N× SPEED · REPLAY RUN" for the sped-up spans).
- **Soundtrack:** `work/music-v2.wav`, 179.65 s, one continuous piece. It has a tick at both segment cuts and at every scene change, moved to the new times.
- **Captions:** `pill-demo-v2.srt` (50 cues), on the v2 timeline.
- **Script:** `gate.mjs`. The film.html change: `renderAudio(opts)` now takes `duration` and `ticks`.

## The edit (in `gate.mjs`)
- The segment goes in at **0:21.95**, after the opening moment has finished (VO 02 ends at 21.89 s), and runs **25.0 s** to **0:46.95**.
- **v2 length is 2:59.65.** 2:38 plus 25 s would be 3:03, over the 3:00 cap, so three holds where nothing moves come out:
  - 100.65–101.55 (clinic rail, everything already drawn)
  - 121.60–122.35 (x402, the cap bar already full)
  - the last 1.7 s of the end title, which still holds 1.9 s after the last word
- **Segment cut (source s → speed):**

  | Step | Source s | Speed |
  |---|---|---|
  | Welcome | 0.4–2.6 | 1× |
  | Bottle | 3.7–7.3 | 1× |
  | Tablet | 8.2–11.2 | 1× |
  | Prepare | 12.3–13.7 | 1× |
  | Clean water | 14.3–25.0 | 4× |
  | Tablet in | 25.2–27.4 | 1× |
  | Dissolving | 27.6–51.6 | 6× |
  | Result | 52.4–58.3 | 1× |

  The voice-over starts 8.9 s into the segment. Captions run at 30.85, 34.07 and 37.93 s, and the third holds to 46.65 s.
- **60-s cut, 59.15 s:**
  - the moment, 0–21.95
  - an 8-s segment: tablet in, then dissolving at 12×, then the result
  - the box
  - the release
  - the end title

## Remaining (ffmpeg only, no browser)
Run `node gate.mjs --stitch-only` from `pitch/film/`. It reuses the layers and `music-v2.wav`, skips `say` because the AIFFs exist, and writes:
- `work/seg.mp4`
- `work/seg8.mp4`
- `work/video-v2.mp4` (re-encodes 180 s at 1080p, preset medium: the longest step)
- `pill-demo-v2.mp4`
- `pill-demo-60s-v2.mp4`
- `pill-demo-v2.srt` (rewritten, same content)

Then:
- look at a contact sheet of the segment
- run `ffprobe` on both files
- commit
- post `pill-demo-v2.mp4` (about 17 MB expected, under 25 MB) with `tools/discord-bridge`, channel key `pitch`

## Not verified
- `gate.mjs` has never finished a run. It was killed during the first segment encode, after the bug that put the wrong numbers on the ffmpeg inputs was fixed. The overlay filtergraph, the v2 concat, the mix and the 60-s cut have not been checked with ffmpeg, only with `node --check`. `--srt-only` has run.
- No v2 frame has been looked at. The layer PNGs were rendered but not viewed.
