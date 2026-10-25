# Pill: 29 judge questions and our answers

Extends PLAN.md §6's six attacks (marked **[attack n]**). Each answer is 2–3 sentences; say the first sentence, stop, and only go on if they lean in. Where a question uses words we never use ourselves, it is quoted as the judge's question and marked **(judge's question)**; our answers never repeat those words.

---

**1. (judge's question) "Isn't this just Peel from HackMIT?"** **[attack 1]**
The optical dissolution method follows Peel (HackMIT 2026), and we cite it on Devpost: method only, no code. What we built is the decision: a station that matches each run against a reference recorded on the same box and gives one of three answers, and a policy agent that holds a supplier's payment until a pharmacist taps. Peel measures a tablet; Pill decides what happens to the invoice.

**2. (judge's question) "Is this a medical device?"**
We don't think so, because it tests a product, not a person: FDA's "device" definition is about diagnosis or treatment, and Pill makes no diagnosis and no patient-outcome claim. It says one thing: this tablet dissolved like the reference, or it didn't. We haven't had that reviewed by a regulatory lawyer, and a production version would need that in every market it ships to.

**3. (judge's question) "Why would a clinic trust a box of hobby parts?"**
It shouldn't trust it blindly, and the box is built so it doesn't have to: it only ever says Passed the screen, Needs lab testing or Unable to verify, it shows the checkpoints and reasons behind every answer, and a pass still reads "this is a screening result, not a lab test". The comparison is not a $20,000–$100,000 lab tester; it's the clinic's current check, which is reading the label. A pilot next to a GPHF Minilab on the same lots is how we'd earn the trust.

**4. (judge's question) "What if the supplier games the tablet?"**
To pass the 60 s quick run, a tablet has to dissolve like the reference runs at 12 checkpoints, one every 5 s (at least 80 % of them and the last one within tolerance), on the channel its profile names: colour (blue minus red) for yellow tablets like riboflavin, side-sensor cloudiness for white tablets like aspirin. Chalk that only clouds the water won't follow a yellow tablet's colour curve, and a tablet that dissolves slower or faster misses the checkpoints. A supplier who matches the whole curve would pass this screen, which is why it's a screen, the clinic picks the tablet from the delivery, and the lab path stays.

**5. (judge's question) "Where does Claude fail?"**
Three places we designed for: its prose can sound like it's clearing the medicine (a clause filter drops those clauses and falls back to the rule text if more than half go); a delivery note can carry a prompt injection (the policy ceiling is computed in code, notes are fenced as data, and anything but the ceiling or escalate becomes escalate, tested with "SYSTEM OVERRIDE … release"); and the API can be down (labelled template text). Claude never sets a verdict and never moves money, so its worst failure is a bad sentence, not a bad payment.

**6. (judge's question) "Why crypto?"**
Because one station paying another five cents for a verdict doesn't fit an invoice or a card: x402 lets a machine answer "402, here's the price" and get paid in the same request, with no account. The escrow rail is USDC on Base Sepolia testnet, simulated until a CDP key; a Capital One Nessie sandbox mirror is built and runs only if its key lands. The verdict and the policy run without either.

**7. (judge's question) "Why not just a barcode?"**
Because labels and lot numbers can be copied. In June 2024 WHO warned of falsified Ozempic batches found in Brazil, the UK and the US, inside the regulated supply chain; that's an injection, not a tablet, so it only shows that a lot number alone doesn't prove a product. We still check the lot for recalls, and for tablets we also look at how one dissolves.

**8. (judge's question) "Who is liable if it says PASS and the drug is bad?"**
Pill never releases a payment; the pharmacist does, under the clinic's own policy, and PASS is written as a screening result, not a clearance. The clinic's existing quality process and the supplier's obligations stay where they are; Pill adds a record of what was measured, which rule fired and who tapped. We haven't had legal advice on this, and we'd get it before any pilot.

**9. (judge's question) "What did you not finish?"**
Honestly: the paid x402 `200` (we have a real `402` and the facilitator's signature check; the last step needs a CDP key or 0.05 test USDC), real USDC escrow moves (simulated until the key), the Nessie sandbox mirror (built, runs only if its key lands), and the station's reference profile (until three or more reference runs are recorded, the station answers Unable to verify). The clinic app's curves are labelled replays and its recall chip is one demo lot; the station app's recall lookups are live openFDA and RxNav. Every one of those is labelled on screen.

**10. (judge's question) "Have you tested a real antimalarial?"** **[attack 2]**
No. A box only answers for products it has a reference profile for, so an antimalarial comes out Unable to verify (UNABLE TO VERIFY, rule U1, in the clinic app), by design. Adding a drug means recording its reference runs, not changing code.

**11. (judge's question) "What if someone opens the lid mid-run?"** **[attack 3]**
The station sees it in the dark reading of both sensors, uses the first opening as the tablet-in mark, and marks the run Unable to verify if the lid stays open longer than 25 s (see Q27). In the clinic app a faulted run is UNABLE TO VERIFY (rule U2), and policy P3 escalates to a person with no money moving.

**12. (judge's question) "Is the chalk tablet a fail or an unsure?"** **[attack 4]**
In the clinic app's labelled replay it's NEEDS LAB by a named rule, N2: the inline channel moved but the 90° channel did not. On the station a tablet whose curve misses the reference is Needs lab testing, while Unable to verify is reserved for "the station can't tell" (no reference, lid open too long, a noisy blank, a curve that never settled). Here it can tell, and what it sees doesn't match.

**13. (judge's question) "Why a blockchain at all?"** **[attack 5]**
There isn't one in the core: the station, the rules, the verdict and the policy run offline on a laptop. USDC on Base Sepolia (testnet, simulated until a CDP key) is the payment rail, a Nessie sandbox mirror runs only if its key lands, and x402 is just how one station sells a verdict to another. Remove the rails and the clinic still gets the verdict and the log.

**14. (judge's question) "Who lets a bot hold a supplier's money?"** **[attack 6]**
Nobody has to: the agent proposes, a person releases. Release needs a PASS, no recall, an amount within the $2,000 cap, and the pharmacist's tap; the model can only downgrade a decision to escalate. The policy is six plain-text clauses you can read, and every action is one log line.

**15. (judge's question) "So can it tell you whether a pill is real?"**
It answers a narrower question: did one tablet dissolve like the reference for that product, on this box? That catches some bad tablets (one that dissolves slower, faster, cloudier or clearer than the reference) and misses others (a tablet that matches the reference curve), and we say so. We never call a medicine anything; we say Passed the screen, Needs lab testing or Unable to verify, and what to do next.

**16. (judge's question) "How accurate is it? What's your false-pass rate?"**
We don't have a number yet, and we won't invent one: a reference profile needs three or more runs of a known-good tablet on the same box (ten per product is the plan), and a false-pass rate needs many more runs plus lab results on the same lots. Until the reference runs are recorded, the station answers Unable to verify rather than guess. A known false-pass mode is a different tablet that happens to dissolve like the reference; checking the bottle's drug against the profile is what stops it in practice.

**17. (judge's question) "What about a drug you have no reference for?"**
UNABLE TO VERIFY, and policy P3 escalates with no money moving. The agent can also buy a verdict over x402 from another station that has calibrated that drug, under a 1 USDC per day cap checked before it signs anything.

**18. (judge's question) "The test destroys the tablet. How is that useful?"**
Clinics already sample: one tablet from a delivery of thousands is the cost of a check. At home, personal mode never re-tests your doses; it keeps the bottle's one tested result, the recall check and a dose log, and says "Measuring a dose needs the station."

**19. (judge's question) "Why not a GPHF Minilab?"**
The Minilab is a field screening kit that costs EUR 4,720 for about 1,000 test runs, before reference standards, and it answers a different question with thin-layer chromatography. Pill is a dissolution screen built from hobby parts, wired to the payment decision. We'd rather run them side by side on the same 20 tablets than replace one with the other.

**20. (judge's question) "Is any of this real, or is it a demo?"**
Live: the station hardware (Arduino UNO Q, one CSV line a second), its analysis, guided run and lid detection; Claude reading the label and imprint and writing the report behind a code guardrail; openFDA and RxNav lookups; Gemini and Claude in the clinic app; the seven rules; and a real x402 `402`. Simulated or replayed: the USDC escrow moves (until a CDP key), the clinic app's curves and its week of history, and the station's demo run whenever the top bar says `REPLAY (not live)`. Every screen carries a `REPLAY`, `SANDBOX` or `TESTNET` chip so you never have to ask.

---

## The station (Pill Gate), Sat evening
The live demo at the table is the station app. Answers use its three phrases: **Passed the screen**, **Needs lab testing**, **Unable to verify** (the clinic app writes the same three as PASS / NEEDS LAB / UNABLE TO VERIFY).

**21. (judge's question) "Why an Arduino UNO Q?"**
It's the board we built the station on this weekend, and its 12-bit ADC gives finer steps (0–4095) than a classic UNO's 10-bit. It runs at 3.3 V, so the photoresistor dividers run from the 3V3 pin and the LEDs are wired active-low through the 5 V pin. The firmware only measures and streams one CSV line a second; every decision happens in the laptop app.

**22. (judge's question) "Why photoresistors, not phototransistors?"**
Photoresistors were what our kit had; phototransistors such as a TEMT6000 are faster and more linear, and they're the obvious upgrade. Photoresistors are slow and non-linear, so the app linearises them and compares every run with a reference recorded on the same box, which cancels most of the sensor's own quirks. We claim a screen against that reference, never an absolute concentration.

**23. (judge's question) "What does the dark reading do?"**
Once a second the board turns every LED off and reads both sensors, then lights blue, white and red in turn and reads again. Subtracting the dark reading cancels room light, so a judge's phone torch or the venue lights don't leak into the curve. The same dark channel is how the station sees the lid open (Q27).

**24. (judge's question) "Why only 60 seconds?"**
An official dissolution test takes far too long for a table, so quick mode is exactly 60 s and only judges whether the tablet *starts* dissolving like a good one. Full mode runs 2–10 minutes and stops once the curve has been flat for 60 s. The result screen says which mode it ran.

**25. (judge's question) "What is a 'reference profile', and how many runs is it?"**
It's the recorded behaviour of a known-good tablet on this same box, same small cup, one whole tablet, five stirs by hand (a stirrer paddle is the next build). It needs three or more runs today (ten per product is the plan); quick mode then checks 12 points, every 5 s, and passes when at least 80 % of them and the last one sit within tolerance of the reference, while full mode compares time-to-80 % and the final level with the reference spread. Each profile names its channel: colour (blue minus red) for yellow tablets like riboflavin, side-sensor cloudiness for white tablets like aspirin.

**26. (judge's question) "What happens if there's no profile for this product?"**
Unable to verify, every time; the station never guesses against a reference it doesn't have. Claude's report still runs the label, imprint and recall lookups, but the guardrail forces its headline to "Unable to verify: no reference profile". In the clinic app that answer escalates to a person and no money moves.

**27. (judge's question) "How do you know when the lid is open?"**
There's no switch: when the lid lifts, room light floods both sensors' dark readings at once. The app treats that moment as "tablet in", ignores the lid-open seconds, and marks the run Unable to verify if the lid stays open longer than 25 s. Before the tablet, the clean-water check also needs 10 s of steady readings with the lid closed.

**28. (judge's question) "What is Claude allowed to do, and what isn't it?"**
Claude reads the bottle label and the tablet imprint into fixed fields, writes the report citing only numbered sources, and answers Ask only from that report; it describes the imprint and never guesses the drug, and personal details on the label are refused in the prompt and scrubbed again in code. It never sets the answer: the measurement does, and a guardrail in code forces the report's headline to match it, adds a lot recall it missed, removes recall claims the records don't support, and rebuilds every citation. In the clinic app it can only propose or downgrade a payment decision; a pharmacist's tap releases money.

**29. (judge's question) "How is this different from Peel?"**
Peel (HackMIT 2026) published the optical dissolution method, and we cite it: method only, no code. What we added is the decision around it: reference matching with three fixed answers, live label and recall evidence with a guardrail, and a clinic payment that waits on the answer. Peel measures a tablet; Pill decides what happens to the invoice.
