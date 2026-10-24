// Pill station — isometric line-art blueprint with an exploded, turning assembly.
// mountStation(el) renders the scene and returns { setProgress(p), destroy() }.
// autoDemo(handle) loops 0 → 1 → 0 while on screen until something else drives it.
// partFigures holds six standalone 300×300 SVG strings for a FIG grid.
import { createTimeline } from 'animejs';

const NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const VB_W = 1200;
const VB_H = 800;

/* ───────────────────────── geometry kit ───────────────────────── */

const f1 = (n) => Math.round(n * 10) / 10;

function pathD(pts, close) {
  let s = '';
  for (let i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
  return close ? s + 'Z' : s;
}

function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

// Camera: yaw around the vertical axis through `pivot`, fixed-ish elevation, orthographic.
function makeCam({ yaw = 0, elev = 0, zoom = 1, S = 12.2, ox = 600, oy = 400, pivot = [0, 0, 0] }) {
  const a = (45 + yaw) * RAD;
  const e = (35.26 + elev) * RAD;
  const ca = Math.cos(a), sa = Math.sin(a), se = Math.sin(e), ce = Math.cos(e);
  const s = S * zoom;
  const [px, py, pz] = pivot;
  return {
    a,
    P(x, y, z) {
      x -= px; y -= py; z -= pz;
      const u = x * ca - y * sa, v = x * sa + y * ca;
      return [ox + u * s, oy + v * s * se - z * s * ce];
    },
    D(x, y, z) {
      x -= px; y -= py;
      return (x * sa + y * ca) * ce + z * se;
    },
  };
}

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

function circ(c, r, e1 = X, e2 = Y, n = 40, t0 = 0, t1 = TAU) {
  const out = [];
  const full = Math.abs(t1 - t0 - TAU) < 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const ct = Math.cos(t) * r, st = Math.sin(t) * r;
    out.push([c[0] + ct * e1[0] + st * e2[0], c[1] + ct * e1[1] + st * e2[1], c[2] + ct * e1[2] + st * e2[2]]);
  }
  return out;
}

// Box corners (bit 0 → x, bit 1 → y, bit 2 → z), optional local→world map.
function corners(x0, y0, z0, x1, y1, z1, M) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const p = [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
    out.push(M ? M(p) : p);
  }
  return out;
}
const BOX_EDGES = [];
for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) BOX_EDGES.push([i, i | b]);

