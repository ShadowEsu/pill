// Renders film.html frame by frame with headless Chrome, blends subframes with ffmpeg tmix (motion blur),
// renders the soundtrack in the page (OfflineAudioContext), mixes the voice-over, writes the SRT.
//
//   node render.mjs --storyboard            one PNG per beat → storyboard/
//   node render.mjs                         full render → pill-demo.mp4 (+ .srt, 60-s cut)
//   node render.mjs --sub 2 --from 0 --to 10 --out work/test.mp4   partial test, no audio
//
// One page only (the build machine is short on RAM); it is closed at the end.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { createReadStream, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SUB = parseInt(opt('--sub', '3'), 10);
const MIX_ONLY = flag('--mix-only');            // reuse work/video.mp4 and work/music.wav; redo SRT + mix + 60-s cut
const FPS = 30;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(path.join(ROOT, 'work'), { recursive: true });

// ── static server with Range support (video seeking needs it)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = statSync(p).size, type = MIME[path.extname(p)] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    createReadStream(p, { start, end }).pipe(res);
  } else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); createReadStream(p).pipe(res); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${server.address().port}/film.html`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(URL0, { waitUntil: 'load' });
await page.evaluate(() => document.body.classList.add('render'));
await page.evaluate(() => window.READY);
const DURATION = await page.evaluate(() => window.DURATION);
const stage = await page.$('#stage');
const shot = (type = 'jpeg') => page.screenshot({ type, quality: type === 'jpeg' ? 94 : undefined, clip: { x: 0, y: 0, width: 1920, height: 1080 }, optimizeForSpeed: true });
const seek = (t) => page.evaluate((x) => window.seek(x), t);

async function done() { await page.close(); await browser.close(); server.close(); }
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// ── storyboard: one frame per beat
if (flag('--storyboard')) {
  const beats = [
    ['01-moment-curve', 8.6], ['02-moment-needslab', 20.5], ['03-problem-1in10', 26.5], ['04-problem-cost', 37.2],
    ['05-box-binary', 43.4], ['06-box-chalk', 50.0], ['07-three-answers', 60.5], ['08-app-needslab', 72.0],
    ['09-app-release', 83.4], ['10-clinic-rail', 100.4], ['11-x402', 120.5], ['12-honesty', 139.6],
    ['13-figma', 149.8], ['14-end', 157.0],
  ];
  const only = opt('--at', null);   // e.g. --at 14.5,22.6 → storyboard/at-14.5.png … (transition checks)
  mkdirSync(path.join(ROOT, 'storyboard'), { recursive: true });
  const list = only ? only.split(',').map((x) => [`at-${x}`, parseFloat(x)]) : beats;
  for (const [name, t] of list) {
    await seek(t);
    const buf = await shot('png');
    writeFileSync(path.join(ROOT, only ? 'work' : 'storyboard', `${name}.png`), buf);
    console.log(`${only ? 'work' : 'storyboard'}/${name}.png  t=${t}`);
  }
  await done(); process.exit(0);
}

// ── soundtrack
const MUSIC = path.join(ROOT, 'work', 'music.wav');
if (!flag('--no-audio') && !MIX_ONLY) {
  const t0 = Date.now();
  const n = await page.evaluate(() => window.renderAudio());
  const size = 4 << 20; let b64 = '';
  for (let i = 0; i * size < n; i++) b64 += await page.evaluate((k, s) => window.wavChunk(k, s), i, size);
  await page.evaluate(() => { window.__wav = null; });
  writeFileSync(MUSIC, Buffer.from(b64, 'base64'));
  console.log(`music.wav ${(n * 0.75 / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// ── frames → ffmpeg (SUB subframes per frame, averaged by tmix, then every SUB-th frame kept)
const from = parseFloat(opt('--from', '0')), to = Math.min(parseFloat(opt('--to', String(DURATION))), DURATION);
const VIDEO = path.join(ROOT, 'work', 'video.mp4');
const vout = flag('--no-audio') && opt('--out', null) ? path.join(ROOT, opt('--out')) : VIDEO;
const nFrames = MIX_ONLY ? 0 : Math.round((to - from) * FPS);
// screenshots arrive as full-range JPEG (yuvj420p); convert to limited-range yuv420p for players and uploads
const vf = (SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB,` : '') + 'scale=in_range=pc:out_range=tv,format=yuv420p';
const enc = MIX_ONLY ? null : spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS * SUB), '-i', '-',
  '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', vout], { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = MIX_ONLY ? null : new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg exit ' + c)))));
const write = (buf) => new Promise((r) => (enc.stdin.write(buf) ? r() : enc.stdin.once('drain', r)));
const tStart = Date.now();
for (let k = 0; k < nFrames; k++) {
  for (let j = 0; j < SUB; j++) {
    // subframes spread over one frame interval, centred on the frame time (a 360° shutter, softened by tmix weights)
    const t = from + k / FPS + (SUB > 1 ? (j - (SUB - 1) / 2) / (FPS * SUB) : 0);
    await seek(Math.max(0, Math.min(DURATION, t)));
    await write(await shot('jpeg'));
  }
  if (k % 150 === 0) {
    const el = (Date.now() - tStart) / 1000, eta = (el / (k + 1)) * (nFrames - k - 1);
    console.log(`frame ${k}/${nFrames}  ${el.toFixed(0)} s elapsed  eta ${(eta / 60).toFixed(1)} min`);
  }
}
if (!MIX_ONLY) {
  enc.stdin.end();
  await encDone;
  console.log(`video: ${nFrames} frames × ${SUB} subframes in ${((Date.now() - tStart) / 60000).toFixed(1)} min`);
}

// ── SRT from the caption timings
const VO = await page.evaluate(() => window.VO);
await done();
if (flag('--no-audio')) process.exit(0);

const stamp = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const caps = VO.flatMap((v) => v.captions);
const srt = caps.map((c, i) => { const next = caps[i + 1]; const e = Math.min(c.e + 0.35, next ? next.s - 0.02 : c.e + 0.35); return `${i + 1}\n${stamp(c.s)} --> ${stamp(e)}\n${c.text}\n`; }).join('\n');
writeFileSync(path.join(ROOT, 'pill-demo-captioned.srt'), srt);

// ── mix: VO bus at −16 LUFS integrated, music 18 dB under it (−34 LUFS). Both measured with EBU R128 and set with a
// static gain (no pumping); a limiter catches peaks.
const lufs = (file) => {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return parseFloat(log.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)[1]);
};
const VOBUS = path.join(ROOT, 'work', 'vo-bus.wav');
const voIn = []; let vfc = '';
VO.forEach((v, i) => { voIn.push('-i', path.join(ROOT, v.file)); vfc += `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(v.start * 1000)}:all=1[v${i}];`; });
vfc += VO.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${VO.length}:normalize=0:duration=longest,apad,atrim=0:${DURATION}[o]`;
ff([...voIn, '-filter_complex', vfc, '-map', '[o]', '-ar', '48000', VOBUS]);
const voGain = -16 - lufs(VOBUS), muGain = -34 - lufs(MUSIC);
console.log(`gains: VO ${voGain.toFixed(1)} dB, music ${muGain.toFixed(1)} dB`);
const inputs = ['-i', VIDEO, '-i', VOBUS, '-i', MUSIC];
const fc = `[1:a]volume=${voGain.toFixed(2)}dB,aformat=channel_layouts=stereo[vo];[2:a]atrim=0:${DURATION},aresample=48000,volume=${muGain.toFixed(2)}dB,aformat=channel_layouts=stereo[mu];` +
  `[vo][mu]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[a]`;
const OUT = path.join(ROOT, 'pill-demo.mp4');
ff([...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(DURATION), '-movflags', '+faststart', OUT]);
console.log('wrote', OUT);

// ── 60-second cut for social: the moment, the box, the release, the end title (whole VO lines only)
const CUT = [[0, 22.5], [40.0, 51.4], [74.5, 87.0], [151.0, 158.0]];
const parts = CUT.map(([a, b], i) => `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${(b - a - 0.12).toFixed(2)}:d=0.12[a${i}];`).join('');
ff(['-i', OUT, '-filter_complex', parts + CUT.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${CUT.length}:v=1:a=1[v][a]`, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(ROOT, 'pill-demo-60s.mp4')]);
console.log('wrote', path.join(ROOT, 'pill-demo-60s.mp4'));
