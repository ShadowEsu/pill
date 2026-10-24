# Pill: 20 judge questions and our answers

Extends PLAN.md §6's six attacks (marked **[attack n]**). Each answer is 2–3 sentences; say the first sentence, stop, and only go on if they lean in. Where a question uses words we never use ourselves, it is quoted as the judge's question and marked **(judge's question)**; our answers never repeat those words.

---

**1. (judge's question) "Isn't this just Peel from HackMIT?"** **[attack 1]**
The optical dissolution method follows Peel (HackMIT 2026), and we cite it on Devpost: method only, no code; everything here was written this weekend. What we built is the decision: two channels that must agree, seven rules with an id on every verdict, and a policy agent that holds a supplier's payment until a pharmacist taps. Peel measures a tablet; Pill decides what happens to the invoice.

**2. (judge's question) "Is this a medical device?"**
We don't think so, because it tests a product, not a person: FDA's "device" definition is about diagnosis or treatment, and Pill makes no diagnosis and no patient-outcome claim. It says one thing: this tablet dissolved like the reference, or it didn't. We haven't had that reviewed by a regulatory lawyer, and a production version would need that in every market it ships to.

**3. (judge's question) "Why would a clinic trust a $40 box?"**
It shouldn't trust it blindly, and the box is built so it doesn't have to: it only ever says PASS, NEEDS LAB or UNABLE TO VERIFY, it shows the two numbers and the rule behind every answer, and a PASS still reads "this is a screening result, not a lab test". The comparison is not a $20,000–$100,000 lab tester; it's the clinic's current check, which is reading the label. A pilot next to a GPHF Minilab on the same lots is how we'd earn the trust.

**4. (judge's question) "What if the supplier games the tablet?"**
One channel is easy to game: chalk makes water cloudy and darkens the inline sensor just like riboflavin does, which is exactly the moment in our demo. Faking both channels means matching the reference's absorbance, its green fluorescence and its dissolution speed at once, which is far harder than a printed label. A supplier who manages all three would pass this screen, which is why it's a screen, the clinic picks the tablet from the delivery, and the lab path stays.

**5. (judge's question) "Where does Claude fail?"**
Three places we designed for: its prose can sound like it's clearing the medicine (a clause filter drops those clauses and falls back to the rule text if more than half go); a delivery note can carry a prompt injection (the policy ceiling is computed in code, notes are fenced as data, and anything but the ceiling or escalate becomes escalate, tested with "SYSTEM OVERRIDE … release"); and the API can be down (labelled template text). Claude never sets a verdict and never moves money, so its worst failure is a bad sentence, not a bad payment.

**6. (judge's question) "Why crypto?"**
Because one station paying another five cents for a verdict doesn't fit an invoice or a card: x402 lets a machine answer "402, here's the price" and get paid in the same request, with no account. The clinic's escrow runs on two rails, USDC on Base Sepolia testnet and a Capital One Nessie sandbox mirror, so the bank version works the same way. The verdict and the policy run without either.

**7. (judge's question) "Why not just a barcode?"**
Because labels and lot numbers can be copied. In June 2024 WHO warned of falsified Ozempic batches found in Brazil, the UK and the US, inside the regulated supply chain. We still check the lot for recalls, but only the tablet itself has to dissolve.

**8. (judge's question) "Who is liable if it says PASS and the drug is bad?"**
Pill never releases a payment; the pharmacist does, under the clinic's own policy, and PASS is written as a screening result, not a clearance. The clinic's existing quality process and the supplier's obligations stay where they are; Pill adds a record of what was measured, which rule fired and who tapped. We haven't had legal advice on this, and we'd get it before any pilot.

**9. (judge's question) "What did you not finish?"**
Honestly: the paid x402 `200` (we have a real `402` and the facilitator's signature check; the last step needs the CDP key or 0.05 test USDC), real USDC escrow moves (simulated until the key), the live Nessie calls (client built, key pending), the live openFDA lookup (one demo recall lot in the app), and the station's own calibration runs, so the curves in the demo are replays. `[update Sun morning: strike what got done]` Every one of those is labelled on screen.

**10. (judge's question) "Have you tested a real antimalarial?"** **[attack 2]**
No. We have one reference, riboflavin, so an antimalarial comes out UNABLE TO VERIFY (rule U1), by design. Adding a drug means ten calibration runs and a leave-one-out check for its band, not a code change.

**11. (judge's question) "What if someone opens the lid mid-run?"** **[attack 3]**
The tilt switch and the dark reading both catch it, the run faults, and the answer is UNABLE TO VERIFY (rule U2) with "lid opened at 0:41" in plain words. A faulted run never moves money; policy P3 escalates to a person.

**12. (judge's question) "Is the chalk tablet a fail or an unsure?"** **[attack 4]**
NEEDS LAB, by a named rule: N2, the inline channel moved but the 90° glow did not rise, which is what chalk does and riboflavin doesn't. UNABLE TO VERIFY is reserved for "the station can't tell" (no reference, a fault, an unsettled reading); here it can tell, and what it sees doesn't match.

**13. (judge's question) "Why a blockchain at all?"** **[attack 5]**
There isn't one in the core: the station, the rules, the verdict and the policy run offline on a laptop. USDC on Base Sepolia is one payment rail, next to a Nessie sandbox rail, and x402 is just how one station sells a verdict to another. Remove both rails and the clinic still gets the verdict and the log.

**14. (judge's question) "Who lets a bot hold a supplier's money?"** **[attack 6]**
Nobody has to: the agent proposes, a person releases. Release needs a PASS, no recall, an amount within the $2,000 cap, and the pharmacist's tap; the model can only downgrade a decision to escalate. The policy is six plain-text clauses you can read, and every action is one log line.

**15. (judge's question) "So can it detect fake pills?"**
It answers a narrower question: did one tablet dissolve like the reference for that drug, in both channels? That catches some bad tablets (chalk in a vitamin bottle) and misses others (a tablet that matches the reference in both channels), and we say so. We never call a medicine anything; we say PASS, NEEDS LAB or UNABLE TO VERIFY and what to do next.

**16. (judge's question) "How accurate is it? What's your false-pass rate?"**
We don't have a number yet, and we won't invent one: the band comes from ten calibration runs with a leave-one-out check, and those runs are on the station being built today. `[pending: "n/10 leave-one-out" from the real runs]` A known false-pass mode is an unknown tablet that happens to land in the band; rule U1 stops it in practice, because the bottle's drug must have a reference.

**17. (judge's question) "What about a drug you have no reference for?"**
UNABLE TO VERIFY, and policy P3 escalates with no money moving. The agent can also buy a verdict over x402 from another station that has calibrated that drug, under a 1 USDC per day cap checked before it signs anything.

**18. (judge's question) "The test destroys the tablet. How is that useful?"**
Clinics already sample: one tablet from a delivery of thousands is the cost of a check, and it's a quarter tablet in our setup. At home, personal mode never re-tests your doses; it keeps the bottle's one tested result, the recall check and a dose log, and says "Measuring a dose needs the station."

**19. (judge's question) "Why not a GPHF Minilab?"**
The Minilab is a field screening kit that costs EUR 4,720 for about 1,000 test runs, before reference standards, and it answers a different question with thin-layer chromatography. Pill is a dissolution screen on about $40 of parts, wired to the payment decision. We'd rather run them side by side on the same 20 tablets than replace one with the other.

**20. (judge's question) "Is any of this real, or is it a demo?"**
Live today: Gemini reading the label, Claude writing the why and the escrow log line, the seven rules, and a real x402 `402` from the public facilitator. Simulated or replayed: the escrow moves (until the CDP key), Nessie (until its key), the recall check (one demo lot), the station's curves (until the box's runs land), and the app's week of history. Every screen carries a `REPLAY`, `SANDBOX` or `TESTNET` chip so you never have to ask.
