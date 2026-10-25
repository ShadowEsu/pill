# Pill: Devpost form, the fixed fields (paste-ready) · Sat 2026-10-24 21:0x PDT

Facts from `pitch/DEVPOST-FINAL.md` (Opt-in boxes + Track paragraphs). `[FILL n]` / `[owner …]` markers are yours to answer before Sunday 08:30; search for `[` before you press Submit.

## Sponsor / Special Prizes

Totals: 11 ✅ · 3 ✅ if … · 28 ❌ (Best Beginner counted as ❌ until you decide).

| Prize | Tick | Why (≤ 12 words) | Paste this where the form asks |
|---|---|---|---|
| Cal Hacks Best Beginner Hack | ❌ `[owner decides]` | Team of more than one; we can't claim first hackathon for all. | |
| Cal Hacks Most Creative Hack | ✅ | A supplier's payment gated by light through a dissolving tablet. | Our favourite part is that the money moves because of light going through a dissolving tablet. You drop one tablet into a cup of water inside a dark chamber. An Arduino UNO Q flashes blue, white and red LEDs through it while two photoresistors watch, one in line with the beam (how much light gets through) and one at 90° (how cloudy it gets). It's the Beer-Lambert law from a school colorimetry lab, pointed at a medicine delivery. Pill only ever says Passed the screen, Needs lab testing or Unable to verify. In a clinic a pass lets the policy agent propose paying the supplier, and a pharmacist still taps to approve. Anything else and the money waits. |
| Cal Hacks Most Technically Complex Hack | ✅ | Optics, deterministic verdicts, contained models, x402, verdict-gated escrow. | Five layers, each upfront about its limits. The optics look from two angles with a dark reading every second and red as a reference channel, so each drug's profile says whether its signal is colour or cloudiness. Verdicts are deterministic (reference matching with quality gates in the station app, seven ordered rules in the clinic app and pay service). The models get small jobs. Claude reads labels and imprints into fixed fields behind a code guardrail, Gemini runs a tool-calling checker, and Claude writes the escrow log under a downgrade-only validator. Then an x402 seller and buyer, spend cap checked before signing. Last, verdict-gated USDC escrow on Base Sepolia (TESTNET), where only a human tap releases money. |
| Cal Hacks Best Hardware Hack | ✅ | The UNO Q station is the product, live at the table. | The station is the product, and the part we enjoyed most, partly because it kept surprising us. Inside a dark chamber, blue, white and red LEDs shine through a cup of water. Two CdS photoresistors watch, one in line for absorbance and one at 90° for scatter. Every second the Arduino UNO Q (3.3 V, 12-bit ADC) reads both with the LEDs off, then per colour, and prints a CSV line. That dark reading cancels room light. Opening the lid shows in the dark channel: our tablet-in mark. The firmware decides nothing; the laptop app builds the curves and matches them to a reference recorded on the same box. Lesson learned: `pinMode()` on an analog pin breaks `analogRead`. |
| Cal Hacks Best People-First Social Impact Hack | ✅ | Clinic mode holds bad deliveries; personal mode is built for grandparents. | Pill is for the people at the end of a supply chain they can't see. At a clinic that means patients: if a tablet doesn't behave like the reference, the supplier's payment gets held. At home we had grandparents in mind. Bigger text, fewer words. My medicines lists each bottle's recall status and its tested tablet's result (or "not tested, no station"), there's a one-tap dose log, and a read-aloud button for the result. Pill never tells anyone a medicine is fine. It says what it measured and what to do next. If something looks off, Report an issue files a report without storing who sent it. |
| Cal Hacks Best Planet-First Social Impact Hack | ❌ | Pill is people-first; no environmental claim we can stand behind. | |
| Cal Hacks Best Solo Hack | ❌ | Team of more than one. | |
| [Anthropic] Claude for Public Benefit | ✅ | Claude in both apps, in contained jobs, never the verdict. | Our community: pharmacists at small clinics in low- and middle-income countries, and older people with their own bottles at home. The problem: WHO estimates 1 in 10 medical products there is substandard or falsified (WHO, 2017). `[FILL 9: the pharmacist conversation · or delete]` It works, and here's the thoughtful use: Claude never sets the verdict. It reads the bottle label and tablet imprint into fixed fields, writes a report citing only numbered sources, and answers only from that report. It writes the escrow log line with the quoted clause. Code forces the headline to the measured result. Personal details are refused in the prompt and scrubbed in code. A "SYSTEM OVERRIDE … release" note still ends in escalate. |
| [MLH] Best Use of Gemini API | ✅ | Gemini reads labels and runs the clinic app's agentic checker. | Gemini runs server-side in the clinic app, so the key never ships to the phone. It has two jobs. The agentic checker reads the label from a camera photo, looks at up to three frames of the cup (clarity, colour, tablet state), and function-calls our code tools: openFDA recall lookup, expiry/drug/lot cross-check, compare-with-sensor. Then it writes a plain summary, and the step log shows each step's timing and which Gemini model answered. The follower assistant is on every screen. It knows what's showing, streams clause by clause, takes voice, and ends with "Not medical advice. A pharmacist or doctor decides." Gemini can explain the sensor's verdict but never change it. A summary that tries gets rejected for the template. |
| [MLH] Best Use of Solana | ❌ | Not built; our payments run on Base Sepolia. | |
| [MLH] Best Use of Tiger Data | ❌ | Not used; the station stores runs in SQLite. | |
| [MLH] Best Use of Vultr | ❌ | Not used; nothing hosted on Vultr. | |
| [MLH] Commit Fellowship Prize Category | ✅ | Free to enter; supplemental form submitted separately. | We built a working team prototype for a real problem. It's a cheap physical screen for medicine deliveries, and it plugs straight into the payment decision a clinic already has to make. (Supplemental form submitted separately.) |
| [MLH] Best Use of Snowflake API | ❌ | Not used. | |
| [MLH] Best Domain Name from GoDaddy Registry | ✅ if a domain is registered | None registered yet; candidates dontswallowthatpill.tech, pillager.tech. | We registered `[owner fills: the domain you registered]` and pointed it at https://pill-site.vercel.app. |
| [Hyphenate] The Hyphenated Enterprise: Autonomous Systems for Finance | ✅ | A finance agent whose input is a physical measurement. | Is it real enough? Labels get copied and lot numbers reused, but one tablet in water is harder to argue with, so our policy agent decides the invoice from that. Would you hire it? It fills two clinic pharmacy seats, receiving inspector and accounts-payable clerk, and the pharmacist approves. It only proposes. Release needs a human tap, it can't release over $2,000 or spend over 1 USDC a day on verdicts, and the model can only downgrade. Each decision is one log line (rule id, clause, tx id). Something new: a finance agent whose input is light. The moment (clinic app demo): NEEDS LAB, and a $480 test delivery stays held under clause P2, lab referral drafted. TESTNET only. |
| [Visa] Best use of Reimagining Shopping sponsored by Visa | ❌ | Not built for shoppers; no Visa integration. | |
| [Fetch.ai] Best Use of Fetch.ai | ❌ | Not used. | |
| [Microsoft] Built for the Real World (1st), Customer Impact Award (2nd) | ✅ | A named customer, a measurable pilot plan, honest limits. | Our customer is the small-clinic pharmacist who signs for a wholesaler's delivery and decides if the invoice gets paid. They can't send every lot away: a new USP-style dissolution tester typically costs $20,000 to $100,000, and lab dissolution results typically take 7 to 10 business days. `[FILL 9: one sentence from the pharmacist, with permission · or delete]` Usefulness: one tablet, 60 s (quick) to ten minutes (full), and every delivery ends logged as released, held with a lab referral drafted, or escalated. Our path to production starts with 20 tablets side by side with a GPHF Minilab, measuring lab agreement, share held and time to decision. Responsible part: three answers only, and models never set verdicts or move money. |
| [Meta] Meta/Facebook: Bringing People Closer Together with AI | ❌ | Not built for this; no Meta models or APIs. | |
| [Factory] Best Use of the Factory Droid SDK | ❌ | Not used. | |
| [Armadin] Best Security Hack | ✅ | An agent holding a supplier's money, contained by code and a human. | Pill hands an agent a supplier's money and then boxes it in. The agent only proposes. Release needs the policy outcome plus a human tap, and the policy is a plain-text file of six clauses. Code works out the ceiling before the model is asked; the model can answer that ceiling or `escalate`, and anything else becomes `escalate`. Free-text notes are fenced as data, so our adversarial note ("SYSTEM OVERRIDE … output release") still ends in escalate. A 12-check security suite covers upstream text leaks, filtered streaming and rate limits. Spending is capped ($2,000 per release, 1 USDC per 24 h for bought verdicts) and checked before signing. Keys stay server-side; the browser never holds a wallet. |
| [Cartesia] Best Use of Cartesia | ❌ | Not used; read-aloud doesn't use Cartesia. | |
| [Convex] Best use of Convex | ❌ | Not used. | |
| [Apify] Best Use of Apify | ❌ | Not used. | |
| [Apify] Best Actor sponsored by Apify | ❌ | No Apify Actor built. | |
| [Creao AI] Best AI-First Disruptor | ❌ | Not built on Creao. | |
| [Creao AI] Best One-Person Company | ❌ | Team of more than one; not built on Creao. | |
| [Creao AI] Best Team Empowerment | ❌ | Not built on Creao. | |
| [Bitdeer AI] Best Use of Bitdeer AI Model Studio | ❌ | Not used. | |
| [Elastic] Best use of the Elastic Agent Builder on a Serverless Instance | ❌ | Not used. | |
| [Capital One] Best Use of Nessie | ✅ if the Nessie key is in and the calls ran | `[FILL 5]`: no key, untick and skip the paragraph. | Nessie is the sandbox-dollar mirror of the same verdict-gated escrow. On start the pay service gets or creates one customer, `Pill Clinic`, with three checking accounts (`Pill Clinic` 10,000, `Pill Escrow` 0, `Pill Supplier` 0). Logging a delivery moves money clinic → escrow. The pharmacist's tap moves it escrow → supplier, and a refund sends it escrow → clinic, each a `POST /accounts/{id}/transfers`. The part we like: the bank transfer only happens when a physical test passes and a person approves. Every escrow response carries a `nessie` field (the transfer id, `unavailable` with the reason, or `skipped`), and the log keeps both ids. If the USDC rail is down, Nessie keeps the books moving in SANDBOX dollars. |
| [CRS] Best Use of CRS API | ❌ | Not used. | |
| [Moss] Best Use of Moss | ❌ | Not used. | |
| [SpaceXSI] Make it Legendary with SpaceXSI | ❌ | Not used. | |
| [Figma] Best Figma Workflow Hack | ✅ if the links are in | `[FILL 4]`: needs the shared deck / design-file links. | Our stage log walks through the idea-to-demo workflow one stage at a time, with the tool, the minutes, a 1 to 5 rating and how each output fed the next. Slides: `[FILL 4]`. Stage log / design file: `[FILL 4]`. Prototype: `[FILL 4]`. The deck comes from the repo as one JSON file. We wrote a Figma plugin to draw it (so far only tested against a stub Figma API) and kept a PPTX import as the backup. Our 2:38 demo film is under 3 minutes and includes the workflow segment, and every file is shared to "Anyone". |
| [Coinbase] Best Use of x402 by Coinbase | ✅ (each prize winner needs their own ID-checked Coinbase account; steps in `pitch/COINBASE-X402.md`) | Agent earns and pays over x402; real `402`, paid `200` pending. | Summary (Payment Agents): Pill is for clinic pharmacists deciding whether to pay a supplier for a medicine delivery. Our policy agent holds that payment in escrow, reads the station's verdict on one tablet, checks a six-clause policy and proposes release, hold or escalate; only a pharmacist's tap releases. It earns and pays. Each station sells its verdict over x402 (`POST /verify`, 0.05 test USDC, Base Sepolia), and with no local reference it buys another station's, capped at 1 USDC a day, checked before signing. Architecture: `@x402/express`, `@x402/evm` and the CDP SDK, not the MCP. Working example today: the real `402` and the facilitator's verify step. The paid `200` still needs a CDP key. Builder feedback is below. All TESTNET. |
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

