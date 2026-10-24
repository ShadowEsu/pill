#!/usr/bin/env node
// Import kit + hand-off zip, for when the plugin cannot run (RUN.md "Plan C").
//   figma/import-kit/slides/NN-name.png      every slide at 1920×1080 (copied from deck-preview/, so run shoot-deck first)
//   figma/import-kit/prototype/NN-name.png   the Prototype page's screens, 390×844 frames cropped from the shipped screenshots
//   figma/import-kit/tokens.css · tokens.json the app's CSS variables (COLOR + FLOAT ones become Figma variables)
// then redraws figma/deck-contact-sheet.png and rebuilds figma/pill-figma-package.zip.
// Order: build-deck.mjs → shoot-deck.mjs (PNGs + PDF) → build-pptx.mjs → this.
// Usage: node figma/package.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const KIT = path.join(HERE, 'import-kit');
const deck = JSON.parse(fs.readFileSync(path.join(HERE, 'deck.json'), 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

fs.rmSync(KIT, { recursive: true, force: true });
for (const d of ['slides', 'prototype']) fs.mkdirSync(path.join(KIT, d), { recursive: true });

// slides: deck-preview must match deck.json
const previews = fs.readdirSync(path.join(HERE, 'deck-preview')).filter((f) => f.endsWith('.png')).sort();
if (previews.length !== deck.slides.length) throw new Error(`deck-preview has ${previews.length} PNGs, deck.json has ${deck.slides.length} slides: run shoot-deck.mjs first`);
for (const f of previews) fs.copyFileSync(path.join(HERE, 'deck-preview', f), path.join(KIT, 'slides', f));
// contact sheet: all slides at 480×270, 4 per row, 20 px gutters
const rows = Math.ceil(previews.length / 4);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-pattern_type', 'glob', '-i', path.join(HERE, 'deck-preview', '*.png'),
  '-vf', `scale=480:270,tile=4x${rows}:padding=20:margin=20:color=0xD9DCDA`, '-frames:v', '1', path.join(HERE, 'deck-contact-sheet.png')]);
// prototype: crop each source screenshot to the frame's aspect (top of the screen), then scale to the frame (390×844), so a
// PNG dropped into the frame fills it exactly
const { w: FW, h: FH } = deck.design.prototype.size;
deck.design.prototype.screens.forEach((s, i) => {
  const out = path.join(KIT, 'prototype', `${String(i + 1).padStart(2, '0')}-${slug(s.name)}.png`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(ROOT, s.src), '-vf', `crop=iw:'min(ih,trunc(iw*${FH}/${FW}/2)*2)':0:0,scale=${FW}:${FH}:flags=lanczos`, out]);
});

// tokens
const items = deck.design.tokens.items;
const vars = items.filter((t) => t.kind !== 'text');
const hex = ({ r, g, b, a }) => '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
const css = `/* Pill app tokens: pill/web/src/index.css :root, ${items.length} declarations (${vars.length} become Figma variables:
   ${vars.filter((t) => t.kind === 'color').length} COLOR, ${vars.filter((t) => t.kind === 'number').length} FLOAT; the rest are font stacks, shadows and easings). Generated from figma/deck.json ${deck.generatedAt}. */
:root {
${items.map((t) => `  ${t.css}: ${t.value};`).join('\n')}
}
`;
const group = (kind, f) => Object.fromEntries(items.filter((t) => t.kind === kind).map((t) => [t.name, f(t)]));
const json = {
  $description: `Pill app tokens from pill/web/src/index.css (${deck.generatedAt}). "color" and "number" groups are the ${vars.length} Figma variables the plugin creates (collection "Pill tokens"); "text" stays CSS-only. Design-token format: $type / $value; aliases point at another color as {color.name}.`,
  color: group('color', (t) => ({ $type: 'color', $value: t.alias ? `{color.${t.alias}}` : hex(t.rgba), css: t.css, cssValue: t.value })),
  number: group('number', (t) => ({ $type: 'number', $value: t.number, css: t.css, cssValue: t.value })),
  text: group('text', (t) => ({ $type: 'string', $value: t.value, css: t.css })),
};
fs.writeFileSync(path.join(KIT, 'tokens.css'), css);
fs.writeFileSync(path.join(KIT, 'tokens.json'), JSON.stringify(json, null, 2) + '\n');

// zip (rebuilt from scratch so removed files do not linger)
const ZIP = path.join(HERE, 'pill-figma-package.zip');
const members = ['SUBMIT.md', 'RUN.md', 'LINKS.md', 'STAGE-LOG.md', 'COMPOSIO.md', 'VIDEO-SCRIPT.md', 'plugin', 'deck.json', 'pill-deck.pptx', 'pill-deck.pdf', 'import-kit'];
for (const m of members) if (!fs.existsSync(path.join(HERE, m))) throw new Error(`missing ${m}`);
fs.rmSync(ZIP, { force: true });
execFileSync('zip', ['-qrX', ZIP, ...members, '-x', '*.DS_Store'], { cwd: HERE });
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`import-kit  ${previews.length} slides · ${deck.design.prototype.screens.length} prototype screens · tokens ${items.length} (${vars.length} variables)`);
console.log(`zip         ${mb(fs.statSync(ZIP).size)} · ${members.join(', ')}`);
