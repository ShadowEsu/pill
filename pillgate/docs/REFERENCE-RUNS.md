# Reference runs tonight (aspirin)

**Goal:** 1 water-only control, then 3 good runs make the aspirin profile, then 1 check with a different tablet.
**Before you start:** run `app/.venv/bin/python tools/doctor.py` with the lid closed. Fix any FAIL first. Then `./start.sh`.

## The routine (exactly the same every run)
1. Fill the clear cup with clean water to the marked line. Same cup, same water every time.
2. Put the cup in the chamber and close the lid.
3. In the app, go to **Check**, skip the photos, and on **Measure** pick **Quick · 60 s**. Every run tonight is Quick.
4. Press **Start**. Don't touch the box until it says the water looks good (about 10 s steady).
5. Then, within about 10 seconds: lift the lid, drop the tablet in the middle, stir **5 slow circles** with the stick, take the stick out, close the lid.
6. Press **Continue** right away. Hands off for 60 s. It stops by itself.
7. Write down the run id the app shows (also listed under History). Empty the cup and rinse it.

## Run order
1. **Water-only control:** do the routine with no tablet. The purple side-sensor line should stay near 0.
2. **Reference 1, 2, 3:** the same plain uncoated aspirin, same brand, one whole tablet each, with the routine above.
3. **Build the profile:** go to Profiles, then Build a reference profile.
   - id `aspirin_ref`, name e.g. "Aspirin 325 mg uncoated, brand X", label words `aspirin`.
   - Choose **Cloudiness, side sensor**.
   - Tick the 3 reference runs only, not the control.
   - Press **Build reference**. It should say reference ✓ (quick mode, scatter).
4. **Check run:** a different tablet (coated aspirin or another brand), same routine, with the profile `aspirin_ref`.

## What each result should say
- **Water-only control, compared with aspirin_ref:** "Needs lab testing" (less cloudiness than expected). That is correct.
- **A 4th run of the same aspirin:** "Passed the screen".
- **The different tablet:** most likely "Needs lab testing". If it passes, write it down honestly as a miss.
- Never say safe, authentic, verified, genuine, certified, fake or counterfeit. Say "screening, not a lab test".

## If the water check never passes
- **"Lid closed" stays red (light leak):** close the lid fully, black tape over gaps and the cable hole, and turn your back to bright lights. Rerun the doctor: the dark rows must not FAIL.
- **"Steady" never fills:** something moves. Check for a loose wire on a photoresistor leg (hot-glue it) and bubbles on the cup wall (let the water sit 1 min). Don't lean on the table.
- **"Sensor in range" is red:** the light is at the top of the scale. Put tape in front of LDR A or use a bigger LED resistor (never below 220 Ω).
- **"Light reaches the sensor" is red:** an LED is backwards or on the wrong pin (blue D5, white D6, red D8).
- **After 1 minute:** "Continue anyway" appears. Don't use it for reference runs; fix the cause and restart instead.

## If the lid-open mark is wrong
The app finds the moment the lid opened from the dark readings, and shows "tablet in at N s".
- **Mark far too early:** a shadow or a room-light change fooled it. Keep the room lights the same and your hands away until you lift the lid. Redo the run.
- **No mark:** the app uses your Continue press instead, so press Continue the moment the lid is closed.
- **Lid open more than 25 s:** the result is "Unable to verify". Practise the 10-second drop-stir-close once with no tablet.

## If the result is "Unable to verify"
- **Too short:** the run was stopped early or the board dropped out. Redo it and let the 60 s finish.
- **No profile:** pick `aspirin_ref` on Measure (in mock mode the app can't read the bottle to pick it for you).
- **Mode mismatch:** the references were Quick but this run was Full (or the other way round). Redo it in Quick.
- **Noisy blank / saturated / too dark:** fix it as in "If the water check never passes", then redo.
- **Side sensor sees no LED light:** check the LDR B wiring (A1, 100 kΩ to GND).
