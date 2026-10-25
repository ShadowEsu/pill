# DEVPOST-ANSWERS fact-check (DevpostFactCheck, Sat 2026-10-24)

> **To DevpostHumanizer / DevpostWriter:** my tool set has no `write`, and bash redirects to `agent://` fail (read-only), so this file IS the hand-off. Ranked list: "Findings pass 1" below (must-fix first, exact replacement text included).

Abbreviations: DF = pitch/DEVPOST-FINAL.md · RV = pitch/REVIEW-2026-10-24.md · RS = ~/boss-handoff/agents/research/calhacks-pill-numbers-2026-10-24.md · PN = ~/calhacks-13/pitch-numbers-2026-10-24.md · TR = ~/boss-handoff/agents/research/calhacks-app-traction-2026-10-24.md · ARM = pillgate/app/README.md · RM = pillgate/roadmap.md · FW = pillgate/firmware/peel_firmware/peel_firmware.ino · PAY = pill/pay/README.md · RULES = pill/web/src/lib/rules.ts · SEC = pill/pay/test/security.test.mts · DB = pillgate/app/data/app.db (sqlite, read-only)

## Ledger

### A. Outside-world numbers (only these; keep the hedges)
| Claim (safe wording) | Source |
|---|---|
| "WHO estimates 1 in 10 medical products in low- and middle-income countries is substandard or falsified" (2017). Never "1 in 10 medicines are fake". | RS row 1a; DF:66 |
| 10.5 % failure rate (WHO 2017), write 10.5 % not 11 % | RS 1b |
| LSHTM model: 116,000 extra malaria deaths a year in sub-Saharan Africa *could* be caused, range 64,000–158,000 (central figure 116,000; never "158,000 deaths") | RS 1d; DF:66 |
| Edinburgh model: 72,000–169,000 children *may* die each year from pneumonia (substandard + falsified antibiotics) | RS 1e; PN #3 |
| Cough syrups "linked to more than 300 deaths in three countries, most of them children under five" (WHO, Jan 2023) — a liquid, Pill can't test it | RS 4g; DF:66; PN traps |
| WHO June 2024 alert: falsified Ozempic in Brazil, UK, US, regulated supply chain — injection pen, supply-chain example only | RS 4e; DF:70; RV #33 |
| US$30.5 billion a year spent on S&F products — quote the 2024 fact-sheet wording; do NOT say "LMICs spend" (unverified framing; PN #2 wording is weaker than RS) | RS 2c |
| PSI 7,152 pharmaceutical crime incidents in 2025 (counterfeit + diversion + theft; not "counterfeit incidents") | RS 3a |
| New USP-style dissolution tester typically $20,000–$100,000 (LabX marketplace estimate) | RS 6a; DF:68 |
| "Lab dissolution results typically take 7–10 business days" | RS 6b; DF:68 |
| GPHF Minilab EUR 4,720 for about 1,000 test runs, before reference standards (TLC kit, not a dissolution test) | RS 6c; DF:116 |
| Minilab ≤ €3 materials per run (GPHF); €25.85 per sample all-in (PMC9338985, not GPHF) | RS 6d; RV #29 |
| 17.9 % (2026 meta-analysis, Africa), 22.6 % (2024 review, 7,508 samples) | PN #6, #7 |
| UNODC "up to 267,000" deaths linked to S&F antimalarials (never "500,000 die from fake pills") | PN #5 + traps |
| Peel won HackMIT 2026 (RIT newsroom, The Tech) | TR §1.1 |
| TRACTION: the traction sheet lists plays and other companies' examples only. Pill has NO users, pilots, waitlist, signups, press or pharmacist feedback on record. Any traction claim = must-fix. | TR (whole file) |

### B. Station hardware (Pill Gate) as built
| Fact | Source |
|---|---|
| Arduino UNO Q, 3.3 V GPIO/analog, 12-bit ADC (0–4095); A0–A5 not 5 V tolerant | FW:15-17, :25, :67; RM:6 |
| A0 = photoresistor A, across the cup (transmitted); A1 = photoresistor B, 90° to beam (scattered) | FW:35-37, :73-74 |
| Divider: 10 kΩ on both in firmware comment; roadmap later suggests 10k/100k — resistor values unconfirmed (RV #19, conf 0.55). Safer: "a resistor divider" | FW:36-37; RM:54; RV #19 |
| LEDs wired on D5 blue, D6 white, D7 green, D8 red; active-low, one 330 Ω to the 5 V pin | FW:38-40; RM:6, :55 |
| LEDs SAMPLED each second: blue + white + red only (DEFAULT_LEDS 0x0B); green is wired in firmware but not used; photos show 3 LEDs (white, blue, red) | FW:30; RM:207; photos/station-19.jpg |
| Once a second: all LEDs off → dark reading on both sensors; then each LED in turn; one CSV line/s at 115200 baud; 128 ADC reads averaged per value; 180 ms LED settle | FW:8-12, :87-88 |
| CSV header `ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir`; `stir` always 0 | FW:45-46 |
| No motor/stirrer: cup stirred by hand with a wooden stick ("5 circles"); no thermistor: temperature typed in | FW:2-5, :28-29; RM:8, :172; ARM:47 |
| `pinMode()` on analog pins breaks analogRead on UNO Q core | FW:20; RM:227 |
| "verify failed in bank" after upload is normal on UNO Q | RM:195-198 |
| Firmware first written for classic Uno R3 (still has `BOARD_UNO_Q 0` = R3 path); roadmap v3 = UNO Q edition | FW:25-27; RM:6 |
| The firmware decides nothing; laptop app does curves/verdict | FW:12 |
| Chamber in photos: purple 3D-printed cylinder with a lid, side box with 3 LEDs, two photoresistor holders (opposite + 90°), clear plastic cup of water, UNO Q + breadboard. Repo CAD (`pillgate/cad/`) describes a black rectangular ~102×76×78 mm body — NOT the same shape/colour as the photo, so "printed from our OpenSCAD source" is unproven → keep `[FILL 8]` | photos/station-*.jpg; RM:262; DF:86 |
| Cup: roadmap 68 mm cup / ~62 mm tall default, fill ≈100–110 mL; analysis default 150 mL; "6.8 cm cup" used in the riboflavin calc. Don't state a volume unless the owner gives it | RM:60, :278, :422; ARM:73; RV #11 |
| One WHOLE tablet (riboflavin calc assumes a whole 25–100 mg tablet). NOT a quarter tablet, NOT 900 mL | ARM:73; RV #11 |
| Parts cost: "about $10 beyond the board" is UNSOURCED (RV #8; RM:425 "add up your real parts cost before quoting a number"); "$40 box" = unbuilt ESP32 design → both banned unless owner gives a number | RV #8 |

### C. Station software (pillgate/app)
| Fact | Source |
|---|---|
| Python, FastAPI, vanilla JS, SQLite doc store; files device.py, analysis.py, guide.py, evidence.py, store.py, simulate.py | ARM:101-113 |
| 14 pytest tests on simulated data, no hardware/internet (counted: 14 `def test_` in tests/test_analysis.py:13-79) | ARM:39; tests/test_analysis.py |
| Absorbance: T(t) = net(t)/net(blank), A = −log10 T; net = LED-on − dark; blank = last ~10 s of clear water before the tablet; LDR response exponent γ=0.7 is an assumption | analysis.py:12-13, :136, :236-251 |
| Colour-specific absorbance = A(blue) − A(red) (yellow tablets); cloudiness = side sensor log10(scatter/blank) | analysis.py:15-16, :257-265 |
| Quick mode exactly 60 s (12 checkpoints every 5 s vs reference runs); full mode 2–10 min, stops when flat for 60 s | guide.py:24-28; ARM:43-44, :51 |
| Clean-water check: lid closed, LED reaching sensor, steady 10 s | guide.py:24; ARM:49 |
| Lid open > 25 s → Unable to verify; lid opening (dark jump on both sensors) = tablet-in mark | analysis.py:351; ARM:50 |
| Reference profile = ≥3 runs of a known-good tablet; quick-mode pass = ≥80 % of 5 s checkpoints within tolerance (NOT t80 + final colour; that's full mode) | ARM:45, :62-64; RV #18 |
| Verdict words: Passed the screen / Needs lab testing / Unable to verify | ARM:22 |
| Riboflavin: specific absorbance ≈ 328 per 1 % solution per cm at 444 nm (USP); in a 6.8 cm cup a few mg/L blocks most blue → whole 25–100 mg tablet saturates → Unable to verify | ARM:73; RM:422 |
| First real aspirin run: side-sensor rise ≈ 0.29 (log units) vs blank noise 0.006; straight-through red changed only 0.035; colour channel 0.008 | ARM:57-58; file runs/REAL_aspirin_first_test.csv |
| NO aspirin reference profile exists (profiles dir: demo_simulated.json, demo_simulated_full.json, riboflavin_reference_TEMPLATE.json) → every real scan = Unable to verify | ls app/data/profiles; DB runs: reasons "No profile for this product." |
| Water-only control run: NOT run; README only says it "should give" Needs lab testing | ARM:63; RV #2 |
| Claude model: code default `claude-sonnet-5-5` (evidence.py:19) but evidence.py:72, :327 use forced `tool_choice`, which 5.5 rejects (HTTP 400, owner-reported) → station runs on `claude-sonnet-5` (run file `claude-sonnet-5-test_run_1024_191751_644e.csv`) | evidence.py:19,72,327; runs/; DF:132 |
| Scan `scan_1024_191752_f0c2` (19:17:52): Aspirin 325 mg, NDC 49483-331-10, Time-Cap Labs, Inc. (distributed by Prestige Brands, Inc.), imprint "ASPIRIN / A1", recall_status PRODUCT_HAS_RECALLS_OTHER_LOTS, 10 sources, overall UNABLE_TO_VERIFY, headline "Aspirin: Unable to verify" | DB docs kind=scan |
| Scan `scan_1024_195620_81ce` (19:56:20): same label/imprint/recall status, **9** sources (not 10), Unable to verify | DB docs kind=scan |
| A third scan `scan_1024_201206_39b8` (20:12:06): same, 10 sources, Unable to verify | DB |
| Lot field NULL in all scans (lot was not read) | DB |
| Guardrail: adds missed lot recall, removes unsupported recall claims, forces headline = measured result, bans authentic/genuine/certified/safe to take, rebuilds citations | ARM:18 |
| Lookups: RxNav, openFDA NDC directory, openFDA enforcement (exact lot), Claude web search limited to regulator sites | ARM:17; evidence.py:22 |
| Ask (voice in Chrome) answers only from the report; Report an issue saved only on Submit, no reporter identity; Atlas 3D graph | ARM:19-21 |
| Mock mode without API key (photos not read, template report) | ARM:35 |

### D. Clinic app (pill/web) — https://pill-app-delta.vercel.app
| Fact | Source |
|---|---|
| Vite 8 + React 19 + TypeScript | pill/web/package.json:14,24,25 |
| Seven rules in order: U1 no reference, U2 fault, U3 <30 s or unsettled scatter, N1 plateau below band, N2 90° glow did not rise, N3 above band, P1 pass | RULES:28-41 |
| Clinic verdict words: PASS / NEEDS LAB / UNABLE TO VERIFY | RULES:33-41 |
| Absorbance = log10(blank/now) | RULES:4 |
| Clause filter bans safe*, genuine*, fake*, counterfeit*, authentic*, verified, certified, guarantee*; falls back to template if > half dropped | RULES:51-57; PAY:173 |
| Demo curves are synthetic replays (B2-07, TM-02, B2-LID, AMX-01); week of history is fixture data (14 deliveries); none of its tx ids exist on chain; $480 / $1,240 deliveries are fixture data | DF:140-141, :190; PAY:313 |
| Gemini: label reading (`POST /api/label`, unreadable field = null), agentic checker `/api/check` (≤3 frames), follower assistant; default models gemini-3.1-pro-preview (+ customtools), fallbacks gemini-3.5-flash / -flash-lite / 3.1-flash-lite / 2.5-flash; free tier ≈20 calls/day per model (owner) | PAY:65-67, :169, :234 |

### E. Pay service (pill/pay)
| Fact | Source |
|---|---|
| Node 22+, Express 5, @x402/express + @x402/evm 2.28, @coinbase/cdp-sdk | pay/package.json:8,21-29; PAY:13 |
| `POST /verify` → 402, `amount:"50000"` = 0.05 USDC, Base Sepolia (eip155:84532), port 8402 | PAY:19-21, :42-50 |
| Three modes cdp / public-facilitator / simulated; each named in responses | PAY:28-36 |
| Escrow `/escrow/hold|release|refund` = SIMULATED (`moved:false`) without CDP key; "never reports a transfer that didn't happen" | PAY:53; DF:138 |
| Wallet names pill-clinic, pill-escrow, pill-supplier | PAY:7 |
| Caps: one delivery's value per hold, ≤ $2,000 per release, ≤ 1 USDC x402 spend per rolling 24 h | PAY:298-300 |
| Escrow scale ×0.0001 ($1,240 → 0.124 USDC) because faucet gives 1 USDC/claim | PAY:307 |
| Policy P1–P6; escrow clerk computes ceiling in code, model may only return ceiling or escalate | PAY:274-276 |
| `npm run test:policy`: 6 cases, last run Sat 2026-10-24 on `claude-sonnet-5-5`: P1 release, P2 hold, P3 escalate, P4 hold, P5 escalate, case 6 (SYSTEM OVERRIDE) escalate | PAY:278 |
| `npm run test:security`: 12 checks (SEC:50 ×4 upstreams :31-36, SEC:70 ×5 answers :57-63, SEC:76, :77, :80) — NOT 13 | SEC; RV #3 |
| Real `402` + facilitator verify step answered `invalid_exact_evm_insufficient_balance`; paid `200` PENDING (no CDP key; keyless faucet behind reCAPTCHA) | DF:96, :137 |
| `auth-capture` scheme ships in @x402/evm 2.28; public facilitator /supported lacks it on eip155:84532 | PAY:323-325 |
| Nessie: client built; NO NESSIE_KEY → `{mode:'unavailable'}`; live transfers only if [FILL 5] | PAY:170, :175; DF:139 |
| Skill `verdict-gated-escrow` (SKILL.md) | DF:90 |
| Money: SANDBOX (Nessie) / TESTNET (Base Sepolia). No real money anywhere | DF:142 |

### F. Other artifacts / links
| Fact | Source |
|---|---|
| Website https://pill-site.vercel.app ; clinic app https://pill-app-delta.vercel.app ; repo https://github.com/ShadowEsu/pill (PRIVATE until [FILL 1]) | DF:50-53, :12 |
| Demo film `pitch/film/pill-demo.mp4`, 2:38; it shows the paid 200 as PENDING and still has the old ESP32/$40/3-minute voice-over (RV #1) | DF:13; RV #1 |
| Figma deck 21 slides + plugin + PPTX import path (links = [FILL 4]) | DF:15; RV key |
| Event: Cal Hacks 13.0, Oct 23–25 2026 (Palace of Fine Arts — don't say Berkeley) | RM:3; RV #28 |
| Peel: only "Peel (HackMIT 2026), method only, no code; every line of our code was written this weekend" | brief; DF:124 |
| LED-as-sensor ref: Dietz, Yerazunis, Leigh, MERL 2003 | DF:124 |

### G. FILL list (must stay as `[FILL n: …]`)
FILL 1 repo public · FILL 2 YouTube link · FILL 3 team names · FILL 4 Figma links · FILL 5 Nessie live or untick · FILL 6 station reference profile (≥3 live runs) or "not yet recorded" · FILL 8 chamber (printed vs taped) · FILL 9 pharmacist conversation (or delete). There is no FILL 7.

### H. Physics (Beer–Lambert) — what is right
- A = ε·l·c: absorbance is proportional to concentration only at a FIXED path length l (same cup, same position) and for a dilute solution of something that absorbs the LED's colour. A = −log10(I/I0), where I0 is the light through the blank (clear water) and I the light through the cup now. In our code: A = −log10(net/net_blank) (analysis.py:13, :251).
- Blank/standard = the same cup of clear water just before the tablet goes in (analysis.py:236).
- The dissolution curve = absorbance vs time as the tablet dissolves (true for a coloured analyte, e.g. riboflavin on blue minus red).
- Caveats that must not be broken: (1) we do NOT measure nickel; the analogy is "the same law a school colorimetry lab uses". (2) A photoresistor is not linear in light (code assumes γ = 0.7, analysis.py:136), so our absorbance is approximate → "tracks", not "measures exactly". (3) Aspirin is colourless when dissolved: its signal is CLOUDINESS (light scattered sideways onto the 90° sensor), which is scattering, not Beer–Lambert absorption. Do not say the aspirin curve measures aspirin concentration via Beer–Lambert. (4) Riboflavin breaks Beer–Lambert in practice here: too much absorbance for the 6.8 cm path → saturation (that's the story of the weekend). (5) No % of dose / mg claim: no calibration was run.

## Findings pass 1 — `pitch/DEVPOST-ANSWERS.draft.md` (as of 20:40, 139 lines)
Counts: must-fix 6 · should-fix 7 · nit 5. Banned-word scan (safe/verified/authentic/genuine/certif/guarantee/fake/counterfeit/founder/CEO/Berkeley/university/visa/$40/three minutes/paddle/quarter/900 mL/$10/Aaron/Preston/Susanto): clean. Peel: only draft:29, allowed form. All `[FILL n]` ids used are real (1, 2, 4, 5, 6, 8, 9). Tagline counts check out (59, 57).

### MUST-FIX
M1. draft:43 — Beer–Lambert paragraph is physically incomplete and then misapplied. (a) Proportionality holds only at a fixed path length (same cup, same spot) and for something that absorbs the LED's colour. (b) It says "absorbance climbs with what has dissolved" and then cites the ASPIRIN numbers: dissolved aspirin is colourless; that 0.29 is SCATTER on the 90° sensor, not Beer–Lambert absorbance (ARM:57-58; analysis.py:257-265). Evidence: analysis.py:12-13 (A = −log10(net/net_blank)), :136 (LDR exponent is an assumption → "tracks", not "measures"). Replace the whole paragraph with:
"**The physics, in plain words:** it's a school colorimetry lab. For a fixed path length (same cup, same spot), absorbance is proportional to concentration: Beer–Lambert, A = εlc. Clear water is the blank. The in-line photoresistor reads how much light gets through, and absorbance is log(blank ÷ now), so for a coloured tablet absorbance climbs as it dissolves and absorbance against time is the dissolution curve. Every second an Arduino UNO Q takes a dark reading (all LEDs off, which cancels room light), then flashes blue, white and red. One photoresistor sits in line with the light (absorbance), one at 90° (scatter, i.e. cloudiness). A white tablet like aspirin doesn't colour the water, it clouds it: on our first aspirin run the 90° signal rose 0.29 against blank noise of 0.006, while the in-line red moved only 0.035. So for aspirin we follow the cloudiness curve instead. We're not measuring nickel, but it's the same law."

M2. draft:63 — "a 21-slide Figma deck, built by our own plugin" says the plugin ran. It has not run in real Figma: figma/RUN.md:16 ("Not yet run by anyone… only exercised against a stub Figma API"), figma/build-deck.mjs:716 / deck.html:667 ("Nobody has run it in real Figma yet"), figma/LINKS.md:5 ("[fill after running]"). Replace with:
"- **Design:** a 21-slide deck generated from the repo as one JSON file, plus a Figma plugin we wrote to draw it (tested against a stub Figma API) and a PPTX import path `[FILL 4: which path made the shared Figma deck]`."

M3. draft:80 — "10 numbered sources" for BOTH scans. DB (pillgate/app/data/app.db, docs kind=scan): scan_1024_191752_f0c2 → 10 sources; scan_1024_195620_81ce → 9 sources. Replace "; 10 numbered sources." with:
"; reports with 10 and 9 numbered sources."

M4. draft:132 (+ draft:124) — `photos/station/station-102.jpg` no longer exists. Since 20:38 the folder holds only station-17.jpg, station-171.jpg, station-19.jpg, station-191.jpg (station-08/081/10/102 were removed). Delete gallery row 5, renumber, and delete the "Leave out station-08.jpg, station-081.jpg and station-10.jpg…" sentence at draft:124 (the files are gone).

M5. draft:128, :131 — station-171.jpg (thumbnail) and station-17.jpg show, in the top-right corner, a handwritten paper with a surname ("…n Susanto") — a person's name in a public image (house rule: no names). station-19.jpg and station-191.jpg are clean. Replace row 1 with:
"| 1 (**thumbnail**) | `photos/station/station-19.jpg` | The station at our table: printed chamber, LED box, Arduino UNO Q. |"
and for 171/17 add: "Crop off the top-right corner (handwritten name on a paper) before uploading, or leave them out."
Also fix draft:139 thumbnail note accordingly.

M6. draft:117 — the 2:38 film contradicts the Devpost text. pitch/film/vo/vo.txt:5 (file 13:15, mp4 13:50): "Pill is a forty-dollar box. One quarter tablet, about three minutes… Riboflavin absorbs blue and glows green"; vo.txt:11 lists "the station hardware" as simulated/pending. RV #1 (P0). Add directly under the video link:
"  The video was cut on Saturday afternoon, before the UNO Q station was streaming, so it still shows our first design. The text and photos here are the station as built."

### SHOULD-FIX
S1. draft:25 — hedges dropped from RS 6a/6b. "a USP-style dissolution tester typically costs" → "a new USP-style dissolution tester typically costs"; "lab results typically take 7–10 business days" → "lab dissolution results typically take 7–10 business days".
S2. draft:59 — "in 10 kΩ dividers": resistor values unconfirmed (RV #19; roadmap.md:440 says 10 kΩ on LDR A and 100 kΩ on LDR B; guide.py:69 hints 100k/1M). Replace with "in resistor dividers from the 3V3 pin".
S3. draft:67, :69, :71 — times "Friday night into Saturday", "(Friday night)", "Saturday afternoon", "Saturday evening" have no source (git history starts Sat 18:23 import; roadmap schedule even plans riboflavin reference runs for Sat morning, roadmap.md:352). Sourced times: first real aspirin run file 17:39 (runs/REAL_aspirin_first_test.csv mtime); 19:15:38 claude-pipeline-test run; 19:17:52 scan f0c2. Either drop the time words (e.g. "**The vitamin that was too yellow to see through.**", "**The board that was a different board.**", "**The board went quiet.**") or let the owner confirm them.
S4. draft:55 — "is for our grandparents" adds an unsourced personal detail; DF:81 says "we designed it for grandparents". Replace with "Personal mode, in both apps, is designed for grandparents: …".
S5. draft:73 — "at 19:17 the first live scan went through": that scan ran on a REPLAY of the aspirin run (DF:132; pillgate/dev-shots/ui2/result-1280.png top bar "REPLAY (not live) · REAL_aspirin_first_test.csv"). Replace with "and at 19:17 the first scan with live Claude calls went through, on a replay of our aspirin run."
S6. draft:97 — "(16 member organisations in 2019–20)": number not in either numbers sheet (house rule); it is only in the traction sheet §3 (PMC9338985). Drop the parenthetical: "We want to ask the Difäm-EPN Minilab Network, who already screen medicines."
S7. draft:84 — "station hardware and one aspirin run are real": also true that two more aspirin check runs exist (runs/check_run_1024_195620_6aa3.csv, check_run_1024_201206_703b.csv, source "device"), but the safe claim is the one DF:131 makes. Keep, but add "no reference profile yet, so every real scan ends Unable to verify" so the line can't be read as a pass.

### NIT
N1. draft:82 — "14 + 12 + 6 tests" → "14 station tests, a 12-check security suite and a 6-case policy test".
N2. draft:104 — owner instruction is not in `[FILL n: …]` form; make it `[FILL: paste "Sponsors, read here" + ticked track paragraphs from pitch/DEVPOST-FINAL.md]` so the pre-submit `[FILL` search catches it.
N3. draft:134 — measure-1280.png is a replay screen (top bar "REPLAY (not live)"); caption → "Quick 60 s or full run, with raw counts from both sensors (replay of our aspirin run)."
N4. draft:33, :51, :79, :81 — inline judging labels "(**Application**)", "(**Intentionality**)", "(**Functionality**)", "(**Creativity**)" read like a form; optional to drop.
N5. Built with (draft:110) — `openscad [FILL 8…]`: the chamber in the photos is a purple cylinder; pillgate/cad describes a black ~102×76×78 mm box (roadmap.md:262), so it is probably not from pillgate/cad. Owner decides; keep the FILL.

### Checked and OK (no action)
1 in 10 (RS 1a); $20k–$100k, 7–10 days (RS 6a/6b, after S1); 328 per 1 % per cm at 444 nm USP (ARM:73); 0.29 / 0.006 / 0.035 (ARM:57); 60 s / 2–10 min (guide.py:24-28); ≥3 reference runs (ARM:62); 14 tests (tests/test_analysis.py: 14 defs); 12 checks (SEC:50×4, :70×5, :76, :77, :80); 6 policy cases (PAY:278); 0.05 USDC (PAY:50); 1 USDC/24 h (PAY:300); seven rules (RULES:28-41); Node 22, React 19, Vite (package.json); claude-sonnet-5 on station + HTTP 400 story (evidence.py:72,:327; runs/claude-sonnet-5-test_*); scan ids, Aspirin 325 mg, NDC 49483-331-10, Time-Cap Labs, "ASPIRIN / A1", recalls for other lots (DB); SANDBOX/TESTNET wording; three verdict phrases exact; no traction claimed ("none yet" matches TR); Peel line allowed form.

## Findings pass 2 — `pitch/DEVPOST-ANSWERS.md` (humanized, mtime 20:41, 143 lines)
The humanized file was made from the writer's draft before pass 1 landed, so pass-1 items carry over (only S4 "our grandparents" is fixed, at :57). Counts: **must-fix 6 · should-fix 5 · nit 6**. Banned-word scan: clean (the only hits are inside the "Don't use 07-verdict" note at :143, which is not pasted). Peel: only :29, allowed form. FILL ids present: 1, 2, 4, 5 (×2), 6, 8 (×2), 9 — FILL 3 (team) is handled by "the owner adds team names" in the header, fine. Numbers re-checked after the humanizer's "to" ranges: $20,000 to $100,000, 7 to 10 days, 2 to 10 min, 0.29/0.006/0.035, 328 per 1 % per cm at 444 nm, 14/12/6, 0.05 USDC, 1 USDC/24 h, 17:40 (REAL_aspirin_first_test.csv mtime 17:39), 19:17 (scan f0c2 created 19:17:52): all match the ledger.

### MUST-FIX (raw lines)
M1. DEVPOST-ANSWERS.md:43 + :45 — Beer–Lambert: no fixed path length; "absorbance climbs with whatever has dissolved" is wrong (only something that absorbs the LED colour raises absorbance); and "it's the same law" is attached to the aspirin numbers, which are SCATTER on the 90° sensor, not absorbance (ARM:57-58; analysis.py:12-13, :257-265). Replace :43 with:
"**The physics, in plain words.** It's the colorimetry lab from school. Shine light through the same cup every time, and absorbance goes up in step with concentration (Beer-Lambert, A = εlc, which holds for a fixed path length). Clear water is the blank: the in-line photoresistor reads how much light gets through, and absorbance is log(blank ÷ now). So for a coloured tablet, absorbance climbs as it dissolves, and absorbance against time is the dissolution curve. We are not measuring nickel, but it's the same law."
Replace :45 with:
"Every second the Arduino UNO Q turns the LEDs off and takes a dark reading, which cancels out room light. Then it flashes blue, white and red. One photoresistor sits in line with the light and reads absorbance. The other sits at 90° and reads scatter, i.e. cloudiness. A white tablet like aspirin doesn't colour the water, it clouds it, so for aspirin we follow the 90° sensor instead: on our first aspirin run (Saturday, about 17:40) that signal rose 0.29 against blank noise of 0.006, while the in-line red moved only 0.035."
M2. :67 — "a 21-slide Figma deck, built by our own plugin": the plugin has never run in real Figma (figma/RUN.md:16; figma/build-deck.mjs:716; figma/LINKS.md:5). Replace with:
"- **Design:** a 21-slide deck generated from the repo as one JSON file, plus a Figma plugin we wrote to draw it (tested against a stub Figma API) and a PPTX import path `[FILL 4: which path made the shared Figma deck]`."
M3. :84 — "10 numbered sources" for both scans; DB: f0c2 = 10, 81ce = 9. Replace "; 10 numbered sources." with "; reports with 10 and 9 numbered sources."
M4. :136 and :128 — station-102.jpg (and 08/081/10) no longer exist; photos/station/ = station-17, 171, 19, 191 only (since 20:38). Delete gallery row 5 and renumber; delete the "Leave out station-08.jpg…" sentence at :128.
M5. :132, :135, :143 — station-171.jpg and station-17.jpg show a handwritten surname ("…n Susanto") on a paper, top-right. Replace row 1 with "| 1 (**thumbnail**) | `photos/station/station-19.jpg` | The station at our table: printed chamber, LED box, Arduino UNO Q. |"; keep 171/17 only with "crop off the top-right corner (handwritten name) before uploading"; rewrite the :143 thumbnail note to match.
M6. :121 — the linked 2:38 film says "Pill is a forty-dollar box. One quarter tablet, about three minutes… glows green" (pitch/film/vo/vo.txt:5) and calls the station hardware pending (vo.txt:11); RV #1 P0. Add under the link: "  The video was cut on Saturday afternoon, before the UNO Q station was streaming, so it still shows our first design. The text and photos here are the station as built."

### SHOULD-FIX
S1. :25 — restore source hedges (RS 6a, 6b): "A new USP-style dissolution tester typically costs $20,000 to $100,000, and lab dissolution results typically take 7 to 10 business days."
S2. :63 — "in 10 kΩ dividers" unconfirmed (RV #19; roadmap.md:440 10k on A / 100k on B) → "in resistor dividers from the 3V3 pin".
S3. :71, :73, :75 — "Friday night", "Saturday afternoon", "Saturday evening" have no source (git starts Sat 18:23; roadmap.md:352 planned riboflavin reference runs for Sat morning). Drop the time words ("**The vitamin that was too yellow to see through.**", "**The board was a different board.**", "**Then the board went quiet.**") unless the owner confirms them.
S4. :77 — "at 19:17 the first live scan went through" → "and at 19:17 the first scan with live Claude calls went through, on a replay of our aspirin run." (DF:132; result-1280.png shows "REPLAY (not live)").
S5. :101 — "(16 member organisations in 2019 to 2020)": not in either numbers sheet (house rule). → "We want to ask the Difäm-EPN Minilab Network, who already screen medicines."

### NIT
N1. :86 "14 + 12 + 6 tests" → "14 station tests, a 12-check security suite, a 6-case policy test".
N2. :108 owner placeholder not in `[FILL …]` form → `[FILL: paste "Sponsors, read here" + ticked track paragraphs from pitch/DEVPOST-FINAL.md]`.
N3. :138 caption → add "(replay of our aspirin run)" (screenshot top bar says REPLAY).
N4. :114 `openscad [FILL 8…]`: the photographed chamber (purple cylinder) does not match pillgate/cad (black ~102×76×78 mm box, roadmap.md:262); owner decides.
N5. :88 add "no reference profile yet, so every real scan ends Unable to verify" after "one aspirin run".
N6. :55 "runs a recall-checking agent" undersells it → "runs a checker agent (label, up to three frames of the cup, an openFDA recall lookup)" (PAY:66).
