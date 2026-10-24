// Screenshots every slide of deck.html at 1920×1080 into figma/deck-preview/NN-name.png, and prints the deck to one PDF.
// Runs inside omp's eval `browser` tab.run (Puppeteer `page`); pass the served deck URL as args[0].
// Example (omp eval, JS):  const tab = await browser.open({ name: 'deck', viewport: { width: 1920, height: 1080 } });
//                          const m = await import('./figma/shoot-deck.mjs');
//                          await tab.run(m.default, { args: ['http://127.0.0.1:5391/figma/deck.html', 'figma/deck-preview'] })
//                          await tab.run(m.pdf, { args: ['http://127.0.0.1:5391/figma/deck.html', 'figma/pill-deck.pdf'] })
export default async function shoot({ page }, url, outDir) {
  const fs = await import('node:fs');
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(url + '?slide=1', { waitUntil: 'networkidle0' });
  const names = await page.$$eval('.slide', (s) => s.map((n) => n.dataset.name));
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png')) fs.unlinkSync(`${outDir}/${f}`);
  const out = [];
  for (let i = 0; i < names.length; i++) {
    await page.goto(`${url}?slide=${i + 1}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const file = `${outDir}/${String(i + 1).padStart(2, '0')}-${names[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}.png`;
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    out.push(file);
  }
  return out;
}

/** deck.html → one 1920×1080 landscape page per slide (deck.html's @media print rules drop the notes and the scaling). */
export async function pdf({ page }, url, outFile) {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: outFile, width: '1920px', height: '1080px', landscape: false, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  return outFile;
}
