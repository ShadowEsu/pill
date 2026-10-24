# Pill: master plan for Cal Hacks 13.0

Last updated: Fri 2026-10-23 23:20 PDT by the helper (wZ:p1). The clock: **submit on Devpost by Sun 8:30 AM** (official 8:50/9:00). Judging Sun 10:30–12:30, table demo, 3-min pitch + 2 min questions. Venue: Palace of Fine Arts.

## 1. What Pill is (one paragraph, use it everywhere)
Pill is a $40 lab-in-a-box that tells you whether a tablet is what the label says. Drop one tablet in water inside the chamber; LEDs shine through, two light sensors watch it dissolve, and the app shows the curve filling to 100% against a known reference, then one of three answers: **pass**, **needs lab**, **unable to verify**. A bottle photo gives drug, lot and manufacturer and checks them against FDA/WHO recalls. In **clinic mode** the verdict gates the supplier's payment (test one tablet from a delivery; pass releases, fail holds and files a report, unsure asks a human). In **personal mode** it keeps My medicines, the recall checks and a simple dose log. Built on Peel (HackMIT 2026 grand prize, MIT licence), cited openly; what Pill adds is the decision after the measurement.

Why it matters: WHO estimates about 1 in 10 medical products in low- and middle-income countries is substandard or falsified (WHO, 2017). An LSHTM model cited by WHO estimates 64,000–158,000 extra malaria deaths a year in sub-Saharan Africa from substandard and falsified antimalarials. Lab dissolution rigs cost five figures and sit far from the people who need them.

## 2. Decisions so far (log every change in Discord #decisions)
| When | Decision | Why |
|---|---|---|
| Fri 19:40 | Shortlist Custody / Sensor Market / Egress | kit + niche tracks |
| Fri 20:05 | FloodToll (sell flood readings for crypto) rejected as a business | 18 AI personas: startup 2/10; buyers pay per site per year; x402 volume is speculation |
| Fri 21:00 | DripGuard (IV drip monitor) picked by 18/18 then dropped | cannot get IV sets; Preston wants bigger impact |
| Fri 21:40 | Payout (heat early warning + parametric payouts) picked 18/18 | real precedent (SEWA $340k to 46k women); dropped: no solar panel, sensor accuracy |
| Fri 22:00 | **Pill** (Peel-derived) beats Bill and Streets 13/16 | sensor → one honest number → money decision; matches every past winner pattern |
| Fri 22:25 | Clinic mode first; Preston keeps personal mode too | 16/16 AI personas said clinic only (test destroys the tablet); Preston overrides: both modes, clinic first |
| Fri 22:50 | Name: Pill | Preston |
| Fri 23:00 | Discord server + bridge; two helper panes (Desk, Debate) | so the team never waits on one agent |
| Fri 23:55 | Website: plain, fast, honest page (8 sections), not an Apple/Oura-style scroll story | 16 AI personas: 8.0 vs 3.7; "spend 2 h on the site, 6 on test data"; see `website-debate-2026-10-24.md` |

## 3. Team and roles (fill in names in Discord #plan)
- Hardware lead: chamber, wiring, calibration runs, 3D print if the booth has a printer.
- Software lead: firmware, backend, agent, app.
- Pitch lead: Devpost text, slides, video, demo rehearsal.
- Helper (wZ:p1): plan, decisions, debates, drafts, Devpost text. Desk (wZ:p3): fast answers. Debate (wZ:p4): persona panels.

## 4. Hardware we have (from Preston's photos)
ESP32 HUZZAH32 Feather V2 · Arduino Uno R3 · Raspberry Pi 3 + 7" touchscreen · GPS · 4 buzzers · L293D ×10 · DC motor + fan blade · servo · stepper + ULN2003 · relay · HC-SR04 · 2× DHT11 · thermistors ×2 · photoresistors ×2 (check the small bag; if missing, use an LED as the sensor or rent a TCS34725 at the booth) · LEDs red/green/yellow/blue/white + RGB · IR receiver + remote · tilt switch · keypad · LCD1602 · 7-segments · joystick · pots · buttons · 12 V adapter · resistors · breadboards · wire. Phones and laptops.
Not available: camera module, IMU, LoRa, solar, medical sensors.

