# Pill: table script for Sunday

Judging 10:30 to 12:30. Each judge gets 3 to 5 minutes. Read the **bold** words as cues, and say the rest in your own rhythm.

The three answers, said exactly: **Passed the screen**, **Needs lab testing**, **Unable to verify**. The clinic app writes the same three as PASS, NEEDS LAB, UNABLE TO VERIFY.

## 1. Setup, 10 minutes before judges

- [ ] Charger plugged in, laptop charging.
- [ ] Terminal: `cd ~/Downloads/peel && ./start.sh both`
- [ ] Safari tab 1: http://localhost:8000 (the real deal, live board)
- [ ] Safari tab 2: http://localhost:8001 (the demo, a replay of our real aspirin run)
- [ ] Safari tab 3: https://pill-app-delta.vercel.app/demo (clinic app)
- [ ] Second terminal, for the Coinbase demo: `cd ~/calhacks-13/pill/pay && npm run serve` (port 8402).
- [ ] Tab 1 badge says `live` and the lines read counter is going up.
- [ ] Black tape on the three light leaks. Lid closed.
- [ ] A cup of clean water filled to the line, sitting in the chamber.
- [ ] The aspirin bottle on the table, one whole tablet and the wooden stick next to it.
- [ ] Phone on the venue Wi-Fi, open http://10.0.12.166:8000 so a judge can hold it.
- [ ] Check Profiles on tab 1. If `aspirin_ref` is there, you can use **path A** below. If not, use **path B**. Don't guess.

## 2. The 90-second version

**Hold up the bottle.** "This is Pill. One tablet from a medicine delivery goes into a cup of water, and the box compares how it dissolves with known-good tablets. Then it says one of three things: Passed the screen, Needs lab testing, or Unable to verify."

**Point at the box.** "It's an Arduino UNO Q, three LEDs and two photoresistors. One looks straight through the cup. The other sits at 90 degrees and sees the water go cloudy."

**Start the run.** (Section 3 has what to say while it runs.)

**At the answer, path A** (only with `aspirin_ref` built): "It checked the curve every 5 seconds against our reference runs. Passed the screen. That's a screening result, not a lab test."

**At the answer, path B** (no reference yet): "We don't have a reference for this tablet on this box yet, so it says Unable to verify. It won't guess."

**Phone, tab 3.** "In a clinic, that answer decides the money. Anything but a pass holds the supplier's payment, and only the pharmacist's tap releases it. It's all sandbox and testnet money today."

**Close.** "Try to make it pass something it shouldn't."

## 3. While the live run records (about 2 minutes)

**Press Start.** "First, clean water. It needs 10 seconds of steady readings with the lid closed. That's our blank."

**Water check goes green.** "Every second the board turns all the LEDs off and takes a dark reading, so room light cancels out. That's why the tape is there, and why it doesn't care about the lights in here."

**Lift the lid, drop the tablet, stir 5 slow circles, take the stick out, close the lid, press Continue.** Do it in about 10 seconds. "The app sees the lid open in the dark readings and marks that as tablet in. If the lid stays open more than 25 seconds, the run is Unable to verify."

**60 to 90 seconds of dissolving. Fill it with the story:**

- **Why.** "WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified. That's WHO, 2017, and it counts badly made and falsified together."
- **Who.** "Our user is the clinic pharmacist who signs for a wholesaler's delivery. A new lab dissolution tester typically costs $20,000 to $100,000, and lab results typically take 7 to 10 business days. They have an invoice to pay today."
- **The physics.** "It's the colour lab from school. Absorbance goes up as more of the tablet dissolves. Aspirin doesn't colour the water, it clouds it, so for aspirin we watch the side sensor."
- **The three answers.** "There's no fourth answer. A curve can't tell you a medicine is good, so no screen says that. Claude never sets the answer. Code forces its headline to match the measurement."
- **The x402 bit.** "Every station can sell its answer to another clinic. Ask for it without paying and you get a 402 Payment Required for 0.05 test USDC. Our buyer agent checks a 1 USDC a day cap before it signs anything."

## 4. Which screen for which judge

**Hardware judge.** Tab 1 with the live board and its lines read counter. Then More → The station: photos and the three blueprints (wiring, breadboard, chamber cross-sections). Say: "The firmware decides nothing. It prints one CSV line a second. The UNO Q is a 3.3 V board, so we rewired for that on Saturday."

**Software or AI judge.** A finished result on tab 1 or tab 2, scroll to **Sources**: the numbered list Claude's report cites (openFDA, RxNav, the label read). Then open **Ask Pill** and ask "Why this answer?" Say: "Ask only answers from this report and its sources. Claude reads the label and the imprint, but it never guesses the drug and never sets the answer."

