# Pill website: AI persona panel, round 2 (v2 "editorial lab" vs v1 plain) · Sat 2026-10-24 ~00:5x PDT

> **These are AI personas, not real people.** The same 16 personas as round 1 (`website-debate-2026-10-24.md`), role-played by one LLM through `completion()`, same blunt system prompts. Same base model for all 16, so agreement is inflated: SD was 0.46 on v2, 0 on v1 and 0 on the hybrid. Read it as one strong opinion seen from 16 angles. Prompts, schema, raw answers: `website-debate-r2-2026-10-24.json`.

Every persona got: the product paragraph, the verified facts (WHO 1-in-10, LSHTM 64k–158k range, riboflavin-only, CAD exists), the judging criteria, round 1's result and do-not-do list, v1 in one line, the full v2 plan (direction, dark variant, GLB plan, length, motion, staffing change to two people, the 10 beats verbatim). Two passes: (A) the planner's seven questions; (B) attack round: everyone saw pass A's aggregate, attacked the leader, and specified the cheapest hybrid they would score ≥8 given the owner wants premium + 3D + a visible story.

## A. Scores

| | v2 (editorial lab) | v1 (plain, re-scored) | Honesty risk of v2 (1 = none, 10 = reads as overclaim) |
|---|---|---|---|
| Mean | **6.69** | **8.00** | **5.44** |
| Range | 6–7 | 8–8 | 5–6 |

6/10: main judge, Figma Best Design, Kenyan pharmacist, sponsor recruiter, front-end student. Everyone else 7. Nobody scored v2 above v1. The honesty-risk score is driven by one thing: beat 9 and the verdict-card numbers are typed before the box has measured anything.

### Hybrid ("v2.1", pass B): v1's 7–8 sections in v2's typography, paper only, no GLB, no dark flip, no timeline strip
| | Hybrid as the leader | Hybrid + exploded-parts photo + timestamped captions |
|---|---|---|
| Mean | **8.00** (16/16 gave 8) | **8.00** (16/16 gave 8) |
| "Owner will read it as premium" | | **16/16 yes** |

## B. The 10 beats: ranking and cuts

Borda from 16 rankings (max 160). Cut = "does not earn a full screen".

| Beat | Borda | Cut votes | What the panel does with it |
|---|---|---|---|
| 1 The object (hero photo) | 157 | 0 | Keep. Opener, 16/16. |
| 5 The scan (real B2 vs Tums curve) | 142 | 0 | Keep. Second hero. |
| 6 The result (three verdict cards + clip) | 130 | 0 | Keep. YouTube viewer: move the clip up under the hero. |
| 7 The money (clinic payment gate) | 109 | 0 | Keep and **expand**: Hyphenate wants three real Nessie sandbox states (Release / Hold / Escalate), each with transaction id, decision-log row, rule id, clause, timestamp, and the override path. "The gate gets less screen than the physics diagram." |
| 10 Limits + Peel credit + BOM | 101 | 0 | Keep. Absorbs the "What broke" bullets. |
| 2 The problem (stat band) | 77 | 1 | Keep, **no count-up** (16/16 drop it: "don't animate a death estimate"). Recruiter would fold it under the hero. |
| 3 The device in 3D | 56 | 4 | See §C. Becomes the exploded-parts photo. |
| 4 The physics (SVG stroke-draw) | 49 | **14** | **Cut.** One sentence as the caption under Fig 3's curve, or the hotspot labels on the parts photo. |
| 8 Personal mode | 33 | **12** | **Cut to a half-width card inside beat 7** ("same verdict, no money; measuring a dose needs the station"). One screenshot, ~40 words. Full screen blurs new-vs-Peel. |
| 9 Build log + What broke | 26 | **12** | **Cut the strip.** Keep "What broke" as 3–5 dated bullets in beat 10, written after it broke. See §E. |

Result: 7 sections, ~6 screens. Main judge: "still more than a judge will scroll".

## C. The 3D model (~3 h, CAD exists): **4/16 worth it**

