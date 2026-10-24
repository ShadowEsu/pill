# Pill: website plan (Fri 2026-10-23 ~00:20 Sat, planning only; build Sat ~12:00–20:00, one person, ~8 h)

Sources: `website-debate-2026-10-24.md` (16 AI personas: plain honest page 8.0 vs storytelling clone 3.7) and `research/website-references-2026-10-24.md` (12 reference sites, 3 outlines, free assets, judge criteria). The site is also the Devpost page's spine and the backdrop for the 3-minute video.

## 1. The call
One static page. Story: **a problem → a device → a result → what we do with it**. Opening = the real box with one line. Short on motion: fade-ins, one drawn curve, one count-up stat band with sources, `prefers-reduced-motion` respected. No pinned 3D, no scroll-jacking, no autoplay hero video, no stock photos, no renders.

What we borrow from the award winners (structure and tone only):
- **Oura**: the two-sentence hero shape: "The box measures. Pill explains."
- **Linear / Teenage Engineering**: the lab-notebook voice: diagrams captioned Fig 1 / Fig 2 / Fig 3, line-art SVG of the light path, honest lowercase engineer tone.
- **Aevion (Awwwards SOTD Oct 2026)**: the verdict cards styled like its risk cards ("Confidence threshold exceeded at 87%", "risk level: moderate"), and numbered sections.
- **Apple AirPods**: one-sentence physics ("LEDs pulse light through the water 24 times a second; two sensors watch it dim and scatter").
- **Stripe**: the 4-number stat band, every number linked to its source.
- **Shepherd (TreeHacks 2026 grand prize)**: the cost ratio in the tagline ("$40 vs a five-figure lab rig") and captioned build photos as proof.
- **Peel**: three-part structure and the three verdict names; "Built on Peel" strip with its URL.

## 2. Page, section by section (8 sections, one sentence each, the same 8 sentences drive the Devpost text and the video)
| # | Section | Content | Motion |
|---|---|---|---|
| 1 | Hero | Phone photo of the real box, lid open, one tablet beside it. H1: **"The box measures. Pill explains."** Sub: "A $40 lab-in-a-box that dissolves one tablet and tells you PASS, NEEDS LAB or UNABLE TO VERIFY in about N minutes." (N = measured Sat.) Button: Watch the 90-s demo (click-to-play). | fade-up |
| 2 | The problem | "WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified." Second line: the LSHTM estimate, 64,000–158,000 extra malaria deaths a year in sub-Saharan Africa (substandard and falsified antimalarials). Both linked. Third line: "Lab dissolution rigs cost five figures and sit far from the people who need them." | count-up on the two numbers, once |
| 3 | How it works | **Fig 1. Light path**: line-art SVG: blue LED → cup → sensor at 0°; second sensor at 90°; thermistor; paddle; dark chamber; phone window on top. Four labels. One sentence of physics. | SVG strokes draw in |
| 4 | Real results | **Fig 2. Dissolution curve**: the real chart from Sat's runs: B2 curves (grey band = pass band), one Tums curve (flat, scatter rising), verdicts. The demo clip (click-to-play, captioned). The honest table: tablets tested, caught, missed, inconclusive, drugs covered (one). | chart line draws; nothing else |
| 5 | Clinic mode | "The supplier is paid only after the sampled tablet passes." Screenshot of the Delivery screen: held $ (SANDBOX), decision log line with lot, time, rule id, clause quoted; Release/Hold/Escalate. One line: NEEDS LAB holds and drafts a lab referral; UNABLE TO VERIFY escalates; a human taps every release. | none |
| 6 | Personal mode + recall | Screenshots: Bottle photo → fields → recall chip ("no openFDA record for this lot" / RECALL). My medicines list with the one tested tablet per bottle. "Measuring a dose needs the station." | none |
| 7 | Honest limits | **Fig 3. Verdict rules**: the plain-language table (U1–U3, N1–N3, P1). Box: "What PASS does not mean: it does not confirm identity, dose or contaminants. PASS = consistent with the reference on this box, one tablet, this lot. Anything uncertain goes to a lab." | none |
| 8 | Built on Peel + team + BOM | "We started from Peel (HackMIT 2026, MIT licence) [link]. New this weekend: the clinic payment gate, the recall-by-lot check, the two modes, the station with a phone window, every line of code." Who built what. Itemised $40 BOM. Links: Devpost, GitHub, Figma file. | none |

Stat band under section 2 (Stripe-style, each number linked): **1 in 10** · **64k–158k** · **$40** · **3 verdicts**.

## 3. Look
- Type: one grotesk from Fontshare (Satoshi or General Sans) + a mono for numbers and rule ids (JetBrains Mono). Big H1, body 18 px, generous spacing.
- Colour: off-white paper, near-black text, one accent (the blue of the LED, #2F6BFF-ish) for links and the curve; verdicts: green PASS, amber NEEDS LAB, grey UNABLE TO VERIFY; no red anywhere. Dark mode optional.
- Images: phone photos of the real box (ugly is fine), real app screenshots, the real chart. Captioned build photos (Shepherd pattern).
- Icons: Lucide.
- Accessibility: every verdict = text + icon + colour; captions on the clip; keyboard-reachable; Lighthouse ≥ 90 on mobile; page < 2 MB; works on 3G.

## 4. Build (Sat, one person, 8 h)
| Hours | Do |
|---|---|
| 0–1 | Next.js (static export) or plain HTML + CSS; Motion for fade/count-up; layout shell; fonts |
| 1–2 | Hero + problem + stat band with sources |
| 2–3.5 | Fig 1 light-path SVG (draw in Figma, export, `stroke-dashoffset` animation) |
| 3.5–5 | Fig 2 chart from the real CSV (Recharts or inline SVG); verdict cards; results table |
| 5–6 | Clinic + personal sections with real screenshots (from the app team) |
| 6–7 | Limits + Peel + team + BOM; Devpost links |
| 7–8 | Mobile pass, reduced-motion, Lighthouse, deploy |

Deploy: GitHub Pages or Netlify from the team's repo. **Not Vercel on Preston's accounts** (fleet deploy cap). A teammate's Vercel account is fine.

Figma: design the page and the app screens in a public Figma file first (even rough frames), include the user journey storyboard (bottle → dissolve → verdict → payment gate), and put the link on Devpost. Five Figma prizes at $1,000 exist; Devpost lists no criteria; Peel linked its Figma file.

## 5. Not doing (and why)
- Pinned 3D device / Three.js scrub: 11.9 MB page, hard in 8 h, judges grade the box (Aevion is the reference for the cards only).
- Live death counter: ranked last by 15/16 personas, "manipulation, not data".
- Autoplay hero video: bandwidth and accessibility; the clip sits in Real results, click-to-play.
- Renders, stock photos, AI images: 13–16/16 mark-downs.
- Words: safe, verified, authentic, certified, guaranteed, AI-powered.

## 6. Assets to collect Sat (owner: pitch lead)
Box photo lid open (hero) · box photo lid closed with the phone in the window · 4 build photos with captions · app screenshots: Scan running, Verdict PASS, Verdict NEEDS LAB, Delivery, Bottle, My medicines · the calibration chart PNG and CSV · the 90-s demo clip (phone, landscape, captions) · team photo (optional) · BOM table.
