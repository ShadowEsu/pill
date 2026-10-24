# Pill website: AI persona panel (2026-10-24 build day)

> **These are AI personas, not real people.** All 16 were role-played by one LLM through `completion()` on 2026-10-23, and each got a blunt in-character system prompt. Because they share a base model, the agreement is much stronger than a real panel would produce. Plain-page scores had a standard deviation of 0, and all 16 picked the same opening. Read the result as one strong opinion seen from 16 angles, not as 16 independent votes. Raw outputs, prompts and schema are in `website-debate-2026-10-24.json`.

Every persona got the same brief: the product paragraph, the judging criteria (Application, Intentionality, Functionality, Creativity, Technical complexity), the 8-hour/one-student/Sat constraint, and five questions. Q4 included example mark-downs (fake stats, "safe", stock photos, slow load, copying Peel, no screenshots), so those items were primed.

## 1. Copy an award-winning storytelling site, or build a plain honest page? ("helps win Cal Hacks", 1-10)

Reference sites named in the question: Apple https://www.apple.com, Oura https://ouraring.com, Awwwards https://www.awwwards.com. I did not open these for this panel [unverified].

| Persona | Copy storytelling | Plain + honest | Best opening |
|---|---|---|---|
| Cal Hacks main judge (700 projects, 5 min) | 3 | 8 | d |
| Figma "Best Design" judge | 4 | 8 | d |
| Anthropic DevRel judge | 3 | 8 | d |
| Hyphenate finance-agent judge | 4 | 8 | d |
| People-First public-health judge | 4 | 8 | d |
| Awwwards jury member | 4 | 8 | d |
| Senior product designer, Linear/Vercel | 3 | 8 | d |
| Mentor (20 winning teams) | 4 | 8 | d |
| Kenyan clinic pharmacist (user) | 4 | 8 | d |
| NGO procurement officer | 4 | 8 | d |
| Sponsor recruiter (Devpost scan) | 4 | 8 | d |
| YouTube viewer (3-min video) | 4 | 8 | d |
| Front-end student (builds it in 8 h) | 3 | 8 | d |
| Accessibility specialist | 3 | 8 | d |
| Ethicist | 4 | 8 | d |
| Hackathon journalist | 4 | 8 | d |
| **Mean (SD)** | **3.69 (0.46)** | **8.00 (0.00)** | **d: 16/16** |

**Verdict: build the plain, fast, honest page.** Every persona said the hardware is the "wow", and the scroll animation is not. The time is better spent on test data and the demo clip. Suggested split from two personas: about 2 h on the site and 6 h on data, or "site done by 3 pm".

## 2. Story opening ranking

Options: a) short personal-ish message ("one in ten pills..."), b) live counter/stat, c) 10-s scroll animation of a tablet dissolving, d) real device photo + one line, e) 30-s video.

| Rank | Option | 1st-place votes | Borda (5..1) | Mean rank |
|---|---|---|---|---|
| 1 | **d. Real device photo + one line** | 16 | 80 | 1.00 |
| 2 | a. Short message ("one in ten...") | 0 | 62 | 2.13 |
| 3 | e. 30-second video | 0 | 47 | 3.06 |
| 4 | c. Scroll animation of tablet dissolving | 0 | 34 | 3.88 |
| 5 | b. Live counter/stat | 0 | 17 | 4.94 |

- 15 of 16 personas ranked the live counter (b) last. The ethicist called a ticking death counter "manipulation, not data", and 5+ personas listed a fake live counter as a mark-down.
- Use (a) as the second line under the hero photo, not as the opener.
- (e) belongs in the Demo/Results section as an unedited clip, not as an autoplaying hero video. The front-end student flagged any hero video over 5 MB that autoplays, and the accessibility specialist flagged autoplay on low bandwidth.

## 3. Recommended section outline (8 sections)

Order comes from aggregating all 16 outlines into section categories, ranked by mean position. Categories used by at least 10 of 16 personas made the cut. The order matched the modal outline.

