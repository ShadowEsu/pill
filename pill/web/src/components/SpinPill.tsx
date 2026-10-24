// A 3D capsule spinning slowly: half sky, half mint, glass highlight, soft studio light, on paper.
// Shaded mode: one shared offscreen WebGL renderer (analytic ray–capsule hit, 4× supersampled) blitted into each
// instance's 2D canvas, so any number of pills cost one GL context. Glyph mode: the website hero's capsule printed
// out of 1s and 0s (lit faces 1, shaded faces 0), ink glyphs with sky/mint tints. Without WebGL, shaded falls back to glyphs.
// The rAF loop runs only while on screen and the tab is visible; reduced motion draws one static frame.
import { useEffect, useRef } from 'react';
import type { Verdict } from '../lib/types';
import { prefersReducedMotion } from '../lib/motion';

export interface SpinPillProps { size?: number; speed?: number; glyphs?: boolean; verdict?: Verdict | null; className?: string; label?: string;
  /** A soft breathing halo behind the pill (verdict colour, sky without one), painted in the same canvas. */ glow?: boolean }

const R = 0.36, HALF = 0.82;           // capsule radius and half segment length (world units)
const CAM = 5, FOCAL = 0.27;           // perspective camera at z = 5; half view ≈ 1.35 world units
const STATIC_T = 0.9;                  // the pose drawn under reduced motion
const GLOW: Record<Verdict | 'none', [number, number, number]> = {
  PASS: [95, 211, 154], 'NEEDS LAB': [224, 154, 58], 'UNABLE TO VERIFY': [154, 160, 166], none: [22, 24, 27],
};

/** Pose at time t (s): spin about the vertical axis, gentle tilt sway. Returns the capsule's unit axis. */
function axisAt(t: number): [number, number, number] {
  const ay = t * 0.6, az = 0.35 + Math.sin(t * 0.3) * 0.12;
  return [Math.cos(az) * Math.cos(ay), Math.sin(az) * Math.cos(ay), -Math.sin(ay)];
}