function kit(cam, off = [0, 0, 0], pre = null) {
  const T = pre
    ? (p) => { const q = pre(p); return [q[0] + off[0], q[1] + off[1], q[2] + off[2]]; }
    : (p) => [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
  const pr = (p) => cam.P(...T(p));
  const dep = (p) => cam.D(...T(p));
  const pathOf = (pts, close) => pathD(pts.map(pr), close);
  const k = {
    cam, pr, dep,
    poly: (pts, close = false, c = 'p') => ({ c, d: pathOf(pts, close) }),
    line: (a, b, c = 'p') => ({ c, d: pathOf([a, b]) }),
    multi: (segs, c = 'p') => ({ c, d: segs.map((s) => pathOf(s)).join('') }),
    hull: (pts, c = 'pf') => ({ c, d: pathD(hull2(pts.map(pr)), true) }),
    ring: (center, r, e1, e2, c = 'p', n = 40) => ({ c, d: pathOf(circ(center, r, e1, e2, n), true) }),
    arc: (center, r, t0, t1, c = 'p', e1 = X, e2 = Y, n = 24) => ({ c, d: pathOf(circ(center, r, e1, e2, n, t0, t1)) }),
    // Solid box: filled silhouette + the three edges meeting at the nearest corner.
    solid(cs, c = 'pf') {
      let near = 0, best = -Infinity;
      cs.forEach((p, i) => { const dd = dep(p); if (dd > best) { best = dd; near = i; } });
      const segs = [];
      for (const b of [1, 2, 4]) segs.push([cs[near], cs[near ^ b]]);
      return [k.hull(cs, c), k.multi(segs, c === 'bf' ? 'b' : 'p')];
    },
    // Wire box: all 12 edges, the three at the farthest corner dashed.
    wire(cs, skip = () => false) {
      let far = 0, worst = Infinity;
      cs.forEach((p, i) => { const dd = dep(p); if (dd < worst) { worst = dd; far = i; } });
      const vis = [], hid = [];
      for (const [a, b] of BOX_EDGES) {
        if (skip(a, b)) continue;
        (a === far || b === far ? hid : vis).push([cs[a], cs[b]]);
      }
      return [k.multi(vis), k.multi(hid, 'g')];
    },
    // Cylinder/frustum between centres c0 → c1 with radii r0, r1 (cap planes spanned by e1,e2).
    cyl(c0, c1, r0, r1, e1, e2, c = 'pf', n = 32) {
      const a = circ(c0, r0, e1, e2, n), b = circ(c1, r1, e1, e2, n);
      const nearCap = dep(c1) >= dep(c0) ? b : a;
      return [k.hull(a.concat(b), c), k.poly(nearCap, true, c === 'bf' ? 'b' : 'p')];
    },
  };
  return k;
}

/* ───────────────────────── scene parts (world units ≈ cm) ───────────────────────── */
// Container centred at the origin on the box floor. +x / +y face the viewer.

const CONT = { r0: 4.9, r1: 5.7, z0: 0.3, z1: 11.3, water: 7.0, fill: 7.6 };
const contR = (z) => CONT.r0 + ((CONT.r1 - CONT.r0) * (z - CONT.z0)) / (CONT.z1 - CONT.z0);
const OPT_Z = 4.6;
const OPT_R = contR(OPT_Z);
const LED_AT = [OPT_R * Math.cos(10 * RAD), OPT_R * Math.sin(10 * RAD), OPT_Z]; // +10°, shines toward -y
const LDR_AT = [OPT_R * Math.cos(-10 * RAD), OPT_R * Math.sin(-10 * RAD), OPT_Z]; // -10°, faces +y
const LDR90_AT = [OPT_R + 0.45, 0, OPT_Z]; // at 90° to the beam, facing -x
const SENSOR_SCALE = 1.9; // sensors drawn larger than life so they read at this scale
const STEP = { cx: 3.0, cy: 2.2, shaft: [2.2, 2.2] };
const PI_BASE = { x: 8, y0: -21, y1: -40.4, zb: 1.4, lean: 13 * RAD };

function partBox(k) {
  const cs = corners(-11, -11, 0, 11, 11, 19);
  const items = k.wire(cs);
  const t = 0.45; // cardboard thickness: inner rim
  items.push(k.poly([[-11 + t, -11 + t, 19], [11 - t, -11 + t, 19], [11 - t, 11 - t, 19], [-11 + t, 11 - t, 19]], true));
  // cable port on the +y wall and a crease line on the +x wall
  items.push(k.poly([[2.5, 11, 1.2], [5.5, 11, 1.2], [5.5, 11, 3.0], [2.5, 11, 3.0]], true));
  items.push(k.line([11, -11, 16.5], [11, 11, 16.5], 'g'));
  return items;
}

function partBoxLid(k, st) {
  // shallow cardboard lid: lifted and tipped at rest, settles shut as the box recedes
  const tilt = -8 * (1 - st.boxlid) * RAD;
  const M = ([x, y, z]) => {
    const dx = x + 11.4;
    return [-11.4 + dx * Math.cos(tilt) - z * Math.sin(tilt), y, 23 + dx * -Math.sin(tilt) + z * Math.cos(tilt)];
  };
  const cs = corners(-11.4, -11.4, 0, 11.4, 11.4, 1.8, M);
  const items = k.solid(cs, 'p');
  items.push(k.poly([[-11.4, -11.4, 0.7], [11.4, -11.4, 0.7], [11.4, 11.4, 0.7]].map(M), false, 'g'));
  return items;
}

function partContainer(k) {
  const { r0, r1, z0, z1 } = CONT;
  const a = k.cam.a;
  const bottom = circ([0, 0, z0], r0, X, Y, 48);
  const top = circ([0, 0, z1], r1, X, Y, 48);
  const items = [
    k.hull(bottom.concat(top), 'p'),
    k.poly(top, true),
    k.ring([0, 0, z1 - 0.35], 6.05, X, Y),
    k.ring([0, 0, z1], 6.05, X, Y),
    k.arc([0, 0, z0], r0, Math.PI - a, TAU - a, 'g', X, Y, 32),
    // stacking ridge near the base
    k.arc([0, 0, z0 + 0.9], contR(z0 + 0.9), -a, Math.PI - a, 'p', X, Y, 32),
  ];
  // water surface
  const wr = contR(CONT.water);
  items.push(k.ring([0, 0, CONT.water], wr, X, Y, 'w', 48));
  items.push(k.arc([0, 0, CONT.water], wr * 0.62, 0.3, 1.9, 'g'));
  items.push(k.arc([0, 0, CONT.water], wr * 0.36, 3.6, 5.2, 'g'));
  // printed fill line on the front with end ticks
  const fr = contR(CONT.fill);
  const fc = Math.PI / 2 - a + 0.75;
  items.push(k.arc([0, 0, CONT.fill], fr, fc - 0.45, fc + 0.45, 'p', X, Y, 16));
  const tick = (t) => [[fr * Math.cos(t), fr * Math.sin(t), CONT.fill - 0.35], [fr * Math.cos(t), fr * Math.sin(t), CONT.fill + 0.35]];
  items.push(k.multi([tick(fc - 0.45), tick(fc + 0.45)]));
  return items;
}

function partLid(k) {
  const items = k.cyl([0, 0, 11.3], [0, 0, 11.8], 6.2, 6.2, X, Y);
  items.push(k.ring([0, 0, 11.8], 5.3, X, Y));
  // rectangular phone window
  items.push(k.poly([[-4.2, -4.0, 11.8], [-1.6, -4.0, 11.8], [-1.6, -1.2, 11.8], [-4.2, -1.2, 11.8]], true));
  items.push(k.poly([[-3.95, -3.75, 11.8], [-1.85, -3.75, 11.8], [-1.85, -1.45, 11.8], [-3.95, -1.45, 11.8]], true, 'g'));
  // shaft hole for the paddle
  items.push(k.ring([STEP.shaft[0], STEP.shaft[1], 11.8], 0.35, X, Y, 'p', 16));
  return items;
}

function partPhone(k) {
  const items = k.solid(corners(-5.9, -4.1, 11.85, 1.1, 10.6, 12.6));
  items.push(k.poly([[-5.45, -3.5, 12.6], [0.65, -3.5, 12.6], [0.65, 10.0, 12.6], [-5.45, 10.0, 12.6]], true));
  items.push(k.line([-3.4, -3.8, 12.6], [-1.4, -3.8, 12.6]));
  // camera lens on the underside, over the lid window (hidden → dashed)
  items.push(k.ring([-2.9, -2.6, 11.85], 0.6, X, Y, 'g', 20));
  items.push(k.line([-2.9, -2.6, 11.85], [-2.9, -2.6, 4.2], 'g'));
  return items;
}

function partStepper(k) {
  const [sx, sy] = STEP.shaft;
  const items = [k.line([sx, sy, 11.8], [sx, sy, 2.6])];
  // fan-blade paddle: three pitched blades
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const t = (i * TAU) / 3 + 0.4;
    const P = (r, dt, dz) => [sx + r * Math.cos(t + dt), sy + r * Math.sin(t + dt), 3.0 + dz];
    blades.push([P(0.35, -0.35, 0.35), P(2.1, -0.3, 0.5), P(2.2, 0.28, -0.4), P(0.35, 0.35, -0.35), P(0.35, -0.35, 0.35)]);
  }
  items.push(k.multi(blades));
  items.push(...k.cyl([sx, sy, 2.6], [sx, sy, 3.4], 0.38, 0.38, X, Y, 'pf', 16));
  // mounting ears, can, wire cap
  const { cx, cy } = STEP;
  items.push(...k.solid(corners(cx - 1.8, cy - 0.55, 11.8, cx + 1.8, cy + 0.55, 11.95)));
  items.push(k.ring([cx - 1.45, cy, 11.95], 0.18, X, Y, 'p', 12));
  items.push(k.ring([cx + 1.45, cy, 11.95], 0.18, X, Y, 'p', 12));
  items.push(...k.cyl([cx, cy, 11.95], [cx, cy, 13.85], 1.4, 1.4, X, Y));
  items.push(...k.solid(corners(cx + 1.15, cy - 0.65, 12.05, cx + 1.85, cy + 0.65, 13.5)));
  items.push(k.poly([[cx + 1.85, cy, 12.9], [cx + 2.6, cy - 1.3, 12.7], [cx + 2.2, cy - 2.6, 12.3], [cx + 1.4, cy - 3.3, 12.0]]));
  // ULN2003 driver board with DIP chip, four LEDs and header pins
  const bx0 = 1.8, by0 = -4.1, bx1 = 5.0, by1 = -1.1;
  items.push(...k.solid(corners(bx0, by0, 11.8, bx1, by1, 11.95)));
  items.push(...k.solid(corners(2.5, -3.45, 11.95, 4.3, -2.8, 12.25)));
  const leds = [];
  for (let i = 0; i < 4; i++) leds.push(circ([2.3 + i * 0.55, -1.55, 11.95], 0.1, X, Y, 8, 0, TAU).concat([[2.3 + i * 0.55 + 0.1, -1.55, 11.95]]));
  items.push(k.multi(leds));
  const pins = [];
  for (let i = 0; i < 7; i++) pins.push([[4.7, -3.8 + i * 0.4, 11.95], [4.7, -3.8 + i * 0.4, 12.45]]);
  for (let i = 0; i < 4; i++) pins.push([[2.2 + i * 0.4, -3.85, 11.95], [2.2 + i * 0.4, -3.85, 12.45]]);
  items.push(k.multi(pins));
  return items;
}

