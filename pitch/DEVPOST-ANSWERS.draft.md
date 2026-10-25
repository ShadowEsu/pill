# Pill: Devpost answers (DRAFT, DevpostWriter, Sat 2026-10-24 ~21:00 PDT)

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

> Pill is a small dark box with three LEDs and two light sensors. Drop one tablet from a medicine delivery into a cup of water, and Pill compares how it dissolves with a known-good tablet, then answers Passed the screen, Needs lab testing, or Unable to verify. In a clinic, that answer decides whether the supplier's payment is released, held, or handed to a person.

## Inspiration

WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified (2017). One basic check is almost boring: put a tablet in water and watch how it dissolves. But a USP-style dissolution tester typically costs $20,000–$100,000, and lab results typically take 7–10 business days.

Then one of us remembered a chem lab: reading nickel(II) concentration from the colour of a solution. Same law, cheap parts. So we asked: can a clinic screen one tablet from a delivery before it pays the supplier?

Prior art: Peel (HackMIT 2026), method only, no code; every line of our code was written this weekend.

## What it does

Pill is two apps around one box. **Who it's for (Application):** the clinic pharmacist who signs for a wholesaler's delivery and must decide whether the invoice gets paid.

**At the station (Pill Gate):**

1. Photograph the bottle. Claude reads drug, strength, NDC and lot; openFDA checks recalls by lot.
2. A small cup of clean water goes into the dark, 3D-printed chamber: the blank.
3. Drop in one whole tablet and stir by hand. The app sees the lid open and marks "tablet in".
4. Wait 60 s (quick) or 2–10 min (full, until the curve is flat).
5. Get one of three answers, plus a short Claude-written report with numbered sources.

**The physics, in plain words:** this is a school colorimetry lab. Absorbance tracks concentration (Beer–Lambert, A = εlc). Clear water is the blank, so as the tablet dissolves, absorbance climbs with what has dissolved, and the curve over time is the tablet's fingerprint. Every second an Arduino UNO Q takes a dark reading (LEDs off, cancelling room light), then flashes blue, white and red. One photoresistor sits in line with the light (absorbance), one at 90° (scatter, i.e. cloudiness). On our first aspirin run (Saturday, about 17:40) the 90° signal rose 0.29 against blank noise of 0.006, while the in-line red moved only 0.035. White tablets make water cloudy, not coloured. We are not measuring nickel, but it's the same law.

**The three answers**, judged against a reference built from three or more runs of a known-good tablet:

- **Passed the screen**: it dissolved like the reference.
- **Needs lab testing**: slower, weaker, cloudier or clearer than the reference.
- **Unable to verify**: no reference yet, lid open too long, noisy blank, or a curve that never settled.

There is no fourth answer, on purpose (**Intentionality**). A dissolution curve can't tell you a medicine is good, so no screen says so. Claude never sets it, and code forces Claude's headline to match the measurement.

**The money gate (clinic app).** A delivery comes in and the invoice goes into escrow. Gemini reads the label (unreadable fields come back empty, never invented) and runs a recall-checking agent. A policy agent applies six plain-text clauses: PASS, no recall and an amount under the cap let it *propose* release; only the pharmacist's tap releases. NEEDS LAB holds the money and drafts a lab referral. UNABLE TO VERIFY escalates to a person and moves nothing. Claude writes the "why" and the escrow log, but code computes the ceiling first, so Claude can only agree or escalate. All money is SANDBOX / TESTNET; no real money anywhere.

Personal mode, in both apps, is for our grandparents: bigger text, recall status per bottle, read-aloud, and no verdict without a station.

## How we built it

