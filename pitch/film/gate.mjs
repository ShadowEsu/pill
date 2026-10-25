// v2 edit: inserts the 25-s "At the table" Pill Gate segment after the opening moment, keeps the film ≤ 3:00,
// re-times the voice-over, captions and soundtrack, and writes pill-demo-v2.mp4, pill-demo-v2.srt, pill-demo-60s-v2.mp4.
//
//   node record-gate.mjs   (once) → work/gate.webm + work/gate-marks.json
//   node gate.mjs
//
// Inputs: work/video.mp4 (the v1 picture, 158 s, from render.mjs), vo/*.aiff + vo/timing.js, work/gate.webm.
// One headless page renders the still layers (gate-layers.html) and the soundtrack (film.html), then closes.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { createReadStream, statSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const W = (f) => path.join(ROOT, 'work', f);
const L = (f) => path.join(ROOT, 'work', 'gate', f);
mkdirSync(L(''), { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const lufs = (file) => parseFloat(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)[1]);

// ── the edit decision list (v1 seconds). The segment goes in at 21.95 s (the moment has finished; VO 02 ends 21.89 s).
// To stay under 3:00 three static holds come out: 100.65–101.55 (clinic rail, everything drawn), 121.60–122.35
// (x402, cap bar full) and the last 1.7 s of the end title (it still holds 1.9 s after the last word).
const T_IN = 21.95, SEG = 25.0;
const EDL = [
  { src: 'v1', a: 0, b: T_IN },
  { src: 'seg', a: 0, b: SEG },
  { src: 'v1', a: T_IN, b: 100.65 },
  { src: 'v1', a: 101.55, b: 121.6 },
  { src: 'v1', a: 122.35, b: 156.3 },
];
let acc = 0; for (const e of EDL) { e.at = acc; acc += e.b - e.a; }
const TOTAL = +acc.toFixed(3);
const map = (t) => { for (const e of EDL) if (e.src === 'v1' && t >= e.a && t <= e.b) return e.at + (t - e.a); return null; };
console.log('v2 length', TOTAL, 's; segment at', T_IN, '–', T_IN + SEG);
if (TOTAL > 180) throw new Error('over 3:00');

// ── segment cut list (seconds in work/gate.webm, speed). Marks from record-gate.mjs: bottle 3.56, tablet 8.02,
// measure 12.08, start 14.3, water ok 25.0, tablet in 27.5, dissolving end 51.6, result 52.2.
const PIECES = [
  { a: 0.4, b: 2.6, k: 1, step: -1 },          // Welcome
  { a: 3.7, b: 7.3, k: 1, step: 0 },           // Bottle: label photo
  { a: 8.2, b: 11.2, k: 1, step: 1 },          // Tablet photo
  { a: 12.3, b: 13.7, k: 1, step: 2 },         // Measure: prepare
  { a: 14.3, b: 25.0, k: 4, step: 2 },         // clean-water check, 4×
  { a: 25.2, b: 27.4, k: 1, step: 3 },         // add the tablet
  { a: 27.6, b: 51.6, k: 6, step: 3 },         // dissolving, 6×
  { a: 52.4, b: 58.325, k: 1, step: 4 },       // Result (existing scan, Unable to verify)
];
const SHORT = [
  { a: 25.4, b: 27.0, k: 1, step: 3 },
  { a: 27.6, b: 51.6, k: 12, step: 3 },
  { a: 52.4, b: 56.8, k: 1, step: 4 },
];
const lay = (pieces) => { let t = 0; return pieces.map((p) => { const d = (p.b - p.a) / p.k; const r = { ...p, s: t, e: t + d }; t += d; return r; }); };
const SEGP = lay(PIECES), SHORTP = lay(SHORT);
const segLen = SEGP.at(-1).e, shortLen = SHORTP.at(-1).e;
console.log('segment', segLen.toFixed(3), 's; short', shortLen.toFixed(3), 's');

// ── voice-over for the segment (same voice and rate as the film)
const VO_GATE = 'One tablet, one cup, sixty seconds. The board streams light readings once a second; the app decides. Three answers only: passed the screen, needs lab testing, or unable to verify.';
const VO_SHORT = 'One tablet, one cup, sixty seconds. Three answers only.';
if (process.argv.includes('--revo') || !existsSync(path.join(ROOT, 'vo/13-gate.aiff'))) {   // say only when missing (or --revo)
  execFileSync('say', ['-v', 'Samantha', '-r', '175', '-o', path.join(ROOT, 'vo/13-gate.aiff'), VO_GATE]);
  execFileSync('say', ['-v', 'Samantha', '-r', '175', '-o', path.join(ROOT, 'vo/14-gate-short.aiff'), VO_SHORT]);
}
const sil = (f) => { const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'silencedetect=noise=-38dB:d=0.15', '-f', 'null', '-'], { encoding: 'utf8' }).stderr; const o = []; let s = null; for (const l of log.split('\n')) { const a = l.match(/silence_start: ([\d.]+)/); if (a) s = +a[1]; const b = l.match(/silence_end: ([\d.]+)/); if (b && s != null) { o.push([s, +b[1]]); s = null; } } return o; };
const gDur = probe(path.join(ROOT, 'vo/13-gate.aiff')), sDur = probe(path.join(ROOT, 'vo/14-gate-short.aiff'));
// sentence ends: the pause nearest to the end of each sentence's share of the words
const gs = sil(path.join(ROOT, 'vo/13-gate.aiff'));
const near = (x) => gs.reduce((b, p) => (Math.abs((p[0] + p[1]) / 2 - x) < Math.abs((b[0] + b[1]) / 2 - x) ? p : b));
const s1 = near(gDur * 0.24), s2 = near(gDur * 0.56);
const VO_AT = 8.9;                                  // seconds into the segment (measure page)
const CAPS = [
  { i: 0, s: VO_AT, e: VO_AT + s1[1] },
  { i: 1, s: VO_AT + s1[1], e: VO_AT + s2[1] },
  { i: 2, s: VO_AT + s2[1], e: segLen - 0.3 },
];
const ss = sil(path.join(ROOT, 'vo/14-gate-short.aiff'))[0] || [sDur / 2, sDur / 2];
const SVO_AT = 0.2;
const SCAPS = [{ i: 0, s: SVO_AT, e: SVO_AT + ss[1] + 0.6 }, { i: 2, s: SVO_AT + ss[1] + 0.6, e: shortLen - 0.2 }];
const CAP_TEXT = ['One tablet, one cup, 60 seconds.', 'The board streams light readings once a second; the app decides.', 'Three answers only: Passed the screen · Needs lab testing · Unable to verify'];
const ctx = { window: {} }; vm.runInNewContext(readFileSync(path.join(ROOT, 'vo/timing.js'), 'utf8'), ctx);
// ── SRT: v1 captions mapped onto the v2 timeline (cues inside a removed hold are clipped at the cut) + segment captions
const stamp = (s) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const v1caps = ctx.window.VO.flatMap((v) => v.captions);
const cues = [];
v1caps.forEach((c, i) => {
  const next = v1caps[i + 1];
  const e = Math.min(c.e + 0.35, next ? next.s - 0.02 : c.e + 0.35);
  const span = EDL.find((x) => x.src === 'v1' && c.s >= x.a && c.s < x.b);
  if (!span) return;
  cues.push({ s: span.at + (c.s - span.a), e: span.at + (Math.min(e, span.b) - span.a), text: c.text });
});
CAPS.forEach((c) => cues.push({ s: T_IN + c.s, e: T_IN + c.e, text: CAP_TEXT[c.i] }));
cues.sort((a, b) => a.s - b.s);
writeFileSync(path.join(ROOT, 'pill-demo-v2.srt'), cues.map((c, i) => `${i + 1}\n${stamp(c.s)} --> ${stamp(c.e)}\n${c.text}\n`).join('\n'));
if (process.argv.includes('--srt-only')) { console.log('wrote pill-demo-v2.srt', cues.length, 'cues'); process.exit(0); }

