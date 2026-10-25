// Renders the v2 pop-up stickers (process chain, step tracker, emoji, end chip) as tight RGBA PNGs in stickers/pop-*.png.
//   node pitch/video/edit/render_pops.mjs
// Each PNG is cropped to its own content (make_edit.py reads the size from the PNG header). Same palette as stickers/*.svg.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, '../../film/package.json'));
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const font = (f) => pathToFileURL(path.join(HERE, 'fonts', f)).href;
const CSS = `@font-face{font-family:"Inter";src:url("${font('Inter-Variable.ttf')}");font-weight:100 900}
@font-face{font-family:"Instrument Serif";src:url("${font('InstrumentSerif-Regular.ttf')}")}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url("${font('InstrumentSerif-Italic.ttf')}")}
html,body{margin:0;background:transparent}
.wrap{display:inline-block;padding:10px 26px 30px 10px}
.chip{display:inline-flex;align-items:center;gap:22px;font:700 72px/1 Inter,Helvetica,sans-serif;color:#111;
  background:#F4EFE6;border:6px solid #111;border-radius:999px;padding:34px 56px 34px 40px;box-shadow:10px 16px 0 rgba(17,17,17,.18);white-space:nowrap}
.chip.small{font-size:58px;padding:26px 46px 26px 30px}
.chip.violet{background:#7C5CFF;color:#fff}
.chip.amber{background:#F6D7A0}
.chip.green{background:#BFE8C9}
.dot{width:64px;height:64px;border-radius:50%;border:5px solid #111;display:inline-flex;align-items:center;justify-content:center;
  font:800 40px/1 Inter,sans-serif;color:#fff;flex:none}
.ok{background:#2E9E55}.q{background:#D98E04}.n{background:#111;color:#F4EFE6}.v{background:#7C5CFF}
.light{width:56px;height:56px;border-radius:50%;border:5px solid #111;display:inline-block}
.serif{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;font-size:84px}
.emoji{font:200px/1 "Apple Color Emoji";filter:drop-shadow(8px 12px 0 rgba(17,17,17,.18))}`;

const step = (n, label) => `<div class="chip small"><span class="dot n">${n}</span>Step ${n} of 6 · ${label}</div>`;
const STICKERS = {
  // the supply-chain process from his intro (0:08–0:35)
  'pop-fda': `<div class="chip green"><span class="dot ok">✓</span>FDA process</div>`,
  'pop-checked': `<div class="chip green"><span class="dot ok">✓</span>Checked again… and again</div>`,
  'pop-pharmacy': `<div class="chip green"><span class="dot ok">✓</span>Pharmacy shelf</div>`,
  'pop-last': `<div class="chip amber"><span class="dot q">?</span>The last step can fail</div>`,
  'pop-swap': `<div class="chip amber"><span class="dot q">!</span>Wrong drug inside?</div>`,
  // the Pill process, as he walks it
  'pop-step1': step(1, 'Prescription'),
  'pop-step2': step(2, 'What it looks like'),
  'pop-step3': step(3, 'Water to the line'),
  'pop-step4': step(4, 'Tablet in'),
  'pop-step5': step(5, 'Countdown'),
  'pop-step6': step(6, 'The answer'),
  'pop-3d': `<div class="chip violet"><span class="serif" style="color:#fff">3D-printed</span> ✨</div>`,
  'pop-lights': `<div class="chip"><span class="light" style="background:#E5484D"></span><span class="light" style="background:#3E63DD"></span><span class="light" style="background:#fff"></span>red · blue · white</div>`,
  'pop-measure': `<div class="chip violet">3 lights → 1 reading</div>`,
  'pop-end': `<div class="chip"><span class="dot v">1</span>tablet · one cup · three answers</div>`,
  // emoji punctuation
  'pop-think': `<div class="emoji">🤔</div>`,
  'pop-drop': `<div class="emoji">💧</div>`,
  'pop-timer': `<div class="emoji">⏱️</div>`,
  'pop-grimace': `<div class="emoji">😬</div>`,
  'pop-eyes': `<div class="emoji">👀</div>`,
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 600, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(HERE + '/').href, { waitUntil: 'load' });
  for (const [name, html] of Object.entries(STICKERS)) {
    await page.setContent(`<!doctype html><style>${CSS}</style><div class="wrap" id="s">${html}</div>`, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const el = await page.$('#s');
    const out = path.join(HERE, 'stickers', `${name}.png`);
    await el.screenshot({ path: out, omitBackground: true });
    console.log('wrote', path.relative(process.cwd(), out));
  }
} finally {
  await browser.close();
}