/* ---------------- shaded: shared WebGL renderer ---------------- */

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform vec3 uAxis; uniform vec3 uGlow; uniform float uFocal;
const float R = ${R}; const float HALF = ${HALF}; const float CAM = ${CAM}.;
const vec3 SKY = vec3(0.310, 0.702, 1.0); const vec3 MINT = vec3(0.373, 0.827, 0.604);
float hit(vec3 ro, vec3 rd, vec3 pa, vec3 pb){
  vec3 ba = pb - pa, oa = ro - pa;
  float baba = dot(ba,ba), bard = dot(ba,rd), baoa = dot(ba,oa), rdoa = dot(rd,oa), oaoa = dot(oa,oa);
  float a = baba - bard*bard, b = baba*rdoa - baoa*bard, c = baba*oaoa - baoa*baoa - R*R*baba, h = b*b - a*c;
  if (h >= 0.) {
    float t = (-b - sqrt(h)) / a; float y = baoa + t*bard;
    if (y > 0. && y < baba) return t;
    vec3 oc = (y <= 0.) ? oa : ro - pb;
    b = dot(rd, oc); c = dot(oc, oc) - R*R; h = b*b - c;
    if (h > 0.) return -b - sqrt(h);
  }
  return -1.;
}
vec4 shade(vec2 frag){
  vec2 uv = (frag / uRes) * 2. - 1.;
  vec3 ro = vec3(0., 0., CAM), rd = normalize(vec3(uv * uFocal, -1.));
  vec3 pa = -uAxis * HALF, pb = uAxis * HALF;
  float t = hit(ro, rd, pa, pb);
  if (t < 0.) return vec4(0.);
  vec3 p = ro + rd * t;
  float s = clamp(dot(p - pa, uAxis) / (2. * HALF), 0., 1.);
  vec3 n = normalize(p - (pa + s * 2. * HALF * uAxis));
  float side = dot(p, uAxis);
  vec3 base = side > 0. ? SKY : MINT;
  base = mix(base, vec3(1.), 0.2);
  vec3 L = normalize(vec3(-0.45, 0.7, 1.2));
  float dif = clamp(dot(n, L), 0., 1.);
  float wrap = clamp((dot(n, L) + 0.4) / 1.4, 0., 1.);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 col = base * (0.46 + 0.34 * wrap + 0.2 * dif) + vec3(0.07) * hemi;
  col *= mix(0.72, 1., smoothstep(0.0, 0.022, abs(side)));                 // the seam between the halves
  float fr = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
  col = mix(col, vec3(0.97, 0.99, 1.), fr * 0.55);                          // paper-bright rim
  vec3 r = reflect(rd, n);
  float sp = pow(clamp(dot(n, normalize(L - rd)), 0., 1.), 90.);
  float box = smoothstep(0.66, 0.9, dot(r, normalize(vec3(-0.35, 0.78, 0.52))));   // softbox streak: the glass
  float fill = smoothstep(0.86, 0.97, dot(r, normalize(vec3(0.7, -0.2, 0.68)))) * 0.25;
  col += vec3(1.) * (sp * 0.85 + box * 0.42 + fill);
  return vec4(min(col, vec3(1.)), 1.);
}
void main(){
  vec4 acc = vec4(0.);
  acc += shade(gl_FragCoord.xy + vec2(-0.25, -0.25));
  acc += shade(gl_FragCoord.xy + vec2( 0.25, -0.25));
  acc += shade(gl_FragCoord.xy + vec2(-0.25,  0.25));
  acc += shade(gl_FragCoord.xy + vec2( 0.25,  0.25));
  acc *= 0.25;
  // contact shadow: a soft ellipse under the pill, as wide as its projection, tinted by the verdict
  vec2 uv = (gl_FragCoord.xy / uRes) * 2. - 1.;
  float w = (abs(uAxis.x) * HALF + R) / (CAM * uFocal) * 0.9;
  float d = pow(uv.x / max(w, 0.2), 2.) + pow((uv.y + 0.68) / 0.07, 2.);
  float sh = exp(-d * 2.2) * 0.16 * (1. - acc.a);
  vec3 col = acc.rgb + uGlow * sh;                                          // premultiplied
  gl_FragColor = vec4(col, acc.a + sh);
}`;

interface GL { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; uRes: WebGLUniformLocation; uAxis: WebGLUniformLocation; uGlow: WebGLUniformLocation; uFocal: WebGLUniformLocation }
let shared: GL | null | undefined;

function getGL(): GL | null {
  if (shared !== undefined) return shared;
  shared = null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n)!;
  shared = { gl, canvas, uRes: u('uRes'), uAxis: u('uAxis'), uGlow: u('uGlow'), uFocal: u('uFocal') };
  return shared;
}

/** Breathing halo behind the pill: one radial gradient, radius pulses gently with the pose clock. */
function drawHalo(ctx: CanvasRenderingContext2D, S: number, t: number, rgb: [number, number, number]) {
  const r = S * 0.46 * (0.9 + 0.1 * Math.sin(t * 2.2));
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, r);
  g.addColorStop(0, `rgba(${rgb.join(',')},0.34)`); g.addColorStop(0.55, `rgba(${rgb.join(',')},0.14)`); g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
}

function drawShaded(r: GL, ctx: CanvasRenderingContext2D, px: number, t: number, glow: [number, number, number], focal: number, halo: [number, number, number] | null) {
  const { gl, canvas } = r;
  if (canvas.width < px || canvas.height < px) { canvas.width = Math.max(canvas.width, px); canvas.height = Math.max(canvas.height, px); }
  gl.viewport(0, 0, px, px);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(r.uRes, px, px);
  gl.uniform3fv(r.uAxis, axisAt(t));
  gl.uniform3f(r.uGlow, glow[0] / 255, glow[1] / 255, glow[2] / 255);
  gl.uniform1f(r.uFocal, focal);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  ctx.clearRect(0, 0, px, px);
  if (halo) drawHalo(ctx, px, t, halo);
  ctx.drawImage(canvas, 0, canvas.height - px, px, px, 0, 0, px, px);   // GL viewport sits at the bottom-left
}

/* ---------------- glyphs: 2D canvas, one analytic hit per text cell ---------------- */

const LEVELS = 6;                       // alpha steps per hue; glyph tiles are pre-rendered per (hue, level, bit)
const HUES = ['22,24,27', '79,179,255', '95,211,154'];   // ink highlight, sky half, mint half

interface Glyphs { cols: number; rows: number; cw: number; ch: number; atlas: HTMLCanvasElement; bits: Uint8Array }

function makeGlyphs(size: number, dpr: number): Glyphs {
  const rows = Math.max(14, Math.min(44, Math.round(size / 8)));
  const ch = size / rows, cw = ch * 0.62;
  const cols = Math.floor(size / cw);
  const atlas = document.createElement('canvas');
  const tw = Math.ceil(cw * dpr), th = Math.ceil(ch * dpr);
  atlas.width = tw * 2 * LEVELS; atlas.height = th * HUES.length;
  const a = atlas.getContext('2d')!;
  a.font = `${size < 200 ? 600 : 500} ${Math.floor(ch * 0.95 * dpr)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  a.textBaseline = 'middle'; a.textAlign = 'center';
  HUES.forEach((rgb, h) => {
    for (let l = 0; l < LEVELS; l++) for (let b = 0; b < 2; b++) {
      a.fillStyle = `rgba(${rgb},${0.38 + (0.62 * (l + 1)) / LEVELS})`;
      a.fillText(b ? '1' : '0', (l * 2 + b) * tw + tw / 2, h * th + th / 2);
    }
  });
  const bits = new Uint8Array(cols * rows).map(() => (Math.random() < 0.5 ? 1 : 0));
  return { cols, rows, cw, ch, atlas, bits };
}