// ── one page: still layers + soundtrack. --stitch-only skips the browser and reuses work/gate/*.png + work/music-v2.wav
// (all written by an earlier run); everything after this block is ffmpeg only.
const STITCH = process.argv.includes('--stitch-only');
if (STITCH && !['bg0.png', 'frame.png', 'cap2.png', 'chip12.png'].every((f) => existsSync(L(f)))) throw new Error('--stitch-only: layers missing in work/gate/');
if (STITCH && !existsSync(W('music-v2.wav'))) throw new Error('--stitch-only: work/music-v2.wav missing');
if (!STITCH) {
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = statSync(p).size, type = MIME[path.extname(p)] || 'application/octet-stream';
  const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 }); createReadStream(p, { start: a, end: b }).pipe(res); }
  else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': size }); createReadStream(p).pipe(res); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
const still = async (q, out, transparent) => {
  await page.goto(BASE + 'gate-layers.html?' + q, { waitUntil: 'load' });
  await page.evaluate(() => window.READY);
  writeFileSync(L(out), await page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: 1920, height: 1080 } }));
};
for (const s of [-1, 0, 1, 2, 3, 4]) await still(`layer=bg&step=${s}`, `bg${s + 1}.png`, false);
await still('layer=frame', 'frame.png', true);
for (const i of [0, 1, 2]) await still(`layer=cap&i=${i}`, `cap${i}.png`, true);
for (const k of [4, 6, 12]) await still(`layer=chip&text=${encodeURIComponent(`${k}× SPEED · REPLAY RUN`)}`, `chip${k}.png`, true);

