# Pill: website plan v2 (Sat 2026-10-24 ~00:40, planning only)

v1 said "plain page". Preston wants it premium, with a 3D orientation of the device and the story, timeline and problems visible. v2 keeps every honesty rule from the debate and adds the luxury on top of real material: real photos, the real CAD, the real curves. Sources: `website-debate-2026-10-24.md`, `research/website-references-2026-10-24.md`.

## 1. The direction: "editorial lab", not "SaaS template"
Think a product page from Teenage Engineering or Aevion, written in the voice of a lab notebook. Big quiet type, lots of space, one accent colour (the LED blue), photographs of the real object, one orbitable 3D model, data drawn as art. Luxury here means restraint and precision, not gradients.

The 3D model is free for us: **the station is 3D-printed, so its CAD file already exists**. Export it as GLB, load it with `<model-viewer>` (Apache 2.0, one tag), add five hotspots (blue LED, sensor at 0°, sensor at 90°, thermistor, paddle; plus the phone window on the lid). It is the real design, not a render of an imagined one. Exploded view = second GLB state (or a second model) toggled by a button. Poster image for first paint, lazy load, ≤ 3 MB.

"Scans" = the data. The dissolution curve is the second hero: the real B2 run drawn as a thin blue line over the grey pass band, the Tums run flat beside it. Every chart on the site is real data from the box with a run id under it.

## 2. Length (desktop)
| Measure | Target |
|---|---|
| Sections | 10 |
| Scroll length | ~9 screens (≈ 8,000 px at 1440×900); mobile ≈ 15 screens |
| Words | 550–700 total; no paragraph over 3 sentences; H1 ≤ 7 words |
| Images | 10–12 real photos (hero, 4 build photos, 6 app screenshots) |
| 3D | 1 GLB (station), exploded toggle, 6 hotspots |
| Video | 1 clip, 90 s, click-to-play, captioned, ≤ 15 MB |
| Charts | 2 (Fig 2 curve; the 15-run calibration overview) |
| Weight | ≤ 6 MB on first load incl. GLB (poster first); Lighthouse mobile ≥ 85; `prefers-reduced-motion` turns every animation into a static state |
| Time on page a judge needs | 60 s to get the story from the first 3 screens; 3 min for all of it |

## 3. The story in 10 beats (each beat = one section = one sentence; these sentences are also the Devpost headings and the video script)
| # | Beat | Section title | Visual | Motion |
|---|---|---|---|---|
| 1 | The object | **The box measures. Pill explains.** | real photo of the station, lid open, tablet beside it; under it: "$40 lab-in-a-box. One tablet. About N minutes. PASS / NEEDS LAB / UNABLE TO VERIFY." Button: Watch the 90-s demo | type fades up; photo has a slow 2 % scale on load |
| 2 | The problem | **One in ten.** | WHO sentence, LSHTM 64,000–158,000 sentence, "lab rigs cost five figures and sit far from the people who need them." Stat band: 1 in 10 · 64k–158k · $40 · 3 verdicts, each linked | numbers count up once in view |
| 3 | The device in 3D | **Fig 1. The station.** | `<model-viewer>` orbit, 6 hotspots with one-line labels, Exploded toggle, "Printed Saturday at Cal Hacks, file linked" | auto-rotate slowly until touched |
| 4 | The physics | **Fig 2. Light through water.** | line-art SVG of the light path (LED → cup → sensor 0°, sensor 90°, thermistor, paddle, dark chamber); one sentence: "Riboflavin absorbs blue light; as the tablet dissolves, less light reaches the sensor and the curve rises." | strokes draw in on scroll |
| 5 | The scan | **Fig 3. One tablet, live.** | the real B2 curve over the grey pass band, the Tums curve flat with scatter rising, run ids, time axis; next to it the Scan screen screenshot (bar at 62 %, sensor dots) | the line draws left to right once |
| 6 | The result | **Three answers, never a guess.** | three verdict cards styled like Aevion's risk cards: PASS (green) "plateau 0.41, band 0.36–0.47, rule P1" · NEEDS LAB (amber) "scatter 0.31, limit 0.12, rule N1" · UNABLE TO VERIFY (grey) "no reference for this drug, rule U1"; the clip embedded here | cards rise with a 80 ms stagger |
| 7 | The money | **Clinic mode: the verdict holds the payment.** | Delivery screenshot: $ held (SANDBOX), decision log line (lot, time, rule, clause quoted), Release / Hold / Escalate; sentence: "NEEDS LAB holds and drafts a lab referral; UNABLE TO VERIFY escalates; a human taps every release." | none |
| 8 | The person | **Personal mode: one tablet per bottle.** | Bottle → fields → recall chip; My medicines; "Measuring a dose needs the station." | none |
| 9 | The 36 hours | **Build log.** | horizontal timeline strip with timestamps and phone photos: Fri 22:30 decision · Sat 01:00 first light reading · 03:00 ten B2 runs, band set · 10:00 print started · 13:00 first PASS on the real box · 16:00 Tums caught · 18:00 freeze · Sun 08:30 submitted. Under it **What broke**: 3–5 honest bullets (e.g. photoresistors drift with temperature; the first blank was unstable until the paddle duty was fixed; venue Wi-Fi) and what we did | strip scrolls horizontally on drag; else static |
| 10 | The limits and the credit | **What PASS does not mean. Built on Peel.** | Fig 4 verdict-rule table (U1–U3, N1–N3, P1); the "PASS ≠ safe" box; "We started from Peel (HackMIT 2026, MIT) [link]. New this weekend: …"; who built what; $40 BOM table; Devpost · GitHub · Figma links | none |

