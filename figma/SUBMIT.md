# Submit: the owner's 10-minute checklist (in order)

Everything below is ready in `~/calhacks-13/figma/` except what needs your Figma login. Tick as you go. Detail for each step: `figma/RUN.md`. Words on anything you type: PASS / NEEDS LAB / UNABLE TO VERIFY only; money says SANDBOX or TESTNET.

| ✓ | # | Step | Min | Do this | Result goes to |
|---|---|---|---|---|---|
| ☐ | 1 | **Edu verify** | 1 | [figma.com/education/apply](https://www.figma.com/education/apply) → Student → school email or proof ([Figma for Education](https://help.figma.com/hc/en-us/articles/360041061214-Figma-for-Education)). Once approved, create an Education team "Pill". Still pending? Carry on in **Drafts**; nothing below needs to wait. | |
| ☐ | 2 | **Import the plugin** | 1 | Figma **desktop app** → any file → menu → Plugins → Development → **Import plugin from manifest…** → `figma/plugin/manifest.json` | |
| ☐ | 3 | **Slides build** | 2 | Home → New → **Slides deck**, name "Pill — deck" → Plugins → Development → **Pill → Figma** → choose `figma/deck.json` → **Build**. Expect 21 slides with notes and "Done in N s". | N → `figma/LINKS.md` row 1 |
| ☐ | 4 | **Design build + Prototype** | 2 | New **Design file** "Pill — design" → same plugin → `figma/deck.json` → Build (pages Deck, Prototype, App screens, Website, Tokens, Stage log). Open page **Prototype** → ▶ **Present** (flow "Pill · judge flow") → click through the 8 screens once → in the presentation view **Share → Anyone with the link → Copy link**: that is the **Present link**. | N → row 2; Present link → row 4 note + STAGE-LOG Stage 2 |
| ☐ | 5 | **FigJam build** | 1 | New **FigJam board** "Pill — ideation" → same plugin → Build. | N → row 3 |
| ☐ | 6 | **Share each to Anyone** | 1 | In each of the three files: **Share → "Anyone with the link" → "can view" → Copy link**. Stage log link: in the Design file, right-click page **Stage log** → Copy link to page. | |
| ☐ | 7 | **Paste links** | 1 | Fill every `[fill after running]` in `figma/LINKS.md` (Slides, Design, FigJam, prototype Present link, video), and the Figma ones in `figma/STAGE-LOG.md`. | |
| ☐ | 8 | **Figma Make** (optional) | 2 | figma.com → **Make** → paste the prompt below → when it runs, **Share → Anyone** → copy link. | `figma/LINKS.md` row "Figma Make" |
| ☐ | 9 | **Composio (b)** | 2 | Terminal, in `~/calhacks-13`: `C=~/.local/bin/composio; A="--account figma_yoker-tackle"; KEY=<from figma.com/design/<KEY>/…>` then steps 1–5 of `figma/COMPOSIO.md` section (b) (file JSON, build-time comment, dev resources, thumbnails, tokens back to CSS). | results + minutes → `figma/STAGE-LOG.md` |
| ☐ | 10 | **Devpost fields** | 2 | Edit `pitch/DEVPOST.md`, then paste into Devpost. Replace each `[pending]` with the link below, or delete the sentence if it never became true. | Devpost |
| ☐ | 11 | **Video link** | 1 | Upload the demo (≤ 3 min, script `figma/VIDEO-SCRIPT.md`) to YouTube as Unlisted → copy link. | `pitch/DEVPOST.md` line 18 + `figma/LINKS.md` |

**Which link goes where in `pitch/DEVPOST.md`:**

| Devpost spot | Marker to replace | Link |
|---|---|---|
| Links · "Repo" (line 17) | `[pending: the owner makes it public]` | GitHub repo, after making it public |
| Links · "Demo video" (line 18) | `[pending: YouTube URL]` | YouTube link from step 11 |
| Links · "Figma stage log + Slides + prototype" (line 19) | `[pending: Figma links, shared to "Anyone"]` | Slides file link (step 6) · Stage log page link (step 6) · Present link (step 4) |
| Track · Figma paragraph (line 149) | `[pending: link to the Figma stage log]` | Stage log page link (or the Design file link) |
| same paragraph | `[pending: Figma Slides deck link]` | Slides file link |
| same paragraph | `[pending: embedded Make / prototype link]` | Figma Make link if step 8 ran, else the prototype Present link |
| Devpost "Try it out" links | | Slides link, Present link, site https://pill-site.vercel.app, app https://pill-app-delta.vercel.app |

## Plan B (5 minutes): the plugin will not run

Figma Slides imports PowerPoint on any plan ([Figma Learn](https://help.figma.com/hc/en-us/articles/30601628883607-Import-PowerPoint-files-to-Figma-Slides)), browser or desktop:

1. figma.com file browser → **Import** (or **Create** ▾ → **Import**) → **Import from computer** → `figma/pill-deck.pptx` → **Open** → **Done**.
2. Open it, rename "Pill — deck", check 21 slides with presenter notes. Text arrives as Inter (Figma's import rule); headings are pre-sized for that.
3. **Share → Anyone with the link → can view → Copy link** → `figma/LINKS.md` row 1 ("Plan B: PPTX import" as the build time) and the Devpost Slides spots above.

No Design file? The prototype can be rebuilt by hand from `figma/import-kit/prototype/*.png` and the Tokens page from `figma/import-kit/tokens.json` (RUN.md, Plan C). Last resort for any "deck" field: upload `figma/pill-deck.pdf` (21 pages, 1920×1080).

## Figma Make prompt (step 8; same text as `figma/STAGE-LOG.md` Appendix A)

> Build a clickable mobile prototype (390 × 844) of "Pill", an app that runs a tablet dissolution screen and shows one of three verdicts. Light theme: paper #F7F8F7 background, white cards with 20 px radius and a hairline border rgba(22,24,27,0.10), ink #16181B text, sky #4FB3FF for the run, mint #5FD39A for PASS, amber #E09A3A for NEEDS LAB, grey #9AA0A6 for UNABLE TO VERIFY. Text is always ink; colour goes only on backgrounds, lines, fills and chips. Headings in Instrument Serif, body in Inter, small labels in JetBrains Mono uppercase.
> Screens and flow:
> 1. Place: "Drop one quarter tablet. Close the lid." A big button "Start run".
> 2. Run: a vertical capsule (pill shape) that fills with sky blue from 0 to 100 % over about 8 seconds, a large percentage inside it, the word "dissolving" under it, a timer "0:29 / 3:00", and a four-segment timetable: fill, dissolve, settle, hold. When it reaches 100 % go to Evaluation automatically.
> 3. Evaluation: a verdict chip and big serif word. Default PASS (mint) with "Rule P1 · 100 % of reference plateau", two bars (inline channel, 90° glow) inside a dotted reference band, and a "Why" paragraph: "The plateau is inside the reference band and the glow rose with it. This is a screening result, not a lab test."
> 4. A three-way switch at the top of Evaluation flips the verdict to NEEDS LAB (amber, "Rule N2 · inline moved, glow did not rise") or UNABLE TO VERIFY (grey, "Rule U1 · no reference for this drug on this box").
> 5. Clinic decision: "Delivery D-0412 · $1,240.00 · SANDBOX". PASS shows "Policy proposes: release" and a button "Release payment" that changes to "Released · SANDBOX". NEEDS LAB shows "Held · lab referral drafted". UNABLE TO VERIFY shows "Escalated to a person · no money moves".
> Words: results use only PASS, NEEDS LAB and UNABLE TO VERIFY; describe PASS as "consistent with the reference", never as a judgement on the medicine. Money is always labelled SANDBOX.

Everything in one file for a teammate: `figma/pill-figma-package.zip` (plugin, deck.json, pill-deck.pptx, pill-deck.pdf, import-kit, these docs).
