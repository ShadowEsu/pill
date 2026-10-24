// Records the B2-07 → PASS → delivery d-1041 → press-and-hold Release take from the deployed app (work/clipC.webm).
// The TM-02 take (work/clipA.mp4) came from the same flow via /run/new?replay=TM-02&delivery=d-1042&speed=15.
// appcut.mp4 is cut from both with the ffmpeg trim/concat line in STORYBOARD.md's footnote.
import puppeteer from 'puppeteer-core';
const APP = 'https://pill-app-delta.vercel.app';
const OUT = new URL('./work/clipC.webm', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const clickText = (txt) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  if (!b) return false; b.click(); return true;
}, txt);
const waitText = (txt, ms = 60000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, txt);

await page.goto(APP + '/welcome', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(APP + '/welcome', { waitUntil: 'networkidle0' });
await page.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find((b) => /hospital, clinic/.test(b.textContent)); b && b.click(); });
await sleep(1500);
await page.goto(APP + '/bottle?delivery=d-1041', { waitUntil: 'networkidle0' });
await clickText('No camera?'); await sleep(5000);
await clickText('Save'); await sleep(2500);
await clickText('Attach and place'); await sleep(3000);
console.log('at', page.url());
const rec = await page.screencast({ path: OUT });
await sleep(1500);
await clickText('Start');
await page.waitForFunction(() => location.pathname.startsWith('/evaluation'), { timeout: 90000 });
console.log('eval', page.url());
await sleep(5000);
await clickText('Go to delivery'); await sleep(4000);
await clickText('Run policy');
await sleep(9000);
const box = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((b) => /release/i.test(b.getAttribute('aria-label') || b.textContent));
  b.scrollIntoView({ block: 'center' });
  const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label') || b.textContent, disabled: b.disabled };
});
console.log('button', box);
await sleep(1000);
await page.mouse.move(box.x - 200, box.y + 80);
await page.mouse.move(box.x, box.y, { steps: 20 });
await sleep(400);
await page.mouse.down();
await sleep(3500);
await page.mouse.up();
await sleep(6000);
console.log(await page.evaluate(() => document.body.innerText.match(/Decision log[\s\S]{0,600}/)?.[0]));
await rec.stop();
await browser.close();