## 4. Look (the luxury part)
- **Type**: Fontshare "Satoshi" (headings, 56–88 px desktop) + "JetBrains Mono" for numbers, run ids, rule ids, timestamps. Body 18–20 px, line-height 1.6, max 62 ch.
- **Colour**: paper `#F6F5F2`, ink `#101214`, LED blue `#2F6BFF` only for links, the curve and hotspots; verdicts green `#1B8A5A`, amber `#B7791F`, grey `#6B7280`. No red. Optional dark variant (`#0B0C0E` + paper text) for sections 3–6 so the 3D and the curve sit on black like the inside of the chamber: this is the one dramatic move.
- **Layout**: 12-col grid, 1200 px max, 96–144 px section padding, one idea per screen, figure captions "Fig 1." in mono.
- **Photography**: the real box, phone camera, daylight if possible, plain background (a white desk or paper), lid open and closed, the phone in the window. Build photos with mono captions and timestamps.
- **Motion**: fade-up on entry, SVG stroke draw, count-up, 80 ms card stagger, slow auto-rotate on the model. Nothing pinned, no scroll-jacking, no parallax. All off under reduced-motion.
- **Details that read as expensive**: consistent 8-px rhythm; hairline rules; numbers in tabular mono; captions under everything; hover states that only change colour; a favicon; an OpenGraph image (the hero photo with the H1); a printable "Report" page link.

## 5. Timeline (design and build), two people, Sat
| Time | Design (Figma) | Build |
|---|---|---|
| 09:00–11:00 | Figma file: 10 frames desktop + mobile, type/colour tokens, the user-journey storyboard (bottle → dissolve → verdict → payment gate). Public link for Devpost | repo `web/`, Next.js static export or Astro, fonts, tokens, layout shell, deploy pipeline (GitHub Pages/Netlify/teammate's Vercel) |
| 11:00–13:00 | Fig 1 SVG line art; hotspot copy; photo shot list executed (hero, build photos) | sections 1–2 + stat band; `<model-viewer>` with a placeholder GLB |
| 13:00–15:00 | export GLB from the printer's CAD (exploded = second file); verdict card copy | sections 3–4; model hotspots; SVG draw-in |
| 15:00–17:00 | screenshots from the app (Scan, 3 verdicts, Delivery, Bottle, My medicines) | sections 5–6 with the real CSV chart; video embed |
| 17:00–19:00 | build-log photos picked and captioned; What-broke bullets | sections 7–10; BOM table; links |
| 19:00–20:30 | copy pass with the honesty word list | mobile pass, reduced-motion, Lighthouse, OG image, deploy |
| 20:30–22:00 | — | Devpost page uses the 10 headings; draft submitted by 22:00 |
Total: ~10 h design+content, ~11 h build; both tracks fit one Saturday with the hardware and app teams feeding assets at 13:00, 15:00 and 17:00. If the GLB is late: section 3 ships with the exploded photo and gets the model Sunday 07:00 or not at all.

## 6. The problems the site must answer (judge attacks, each answered on the page)
1. "Peel exists." → beat 10 names it first and lists what is new.
2. "Is this safe to use on a real antimalarial?" → beat 10's box: PASS ≠ safe; one reference drug; unable to verify by design.
3. "Did you fake the demo?" → beat 5 and 9: run ids, timestamps, the raw curves, what broke.
4. "Why would anyone let software hold money?" → beat 7: a human taps every release; the policy is quoted on the log line.
5. "Is it just a pretty page?" → beats 3, 5, 9 are all real artefacts (CAD, data, photos); the 3D model is the printed part.
6. "How much?" → $40 BOM, itemised, beat 10.

## 7. Iteration loop (this plan keeps getting tailored)
- Round 2 now: the Debate pane runs the same 16 AI personas on v2 ("editorial lab + 3D + build log") against v1, scoring luxury-vs-honesty risk and the 10 beats.
- Round 3 Sat 11:00: Figma frames screenshotted → Design agent in the fleet for a 10-minute critique (type, spacing, hierarchy).
- Round 4 Sat 19:00: the live URL → the same personas + Lighthouse + a phone on 3G.
Each round changes this file; the decision log in PLAN.md gets one line per round.

## 8. Still not doing
Pinned Three.js scrub (11.9 MB, hard), live death counter, autoplay hero, renders of imagined hardware, stock photos, AI images, the words safe / verified / authentic / certified / guaranteed / AI-powered, purple gradients.
