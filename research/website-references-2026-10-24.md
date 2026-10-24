# Pill: website references (researched 2026-10-23, for Sat 10-24 build)

Goal: one student, ~8 h, Next.js/React or plain HTML + a motion library. The site doubles as the Devpost page and the 3-min video backdrop. Story shape: **a problem → a device → a result**.

## Reference sites (12)

### 1. Peel (HackMIT 2026, Overall Track 1st + Elastic 1st), our cited base
- URL: https://plume.hackmit.org/project/qxodw-wgjqk-lidau-dxrpe · demo https://youtu.be/Yiu2wGKJ6AM · code https://github.com/viktorinkov/HackMIT-2026
- Does well: copy built on threes. Three observations ("The Bottle / The Imprint / The Pill") and three verdicts ("Passed the Screen / Needs Lab Testing / Unable to Verify"). Hard numbers: "~$100 in parts" vs "five-figure" lab, 22,000+ recall records, 84,000 reference pills. The team designed in Figma, linked the Figma file in the write-up, and animated the whole scan flow as one continuous Rive animation.
- Fit: Pill keeps the same verdict names and the same three-part structure. Credit Peel in a "Built on Peel" strip.
- Copy: **easy** (copy and structure only). No standalone Peel marketing site was found.

### 2. Shepherd (TreeHacks 2026 Grand Prize 1st)
- URL: https://devpost.com/software/raising-cane
- Does well: the tagline has a cost ratio built in ("costing ~1/20 of existing devices"). The gallery opens with a full CAD render, then captioned build photos (motor bridge, ESP32, battery pack). The body puts numbers on claims ("under 50ms", "60fps").
- Fit: Pill's tagline should state "$40 vs a lab". Use a clean render of the box as the hero and captioned build photos as proof.
- Copy: **easy**. Static images plus captions.

### 3. Theracat (Cal Hacks AI'26 Lab Track grand prize + SkyDeck) [unverified]
- URL: https://devpost.com/software/theracat (HTTP 403 for me; details from `research/winners-calhacks12-berkeley.md`)
- Fit: same judges' circuit. The winning line was "responds before the panic peaks". Pill's version: "know before you swallow / before you pay".
- Copy: n/a (narrative reference only).

### 4. Apple AirPods Pro 3
- URL: https://www.apple.com/airpods-pro/
- Does well:
  - The hero is a single product image. Assets are named `hero_startframe` and `hero_endframe`, and every section uses start/end frame pairs, which points to scroll-scrubbed transitions [INFERENCE].
  - "Get the highlights": a 6-tile carousel.
  - "Take a closer look": a tabbed product viewer with 6 hotspots (sound, fit, heart-rate sensing, IP57, force sensor, case) plus an AR `.usdz` file.
  - The fitness section explains the sensor in one line: "LEDs that pulse invisible light 256 times per second". That is the same LED + photodiode physics Pill uses.
  - Footnoted stat claims ("up to 2x").
- Fit: copy the "closer look" hotspot viewer for the box (LEDs, two light sensors, thermistor, paddle, dark chamber). Copy the one-sentence physics explanation.
- Copy: **medium**. Tabs plus crossfading images with Motion `AnimatePresence`. Skip the film and the AR file.

### 5. Aevion / "Lidar Drone Scanning" by Riotters (Awwwards SOTD Oct 6 2026, FWA of the Day Sep 2026, CSSDA)
- URL: https://drone.riotters.com/ · Awwwards https://www.awwwards.com/sites/lidar-drone-scanning · FWA https://thefwa.com/cases/lidar-drone-scanning · build notes https://mesh3d.gallery/website/aevion-autonomous-lidar-inspection-drone
- Does well:
  - Opening line: "Detecting cracks, deformations and structural risks before they become failures."
  - A 3D drone pinned in front of a huge faint wordmark. Scrolling makes it scan, uplink and fold.
  - Numbered sections (Gear 3, Solutions 4, Capabilities 5, Software 6).
  - Spec counters: "5 returns", "±2 cm", "450 m", "240,000 pts/s".
  - The Software section shows result cards: title, finding, "Confidence threshold exceeded at 87%", "risk level: moderate/low".
  - Built with Next.js + Three.js + Lenis + custom shaders; the page weighs 11.9 MB.