## 5. Build plan (hours)
| Window | Hardware | Software | Pitch |
|---|---|---|---|
| Fri 23:30–02:00 | wire blue + white LED, LDR 0° and 90°, thermistor, paddle via L293D on the ESP32; tape a box light-tight; get B2 tablets (Walgreens 2141 Chestnut or Emergen-C), a Tums, a clear cup | firmware: 1 JSON reading/s over USB and Wi-Fi; dark reading, blank, run; logger | — |
| Sat 02:00–04:00 | 10 B2 runs, 3 Tums runs, 2 unknown-pill runs; save logs | curve math: absorbance vs blank, plateau, % released, time-to-80; pass band from the real spread | — |
| Sat 08:00–12:00 | booth: photoresistors/colour sensor, 3D print a cup holder if possible | app: live scan screen (bar, curve, temp, sensor dots), verdict card, bottle photo → drug/lot → recall lookup (openFDA, cached) | Devpost draft, slide 1 "built on Peel" |
| Sat 12:00–16:00 | station: phone window on top, Pi touchscreen face, lid interlock | clinic mode: Nessie sandbox escrow hold/release/escalate, decision log, PDF report; personal mode: My medicines, dose log | one paragraph per sponsor track |
| Sat 16:00–18:00 | rehearse the 3-tablet sequence under venue lights, 10× | freeze features | record fallback video |
| Sat 18:00–22:00 | enclosure polish | bug fixes only | Devpost draft submitted by 22:00 |
| Sun 00:00–02:00 | — | README: where each tool is used, real vs simulated | pitch under 3 min, the 6 attacks |
| Sun 07:00–08:30 | final run | final run | submit |

## 6. The demo (90 s) and the six attacks
Demo: bottle photo → recall clear → B2 tablet → bar fills → PASS → payment released + log. Same label, Tums inside → bar stalls, cloudy → NEEDS LAB → payment held, report. Unknown pill → UNABLE TO VERIFY → escalated. "Peel built the sensor. We made it decide something."
Attacks and answers: see `final-2026-10-23.md` §"Attacks you will get". Short form: (1) "Peel exists" → cite it, show the gate; (2) "real antimalarial?" → unable to verify, by design; (3) "open the lid" → interlock; (4) "Tums: fail or unsure?" → fail by cloudiness, rule named; (5) "why a chain?" → there isn't one; (6) "who lets a bot hold money?" → it never releases without the pharmacist's tap.

## 7. Tracks to enter and what each needs
Source: Hive live prizes feed read Sat 09:3x PDT (`hive.hackberkeley.org/api/live/prizes`, 48 rows). Preston (Sat 09:2x): "go for a lot of tracks, one by one; maybe Figma, maybe security." Each is an opt-in box on Devpost; the extra artifact is listed.

**Tier A, already built or building (enter all):**
1. **Best Hardware Hack** (Cal Hacks, Bambu A1 Mini): the station. Needs: the box working on stage.
2. **Hyphenate: Autonomous Systems for Finance** ($8K / $5K / $3K + interviews): the policy agent *is* the autonomous finance system: limited access (proposes only), clean record (decision log), knows when to ask (escalate). Needs: a demo video that **opens with the moment** (chalk tablet → payment held), a live demo they can steer, one line on the "seats" it fills, a real-vs-simulated slide.
3. **Coinbase: Best Use of x402, Payment Agents** ($500 USDC + recruiter call per eligible member): see COINBASE-TRACK.md. Needs: CDP key, summary + working example + architecture + builder feedback; per-member eligibility.
4. **Capital One: Best Use of Nessie** ($300/person; "Completeness, Creativity, Complexity"): the fiat mirror. Needs: Nessie key (GitHub login), hold/release/refund calls live.
5. **Microsoft: Built for the Real World** (Surface per member) + Customer Impact: production-minded healthcare agent; judged on customer understanding, measurable usefulness, path to production, responsible design, end-to-end. Needs: a one-page "path to production" + the pharmacist conversation.
6. **Anthropic**: named community (clinic pharmacists in low-income settings), real problem, "works on Monday", thoughtful Claude (label read + two-sentence why, clause filter) and where it could go wrong. Needs: one real conversation with a pharmacist this weekend; the failure-modes paragraph.
7. **Best People-First Hack** (Apple Watch SE): grandparent mode + clinics. Needs: the personal mode demo.
8. **Most Technically Complex** (NuPhy): two-channel optics + deterministic rules + payment agent + x402.
9. **MLH Best Use of Gen AI**: Claude. Free to tick.
10. **MLH Best Use of Tiger Data** (Stream Deck): every run's samples as a hypertable + continuous aggregate for the dashboard. Needs: Tiger Cloud account (free), 30 lines of SQL, one chart served from it.