**Social-impact judge.** Two numbers, with their limits said out loud:
- "WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified (2017)."
- "Medication errors injure approximately 1.3 million people a year in the United States, according to the World Health Organization (2017). That's errors anywhere in the chain, not bad pills, but it shows how much can go wrong between the shelf and the patient."
Then show personal mode: bigger text, recall status per bottle, read-aloud.

**Coinbase or finance judge.** Clinic app tab 3: a delivery with the payment held, the clause quoted, the Release button only after a pass. Then the terminal: `curl -i -X POST localhost:8402/verify -d '{"curve":"B2-07"}'` shows the real `402` with the price. Say: "The paid 200 is still pending. We had no CDP key on the build machine, so we got as far as the 402 and the facilitator's verify step. Everything is TESTNET, the escrow is simulated, and every screen says so."

**Figma judge.** Open `~/calhacks-13/figma/pill-deck.pdf` (21 slides) and the Figma link if it's in Devpost. The honest answer: "We generated the deck from our repo as one JSON file and wrote a Figma plugin to draw it. We tested the plugin against a stub of the Figma API, not inside real Figma." Then say which way the shared Figma file was made, the plugin or the PPTX import. Check before 10:30; it's `[FILL 4]` in Devpost.

## 5. When something goes wrong

**Board not found** (tab 1 chip says no device, Start is greyed out):
1. Terminal: `./start.sh reset`
2. Unplug the UNO Q, plug it back in, wait 60 seconds. It reconnects by itself.
3. Still nothing? Switch to tab 2 and say: **"This is a recorded run from our real aspirin tablet."** The badge says REPLAY (not live). Never call it live.

**The answer is Unable to verify.** "That's the correct answer. There's no reference profile for this tablet on this box yet, and it refuses to guess." Don't apologise for it.

**The water check won't go green.** Close the lid fully, press the tape down, turn away from bright lights. After 1 minute "Continue anyway" appears. Don't use it in front of a judge. Say "light leak, give me ten seconds" and restart.

**Lid open too long.** "It caught that. Over 25 seconds open and it won't trust the run." Then redo it.

**Show mode.** It's a demo screen that reads "Aspirin 81 mg · 100 %". It is a demo label, not a measurement. If a judge asks, or if it might read as a real result, say: "That's our demo label. The real runs are on the other tab."

**Claude is slow or off.** The report says template. "The model is down or slow, so it falls back to the fixed rule text. The measurement doesn't depend on it."

## 6. The questions judges ask most

1. **"Isn't this Peel from HackMIT?"** We follow Peel's published method and cite it, method only, no code; what we added is the decision around it, three fixed answers and a payment that waits.
2. **"Is this a medical device?"** We don't think so: it tests a product, not a person, and makes no diagnosis, but we haven't had a regulatory lawyer look at it.
3. **"How accurate is it?"** We don't have a number and we won't make one up; a reference needs three or more runs today, ten per product is the plan, and accuracy needs lab results on the same lots.
4. **"Why only 60 seconds?"** Quick mode only checks whether the tablet starts dissolving like a good one; full mode runs 2 to 10 minutes until the curve goes flat.
5. **"What does the dark reading do?"** All LEDs off once a second, read both sensors, subtract it, and room light cancels out.
6. **"What is Claude allowed to do?"** Read the label and imprint, write the report with numbered sources, answer from that report; it never sets the answer and never moves money.
7. **"Who lets a bot hold a supplier's money?"** Nobody has to: the agent proposes, the pharmacist taps, and the model can only downgrade a decision to escalate.
8. **"What didn't you finish?"** The paid 200 and real escrow transfers need a CDP key, and the station needs its aspirin reference runs; every screen labels what's live and what's replayed.

More answers: `pitch/QA.md` (29 questions).

## 7. The close

"Thanks for stopping by. Here's everything."

Point at the link card:
- Site: https://pill-site.vercel.app
- Repo: https://github.com/ShadowEsu/pill
- Devpost: our Pill page on cal-hacks-13-0.devpost.com

Last line: **"Try to make it pass something it shouldn't."**

## Words to keep out

Nothing that calls a medicine good or bad, and none of the eight banned words listed in `pitch/devpost-voice.md`. If someone asks "is it real?", answer with "it matches the reference" or "it doesn't". Say "sandbox" or "testnet" every time money comes up. Say "recorded run" every time it's the replay. No names, schools, ages or countries.