// Sensor local frame: s along the facing normal n (angle phi in the ground plane), a across, b up.
function sensorFrame(anchor, phi, S) {
  const n = [Math.cos(phi), Math.sin(phi), 0];
  const a = [Math.sin(phi), -Math.cos(phi), 0];
  const M = (sa, ss, sb) => add3(anchor, add3(mul3(a, sa * S), add3(mul3(n, ss * S), [0, 0, sb * S])));
  return { n, a, M };
}
// sensors grow as they drift out so their faces read in the exploded view
const sensorScale = (st) => SENSOR_SCALE + 1.4 * st.spin;

function partLed(k, st) {
  // shines toward -y across the corner; turns to show its profile when exploded
  const phi = (-90 + 90 * st.spin) * RAD;
  const S = sensorScale(st);
  const { M, n, a } = sensorFrame(LED_AT, phi, S);
  const items = [
    k.multi([[M(-0.1, -0.85, 0), M(-0.1, -2.3, 0)], [M(0.1, -0.85, 0), M(0.1, -1.9, 0), M(0.1, -2.05, -0.15)]]),
  ];
  items.push(...k.cyl(M(0, -0.88, 0), M(0, -0.78, 0), 0.29 * S, 0.29 * S, a, Z, 'bf', 24));
  items.push(...k.cyl(M(0, -0.78, 0), M(0, -0.25, 0), 0.25 * S, 0.25 * S, a, Z, 'bf', 24));
  // dome
  const dome = [];
  for (const [s, r] of [[-0.25, 0.25], [-0.15, 0.235], [-0.07, 0.19], [-0.02, 0.11], [0, 0.02]]) dome.push(...circ(M(0, s, 0), r * S, a, Z, 20));
  items.push(k.hull(dome, 'bf'));
  // beam: 1.8 cm path across the corner to the inline LDR
  items.push(k.line(M(0, 0.02, 0), add3(M(0, 0, 0), mul3(n, 1.8 * Math.max(0.35, 1 - st.spin * 0.6))), 'bb'));
  return items;
}

function ldrBody(k, M, n, a, S) {
  // LDR face points along +n; the filter chip (transparent, outline only) sits in front of it
  const items = [];
  items.push(k.multi([[M(-0.09, -0.32, 0), M(-0.09, -1.6, 0)], [M(0.09, -0.32, 0), M(0.09, -1.6, 0)]]));
  const chip = [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]];
  items.push(k.poly(chip.map(([x, z]) => M(x, 0.02, z)), true, 'g'));
  items.push(...k.cyl(M(0, -0.32, 0), M(0, -0.12, 0), 0.27 * S, 0.27 * S, a, Z, 'pf', 24));
  const zz = [];
  for (let i = 0; i <= 6; i++) {
    const zb = -0.15 + i * 0.05;
    const w = Math.sqrt(Math.max(0, 0.2 * 0.2 - zb * zb));
    zz.push(M(i % 2 ? w : -w, -0.12, zb));
  }
  items.push(k.poly(zz));
  items.push(k.poly(chip.map(([x, z]) => M(x, 0.1, z)), true));
  return items;
}

function partLdr(k, st) {
  const phi = (90 - 45 * st.spin) * RAD; // faces +y toward the LED → turns to the viewer
  const S = sensorScale(st);
  const { M, n, a } = sensorFrame(LDR_AT, phi, S);
  return ldrBody(k, M, n, a, S);
}

function partLdr90(k, st) {
  const phi = (180 - 135 * st.spin) * RAD; // faces -x into the beam → turns to the viewer
  const S = sensorScale(st);
  const { M, n, a } = sensorFrame(LDR90_AT, phi, S);
  return ldrBody(k, M, n, a, S);
}

function partThermistor(k) {
  const bead = [-2.0, -3.0, 2.8];
  const items = [
    k.poly([[-2.05, -3.0, 3.1], [-2.05, -3.0, 10.6], [-3.5, -5.2, 11.15], [-3.85, -5.75, 10.6], [-3.85, -5.75, 8.2]]),
    k.line([-1.92, -3.0, 3.1], [-1.92, -3.0, 6.0]),
  ];
  items.push(...k.cyl([-2.0, -3.0, 4.2], [-2.0, -3.0, 5.6], 0.16, 0.16, X, Y, 'pf', 12));
  const b = [];
  for (const [dz, r] of [[-0.3, 0.12], [-0.15, 0.27], [0.05, 0.3], [0.25, 0.2], [0.35, 0.08]]) b.push(...circ(add3(bead, [0, 0, dz]), r, X, Y, 16));
  items.push(k.hull(b));
  items.push(...k.solid(corners(-4.05, -5.95, 7.4, -3.65, -5.55, 8.2)));
  return items;
}

