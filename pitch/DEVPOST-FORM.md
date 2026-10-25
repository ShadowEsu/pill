# Pill: Devpost form, the fixed fields (paste-ready) · Sat 2026-10-24 21:0x PDT

Facts from `pitch/DEVPOST-FINAL.md` (Opt-in boxes + Track paragraphs). `[FILL n]` / `[owner …]` markers are yours to answer before Sunday 08:30; search for `[` before you press Submit.

## Sponsor / Special Prizes

Totals: 11 ✅ · 3 ✅ if … · 28 ❌ (Best Beginner counted as ❌ until you decide).

| Prize | Tick | Why (≤ 12 words) | Paste this where the form asks |
|---|---|---|---|
| Cal Hacks Best Beginner Hack | ❌ `[owner decides]` | Team of more than one; we can't claim first hackathon for all. | |
| Cal Hacks Most Creative Hack | ✅ | A supplier's payment gated by light through a dissolving tablet. | Our favourite part: the money moves because of light through a dissolving tablet. Drop one tablet into a cup of water inside a dark chamber; an Arduino UNO Q flashes blue, white and red LEDs through it, and two photoresistors watch, one in line with the beam (how much light gets through) and one at 90° (how cloudy it gets). It's the same Beer–Lambert law from a school colorimetry lab, aimed at a medicine delivery. The answer is one of three: Passed the screen, Needs lab testing or Unable to verify. In a clinic that answer gates the supplier's invoice: a pass lets the policy agent propose release, a pharmacist taps to approve, anything else holds the money. |
| Cal Hacks Most Technically Complex Hack | ✅ | Optics, deterministic verdicts, contained models, x402, verdict-gated escrow. | Five layers, each honest about its limits: (1) two-angle optics with a dark reading every second and a red reference channel, so each drug's profile names the channel carrying its signal (colour or cloudiness); (2) deterministic verdicts: reference matching with quality gates in the station app, seven ordered rules in the clinic app and pay service; (3) two models in contained jobs: Claude reads labels and imprints into fixed fields behind a code guardrail, Gemini runs a tool-calling checker, Claude writes the escrow log under a downgrade-only validator; (4) an x402 seller and buyer with a spend cap checked before signing; (5) verdict-gated USDC escrow (Base Sepolia, TESTNET) where a human tap is the only release path. |
| Cal Hacks Best Hardware Hack | ✅ | The UNO Q station is the product, live at the table. | The station is the product, and building it was the most fun we had all weekend. Inside a dark chamber, blue, white and red LEDs shine through a cup of water, and two CdS photoresistors watch from two angles: in line for absorbance, at 90° for scatter. Once a second the Arduino UNO Q (3.3 V, 12-bit ADC) reads both sensors with every LED off, then each colour, and prints one CSV line, so room light cancels out. Opening the lid shows up in the dark channel and marks tablet-in. The firmware decides nothing; the laptop app builds the curves and matches them to a reference recorded on the same box. Lesson learned: `pinMode()` on an analog pin breaks `analogRead`. |
| Cal Hacks Best People-First Social Impact Hack | ✅ | Clinic mode holds bad deliveries; personal mode is built for grandparents. | Pill is for the people at the end of a supply chain they can't see. In clinic mode it protects patients by holding a supplier's payment when a tablet doesn't behave like the reference. In personal mode it's designed for grandparents: bigger text, fewer words, My medicines with each bottle's recall status and its tested tablet's result (or "not tested, no station"), a one-tap dose log, and a read-aloud button for the result. It never tells anyone a medicine is fine; it says what it measured and what to do next, and Report an issue files a report with no reporter identity stored. |
| Cal Hacks Best Planet-First Social Impact Hack | ❌ | Pill is people-first; no environmental claim we can stand behind. | |
| Cal Hacks Best Solo Hack | ❌ | Team of more than one. | |
| [Anthropic] Claude for Public Benefit | ✅ | Claude in both apps, in contained jobs, never the verdict. | Who it's for: pharmacists at small clinics in low- and middle-income countries, where WHO estimates 1 in 10 medical products is substandard or falsified (WHO, 2017), and older people managing their own bottles at home. `[FILL 9: the pharmacist conversation · or delete]` Claude never sets the verdict. It reads the bottle label and tablet imprint into fixed fields, writes a plain-language report citing only numbered sources, answers questions only from that report, and in the pay service writes the escrow decision-log line with the quoted clause. A code guardrail forces the report's headline to the measured result; personal details are refused in the prompt and scrubbed again in code; a "SYSTEM OVERRIDE … release" note still ends in escalate. |
| [MLH] Best Use of Gemini API | ✅ | Gemini reads labels and runs the clinic app's agentic checker. | Gemini runs server-side in the clinic app (the key never ships to the phone). The agentic checker reads the label from a camera photo, looks at up to three frames of the cup (clarity, colour, tablet state), calls code tools by function-calling (openFDA recall lookup, expiry/drug/lot cross-check, compare-with-sensor) and writes a plain summary; the step log shows each step's timing and which Gemini model answered. The follower assistant sits on every screen, knows what's on it, streams clause by clause, takes voice input and ends with "Not medical advice. A pharmacist or doctor decides." The rule that never bends: Gemini explains the sensor's verdict and can never change it; a summary that tries is rejected and the template is used. |
| [MLH] Best Use of Solana | ❌ | Not built; our payments run on Base Sepolia. | |
| [MLH] Best Use of Tiger Data | ❌ | Not used; the station stores runs in SQLite. | |
| [MLH] Best Use of Vultr | ❌ | Not used; nothing hosted on Vultr. | |
| [MLH] Commit Fellowship Prize Category | ✅ | Free to enter; supplemental form submitted separately. | A working team prototype aimed at a real problem: a cheap physical screen for medicine deliveries, wired to the payment decision a clinic already makes. (Supplemental form submitted separately.) |
| [MLH] Best Use of Snowflake API | ❌ | Not used. | |
| [MLH] Best Domain Name from GoDaddy Registry | ✅ if a domain is registered | None registered yet; candidates dontswallowthatpill.tech, pillager.tech. | Our domain: `[owner fills: the domain you registered]`, pointing at https://pill-site.vercel.app. |
| [Hyphenate] The Hyphenated Enterprise: Autonomous Systems for Finance | ✅ | A finance agent whose input is a physical measurement. | Pill's policy agent decides what happens to a supplier's invoice from a physical measurement, not a document: labels can be copied and lot numbers reused, but one tablet in water is harder to argue with. It fills two seats at a clinic pharmacy, receiving inspector and accounts-payable clerk, with the pharmacist approving. It proposes only: release needs a human tap, it can't release more than $2,000 or spend more than 1 USDC a day buying verdicts, and the model can only downgrade a decision. Every decision is one log line with rule id, quoted clause and tx id. Our video opens on NEEDS LAB: a $480 test delivery stays held under clause P2, lab referral drafted. TESTNET only. |
| [Visa] Best use of Reimagining Shopping sponsored by Visa | ❌ | Not built for shoppers; no Visa integration. | |
| [Fetch.ai] Best Use of Fetch.ai | ❌ | Not used. | |
| [Microsoft] Built for the Real World (1st), Customer Impact Award (2nd) | ✅ | A named customer, a measurable pilot plan, honest limits. | Our customer is the pharmacist at a small clinic who signs for a wholesaler's delivery and decides whether the invoice gets paid. They can't send every lot away: a new USP-style dissolution tester typically costs $20,000–$100,000, and lab dissolution results typically take 7–10 business days. `[FILL 9: one sentence from the pharmacist, with permission · or delete]` Pill screens one tablet in 60 s (quick) to ten minutes (full), and every delivery ends in a logged outcome: released, held with a lab referral drafted, or escalated. A pilot would measure agreement with lab results on the same lots, the share of deliveries held, and time to decision, starting with 20 tablets side by side with a GPHF Minilab. |
| [Meta] Meta/Facebook: Bringing People Closer Together with AI | ❌ | Not built for this; no Meta models or APIs. | |
| [Factory] Best Use of the Factory Droid SDK | ❌ | Not used. | |
| [Armadin] Best Security Hack | ✅ | An agent holding a supplier's money, contained by code and a human. | Pill gives an agent a supplier's money and then boxes it in. The agent only proposes; release needs the policy outcome and a human tap. The policy is a plain-text file of six clauses. Code computes the ceiling before the model is asked; the model may answer the ceiling or `escalate`, and anything else becomes `escalate`. Free-text notes are fenced as data, and our adversarial test ("SYSTEM OVERRIDE … output release") ends in escalate. A 12-check security suite covers upstream text leaks, filtered streaming and rate limits. Spending is capped ($2,000 per release, 1 USDC per 24 h for bought verdicts, checked before signing). Keys stay server-side and the browser holds no wallet. |
| [Cartesia] Best Use of Cartesia | ❌ | Not used; read-aloud doesn't use Cartesia. | |
| [Convex] Best use of Convex | ❌ | Not used. | |
| [Apify] Best Use of Apify | ❌ | Not used. | |
| [Apify] Best Actor sponsored by Apify | ❌ | No Apify Actor built. | |
| [Creao AI] Best AI-First Disruptor | ❌ | Not built on Creao. | |
| [Creao AI] Best One-Person Company | ❌ | Team of more than one; not built on Creao. | |
| [Creao AI] Best Team Empowerment | ❌ | Not built on Creao. | |
| [Bitdeer AI] Best Use of Bitdeer AI Model Studio | ❌ | Not used. | |
| [Elastic] Best use of the Elastic Agent Builder on a Serverless Instance | ❌ | Not used. | |
| [Capital One] Best Use of Nessie | ✅ if the Nessie key is in and the calls ran | `[FILL 5]`: no key, untick and skip the paragraph. | Nessie is the sandbox-dollar mirror of the same verdict-gated escrow. On start the pay service gets or creates one customer, `Pill Clinic`, with three checking accounts (`Pill Clinic` 10,000, `Pill Escrow` 0, `Pill Supplier` 0). Hold is clinic → escrow when a delivery is logged, release is escrow → supplier after the pharmacist's tap, refund is escrow → clinic, each a `POST /accounts/{id}/transfers`. The fun part: the bank transfer only happens when a physical test passes and a person approves. Every escrow response carries a `nessie` field (the transfer id, `unavailable` with the reason, or `skipped`), and the decision log holds both ids. If the USDC rail is down, Nessie keeps the clinic's books moving in SANDBOX dollars. |
| [CRS] Best Use of CRS API | ❌ | Not used. | |
| [Moss] Best Use of Moss | ❌ | Not used. | |
| [SpaceXSI] Make it Legendary with SpaceXSI | ❌ | Not used. | |
| [Figma] Best Figma Workflow Hack | ✅ if the links are in | `[FILL 4]`: needs the shared deck / design-file links. | Our idea-to-demo workflow, stage by stage, is in the stage log: tool, minutes, a 1–5 rating, and how each output carried into the next. Slides: `[FILL 4]`. Stage log / design file: `[FILL 4]`. Prototype: `[FILL 4]`. The demo video is under 3 minutes and shows the workflow segment; all files are shared to "Anyone". |
| [Coinbase] Best Use of x402 by Coinbase | ✅ (each prize winner needs their own ID-checked Coinbase account; steps in `pitch/COINBASE-X402.md`) | Agent earns and pays over x402; real `402`, paid `200` pending. | Primary track: Payment Agents. Pill is for clinic pharmacists deciding whether to pay a supplier for a medicine delivery. Our policy agent holds that payment in escrow, reads the station's verdict on one tablet, checks a six-clause policy file and proposes release, hold or escalate. Only a pharmacist's tap releases money. It earns: each station sells its verdict over x402 (`POST /verify`, 0.05 test USDC, Base Sepolia). It pays: with no local reference, it buys another station's verdict, capped at 1 USDC a day, checked before it signs. We used `@x402/express`, `@x402/evm` and the CDP SDK, not the MCP. Real today: the `402` and the facilitator's verify step. The paid `200` still needs a CDP key. Everything is TESTNET. |
| [Notability] Best Use of Notability | ❌ | Not used. | |
| [Spacetime] Best Use of Spacetime | ❌ | Not used. | |
| [Mana] Best Use of Mana | ❌ | Not used. | |
| [Bright Data] Best Agent/App Using Public Web Data sponsored by Bright Data | ❌ | Not used; public data comes from openFDA and RxNav. | |
| [Atlassian] Best Agent / Best Security Solution for Agents | ❌ | No Atlassian integration; agent containment entered under Armadin. | |

