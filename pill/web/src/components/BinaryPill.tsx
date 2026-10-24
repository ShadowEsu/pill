// The site's binary pill (pill-site/src/pill.js), ported: a ray-marched capsule printed in 1s and 0s, one glyph per cell.
// Lit faces print 1, shaded faces 0. The dots breathe and a brighter wave travels along the pill's long axis.
// dark (default): sky/mint glyphs on the navy panel. dark={false}: ink/sky/mint glyphs on a transparent card.
// Pauses off screen; prefers-reduced-motion draws one still frame.
import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface Props { width?: number; height?: number; dark?: boolean; className?: string; cell?: number; scale?: number; label?: string }

const R = 0.36, HALF = 0.82;
const LIGHT = norm([-0.45, 0.7, 1.2]);
function norm(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function sd(x: number, y: number, z: number) { const cx = Math.max(-HALF, Math.min(HALF, x)); return Math.hypot(x - cx, y, z) - R; }
function rot(x: number, y: number, z: number, ay: number, az: number): [number, number, number] {
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
  const cz = Math.cos(az), sz = Math.sin(az);
  return [cz * x1 - sz * y, sz * x1 + cz * y, z1];
}

export default function BinaryPill({ width = 320, height = 200, dark = true, className, cell, scale = 2, label = 'A capsule drawn in ones and zeros' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
    const cw0 = cell ?? Math.max(6, Math.min(9, width / 46));
    const COLS = Math.max(16, Math.round(width / cw0)), ROWS = Math.max(10, Math.round(height / (cw0 * 1.55)));
    const cw = cv.width / COLS, ch = cv.height / ROWS;
    const reduce = prefersReducedMotion();
    const bits = new Uint8Array(COLS * ROWS).map(() => (Math.random() < 0.5 ? 1 : 0));
    const aspect = width / height;
    const font = `${dark ? 400 : 500} ${Math.floor(ch * 0.92)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    let raf = 0, running = false, start = performance.now();

    function draw(t: number) {
      ctx!.clearRect(0, 0, cv!.width, cv!.height);
      ctx!.font = font;
      ctx!.textBaseline = 'top';
      const ay = t * 0.6, az = 0.35 + Math.sin(t * 0.3) * 0.12;
      const breathe = 0.88 + Math.sin(t * 1.6) * 0.12;
      const wave = ((t * 0.55) % 2.6) - 1.3; // travels along the pill's long axis
      const [dx, dy, dz] = rot(0, 0, -1, -ay, -az);
      if (!reduce && Math.random() < 0.35) bits[(Math.random() * bits.length) | 0] ^= 1;
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const sx = ((i + 0.5) / COLS * 2 - 1) * scale * aspect * 0.5, sy = -((j + 0.5) / ROWS * 2 - 1) * scale * 0.5;
        const [ox, oy, oz] = rot(sx, sy, 3, -ay, -az);
        let s = 0, hit = false, px = 0, py = 0, pz = 0;
        for (let k = 0; k < 40; k++) {
          px = ox + dx * s; py = oy + dy * s; pz = oz + dz * s;
          const dist = sd(px, py, pz);
          if (dist < 0.005) { hit = true; break; }
          s += dist; if (s > 7) break;
        }
        if (!hit) continue;
        const e = 0.002;
        const n = norm([sd(px + e, py, pz) - sd(px - e, py, pz), sd(px, py + e, pz) - sd(px, py - e, pz), sd(px, py, pz + e) - sd(px, py, pz - e)]);
        const nw = rot(n[0], n[1], n[2], az, ay);
        const lum = Math.max(0, nw[0] * LIGHT[0] + nw[1] * LIGHT[1] + nw[2] * LIGHT[2]);
        const rim = Math.pow(1 - Math.max(0, nw[2]), 2);
        const w = Math.exp(-((px - wave) ** 2) / 0.018);
        const half = px > 0;
        const hi = lum > 0.82 || w > 0.6;
        const a = Math.min(1, (0.45 + lum * 0.55) * breathe + w * 0.35);
        if (dark) ctx!.fillStyle = hi ? `rgba(236,246,255,${Math.min(1, 0.7 + lum * 0.3 + w * 0.2)})` : half ? `rgba(110,195,255,${a})` : `rgba(120,225,175,${Math.min(1, a + rim * 0.1)})`;
        else ctx!.fillStyle = hi ? `rgba(22,24,27,${Math.min(1, 0.6 + lum * 0.4)})` : half ? `rgba(42,143,224,${Math.min(1, a + 0.2)})` : `rgba(47,168,116,${Math.min(1, a + 0.2)})`;
        const bit = lum > 0.5 || w > 0.6 ? 1 : (bits[j * COLS + i] & (lum > 0.25 ? 1 : 0));
        ctx!.fillText(bit ? '1' : '0', i * cw, j * ch);
      }
    }
    const frame = (now: number) => { raf = 0; if (!running) return; draw((now - start) / 1000); raf = requestAnimationFrame(frame); };
    const play = () => { if (running || reduce) return; running = true; start = performance.now() - 900; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
    draw(0.9);
    if (reduce || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) play(); else stop(); }, { threshold: 0.05 });
    io.observe(cv);
    const vis = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [width, height, dark, cell, scale]);

  return (
    <canvas ref={ref} role="img" aria-label={label}
      className={['bpill', dark ? 'dark' : 'light', className].filter(Boolean).join(' ')}
      style={{ width, maxWidth: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }} />
  );
}