function partEsp(k) {
  const x0 = -9.0, x1 = -3.9, y0 = 5.9, y1 = 8.2, z0 = 0.15, z1 = 0.32;
  const items = k.solid(corners(x0, y0, z0, x1, y1, z1));
  items.push(...k.solid(corners(-6.7, 6.35, z1, -4.3, 7.75, 0.62))); // module can
  items.push(k.poly([[-4.25, 6.45, z1 + 0.01], [-4.0, 6.45, z1 + 0.01], [-4.0, 7.65, z1 + 0.01], [-4.25, 7.65, z1 + 0.01]], true)); // antenna
  items.push(...k.solid(corners(x0 - 0.15, 6.7, z1, x0 + 0.6, 7.4, 0.62))); // USB-C
  const pins = [];
  for (let i = 0; i < 16; i++) pins.push([[x0 + 0.65 + i * 0.254, y0 + 0.15, z1], [x0 + 0.65 + i * 0.254, y0 + 0.15, z1 + 0.32]]);
  for (let i = 0; i < 12; i++) pins.push([[x0 + 1.15 + i * 0.254, y1 - 0.15, z1], [x0 + 1.15 + i * 0.254, y1 - 0.15, z1 + 0.32]]);
  items.push(k.multi(pins));
  items.push(k.ring([x0 + 0.95, y1 - 0.55, z1], 0.12, X, Y, 'p', 10)); // reset button
  return items;
}

function partPi(k, st) {
  const { x, y0, y1, zb, lean } = PI_BASE;
  const L = ([px, py, pz]) => {
    const h = pz - zb;
    return [px - h * Math.sin(lean), py, zb + h * Math.cos(lean)];
  };
  const items = [];
  // Pi 3 board on the back of the display; slides up and out when exploded
  const lift = st.piBoard;
  const B = (p) => add3(L(p), [-3.5 * lift, -2.5 * lift, 8.5 * lift]);
  const bx = x - 2.4, by0 = -26.5, by1 = -35.0, bz0 = 3.6, bz1 = 9.2;
  items.push(...k.solid(corners(bx - 0.16, by1, bz0, bx, by0, bz1, B)));
  items.push(...k.solid(corners(bx - 0.5, by0 - 3.3, bz0 + 2.0, bx - 0.16, by0 - 1.9, bz0 + 3.4, B))); // SoC
  items.push(...k.solid(corners(bx - 1.6, by1 - 0.4, bz0 + 0.4, bx - 0.16, by1 + 1.6, bz0 + 2.1, B))); // USB stack
  items.push(...k.solid(corners(bx - 1.4, by1 - 0.4, bz0 + 2.6, bx - 0.16, by1 + 1.4, bz0 + 4.2, B))); // Ethernet
  const gpio = [];
  for (let i = 0; i < 20; i++) gpio.push([B([bx - 0.16, by0 - 0.6 - i * 0.254, bz1 - 0.35]), B([bx - 0.55, by0 - 0.6 - i * 0.254, bz1 - 0.35])]);
  items.push(k.multi(gpio));
  // kickstand legs
  items.push(k.multi([[L([x - 2.0, y0 - 2.5, 9.5]), [x - 6.6, y0 - 2.5, 0]], [L([x - 2.0, y1 + 2.5, 9.5]), [x - 6.6, y1 + 2.5, 0]]]));
  // display case + active area
  items.push(...k.solid(corners(x - 2.0, y1, zb, x, y0, zb + 11.0, L)));
  const face = (yy, zz) => L([x, yy, zz]);
  items.push(k.poly([face(y0 - 1.95, zb + 1.45), face(y1 + 1.95, zb + 1.45), face(y1 + 1.95, zb + 10.05), face(y0 - 1.95, zb + 10.05)], true));
  // screen UI: title bar, three rows, PASS dot
  const ui = [
    [face(y0 - 2.8, zb + 9.1), face(y0 - 7.5, zb + 9.1)],
    [face(y0 - 2.8, zb + 7.2), face(y0 - 12.5, zb + 7.2)],
    [face(y0 - 2.8, zb + 6.1), face(y0 - 10.0, zb + 6.1)],
    [face(y0 - 2.8, zb + 5.0), face(y0 - 11.2, zb + 5.0)],
  ];
  items.push(k.multi(ui));
  items.push(k.poly([face(y0 - 2.8, zb + 2.4), face(y0 - 8.4, zb + 2.4), face(y0 - 8.4, zb + 3.7), face(y0 - 2.8, zb + 3.7)], true));
  const ex = [0, -1, 0], ez = [-Math.sin(lean), 0, Math.cos(lean)];
  items.push(k.ring(face(y1 + 3.4, zb + 8.9), 0.32, ex, ez, 'ok', 16));
  // USB lead from the Pi toward the dark box port (guide)
  items.push(k.poly([[x - 4, y0 + 0.4, 0], [x - 4, -8, 0], [4.0, 11.0, 0], [4.0, 11.0, 1.2]], false, 'g'));
  return items;
}

function partGuides(k, st, off) {
  // construction lines: vertical axis through the paddle, floor extensions, explode trails
  const [sx, sy] = STEP.shaft;
  const items = [
    k.line([sx, sy, -6], [sx, sy, 40], 'g'),
    k.multi([[[11, -11, 0], [11, -20, 0]], [[11, 11, 0], [20, 11, 0]], [[-11, 11, 0], [-11, 20, 0]], [[11, 11, 0], [11, 18, 0]]], 'g'),
  ];
  const trail = (anchor, o) => [anchor, add3(anchor, o)];
  items.push(k.multi([
    trail(LED_AT, off.led), trail(LDR_AT, off.ldr), trail(LDR90_AT, off.ldr90),
    trail([-9, 7, 0.3], off.esp32), trail([-3.85, -5.75, 8], off.thermistor),
  ], 'g'));
  return items;
}