**Tier B, one afternoon each, pick by remaining time:**
11. **Figma** (gift cards + recruiting): "idea to demo", not judged on scope. Needs: Figma Slides deck for the pitch, a stage log (≤200 words per stage: tool, minutes, 1–5 rating, how output carried forward), an embedded Make/prototype, ≤3-min video, files shared to "Anyone". We already have the design; the deck doubles as the pitch deck.
12. **Atlassian: Best Agent / Best Security Solution for Agents** (AirPods Max): our agent containment story: proposes only, caps in policy.md, model can only downgrade, human tap, clause filter, full log. Needs: read their Google doc for the exact ask; a one-page "agent security model".
13. **Armadin: Best Security Hack** (criteria "coming soon"): same material as 12; check the booth Saturday.
14. **Apify** ($2,000 / $1,000 / $800 / $400 / $400 + Best Actor $400): build an Actor `fda-recall-by-lot` that reads public FDA/WHO recall pages and returns a clean record; use it live for the recall chip with a visible empty/blocked case. Five prizes, decent odds. Needs: Apify account, one Actor, used in the demo.
15. **Bright Data** ($1,500 credits + $500 Amazon): same recall lookup through Bright Data instead; disqualified if mocked or behind a login. Pick Apify *or* Bright Data, not both for the same feature.
16. **MLH Best Use of Gemini API**: Gemini reads the bottle label (vision) as the second model; Claude keeps the "why". Needs: the app Gemini key (allowed for apps), 40 lines.
17. **MLH Best Use of ElevenLabs** (earbuds): read the verdict and the plain sentence aloud in personal mode (grandparents). Needs: ElevenLabs key, one TTS call, a speaker button. (Cartesia offers Meta glasses but wants voice as the core; ours is not.)
18. **MLH Best Use of Auth0** (headphones): the pharmacist tap becomes a real login (who tapped); Auth0 for AI agents for the agent's token. Needs: Auth0 tenant, 1 hour.
19. **MLH Commit Fellowship**: free to enter; supplemental form.
20. **Fetch.ai** ($1,500 / $1,000 / $500): station-to-station verdict buying as uAgents. Needs: uAgents SDK, half a day; only if the x402 buyer is done.
21. **Elastic** (Quest 3S; criteria "coming soon"): index runs + log for search. Needs: Elastic Cloud trial; medium lift.
22. **MLH .Tech domain / GoDaddy Registry**: register a domain for the site. Needs Preston's yes (domains are his call).
23. **Hacker's Choice**: booth theatre: the box, the chalk tablet, the glow.

**Not entering:** Trading Agents, SpaceXAI/Cursor raffle (Cursor is off), Solana, Presage, Spacetime, Visa shopping, CRS Credit, Notability, Meta (human connection), Moss, Bitdeer, Mana, Convex (backend swap too big), Creao (criteria unclear), Vultr/DigitalOcean/Snowflake/MongoDB/Backboard (would need a stack change; revisit only if hosting the pay service on a droplet is free and quick).

**Status at hand-over (Sat 10:4x PDT; Preston asked for everything finished within 2 h):**

