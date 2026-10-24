# Pill · stage log (Figma "Idea to Demo")

Four stages, ≤ 200 words each. Minutes come from commit times in `figma/git-timeline.txt` (PDT, Fri 2026-10-23 → Sat 2026-10-24). Anything marked `[fill after running]` has not been done yet; we do not guess those numbers. We are a code-first team: no Figma file existed until the Pill → Figma plugin generated one from the repo, and this log says so.

## Stage 1 · Ideation

**Tools:** AI persona panels (one LLM role-playing 16–18 judges, a Kenyan clinic pharmacist, VCs, an ethicist), web research on past winners and reference sites. FigJam: the ideation board, generated after the fact by our plugin from the debate files.

**Minutes:** ≈255 wall-clock (Fri 19:40 shortlist → 23:55 website decision); panels ran unattended. FigJam board: [fill after running].

**Rating:** 4/5 (fast, cheap kills; agreement is inflated because one model played every persona)

**What we did:** Nine ideas were considered and six went through scored panels. FloodToll, DripGuard and Payout died on buildability or business. Lot beat Bill and Streets 13 votes of 16 and was renamed Pill. A second panel scored a plain, honest website 8.0 against a copied storytelling site at 3.7.

**What broke:** Plain-page scores had a standard deviation of 0: sixteen voices, one opinion, and the docs say so. Two persona replies failed to parse. Nothing visual existed; the FigJam board was built afterwards from the JSON, not used live.

**Into the project:** the PLAN.md decision table; the scope (one reference drug, three verdict words, money held on NEEDS LAB); the site's eight-section outline.

## Stage 2 · Prototyping

**Tools:** Code: `web-proto/binary-pill.html` (one HTML file) and a phone mock written in the site's own JavaScript (Vite + anime.js). Figma Make: the Run → Evaluation prompt in Appendix A.

**Minutes:** ≈65 (Fri 23:31–23:42 binary pill; Sat 00:10–01:03 site v1 → v4 with the phone mock). Figma Make: [fill after running].

**Rating:** 3/5 for code-first; Figma Make [fill after running]

**What we did:** The prototype was the product. The phone mock on the site loops calibration, bottle, recall, run, verdict and release, and those loops became APP-PLAN's twelve screens. The binary-pill hero was tried as a standalone HTML file before it went on the site.

**What broke:** Nobody without a code editor could change the prototype or click through it, which is the gap the Figma Make prompt fills. The site went through four versions in 53 minutes; v3 dropped a section and recoloured, v4 moved colour off the words.

**Into the project:** APP-PLAN.md's screen list and flows; the pill fill as the run's main visual; the live site at pill-site.vercel.app.

## Stage 3 · Handoff

**Tools:** CSS custom properties copied by hand from `pill-site/src/styles.css` to `pill/web/src/index.css`. Reverse path: the plugin writes Figma paint styles and variables; Composio `FIGMA_EXTRACT_DESIGN_TOKENS` reads them; `figma/tokens-from-figma.mjs` prints CSS.

**Minutes:** ≈7 (inside the Sat 01:19–01:26 app scaffold); palette revisited at 08:34. Composio round trip: [fill after running].

**Rating:** 2/5 by hand; Composio path [fill after running]

**What we did:** The site's 27 tokens seeded the app's 44. The plugin now puts the app's colour tokens into Figma as styles and variables, and the script reads them back as CSS, so a change made in Figma can land in code.

**What broke:** By hand, 8 of 27 tokens arrived identical, 7 changed value (some on purpose: the verdict colours were re-pointed at mint, amber and grey) and 12 were renamed or not needed (blue → sky, paper → bg). Nothing recorded which changes were intended. Composio's Figma tools read, comment and set variables but cannot draw a layer.

**Into the project:** the app's `:root`; the Tokens page; `tokens-from-figma.mjs`.

## Stage 4 · Code generation

**Tools:** Claude Code as lead agent with three parallel builder agents (screens, dashboards and motion, payments backend). The Pill → Figma plugin as the "design from code" step.

**Minutes:** ≈92 committed (app v1 01:26–01:45; v2 and backend 08:32–09:45; no commits 01:45–08:32). Plugin and deck generator: ≈30 (09:45–10:15, one agent). Real plugin run: [fill after running].