const PARTS = [
  { id: 'box', draw: partBox },
  // the Feather is tiny: it is lifted out of the box and magnified as it goes
  { id: 'esp32', draw: partEsp, mag: { c: [-6.45, 7.05, 0.3], k: 0.8 } },
  { id: 'thermistor', draw: partThermistor },
  { id: 'container', draw: partContainer },
  { id: 'ldr90', draw: partLdr90 },
  { id: 'ldr', draw: partLdr },
  { id: 'led', draw: partLed },
  { id: 'lid', draw: partLid },
  { id: 'stepper', draw: partStepper },
  { id: 'phone', draw: partPhone },
  { id: 'boxlid', draw: partBoxLid },
  { id: 'pi', draw: partPi },
];

// Exploded offsets (world cm) at full progress for each part's progress value.
const EXPLODE = {
  box: [-11, 7, -6],
  boxlid: [-11, 7, -11.4],
  lid: [0, 0, 8],
  phone: [-9, -1, 19],
  stepper: [0, 0, 24],
  container: [6, 4, -4],
  led: [10, 4, -2],
  ldr: [14, -4, -1],
  ldr90: [18, 2, -3],
  thermistor: [2, -10, -1],
  esp32: [-11, 7, 17],
  pi: [3, -3, 0],
};

const LABELS = [
  { id: 'lid', no: '01', title: 'PHONE ON LID', sub: 'camera reads through the window', at: [[-5.9, 10.6, 12.6], 'phone'], x: 56, y: 150, side: 'L' },
  { id: 'stepper', no: '02', title: '28BYJ-48 + ULN2003', sub: 'stepper turns a fan-blade paddle', at: [[3.0, 3.6, 13.85], 'stepper'], x: 655, y: 92, side: 'R' },
  { id: 'container', no: '03', title: '946 mL CHAMBER', sub: 'fill line · thermistor in the water', at: [[[3.46, 3.46, 0.3], 'container'], [[-2.0, -3.0, 3.1], 'thermistor']], x: 640, y: 770, side: 'R' },
  { id: 'optics', no: '04', title: 'OPTICS', sub: 'blue LED → LDR · LDR at 90°, green', at: [[LED_AT, 'led'], [LDR_AT, 'ldr'], [LDR90_AT, 'ldr90']], x: 790, y: 690, side: 'R' },
  { id: 'esp32', no: '05', title: 'ESP32 FEATHER V2', sub: 'lifted out of the dark box', at: [[-9.0, 8.2, 0.3], 'esp32'], x: 40, y: 296, side: 'L' },
  { id: 'pi', no: '06', title: 'RASPBERRY PI 3', sub: '7" touchscreen beside the box', at: [[PI_BASE.x, PI_BASE.y1 + 1, PI_BASE.zb + 3], 'pi'], x: 960, y: 440, side: 'R' },
];

/* ───────────────────────── mount ───────────────────────── */

