# "How Pill moves money and uses models": one diagram, every surface (Sun 2026-10-25 00:1x PDT)

Owner's ask: the app and the website must really explain that we use Coinbase (x402), with a tree, the models, and arrows showing how the AI is supplied with payment. Same diagram on the site, in the clinic app, in the station app's Station page, on a deck slide and as a Devpost gallery PNG. Facts below come from `pitch/DEVPOST-FINAL.md` (lines 79–97) and the code; nothing else may be added.

## Visual rules
Words black/white; colour only in fills, lines, chips; red only for hold/recall. Arrows are ink. A **dashed** arrow means "not yet run" (the paid `200`). Reduced motion: static. Every amount carries TESTNET or SANDBOX. Never the words safe / verified / authentic / genuine / certified / guaranteed / fake / counterfeit.

## The tree (left to right, 4 columns)

**Column 1: Measure.** `One tablet` → `Station (UNO Q: blue · white · red LEDs, 2 photoresistors, 1 CSV line/s; the firmware decides nothing)` → `analysis.py (deterministic: curve maths, quality gates)`.

**Column 2: Three answers (the fork).**
- `Passed the screen` (green fill)
- `Needs lab testing` (amber fill)
- `Unable to verify` (grey fill)
Caption under the fork: "Three answers, never four. No model sets a verdict."

**Column 3: The policy agent (clinic app, `pill/pay`).** Box "Six clauses P1–P6, in code → a ceiling. Claude may only return the ceiling or `escalate`." Inputs drawn as arrows into the box: the verdict; `Recall lookup (openFDA)`; `Bottle label (Gemini → editable fields; unreadable = null)`; `Invoice amount vs cap`; `Pharmacist's tap`. Outputs (three arrows, one per answer):
- Passed + no recall + amount within cap + tap → **Release** (escrow → supplier)
- Needs lab → **Hold** + lab referral draft (red fill)
- Unable to verify → **Escalate** to a person; nothing moves

**Column 4: The money (Coinbase).** Three server wallets as boxes with arrows: `pill-clinic` → `pill-escrow` (hold, when the delivery is logged) → `pill-supplier` (release) or ← back to `pill-clinic` (refund). Label: "USDC on Base Sepolia (TESTNET) · Coinbase CDP SDK server wallets". Side box: "Capital One Nessie mirrors every move in sandbox dollars (SANDBOX)". Status chip on this column: "escrow moves: `mode: simulated` until a CDP key" (true today).

## The second lane, under the tree: selling a verdict over x402 (Coinbase x402)
`Buyer agent (another clinic or an agent with no local reference)` → `POST /verify` with a curve → **`402 Payment Required`** (0.05 USDC, Base Sepolia TESTNET; the price travels in the 402) → `Buyer reads the price, checks its 1 USDC / 24 h cap, signs` → `Facilitator verifies the signature` → **`200` + verdict JSON** (this last arrow DASHED, label "paid 200: pending a CDP key / 0.05 test USDC"). Caption: "Real 402 today; the facilitator's verify step answered (`insufficient_balance` on our unfunded test wallet)." Libraries named once: `@x402/express`, `@x402/evm`, CDP SDK. Service modes chip: `cdp · public-facilitator · simulated`, each named in every response.

## The models row (small, under everything): who does what, and what they never do
| Model | Does | Never |
|---|---|---|
| Claude (`claude-sonnet-5` in the station app tonight; `claude-sonnet-5-5` named in the Devpost text) | Station: reads the bottle label + imprint, writes the report, answers Ask, behind the guardrail. Clinic: the two-sentence "why"; the escrow clerk (returns the ceiling computed in code, or `escalate`). | Sets a verdict; moves money |
| Gemini | Clinic: reads the bottle label into editable fields (unreadable → `null`); runs the agentic checker (label, up to three cup frames, code tools for the recall lookup). | Sets a verdict; invents a field |
| Deterministic code | `analysis.py` and `rules.ts` (U1 U2 U3 N1 N2 N3 P1) set every verdict; `policy` computes the ceiling; the clause filter drops any model sentence with a banned claim word (more than half dropped → rule text instead). | Calls a model to decide |

## Where it goes (owner of each surface)
- Website `pill-site`: new section "How the money moves" after the verdicts section, SVG + the models row as a table. (SiteStory)
- Clinic app `pill/web`: `FlowDiagram` component on the Verify (x402) page and the Dashboard; during the demo the 402 → verify → 200 steps light up as they happen. (AppPhases)
- Station app `pillgate/app/static`: Station page gets the same diagram as a static inline SVG + the models row. (AppLook)
- Deck: one slide "How the money moves" with the same SVG. (FigmaFinish)
- Devpost: `pitch/diagrams/money-flow.png` for the gallery; "How we built it" names Coinbase x402 + CDP, the tree and the models in plain words with → arrows. (DevpostHumanizer)