function drawGlyphs(g: Glyphs, ctx: CanvasRenderingContext2D, size: number, dpr: number, t: number, flicker: boolean, glow: [number, number, number], halo: [number, number, number] | null) {
  const [ax, ay, az] = axisAt(t);
  const { cols, rows, cw, ch, atlas, bits } = g;
  const tw = Math.ceil(cw * dpr), th = Math.ceil(ch * dpr);
  const L0 = -0.45 / 1.4534, L1 = 0.7 / 1.4534, L2 = 1.2 / 1.4534;
  if (flicker) bits[(Math.random() * bits.length) | 0] ^= 1;
  const S = size * dpr;
  ctx.clearRect(0, 0, S, S);
  if (halo) drawHalo(ctx, S, t, halo);
  // contact shadow, as wide as the projected pill, tinted by the verdict
  const w = Math.max(0.2, ((Math.abs(ax) * HALF + R) / (CAM * FOCAL)) * 0.9) * S / 2;
  ctx.save();
  ctx.translate(S / 2, S * 0.84); ctx.scale(1, (0.07 * S / 2) / w);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  sg.addColorStop(0, `rgba(${glow.join(',')},0.16)`); sg.addColorStop(1, `rgba(${glow.join(',')},0)`);
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, w, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const pax = -ax * HALF, pay = -ay * HALF, paz = -az * HALF;
  const bx = 2 * ax * HALF, by = 2 * ay * HALF, bz = 2 * az * HALF;
  const baba = bx * bx + by * by + bz * bz;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    // ray through the cell centre (same camera as the shaded pill)
    const u = ((i + 0.5) * cw / size) * 2 - 1, v = -(((j + 0.5) * ch / size) * 2 - 1);
    let dx = u * FOCAL, dy = v * FOCAL, dz = -1;
    const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    const ox = -pax, oy = -pay, oz = CAM - paz;
    const bard = bx * dx + by * dy + bz * dz, baoa = bx * ox + by * oy + bz * oz, rdoa = dx * ox + dy * oy + dz * oz, oaoa = ox * ox + oy * oy + oz * oz;
    const a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - R * R * baba;
    let h = b * b - a * c;
    if (h < 0) continue;
    let tt = (-b - Math.sqrt(h)) / a;
    const y = baoa + tt * bard;
    if (!(y > 0 && y < baba)) {
      const cx = y <= 0 ? ox : -(pax + bx), cy = y <= 0 ? oy : -(pay + by), cz = y <= 0 ? oz : CAM - (paz + bz);
      const b2 = dx * cx + dy * cy + dz * cz; h = b2 * b2 - (cx * cx + cy * cy + cz * cz - R * R);
      if (h <= 0) continue;
      tt = -b2 - Math.sqrt(h);
    }
    const px = dx * tt, py = dy * tt, pz = CAM + dz * tt;
    const s = Math.max(0, Math.min(1, ((px - pax) * ax + (py - pay) * ay + (pz - paz) * az) / (2 * HALF)));
    let nx = px - (pax + s * bx), ny = py - (pay + s * by), nz = pz - (paz + s * bz);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const lum = Math.max(0, nx * L0 + ny * L1 + nz * L2);
    const hue = lum > 0.82 ? 0 : px * ax + py * ay + pz * az > 0 ? 1 : 2;
    const level = Math.min(LEVELS - 1, Math.floor(lum * LEVELS));
    const bit = lum > 0.5 ? 1 : bits[j * cols + i] & (lum > 0.25 ? 1 : 0);
    ctx.drawImage(atlas, (level * 2 + bit) * tw, hue * th, tw, th, Math.round(i * cw * dpr), Math.round(j * ch * dpr), tw, th);
  }
}

