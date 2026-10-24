# DripGuard: the pick (Fri 2026-10-23 ~21:05 PDT)

Preston asked for a medical / niche idea using exactly the hardware in the photos, judged by AI debaters. Six candidates went through two rounds with 18 personas (oncology nurse, pharmacy director, Kenyan district physician, respiratory therapist, oral-chemo patient, caregiver, ex-FDA reviewer, health-tech VC, biomed engineer, DSCSA lead, main judge, hardware judge, People-First judge, Anthropic judge, Solana judge, Presage judge, CS teammate, medical ethicist). Raw transcript: `dripguard-debate-2026-10-23.json`.

## Hardware on hand (from the photos)
HUZZAH32 ESP32 Feather V2 · Arduino Uno R3 (RexQualis kit) · Raspberry Pi 3 + 7" touchscreen · GPS module · small solar panel · 4 loud buzzers (SFM-27B) · 10x L293D · purple motor breakout · small pump (likely) · 12 V adapter · HC-SR04 · 2x DHT11 · thermistors · photoresistors · IR receiver + remote · tilt switch · joystick · pots · 5 buttons · keypad · LCD1602 · 7-segment (4-digit, 1-digit) · RGB LED, LEDs · relay · SG90 servo · 28BYJ stepper + ULN2003 · DC motor + fan · 74HC595 · resistors · breadboards · perfboard · wire. No IMU, camera, RFID, PIR or medical sensor.

## Round 1 (mean of 18): hackathon / real-world value / buildable, first-place votes
| Idea | Hack | Value | Build | #1 |
|---|---|---|---|---|
| **DripGuard** (gravity-IV drip monitor) | **8.7** | **7.5** | 7.2 | **17** |
| BreathBuddy (turbine incentive spirometer) | 7.3 | 6.1 | 6.1 | 1 |
| ChemoChain (custody box + Solana) | 6.1 | 4.5 | 5.9 | 0 |
| PillStep (oral-chemo dispenser) | 5.6 | 4.7 | 5.6 | 0 |
| CleanHands (hand-hygiene nudge) | 5.3 | 5.2 | 8.8 | 0 |
| FeverLine (neutropenic-fever kit) | 4.1 | 5.6 | 7.6 | 0 |

## Round 2 (debate, adversarial): 18 of 18 keep DripGuard. Startup potential 3.3/10.
Crypto: 18 of 18 say **do not enter Solana or x402** with any of these. The Solana judge persona: "I'd rather give the prize to nobody than to a notary stamp." ChemoChain's chain anchors a ±2 °C DHT11 reading nobody would act on; compounded chemo is DSCSA-exempt; a signed local log + the receiver's timestamp already gives the tamper evidence. A crypto logo next to a chemo drip loses the clinical judges.

## What DripGuard is
Most beds in the world run IV drips by gravity, with no pump: a nurse eyeballs the drip chamber and comes back later. Bags run dry, rates drift when an arm bends, nobody is in the room. DripGuard is a clip on the drip chamber that counts drops, shows mL/h vs ordered and "empty in N min", alarms in tiers, and sends every bed to one nurse-station screen. **Monitor only. It never touches the line.**

Named community: nurses on understaffed wards running gravity drips (LMIC district hospitals; US wards during pump/IV-fluid shortages). Incumbent: DripAssist (Shift Labs), FDA-cleared, ~$300, barely sells. Our wedge: sub-$20 BOM + multi-bed station view + offline-first.

## The attack the judges will make (be ready in 30 s)
1. "Lean over the chamber with my phone torch. Did the count change?" → sensor must be light-tight and modulated.
2. "Which drop factor is this set? 10, 15, 20 or 60 gtt/mL?" → mandatory keypad entry before monitoring starts; shown on the LCD at all times.
3. "The patient bent her arm and flow paused 40 s. Did you buzz?" → tiered alarms, drift must be sustained; one buzzer, not four.
4. "That servo on the roller clamp makes you an infusion controller with no fail-safe." → **servo deleted.** LCD line 2 reads "MONITOR ONLY – does not control flow". Say it aloud in the first 20 seconds.
5. "DripAssist exists at $300 and barely sells. What are you except cheaper and noisier?" → multi-bed station view, offline-first, sub-$20, built for wards with 2 nurses per 30 beds; pilot path through NGOs/MoH; honest that this is a slow, grant-funded business, not a venture one.
6. "What does the screen say when the clip falls off?" → explicit states: RUNNING / DRIP STOPPED (no drops 30 s) / EMPTY (no drops 60 s and predicted volume < 5 mL) / SENSOR FAULT (clip open, too bright, no signal). Never a silent green.

