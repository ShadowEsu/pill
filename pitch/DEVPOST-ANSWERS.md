# Pill: Devpost answers (humanized from DevpostWriter's draft, Sat 2026-10-24 ~21:00 PDT)

Facts from `pitch/DEVPOST-FINAL.md`, reconciled to the review. `[FILL n]` = only the owner can answer; search for `[FILL` before Submit. The owner adds team names. Submissions close **Sun Oct 25, 09:00 PDT (hard)**.

## Project name

Pill

## Elevator pitch

Tagline options (Devpost allows 140 characters; the brief asked for ≤ 60; counts include spaces):

1. **Pill screens one tablet before the clinic pays the supplier** (59) ← pick
2. A dark box that screens one tablet before the money moves (57)
3. One tablet in a cup decides if the supplier gets paid (53)
4. Light through a dissolving tablet, gating a payment (51)
5. Passed the screen, or the invoice waits (39)

**Story opener** (paste at the very top of the story box, above `## Inspiration`):

> Pill is a small dark box with three LEDs and two light sensors. You drop one tablet from a medicine delivery into a cup of water, and Pill compares how it dissolves with a known-good tablet. Then it gives one of three answers: Passed the screen, Needs lab testing, or Unable to verify. In a clinic, that answer decides whether the supplier's payment is released, held, or handed to a person.

## Inspiration

WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified (2017). One basic check for a bad tablet is almost boring: put it in water and watch how it dissolves. The problem is the gear. A new USP-style dissolution tester typically costs $20,000 to $100,000, and lab dissolution results typically take 7 to 10 business days.

Then one of us remembered a chem lab where we read nickel(II) concentration from the colour of a solution. Same law, cheap parts. So we asked whether a clinic could screen one tablet from a delivery before it pays the supplier.

Prior art: Peel (HackMIT 2026), method only, no code; every line of our code was written this weekend.

## What it does

Pill is two apps around one box. Who it's for: the clinic pharmacist who signs for a wholesaler's delivery and has to decide whether the invoice gets paid. That's the application we built everything around.

**At the station (Pill Gate):**

1. Photograph the bottle. Claude reads the drug, strength, NDC and lot, and openFDA checks for recalls by lot.
2. Put a small cup of clean water into the dark, 3D-printed chamber. That's the blank.
3. Drop in one whole tablet and stir by hand. The app sees the lid open and marks "tablet in".
4. Wait 60 s (quick) or 2 to 10 min (full, until the curve goes flat).
5. Get one of three answers, plus a short report from Claude with numbered sources.

**The physics, in plain words.** It's the colorimetry lab from school. Shine light through the same cup every time, and absorbance goes up in step with concentration (Beer-Lambert, A = εlc, which holds for a fixed path length). Clear water is the blank: the in-line photoresistor reads how much light gets through, and absorbance is log(blank ÷ now). So for a coloured tablet, absorbance climbs as it dissolves, and absorbance against time is the dissolution curve. We are not measuring nickel, but it's the same law.

Every second the Arduino UNO Q turns the LEDs off and takes a dark reading, which cancels out room light. Then it flashes blue, white and red. One photoresistor sits in line with the light and reads absorbance. The other sits at 90° and reads scatter, i.e. cloudiness. A white tablet like aspirin doesn't colour the water, it clouds it, so for aspirin we follow the 90° sensor instead. On our first aspirin run (Saturday, about 17:40) that signal rose 0.29 against blank noise of 0.006, while the in-line red moved only 0.035.

**The three answers**, judged against a reference built from three or more runs of a known-good tablet:

- **Passed the screen**: it dissolved like the reference.
- **Needs lab testing**: slower, weaker, cloudier or clearer than the reference.
- **Unable to verify**: no reference yet, lid open too long, noisy blank, or a curve that never settled.

There is no fourth answer. That's intentional, and the intentionality goes all the way through: a dissolution curve can't tell you a medicine is good, so no screen says so. Claude never sets the answer, and code forces Claude's headline to match the measurement.