/* ---------------- component ---------------- */

type Debug = HTMLCanvasElement & { __spin?: { frames: number; cost: number } };

export default function SpinPill({ size = 120, speed = 1, glyphs = false, verdict = null, className, label, glow: haloOn = false }: SpinPillProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const cv = ref.current as Debug | null;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    cv.width = px; cv.height = px;
    const ctx = cv.getContext('2d')!;
    const glow = GLOW[verdict ?? 'none'];
    const halo: [number, number, number] | null = haloOn ? (verdict ? GLOW[verdict] : [79, 179, 255]) : null;
    const gl = glyphs ? null : getGL();
    let g: Glyphs | null = gl ? null : makeGlyphs(size, dpr);
    const reduce = prefersReducedMotion();
    const debug = { frames: 0, cost: 0 };
    cv.__spin = debug;

    const draw = (t: number) => {
      const c0 = performance.now();
      if (gl) drawShaded(gl, ctx, px, t, glow, size < 100 ? 0.22 : FOCAL, halo);   // avatars frame the pill tighter
      else drawGlyphs(g!, ctx, size, dpr, t, !reduce, glow, halo);
      debug.cost += (performance.now() - c0 - debug.cost) * 0.1;
      debug.frames++;
    };

    let raf = 0, visible = false, last = 0, clock = STATIC_T;   // clock = pose time; speed scales how fast it advances
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      clock += Math.min(0.05, (now - (last || now)) / 1000) * speedRef.current;   // resumes where it paused, no jump
      last = now;
      draw(clock);
    };
    const sync = () => {
      const run = visible && !document.hidden && !reduce;
      cv.dataset.paused = String(!run);
      if (run && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    draw(STATIC_T);
    // the mono font may arrive after the first atlas; rebuild once it does
    if (g && document.fonts?.status !== 'loaded') document.fonts.ready.then(() => { if (g) { g = makeGlyphs(size, dpr); if (!raf) draw(clock); } });
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0 });
    io.observe(cv);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); cancelAnimationFrame(raf); g = null; };
  }, [size, glyphs, verdict, haloOn]);

  return (
    <canvas ref={ref} className={'spin-pill' + (className ? ' ' + className : '')} width={size} height={size}
      style={{ width: size, height: size }} role="img" aria-label={label ?? (verdict ? `Pill, verdict ${verdict}` : 'Pill')} />
  );
}
