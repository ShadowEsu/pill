# Pill Gate app — rules for Claude (frontend work)

The teammate edits the **look and flow of the web app only**. The measurement code is finished and tested.

## You may edit
- `static/index.html`, `static/style.css`, `static/app.js`: all UI/UX, layout, copy, colours, animations.
- New files under `static/` (images, fonts, extra JS/CSS). Vendor libraries go in `static/vendor/` (keep their licences).

## Do NOT edit (backend: serial reading, maths, verdicts, AI pipeline)
`server.py`, `device.py`, `analysis.py`, `guide.py`, `evidence.py`, `store.py`, `simulate.py`, `tests/`, `data/profiles/`.
If a UI change seems to need a backend change, stop and ask the human instead of changing it.

## The contract the UI must keep using (see README.md "API")
- `GET /api/live` → `status` (device pill), `live` (seconds, samples, `curve` = {t, A_B, A_W, A_R, A_side (side-sensor cloudiness), A_specific, signal}),
  `guide` (`phase` "water" with `checks`, `ok`, `steady_s`, `needed`; or "dissolving" with `elapsed_s`, `stop`, `mode`, `quick_s`).
- `POST /api/run/start {mode: "quick"|"full"}` → water check begins. `POST /api/run/mark {name:"tablet_in"}` = Continue.
  `POST /api/run/stop {label, profile_id}` → `{run_id}`. The UI must call stop when `guide.stop` is true.
- `POST /api/run/upload` (form: csv_text, profile_id, mode) = paste fallback.
- `POST /api/scans` (form: run_id, profile_id, bottle, imprint) → `{scan_id}`; poll `GET /api/scans/{id}` until `done`.
- `POST /api/scans/{id}/ask`, `POST /api/scans/{id}/issue/draft`, `POST /api/issues`, `GET /api/atlas`, `GET /api/profiles`, `GET /api/runs`.

## Rules for wording (judges will read it)
- Results are exactly: "Passed the screen", "Needs lab testing", "Unable to verify". Never "authentic", "genuine", "safe", "certified".
- Keep the disclaimer that this is screening only and doesn't identify ingredients.
- Keep the "REPLAY (not live)" label when the server replays a file.

## How to try changes without the hardware
```
cd app
source .venv/bin/activate          # Mac; Windows: skip
REPLAY_FILE=../runs/SIM_good.csv python3 server.py     # Windows: set REPLAY_FILE=..\runs\SIM_good.csv  then  python server.py
```
Open http://localhost:8000 and refresh after each edit (static files are served fresh). Run `python3 -m pytest -q tests` before sharing; it must still pass.