**Rating:** 4/5

**What we did:** The app (20 routes), the x402/Nessie payment service and the Claude and Gemini wiring were generated against written plans. Then the repo generated its Figma: `build-deck.mjs` turns screenshots, CSS tokens, debate JSON and this log into `deck.json`; the plugin draws the Slides deck, the Design pages and the FigJam board.

**What broke:** The scaffold's P6 rule held money only when the recall lookup was unreachable, so a delivery with no bottle attached could be proposed for release; a builder's end-to-end test caught it. A `tail -6` cut off Vercel's output, the deploy was re-run, and we got two identical production deploys. The REST API cannot create nodes, hence a plugin.

**Into the project:** the working app and payment service; `deck.json`; this deck and the Design file.

## Reusable recipe: code-first teams, generate your Figma from the repo

1. Keep the repo as the source of truth: screenshots in `dev-shots/`, tokens in one `:root`, decisions in markdown or JSON.
2. Write one generator (`build-deck.mjs`) that emits a single JSON: slides as absolutely positioned elements (text, rect, image, capsule), screenshot galleries, tokens, the log. The same JSON renders to `deck.html` for review and video.
3. Run one plugin (`plugin/`) in each editor: Slides gets the deck, Design gets screens + tokens as styles/variables + the log table, FigJam gets the decision board. Re-running replaces only its own nodes.
4. Close the loop with Composio: comment the build time, attach dev resources from each screen frame to its source file, download thumbnails, read tokens back as CSS.
5. Log honestly: every Figma step that was generated after the fact says so.

Nothing in the recipe is Pill-specific except the slide content in `build-deck.mjs`.

## Before / after (adoptability)

Measured numbers live in `figma/metrics.json` (rewritten on every build) and on slide 13. Before = estimate (slides × 20 min, screenshots × 1 min, tokens × 1 min; our assumption, not a measurement). After = measured on this machine: the build time, the plugin's own work against a stub Figma API in Node, and the real Figma run time the plugin prints ([fill after running]).

## Appendix A · Figma Make prompt (Prototyping, not yet run)

Paste into Figma Make, then share the result to "Anyone" and put the link in `figma/LINKS.md`:

> Build a clickable mobile prototype (390 × 844) of "Pill", an app that runs a tablet dissolution screen and shows one of three verdicts. Light theme: paper #F7F8F7 background, white cards with 20 px radius and a hairline border rgba(22,24,27,0.10), ink #16181B text, sky #4FB3FF for the run, mint #5FD39A for PASS, amber #E09A3A for NEEDS LAB, grey #9AA0A6 for UNABLE TO VERIFY. Headings in Instrument Serif, body in Inter, small labels in JetBrains Mono uppercase.
> Screens and flow:
> 1. Place: "Drop one quarter tablet. Close the lid." A big button "Start run".
> 2. Run: a vertical capsule (pill shape) that fills with sky blue from 0 to 100 % over about 8 seconds, a large percentage inside it, the word "dissolving" under it, a timer "0:29 / 3:00", and a four-segment timetable: fill, dissolve, settle, hold. When it reaches 100 % go to Evaluation automatically.
> 3. Evaluation: a verdict chip and big serif word. Default PASS (mint) with "Rule P1 · 100 % of reference plateau", two bars (inline channel, 90° glow) inside a dotted reference band, and a "Why" paragraph: "The plateau is inside the reference band and the glow rose with it. This is a screening result, not a lab test."
> 4. A three-way switch at the top of Evaluation flips the verdict to NEEDS LAB (amber, "Rule N1 · light dropped but no green glow") or UNABLE TO VERIFY (grey, "Rule U1 · no reference for this drug on this box").
> 5. Clinic decision: "Delivery D-0412 · $1,240.00 · SANDBOX". PASS shows "Policy proposes: release" and a button "Release payment" that changes to "Released · SANDBOX". NEEDS LAB shows "Held · lab referral drafted". UNABLE TO VERIFY shows "Escalated to a person · no money moves".
> Words: never write safe, verified, authentic, certified, guaranteed, fake, genuine or counterfeit. Money is always labelled SANDBOX.