| Track | Built | Still needs |
|---|---|---|
| Best Hardware | station plan, FIG grid, data path | the physical box (Preston, Saturday) |
| Hyphenate finance | policy agent (propose/hold/escalate), `/agent` record page, downgrade-only clerk + 6-case test, `/demo` opens on the moment, draft footage | the ≤3-min video with voice |
| Coinbase x402 | real 402 + facilitator signature check, buyer CLI with cap, escrow routes, Coinbase section on the site, builder feedback | CDP key → paid 200 + faucet USDC; per-member eligibility |
| Capital One Nessie | client + mirror on hold/release/refund, SANDBOX card on Delivery | `NESSIE_KEY` |
| Microsoft Built for the Real World | Limits section, real-vs-simulated table, path-to-production paragraph in DEVPOST | nothing |
| Anthropic | Claude why (filtered), Ask Pill (refusals tested), escrow clerk, "where it could go wrong" cards | one pharmacist conversation (Preston) |
| Best People-First | personal mode, big text, read aloud, reminders, grandparent chapter | nothing |
| Most Technically Complex | two-channel optics, 7 rules, x402, Gemini + Claude, Composio calendar | nothing |
| MLH Gen AI / Gemini | Gemini label reading live (`/label`), Claude why/Ask | nothing |
| MLH Tiger Data | hypertable code + SQL in README, `/tiger/*` routes, demo posts samples | `TIGER_URL` account |
| MLH ElevenLabs | `/speak` + ReadAloud (browser-voice fallback) | `ELEVENLABS_API_KEY` |
| MLH Auth0 | not built | skip unless time |
| Figma | plugin (Slides/Design/FigJam), deck.json, 16-slide preview, STAGE-LOG, COMPOSIO steps | Preston runs the plugin in Figma desktop (`figma/RUN.md`), shares 3 links |
| Apify / Bright Data | not built (recall check is a demo lot) | skip unless time |
| Armadin security | containment story in DEVPOST + `/agent` limits | their criteria ("coming soon") |
| Commit Fellowship | DEVPOST paragraph | the form |
| .Tech domain | shortlist in 🗺️-plan | Preston's pick |
| Atlassian | needs a Forge app | not entering |

## 8. References (post each in Discord #references)
- Peel: https://plume.hackmit.org/project/qxodw-wgjqk-lidau-dxrpe · code https://github.com/viktorinkov/HackMIT-2026 · video https://youtu.be/Yiu2wGKJ6AM
- WHO substandard/falsified medicines fact sheet (Dec 2024): https://www.who.int/news-room/fact-sheets/detail/substandard-and-falsified-medical-products
- Past winners: `research/winners-calhacks12-berkeley.md`, `research/winners-hackmit-hackharvard.md`, `research/winners-treehacks.md`
- Prize tracks: `~/boss-handoff/agents/research/calhacks-13-prize-tracks-2026-10-23.md` · Hive prizes https://hive.hackberkeley.org/prizes · Devpost https://cal-hacks-13-0.devpost.com/
- Debates: `final-debate-2026-10-23.json`, `lot-product-debate-2026-10-23.json`, `payout-debate-2026-10-23.json`, `dripguard-debate-2026-10-23.json`
- LED as a light sensor: Dietz, Yerazunis, Leigh, "Very Low-Cost Sensing and Communication Using Bidirectional LEDs", MERL 2003.

## 9. Open questions (answer in Discord #plan)
1. Does the Pi have an OS on its SD card? If not, the laptop is the station face tonight.
2. Team size and names for the Devpost page (ask before naming anyone).
3. Does the hardware booth have a 3D printer, photoresistors, a colour sensor?
4. Who has talked to a pharmacist or nurse this weekend?
5. Repo: create `~/calhacks-13/pill` (helper) or a team GitHub repo? All code must be written during the event.

## 10. Rules we follow
All implementation during the hacking period; Peel cited, no code copied. Never say "safe", "genuine" or "fake"; verdicts are pass / needs lab / unable to verify. No crypto bolt-ons. Real vs simulated labelled on every screen (Nessie sandbox = simulated money). Nobody's age, visa or school in any public text.
pill-site live: https://pill-site.vercel.app (2026-10-24 00:52 PDT, dpl_439unawfFKbTVN2uynfdDUgb1obn)