const SCENE_CAM = { S: 15, ox: 575, oy: 470, pivot: [2, -14, 6] };
const CHAR_W = 7.04; // 11px JetBrains Mono advance + letter-spacing

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export function mountStation(host, opts = {}) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  host.classList.add('station');
  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': opts.label || 'Exploded line drawing of the Pill station: dark box, deli container, lid with phone window, stepper paddle, LED and light sensors, thermistor, ESP32 board, Raspberry Pi touchscreen.',
  });
  const root = el('g', { class: 'st-root' }, svg);
  const guides = el('g', { class: 'st-guides' }, root);
  const groups = {};
  for (const p of PARTS) groups[p.id] = { g: el('g', { 'data-part': p.id }, root), paths: [] };
  const labelLayer = el('g', { class: 'st-labels' }, svg);
  const labels = LABELS.map((L) => {
    const g = el('g', { class: 'st-label', 'data-label': L.id }, labelLayer);
    const anchors = (Array.isArray(L.at[0][0]) ? L.at : [L.at]);
    const leaders = anchors.map(() => el('path', { class: 'st-leader', pathLength: '1' }, g));
    const dots = anchors.map(() => el('circle', { class: 'st-dot', r: '2' }, g));
    const t = el('text', { x: L.x, y: L.y }, g);
    const t1 = el('tspan', { class: 'st-no' }, t); t1.textContent = L.no + '  ';
    const t2 = el('tspan', { class: 'st-title' }, t); t2.textContent = L.title;
    const t3 = el('tspan', { class: 'st-sub', x: L.x, dy: '15' }, t); t3.textContent = L.sub;
    const w = Math.max(L.no.length + 2 + L.title.length, L.sub.length) * CHAR_W;
    const end = L.side === 'L' ? L.x + w + 10 : L.x - 10;
    return { L, g, t, anchors, leaders, dots, end };
  });
  host.appendChild(svg);

  const st = {
    yaw: 0, elev: 0, zoom: 1, panX: 0, panY: -60,
    box: 0, boxlid: 0, lid: 0, phone: 0, stepper: 0, container: 0,
    led: 0, ldr: 0, ldr90: 0, spin: 0, thermistor: 0, esp32: 0, pi: 0, piBoard: 0,
    guide: 0, leader: 0, label: 0,
  };

  function syncPaths(entry, items) {
    const { g, paths } = entry;
    for (let i = 0; i < items.length; i++) {
      let p = paths[i];
      if (!p) { p = el('path', { class: items[i].c }, g); paths.push(p); }
      p.setAttribute('d', items[i].d);
    }
  }

  const guideEntry = { g: guides, paths: [] };

  function render() {
    const cam = makeCam({ ...SCENE_CAM, ox: SCENE_CAM.ox + st.panX, oy: SCENE_CAM.oy + st.panY, yaw: st.yaw, elev: st.elev, zoom: st.zoom });
    const off = {};
    for (const id in EXPLODE) off[id] = mul3(EXPLODE[id], st[id]);
    const pre = {};
    for (const p of PARTS) {
      if (!p.mag) continue;
      const { c, k } = p.mag;
      const m = 1 + k * st[p.id];
      pre[p.id] = (q) => [c[0] + (q[0] - c[0]) * m, c[1] + (q[1] - c[1]) * m, c[2] + (q[2] - c[2]) * m];
    }
    for (const p of PARTS) syncPaths(groups[p.id], p.draw(kit(cam, off[p.id], pre[p.id]), st));
    syncPaths(guideEntry, partGuides(kit(cam), st, off));
    guides.style.opacity = String(0.35 + 0.65 * st.guide);
    groups.box.g.style.opacity = String(1 - 0.5 * st.box);
    groups.boxlid.g.style.opacity = String(1 - 0.45 * st.boxlid);
    for (const lab of labels) {
      const { L, end } = lab;
      const ky = L.y - 4;
      const knee = end + (L.side === 'L' ? 22 : -22);
      lab.anchors.forEach(([pt, part], i) => {
        const [ax, ay] = cam.P(...add3(pre[part] ? pre[part](pt) : pt, off[part]));
        lab.leaders[i].setAttribute('d', `M${f1(ax)} ${f1(ay)}L${f1(knee)} ${f1(ky)}L${f1(end)} ${f1(ky)}`);
        lab.leaders[i].style.strokeDashoffset = String(1 - st.leader);
        lab.dots[i].setAttribute('cx', f1(ax));
        lab.dots[i].setAttribute('cy', f1(ay));
        lab.dots[i].style.opacity = String(st.leader);
      });
      lab.t.style.opacity = String(st.label);
    }
  }

  // Choreography (timeline units: 1000 = full explode)
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutCubic' } });
  tl.add(st, { boxlid: 1, duration: 460 }, 170)
    .add(st, { zoom: 0.76, panY: -15, panX: 40, duration: 600, ease: 'inOutSine' }, 60)
    .add(st, { lid: 1, duration: 440, ease: 'inOutQuart' }, 90)
    .add(st, { phone: 1, duration: 460, ease: 'inOutQuart' }, 130)
    .add(st, { stepper: 1, duration: 500, ease: 'inOutQuart' }, 150)
    .add(st, { box: 1, duration: 460 }, 170)
    .add(st, { container: 1, duration: 460, ease: 'inOutQuart' }, 210)
    .add(st, { guide: 1, duration: 500, ease: 'inOutSine' }, 200)
    .add(st, { thermistor: 1, duration: 440 }, 260)
    .add(st, { esp32: 1, duration: 440 }, 290)
    .add(st, { led: 1, duration: 460, ease: 'inOutQuart' }, 300)
    .add(st, { ldr: 1, duration: 460, ease: 'inOutQuart' }, 330)
    .add(st, { ldr90: 1, duration: 460, ease: 'inOutQuart' }, 360)
    .add(st, { spin: 1, duration: 420, ease: 'inOutSine' }, 360)
    .add(st, { pi: 1, duration: 420 }, 320)
    .add(st, { piBoard: 1, duration: 420, ease: 'inOutQuart' }, 380)
    .add(st, { leader: 1, duration: 260, ease: 'outCubic' }, 540)
    .add(st, { label: 1, duration: 280, ease: 'outSine' }, 580)
    // the whole assembly turns: yaw left, swing right, settle
    .add(st, { yaw: -14, elev: -5, duration: 340, ease: 'inOutSine' }, 0)
    .add(st, { yaw: 9, elev: 2, duration: 340, ease: 'inOutSine' }, 340)
    .add(st, { yaw: 0, elev: 0, duration: 240, ease: 'inOutSine' }, 680);

  const total = tl.duration;
  let current = 0;
  function seekTo(p) {
    current = Math.min(1, Math.max(0, p));
    tl.seek(current * total);
    render();
  }

  const handle = {
    el: host,
    reduced,
    driven: false,
    get progress() { return current; },
    setProgress(p) {
      handle.driven = true;
      if (reduced) return;
      seekTo(p);
    },
    _seek(p) { if (!reduced) seekTo(p); },
    destroy() {
      if (handle._stopDemo) handle._stopDemo();
      tl.pause();
      svg.remove();
      host.classList.remove('station', 'station--static');
    },
  };

  if (reduced) {
    host.classList.add('station--static');
    tl.seek(total);
    current = 1;
    render();
  } else {
    seekTo(opts.progress ?? 0);
  }
  return handle;
}

/* ───────────────────────── auto demo ───────────────────────── */

const DEMO = { hold: 900, ramp: 3600 }; // 0 hold → up → 1 hold → down ≈ 9 s

export function autoDemo(handle) {
  if (!handle || handle.reduced) return () => {};
  const cycle = 2 * (DEMO.hold + DEMO.ramp);
  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
  let raf = 0, last = 0, t = 0, visible = false, stopped = false;

  function progressAt(ms) {
    const m = ms % cycle;
    if (m < DEMO.hold) return 0;
    if (m < DEMO.hold + DEMO.ramp) return ease((m - DEMO.hold) / DEMO.ramp);
    if (m < 2 * DEMO.hold + DEMO.ramp) return 1;
    return 1 - ease((m - 2 * DEMO.hold - DEMO.ramp) / DEMO.ramp);
  }
  function frame(now) {
    raf = 0;
    if (stopped || handle.driven) return stop();
    if (!visible) return;
    if (last) t += Math.min(64, now - last);
    last = now;
    handle._seek(progressAt(t));
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    if (visible && !raf && !stopped) raf = requestAnimationFrame(frame);
  });
  io.observe(handle.el);
  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
  }
  handle._stopDemo = stop;
  return stop;
}

/* ───────────────────────── standalone FIG part drawings ───────────────────────── */

const FIG_STYLE = {
  p: 'fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"',
  pf: 'fill="#0B0C0E" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"',
  g: 'fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3 4"',
  w: 'fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"',
  b: 'fill="none" style="stroke:var(--blue,#2F6BFF)" stroke-width="1.25"',
  bf: 'fill="#0B0C0E" style="stroke:var(--blue,#2F6BFF)" stroke-width="1.25"',
  bb: 'fill="none" style="stroke:var(--blue,#2F6BFF)" stroke-width="1.25" stroke-dasharray="4 3"',
  ok: 'style="fill:var(--pass,#1B8A5A)" stroke="none"',
};