| # | Section | Used by | Mean pos. | One sentence (synthesized from persona sentences) |
|---|---|---|---|---|
| 1 | **Hero: the real box** | 16/16 | 1.0 | "A $40 box that dissolves one tablet and tells you PASS, NEEDS LAB, or UNABLE TO VERIFY in about N minutes." Use a real photo, lid open, tablet beside it, and your *measured* time. |
| 2 | **The problem** | 15/16 | 2.1 | "WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified," with the source linked inline. See the stat note below. |
| 3 | **How it works** | 16/16 | 3.5 | "LEDs shine through the dissolving tablet in a dark chamber while two light sensors and a thermistor record a dissolution curve, and the ESP32 compares it to a reference for that drug." Use one labeled diagram. |
| 4 | **Real results** (embed the unedited demo clip here) | 15/16 | 4.4 | "Here are real runs, a genuine tablet vs. a bad one, with raw curves, the reference band, the verdict each got, and our test table (N, which drugs, misses)." |
| 5 | **Clinic mode: payment gate** | 12/16 | 5.5 | "The supplier is paid only after the batch passes. NEEDS LAB and UNABLE TO VERIFY hold the payment for a human, and every decision is logged with batch ID, timestamp and data hash." |
| 6 | **Personal mode + recall check** | 10/16 (+4 separate recall) | 6.0 | "Photograph the bottle to check it against a named public recall list, and keep a 'My medicines' list." Use real app screenshots. |
| 7 | **Honest limits** | 14/16 | 6.8 | "Pill screens tablets and does not certify them. It cannot confirm identity, dose or contaminants. PASS means 'no red flags found', and anything uncertain goes to a lab." |
| 8 | **Built on Peel + team** | 16/16 | 7.9 | "We started from Peel (HackMIT 2026). This is exactly what is new this weekend, who built what, plus the repo and the itemized $40 BOM." |

