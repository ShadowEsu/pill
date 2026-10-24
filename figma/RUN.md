# Run the Pill → Figma plugin (teammate, ~10 minutes)

Before you start: `figma/deck.json` must exist. If anything in the repo changed, rebuild it: `node figma/build-deck.mjs` (Node 22+, uses ffmpeg if installed, else macOS `sips`; prints size and slide count).

1. **Open the Figma desktop app** (development plugins only run there, not in the browser). Sign in with the Edu-verified account.
2. **Import the plugin:** in any file, menu → Plugins → Development → **Import plugin from manifest…** → pick `~/calhacks-13/figma/plugin/manifest.json`. One import works in Slides, Design and FigJam.
3. **Open a new Figma Slides file** (Home → New → Slides deck), name it "Pill — deck".
4. **Run it:** Plugins → Development → **Pill → Figma** → choose `figma/deck.json` → **Build**. 16 slides with speaker notes appear; the panel prints "Done in N s". Write N into `LINKS.md`. Then repeat in a **new Design file** ("Pill — design": pages Deck, App screens, Website, Tokens, Stage log) and a **new FigJam board** ("Pill — ideation"). Re-running replaces only what the plugin drew earlier.
5. **Share to Anyone:** in each file, Share → "Anyone with the link" → "can view". (Fonts: if Instrument Serif or JetBrains Mono is missing, the plugin falls back and says so in the panel.)
6. **Paste the three links and the build times into `figma/LINKS.md`.** Then run the Composio steps in `figma/COMPOSIO.md` (b) with the Design file's key, and fill the `[fill after running]` markers in `STAGE-LOG.md`.

Not yet run by anyone: steps 2–6. The plugin has only been exercised against a stub Figma API in Node (`node figma/measure-plugin.mjs`), which checks font loading, image bytes and editor branches, not Figma's renderer.

Optional, for the Figma Make prompt in STAGE-LOG Appendix A: figma.com → Make → paste the prompt → share to Anyone → add the link to `LINKS.md`.

Preview without Figma: open `figma/deck.html` (serve the repo root, e.g. `python3 -m http.server` and visit `/figma/deck.html`; `?present` gives a full-screen deck with arrow keys, `?slide=N` one slide). PNGs of every slide are in `figma/deck-preview/`.
