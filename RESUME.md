# RESUME (written Sun 2026-10-25 00:4x PDT; Mac on battery 33 %, charger out)

If the Mac died: plug in, boot, then in order.

## 0. Services (2 min)
```
cd ~/calhacks-13/pillgate && ./start.sh both          # Pill Gate live :8000 + demo :8001
cd ~/calhacks-13/pill/pay && npm run serve &          # pay :8402 (SERIAL_PORT unset)
cd ~/calhacks-13/pill/web && npx vite --port 5183 &   # clinic app dev
cd ~/calhacks-13/pill-site && npx vite --port 5180 &  # site dev
```
Everything is committed and pushed to origin/main (private) up to the commit `git log -1` shows; agents' in-flight work may be in uncommitted files: `git status`, keep it, commit it.

## 1. Where each stream stood at 00:4x
- **Pitch video**: `pitch/video/pill-pitch-90s.mp4` rendered (82.3 s audio) but the VIDEO stream ends at 62.77 s: a filtergraph duration mismatch. VideoEdit (agent) was fixing `pitch/video/edit/make_edit.py` → re-run `nice -n 15 bash pitch/video/edit/build.sh`; verify with `ffprobe -show_entries stream=codec_type,duration`; frames at 2 s / 30 s / 48 s were good; check 70 s / 78 s / 81 s (end card). Then upload to #plan (python multipart, channel 1563433784567795843) + `cp` to `~/Downloads/pill-pitch-90s.mp4` + `open`.
- **Site proof** (SiteStory): proving http://127.0.0.1:5180 at 390/1024/1440 → `pill-site/dev-shots/proof-sun/`; then `vite build`; commit. Clinic copy fix (paddle / quarter tablet / three minutes) was requested from AppPhases; SiteStory re-shoots the 8 clinic slides for `#screens` after it.
- **Pill Gate proof** (AppLook): rounds 2–7 on :8001 + the board-not-found state on :8000 → `pillgate/dev-shots/ui3/`; `pytest -q` 14; `pillgate/sync-ui-to-peel.sh` after every UI commit (backend must equal `~/Downloads/peel-v16-backup`).
- **Clinic app proof** (AppPhases): :5183 routes + `/demo?speed=4` twice + FlowDiagram lit states + the old-copy fix; `npx tsc --noEmit`; `vite build`.
- **Deck** (FigmaFinish): slide 8 money-flow source committed (0c52e69); NOT rebuilt. Rebuild: `cd figma && ./station-photos.sh && node build-deck.mjs && node shoot-deck.mjs && node build-pptx.mjs && node package.mjs`; view `deck-preview/08-money-flow.png`, `04`, `05`; commit; open the PDF for the owner.
- **ZeroGPT** on `pitch/DEVPOST-ANSWERS.md` not yet run (one browser tab; score per section; > 10 % → DevpostHumanizer rewrites that section).
- **Deploys** (not done; ≤ 1 per project per 2 h; before 07:30): `vercel-budget` (was 3/100 OK at 00:39) → in `pill/web`: `npx -y vercel@latest build --prod --yes` → secret-grep `.vercel/output/static` (`sk-ant-|AIza|ghp_|eyJ|Bearer `) → `npx vercel deploy --prebuilt --prod --yes --scope shadowesus-projects` → smoke https://pill-app-delta.vercel.app/{welcome,demo,verify,station}; same in `pill-site` → https://pill-site.vercel.app. Send dpl ids to BOSS (`tell boss`) + security (`tell security`), post URLs to #website/#software.

## 2. Owner-only items (also in ~/boss-handoff/NEEDS_PRESTON.md Quick)
Devpost paste from `pitch/DEVPOST-ANSWERS.md` + `pitch/DEVPOST-FORM.md` by **08:30**; Coinbase steps `pitch/COINBASE-X402.md`; table script `pitch/TABLE-SCRIPT-SUNDAY.md`; repo public; YouTube upload; .tech domain; team names. Open with him: hosts/reset flow (he said he'd say more).

## 3. Table (owner + teammate)
Tape the three light leaks; `./start.sh both`; 3 × Quick reference runs to the END (≥ 90 s) → Profiles → Build reference → 4th run; Show mode = Settings toggle or `?show=1` ("Aspirin 81 mg · 100 %", demo label).