function figSvg(items) {
  const body = items.map((it) => `<path ${FIG_STYLE[it.c]} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" d="${it.d}"/>`).join('');
  return `<svg xmlns="${NS}" viewBox="0 0 300 300" fill="none" aria-hidden="true">${body}</svg>`;
}

function figKit(S, pivot, oy = 160) {
  return kit(makeCam({ S, ox: 150, oy, pivot }));
}

function figEsp32() {
  const k = figKit(44, [-0.2, 0, 0], 168);
  const x0 = -2.55, x1 = 2.55, y0 = -1.15, y1 = 1.15, z0 = 0, z1 = 0.16;
  const items = [
    k.multi([[[-3.6, -2.0, 0], [3.6, -2.0, 0]], [[-3.6, 2.0, 0], [3.6, 2.0, 0]], [[0, -2.6, 0], [0, 2.6, 0]]], 'g'),
    ...k.solid(corners(x0, y0, z0, x1, y1, z1)),
    ...k.solid(corners(-0.6, -0.8, z1, 1.6, 0.8, 0.5)),
    k.poly([[1.65, -0.7, z1], [2.2, -0.7, z1], [2.2, 0.7, z1], [1.65, 0.7, z1]], true),
    ...k.solid(corners(x0 - 0.15, -0.35, z1, x0 + 0.6, 0.35, 0.45)),
  ];
  const pins = [], holes = [];
  for (let i = 0; i < 16; i++) {
    const x = x0 + 0.5 + i * 0.254;
    pins.push([[x, y0 + 0.14, z1], [x, y0 + 0.14, z1 + 0.28]]);
  }
  for (let i = 0; i < 12; i++) {
    const x = x0 + 1.0 + i * 0.254;
    pins.push([[x, y1 - 0.14, z1], [x, y1 - 0.14, z1 + 0.28]]);
  }
  items.push(k.multi(pins));
  for (const [hx, hy] of [[x0 + 0.25, y0 + 0.25], [x1 - 0.25, y0 + 0.25], [x0 + 0.25, y1 - 0.25], [x1 - 0.25, y1 - 0.25]]) holes.push(circ([hx, hy, z1], 0.1, X, Y, 10, 0, TAU));
  items.push(k.multi(holes.map((h) => h.concat([h[0]]))));
  items.push(k.ring([x0 + 0.95, y1 - 0.5, z1], 0.12, X, Y, 'p', 10));
  return figSvg(items);
}

function figLdr() {
  // photoresistor seen face-up: disc, serpentine track, two leads to the ground plane
  const k = figKit(52, [0, 0, 1.0], 150);
  const r = 1.0, zt = 2.0, zb = 1.7;
  const items = [
    k.multi([[[0, 0, -0.8], [0, 0, 3.0]], [[-1.8, 0, 0], [1.8, 0, 0]], [[0, -1.8, 0], [0, 1.8, 0]]], 'g'),
    k.multi([[[-0.32, 0, zb], [-0.32, 0, 0]], [[0.32, 0, zb], [0.32, 0, 0]]]),
    ...k.cyl([0, 0, zb], [0, 0, zt], r, r, X, Y),
    k.ring([0, 0, zt], r * 0.86, X, Y),
  ];
  // zigzag track between two comb rails
  const zz = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const y = -0.62 + (1.24 * i) / n;
    const w = Math.sqrt(Math.max(0, 0.78 * 0.78 - y * y)) - 0.1;
    zz.push([i % 2 ? w : -w, y, zt]);
    zz.push([i % 2 ? w : -w, Math.min(0.62, y + 1.24 / n), zt]);
  }
  zz.pop();
  items.push(k.poly(zz));
  items.push(k.arc([0, 0, zt], 0.8, -2.2, -0.94, 'p'));
  items.push(k.arc([0, 0, zt], 0.8, 0.94, 2.2, 'p'));
  items.push(k.ring([-0.32, 0, 0], 0.07, X, Y, 'g', 10));
  items.push(k.ring([0.32, 0, 0], 0.07, X, Y, 'g', 10));
  return figSvg(items);
}

function figLed() {
  const k = figKit(50, [0, 0, 1.3], 160);
  const r = 0.5, rf = 0.58;
  const dome = [];
  for (const [z, rr] of [[2.0, 0.5], [2.2, 0.47], [2.35, 0.39], [2.45, 0.24], [2.5, 0.04]]) dome.push(...circ([0, 0, z], rr, X, Y, 32));
  const items = [
    k.multi([[[0, 0, -0.6], [0, 0, 3.4]], [[-1.6, 0, 0], [1.6, 0, 0]]], 'g'),
    k.multi([[[-0.2, 0, 1.0], [-0.2, 0, -0.4]], [[0.2, 0, 1.0], [0.2, 0, 0.1], [0.42, 0, -0.1], [0.42, 0, -0.2]]]),
    ...k.cyl([0, 0, 1.0], [0, 0, 1.18], rf, rf, X, Y, 'bf'),
    ...k.cyl([0, 0, 1.18], [0, 0, 2.0], r, r, X, Y, 'bf'),
    k.hull(dome, 'bf'),
    // die and anvil inside the clear epoxy
    k.multi([[[-0.12, 0, 1.4], [-0.12, 0, 1.75], [0.05, 0, 1.75]], [[0.12, 0, 1.4], [0.12, 0, 1.62]]], 'b'),
    // emission cone
    k.multi([[[0, 0, 2.62], [-0.6, 0, 3.25]], [[0, 0, 2.62], [0.6, 0, 3.25]], [[0, 0, 2.62], [0, 0, 3.35]]], 'bb'),
  ];
  return figSvg(items);
}

