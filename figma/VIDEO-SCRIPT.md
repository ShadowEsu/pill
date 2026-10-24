# Demo video: Pill, Idea to Demo (2:55 max)

Record at 1920×1080. Sources: the station on the table, the app (phone or `localhost` at 390 wide), Figma desktop, `figma/deck.html?present`. Words on screen use only PASS / NEEDS LAB / UNABLE TO VERIFY; money is SANDBOX / TESTNET.

| Time | Shot | Voice-over (say this) |
|---|---|---|
| 0:00–0:12 | **The moment.** Hand drops a chalk tablet into the cup, lid closes; cut to the app: the pill fill stalls, card reads NEEDS LAB, delivery shows "Held · SANDBOX". | "This tablet came in a delivery. Pill just held the supplier's payment." |
| 0:12–0:25 | Deck slide 3 (one in ten) full screen. | "WHO estimates 1 in 10 medical products in low- and middle-income countries is substandard or falsified. The lab instrument that catches it costs $20,000 or more." |
| 0:25–0:55 | **The app, PASS run.** Bottle photo → lot check → place → pill fills to 100% → PASS, rule P1 → Delivery → pharmacist taps Release → "Released · SANDBOX". | "One tablet, about three minutes. Seven rules decide; Claude only explains. Release still needs a person's tap." |
| 0:55–1:05 | Third tablet with no reference → UNABLE TO VERIFY → escalated. | "Anything Pill can't compare, it says so." |
| 1:05–1:15 | Coinbase slide (8), then the app's /verify x402 screen. | "Payments run on x402 and USDC on Base, testnet." |
| 1:15–1:40 | **The workflow.** Deck slide 11, then the stage log slide 13 and "What broke" (14). | "We're a code-first team. No Figma Friday night: ideas were killed by AI persona panels, prototypes were HTML. So we made Figma from the repo." |
| 1:40–2:20 | **The plugin building the deck live.** Terminal: `node figma/build-deck.mjs` (prints 18 slides, size). Figma Slides: Plugins → Pill → Figma → deck.json → Build; slides appear one by one; panel shows "Done in N s". Quick cut: same plugin in a Design file (App screens page scrolling past every screenshot; Tokens page) and FigJam (persona board). | "One JSON from the repo, one plugin. Slides get the deck, Design gets every screen and our tokens as styles, FigJam gets how we decided." |
| 2:20–2:40 | Composio: comment appears in Figma; dev resource on a screen frame links to its source file; `tokens-from-figma.mjs --diff` prints CSS. | "Composio closes the loop: comments, links back to the code, and tokens back to CSS." |
| 2:40–2:55 | Slide 15 (before/after), then slide 18 (ask). | "Hours by hand, by our estimate. Seconds with the plugin. Next: real calibration runs and one clinic." |

Only record the 1:40–2:40 shots after the plugin and Composio steps have actually run (RUN.md, COMPOSIO.md). If they have not, cut that block and show `deck.html?present` instead, saying "the deck preview generated from the repo".
