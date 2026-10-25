# Pill Gate web UI (how it's organised)

The Pill Gate UI is plain HTML, CSS and JavaScript with no build step. `python server.py` serves it as before, and the backend is unchanged (byte-identical to the `v16-import` tag outside `app/static/`). The UI carries the Pill design from the React app (`pill/web`) and the website: Instrument Serif titles, Inter body text, JetBrains Mono numbers and words in ink. Colour appears only in fills, lines and chips, and red only for "held" and recalls. Pages are light mode and go static under `prefers-reduced-motion`.

## Files (`app/static/`)

| File | What it holds |
|---|---|
| `index.html` | Only the shell: the ambient light, the sidebar or tab bar (`#nav`), the top bar with the device chip, and `<main id="view">`. Asset links carry `?v=…` so phones never keep an old copy. |
| `design.css` | Tokens and primitives ported from `pill/web/src/index.css`: `.card`, `.chip` (with `.wash-pass/lab/unable/held`), `.btn` (press scale and ripple), `.eyebrow`, `.title` (words rise in one at a time), `.num`, glyph draw-in, skeleton shimmer and the reduced-motion switch. |
| `style.css` | The frame (phone tab bar with a sliding indicator, desktop sidebar), the page header, and each page's pieces: viewfinder, phase rail, rings, stamp, stage log, chat, capsules, atlas and settings. |
| `app.js` | The router and every page. |
| `fonts/` | Local font files with `LICENSE.txt` (SIL OFL 1.1), plus a system-font fallback, so the laptop works offline. |
| `vendor/` | Chart.js 4.5.0 and 3d-force-graph 1.80.0 (MIT, unchanged). |

Inside `app.js`:
- helpers
- local prefs (`localStorage` `pillgate.mode`, `pillgate.sound`, `pillgate.speak`)
- glyphs (hand-drawn icons)
- `mountBinaryPill` (the capsule printed in 1s and 0s, ported from `BinaryPill.tsx`; it pauses off screen and draws one still frame under reduced motion)
- the device chip and the 2×/s `/api/live` poll
- the nav and the router
- `Run`, the guided-run state machine
- the pages

## Modes

Choose a mode on Welcome; it is stored in `localStorage.pillgate.mode`. The mode changes the words, the home page and the nav labels, never the API calls.

- **Clinic**: home is "Today's gate", with today's counts and the last five checks. A "Needs lab testing" result is also marked **held**, and the delivery is held.
- **Personal**: home is a "Check my medicine" hero, your last check and a "how it works" strip. A result other than "Passed the screen" says to show it to a pharmacist.
- **Check**: `#/` goes straight to the stepper.

Result strings are always exactly "Passed the screen", "Needs lab testing" or "Unable to verify". The device chip shows `REPLAY (not live) · <file>` whenever `status.mode` starts with `replay`.

## Routes (hash routes; back/forward and deep links work)

| Route | Page | Calls |
|---|---|---|
| `#/welcome` | BinaryPill hero, the three mode cards, device chip | `/api/live` |
| `#/` | Home for the current mode | `GET /api/scans` |
| `#/check/bottle` | Viewfinder photo of the label, Skip, privacy line | (file kept in memory) |
| `#/check/tablet` | Viewfinder photo of one tablet, imprint guidance, Skip | (file kept in memory) |
| `#/check/measure` | Phase rail Prepare → Water → Tablet in → Dissolving → Result. Prepare has quick/full and a profile pick. Water shows the checks and a ring for `steady_s / needed`. Tablet in beeps and gives a 10-s countdown, then Continue. Dissolving shows an elapsed ring and the live Chart.js curve, with the 12 quick-mode checkpoints marked. There is a paste or saved-run fallback. | `GET /api/profiles`, `GET /api/runs`, `POST /api/run/start {mode}`, `POST /api/run/mark {name:"water_ok"}` then `{name:"tablet_in"}`, `POST /api/run/stop {label, profile_id}` as soon as `guide.stop` is true, `POST /api/run/upload`, `POST /api/scans` |
| `#/result/:scanId` | Stamp-style result with reasons and numbers; a live stage log while polling; the curve against the reference checkpoints; label and tablet fields; recall status; the report with numbered sources; links to Ask and Report an issue; Check another | `GET /api/scans/{id}` every 1 s until `done` |
| `#/ask/:scanId` | Chat grounded in the report, with suggestions, voice input (SpeechRecognition, on https or localhost only) and a read-aloud switch (speechSynthesis) | `POST /api/scans/{id}/ask` |
| `#/issue/:scanId` | Draft the report, edit it, then Submit (only on tap); "No reporter identity is stored." | `POST /api/scans/{id}/issue/draft`, `POST /api/issues` |
| `#/history` | Checks as capsules (open Result) and the runs list | `GET /api/scans`, `GET /api/runs` |
| `#/profiles` | Profile list (DEMO and SIMULATED labels shown exactly as the backend gives them), the reference builder (tick runs, choose what changes when it dissolves) and the calibration builder | `GET /api/profiles`, `GET /api/runs`, `POST /api/profiles/reference`, `POST /api/profiles/calibration` |
| `#/atlas` | 3D graph. The library loads on first open and the graph is destroyed when you leave, so no other page runs WebGL. | `GET /api/atlas` |
| `#/settings` | Mode switch, sounds, read-aloud, reset local prefs, server info | `GET /api/config` |

The guided run keeps going if you open another page during a measurement. `Run` lives outside the pages and is driven by the global `/api/live` poll, so the auto stop and the scan still happen.

## Checking it

- `cd app && .venv/bin/python -m pytest -q tests`
- Replay server: `PORT=8001 REPLAY_FILE=../runs/REAL_aspirin_first_test.csv MOCK_AI=1 .venv/bin/python server.py`
- Screenshots and the headless proof: `pillgate/dev-shots/ui/`, which holds `<page>-390.png` and `<page>-1280.png`, `flow-*.png`, `flow-proof.json` and `pages-proof.json`.
