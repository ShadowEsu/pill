# Pill Gate app — software guide

> Frontend-only changes: see `CLAUDE.md` for which files are safe to edit.

A working starter app for the optical pill tester. It runs on the laptop (or Pi) that the Arduino UNO Q is plugged into, and a phone on the same Wi‑Fi can open it in the browser.

**Working name:** "Pill Gate". Set `APP_NAME` to change it. Don't call it "Peel": that's the HackMIT 2026 project this one is inspired by, so cite it in the Devpost.

## What it does (three observations, one report)

| | What happens | Code |
|---|---|---|
| 1. Bottle | Photo → Claude reads drug, strength, NDC, lot, expiry, manufacturer. Personal details are refused in the prompt and scrubbed again in code. | `evidence.read_bottle` |
| 2. Tablet | Photo → Claude describes the imprint, colour and shape (it does not guess the drug). | `evidence.read_imprint` |
| 3. Dissolution | Live serial data → absorbance curves (blue, white, red), tablet-in detection, plateau, t80, % of dose (with a calibration) or a match against reference runs. | `analysis.py`, `device.py` |
| Evidence | RxNav name match, openFDA NDC directory, openFDA recall reports (exact lot match), Claude web search limited to regulator sites. | `evidence.py` |
| Report | A template report appears as soon as the database lookups finish; Claude then writes the final plain-language report, citing only numbered sources. | `evidence.claude_report` |
| Guardrail | Code checks the report against the stored records: adds a missed lot recall, removes unsupported recall claims, forces the headline to match the measured result, bans "authentic / genuine / certified / safe to take", and rebuilds every citation from stored records. | `evidence.guardrail` |
| Ask | A chat (with optional voice in Chrome) that answers only from this report. | `evidence.ask` |
| Report an issue | Drafts a report. Nothing is saved until the person taps Submit, and no reporter identity is stored. | `/api/issues` |
| Atlas | A 3D graph of medicines, lots, manufacturers, recalls and sellers, where each seller shows a count of reports. | `/api/atlas` |

The result is always one of **Passed the screen / Needs lab testing / Unable to verify**. It never says "authentic".

## Run it (5 minutes)

```bash
cd app
pip install -r requirements.txt            # Windows: py -m pip install -r requirements.txt
python server.py                           # auto-finds the Arduino; open http://localhost:8000
```

- **Choose the port:** `SERIAL_PORT=COM5 python server.py`. In Windows PowerShell, run `$env:SERIAL_PORT="COM5"` first.
- **No board?** `REPLAY_FILE=../runs/SIM_good.csv python server.py` replays a simulated run. The top-right pill then says **REPLAY (not live)**.
- **AI on:** set `ANTHROPIC_API_KEY=...` in the environment. Without it, the app runs in **mock mode**: the bottle and tablet photos are **not read**, the report is a template, and the app can't auto-match a profile, so pick the profile by hand on the Measure step. (`MOCK_LABEL=path.json` lets you supply a fake label for offline testing; it's still shown as mock.)
- **Optional:** `OPENFDA_API_KEY` (free, raises the daily limit), `CLAUDE_MODEL` (default `claude-sonnet-5-5`).
- **Close the Arduino IDE Serial Monitor first.** Only one program can hold the serial port.
- **Phone:** open `http://<laptop-IP>:8000`. The camera works. Voice input needs `localhost` or https, so on the phone people type and the answer can still be read aloud.
- **Tests:** `python -m pytest -q tests` runs 14 tests on simulated data, with no hardware or internet needed.

## Two test lengths

- **Quick demo (default): exactly 60 s after Continue.** Every run, references included, covers the same 60 s. The app compares the colour curve at 12 checkpoints (every 5 s) with the reference runs. It judges whether the tablet **starts** dissolving like a good one, not the final dose. **Reference runs must be recorded in quick mode too**, otherwise the result is "Unable to verify" with a mode-mismatch message. Change the length with `QUICK_S` (seconds).
- **Full test: 2–10 min.** Stops when the curve has been flat for 60 s. Use it for the slower, more complete measurement.

## The guided run (Measure step)

1. **Start.** The app checks the clean water. The lid must be closed (low room light), the LED light must reach the sensor, and readings must be steady for 10 s. If you have done a run before, it also compares with your last clean-water reading.
2. **Add the tablet.** The app beeps and asks you to drop the tablet, stir 5 circles with the stick and close the lid, **all within about 10 seconds**, then press **Continue** right away. The app finds when the lid opened from the dark readings of both sensors. It treats that moment as "tablet in" and ignores the lid-open seconds. If the lid stays open for more than 25 s, the run is marked "Unable to verify".
3. **Dissolving.** Quick demo: stops by itself after 60 s. Full test: stops when the curve has been flat for 60 s (never before 2 min, always by 10 min). Then it shows the result.

Why not a fixed time: official dissolution tests for ordinary tablets allow about 30–45 min in a stirred bath at 37 °C. That's too long for a demo, so the app waits for the light curve to flatten instead. You can change the timing with environment variables: `BLANK_STABLE_S` (10), `MIN_DISSOLVE_S` (120), `PLATEAU_WINDOW_S` (60), `MAX_DISSOLVE_S` (600). This logic is in `guide.py`.

## Make the profiles (how the app knows what "good" looks like)

