// A capsule drawn out of 1s and 0s: one ray-marched signed-distance capsule per text cell.
// Lit faces print 1, shaded faces 0. No libraries. mountBinaryPill(canvas, { paper: true }) returns { stop() }.
export function mountBinaryPill(cv, opts = {}) {
  const ctx = cv.getContext('2d');
  const paper = !!opts.paper;
  const COLS = opts.cols || 72, ROWS = opts.rows || 44;
  const cw = cv.width / COLS, ch = cv.height / ROWS;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = 0.36, HALF = 0.82, SCALE = opts.scale || 1.3;
  const light = norm([-0.45, 0.7, 1.2]);
  const bits = new Uint8Array(COLS * ROWS).map(() => (Math.random() < 0.5 ? 1 : 0));
  let raf = 0, running = false, start = performance.now();

  function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
  function sd(p) { const x = Math.max(-HALF, Math.min(HALF, p[0])); return Math.hypot(p[0] - x, p[1], p[2]) - R; }
  function rot(p, ay, az) {
    let [x, y, z] = p;
    const cy = Math.cos(ay), sy = Math.sin(ay); [x, z] = [cy * x + sy * z, -sy * x + cy * z];
    const cz = Math.cos(az), sz = Math.sin(az); [x, y] = [cz * x - sz * y, sz * x + cz * y];
    return [x, y, z];
  }
  function draw(t) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = `${Math.floor(ch * 0.95)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';
    const ay = t * 0.6, az = 0.35 + Math.sin(t * 0.3) * 0.12;
    const aspect = cv.width / cv.height;
    if (!reduce && Math.random() < 0.3) bits[(Math.random() * bits.length) | 0] ^= 1;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const sx = ((i + 0.5) / COLS * 2 - 1) * SCALE * aspect * 0.5, sy = -((j + 0.5) / ROWS * 2 - 1) * SCALE * 0.5;
      const o = rot([sx, sy, 3], -ay, -az), d = rot([0, 0, -1], -ay, -az);
      let s = 0, hit = false, p;
      for (let k = 0; k < 48; k++) {
        p = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
        const dist = sd(p);
        if (dist < 0.004) { hit = true; break; }
        s += dist; if (s > 7) break;
      }
      if (!hit) continue;
      const e = 0.002;
      const n = norm([sd([p[0] + e, p[1], p[2]]) - sd([p[0] - e, p[1], p[2]]), sd([p[0], p[1] + e, p[2]]) - sd([p[0], p[1] - e, p[2]]), sd([p[0], p[1], p[2] + e]) - sd([p[0], p[1], p[2] - e])]);
      const nw = rot(n, az, ay);
      const lum = Math.max(0, nw[0] * light[0] + nw[1] * light[1] + nw[2] * light[2]);
      const rim = Math.pow(1 - Math.max(0, nw[2]), 2);
      const half = p[0] > 0;
      const a = 0.45 + lum * 0.55;
      const hi = lum > 0.82;
      if (paper) ctx.fillStyle = hi ? `rgba(22,24,27,${0.6 + lum * 0.4})` : half ? `rgba(79,179,255,${0.5 + lum * 0.5})` : `rgba(95,211,154,${0.5 + lum * 0.5})`;
      else ctx.fillStyle = hi ? `rgba(236,246,255,${0.7 + lum * 0.3})` : half ? `rgba(110,195,255,${0.5 + lum * 0.5})` : `rgba(120,225,175,${0.45 + lum * 0.5 + rim * 0.1})`;
      const bit = lum > 0.5 ? 1 : (bits[j * COLS + i] & (lum > 0.25 ? 1 : 0));
      ctx.fillText(bit ? '1' : '0', i * cw, j * ch);
    }
  }
  function frame(now) { raf = 0; if (!running) return; draw((now - start) / 1000); raf = requestAnimationFrame(frame); }
  function play() { if (running || reduce) return; running = true; start = performance.now() - 900; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  if (reduce) draw(0.9);
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) play(); else stop(); }, { threshold: 0.05 });
  io.observe(cv);
  return { stop: () => { stop(); io.disconnect(); }, play };
}