Variants worth knowing:
- 4 personas wanted a separate **Demo** section right after the problem: main judge, sponsor recruiter, YouTube viewer, journalist.
- 2 wanted a "What the three results mean" block: ethicist, pharmacist.
- The NGO officer wanted "Where it fits in existing QA" and "Cost per test", comparing against Minilab (GPHF, https://www.gphf.org [unverified]) and full lab assays.
- The DevRel judge wanted a "Where AI is used and where it isn't" line.

**Stat note (verified):** The WHO 2017 release https://www.who.int/news/item/28-11-2017-1-in-10-medical-products-in-developing-countries-is-substandard-or-falsified says "1 in 10 medical products". The malaria figure in it is an LSHTM *model* estimate: "116 000 (64 000 – 158 000) additional deaths from malaria ... every year by **substandard and falsified** antimalarials in sub-Saharan Africa." The team brief's wording, "falsified antimalarials kill 100k+/yr", drops "substandard", the range, the region and the word "estimate". The ethicist would mark down exactly that. Suggested copy: *"An LSHTM model cited by WHO estimates 64,000–158,000 extra malaria deaths a year in sub-Saharan Africa from substandard and falsified antimalarials."*

## 4. Top 10 "do not do" list

These are keyword-clustered from 181 mark-down items across 16 personas. Counts are approximate, and the first six were primed by Q4.

1. **Do not say "safe", "verified", "authentic", "certified" or "guaranteed"** (16/16). PASS = "matched the reference profile / no red flags found". The ethicist suggested renaming PASS to "No red flags found" and putting a "What PASS does NOT mean" box next to every PASS.
2. **No unsourced or inflated stats, and no live death counter** (16/16). Link WHO inline with year and range.
3. **No mockups in place of real screenshots and real sensor curves** (16/16). Show one real run, with raw trace, reference band and verdict, all from the same session.
4. **No scroll-jacking, pinned sections, heavy WebGL or slow load** (16/16). Personas cited a <2 s hero, <2 MB page, Lighthouse ≥80 and 3G phones. Respect `prefers-reduced-motion`.
5. **Do not copy Peel's look or blur what is new** (16/16). Say plainly what came from Peel and what was built at Cal Hacks.
6. **No stock photos of pills, pharmacies, or African patients/clinics** (16/16). Several personas called this poverty imagery.
7. **No renders or AI images of the device** (13/16). Use the real breadboard/box, even if it is ugly.
8. **No vague or mocked payment gate** (13/16). Show a FAIL that holds payment and a PASS that releases it, the audit log entry, and what happens on UNABLE TO VERIFY and on a false fail (dispute/lab-override path).
9. **No accuracy claims without N, and do not hide false passes** (11/16). Publish the false-negative (false-pass) count. Do not present n=3 as validation.
10. **Do not hide NEEDS LAB / UNABLE TO VERIFY or show only the happy path** (9/16). Don't use color-only status either: every verdict needs text, an icon and a next step, announced through an ARIA live region.

Honorable mentions:
- Buzzwords like "AI-powered" or "blockchain" with nothing behind them (6).
- Implying WHO/FDA approval or claiming it replaces Minilab/lab testing (3).
- A demo edited to hide the real dissolve time, or hardcoded verdicts.
- A recall check with no named data source.
- Personal mode telling a patient to stop taking a medicine.
- Purple-gradient SaaS template look.
- No per-person contribution list or no real GitHub repo.

## 5. Must-haves (one per persona, condensed)

- **Main judge:** real tablets tested live at the table, a known-bad sample getting flagged, and an honest results table.
- **Figma:** an uncropped device photo next to a real verdict screen and its sensor curve, all from the same run.
- **DevRel:** a results table with n, misses, and a "what PASS does not mean" line next to it.
- **Hyphenate:** one continuous clip. A bad tablet gives NEEDS LAB and payment HELD, with an audit entry (batch ID, data hash, reason). A good tablet gives PASS and payment RELEASED.
- **Public health:** a validation table covering tested / caught / missed / inconclusive, plus "PASS ≠ safe".
- **Awwwards:** a raw curve against the reference, plus a looping GIF of the real box.
- **Linear/Vercel:** a device photo next to one real dissolution graph with the reference band and n.
- **Mentor:** a genuine vs. fake side-by-side curve graphic, which covers Functionality, Technical complexity and Intentionality at once.
- **Pharmacist:** caught / wrongly passed counts and which drugs were tested. Price. Does it need internet?
- **NGO:** false-pass rate, false-flag rate, and UNABLE TO VERIFY frequency. Anything unmeasured is labeled "unvalidated".
- **Recruiter:** an unedited clip plus who built which part.
- **YouTube viewer:** the box catching a fake pill in the first 10 seconds.
- **Front-end student:** a real curve chart (good vs. bad) next to the box photo.
- **Accessibility:** text + icon + color for every verdict, a live region, a captioned video with transcript, and a no-motion page that works on 3G.
- **Ethicist:** a "What PASS does NOT mean" box and a published false-negative rate.
- **Journalist:** real footage of a pass and a fail with the light curves on screen.

**Shared must-have (15/16 in some form): one real side-by-side run, genuine vs. bad tablet, with raw curves, verdicts and an honest results table.** It works as the site's centerpiece, the Devpost hero image and the video's first 10 seconds.

## 6. Build plan the panel implies (one student, ~8 h, free tools)

- **Stack:** a single static page in Next.js (https://nextjs.org) or plain HTML. Deploy on Vercel free tier (https://vercel.com) or GitHub Pages (https://pages.github.com) [hosting URLs not opened, unverified].
- **Motion:** CSS fade-in on scroll only, with a `prefers-reduced-motion` fallback. No scroll-jacking or WebGL. Doable in 8 h: **yes**. An Apple/Oura-style pinned scroll narrative is **not** realistic alongside hardware work, per the front-end student, mentor and main judge personas.
- **Chart:** render the real CSV from the ESP32 run as an inline SVG or with any free chart library. A static exported PNG is acceptable if time runs out.
- **Assets:** phone photos of the real box, real app screenshots, and one unedited phone clip (compressed, click-to-play, captioned).
- **Reuse:** the same 8 sentences become the Devpost sections and the 3-minute video script.

## 7. Blunt one-liners (selected)

- Main judge: "Spend 2 hours on the site and 6 on test data. A scroll animation won't save a box that only works sometimes."
- Ethicist: "Rename PASS to 'No red flags found'. A cheap box that tells someone a fake antimalarial is fine is worse than no box at all."
- Pharmacist: "Show me the real box, the real false-pass number and the price. Skip the Apple animation, because I am on 2G and a fake pill kills."
- Hyphenate: "Skip the Apple scroll and spend those hours making the payment gate real: show a fail that blocks payment and a log I can audit."
- YouTube viewer: "Show the box catching a fake pill in the first 10 seconds, or I'm gone."
- Accessibility: "A site that looks great but can't be used is a counterfeit too."
