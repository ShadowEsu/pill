# FloodToll: is selling flood-sensor data a business? (Fri 2026-10-23 ~20:05 PDT)

Question from Preston: is the data already public, can people make money selling it, and is it worth committing to as a startup, not only for the hackathon?

## Verdict
- **As pitched (DePIN, sell readings for $0.001 via x402): not a business.** 18 AI personas (buyers, judges, investors, incumbents, users) averaged **2.1/10 as a startup** and **6.7/10 as a hackathon project**. 0 of 18 would pay per reading. 18 of 18 said "drop the per-reading crypto as the headline".
- **The underlying problem is real and there is money in it, but it is sold per site per year, to cities and insurers, by companies that already exist.** Hohonu charges ~$3,000/site/yr and has 230+ sites in 18 states. Parametric insurers (FloodFlash, Floodbase + Liberty Mutual, Previsico) pay for sensors they control as payout triggers.
- **What could be a startup: a $60–300 node that undercuts Hohonu 10x for the storm drains and low-water crossings cities cannot afford to gauge, sold as a cheap alert subscription or as a parametric-insurance trigger.** That is a real but slow, hardware-reliability, government-sales business [INFERENCE: personas rated a reframed version higher; not re-scored].
- **For the hackathon: keep it, reframe it.** Hero = offline siren + alerts to real people + Claude incident report. x402 = a clearly labelled side door for AI agents, running on localhost so it survives bad Wi-Fi. That still hits Best Hardware, Planet-First, People-First, Anthropic, Tiger Data, Coinbase x402 (if eligible), MLH Gen AI.

## Evidence (sources opened 2026-10-23)
| Question | Finding | Source |
|---|---|---|
| Is flood data public? | River/stream gauges: yes, free (USGS >1M locations; NOAA NWPS API). Street-level / storm-drain flooding: no; NYU FloodNet built $200 ultrasonic sensors in NYC because that data did not exist, and publishes it openly. | waterdata.usgs.gov; api.water.noaa.gov/nwps/v1; Mydlarz et al. 2024, Water Resources Research |
| Who pays, how much? | Hohonu: ~$3,000/site/yr all-inclusive (hardware, cellular, dashboard, alerts, API); 230+ locations, 18 states; Texas state vendor contract; Honolulu planning a $300K pilot; later-stage VC, "generating revenue". | hohonu.io/faqs, /pricing, /texas-dir; Kurrant 2026-10-21; PitchBook |
| Do insurers pay? | Yes, for sensors they control as parametric triggers: FloodFlash (acquired by NormanMax May 2025; Gallagher golf scheme May 2026), Floodbase + Liberty Mutual instant parametric quoting (Feb 2026), Previsico Series A (Oct 2025; Zurich Municipal, National Highways). Contracts, not per reading. | insurance-canada.ca; ajg.com; floodbase.com; previsico.com |
| Do routing apps pay? | No. Waze/Google get flooded-road closures free from cities (Waze for Cities, Esri Community Maps, NCDOT automated closures, Norfolk VA pilot). | developers.google.com/waze; esri.com; transportationops.org |
| Does DePIN sensor-data selling work? | WeatherXM (~10,000 stations) is the only sensor DePIN with real data revenue, via ordinary B2B/B2G API contracts; it says its 2025–26 focus is "a real off-chain revenue engine". PlanetWatch paused device licences 2022, absorbed by Ambient 2024. Messari: DePIN ~$10B sector, sensor networks weakest on demand-side revenue. | weatherxm.com/company/partners; depinhub.io; theblock.co 2024-05-07; Messari State of DePIN 2025 |
| Is x402 real? | 100M+ tx on Base by Q1 2026, largely PING meme-coin farming (Chainalysis). 10¢–$1 payments fell from 46% to 4% of volume; ~$41M settled cumulative; avg payment ~$0.05; x402stats audits ~58% of volume as genuine; Solana x402 ~$3.3M/week (Aug 2026). No evidence of anyone buying environmental readings per request. | chainalysis.com/blog/x402-agentic-payments-adoption (2026-06-03); x402stats.io; web3trackers |
| Is the problem real? | US flood costs $180B–$496B/yr (Senate JEC); flash floods top storm-related killer (~125 deaths/yr). | congress.gov; insurancejournal |

