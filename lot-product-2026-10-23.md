# Lot: product spec (Fri 2026-10-23 ~22:25 PDT)

Decision: build Lot. Product round with 16 personas (elderly user, caregiver, geriatric pharmacist, home-health nurse, Kenyan clinic pharmacist, NGO procurement officer, UX/Figma judge, Anthropic, hardware, Hyphenate, People-First, Microsoft and main judges, health-tech VC, CS teammate, ethicist). Transcript: `lot-product-debate-2026-10-23.json`.

## Who it is for: 16 of 16 say the clinic / NGO procurement gate. Not an elder pill tracker.
The physics decides it: the test destroys the tablet. One sacrificed tablet per delivered lot is exactly how receiving pharmacists already sample; nobody dissolves the pill they are about to swallow. The elderly user: "I take nine pills. Your box verifies one vitamin I don't take; every bottle in my cabinet would say 'unable to verify', and it can't tell me if I took my evening pills." Reminder apps are a crowded market (Medisafe, Hero, MedMinder) and eldercare+Claude has already won twice. "Overall really good" = one job done honestly, not seven done half.

## Features
Must have (16/16 unless noted): **F1** live scan screen · **F2** verdict pass / needs lab / unable to verify with "why" · **F3** bottle photo → drug, lot, manufacturer → recall lookup (cached offline) · **F7** escrow agent hold/release/escalate with spend cap and decision log (Nessie sandbox) · **F11** Pi touchscreen face, one button: blank / start / stop (15/16) · **F13** Claude plain-language "why" and "what next" (9/16) · **F12** PDF/export report (8/16).
Cut (16/16): my-medicines list, reminders, "did you take it?", caregiver dashboard, lid tilt-switch log, voice Ask, later recall alerts, shared failed-lot map (keep at most as a table of our own runs).

## The scan screen (consensus)
- **Bar = % of the riboflavin reference's expected 445 nm absorbance plateau reached**, blank-corrected, labelled exactly that ("dissolving… 62 %"), hard timeout ~90 s. It stalls, not fills, for a Tums. Never "% genuine".
- Live readings beside it: absorbance curve vs the dotted reference band · 90° scatter (cloudiness) · water temperature · elapsed seconds · four sensor-health dots (LED baselines, dark current, paddle, lid).
- End card fills the screen: **green PASS** ("consistent with reference, this lot, one tablet") · **amber NEEDS LAB** (deviation named: "high scatter, no 445 nm absorbance") · **grey UNABLE TO VERIFY** ("no reference for this drug"). One-line why + the two numbers that decided it. Never a red "FAKE", never the word "safe".
- Design the empty state and the sensor-fault state before the happy path (UX judge).

## 90-second demo (same script from all 16)
1. "A clinic receives 2,000 tablets. One gets tested; the rest get paid for."
2. Photograph the bottle → drug, lot, manufacturer, recall check: clear (offline cache).
3. Blank on plain water. Drop one B2 tablet. Start. Bar climbs, curve tracks the reference band, plateau → **PASS**. Agent releases the supplier escrow in Nessie under its cap; decision log line shown; PDF generated.
4. Second bottle, same label, a Tums inside: scatter spikes, no blue absorbance, bar stalls → **NEEDS LAB**. Payment held, report drafted by Claude, pharmacist approves.
5. Third: an unknown pill → **UNABLE TO VERIFY**, escalated to a human, no money moves. "It never guesses and never pays blind."
6. Close: "Peel built the sensor. We made it decide something." Peel cited on slide one.

## One-line pitch
"Lot dissolves one tablet from each delivery and holds the supplier's money until the chemistry agrees."

## Biggest risk (everyone): the live B2 run
Plateau drifts with water temperature, paddle speed, LED warm-up and light leaking into the cardboard. Mitigations: 10–20 calibration runs tonight; set the pass band from measured spread, not hope; blank before every run; pre-warmed water; hard-wire Pi↔ESP32; cache Nessie and recall calls with retry; record a fallback run; rehearse the three-tablet sequence ten times under venue lights; say "one calibrated reference" before a judge asks. If the curve is noise by 3 AM, fall back to Bill.

## Tracks
Hyphenate · Best Hardware · Anthropic · Microsoft · People-First · Capital One Nessie · Bright Data (one live recall lookup with a visible empty/blocked case) · Elastic if criteria appear · Tiger Data (curves) · Gen AI · Figma Best Design (stage log + Slides) if time.

## Preston's direction, Fri ~22:35 (name: Pill; both modes; still planning, no build yet)
- **Station (clinic or home):** 3D-printed dark chamber (or taped box until the print exists) with a cup holder that fixes the LEDs and the sensors at 0° and 90°, plus a **phone window on top**: the phone films the dissolve live and the app shows the video next to the curve; the ESP32 sensors do the measuring (the phone camera's auto-exposure makes it a viewer, not the instrument). The video clip goes into the report.
- **Portable (phone only):** photograph the bottle and the pill → drug, lot, imprint → recall check → add to My medicines → log doses. It says plainly that a dose measurement needs the station.
- **Modes:** Clinic (sample one tablet per delivery → payment hold/release/escalate, audit log) and Personal/Nurse (test one tablet per new bottle → My medicines, recall alerts, tap to log "taken"). The 16 personas preferred clinic only; Preston keeps both; build clinic first.
- Light sensor: kit chart lists 2 photoresistors; if missing, use an LED as the sensor (green/yellow LED reads the blue LED; Dietz et al., MERL 2003) or rent a TCS34725 / TEMT6000 at the hardware booth.