function figThermistor() {
  const k = figKit(56, [0, 0, 1.9], 150);
  const bead = [];
  for (const [z, r] of [[0.35, 0.1], [0.5, 0.33], [0.72, 0.4], [0.95, 0.3], [1.1, 0.1]]) bead.push(...circ([0, 0, z], r, X, Y, 24));
  const items = [
    k.multi([[[0, 0, -0.2], [0, 0, 3.6]], [[-1.6, 0.4, 0.72], [1.6, 0.4, 0.72]]], 'g'),
    k.multi([[[-0.1, 0, 0.9], [-0.1, 0, 3.4], [-0.6, 0, 3.9]], [[0.1, 0, 0.9], [0.1, 0, 3.4], [0.6, 0, 3.9]]]),
    ...k.cyl([0, 0, 1.6], [0, 0, 2.6], 0.24, 0.24, X, Y, 'pf', 20),
    k.hull(bead),
    // water line it dips below
    k.multi([[[-1.4, -0.9, 1.25], [1.4, -0.9, 1.25]], [[-1.4, 0.9, 1.25], [1.4, 0.9, 1.25]]], 'w'),
  ];
  return figSvg(items);
}

function figStepper() {
  const k = figKit(34, [0.4, 0, 0.6], 165);
  const cx = -1.4, cy = 1.0;
  const items = [
    k.multi([[[cx - 0.8, cy, -0.6], [cx - 0.8, cy, 4.2]], [[-4.2, -3.0, 0], [4.2, -3.0, 0]]], 'g'),
    // shaft + flats (28BYJ-48 shaft is offset from the can centre)
    ...k.cyl([cx - 0.8, cy, 1.9], [cx - 0.8, cy, 2.9], 0.25, 0.25, X, Y, 'pf', 16),
    ...k.solid(corners(cx - 1.75, cy - 0.35, 1.9, cx + 1.75, cy + 0.35, 2.0)),
    ...k.cyl([cx, cy, 0], [cx, cy, 1.9], 1.4, 1.4, X, Y),
    k.ring([cx - 0.8, cy, 1.9], 0.45, X, Y, 'p', 20),
    k.ring([cx - 1.45, cy, 2.0], 0.17, X, Y, 'p', 12),
    k.ring([cx + 1.45, cy, 2.0], 0.17, X, Y, 'p', 12),
    ...k.solid(corners(cx + 1.1, cy - 0.65, 0.1, cx + 1.85, cy + 0.65, 1.6)),
    k.poly([[cx + 1.85, cy, 0.9], [cx + 2.8, cy - 0.6, 0.4], [1.4, -1.0, 0.2]]),
    // ULN2003 board
    ...k.solid(corners(1.0, -3.2, 0, 4.2, -0.2, 0.16)),
    ...k.solid(corners(1.8, -2.4, 0.16, 3.6, -1.75, 0.5)),
  ];
  const leds = [], pins = [];
  for (let i = 0; i < 4; i++) leds.push(circ([1.5 + i * 0.6, -0.6, 0.16], 0.12, X, Y, 10, 0, TAU).concat([[1.62 + i * 0.6, -0.6, 0.16]]));
  for (let i = 0; i < 7; i++) pins.push([[3.9, -2.9 + i * 0.4, 0.16], [3.9, -2.9 + i * 0.4, 0.7]]);
  for (let i = 0; i < 5; i++) pins.push([[1.3 + i * 0.4, -2.95, 0.16], [1.3 + i * 0.4, -2.95, 0.7]]);
  items.push(k.multi(leds), k.multi(pins));
  return figSvg(items);
}

function figContainer() {
  const k = figKit(14.5, [0, 0, 5.4], 158);
  const { r0, r1, z0, z1 } = CONT;
  const a = 45 * RAD;
  const bottom = circ([0, 0, z0], r0, X, Y, 64), top = circ([0, 0, z1], r1, X, Y, 64);
  const wr = contR(CONT.water), fr = contR(CONT.fill);
  const fc = Math.PI / 2 - a + 0.75;
  const tick = (t) => [[fr * Math.cos(t), fr * Math.sin(t), CONT.fill - 0.35], [fr * Math.cos(t), fr * Math.sin(t), CONT.fill + 0.35]];
  const items = [
    k.line([0, 0, -1.5], [0, 0, 13.5], 'g'),
    k.hull(bottom.concat(top), 'p'),
    k.poly(top, true),
    k.ring([0, 0, z1], 6.05, X, Y, 'p', 64),
    k.ring([0, 0, z1 - 0.35], 6.05, X, Y, 'p', 64),
    k.arc([0, 0, z0], r0, Math.PI - a, TAU - a, 'g', X, Y, 40),
    k.ring([0, 0, CONT.water], wr, X, Y, 'w', 64),
    k.arc([0, 0, CONT.fill], fr, fc - 0.5, fc + 0.5, 'p', X, Y, 20),
    k.multi([tick(fc - 0.5), tick(fc + 0.5)]),
  ];
  // corner light path: LED → 1.8 cm chord → LDR, plus the 90° sensor
  const led = [OPT_R * Math.cos(10 * RAD), OPT_R * Math.sin(10 * RAD), OPT_Z];
  const ldr = [OPT_R * Math.cos(-10 * RAD), OPT_R * Math.sin(-10 * RAD), OPT_Z];
  const s90 = [OPT_R + 0.3, 0, OPT_Z];
  items.push(k.line(led, ldr, 'bb'));
  items.push(...k.cyl(add3(led, [0, 0.15, 0]), add3(led, [0, 1.3, 0]), 0.45, 0.45, X, Z, 'bf', 16));
  items.push(...k.cyl(add3(ldr, [0, -0.15, 0]), add3(ldr, [0, -0.8, 0]), 0.5, 0.5, X, Z, 'pf', 16));
  items.push(...k.cyl(add3(s90, [0.05, 0, 0]), add3(s90, [0.7, 0, 0]), 0.5, 0.5, Y, Z, 'pf', 16));
  items.push(k.multi([[[OPT_R * 0.35, -0.9, OPT_Z], [OPT_R * 0.35, 0.9, OPT_Z]], [[OPT_R, 0, OPT_Z], [OPT_R * 0.35, 0, OPT_Z]]], 'g'));
  return figSvg(items);
}

export const partFigures = {
  esp32: figEsp32(),
  ldr: figLdr(),
  led: figLed(),
  thermistor: figThermistor(),
  stepper: figStepper(),
  container: figContainer(),
};