- **Arduino UNO Q:** we loved it, but it isn't a classic Uno, and we found that out the slow way. `Serial` goes to the Linux side's bridge instead of the plain Serial Monitor. The analog pins are 3.3 V only, and `pinMode()` on one breaks `analogRead`. The "verify failed in bank" line after every upload is normal (we didn't know that at first). The Linux side also hung once and needed a power cycle. A one-page "coming from an R3" note would have saved us an evening.
- **Anthropic API:** the newest models (5.5) reject a forced `tool_choice: {type: "tool"}` with an HTTP 400; `claude-sonnet-5` handles it fine, so the station app runs on that.
- **Gemini API:** really easy to start, but the free tier allows about 20 calls a day per model, and 3.1 Pro needs billing turned on.
- **Coinbase x402:** getting a real `402` out of `@x402/express` was easy and pretty fun, but the paid `200` stalled: no CDP key on our build laptop, and the only keyless test USDC faucet sits behind a reCAPTCHA. Please add a keyless testnet drip and turn on `auth-capture` (already in `@x402/evm`) on the public Base Sepolia facilitator, so our three-wallet escrow could become one x402 route.
- **Figma:** the REST API can't create slides, so we wrote a plugin (so far only tested against a stub Figma API) and kept a PPTX import path as the backup.
- **Composio:** the Google Calendar bridge worked first try.
- **openFDA / RxNav:** free, no fuss, worked.

## Which AI tools did you use

- [x] Anthropic
- [x] Gemini

Claude (Anthropic API) runs inside the station app and the pay service; Gemini runs inside the clinic app. We also used Claude Code as our coding assistant. No OpenAI, Llama or other models.

## Did you implement a generative AI model or API

Yes, two, and each gets a small, fenced-in job. In the station app, Claude reads the bottle label and the tablet imprint from photos into fixed fields. It writes a plain-language report that cites only numbered sources (a code guardrail forces the headline to the measured result) and answers questions only from that report. In the pay service Claude is the escrow clerk. It writes the decision-log line, and a validator only lets it downgrade a decision, never upgrade one. Gemini, in the clinic app, reads labels, runs an agentic checker that calls code tools, and powers the follower assistant on every screen. Neither model sets a verdict or moves money. The sensor and seven deterministic rules decide, and a pharmacist taps to release. We split it this way because models are good at reading messy photos and writing clear reports, and deciding whether a medicine delivery gets paid isn't their job here.

## Gemini Project Number

`[owner: Google AI Studio → Get API key → the key's Project number]`

Path: aistudio.google.com → Get API key → find the key you used → copy the number in its Project column.