- Fit: the closest structural match for Pill. A device pinned on scroll, spec counters, and verdict cards that look like risk cards.
- Copy: full 3D is **hard**. **Medium** if you swap Three.js for a 60–90 frame image sequence drawn to a `<canvas>` with GSAP ScrollTrigger `scrub`.

### 6. Fauna Robotics (Awwwards SOTD Jun 16 2026 + Developer Award + Product Honors)
- URL: https://faunarobotics.com/ · https://www.awwwards.com/sites/fauna-robotics
- Does well:
  - A three-word hero over autoplay video: "Capable, safe, fun. Robots for everyone."
  - A "Trusted by" logo strip.
  - Three audience cards (developers / enterprises / researchers).
  - A "Safety-first design" block and a looping use-case carousel.
  - One CTA ("Request Robot").
  - Built in Webflow.
- Fit: the short opening line suits Pill. The audience split maps to **clinic mode vs personal mode**.
- Copy: **easy**. A muted autoplay `<video>` of the real box plus a CSS grid.

### 7. Bevel Health (Awwwards Honorable Mention May 11 2026, by NOOON)
- URL: https://www.bevel.health/ · https://www.awwwards.com/sites/bevel-health
- Does well:
  - A phone mockup that plays three sequential MP4 "parts" as you scroll [INFERENCE from asset names "Phone part 1/2/3"].
  - Floating UI chips around the phone (LDL card, chat bubbles).
  - Social proof: "Join over 2.5 million members".
  - Metric cards (Strain / Sleep / Recovery).
  - A "Finds sources you can trust" panel listing cited sources (sciencedirect, PMC, PLOS).
- Fit: Pill's app screens next to the box. A "cited evidence" card for the recall check (FDA/WHO sources).
- Copy: **medium**. Record three short screen captures of the app; play/pause them with IntersectionObserver.

### 8. Oura "How it works" + homepage
- URL: https://ouraring.com/how-it-works · https://ouraring.com/
- Does well:
  - Headline: "Oura Ring measures. Membership explains."
  - A timestamped scroll story (6:00 AM → 12:00 PM → 3:00 PM → 6:00 PM → 10:00 PM). Each step is a photo plus an app-UI overlay.
  - Homepage stat: "86% of Oura Members see their health improve", footnoted with its survey source.
- Fit: "**The box measures. Pill explains.**" The time story maps to a run: 0:00 bottle photo → 0:30 recall check → 1:00 tablet drops → 10:00 curve rises → verdict.
- Copy: **easy**. Sticky timestamps plus CSS scroll-driven fades.

### 9. Teenage Engineering OP-1 field
- URL: https://teenage.engineering/products/op-1
- Does well:
  - Lowercase, witty engineer voice ("louder, thinner and 100 times better").
  - An all-caps feature wall (~100 lines).
  - Line-art SVG diagrams with annotations ("one of the 2.4 GHz antennas is the tiny white line between the D and the E key").
- Fit: annotated line drawings of the dark chamber (LED → vial → transmission sensor, scatter sensor at 90°, thermistor, paddle). An honest voice suits a "we say 'unable to verify' instead of guessing" product.
- Copy: **easy**. Draw in Figma, export SVG, animate strokes with GSAP DrawSVG or CSS `stroke-dashoffset`.

### 10. Stripe
- URL: https://stripe.com/
- Does well:
  - A live counter at the very top ("Global GDP running on Stripe:").
  - A 4-number band under "The backbone of global commerce": 135+, $1.9T, 99.999%, 200M+. The uptime figure links to its source (status.stripe.com).
- Fit: a stat band of "1 in 10", "100,000+ deaths/yr", "$40", "3 verdicts", each linked to its WHO/source page.
- Copy: **easy**. Motion `useInView` plus `animate()` for the count-up.

### 11. Linear
- URL: https://linear.app/
- Does well: the hero is the real product UI (an issue with a live activity log), not an illustration. Three principles are captioned "Fig 0.1 / 0.2 / 0.3", which reads like a lab notebook.
- Fit: label Pill's diagrams "Fig 1. Light path", "Fig 2. Dissolution curve", "Fig 3. Verdict rules". Use a real app screenshot in the hero.
- Copy: **easy**.

