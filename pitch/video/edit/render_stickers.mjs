// Renders stickers/*.svg to 1024² PNGs with a real alpha channel (qlmanage paints a white background).
//   node pitch/video/edit/render_stickers.mjs
// Uses puppeteer-core from pitch/film/node_modules and the local Chrome (CHROME= to override).
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '../../film/package.json'));
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = path.join(HERE, 'stickers');
const font = (f) => pathToFileURL(path.join(HERE, 'fonts', f)).href;
const CSS = `@font-face{font-family:"Inter";src:url("${font('Inter-Variable.ttf')}");font-weight:100 900}
@font-face{font-family:"Instrument Serif";src:url("${font('InstrumentSerif-Regular.ttf')}")}
html,body{margin:0;background:transparent}svg{display:block}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.svg')).sort()) {
    const svg = readFileSync(path.join(DIR, f), 'utf8');
    await page.goto(pathToFileURL(DIR + '/').href, { waitUntil: 'load' });  // file:// origin so the @font-face URLs load
    await page.setContent(`<!doctype html><style>${CSS}</style>${svg}`, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const out = path.join(DIR, f.replace(/\.svg$/, '.png'));
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
    console.log('wrote', path.relative(process.cwd(), out));
  }
} finally {
  await browser.close();
}