When you build a reference, choose **what changes when it dissolves**:
- **Cloudiness, side sensor (recommended for white tablets like plain aspirin).** The side sensor (LDR B) sees more light as particles scatter it sideways. On the first real aspirin run this rose by about 0.29 (log units) against blank noise of 0.006, while the straight-through red light changed by only 0.035.
- **Colour**, for yellow tablets like riboflavin or B-complex. The app follows blue minus red. (Aspirin gave 0.008 here, about the noise level, which is correct: it doesn't colour the water.)
- **Cloudiness, straight-through red light.** This is a weaker option for white tablets. The cloudiness check is switched off, because the cloud is the signal.

**Profile matching.** With the API key, Claude reads the bottle (for example "Aspirin 325 mg") and the app picks the profile whose "label words" appear on it. **Simulated demo profiles are never auto-matched.** They're used only when picked by hand, and the result then says "Compared with a SIMULATED demo profile".

**Do a water-only control run once.** Use clean water, open the lid, stir 5 circles, close it, and press Continue, with no tablet. The purple side-sensor line should stay near 0. If it rises almost as much as with a tablet, room light or the sensor's light memory is causing it: shade LDR B with black tape or paper and keep the lid opening small. Compared with the aspirin profile, a water-only run should give "Needs lab testing (less cloudiness than expected)". That's also a good live demo of a tablet that doesn't dissolve.

1. **Reference profile.** This is the main mode for this hardware.
   - Record 3 or more runs of a known-good tablet, all under the same conditions.
   - Go to Profiles → tick the runs → Build reference.
   - A new check then passes if its time-to-80 % and final colour fall within the spread of those runs (at least ±25 % and ±20 %).
2. **Calibration profile.** This is optional and gives "% of labelled dose".
   - Record one 60-second run per standard of known concentration, including plain water at 0.
   - Go to Profiles → Build calibration.
   - It fits absorbance against mg/L and stores the slope, R² and detection limit (3 × blank noise / slope).
   - **Physics warning for riboflavin:** riboflavin absorbs blue very strongly (specific absorbance ≈ 328 per 1 % solution per cm at 444 nm, USP). In a 6.8 cm cup, a few mg/L already blocks most blue light, so a whole 25–100 mg tablet saturates the sensor, and the app correctly says "Unable to verify". To measure dose you would need to dilute a sample (for example 1 mL into 100 mL) or use a much narrower vial. For the demo, use **reference mode**.

`data/profiles/demo_simulated.json` is built from **simulated** riboflavin data so the app works out of the box. It is never auto-matched. `runs/REAL_aspirin_first_test.csv` is a real aspirin run, and `runs/SIM_aspirin.csv` is a simulated one; both can be used for replay.

## Files

```
app/
  server.py      FastAPI backend + pipeline (stages with timeouts; first report early, final report later)
  analysis.py    curve maths, quality gates, verdict  (python analysis.py run.csv profile.json)
  evidence.py    Claude vision / web search / report / ask, RxNav + openFDA lookups, guardrail
  guide.py       guided run: clean-water check and auto-stop rules
  device.py      background serial reader (or replay)
  store.py       SQLite document store (data/app.db)
  simulate.py    fake runs for development - label anything made with it as SIMULATED
  static/        the web app (index.html, app.js, style.css, vendor/ chart.js + 3d-force-graph, MIT)
  data/profiles  product profiles (JSON)
  tests/         pytest
```

## API (for the teammate)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/live` | device status + live curve of the current recording |
| POST | `/api/run/start`, `/api/run/mark` `{name:"tablet_in"}`, `/api/run/stop` `{label, profile_id}` | record a run |
| POST | `/api/run/upload` (form: `csv_text` or `file`) | paste fallback |
| POST | `/api/scans` (form: `run_id`, optional `bottle`, `imprint`, `profile_id`) → 202 `{scan_id}` | starts the pipeline |
| GET | `/api/scans/{id}` | poll: `stages`, `analysis`, `label`, `recall_status`, `overall`, `report` |
| POST | `/api/scans/{id}/ask` `{question, history}` | grounded Q&A |
| POST | `/api/scans/{id}/issue/draft`, `/api/issues` | issue report (submit only on tap) |
| GET | `/api/atlas`, `/api/profiles`, `/api/runs`, `/api/scans` | lists |
| POST | `/api/profiles/reference`, `/api/profiles/calibration` | build profiles |

## What was tested, and what wasn't

- **Tested here:**
  - The analysis on simulated runs: pass, half dose, nothing, cloudy, too short and no profile.
  - The whole web flow in a headless browser, with replayed data and mock AI.
  - The guardrail and the personal-data scrub.
  - The AI code paths against a fake Claude client.
  - The RxNav and openFDA query formats, checked against the live APIs (fetched separately, not from the app).
- **Not tested:**
  - Real Claude calls, because there was no API key here. The web-search tool is `web_search_20250305`; see Anthropic's web search tool docs.
  - The app's own network lookups on your machine.
  - The live UNO Q serial port.
  - Real tablets.
- **Ideas if there's time:**
  - Deepgram, or another voice API, for Ask.
  - An imprint database. NIH's Pillbox was retired, so you'd need an archived copy.
  - A nicer phone layout.
  - Running the server on the UNO Q's own Linux side.
