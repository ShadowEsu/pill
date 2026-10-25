# Demo commands

## Three ways to run (from `pillgate/`)
| command | when | what the top-right badge says |
|---|---|---|
| `./start.sh` | the UNO Q is plugged in (give it ~60 s to boot) | `serial /dev/cu.usbmodem… · live` |
| `./start.sh replay` | no board, or the board died on stage | **REPLAY (not live)**: say "this is a recorded run" out loud |
| `./start.sh online` | judges on their own phones, off our Wi-Fi | same as live, plus a public https link |

- **Before any live run:** `app/.venv/bin/python tools/doctor.py` with the lid closed. It must show 0 FAIL. Then close it: only one program can hold the port.
- **`start.sh` frees the port:** it kills anything holding the USB port (Serial Monitor, doctor) and anything on :8000. Stop it with Ctrl-C. The log is `app/.serve.log`.
- **Claude:** on when `~/.config/preston-secrets/anthropic-pill.env` exists. Otherwise it runs in mock mode: the photos are not read, so pick the profile by hand on Measure.

## URLs
- **Laptop:** http://localhost:8000
- **Phone on the same Wi-Fi:** `http://<laptop-IP>:8000`. `start.sh` prints the address; `ipconfig getifaddr en0` gives the IP too. The camera works; voice input needs https, so use `online` for voice on a phone.
- **Online (ngrok):**
  - `start.sh` asks for a PIN of **8 or more characters**. Judges log in with user **`pill`** and that PIN.
  - Make a fresh PIN for each session. Never reuse a real password, and don't post the link with the PIN.
  - The public `https://…ngrok…` URL prints a few seconds after start. Ctrl-C ends it, and the link dies with it.

## 60-second judge demo
Set up before the judges arrive:
- Run the doctor (0 FAIL), `./start.sh`, and keep the aspirin profile `aspirin_ref` built (`docs/REFERENCE-RUNS.md`).
- Have one recorded "Needs lab testing" result in History.
- Put a cup of water in the chamber, lid closed. On **Check**, skip the photos, go to **Measure**, pick **Quick · 60 s** and `aspirin_ref`, then press **Start** so the water check is already green.

| time | page | say | screen shows |
|---|---|---|---|
| 0:00 | **Gate** (`/`) | "About 1 in 10 medicines in low- and middle-income countries is substandard or falsified (WHO). A clinic can't send every delivery to a lab. This screens it first." | counts of Passed the screen / Needs lab testing / Unable to verify |
| 0:10 | **Measure** | "Clean water passed its check. Now the tablet." Lift the lid, drop the aspirin, stir 5 circles, close the lid, press **Continue**. | live curve, badge `live` |
| 0:20 | **Measure** | "Two photoresistors and three LEDs on an Arduino UNO Q. One looks straight through the cup, one from the side. Aspirin clouds the water, and the side sensor sees the cloud rise." | the purple side-sensor line climbing |
| 0:35 | **History** → the recorded run | "This one was recorded earlier tonight, a different tablet. Its curve doesn't match our three reference runs, so it says Needs lab testing and the delivery is held." | result card "Needs lab testing" with the rule text |
| 0:50 | **Measure** → **Result** | "It only says three things: Passed the screen, Needs lab testing, or Unable to verify. It's screening, not a lab test. We build on Peel's method from HackMIT; all the code is ours." | the live run's result after its 60 s |

If the board fails, run `./start.sh replay`. The badge says REPLAY (not live), and you say "recorded run" out loud.

## Honesty words
- **Say only:** **Passed the screen** · **Needs lab testing** · **Unable to verify** · "screening, not a lab test".
- **Never say:** safe, authentic, verified, genuine, certified, fake, counterfeit. The app's guardrail bans these in reports too.
- **Always say whether the data is live or recorded.** Never call a replay or a simulated profile live.

## Open with Preston (he said he will talk about it more later, Sat 21:2x)
- The hosts (real deal :8000 vs demo :8001), the reset flow, what the judges should see first. Ask him before changing the demo flow.