## Persona run (18 AI personas, not humans; each saw the pitch + the evidence table)
Mean hackathon 6.7/10 (range 5–7). Mean startup 2.1/10 (range 2–3). Would buy: 0 yes, 4 maybe (homeowner $40–60 one-time; landlord $150–250 + $5/mo; Jakarta volunteer $30 node; CS teammate), 14 no.

What each would actually pay for (not per reading):
- City stormwater engineer: $1,500–2,500/site/yr, 3-yr contract, only with surveyed datum, calibration, SLA, API into SCADA/ArcGIS.
- County emergency manager: $300–1,500/site/yr for a cellular low-water-crossing alarm with false-alarm filtering and a health heartbeat; pilot on 2 crossings after it survives a season.
- Parametric underwriter: $300/site tamper-evident dual-sensor node with signed readings, instead of $3,000 Hohonu.
- Reinsurer: $50–150K/yr licence for thousands of QA'd nodes with 5+ yrs history; one node = zero.
- Logistics PM: $500–2,000/metro/yr flat feed, only if segment-level and verified; gets closures free today.
- Homeowner/landlord: $50–250 box that sirens, texts the block/tenant, trips the relay (sump/power), logs a timestamped record for insurer/court.
- DePIN VC / YC partner: one signed paid pilot or LOI from a city or parametric MGA; "device owners earn crypto" is the supply side of a market with no demand side (PlanetWatch, not WeatherXM).
- Coinbase judge: one honest labelled testnet x402 call that returns something USGS can't (signed, geofenced, attested street reading) plus written SDK feedback (facilitator errors, Solana vs Base scheme differences, retry/idempotency).
- Hardware judge: HC-SR04 is indoor-only, no temp compensation, 15° cone lies on rippled water; Pi + 7" screen (~5 W) on a "solar" node is dishonest; GPS on a fixed device is decoration. Wants ESP32 + waterproof JSN-SR04T or MaxBotix MB7389, IP65 box, measured power budget, deep sleep, relay driving a real pump or sign.

Common objections, verbatim themes: "a hash proves the reading was posted, not that it was true"; "nobody has a wallet or a procurement path for $0.001"; "you built a paywall around life-safety information" (Planet-First judge); "the x402 part is the thing most likely to break on the Wi-Fi and least likely to make money" (teammate).

## The reframed project ("the $60 Hohonu for the storm drains nobody gauges")
- **Named community (Anthropic criterion):** one specific place, e.g. a county's low-water crossings or a flood-prone block; talk to one public-works or emergency-management person this weekend if possible (sponsors/mentors at the venue count).
- **Hero demo:** water rises in the tub → siren + relay (pump or "road closed" sign) with the network unplugged → plug in → alert text to a phone + Claude incident report ("Drain 14 at 2.1 ft, rising 0.4 ft/min, two prior events this month, recommend closing Elm underpass; confidence medium: single sensor, rippled surface") → dashboard chart (Tiger Data continuous aggregate).
- **Open data:** FloodNet-style free feed. Judges in People/Planet-First reward this; it also answers "is it public".
- **x402 side door, labelled "testnet, simulated buyer":** an AI agent fetches a signed, geofenced reading via 402 → pay → data on localhost. Submit real SDK feedback. Only if a teammate clears Coinbase's eligibility gate (18+, US/CA, verified account) and only after the hero works.
- **Hardware honesty:** solar panel = charging concept; power budget on a slide; if the rental booth has a JSN-SR04T (waterproof ultrasonic), swap it in.
- **Tracks:** Best Hardware · Best Planet-First · Best People-First · Anthropic · MLH Tiger Data · MLH Gen AI · Microsoft Customer Impact · Coinbase x402 (side).
- **"Is this a startup?" answer for judges:** "Hohonu proves cities pay $3,000/site/yr. We're testing whether a $60 node plus a $300/yr alert subscription gets the other 90% of drains gauged. The data is free; the alert service is the product."
