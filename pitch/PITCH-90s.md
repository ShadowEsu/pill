# Pill: the table pitch (station live, clinic app second)

Two apps, one story. **The station app (Pill Gate)** runs live at the table on the laptop plugged into the Arduino UNO Q: bottle photo → tablet photo → guided run (clean water 10 s → tablet in → 60 s quick dissolve) → one of three answers: **Passed the screen**, **Needs lab testing**, **Unable to verify**. **The clinic app (Pill)**, on the phone at https://pill-app-delta.vercel.app, is the second half: then the money waits.

Stage directions in *italics* are not spoken. Numbers come only from DEVPOST-FINAL's research line; don't round them and don't add any.

**Before the judge arrives**
- Station app open at `:8000`, Quick mode selected, cup filled to the line, lid closed, a tablet from the reference bottle in your hand. Top bar must say `live`; if it says `REPLAY (not live)`, say "this is a replay of our real run" out loud.
- Phone open on the clinic app's held delivery (`/delivery/d-1042`, NEEDS LAB, $480 held · SANDBOX).
- If no reference profile has been built (`[FILL 6]`), the answer will be **Unable to verify**. Use line **B** at the reveal, not line **A**.

---

## 90-second version (word for word, about 180 words on either path)

*Hold up the bottle, take the photo in the station app.*

Claude reads this label: drug, lot, maker. We check that lot against openFDA recalls, live.

*Photo of the tablet.*

It reads the imprint and never guesses the drug.

*Press Start.*

Clean water first, ten seconds, lid closed. Every second the board turns every LED off and takes a dark reading, so room light cancels out.

*Lift the lid, drop the tablet, stir five circles, close the lid, press Continue.*

Tablet in. One sensor looks through the cup, one from the side. For sixty seconds we compare how it starts to dissolve with a reference recorded from known-good tablets on this same box.

*While it runs, look at the judge.*

WHO estimates 1 in 10 medical products in low- and middle-income countries is substandard or falsified. A lab dissolution tester costs twenty to a hundred thousand dollars. A clinic pharmacist has neither, just an invoice to pay today.

*Point at the answer.*

**A:** Passed the screen: inside the reference. It only ever says three things: Passed the screen, Needs lab testing, Unable to verify.
**B:** Unable to verify: no reference for this product, so it refuses to guess.

*Pick up the phone.*

Then the money waits. In a clinic, a tablet that needs lab testing holds the supplier's payment and drafts a lab referral. Only a pharmacist's tap releases it. Sandbox money today.

Try to make it pass something it shouldn't.

---

## 30-second version (70 words)

*Tablet already in; point at the live curve.*

One tablet, clean water, sixty seconds. Every second the board takes a dark reading, so room light cancels, and two sensors watch the tablet dissolve against a reference from known-good tablets on this box. It only says three things: Passed the screen, Needs lab testing, Unable to verify. *Phone.* Then the money waits: in a clinic, anything but a pass holds the supplier's payment until a pharmacist decides. Sandbox money today.

---

## 10-second version (25 words)

One tablet, sixty seconds: Passed the screen, Needs lab testing, or Unable to verify. Then the money waits until a pharmacist taps. Sandbox money today.

---

## If they interrupt (one-liners)
- "Is it real?" → "The station, its sensors and Claude's label read are live. The clinic app's escrow is sandbox and testnet, and every screen says which."
- "What's Claude doing?" → "It reads the label and writes the report. A guardrail in code makes the headline match the measurement; Claude never sets the answer."
- "Who is it for?" → "The pharmacist who signs for a wholesaler's delivery and decides whether the invoice gets paid."
- Full answers: `QA.md` (station questions are 21–29).

## Rules while speaking
- Station answers, exactly: **Passed the screen**, **Needs lab testing**, **Unable to verify**. The clinic app writes the same three as PASS / NEEDS LAB / UNABLE TO VERIFY. Never call a medicine good, bad or anything stronger.
- "1 in 10" covers substandard **and** falsified together. Never shorten it.
- Say "sandbox" or "testnet" every time money comes up. The $480 delivery is demo data.
- No names, schools, ages or countries.