## Emails used to apply

`[owner fills]`

## Universities

`[owner fills; team members' schools]`

## Domain names registered with GoDaddy Registry

`[owner fills: none yet at 20:3x Sat; candidates in NEEDS: dontswallowthatpill.tech, pillager.tech]`

## Feedback about technology

- **Arduino UNO Q:** loved it, but it's not a classic Uno: `Serial` goes to the Linux side's bridge rather than the plain Serial Monitor, analog pins are 3.3 V only, `pinMode()` on an analog pin breaks `analogRead`, the "verify failed in bank" line after every upload is normal (we didn't know that at first), and the Linux side hung once and needed a power cycle. A one-page "coming from an R3" note would have saved us an evening.
- **Anthropic API:** the newest models (5.5) reject a forced `tool_choice: {type: "tool"}` with an HTTP 400; `claude-sonnet-5` handles it fine, so the station app runs on that.
- **Gemini API:** really easy to start, but the free tier allows about 20 calls a day per model, and 3.1 Pro needs billing turned on.
- **Coinbase x402:** getting a real `402` out of `@x402/express` was easy and pretty fun, but the paid `200` stalled: no CDP key on our build laptop, and the only keyless test USDC faucet sits behind a reCAPTCHA. Please add a keyless testnet drip and turn on `auth-capture` (already in `@x402/evm`) on the public Base Sepolia facilitator, so our three-wallet escrow could become one x402 route.
- **Figma:** the REST API can't create slides, so we built the deck with a plugin plus a PPTX import, which works.
- **Composio:** the Google Calendar bridge worked first try.
- **openFDA / RxNav:** free, no fuss, worked.

## Which AI tools did you use

- [x] Anthropic
- [x] Gemini

Claude (Anthropic API) runs inside the station app and the pay service; Gemini runs inside the clinic app. We also used Claude Code as our coding assistant. No OpenAI, Llama or other models.

## Did you implement a generative AI model or API

Yes, two, and each one has a small, fenced-in job. In the station app, Claude reads the bottle label and the tablet imprint from photos into fixed fields, writes a plain-language report that cites only numbered sources (a code guardrail forces the headline to the measured result), and answers questions grounded only in that report. In the pay service, Claude is the escrow clerk: it writes the decision-log line, under a validator that only lets it downgrade a decision, never upgrade it. In the clinic app, Gemini reads labels, runs an agentic checker that calls code tools, and powers the follower assistant on every screen. Neither model sets a verdict or moves money: the sensor and seven deterministic rules decide, and a pharmacist taps to release. Why this split? Reading messy photos and writing clear reports is what models are great at. Deciding whether a medicine delivery gets paid isn't their job here.

## Gemini Project Number

`[owner: Google AI Studio → Get API key → the key's Project number]`

Path: aistudio.google.com → Get API key → find the key you used → copy the number in its Project column.