// soundtrack: continuous over the whole v2 timeline; ticks at the v1 scene changes (re-timed) and at both segment cuts
const v1Ticks = [22.5, 39.5, 51.5, 62.5, 87, 102, 123, 141, 151].map(map).filter((x) => x != null);
const ticks = [T_IN, T_IN + SEG, ...v1Ticks].sort((a, b) => a - b);
await page.goto(BASE + 'film.html', { waitUntil: 'load' });
await page.evaluate(() => window.READY);
const n = await page.evaluate((o) => window.renderAudio(o), { duration: TOTAL, ticks });
let b64 = ''; const CH = 4 << 20;
for (let i = 0; i * CH < n; i++) b64 += await page.evaluate((k, s) => window.wavChunk(k, s), i, CH);
writeFileSync(W('music-v2.wav'), Buffer.from(b64, 'base64'));
await page.close(); await browser.close(); server.close();
}

// ── segment picture: paper + chrome + step list, the phone recording, rounded frame, chips, captions
function segment(pieces, caps, len, out) {
  const parts = pieces.map((p, i) => `[0:v]trim=${p.a}:${p.b},setpts=(PTS-STARTPTS)/${p.k},fps=30[p${i}]`).join(';');
  let fc = `${parts};${pieces.map((_, i) => `[p${i}]`).join('')}concat=n=${pieces.length}:v=1:a=0,scale=397:860:flags=lanczos,setsar=1[ph];`;
  // background: one still per step, switched by time
  const inputs = ['-i', W('gate.mp4')];
  const bgIdx = {}; [-1, 0, 1, 2, 3, 4].forEach((s) => { bgIdx[s] = inputs.filter((x) => x === '-i').length; inputs.push('-loop', '1', '-framerate', '30', '-t', String(len), '-i', L(`bg${s + 1}.png`)); });
  const fr = inputs.filter((x) => x === '-i').length; inputs.push('-loop', '1', '-framerate', '30', '-t', String(len), '-i', L('frame.png'));
  const capIdx = {}; [0, 1, 2].forEach((i) => { capIdx[i] = inputs.filter((x) => x === '-i').length; inputs.push('-loop', '1', '-framerate', '30', '-t', String(len), '-i', L(`cap${i}.png`)); });
  const chipIdx = {}; [4, 6, 12].forEach((k) => { chipIdx[k] = inputs.filter((x) => x === '-i').length; inputs.push('-loop', '1', '-framerate', '30', '-t', String(len), '-i', L(`chip${k}.png`)); });
  let cur = `[${bgIdx[-1]}:v]`; let k = 0;
  const ov = (src, en, x = 0, y = 0) => { const o = `[o${k++}]`; fc += `${cur}${src}overlay=${x}:${y}:enable='${en}'${o};`; cur = o; };
  const steps = [...new Set(pieces.map((p) => p.step))];
  for (const s of steps) { if (s === -1) continue; const spans = pieces.filter((p) => p.step === s).map((p) => `between(t,${p.s.toFixed(3)},${(p.e - 0.001).toFixed(3)})`).join('+'); ov(`[${bgIdx[s]}:v]`, spans); }
  ov('[ph]', '1', 520, 118);
  ov(`[${fr}:v]`, '1');
  for (const p of pieces) if (p.k > 1) ov(`[${chipIdx[p.k]}:v]`, `between(t,${p.s.toFixed(3)},${p.e.toFixed(3)})`);
  for (const c of caps) ov(`[${capIdx[c.i]}:v]`, `between(t,${c.s.toFixed(3)},${c.e.toFixed(3)})`);
  fc += `${cur}trim=0:${len},format=yuv420p[v]`;
  ff([...inputs, '-filter_complex', fc, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_range', 'tv', out]);
}
segment(SEGP, CAPS, segLen, W('seg.mp4'));
segment(SHORTP, SCAPS, shortLen, W('seg8.mp4'));

// ── v2 picture
const vParts = EDL.map((e, i) => (e.src === 'v1' ? `[0:v]trim=${e.a}:${e.b},setpts=PTS-STARTPTS[x${i}]` : `[1:v]setpts=PTS-STARTPTS[x${i}]`)).join(';');
ff(['-i', W('video.mp4'), '-i', W('seg.mp4'), '-filter_complex', `${vParts};${EDL.map((_, i) => `[x${i}]`).join('')}concat=n=${EDL.length}:v=1:a=0,format=yuv420p[v]`,
  '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-color_range', 'tv', W('video-v2.mp4')]);

// ── voice-over bus: v1 lines re-timed + the segment line; music 18 dB under (static gains, measured EBU R128)
const VO = ctx.window.VO.map((v) => ({ ...v, at: map(v.start) }));
VO.push({ id: '13', file: 'vo/13-gate.aiff', at: T_IN + VO_AT });
const voIn = []; let vfc = '';
VO.forEach((v, i) => { voIn.push('-i', path.join(ROOT, v.file)); vfc += `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(v.at * 1000)}:all=1[v${i}];`; });
vfc += VO.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${VO.length}:normalize=0:duration=longest,apad,atrim=0:${TOTAL}[o]`;
ff([...voIn, '-filter_complex', vfc, '-map', '[o]', '-ar', '48000', W('vo-bus-v2.wav')]);
const voGain = -16 - lufs(W('vo-bus-v2.wav')), muGain = -34 - lufs(W('music-v2.wav'));
console.log(`gains: VO ${voGain.toFixed(1)} dB, music ${muGain.toFixed(1)} dB`);
const OUT = path.join(ROOT, 'pill-demo-v2.mp4');
ff(['-i', W('video-v2.mp4'), '-i', W('vo-bus-v2.wav'), '-i', W('music-v2.wav'), '-filter_complex',
  `[1:a]volume=${voGain.toFixed(2)}dB,aformat=channel_layouts=stereo[vo];[2:a]atrim=0:${TOTAL},aresample=48000,volume=${muGain.toFixed(2)}dB,aformat=channel_layouts=stereo[mu];[vo][mu]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(TOTAL), '-movflags', '+faststart', OUT]);
