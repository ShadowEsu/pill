#!/usr/bin/env node
// Reverse handoff: read colour tokens from a Figma Design file through Composio and print a CSS :root block.
// Usage: node figma/tokens-from-figma.mjs <FILE_KEY> [--account figma_yoker-tackle] [--diff]
//   FILE_KEY comes from figma.com/design/<FILE_KEY>/... (Design files only; the REST API does not read Slides/FigJam).
//   --diff compares against pill/web/src/index.css and prints only names whose value differs or is new.
// Needs the Composio CLI (~/.local/bin/composio) with an ACTIVE Figma connection. Not run yet: needs a file key.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const fileKey = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--account');
const account = args.includes('--account') ? args[args.indexOf('--account') + 1] : null;
if (!fileKey) { console.error('usage: node figma/tokens-from-figma.mjs <FILE_KEY> [--account <alias>] [--diff]'); process.exit(2); }

const bin = fs.existsSync(path.join(os.homedir(), '.local/bin/composio')) ? path.join(os.homedir(), '.local/bin/composio') : 'composio';
const run = (slug, data) => {
  const out = execFileSync(bin, ['execute', slug, ...(account ? ['--account', account] : []), '-d', JSON.stringify(data)], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const j = JSON.parse(out.slice(out.indexOf('{')));
  if (!j.successful) throw new Error(`${slug}: ${j.error || out.slice(0, 400)}`);
  return j.data;
};

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const css = (c, a = c.a ?? 1) => (a >= 0.999 ? hex(c) : `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${+a.toFixed(2)})`);
const varName = (n) => n.replace(/^pill\//, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const data = run('FIGMA_EXTRACT_DESIGN_TOKENS', { file_key: fileKey, include_local_styles: true, include_variables: true, extract_from_nodes: false });
const tokens = new Map();
// Walk whatever shape the tool returns and keep every {name, color|value} pair that is a colour.
(function walk(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, trail)); return; }
  const name = node.name || node.key || trail;
  const col = node.color || node.value || node.resolvedValue || (node.paints && node.paints[0] && node.paints[0].color) || (node.fills && node.fills[0] && node.fills[0].color);
  if (name && col && typeof col === 'object' && 'r' in col && 'g' in col && 'b' in col) {
    const opacity = node.opacity ?? node.paints?.[0]?.opacity ?? node.fills?.[0]?.opacity;
    tokens.set(varName(String(name)), css(col, opacity ?? col.a ?? 1));
  } else if (name && typeof col === 'string' && /^(#|rgba?\()/.test(col)) {
    tokens.set(varName(String(name)), col);
  }
  for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') walk(v, typeof name === 'string' ? name : k);
})(data, '');

let entries = [...tokens.entries()].sort(([a], [b]) => a.localeCompare(b));
if (args.includes('--diff')) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = new Map([...fs.readFileSync(path.join(here, '../pill/web/src/index.css'), 'utf8').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim().replace(/\s+/g, '').toLowerCase()]));
  entries = entries.filter(([k, v]) => local.get(k) !== v.replace(/\s+/g, '').toLowerCase());
}
console.log(`/* ${entries.length} colour tokens from Figma file ${fileKey} via Composio FIGMA_EXTRACT_DESIGN_TOKENS, ${new Date().toISOString()} */`);
console.log(':root {');
for (const [k, v] of entries) console.log(`  --${k}: ${v};`);
console.log('}');
if (!tokens.size) console.error('No colour tokens found. Run the Pill → Figma plugin in this Design file first (it creates pill/* paint styles and a "Pill tokens" variable collection).');