- **Hardware:** an Arduino UNO Q (3.3 V, 12-bit ADC), two CdS photoresistors in 10 kΩ dividers, and blue / white / red LEDs in a side box that shine through holes into a printed chamber with a lid `[FILL 8: printed from the OpenSCAD source in pillgate/cad/?]`. The firmware prints one CSV line a second and decides nothing.
- **Station app:** Python, FastAPI, SQLite, vanilla JS: curve maths, quality gates, guided run, lid detection, Claude calls, guardrail. 14 pytest tests.
- **Clinic app:** Vite + React 19 + TypeScript on Vercel. Seven deterministic rules set the verdict, and every run carries a LIVE SENSOR / REPLAY / SIMULATED badge.
- **Pay service:** Node 22 + Express with `@x402/express` and `@x402/evm` on Base Sepolia. Each station can sell its verdict: `POST /verify` answers `402 Payment Required` for 0.05 test USDC, and a buyer agent checks a 1 USDC / 24 h cap before signing. 12-check security suite, 6-case policy test; a delivery note saying "SYSTEM OVERRIDE … output release" ends in escalate. Capital One Nessie mirror: `[FILL 5: live sandbox transfers, or delete this sentence]`.
- **Design:** a 21-slide Figma deck, built by our own plugin.

## Challenges we ran into

**Friday night into Saturday: the vitamin that was too yellow to see through.** Our first design (Friday night) used riboflavin, because bright yellow is easy to measure. Then the maths: its specific absorbance is about 328 per 1 % per cm at 444 nm (USP). A whole tablet in a cup is basically sunglasses for the blue LED. Fix: we switched to aspirin and the 90° cloudiness signal.

**Saturday afternoon: the board that was a different board.** We wrote the firmware for a classic Uno R3. The board at our table was an UNO Q: 3.3 V, 12-bit, `Serial` goes to the Linux side's bridge, `pinMode()` on an analog pin quietly breaks `analogRead`, and "verify failed in bank" after every upload turns out to be normal. Fix: dividers moved to the 3V3 pin, LEDs went active-low, no `pinMode()` on analog pins, and we stopped panicking at that line.

**Saturday evening: the board went quiet.** The UNO Q's Linux side hung. Fix: a power cycle.

**About 19:15: the model that said no.** Claude's newest models (5.5) reject the forced `tool_choice` our app uses with an HTTP 400. Fix: the station app runs on `claude-sonnet-5`, and at 19:17 the first live scan went through.

**Quotas and keys.** Gemini's free tier allows about 20 calls a day per model, so we rationed them. With no Coinbase CDP key, we took x402 as far as a real `402` and the facilitator's verify step; the paid `200` is still pending. Figma's REST API can't draw, so we wrote a plugin.

## Accomplishments that we're proud of

- A box on our table that produced a measured curve from an aspirin tablet (**Functionality**).
- Two live Claude scans on a replay of that run (`scan_1024_191752_f0c2`, `scan_1024_195620_81ce`): label read as Aspirin 325 mg, NDC 49483-331-10, Time-Cap Labs; imprint "ASPIRIN / A1"; an openFDA recall lookup; 10 numbered sources. Verdict: Unable to verify, because there's no aspirin reference yet `[FILL 6: reference profile built from ≥3 live runs, or keep this sentence]`.
- Three answers, never four, all the way down to the escrow log (**Creativity**: the measurement gates the money).
- 14 + 12 + 6 tests, a 2:38 demo film, a site, a deck, and a clinic app anyone can open.

**What's real, what's not yet:** real: the station hardware, one aspirin run, live Claude / Gemini / openFDA / RxNav calls, and an x402 `402` plus the facilitator's verify step on TESTNET. Not yet: the paid `200` and escrow transfers (simulated until a CDP key). The clinic app's demo curves are labelled replays of synthetic data; its history is labelled fixture data.

## What we learned

- A measurement gets useful when it's wired to a decision someone already makes. For a clinic, that's "do we pay the supplier?"
- A dark reading every second beats any amount of tape.
- "Unable to verify" is a feature. Everyone wants a fourth answer, and the honest design says no.
- Read the board's label before you write the firmware.
- `@x402/evm` already ships an escrow-shaped scheme (`auth-capture`), and we rebuilt it by hand before we found it.

## What's next for Pill