console.log('wrote', OUT, probe(OUT));

// ── 60-s cut: the moment, the 8-s station segment, the box, the release, the end title
const CUT = [[0, T_IN], ['seg8'], [map(40.0), map(51.4)], [map(74.5), map(87.0)], [map(151.0), TOTAL]];
const sGain = -16 - lufs(path.join(ROOT, 'vo/13-gate.aiff'));   // the short line at the long line's level
let cf = '';
CUT.forEach((c, i) => {
  if (c[0] === 'seg8') {
    cf += `[1:v]setpts=PTS-STARTPTS[v${i}];[2:a]aresample=48000,aformat=channel_layouts=mono,volume=${sGain.toFixed(2)}dB,adelay=${Math.round(SVO_AT * 1000)}:all=1,apad,atrim=0:${shortLen},aformat=channel_layouts=stereo[sv];`
      + `[3:a]atrim=${T_IN}:${T_IN + shortLen},asetpts=PTS-STARTPTS,aresample=48000,volume=${muGain.toFixed(2)}dB,aformat=channel_layouts=stereo[sm];[sv][sm]amix=inputs=2:normalize=0:duration=first,afade=t=in:d=0.08,afade=t=out:st=${(shortLen - 0.12).toFixed(2)}:d=0.12[a${i}];`;
  } else {
    const [a, b] = c;
    cf += `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${(b - a - 0.12).toFixed(2)}:d=0.12[a${i}];`;
  }
});
cf += CUT.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${CUT.length}:v=1:a=1[v][a]`;
const OUT60 = path.join(ROOT, 'pill-demo-60s-v2.mp4');
ff(['-i', OUT, '-i', W('seg8.mp4'), '-i', path.join(ROOT, 'vo/14-gate-short.aiff'), '-i', W('music-v2.wav'), '-filter_complex', cf, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', OUT60]);
console.log('wrote', OUT60, probe(OUT60));
writeFileSync(W('gate-edl.json'), JSON.stringify({ T_IN, SEG: segLen, TOTAL, EDL, CAPS, SCAPS }, null, 1));
