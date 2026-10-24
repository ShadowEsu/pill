# Run the Pill → Figma plugin (teammate, ~10 minutes)

The owner's one-page checklist, in order, is `figma/SUBMIT.md`. This file is the detail behind it, plus two fallbacks that need no plugin: **Plan B** (the PPTX into Figma Slides, 5 minutes) and **Plan C** (the import kit into a Figma Design file).

Before you start: `figma/deck.json` must exist. If anything in the repo changed, rebuild everything (see "Rebuild" at the bottom). The slide art in `figma/art/` (binary pill, station drawing, three site crops) comes from the live site via `figma/capture-art.mjs`; re-run it only if the site changed.

## Plan A: the plugin (Slides + Design + FigJam)

1. **Open the Figma desktop app** (development plugins only run there, not in the browser). Sign in with the team's Education-plan account.
2. **Import the plugin:** in any file, menu → Plugins → Development → **Import plugin from manifest…** → pick `~/calhacks-13/figma/plugin/manifest.json`. One import works in Slides, Design and FigJam.
3. **Open a new Figma Slides file** (Home → New → Slides deck), name it "Pill — deck".
4. **Run it:** Plugins → Development → **Pill → Figma** → choose `figma/deck.json` → **Build**. 20 slides with speaker notes appear; the panel prints "Done in N s". Write N into `LINKS.md`. Then repeat in a **new Design file** ("Pill — design": pages Deck, Prototype, App screens, Website, Tokens, Stage log) and a **new FigJam board** ("Pill — ideation"). Re-running replaces only what the plugin drew earlier. Lines, arrows and chart curves arrive as editable vectors; screenshots and site art as image fills. **Prototype:** in the Design file open the Prototype page, press ▶ (Present) on the flow "Pill · judge flow" and click through the 8 screens once; then in the presentation view, Share → "Anyone with the link" → copy the **prototype (Present) link** into `LINKS.md` and STAGE-LOG Stage 2.
5. **Share to Anyone:** in each file, Share → "Anyone with the link" → "can view"; for the prototype, share the Present link from step 4, not the file link. (Fonts: if Instrument Serif or JetBrains Mono is missing, the plugin falls back and says so in the panel.)
6. **Paste the three links and the build times into `figma/LINKS.md`.** Then run the Composio steps in `figma/COMPOSIO.md` (b) with the Design file's key, and fill the `[fill after running]` markers in `STAGE-LOG.md`.

Not yet run by anyone: steps 2–6. The plugin has only been exercised against a stub Figma API in Node (`node figma/measure-plugin.mjs`), which checks font loading, image bytes, vector path syntax and editor branches, not Figma's renderer.

Optional, for the Figma Make prompt in STAGE-LOG Appendix A: figma.com → Make → paste the prompt → share to Anyone → add the link to `LINKS.md`.

## Plan B (5 minutes): import the PPTX into Figma Slides

Use this if the plugin will not import or will not run. Figma Slides imports `.pptx` on any plan ([Figma Learn: Import PowerPoint files to Figma Slides](https://help.figma.com/hc/en-us/articles/30601628883607-Import-PowerPoint-files-to-Figma-Slides)). Works in the browser too; no plugin, no desktop app.

1. Open the Figma **file browser** (figma.com → Home), signed in with the Education account, in the team or drafts where the deck should live.
2. Click **Import** (on some layouts: **Create** ▾ → **Import**), then **Import from computer**. Or drag the file onto the file browser.
3. Pick `~/calhacks-13/figma/pill-deck.pptx` → **Open**. Wait a few seconds (4 MB) → **Done**.
4. Open the new file; rename it "Pill — deck". Check: 20 slides, presenter notes on each (Notes button under the slide).
5. **Share → "Anyone with the link" → "can view" → Copy link** → paste into `LINKS.md` (row "Figma Slides deck"), with "Plan B: PPTX import" in the build-time column.

What changes on import (from the same Figma page): every text layer becomes **Inter**. The PPTX writes each serif heading smaller (50–78 % of its size) so it keeps its line breaks in Inter; to restore the look, select a heading, set Instrument Serif and scale it back up (about 1.3–1.6×). Tables, diagrams, video and animations are not imported; this deck has none (the stage log is text boxes). Curves and arrows are written as custom shapes; Figma's import of those is untested. If one is missing on a slide, drag that slide's PNG from `figma/import-kit/slides/` onto it.

Universal fallback: `figma/pill-deck.pdf` (20 pages, 1920×1080, printed from `deck.html` by headless Chromium) opens anywhere and can be uploaded wherever a deck file is accepted. The same `pill-deck.pptx` also opens in PowerPoint and Keynote.

## Plan C: rebuild the Design file from the import kit (by hand, ~20 minutes)

Figma Design imports PNG and SVG by drag and drop. `figma/import-kit/`:

| Path | What | Where it goes |
|---|---|---|
| `slides/01-title.png` … `20-ask-and-next.png` | every slide, 1920×1080 | page **Deck**: drag all 20 onto the canvas (each becomes an image layer at full size); select all → Arrange → Tidy up |
| `prototype/01-welcome.png` … `08-dashboard-after.png` | the 8 Prototype screens, 390×844 (newest app pass) | page **Prototype**: Frame tool (F) → preset iPhone 13/14 (390×844) ×8 in a row; drag one PNG into each frame. Prototype tab: select frame 1 → drag the blue handle to frame 2 (On click → Navigate to), repeat to 8 → 1; frame 1 → Flow starting point "Pill · judge flow". Then ▶ Present and share that Present link |
| `tokens.json` | the app's tokens (design-token format `$type`/`$value`): `color` 40 + `number` 3 = the 43 variables the plugin makes; `text` 8 (fonts, shadows, easings) stay CSS-only | page **Tokens**: right panel (nothing selected) → Local variables → Create collection "Pill tokens" → one COLOR variable per `color` entry (aliases like `{color.mint}` → "Create alias") and one NUMBER per `number` entry |
| `tokens.css` | the same tokens as a `:root` block (pill/web/src/index.css) | reference, or paste into Figma Make / Dev Mode notes |

## Rebuild (after any repo change)

```sh
node figma/build-deck.mjs                      # deck.json + deck.html + metrics.json (prints slide count, size; runs the plugin against a stub API)
python3 -m http.server 5391 --bind 127.0.0.1   # from the repo root, in another terminal, for the next step
# omp eval (JS): see the header of figma/shoot-deck.mjs: default export → deck-preview/*.png, `pdf` export → pill-deck.pdf
(cd figma && npm i) && node figma/build-pptx.mjs   # pill-deck.pptx from deck.json
node figma/package.mjs                         # import-kit/ (slides, prototype, tokens) + pill-figma-package.zip
```

Preview without Figma: open `figma/deck.html` (serve the repo root as above and visit `/figma/deck.html`; `?present` gives a full-screen deck with arrow keys, `?slide=N` one slide). PNGs of every slide are in `figma/deck-preview/`, all twenty on one image in `figma/deck-contact-sheet.png`.
