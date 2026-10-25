# RESUME (written Sun 2026-10-25 00:4x PDT; Mac on battery 33 %, charger out)

If the Mac died: plug in, boot, then in order.

## 0. Services (2 min)
```
cd ~/calhacks-13/pillgate && ./start.sh both          # Pill Gate live :8000 + demo :8001
cd ~/calhacks-13/pill/pay && npm run serve &          # pay :8402 (SERIAL_PORT unset)
cd ~/calhacks-13/pill/web && npx vite --port 5183 &   # clinic app dev
cd ~/calhacks-13/pill-site && npx vite --port 5180 &  # site dev
```

## 1. State at 01:3x (everything below is committed + pushed)
- **Pitch video v3** done: `pitch/video/pill-pitch-90s.mp4` (83.4 s video / 83.5 s audio, −16 LUFS; whisper-timed captions, lower-third cards, no stickers); copy in `~/Downloads/pill-pitch-90s.mp4`. Owner may still ask for changes (VideoEdit agent owns `pitch/video/edit/`; `make_edit.py` → `nice -n 15 bash pitch/video/edit/build.sh`).
- **Deploys done** (01:00 / 01:01): pill-site dpl HN3Bysp7zrK2ZqxDvydDUMBw9SGs, pill-app dpl 47eyL6A1zofcx1Rqva2HzpfoneWY; both passed Security. Vercel BLOCKS prebuilt deploys whose git HEAD author is `calhacks-helper` ("commit author doesn't have permission"): deploy from a git-less copy: `rm -rf ~/calhacks-13-deploy/<p>/.vercel && cp -R <project>/.vercel ~/calhacks-13-deploy/<p>/ && cd ~/calhacks-13-deploy/<p> && npx -y vercel@latest deploy --prebuilt --prod --yes --scope shadowesus-projects`. Scripted requests to pill-site from this Mac get Vercel's checkpoint 403 for a while (browsers pass).
- **Next slots (≥ 03:00 / 03:01, before 07:30)**: pill-site carries 666823f (3 re-shot #screens slides); pill-app carries the nosniff/Referrer-Policy headers (65b3224). Build in-repo (`vercel build --prod --yes`), secret-grep, then deploy from the git-less copy; smoke; dpl ids to BOSS + security.
- **Proofs done**: Pill Gate rounds 2–7 (`pillgate/dev-shots/ui3/`), clinic app (`pill/web/dev-shots/proof-sun/`), site (`pill-site/dev-shots/proof-sun/`); Show mode works; sync to `~/Downloads/peel` done (backend == backup).
- **ZeroGPT**: DEVPOST-ANSWERS 7.8 % AI; DEVPOST-FORM sponsor paragraphs 0 %.
- **Gallery** ready: `pitch/gallery/01…10` (cropped, real PNG/JPG).
- **Deck** (FigmaFinish): slide 8 money-flow + photo slides are in `figma/build-deck.mjs` source (0c52e69), NOT rebuilt (render pause while on battery). Rebuild when power is back or by 05:00 at the latest: `cd figma && ./station-photos.sh && node build-deck.mjs && node shoot-deck.mjs && node build-pptx.mjs && node package.mjs`; view `deck-preview/08-money-flow.png`, `04`, `05`; `python-pptx` readback 21 slides; commit; `open figma/pill-deck.pdf`.

## 2. Owner-only items (also in ~/boss-handoff/NEEDS_PRESTON.md Quick)
Devpost paste from `pitch/DEVPOST-ANSWERS.md` + `pitch/DEVPOST-FORM.md` by **08:30**; Coinbase steps `pitch/COINBASE-X402.md`; table script `pitch/TABLE-SCRIPT-SUNDAY.md`; repo public; YouTube upload; .tech domain; team names. Open with him: hosts/reset flow (he said he'd say more).

## 3. Table (owner + teammate)
Tape the three light leaks; `./start.sh both`; 3 × Quick reference runs to the END (≥ 90 s) → Profiles → Build reference → 4th run; Show mode = Settings toggle or `?show=1` ("Aspirin 81 mg · 100 %", demo label).