Yes (DevRel, Awwwards, Linear/Vercel, accessibility): only as one GLB ≤1 MB with a real-photo poster, 3–4 hotspots at most, no exploded second GLB, and only after the print exists; a11y adds focusable `<button>` hotspots, auto-rotate off under reduced-motion, exploded photo as the default.

No (12/16), reasons in order of frequency:
- The judge is holding the real box at the table; async readers get the same six facts from a numbered photo in 20 seconds.
- "3 h" is the export; GLB with no materials looks like a grey render (the thing round 1 banned), hotspot coordinates are trial and error, the exploded second GLB is made by the hardware person while the print is running, and it all needs testing on a phone over venue Wi-Fi. Front-end student: "really 2–3 h, and the Sunday-06:00 variant means touching a frozen page two hours before submission."
- 3 MB on a cheap phone: "a spinning grey box that never finishes loading" (pharmacist); `<model-viewer>` canvas has no accessible name and eats touch scroll (a11y).
- If the Saturday print fails or warps, the page shows a CAD of a device that does not exist.
- Those 3 person-hours are the same hours the hardware team needs to go from 10 runs to 15 and to run a negative control.

**Attack-round answer, 15/16: the exploded-parts photo.** The real printed parts, ESP32, two sensors, thermistor, paddle laid out on paper, shot from above with a phone, six numbered mono callouts (LED, sensor 0°, sensor 90°, thermistor, paddle, phone window). 30–45 min, 200–300 KB, cannot be called a render, doubles as the BOM figure, "the Teenage Engineering spread" (Figma judge), "the iconic teardown shot every hardware story runs" (journalist), "shows it is $40 of hobby parts, not a spectrophotometer, which is exactly what stops anyone reading PASS as a lab certificate" (ethicist). If the print fails, lay out the breadboard instead. The mentor alone picked `glb_minimal` (≤1 MB, no hotspots, swap to the photo if the print is late at 17:00).

## D. Dark sections 3–6: **1/16 yes**

Only the Awwwards juror, and conditionally (dark device frames on the screenshots, re-tuned chart colours, drop it entirely if the GLB slips). Everyone else: a paper→black→paper flip is "the one dramatic move every Awwwards template makes", a second token set to QA in one day (two chart palettes, hairlines, light screenshots floating on black), breaks the printable Report page, grey UNABLE TO VERIFY disappears on black, hardest thing to read outdoors on a cheap screen, and it reads as "finished instrument" when the data is one vitamin. The accessibility specialist estimates `#2F6BFF` at ~4.4:1 on `#0B0C0E` and ~4.2:1 on `#F6F5F2`, failing AA on both [persona estimate, unverified: check with a contrast tool before build].

Compromise 6/16 would keep: **dark figure cards inside the paper page** for the parts photo and the two charts. "Your one dramatic move, for free" (Linear/Vercel, mentor, DevRel, People-First, Awwwards, journalist). 10/16 would drop even that.

## E. Build log + What broke: **liability 14, plus 2**

The problem is not the content, it is the date it is written. v2's timeline reads "13:00 first PASS on the real box", "16:00 Tums caught", typed on Friday night. 14 personas said the same thing: if one timestamp slips and a judge checks a photo's EXIF or the commit log, every real curve above it is discounted; nobody with 5 minutes drags a 36-hour strip anyway; a drag-only strip fails WCAG 2.5.7. The two "plus" votes (Awwwards, journalist) were conditional on it being written Sunday from the camera roll; the journalist adds that the hybrid genuinely loses "the human beat", the 3 a.m. moment, which is the quote a judge repeats at the next table.

**Attack-round answer, 16/16: `photo_captions`.** Every real photo and chart carries a mono caption from EXIF and the run log: `Sat 03:12 · run b2-07 · band not yet set`. The page becomes the timeline, the camera writes it, it cannot be pre-written, costs no section, and answers "did you fake it" at every scroll stop. "What broke" stays as 3–5 bullets in beat 10, written after it broke, each with the run id that proves the fix. The hour-by-hour story goes in Devpost's Challenges field.

## F. What to keep from v2 (16/16 unless noted)

