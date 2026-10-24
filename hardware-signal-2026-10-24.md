# Pill: signal design after the Research lookups (Sat 2026-10-24 ~00:55)

Source: `~/boss-handoff/agents/research/calhacks-pill-lookups-2026-10-24.md` (Research agent, sources opened). This file turns it into build decisions.

## The three physics facts that change the build
1. **Riboflavin absorbs blue** (peaks ~445 and ~372 nm). A 465–475 nm blue LED gets ~84–88 % of the peak absorbance. Usable. A 450 nm royal-blue LED would be better; the kit's blue LED is fine.
2. **Dose and path length**: A ≈ 0.028 per mg/L per cm at 470 nm. We want A between 0.1 and 1.0 over the light path. 25 mg in 900 mL at 1 cm → A ≈ 0.78 (good). 100 mg in 900 mL → A ≈ 3.1 (black). A 100 mg tablet in a 200 mL cup across a 7 cm cup → A ≈ 100 (nothing gets through). **So: the vessel is ~900 mL (USP uses 900 mL anyway), the tablet is a quarter of a 100 mg tablet (or a 25 mg tablet if the shop has it), and the light path is short (1–2 cm): LED and sensor across one corner of a square clear container, or across a narrow clear tube glued to the wall.** Riboflavin's solubility is only ~0.05–0.33 mg/mL, so a small cup also risks never dissolving fully (false NEEDS LAB): another reason for 900 mL.
3. **Riboflavin fluoresces green (530 nm) and the kit's CdS photoresistor peaks at 540 nm.** The inline sensor sees green glow on top of the transmitted blue and under-reads absorbance. Fixes, cheapest first:
   - **Blue filter in front of the inline sensor**: blocks the green. A piece of blue transparent plastic (report cover, packaging, a blue bottle) taped over the sensor.
   - **Green filter in front of the 90° sensor**: a strip from a green Sprite/7-Up bottle. Then the 90° channel reads *fluorescence*, which only riboflavin produces, and barely reads scatter. Tums at 90° through green: ~nothing. Tums inline: cloudy, light drops. This makes the two channels tell different stories, which is better than the original "scatter" idea.
   - **Blue LED as the detector**: an LED used backwards only responds to light at or below its own wavelength, so a blue LED as the sensor is blind to green fluorescence by physics. Firmware: reverse-bias, then time the discharge (Dietz et al., MERL 2003). Option B if the filter trick is noisy.
   - **TCS34725 colour sensor** (blue channel at 465 nm) if the hardware desk has one: the best inline sensor. Ask #ask-mentors on the Cal Hacks Slack.
   - Pulse the LED only when reading: riboflavin is light-sensitive (USP: "light-resistant containers").

## Vessel and paddle
- Vessel: a clear 1-quart deli container (~946 mL) or a square clear food box. Fill line marked at 900 mL. Matches USP 〈711〉 (900 mL, paddle, 50 rpm, 45 min, Q = 75 %).
- Paddle: the kit's 28BYJ-48 stepper + ULN2003 gives a steady, repeatable ~10–15 rpm (USP is 50, we don't need USP speed, we need the same speed every run). The DC motor via L293D at low PWM works too but its speed drifts with voltage. **Use the stepper.**
- The measurement window: LED and inline sensor taped on the outside across one corner (path ~1.5 cm), 2 cm above the bottom, the 90° sensor on the adjacent face at the same height. All three behind black tape; whole box dark.
- Time: USP allows 45 min. For the demo we show the first 3 minutes live and say so; the curve keeps running on the Pi.

## Calibration tonight, updated
- Buy **vitamin B2 100 mg** (Walgreens, Nature's Bounty or similar, ~$6) and split tablets into quarters with a knife (the demo "one tablet" is one quarter; say so on the slide: "one quarter of a 100 mg tablet so the light path isn't black"). If 25 mg tablets exist, buy those.
- 10 quarter-tablet runs in 900 mL at ~25 °C, same stepper speed, same fill line. 3 Tums runs. 2 unknown (any white uncoated tablet).
- Record: inline (blue-filtered) and 90° (green-filtered) every second, dark before every sweep, blank on water.
- Pass band from the 10-run spread (mean ± 3 SD, leave-one-out), as in SOFTWARE-PLAN §3. Report: "screening, not a USP test".

## Verdict logic, updated (SOFTWARE-PLAN §2 rule changes)
- N1 was "scatter > τ". Now: **inline drop without 90° fluorescence rise = NEEDS LAB** (something cloudy that is not riboflavin: Tums), and **no inline drop and no fluorescence = NEEDS LAB** (nothing dissolved or nothing absorbing).
- P1: inline plateau inside the band **and** 90° fluorescence rises with it (both channels agree) → PASS.

## What this does to the pitch
Two channels that disagree is the whole demo: B2 makes the inline channel drop and the green channel glow; Tums makes the inline channel drop and the green channel stay dark. One sentence: "Riboflavin absorbs blue and glows green; chalk only blocks light."

## Still unverified (ask on the Cal Hacks Slack)
- Does the hardware desk have a TCS34725 / TEMT6000 / a 3D printer? (#ask-mentors; hardware list is behind hive.hackberkeley.org/hardware, hacker login.)
- Written OK from #ask-directors that building on Peel's published method, with all code written at the event and Peel cited, is fine under "all implementation during the hacking period". Don't reuse Peel code at all; cite the method.