## Must-fix list (consensus of 18)
- **Sensor:** not a bare LDR. IR LED (from the kit remote or any IR LED) pulsed ~1 kHz (or 38 kHz into the kit IR receiver) + phototransistor/IR receiver facing each other inside a black-taped or 3D-printed clip that fully encloses the drip chamber. Detect the AC dip / derivative, not DC level; 80–100 ms refractory. Pass test: 5 min, zero false drops with a phone torch waved over it and someone bumping the stand.
- **Real drip chamber:** buy 2 gravity IV giving sets (20 gtt/mL macro + 60 gtt/mL micro) and a 500 mL saline or water bag from a farm/pet/vet supply or pharmacy Saturday morning; hang on a stand. A pump into a cup is disqualifying.
- **Honest number:** keypad entry of drop factor, ordered mL/h, bag volume before arming. LCD: measured vs ordered, "EMPTY IN 12 MIN".
- **Alarms:** drift > 25 % sustained 60–90 s → LED + LCD + station flag only; unacknowledged 60 s → ONE buzzer; stopped/empty → buzzer immediately. Acknowledge button, time-to-ack logged.
- **No venue Wi-Fi:** Pi runs its own AP (hostapd + dnsmasq); ESP32 bed 1 joins it; Uno bed 2 over USB serial. Two live beds at the table.
- **Show the raw signal:** per-drop pulse trace live on the Pi screen; judges trust what they can see.
- **Claude's boundary is the product:** all detection is deterministic on the ESP32 and works with the network unplugged. Claude only writes the shift-handover note and answers "which bed first?", cites the event log, and says "sensor fault, go look" when unsure. State this on the slide.
- Delete: servo, GPS, solar, HC-SR04, relay (none are load-bearing; the hardware judge scores decoration down).

## Demo (60 s)
Two bags hanging. Station screen shows Bed 1 42 mL/h (ordered 40), Bed 2 125 mL/h, both "empty in …". Judge twists Bed 1's roller clamp down → LCD shows measured 28 vs ordered 40, drift timer counts, station flags amber at 60 s, buzzer at 120 s, judge presses ACK, log shows time-to-ack. Judge clamps Bed 2 fully → DRIP STOPPED in 30 s. Phone torch on the clip → count unchanged, raw trace flat. Pull the Pi's network cable → bedside alarms still work. Claude: "Handover 21:40: Bed 1 drift acknowledged in 48 s; Bed 2 stopped 21:38, unresolved; check Bed 2 first."

## Tracks (consensus)
Best Hardware · Best People-First · Anthropic · Microsoft "Built for the Real World" · MLH Tiger Data (drop-rate time series) · one of Convex ($5k, reactive multi-bed view) or SpacetimeDB, not both · MLH Gen AI. No Solana, no x402, no Presage.

## Hours (36 left)
- **Fri 21:30–01:00:** IR beam-break on a bench rig (dripping tap or syringe), per-drop pulses visible on serial plotter; ESP32 counts in an ISR with refractory. Keypad + LCD flow (drop factor / ordered / volume). Pi: AP up, FastAPI/Convex ingest, station page skeleton.
- **Sat 08:00–10:00:** buy giving sets + bag; build the light-tight clip. 
- **Sat 10:00–14:00:** real drip chamber calibration at 10/20/60 gtt/mL, 100 drops into a measuring cup; torch and bump tests; fault states.
- **Sat 14:00–18:00:** tiered alarms, ACK button, two beds live, Tiger Data history chart, Claude handover note. Freeze features at 18:00.
- **Sat 18:00–22:00:** enclosure, 3 rehearsed scenarios, backup video, Devpost draft by 22:00.
- **Sun 00:00–02:00:** README (where each tool is used), pitch rehearsal with the 6 attacks. Sleep.
- **Sun 07:00–08:30:** final test, submit.

## Honest startup read
3/10. Real need (most of the world's beds), real wedge (sub-$20, multi-bed, offline), but: no US reimbursement code; US wards use pumps except in shortages; alarm-only is still Class II (21 CFR 880.2420, DripAssist is the predicate; ~$150–400k and 12–18 months); buyers are MoH/NGO tenders (UNICEF, PATH, MSF), slow and price-brutal. A grant-funded global-health device, not a venture company. Great hackathon project; say that plainly if a judge asks.