Keep: typography (Satoshi + JetBrains Mono), 12-col grid and "Fig N." mono captions, mono numbers and run ids, verdict cards with rule ids, the 15-run calibration overview chart, the printable Report page, the OG image. Split: dark figure cards on paper (6 keep / 10 drop), 80 ms card stagger (3 keep / 13 drop). Drop 16/16: stat-band count-up, SVG stroke-draw, exploded-view toggle, dark section flip, timeline strip.

## G. Top attacks at the table that v2 does not answer

1. **Pass band fitted on the runs it is tested against** (10/16): "0.36–0.47 came from the same ten B2 runs; show me a run outside the band, a tablet the box had never seen that got PASS, and how many runs you threw out." Nothing on the page states N-in / N-out or whether the band was fixed before the Tums run.
2. **No same-drug negative control** (8/16: ethicist, pharmacist, NGO, People-First, mentor, Hyphenate, Awwwards, recruiter): Tums is a different chemistry, the easy case. "Run an under-dosed, chalk-cut or expired B2 tablet; print its curve outside the band; put the false-PASS count on the page." The pharmacist: "a tablet pressed with the right yellow dye and no riboflavin: does your box say PASS?"
3. **Numbers typed before measurement** (DevRel, Figma, front-end): "Point to 0.41, 0.36–0.47, 0.12, 15 runs, 13:00 first PASS and tell me which were measured by that box."
4. **The gap between the stat band and the reference drug** (People-First, journalist): "Your problem screen is antimalarial deaths in sub-Saharan Africa; your only calibrated drug is a vitamin from Safeway. How far is riboflavin from artemether, and why isn't that on the page?" Suggested: a coverage line under the stat band, "today: riboflavin only; antimalarials: not yet".
5. **The payment gate is one screenshot** (Hyphenate): "Show the three Nessie transactions with ids and the decision-log line each points to; when a human taps Release on NEEDS LAB anyway, what does the ledger record?"
6. **Which verdict rules are yours vs Peel's code** (recruiter).
7. **Clip buried at section 6, and is it one uncut run?** (YouTube viewer).
8. **Motion off, GLB blocked, 200 % zoom: can I still read every verdict and number?** (accessibility).

## H. The plan the panel converges on (one line each)

- Build the hybrid first, live by 15:00–17:00 Saturday: v1's sections in v2's type, grid and captions, paper only. Then stop adding.
- Fig 1 = the exploded-parts photo with six numbered callouts, taken once the print is out. No GLB unless everything else is frozen; one GLB ≤1 MB at most.
- Mono timestamp + run id under every photo and chart; "What broke" bullets in the limits section, written after the fact; no timeline strip.
- Cut beats 4, 8, 9 into captions and cards; 7 sections.
- Give the saved 3 h to the hardware: five more B2 runs, one under-dosed/adulterated B2 negative control, a held-out run shown outside the band, a false-PASS line on the calibration chart.
- Expand beat 7: three real Nessie sandbox states with transaction ids and decision-log rows.
- No count-up on a death estimate. No dark flip. Fix the accent blue to pass AA before anything else.
- Do not write any plateau number, run count or "first PASS" time until the box has produced it; every "Fig." label must be real data.

## I. Blunt lines (selected)

- Main judge: "A plain page with true numbers beats an editorial page with placeholders, and I will check."
- Figma Best Design: "Premium is a well-set figure caption and one honest exploded photo, not a 3 MB model."
- Linear/Vercel: "The only honest premium is a page where every number already happened."
- Hyphenate: "Spend the 3 hours you were going to burn on the GLB on the money beat: three real Nessie screenshots, each with the decision-log row, transaction id and timestamp."
- Kenyan pharmacist: "Premium to a pharmacist is a page that loads on a $60 phone and shows me the run where your box said NEEDS LAB on a bad tablet."
- Ethicist: "Before you touch a font, run one under-dosed B2 tablet and print its curve outside the band; the only thing that makes this page honest is a PASS the box was capable of refusing."
- Journalist: "Don't animate a malaria death estimate counting up; put the real parts on the table, stamp every photo with the time it was actually taken, and let the box's own bad night be the story."
- Front-end student: "Anything with a GLB, a theme switch or a drag strip in it is a Sunday-7-AM bug, not a point on the rubric."