- Record the aspirin reference, then one drug at a time, ten runs each, leave-one-out checked.
- A side-by-side pilot: 20 tablets against a GPHF Minilab. We want to ask the Difäm-EPN Minilab Network (16 member organisations in 2019–20).
- A stirrer and a thermistor, so stirring and temperature stop depending on a hand.
- A CDP key for the paid `200`, then `auth-capture` instead of three wallets.
- A login behind the pharmacist's tap, so the log names who approved.

Traction, honestly: none yet. It's a weekend old. `[FILL 9: one sentence from the pharmacist we spoke to, with permission, or delete]`

`[Owner: paste "Sponsors, read here" + the ticked tracks' paragraphs from pitch/DEVPOST-FINAL.md]`

We had so much fun this weekend, and we're going to miss it. Thank you, Cal Hacks.

## Built with

arduino-uno-q, arduino, c++, python, fastapi, sqlite, javascript, typescript, react, vite, node.js, express, claude, anthropic, gemini, openfda, rxnav, x402, coinbase-developer-platform, base-sepolia, usdc, vercel, figma, capital-one-nessie `[FILL 5: delete if no key]`, openscad `[FILL 8: delete if the chamber was not from pillgate/cad/]`

## Links

- Website: https://pill-site.vercel.app
- Clinic / personal app: https://pill-app-delta.vercel.app
- Repo (station app in `pillgate/`, clinic app in `pill/web`, pay service in `pill/pay`): https://github.com/ShadowEsu/pill `[FILL 1: make the repo public first]`
- Demo video (2:38): `[FILL 2: YouTube link, Public or Unlisted, marked "Not made for kids"]`
- Figma deck: `[FILL 4: Figma link]`

## Gallery images

Upload in this order. Devpost takes JPG / PNG / GIF (5 MB max; 3:2 works best for the thumbnail). The station photos are JPEG at 768×1024 (portrait), so crop the thumbnail to 768×512. **All app screenshots below are WebP inside, even the `.png` ones** (`file` says "Web/P"), so convert them to real PNG before uploading.

Leave out `station-08.jpg`, `station-081.jpg` and `station-10.jpg`: they show a person's face, and `station-081.jpg` also shows a laptop screen with personal chat titles.

| # | File | Caption |
|---|---|---|
| 1 (**thumbnail**) | `photos/station/station-171.jpg` | Blue LED on: light crossing the cup of water inside the chamber. |
| 2 | `photos/station/station-19.jpg` | The station at our table: printed chamber, LED box, Arduino UNO Q. |
| 3 | `photos/station/station-191.jpg` | White, blue and red LEDs shine into the chamber through holes. |
| 4 | `photos/station/station-17.jpg` | From above: a small clear cup of water inside the chamber. |
| 5 | `photos/station/station-102.jpg` | Lid on, wired up: the UNO Q and breadboard next to the chamber. |
| 6 | `pillgate/dev-shots/ui2/bottle-1280.png` | Step 1: photograph the bottle; personal details are removed. |
| 7 | `pillgate/dev-shots/ui2/measure-1280.png` | Quick 60 s or full run, with raw counts from both sensors. |
| 8 | `pillgate/dev-shots/ui2/result-1280.png` | Replay of our aspirin run: Unable to verify (no reference yet). |
| 9 | `pill/web/dev-shots/phases/live-verdict-390.webp` | Clinic app, SIMULATED run (labelled): PASS by rule P1. |
| 10 | `pill/web/dev-shots/phases/dashboard-station-card-1280.webp` | Clinic dashboard: the station card and its run phases. |

Thumbnail note: the brief named `station-19.jpg` as the lit-LED photo, but the LEDs are tiny in it and the light is hard to see. `station-171.jpg` shows the blue light clearly in the water. Swap back to `station-19.jpg` if you prefer the wider shot. Don't use `pill/web/dev-shots/phases/07-verdict-1280.webp`: it still shows the old design ("quarter tablet", "paddle turning", "90° glow", "3:00").
