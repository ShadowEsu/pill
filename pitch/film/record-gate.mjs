// Records the Pill Gate station app (replay server on :8001) at 390×844, DPR 2 → work/gate.webm.
// Welcome → Bottle (label photo) → Tablet (tablet photo) → Measure (quick: clean water → tablet in → dissolving),
// then cancels the run before the 60-s auto stop (no new scan, no model spend) and opens an existing result.
// Prints the time (s since recording start) of each step to work/gate-marks.json for the edit.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8001/';
const SCAN = process.env.SCAN || 'scan_1024_191752_f0c2';
const IMG = new URL('../../pillgate/test-images/', import.meta.url).pathname;
const OUT = new URL('./work/gate.webm', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const marks = {};
let t0 = 0;
const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(k, marks[k]); };
const click = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const waitSel = (sel, ms = 90000) => page.waitForSelector(sel, { timeout: ms, visible: true });

try {
  await page.goto(BASE + '#/welcome', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('pillgate.mode', 'clinic'));
  await page.goto(BASE + '#/welcome', { waitUntil: 'load' });
  await sleep(800);
  const rec = await page.screencast({ path: OUT });
  t0 = Date.now(); mark('welcome');
  await sleep(2600);
  await click('[data-mode="check"]'); await sleep(900);
  await page.evaluate(() => { location.hash = '#/check/bottle'; }); await waitSel('#file-bottle, input[type=file]'); mark('bottle');
  await sleep(1200);
  const f1 = await page.$('input[type=file]'); await f1.uploadFile(IMG + 'aspirin-label.jpg'); mark('bottle-photo');
  await sleep(2600);
  await click('#vf-next'); await sleep(600);
  await waitSel('input[type=file]'); mark('tablet');
  await sleep(1000);
  const f2 = await page.$('input[type=file]'); await f2.uploadFile(IMG + 'aspirin-tablet.jpg'); mark('tablet-photo');
  await sleep(2400);
  await click('#vf-next'); await sleep(600);
  await waitSel('#btn-start'); mark('measure');
  await sleep(2200);
  await click('#btn-start'); mark('start');
  await waitSel('#btn-continue', 120000); mark('water-ok');
  await sleep(2500);
  await click('#btn-continue'); mark('tablet-in');
  await waitSel('#live-chart', 30000); mark('dissolving');
  await sleep(24000); mark('dissolving-end');
  await click('#btn-cancel'); await sleep(500);
  await page.evaluate((s) => { location.hash = '#/result/' + s; }, SCAN); mark('result');
  await sleep(9000); mark('end');
  await rec.stop();
} finally {
  writeFileSync(new URL('./work/gate-marks.json', import.meta.url), JSON.stringify(marks, null, 1));
  await page.close();
  await browser.close();
}
