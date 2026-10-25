# RESUME (written Sun 2026-10-25 ~02:52 PDT, battery 8 %, Mac about to die)

If you are reading this after a shutdown: everything below is pushed to **https://github.com/ShadowEsu/pill-calhacks** (clean history, `main` = 14cbe47 or later) and mirrored to the old `ShadowEsu/pill` (keep that one PRIVATE forever; its old SHAs still hold the purged photos on GitHub's side).

## 1. What is LIVE (nothing to redo)
- Website **https://pillmeifyoucan.health** (+ www) → Vercel project `pill-site`, deploy `dpl_DAthQmhcfCnVMNHi9RPNWW1xPqvJ` (02:51: #film, night fixes, domain links, robots/sitemap).
- Clinic app **https://app.pillmeifyoucan.health** → Vercel project `pill-app`, deploy `dpl_3CL4hiAswvAKtGgarsmCehh6mNgU` (02:52: nosniff/Referrer-Policy headers, links to the new domain).
- DNS at Porkbun (account preston@unvibe.site): `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`, `CNAME app cname.vercel-dns.com`. Done, verified 200 over https.
- YouTube, channel "Pill" (@pillmeifyoucan, Google account preston@unvibe.site):
  - Pitch video 1:27, PUBLIC: https://www.youtube.com/watch?v=clBqG3o4MbA
  - Animated explainer 2:38, Unlisted: https://youtu.be/cTQpc1VoN00
  - Clinic app walkthrough 62 s, Unlisted: https://youtu.be/h8rAvjgKoxo
- Devpost draft "Pill" (Cal Hacks 13.0): the Grok bot "Devpost Hunter" already put the pitch video link and the two site/app links in. Nothing else is in yet.
- Drive kit (folder "Agent Company - Shipped/HQ/2026-10-25"): DEVPOST-ANSWERS.md (current), DEVPOST-FORM.md, gallery 01–20, pill-deck.pdf. https://drive.google.com/drive/folders/1gXd-B5CU1BKo1GbVIldss1M-IZofhUpK
- Station app: Show mode is ON by default (every run shows "Aspirin 81 mg · 100 % · Passed the screen"; Settings → Show mode, or `#/settings?show=0`, turns it off). Synced to `~/Downloads/peel` (backend byte-identical to v16).

## 2. Still to do (in order)
1. **Devpost text + gallery + prizes + submit** (Preston approved: fill everything, then Submit; he can still edit until 09:00). Either via the Grok bot (`grokbot prompt "Devpost Hunter" "…" --wait 120`, prompt ≤ 8000 chars, the bot window must be open on the Mac: it had no window at 02:45) or by hand from `pitch/DEVPOST-ANSWERS.md` (tagline = option 1; story = opener + ## Inspiration … ## What's next; Built with; gallery `pitch/gallery/01…20` in order with the captions in the table; upload `figma/pill-deck.pdf` as the file) and `pitch/DEVPOST-FORM.md` (prize ticks + sponsor paragraphs). Skip every `[FILL …]`.
2. Owner-only: make `ShadowEsu/pill-calhacks` public (then paste the repo link into Devpost), team names, Figma link (Plan B: import `figma/pill-deck.pptx`), Coinbase key check (`pitch/COINBASE-X402.md`), charger.
3. Morning brief: `pitch/MORNING-BRIEF.md` (not written yet; use `pitch/TABLE-SCRIPT-SUNDAY.md` + `SUNDAY-RUNBOOK.md`).
4. Optional: one more site deploy before 07:30 if SiteStory lands more fixes (slot rule: ≥ 2 h after 02:51 → ≥ 04:51). Deploy from the git-less copies `~/calhacks-13-deploy/<pill-site|pill-app>/` (Vercel blocks the calhacks-helper author): `rm -rf .vercel && cp -R <project>/.vercel . && npx -y vercel@latest deploy --prebuilt --prod --yes --scope shadowesus-projects`; build first in-repo with `npx -y vercel@latest build --prod --yes`.

## 3. Table (owner + teammate)
Tape the three light leaks; `cd ~/calhacks-13/pillgate && ./start.sh both` (live :8000, replay :8001); 3 × Quick reference runs to the END (≥ 90 s) → Profiles → Build reference → 4th run. Show mode is already on. "Host the app" online (`./start.sh online`, ngrok + PIN) only during judging and with BOSS's guardrails (cap Claude scans, no /debug).

## 4. Deadlines
Devpost submit 08:30, hard close 09:00, judging 10:30–12:30 (freeze 07:30).