### 12. SomniQ, a free Framer template (Single Product Launch & Hardware)
- URL: https://www.framer.com/marketplace/templates/somniq · preview https://somniq-wbs.framer.website/
- Does well: section order is product → how it works → specs page → reviews → pricing → FAQ. Listed PageSpeed is 95, SEO is 100, and free fonts and icons are included.
- Fit: the fastest fallback if the student chooses Framer over Next.js.
- Copy: **easy** (remix for free).

Discovery sources checked: Awwwards Health (https://www.awwwards.com/websites/health/), Awwwards Product Honors (https://www.awwwards.com/websites/winner_category_product/), mesh3d (https://mesh3d.gallery). godly.website now redirects to https://recent.design. Lapa.ninja, Land-book, Whoop (HTTP 403), Withings (product page is plain e-commerce) and Nothing (404) were not usable [unverified].

## Copy-this-structure outlines

### A. "Pinned device" (Aevion + AirPods), Next.js + GSAP ScrollTrigger, ~8 h
1. **Hero (0.75 h)**: "Is this medicine real?" Sub-line: "A $40 lab-in-a-box that dissolves one tablet and tells you." Box render or photo, one CTA (Watch demo).
2. **Problem, pinned (1 h)**: dark screen, two counters count up and stay pinned: "1 in 10 medicines in low/middle-income countries is substandard or falsified" (WHO) and "100,000+ deaths a year from falsified antimalarials". Source links under each.
3. **Device scrub (2 h)**: the box pinned center as a 60–90 frame canvas image sequence (turntable or exploded view rendered in Blender or filmed). Four callouts fade in at scroll points: LEDs · 2 light sensors · thermistor · paddle in a dark chamber.
4. **How it works, 3 steps (1.5 h)**: Bottle photo → recall check · Dissolve → light curve · Verdict. The dissolution-curve SVG path draws on scroll (DrawSVG or `stroke-dashoffset`).
5. **Three verdict cards (0.5 h)**, styled like Aevion's risk cards: Pass / Needs lab / Unable to verify, each with a one-line "why".
6. **Two modes (0.5 h)**: Clinic (gates the supplier's payment) | Personal ("My medicines").
7. **Built on Peel + team + links (0.5 h)**: cite Peel with its URL. Devpost, GitHub, Figma links.
8. **Buffer, mobile + reduced-motion pass (1.25 h)**.

### B. "One run, minute by minute" (Oura), plain HTML/CSS scroll-driven animations, ~6 h
1. Hero line: "The box measures. Pill explains." Box photo.
2. Sticky clock on the left; scrolling panels on the right:
   - 0:00 photograph the bottle
   - 0:20 recall check returns cited sources
   - 1:00 tablet drops into the dark chamber
   - 5:00–20:00 the curve rises
   - end: verdict
3. Each panel is a real app screenshot over a photo. Fade and translate with `animation-timeline: view()`. CSS scroll-driven animations reached Baseline Newly Available in Oct 2026 per https://scroll-driven-animations.style/. Load the polyfill (https://github.com/flackr/scroll-timeline) for older browsers.
4. Stat band (Stripe-style), clinic/personal split, Peel credit, demo embed.

### C. "Lab notebook" (Teenage Engineering + Linear + Stripe), Next.js + Motion, ~7 h
1. Mono or grotesk type, off-white paper background. Hero: an annotated line drawing of the box, strokes drawing in on load.
2. "Fig 1. Light path": LED → vial → transmission sensor, plus scatter sensor at 90°. Labels pop in with a stagger.
3. "Fig 2. Dissolution curve": the live chart animates from a recorded run (real data from the device).
4. "Fig 3. Verdict rules": a plain-language table of when Pill says pass / needs lab / unable to verify.
5. Feature wall in caps: "$40 BOM · ESP32 · 2 LIGHT SENSORS · THERMISTOR · DARK CHAMBER · RECALL CHECK · CLINIC MODE · MY MEDICINES".
6. Stat band, Peel credit, links.

## Free assets and tools
- **GSAP**, now 100% free incl. ScrollTrigger, SplitText, DrawSVG, MorphSVG: https://gsap.com/pricing/
- **Motion** (formerly Framer Motion), free and open source; `useScroll` uses the native ScrollTimeline: https://motion.dev/
- **CSS scroll-driven demos + 10-part course + polyfill**. The "3D Shoe Explorer" demo rotates a 3D model on scroll; reuse it for a pill: https://scroll-driven-animations.style/
- **Lenis** smooth scroll (used by Aevion; Motion has an example): https://motion.dev/examples/js-lenis-smooth-scroll
- **`<model-viewer>`**: one-tag GLB viewer, Apache 2.0, with an editor that outputs a starter site: https://modelviewer.dev/
- **Spline** community and library. Docs say the built-in library is "cleared for commercial use": https://community.spline.design/ · https://docs.spline.design/basics/what-is-spline
- **Rive** marketplace (Peel used Rive): https://rive.app/marketplace/
- **LottieFiles**: pill https://lottiefiles.com/free-animations/pill · medicine https://lottiefiles.com/free-animations/medicine · capsule https://lottiefiles.com/free-animations/medicine-capsule. Lottie Simple License allows commercial use; attribution is optional: https://lottiefiles.com/page/license
- **3D models (Sketchfab)**, check each model's CC license on its page:
  - Pill (Capsule): https://sketchfab.com/3d-models/pill-capsule-93518f94ebd540c3b9da45ab67cf5590
  - Prescription Pill Bottle: https://sketchfab.com/3d-models/prescription-pill-bottle-b06f10f8b7b64973ba8ecca08e28ee8a
  - Pill Bottle: https://sketchfab.com/3d-models/pill-bottle-c5bfdf003ead4c4793f4e9b93a9b1b79
  - Vial: https://sketchfab.com/3d-models/vial-45a28692a217483ea501c3b8425c26ba
- **Icons**: Lucide, 1,903 icons: https://lucide.dev/ · Phosphor https://phosphoricons.com/ [unverified]
- **Fonts**: Fontshare (free, ITF): https://www.fontshare.com/ · Google Fonts https://fonts.google.com/ [unverified]
- **Framer template**: SomniQ (see #12).

## What Cal Hacks judges and the Figma track reward
- **Official Cal Hacks 13.0 criteria** (https://cal-hacks-13-0.devpost.com/):
  - **Application**: who it helps, what problem, why they'd use it.
  - **Intentionality**: "every design choice should feel purposeful, with a clear sense of who it's for".
  - **Functionality**: smooth live demo, plus "a clear, meaningful video demo on devpost for sponsors evaluating asynchronously".
  - **Creativity**.
  - **Technical Complexity**.
- **Format**: 3-min pitch + 2-min Q&A. Devpost hard deadline is **Oct 25, 9:00 AM PDT**; be at the venue by 8 AM. Include an image and the GitHub repo.
  - The site should land the problem → device → verdict story in the first screen, so a 5-min table visit can use it as a backdrop.
- **Figma prizes**, five at $1,000 each: Best Use Case of Figma, Best Use Case of Figma Agent, Most Creative Use Case of Figma Agent, **Best Design**, Most Creative. Devpost lists no written criteria for them.
  - The Hive prizes page (https://hive.hackberkeley.org/prizes) loads by JavaScript and showed no prize text to my reader [unverified].
  - MLH's generic "Best Design, presented by Figma" brief: "used Figma to create an amazing design for their hack… storyboard, user journey, or mockup" (https://www.mlh.com/challenges/01a06f9d-e067-6ad9-1c6d-0218399d7a0e). Whether Cal Hacks uses this exact brief is [unverified].
- **Action for Figma**: design the site and app in Figma and put the public Figma link in the Devpost write-up, as Peel did. Show the user journey (bottle → dissolve → verdict → clinic payment gate) as a Figma storyboard frame.
- **Past signal**: Cal Hacks 12's Creao "Best Designed Web App" went to "the most polished, intuitive, and user-friendly design" (https://live.calhacks.io/prizes). Its general criteria said, "if we're having a hard time understanding the project by looking at it, there may be a problem" (https://cal-hacks-12-0.devpost.com/).
