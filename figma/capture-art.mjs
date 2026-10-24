// Captures the slide art from the live site into figma/art/ (PNG), so build-deck.mjs can use it as image fills.
// Runs inside omp's eval `browser` tab.run (Puppeteer `page`), like shoot-deck.mjs:
//   const tab = await browser.open({ name: 'site', viewport: { width: 1440, height: 900 } });
//   await tab.run((await import('./figma/capture-art.mjs')).default, { args: ['https://pill-site.vercel.app', '/abs/path/figma/art'], timeout: 180000 })
// binary-pill.png    element: the hero's binary pill (pill.js canvas), panel and all, at 3×
// station.png        element: Fig 1, the station drawing (station.js SVG), assembled, at 2×
// site-hero.png      viewport 1440×900 at the top of the page
// site-verdicts.png  viewport scrolled to #verdicts
// site-payments.png  viewport scrolled to #payments
// tab.run serialises the function, so everything it needs lives inside it.
export default async function capture({ page }, url, outDir) {
  const SHOTS = [
    // [selector, file, device scale, settle ms, 'el' = element crop without the sticky nav | 'view' = the viewport as a visitor sees it]
    ['.hero-pill', 'binary-pill', 3, 2500, 'el'],
    ['#station-mount', 'station', 2, 9000, 'el'],
    ['#top', 'site-hero', 1, 7000, 'view'],
    ['#verdicts', 'site-verdicts', 1, 7000, 'view'],
    ['#payments', 'site-payments', 1, 7000, 'view'],
  ];
  const fs = await import('node:fs');
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (const [sel, name, dpr, settle, mode] of SHOTS) {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dpr });
    // viewport shots use the site's reduced-motion path, so typed headings are complete, not mid-animation
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: mode === 'view' ? 'reduce' : 'no-preference' }]);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (mode === 'el') await page.addStyleTag({ content: 'header.nav{display:none!important}' });
    const el = await page.$(sel);
    await el.evaluate((n, m) => n.scrollIntoView({ block: m === 'el' ? 'center' : 'start' }), mode);
    await new Promise((r) => setTimeout(r, settle)); // reveal, draw-in and typing animations finish
    const file = `${outDir}/${name}.png`;
    if (mode === 'el') await el.screenshot({ path: file });
    else await page.screenshot({ path: file });
    out.push(file);
  }
  return out;
}
