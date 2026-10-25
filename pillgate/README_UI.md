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
- **Personal** (written for older people): home is a "Check my medicine" hero, your last check, the next dose, a big **Easy mode** button and a "how it works" strip. The nav is Home · Check · Medicines · Schedule · More. A result other than "Passed the screen" says to show it to a pharmacist.
- **Show mode (table demo)** (`localStorage.pillgate.show`, Settings, or `?show=1` / `?show=0` on any route; default off): a SHOW chip in the top bar and run bar; the Result page (every mode) and Personal home's last check show the product (label name + strength if the photo was read, else `SHOW_PRODUCT` at the top of `app.js`, "Aspirin 81 mg") at 100 % with "Passed the screen". The real curve, numbers, stage log, report and sources stay below, plus a line naming the measured result. Nothing is written to the backend; History shows the real results.
- **Easy mode** (`localStorage.pillgate.easy`, Settings or the Personal home button): the page, the Ask Pill sheet and the run bar at 125 % (CSS `zoom`), stronger ink and lines, and answers read aloud unless read-aloud was switched off.
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
| `#/settings` | Mode switch, Easy mode, sounds, read-aloud, reset local prefs (the schedule stays), server info | `GET /api/config` |
| `#/medicines` | Every drug read off a label, grouped by name + strength: latest result chip, recall chip, "Tested N times", Latest result, Add to my schedule | `GET /api/scans`, then `GET /api/scans/{id}` for the newest 40 |
| `#/schedule` | Today's doses as big rows with **I took it** / Undo and a log; add or remove medicines and times; reminders through the Notification API while a tab is open; **Add to calendar** downloads an `.ics` with a daily event and an alarm for each time. Stored only in this browser (`pillgate.schedule`, `pillgate.takelog`). | none |
| `#/station` | The real build (`static/photos/station-19.webp`, blue LED lit), a top view and a side view drawn to match it (LED box low on the wall with white/blue/red → beam → in-line sensor A0 across; 90° sensor A1 on the side wall; cup; lid with one hole), live A0/A1 counts, "What each part does", the 3 blueprints (`static/blueprints/`) and 4 photos in a tap-to-enlarge overlay. It also holds "How Pill fits together": one inline SVG drawn by `static/flow.js` from node/arrow tables (station → analysis.py → three answers → clinic policy agent → Coinbase CDP wallets, plus the x402 lane with the dashed paid 200) and the models table; facts from `pitch/FLOW-SPEC.md`, `#/station?at=flow` scrolls to it. Linked from Prepare, the Clinic Station tile and More. Measure's Clean-water and Dissolving scenes show a small top view with the sensor that step reads lit and its live count. | `/api/live` |
| `#/more` | History, Profiles, Atlas, Settings, Ask Pill and Change mode as tiles | none |

The guided run keeps going if you open another page during a measurement. `Run` lives outside the pages and is driven by the single global `/api/live` poll (2×/s), so `POST /api/run/stop` (once, guarded by `Run.stopping`) and `POST /api/scans` happen the moment `guide.stop` is true, whatever page is open. Every other page shows a sticky bar ("Run in progress · Dissolving 0:42 · ↩ back to the run"), then "Result ready · Open result →" if the scan was made while you were elsewhere (you are only taken to the result automatically while you're still in the check flow). Coming back to Measure re-attaches to the live phase (the 10-s countdown keeps its original start). After a reload, `sessionStorage.pillgate.run` plus `status.recording` let the same tab adopt its run again, and the photos come back from IndexedDB.

**Result, no reference:** when the label was read (`label.drug_name`) but no profile matched and the result is "Unable to verify", the stamp card says "We read **<drug> <strength>** from the label. Unable to verify means there is no reference for <drug> on this station yet: record 3 good runs to build one (Profiles →)".

**Ask Pill** is docked on every page except Welcome and the full Ask page. With a finished scan, typed questions go to `POST /api/scans/{latest done}/ask` (the sheet names the scan). The four help questions always answer from a fixed local list, as does everything when there is no finished scan; the assistant says it only knows this app.

## Checking it

- `cd app && .venv/bin/python -m pytest -q tests`
- Replay server: `PORT=8001 REPLAY_FILE=../runs/REAL_aspirin_first_test.csv MOCK_AI=1 .venv/bin/python server.py`
- Screenshots and the headless proof: `pillgate/dev-shots/ui/` (round 1) and `pillgate/dev-shots/ui2/` (round 2), which holds `<page>-390.png` and `<page>-1280.png`, `flow-*.png`, `flow-proof.json` and `pages-proof.json`.