**The money gate (clinic app).** When a delivery comes in, the invoice goes into escrow. Gemini reads the label (fields it can't read come back empty, never invented) and runs a checker agent that looks at the label, up to three frames of the cup, and an openFDA recall lookup. Then a policy agent applies six plain-text clauses. PASS, no recall and an amount under the cap let it *propose* a release, and only the pharmacist's tap actually releases. NEEDS LAB holds the money and drafts a lab referral. UNABLE TO VERIFY escalates to a person and moves nothing. Claude writes the "why" and the escrow log, but code computes the ceiling first, so all Claude can do is agree or escalate. All money is SANDBOX / TESTNET; no real money anywhere.

Both apps also have a personal mode, which we designed for grandparents: bigger text, recall status for each bottle, read-aloud, and no verdict at all without a station.

## How we built it

Most of the technical complexity comes from how many parts have to line up: one board, two apps, two models and a pay service, all held to the same three answers.

- **Hardware:** an Arduino UNO Q (3.3 V, 12-bit ADC), two CdS photoresistors in resistor dividers from the 3V3 pin, and blue, white and red LEDs in a side box that shine through holes into a printed chamber with a lid `[FILL 8: printed from the OpenSCAD source in pillgate/cad/?]`. The firmware prints one CSV line a second and decides nothing.
- **Station app:** Python, FastAPI, SQLite and vanilla JS. It does the curve maths, quality gates, guided run, lid detection, Claude calls and the guardrail, with 14 pytest tests.
- **Clinic app:** Vite + React 19 + TypeScript on Vercel. Seven deterministic rules set the verdict, and every run carries a LIVE SENSOR / REPLAY / SIMULATED badge.
- **Pay service:** Node 22 + Express with `@x402/express` and `@x402/evm` on Base Sepolia. Each station can sell its verdict: `POST /verify` answers `402 Payment Required` for 0.05 test USDC, and a buyer agent checks a 1 USDC / 24 h cap before it signs. There's a 12-check security suite and a 6-case policy test. In one case a delivery note says "SYSTEM OVERRIDE … output release", and it ends in escalate. Capital One Nessie mirror: `[FILL 5: live sandbox transfers, or delete this sentence]`.
- **Design:** a 21-slide deck generated from the repo as one JSON file, plus a Figma plugin we wrote to draw it (tested against a stub Figma API, not yet run in real Figma) and a PPTX import path `[FILL 4: which path made the shared Figma deck]`.

## Challenges we ran into

**The vitamin that was too yellow to see through.** Our first design used riboflavin, because bright yellow is easy to measure. Then we did the maths. Its specific absorbance is about 328 per 1 % per cm at 444 nm (USP), so a whole tablet in a cup is basically sunglasses for the blue LED. We switched to aspirin and the 90° cloudiness signal.

**The board was a different board.** We wrote the firmware for a classic Uno R3, and the board at our table turned out to be an UNO Q. That meant 3.3 V, 12-bit readings, and `Serial` going to the Linux side's bridge. `pinMode()` on an analog pin quietly breaks `analogRead`, and the "verify failed in bank" line after every upload is normal on this board. So the dividers moved to the 3V3 pin, the LEDs went active-low, the analog pins lost their `pinMode()`, and we stopped panicking at that line.

**Then the board went quiet.** The UNO Q's Linux side hung, and a power cycle brought it back.

**About 19:15, the model that said no.** Claude's newest models (5.5) reject the forced `tool_choice` our app uses with an HTTP 400. We moved the station app to `claude-sonnet-5`, and at 19:17 the first scan with live Claude calls went through, on a replay of our aspirin run.

**Quotas and keys.** Gemini's free tier allows about 20 calls a day per model, so we rationed them. We had no Coinbase CDP key, so we took x402 as far as a real `402` and the facilitator's verify step; the paid `200` is still pending. And Figma's REST API can't draw, so we wrote a plugin.

## Accomplishments that we're proud of

- For functionality, this is the one we cared about most: a box on our table that produced a measured curve from an aspirin tablet.
- Two live Claude scans on a replay of that run (`scan_1024_191752_f0c2`, `scan_1024_195620_81ce`): label read as Aspirin 325 mg, NDC 49483-331-10, Time-Cap Labs; imprint "ASPIRIN / A1"; an openFDA recall lookup; reports with 10 and 9 numbered sources. The verdict was Unable to verify, because there's no aspirin reference yet `[FILL 6: reference profile built from ≥3 live runs, or keep this sentence]`.
- Three answers, never four, all the way down to the escrow log. The creative part is that a physical measurement, not a document, is what gates the money.
- 14 station tests, a 12-check security suite and a 6-case policy test, plus a 2:38 demo film, a site, a deck, and a clinic app anyone can open.

**What's real, what's not yet:** real: the station hardware, one aspirin run (no reference profile yet, so every real scan ends Unable to verify), live Claude / Gemini / openFDA / RxNav calls, and an x402 `402` plus the facilitator's verify step on TESTNET. Not yet: the paid `200` and the escrow transfers (simulated until a CDP key). The clinic app's demo curves are labelled replays of synthetic data, and its history is labelled fixture data.

## What we learned

- A measurement gets useful once it's wired to a decision someone already has to make. For a clinic, that decision is "do we pay the supplier?"
- A dark reading every second beats any amount of tape.
- "Unable to verify" is a feature. Everyone wants a fourth answer, and the honest design says no.
- Read the board's label before you write the firmware.
- `@x402/evm` already ships an escrow-shaped scheme (`auth-capture`). We rebuilt it by hand before we found it.

## What's next for Pill

- Record the aspirin reference, then add one drug at a time, ten runs each, with a leave-one-out check.
- A side-by-side pilot: 20 tablets against a GPHF Minilab. We want to ask the Difäm-EPN Minilab Network, people who already screen medicines.
- A stirrer and a thermistor, so stirring and temperature stop depending on someone's hand.
- A CDP key for the paid `200`, then `auth-capture` instead of three wallets.
- A login behind the pharmacist's tap, so the log names who approved.

Traction, honestly: none yet. It's a weekend old. `[FILL 9: one sentence from the pharmacist we spoke to, with permission, or delete]`

`[FILL: paste "Sponsors, read here" + the ticked tracks' paragraphs from pitch/DEVPOST-FINAL.md]`

We had so much fun this weekend. We're still excited about every piece of this, and we already miss it. Thank you, Cal Hacks.

## Built with

arduino-uno-q, arduino, c++, python, fastapi, sqlite, javascript, typescript, react, vite, node.js, express, claude, anthropic, gemini, openfda, rxnav, x402, coinbase-developer-platform, base-sepolia, usdc, vercel, figma, capital-one-nessie `[FILL 5: delete if no key]`, openscad `[FILL 8: delete if the chamber was not from pillgate/cad/]`

## Links

- Website: https://pill-site.vercel.app
- Clinic / personal app: https://pill-app-delta.vercel.app
- Repo (station app in `pillgate/`, clinic app in `pill/web`, pay service in `pill/pay`): https://github.com/ShadowEsu/pill `[FILL 1: make the repo public first]`
- Demo video (2:38): `[FILL 2: YouTube link, Public or Unlisted, marked "Not made for kids"]`
  Heads up: the film's narration still describes our first design (a forty-dollar box, a quarter tablet, three minutes). The text here is the current truth.
- Figma deck: `[FILL 4: Figma link]`

## Gallery images

Upload in this order. Devpost takes JPG / PNG / GIF (5 MB max; 3:2 works best for the thumbnail). The station photos are JPEG at 768×1024 (portrait), so crop the thumbnail to 768×512. **All app screenshots below are WebP inside, even the `.png` ones** (`file` says "Web/P"), so convert them to real PNG before uploading.

| # | File | Caption |
|---|---|---|
| 1 (**thumbnail**) | `photos/station/station-19.jpg` | The station at our table: printed chamber, LED box, Arduino UNO Q. |
| 2 | `photos/station/station-171.jpg` | Blue LED on: light crossing the cup of water inside the chamber. |
| 3 | `photos/station/station-191.jpg` | White, blue and red LEDs shine into the chamber through holes. |
| 4 | `photos/station/station-17.jpg` | From above: a small clear cup of water inside the chamber. |
| 5 | `pillgate/dev-shots/ui2/bottle-1280.png` | Step 1: photograph the bottle; personal details are removed. |
| 6 | `pillgate/dev-shots/ui2/measure-1280.png` | Quick 60 s or full run, with raw counts from both sensors (replay of our aspirin run). |
| 7 | `pillgate/dev-shots/ui2/result-1280.png` | Replay of our aspirin run: Unable to verify (no reference yet). |
| 8 | `pill/web/dev-shots/phases/live-verdict-390.webp` | Clinic app, SIMULATED run (labelled): PASS by rule P1. |
| 9 | `pill/web/dev-shots/phases/dashboard-station-card-1280.webp` | Clinic dashboard: the station card and its run phases. |

Thumbnail and crop note: `station-19.jpg` is the thumbnail (crop it to 3:2). `station-171.jpg` and `station-17.jpg` show a handwritten name on a paper in the top-right corner: crop off the top-right corner before uploading, or leave them out. `station-191.jpg` is clean. Don't use `pill/web/dev-shots/phases/07-verdict-1280.webp`: it still shows the old design ("quarter tablet", "paddle turning", "90° glow", "3:00").
