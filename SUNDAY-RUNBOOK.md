# Sunday runbook (written Sat 22:5x PDT; run after BOSS lifts quiet hours, ~02:00)

Freeze 07:30 · Devpost closes 09:00 (hard; plan 08:30) · judging 10:30–12:30. Deploy rule: `vercel-budget` first; ≤ 1 production deploy per project per 2 h; secret-grep the output; report dpl ids to BOSS + security.

## 0. Preconditions (2 min)
- [ ] Charger in, battery charging (`pmset -g batt`).
- [ ] BOSS said "lifted". RAM < 14 GB (`vm_stat`), load < 10.
- [ ] Board: `curl -s localhost:8000/api/live | jq .status` shows `serial … lines N` rising (else `./start.sh reset` in `pillgate/`).

## 1. Browser proofs (one headless tab at a time, close after each; ~40 min)
Unverified work since the 20:05 freeze (all committed, all pushed):
- [ ] **Pill Gate UI** (`pillgate/app/static`, served on :8001 replay + :8000 live): rounds 2–5 (live water checks, Claude-writing pulse, recall chips; run bar + run survives navigation; Ask Pill dock; Personal: Medicines / Schedule / More / Easy mode; Station page with photos + blueprints; Reset controls; board-not-found chip). Proof: 390 + 1280 screenshots of every route into `pillgate/dev-shots/ui3/`, 0 console errors, scrollWidth = viewport; one replay run on :8001 where I switch to History mid-run → bar shows → auto stop → "Result ready"; Easy mode on/off widths. Owner of fixes: AppLook.
- [ ] **Clinic app** (`pill/web` on :5183): ScreensA gaps 2–5 (demo repeat, follower column, Settings/Dashboard station chips) + AppPhases (Medicines station scans, Schedule big rows + reminders + calendar chip, Easy mode, Personal home cards). Proof: `/demo?speed=4` end to end twice (second run must not add a second TM-02 hold); `/`, `/medicines`, `/schedule`, `/settings`, `/deliveries`, `/station` at 390/1280 with Easy on/off; 0 errors. Owners: ScreensA, AppPhases.
- [ ] **Site** (`pill-site` on :5180): SiteStory ca52b15 + 560670d + 6a2c93b (truth fixes, Screens slideshow, real-hardware drawings + photo strip + blueprints, binary-pill divider). Proof: 390 / 1024 / 1440 screenshots of hero, station explode, #built, #screens, Fig 0.1–0.8, story scenes; reduced-motion grid; 0 errors; scrollWidth. Owner: SiteStory.
- [ ] **ZeroGPT** on `pitch/DEVPOST-ANSWERS.md` main sections (paste into zerogpt.com in a headless tab; record the % per section); if any section > 10 %, DevpostHumanizer rewrites that section only.

## 2. Deck rebuild (FigmaFinish; ~15 min, no browser except the PNG shoot)
- [ ] `cd figma && ./station-photos.sh && node build-deck.mjs && node shoot-deck.mjs && node build-pptx.mjs && node package.mjs`; checks (`measure-plugin.mjs`, banned-word grep, python-pptx readback = 21 slides, PDF 21 pages); commit + push; post the two changed slide PNGs (04, 05) to #plan.

## 1b. Pitch video render (first thing after the lift; ~5 min CPU)
- [ ] `bash pitch/video/edit/build.sh --preview` → view `pitch/video/pill-pitch-90s.mp4` frames at 1 s / 3 s / 6 s (him, then the hardware glow at "it's Pill"; captions legible at 1080×1920). Then the full `bash pitch/video/edit/build.sh` (82 s, 12 cuts + end card). Check: `ffprobe` duration ≈ 82–86 s, loudness via `-af ebur128` (I ≈ −16 LUFS), frames at 10 s / 40 s / 70 s / 80 s (end card: pill-site.vercel.app + repo); the music ducks under his voice. Post the mp4 to #plan (python multipart upload) and copy to `~/Downloads/pill-pitch-90s.mp4`; `open` it. Source timecodes in `pitch/video/EDIT-PLAN.md`; the hardware shot is 2:05.10–2:08.03 (checked: chamber + UNO Q + bottle fill the frame).
- [ ] Pill Gate Show mode proof: `http://127.0.0.1:8001/#/check/bottle?show=1` → run → Result shows "Aspirin 81 mg · 100 % · Passed the screen" with the real curve; toggle off → honest result. Screenshot both to `pillgate/dev-shots/ui3/`.

## 3. Deploys (after the proofs pass; one at a time; ≥ 2 h apart per project)
- [ ] `vercel-budget` (exit 1 → stop, tell BOSS).
- [ ] **pill-app** (`pill/web`): `npx -y vercel@latest build --prod --yes` → secret-grep `.vercel/output/static` (`sk-`, `sk-ant-`, `AIza`, `ghp_`, `eyJ`, `Bearer `) → `deploy --prebuilt --prod --yes --scope shadowesus-projects > ~/calhacks-13/.deploy-app.log`; `vercel ls` once; smoke https://pill-app-delta.vercel.app/{welcome,demo,station,medicines,schedule} at 390 (0 errors); send dpl id to BOSS + security (`tell security`).
- [ ] **pill-site**: same steps → https://pill-site.vercel.app; smoke hero, #built, #screens, #table at 390/1280.
- [ ] Post both URLs + dpl ids to #website / #software; update `pitch/DEVPOST-FINAL.md` only if a URL changes.

## 4. Pill Gate at the table (owner + Aaron, after the tape fixes)
- [ ] `cd ~/Downloads/peel && ./start.sh both`; water-only control run; 3 Quick reference runs of the same aspirin → Profiles → Build reference (Cloudiness, side sensor); a 4th run → should read *Passed the screen*; a different tablet → *Needs lab testing*. Fill `[FILL 6]` and the "Real vs simulated" station rows with what actually happened (scan ids from `/api/scans`).
- [ ] Only if judges will open it on their phones: `./start.sh online` (PIN 8+ chars), keep the tunnel up only during judging, restore `app/data/profiles` from the backup afterwards.

## 5. Devpost (owner, 08:00–08:30)
- [ ] `pitch/DEVPOST-ANSWERS.md` → paste; `pitch/DEVPOST-FORM.md` → ticks + sponsor paragraphs + feedback + AI tools; resolve every `[FILL` (repo public, YouTube link, Figma links, Nessie key or untick, chamber question, pharmacist line or delete, team names, emails, schools, domain, Gemini project number).
- [ ] Gallery: thumbnail `photos/station/station-19.jpg` cropped 3:2; `station-191.jpg`; `station-17`/`171` only with the top-right corner cropped (handwritten name); app screenshots converted to PNG/JPG (the `.png` files in `pillgate/dev-shots/ui2/` are WebP inside; use `sips -s format png`).
- [ ] Video: YouTube Unlisted/Public, "not for kids"; the current film's narration describes the first design (a note is under the link in the answers); a v2 renders only if the owner says "make the v2".

## Open with the owner
- He said (Sat 21:2x) he will talk more about the hosts (real deal :8000 vs demo :8001), the reset flow and what judges should see first. Ask before changing the demo flow.
- Team names, repo visibility, the Figma import from an Edu account, Gemini billing, CDP key, domain: all his.
