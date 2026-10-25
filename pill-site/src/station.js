// Pill station — isometric line-art blueprint of the real build, with an exploded, turning assembly.
// Geometry follows the printed plate (pillgate/cad/peel_plate_complete.stl, measured) and peel_chamber.scad: a 3D-printed cylinder chamber with a flat lid (one small hole),
// an LED box on one side (white, blue, red), photoresistor holders in line and at 90°, a clear cup on a shim ring,
// then the Arduino UNO Q, the breadboard with the dividers and the laptop running Pill Gate.
// mountStation(el) renders the scene and returns { setProgress(p), destroy() }.
// autoDemo(handle) runs the idle loop (assemble → hold → explode → hold → assemble) while on screen.
// attachScroll(handle, { stage }) drives progress from scroll and falls back to the idle loop when scrolling stops.
// partFigures holds seven standalone 300×300 SVG strings for a FIG grid; every path carries data-draw="i".
import { createTimeline, animate } from 'animejs';
import { onScroll } from './scroll.js';

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

// Rigid tilt about an axis parallel to Y (x–z plane) through h.
function tiltY(phi, h) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return ([x, y, z]) => { const dx = x - h[0], dz = z - h[2]; return [h[0] + dx * c - dz * s, y, h[2] + dx * s + dz * c]; };
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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


/* ───────────────────────── scene parts (world units = cm) ───────────────────────── */
// The real print, measured from pillgate/cad/peel_plate_complete.stl (5 shells: body, lid, 3 shim rings; see
// pillgate/cad/README.md). The chamber is centred at the origin on the table. +x / +y face the viewer. The beam
// runs along y: the LED box sits on +y, the in-line photoresistor straight across on −y, the 90° one on +x.

const CH = { Ro: 4.2, Rw: 3.9, H: 8.4, floor: 0.4, az: 3.2 }; // STL: body Ø84 × 84 mm, well Ø78, floor 4, beam 28 mm above the floor
const POD = { w: 1.5, y0: Math.sqrt(4.2 * 4.2 - 1.5 * 1.5), y1: 6.8, z1: 4.7 }; // STL: LED box 30 wide, 26 out of the wall, top at 47 mm
const BOSS = { r: 0.7, out: CH.Ro + 0.6 }; // STL: holders 14 wide, 6 out of the wall, top at 39 mm
const LID = { r: 4.49, z0: 7.6, z1: 8.7, plugR: 3.84, hole: [0, -2.7], holeR: 0.18 }; // STL: lid Ø89.8 × 11 (8 skirt + 3 plate), plug Ø76.8, one Ø3.6 hole 27 mm off centre
const CUP = { r0: 3.3, r1: 3.85, z0: 0.4, z1: 7.2, water: 4.8 }; // clear cup (not printed): drawn to fit the Ø78 well, ≤ 68 mm tall
const SHIM = { ro: 3.86, ri: 3.2, z0: 0.4, z1: 1.6 }; // STL: shim rings Ø77.2 × 12, bores Ø58 / 64 / 70 (the Ø64 one drawn)
const DIFF = { w: 1.3, y0: 4.23, y1: 4.37, z0: 2.1, z1: 4.8 }; // diffuser plate in its slot (separate print, SCAD)
const LEDS = [['lw', -0.8], ['lb', 0], ['lr', 0.8]]; // white · blue · red, 8 mm apart on the box's outer wall
const LED_AT = [0, POD.y1, CH.az];
const LDR_AT = [0, -CH.Rw, CH.az]; // in line: straight across the cup from the LED box
const LDR90_AT = [CH.Rw, 0, CH.az]; // side: 90° to the beam
const SENSOR_SCALE = 1.9; // photoresistors drawn larger than life so they read at this scale
const UNO = { x0: -14.6, x1: -7.74, y0: -2.6, y1: 2.73, z0: 0, z1: 0.16 }; // Arduino UNO Q, 68.6 × 53.3 mm
const BB = { x0: -15, x1: -6.75, y0: 3.4, y1: 8.9, z0: 0, z1: 0.85 }; // half-size breadboard with the dividers
const LAP = { x: 6.5, y0: -8, y1: -19, zb: 0.5, lean: 14 * RAD, depth: 7.5, h: 8 }; // laptop, drawn smaller than life

// photoresistor holder: a fin with a rounded top, hulled down to the table (as printed); normal at angle phi
function holderFace(phi, s) {
  const n = [Math.cos(phi), Math.sin(phi)], a = [-Math.sin(phi), Math.cos(phi)];
  const P = (aa, z) => [n[0] * s + a[0] * aa, n[1] * s + a[1] * aa, z];
  const out = [P(-BOSS.r, 0)];
  for (let i = 0; i <= 12; i++) {
    const t = Math.PI - (Math.PI * i) / 12;
    out.push(P(BOSS.r * Math.cos(t), CH.az + BOSS.r * Math.sin(t)));
  }
  out.push(P(BOSS.r, 0));
  return { pts: out, P, a: [a[0], a[1], 0] };
}
function holder(k, phi) {
  const sIn = Math.sqrt(CH.Ro * CH.Ro - BOSS.r * BOSS.r) - 0.05;
  const outer = holderFace(phi, BOSS.out), inner = holderFace(phi, sIn);
  return [
    k.hull(outer.pts.concat(inner.pts), 'vf'),
    k.poly(outer.pts, true),
    // the two leg holes the photoresistor's leads come out of
    k.ring(outer.P(-0.18, CH.az), 0.08, outer.a, Z, 'p', 8),
    k.ring(outer.P(0.18, CH.az), 0.08, outer.a, Z, 'p', 8),
  ];
}

function partBody(k) {
  // far holder first (in line, −y), then the cylinder, then the near holder (90°, +x) and the LED box (+y)
  const items = [...holder(k, -90 * RAD)];
  items.push(...k.cyl([0, 0, 0], [0, 0, CH.H], CH.Ro, CH.Ro, X, Y, 'vf', 56));
  items.push(k.ring([0, 0, CH.H], CH.Rw, X, Y, 'p', 56)); // the well
  items.push(...holder(k, 0));
  items.push(...k.solid(corners(-POD.w, POD.y0, 0, POD.w, POD.y1, POD.z1), 'vf'));
  // five Ø5.2 mm holes on the box's outer wall: three LEDs in a row, two spare above and below the blue
  for (const [dx, dz] of [[0, 0.8], [0, -0.8], [-0.8, 0], [0, 0], [0.8, 0]]) items.push(k.ring([dx, POD.y1, CH.az + dz], 0.26, X, Z, 'p', 14));
  // diffuser slot on top of the box
  items.push(k.poly([[-DIFF.w, DIFF.y0, POD.z1], [DIFF.w, DIFF.y0, POD.z1], [DIFF.w, DIFF.y1, POD.z1], [-DIFF.w, DIFF.y1, POD.z1]], true));
  return items;
}

function partDiffuser(k, st) {
  // only the part of the plate that has left the slot is drawn; the rest is inside the LED box
  const z0 = Math.max(DIFF.z0, POD.z1 - 6 * st.diffuser);
  if (z0 >= DIFF.z1 - 0.01) return [];
  return k.solid(corners(-DIFF.w, DIFF.y0, z0, DIFF.w, DIFF.y1, DIFF.z1), 'df');
}

function partLid(k) {
  const items = k.cyl([0, 0, LID.z0], [0, 0, LID.z1], LID.r, LID.r, X, Y, 'vf', 56);
  items.push(k.ring([0, 0, LID.z0], LID.plugR, X, Y, 'g', 48)); // the plug under the plate (hidden)
  items.push(k.ring([LID.hole[0], LID.hole[1], LID.z1], LID.holeR, X, Y, 'p', 14)); // the one small hole
  return items;
}

function partCup(k) {
  const { r0, r1, z0, z1, water } = CUP;
  const a = k.cam.a;
  const rAt = (z) => r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  const items = [
    k.hull(circ([0, 0, z0], r0, X, Y, 48).concat(circ([0, 0, z1], r1, X, Y, 48)), 'cf'),
    k.ring([0, 0, z1], r1, X, Y, 'p', 48),
    k.ring([0, 0, z1 - 0.25], r1 - 0.04, X, Y, 'p', 48), // rolled rim
    k.arc([0, 0, z0], r0, Math.PI - a, TAU - a, 'g', X, Y, 32),
    k.ring([0, 0, water], rAt(water), X, Y, 'w', 48),
    k.arc([0, 0, water], rAt(water) * 0.6, 0.3, 1.9, 'g'),
  ];
  // one whole tablet on the cup floor
  items.push(...k.cyl([0.6, 0.4, z0 + 0.05], [0.6, 0.4, z0 + 0.3], 0.5, 0.5, X, Y, 'tf', 20));
  return items;
}

function partShim(k) {
  const items = k.cyl([0, 0, SHIM.z0], [0, 0, SHIM.z1], SHIM.ro, SHIM.ro, X, Y, 'vf', 48);
  items.push(k.ring([0, 0, SHIM.z1], SHIM.ri, X, Y, 'pf', 48)); // the hole the cup's base sits in
  return items;
}

function partLed(k, st) {
  // each LED goes in from outside: flange on the box's outer wall, dome pointing into the box, legs out the back
  const S = 1 + 0.8 * st.spin;
  const items = [];
  LEDS.forEach(([c, dx], i) => {
    const base = [dx + (i - 1) * 1.2 * st.led, POD.y1, CH.az];
    const at = (s) => add3(base, [0, -s * S, 0]);
    items.push(k.multi([
      [add3(base, [-0.1 * S, 0, 0]), add3(base, [-0.1 * S, 1.7 * S, 0]), add3(base, [-0.1 * S, 1.9 * S, -0.2 * S])],
      [add3(base, [0.1 * S, 0, 0]), add3(base, [0.1 * S, 1.4 * S, 0])],
    ]));
    const dome = [];
    for (const [s, r] of [[0.55, 0.25], [0.65, 0.235], [0.73, 0.19], [0.78, 0.11], [0.8, 0.02]]) dome.push(...circ(at(s), r * S, X, Z, 16));
    items.push(k.hull(dome, c));
    items.push(...k.cyl(at(0.55), at(0.1), 0.25 * S, 0.25 * S, X, Z, c, 20));
    items.push(...k.cyl(at(0.1), at(0), 0.29 * S, 0.29 * S, X, Z, c, 20));
    if (i === 1) st.fx.ledTip = k.pr(at(0.8)); // the beam leaves the blue LED's dome
  });
  return items;
}

// Sensor local frame: s along the facing normal n (angle phi in the ground plane), a across, b up.
function sensorFrame(anchor, phi, S) {
  const n = [Math.cos(phi), Math.sin(phi), 0];
  const a = [Math.sin(phi), -Math.cos(phi), 0];
  const M = (sa, ss, sb) => add3(anchor, add3(mul3(a, sa * S), add3(mul3(n, ss * S), [0, 0, sb * S])));
  return { n, a, M };
}
// photoresistors grow as they drift out so their faces read in the exploded view
const sensorScale = (st) => SENSOR_SCALE + 1.4 * st.spin;

function ldrBody(k, M, a, S) {
  // CdS photoresistor: face along +n, two leads out the back (through the holder)
  const items = [k.multi([[M(-0.09, -0.32, 0), M(-0.09, -1.6, 0)], [M(0.09, -0.32, 0), M(0.09, -1.6, 0)]])];
  items.push(...k.cyl(M(0, -0.32, 0), M(0, -0.12, 0), 0.27 * S, 0.27 * S, a, Z, 'pf', 24));
  const zz = [];
  for (let i = 0; i <= 6; i++) {
    const zb = -0.15 + i * 0.05;
    const w = Math.sqrt(Math.max(0, 0.2 * 0.2 - zb * zb));
    zz.push(M(i % 2 ? w : -w, -0.12, zb));
  }
  items.push(k.poly(zz));
  return items;
}

function partLdr(k, st) {
  const phi = (90 - 45 * st.spin) * RAD; // faces +y, across the cup at the LED box → turns to the viewer
  const S = sensorScale(st);
  const { M, a } = sensorFrame(LDR_AT, phi, S);
  st.fx.ldrFace = k.pr(M(0, -0.12, 0));
  return ldrBody(k, M, a, S);
}

function partLdr90(k, st) {
  const phi = (180 - 135 * st.spin) * RAD; // faces −x, into the cup at 90° to the beam → turns to the viewer
  const S = sensorScale(st);
  const { M, a } = sensorFrame(LDR90_AT, phi, S);
  st.fx.ldr90Face = k.pr(M(0, -0.12, 0));
  return ldrBody(k, M, a, S);
}

function unoBoard(k, { x0, x1, y0, y1, z0, z1 }) {
  const items = k.solid(corners(x0, y0, z0, x1, y1, z1));
  // USB-C on the short edge, the processor can, the LED matrix, the two header rows, mounting holes
  items.push(...k.solid(corners(x0 - 0.12, y0 + 2.2, z1, x0 + 0.65, y0 + 3.1, z1 + 0.32)));
  items.push(...k.solid(corners(x0 + 1.3, y0 + 1.0, z1, x0 + 2.9, y0 + 2.4, z1 + 0.22)));
  const mx0 = x0 + 3.5, my0 = y0 + 1.0, dots = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 8; j++) {
    const px = mx0 + i * 0.2, py = my0 + j * 0.2;
    dots.push([[px, py, z1], [px + 0.05, py, z1]]);
  }
  items.push(k.multi(dots, 'w'));
  items.push(k.poly([[mx0 - 0.15, my0 - 0.15, z1], [mx0 + 2.55, my0 - 0.15, z1], [mx0 + 2.55, my0 + 1.55, z1], [mx0 - 0.15, my0 + 1.55, z1]], true, 'g'));
  const pins = [];
  for (let i = 0; i < 18; i++) pins.push([[x0 + 1.6 + i * 0.254, y0 + 0.15, z1], [x0 + 1.6 + i * 0.254, y0 + 0.15, z1 + 0.32]]);
  for (let i = 0; i < 16; i++) pins.push([[x0 + 2.1 + i * 0.254, y1 - 0.15, z1], [x0 + 2.1 + i * 0.254, y1 - 0.15, z1 + 0.32]]);
  items.push(k.multi(pins));
  for (const [hx, hy] of [[x0 + 0.4, y0 + 0.4], [x1 - 0.4, y0 + 0.4], [x1 - 0.4, y1 - 0.4]]) items.push(k.ring([hx, hy, z1], 0.12, X, Y, 'p', 10));
  return items;
}

function partUno(k, st) {
  const items = unoBoard(k, UNO);
  st.fx.esp = k.pr([UNO.x0 + 0.3, UNO.y0 + 2.65, UNO.z1 + 0.3]); // the data leaves by the USB-C port
  return items;
}

function breadboard(k, { x0, x1, y0, y1, z0, z1 }) {
  const items = k.solid(corners(x0, y0, z0, x1, y1, z1));
  const ym = (y0 + y1) / 2;
  // power rails, the centre channel, hole rows (dashed), and the three resistors: 10 kΩ, 10 kΩ, 330 Ω
  items.push(k.multi([[[x0 + 0.3, y0 + 0.35, z1], [x1 - 0.3, y0 + 0.35, z1]], [[x0 + 0.3, y1 - 0.35, z1], [x1 - 0.3, y1 - 0.35, z1]]]));
  items.push(k.poly([[x0 + 0.3, ym - 0.12, z1], [x1 - 0.3, ym - 0.12, z1], [x1 - 0.3, ym + 0.12, z1], [x0 + 0.3, ym + 0.12, z1]], true));
  const rows = [];
  for (const dy of [-1.6, -1.1, -0.6, 0.6, 1.1, 1.6]) rows.push([[x0 + 0.5, ym + dy, z1], [x1 - 0.5, ym + dy, z1]]);
  items.push(k.multi(rows, 'g'));
  for (const rx of [x0 + 2.0, x0 + 4.0, x0 + 6.2]) {
    items.push(k.multi([[[rx - 0.55, ym - 0.6, z1], [rx - 0.55, ym - 0.6, z1 + 0.25]], [[rx + 0.55, ym - 0.6, z1], [rx + 0.55, ym - 0.6, z1 + 0.25]]]));
    items.push(...k.cyl([rx - 0.35, ym - 0.6, z1 + 0.25], [rx + 0.35, ym - 0.6, z1 + 0.25], 0.11, 0.11, Y, Z, 'rf', 12));
  }
  return items;
}

function partBreadboard(k) { return breadboard(k, BB); }

function partLaptop(k, st, lead = true) {
  const { x, y0, y1, zb, lean, depth, h } = LAP;
  const L = ([px, py, pz]) => { const d = pz - zb; return [px - d * Math.sin(lean), py, zb + d * Math.cos(lean)]; };
  const items = [];
  // deck: keyboard and trackpad in front of the hinge
  items.push(...k.solid(corners(x, y1, 0, x + depth, y0, zb)));
  items.push(k.poly([[x + 0.6, y0 - 0.8, zb], [x + 3.8, y0 - 0.8, zb], [x + 3.8, y1 + 0.8, zb], [x + 0.6, y1 + 0.8, zb]], true, 'g'));
  const ym = (y0 + y1) / 2;
  items.push(k.poly([[x + 4.5, ym + 2.0, zb], [x + 6.9, ym + 2.0, zb], [x + 6.9, ym - 2.0, zb], [x + 4.5, ym - 2.0, zb]], true));
  // lid, leaning back from the hinge; the screen faces +x
  items.push(...k.solid(corners(x - 0.4, y1, zb, x, y0, zb + h, L)));
  const face = (yy, zz) => L([x, yy, zz]);
  items.push(k.poly([face(y0 - 0.5, zb + 0.6), face(y1 + 0.5, zb + 0.6), face(y1 + 0.5, zb + h - 0.5), face(y0 - 0.5, zb + h - 0.5)], true));
  // Pill Gate on screen: title bar, readout rows, the answer box, and the run's curve (draws in last)
  items.push(k.multi([
    [face(y0 - 1.2, zb + h - 1.3), face(y0 - 4.6, zb + h - 1.3)],
    [face(y0 - 1.2, zb + h - 2.6), face(y0 - 3.8, zb + h - 2.6)],
    [face(y0 - 1.2, zb + h - 3.4), face(y0 - 3.4, zb + h - 3.4)],
  ]));
  items.push(k.poly([face(y0 - 1.2, zb + 1.3), face(y0 - 4.2, zb + 1.3), face(y0 - 4.2, zb + 2.4), face(y0 - 1.2, zb + 2.4)], true));
  items.push(k.poly([face(y0 - 5.4, zb + h - 1.6), face(y0 - 5.4, zb + 1.3), face(y1 + 1.2, zb + 1.3)], false, 'g'));
  const curve = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    curve.push(face(y0 - 5.6 - (y0 - y1 - 6.8) * t, zb + 1.5 + 4.3 * (1 - Math.exp(-3.4 * t))));
  }
  items.push({ ...k.poly(curve), draw: st.piCurve });
  st.fx.pi = k.pr(face(y0 - 2.9, zb + h - 1.3)); // the stream lands on the screen's title bar
  // USB-C lead from the UNO Q (guide)
  if (lead) items.push(k.poly([[x + 0.4, y0 + 0.2, 0], [x + 0.4, -4.6, 0], [-5.0, -4.6, 0], [UNO.x0 - 0.8, UNO.y0 + 2.65, 0]], false, 'g'));
  return items;
}

function partGuides(k, st, off) {
  // construction lines: the chamber's axis, the beam axis and the 90° axis, and the explode trails
  const items = [
    k.line([0, 0, -2], [0, 0, 24], 'g'),
    k.line([0, -8, CH.az], [0, 11, CH.az], 'g'),
    k.line([0, 0, CH.az], [9, 0, CH.az], 'g'),
  ];
  const trail = (anchor, o) => [anchor, add3(anchor, o)];
  items.push(k.multi([
    trail(LED_AT, off.led), trail(LDR_AT, off.ldr), trail(LDR90_AT, off.ldr90),
    trail([UNO.x1, UNO.y1, 0.16], off.uno),
  ], 'g'));
  return items;
}

const PARTS = [
  { id: 'laptop', draw: partLaptop },
  { id: 'uno', draw: partUno, mag: { c: [(UNO.x0 + UNO.x1) / 2, (UNO.y0 + UNO.y1) / 2, 0.1], k: 0.35 } },
  { id: 'breadboard', draw: partBreadboard },
  { id: 'shim', draw: partShim },
  { id: 'cup', draw: partCup },
  { id: 'ldr', draw: partLdr },
  { id: 'ldr90', draw: partLdr90 },
  { id: 'body', draw: partBody },
  { id: 'diffuser', draw: partDiffuser },
  { id: 'led', draw: partLed },
  { id: 'lid', draw: partLid },
];

// Exploded offsets (world cm) at full progress for each part's progress value. The shim ring hops out of the
// well onto the table on an arc, composed in frameState().
const EXPLODE = {
  lid: [0, 0, 12],
  cup: [0, 0, 7.4],
  diffuser: [0, 0, 6],
  led: [0, 4, 2],
  ldr: [0, -4.6, 0.6],
  ldr90: [5, 0, 0.6],
  uno: [-3.5, -1, 3.5],
  laptop: [2, -2, 0],
};
const SHIM_HOP = { to: [12, 1.5, 0], up: 9 };
const CUP_TILT = -7 * RAD;

const LABELS = [
  { id: 'lid', no: '01', title: 'FLAT LID', sub: 'one small hole · skirt keeps light out', at: [[0, LID.r, LID.z1], 'lid'], x: 40, y: 92, side: 'L' },
  { id: 'body', no: '02', title: '3D-PRINTED CHAMBER', sub: 'Ø 84 × 84 mm · purple print · dark inside', at: [[-CH.Ro * 0.71, CH.Ro * 0.71, 5.6], 'body'], x: 40, y: 160, side: 'L' },
  { id: 'cup', no: '03', title: 'CLEAR CUP', sub: 'water + one tablet · shim ring centres it', at: [[[CUP.r1 * 0.71, -CUP.r1 * 0.71, CUP.z1], 'cup'], [[SHIM.ro * 0.71, SHIM.ro * 0.71, SHIM.z1], 'shim']], x: 860, y: 92, side: 'R' },
  { id: 'app', no: '04', title: 'PILL GATE APP', sub: 'laptop: curves · reference · answer', at: [[LAP.x, (LAP.y0 + LAP.y1) / 2, LAP.zb + 6], 'laptop'], x: 860, y: 160, side: 'R' },
  { id: 'led', no: '05', title: 'LED BOX', sub: 'white · blue · red, 5 mm · diffuser slot', at: [[[LED_AT[0], LED_AT[1] + 0.4, LED_AT[2]], 'led'], [[DIFF.w, DIFF.y1, DIFF.z1], 'diffuser']], x: 40, y: 700, side: 'L' },
  { id: 'uno', no: '06', title: 'ARDUINO UNO Q', sub: '3.3 V · 12-bit · breadboard dividers', at: [[[UNO.x1, UNO.y1, UNO.z1], 'uno'], [[BB.x0 + 2, BB.y1, BB.z1], 'breadboard']], x: 40, y: 762, side: 'L' },
  { id: 'sensors', no: '07', title: 'TWO PHOTORESISTORS', sub: 'in line (A0) · 90° side (A1)', at: [[LDR_AT, 'ldr'], [LDR90_AT, 'ldr90']], x: 860, y: 730, side: 'R' },
];

/* ───────────────────────── mount ───────────────────────── */

const SCENE_CAM = { S: 19, ox: 600, oy: 470, pivot: [0, -4.7, 4] };
const CHAR_W = 7.04; // 11px JetBrains Mono advance + letter-spacing
const GLYPHS = 10; // '1'/'0' glyphs streaming UNO Q → laptop
const AMBIENT_FROM = 0.05; // beam pulse, light and stream run above this progress

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function bez(b, u) {
  const v = 1 - u, a = v * v * v, c = 3 * v * v * u, d = 3 * v * u * u, e = u * u * u;
  return [a * b[0][0] + c * b[1][0] + d * b[2][0] + e * b[3][0], a * b[0][1] + c * b[1][1] + d * b[2][1] + e * b[3][1]];
}

export function mountStation(host, opts = {}) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  host.classList.add('station');
  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': opts.label || 'Exploded line drawing of the Pill station as built: a 3D-printed cylinder chamber with a flat lid that has one small hole, a clear cup of water on a shim ring inside, an LED box on one side with white, blue and red LEDs and a diffuser plate, one photoresistor holder straight across from the LED box and one at 90°, an Arduino UNO Q and a breadboard, and the laptop running the Pill Gate app.',
  });
  const root = el('g', { class: 'st-root' }, svg);
  const guides = el('g', { class: 'st-guides' }, root);
  const groups = {};
  const partById = {};
  for (const p of PARTS) {
    groups[p.id] = { g: el('g', { 'data-part': p.id }, root), paths: [] };
    partById[p.id] = p;
  }
  // fx layer: pulsing beam, travelling light, scatter path, data stream with glyphs
  const fx = el('g', { class: 'st-fx' }, root);
  const beam = el('path', { class: 'bb st-beam' }, fx);
  const scatter = el('path', { class: 'st-scatter' }, fx);
  const light = el('path', { class: 'st-light' }, fx);
  const stream = el('path', { class: 'st-stream' }, fx);
  const glyphs = [];
  for (let i = 0; i < GLYPHS; i++) {
    const g = el('text', { class: 'st-glyph', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, fx);
    g.textContent = '1011001110'[i];
    glyphs.push({ el: g, u: -1 });
  }
  const labelLayer = el('g', { class: 'st-labels' }, svg);
  const labels = LABELS.map((L) => {
    const g = el('g', { class: 'st-label', 'data-label': L.id }, labelLayer);
    const anchors = (Array.isArray(L.at[0][0]) ? L.at : [L.at]);
    const leaders = anchors.map(() => el('path', { class: 'st-leader', pathLength: '1' }, g));
    const dots = anchors.map(() => el('circle', { class: 'st-dot', r: '2' }, g));
    const t = el('text', { x: L.x, y: L.y }, g);
    const t1 = el('tspan', { class: 'st-no' }, t); t1.textContent = L.no + '  ';
    const t2 = el('tspan', { class: 'st-title' }, t);
    const t3 = el('tspan', { class: 'st-sub', x: L.x, dy: '15' }, t); t3.textContent = L.sub;
    const w = Math.max(L.no.length + 2 + L.title.length, L.sub.length) * CHAR_W;
    const end = L.side === 'L' ? L.x + w + 10 : L.x - 10;
    return { L, g, t, t1, t2, t3, anchors, leaders, dots, end, typed: -1 };
  });
  host.appendChild(svg);
  // phones hide the SVG labels (the numbered list under the figure carries them), so frame the assembly alone
  const narrow = typeof matchMedia === 'function' ? matchMedia('(max-width: 700px)') : null;
  const frameView = () => svg.setAttribute('viewBox', narrow && narrow.matches ? '250 150 700 520' : `0 0 ${VB_W} ${VB_H}`);
  frameView();
  if (narrow) narrow.addEventListener('change', frameView);

  const st = {
    yaw: 0, elev: 0, zoom: 1, panX: 0, panY: -70,
    lid: 0, cup: 0, shim: 0, diffuser: 0, led: 0, ldr: 0, ldr90: 0, spin: 0, uno: 0, laptop: 0, piCurve: 0,
    guide: 0, stream: 0,
    fx: {}, // projected anchor points the parts report while drawing
  };
  LABELS.forEach((_, i) => { st['ld' + i] = 0; st['ty' + i] = 0; });

  function syncPaths(entry, items) {
    const { g, paths } = entry;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let p = paths[i];
      if (!p) {
        p = el('path', { class: it.c }, g);
        if (it.draw != null) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; }
        paths.push(p);
      }
      p.setAttribute('d', it.d);
      if (it.draw != null) p.style.strokeDashoffset = String(1 - it.draw);
    }
    // parts that draw fewer paths this frame (the diffuser leaving its slot) clear the rest
    for (let i = items.length; i < paths.length; i++) paths[i].setAttribute('d', '');
  }

  const guideEntry = { g: guides, paths: [] };
  let frame = null; // { cam, off, pre } of the last render, reused by the ambient loop
  let streamBez = null;

  function frameState() {
    const cam = makeCam({ ...SCENE_CAM, ox: SCENE_CAM.ox + st.panX, oy: SCENE_CAM.oy + st.panY, yaw: st.yaw, elev: st.elev, zoom: st.zoom });
    const off = {};
    for (const id in EXPLODE) off[id] = mul3(EXPLODE[id], st[id]);
    // the shim ring lifts out of the well and lands on the table beside the chamber
    off.shim = add3(mul3(SHIM_HOP.to, st.shim), [0, 0, SHIM_HOP.up * Math.sin(Math.PI * st.shim)]);
    off.body = [0, 0, 0];
    off.breadboard = [0, 0, 0];
    const pre = { cup: tiltY(CUP_TILT * st.cup, [0, 0, 0]) };
    for (const p of PARTS) {
      if (!p.mag) continue;
      const { c, k } = p.mag;
      const m = 1 + k * st[p.id];
      pre[p.id] = (q) => [c[0] + (q[0] - c[0]) * m, c[1] + (q[1] - c[1]) * m, c[2] + (q[2] - c[2]) * m];
    }
    return { cam, off, pre };
  }

  function drawPart(id) {
    const { cam, off, pre } = frame;
    syncPaths(groups[id], partById[id].draw(kit(cam, off[id], pre[id]), st));
  }

  function render() {
    frame = frameState();
    const { cam, off, pre } = frame;
    for (const p of PARTS) drawPart(p.id);
    syncPaths(guideEntry, partGuides(kit(cam), st, off));
    guides.style.opacity = String(0.35 + 0.65 * st.guide);
    renderFxGeometry();
    renderFx();
    labels.forEach((lab, i) => {
      const { L, end } = lab;
      const ld = st['ld' + i], ty = st['ty' + i];
      const ky = L.y - 4;
      const knee = end + (L.side === 'L' ? 22 : -22);
      lab.anchors.forEach(([pt, part], j) => {
        const [ax, ay] = cam.P(...add3(pre[part] ? pre[part](pt) : pt, off[part]));
        lab.leaders[j].setAttribute('d', `M${f1(ax)} ${f1(ay)}L${f1(knee)} ${f1(ky)}L${f1(end)} ${f1(ky)}`);
        lab.leaders[j].style.strokeDashoffset = String(1 - ld);
        lab.dots[j].setAttribute('cx', f1(ax));
        lab.dots[j].setAttribute('cy', f1(ay));
        lab.dots[j].style.opacity = String(clamp01(ld * 4));
      });
      // number lands as the leader arrives, then the title types out and the sub line fades up
      lab.t.style.opacity = ld > 0 ? '1' : '0';
      lab.t1.style.opacity = String(clamp01((ld - 0.6) / 0.4));
      const n = Math.round(L.title.length * ty);
      const typed = n + (ty > 0 && ty < 1 ? 0.5 : 0);
      if (typed !== lab.typed) {
        lab.typed = typed;
        lab.t2.textContent = L.title.slice(0, n) + (ty > 0 && ty < 1 ? '_' : '');
      }
      lab.t3.style.opacity = String(clamp01((ty - 0.45) / 0.55));
    });
  }

  function renderFxGeometry() {
    const { ledTip, ldrFace, ldr90Face, esp, pi } = st.fx;
    beam.setAttribute('d', `M${f1(ledTip[0])} ${f1(ledTip[1])}L${f1(ldrFace[0])} ${f1(ldrFace[1])}`);
    const mid = lerp2(ledTip, ldrFace, 0.5);
    scatter.setAttribute('d', `M${f1(mid[0])} ${f1(mid[1])}L${f1(ldr90Face[0])} ${f1(ldr90Face[1])}`);
    scatter.style.opacity = String(0.35 + 0.5 * st.spin);
    // data link: a low arc in front of the chamber from the UNO Q's USB-C port to the laptop screen
    const dx = pi[0] - esp[0];
    streamBez = [esp, [esp[0] + dx * 0.3, esp[1] + 170], [esp[0] + dx * 0.75, pi[1] + 150], pi];
    const [a, b, c, d] = streamBez;
    stream.setAttribute('d', `M${f1(a[0])} ${f1(a[1])}C${f1(b[0])} ${f1(b[1])} ${f1(c[0])} ${f1(c[1])} ${f1(d[0])} ${f1(d[1])}`);
    stream.style.opacity = String(st.stream);
  }

  // time-driven fx: beam pulse, light travelling LED → photoresistor, '1'/'0' glyphs travelling UNO Q → laptop
  let ambT = 0;
  function renderFx() {
    const live = !reduced && current > AMBIENT_FROM;
    const { ledTip, ldrFace } = st.fx;
    beam.style.opacity = live ? String(0.7 - 0.3 * Math.cos((TAU * ambT) / 1400)) : '1';
    if (live) {
      const u = (ambT / 900) % 1;
      const a = lerp2(ledTip, ldrFace, Math.max(0, u - 0.22)), b = lerp2(ledTip, ldrFace, u);
      light.setAttribute('d', `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`);
      light.style.opacity = String(Math.sin(Math.PI * u) * clamp01((current - AMBIENT_FROM) / 0.1));
    } else light.style.opacity = '0';
    for (let i = 0; i < GLYPHS; i++) {
      const gl = glyphs[i];
      const show = clamp01((st.stream - (i / GLYPHS) * 0.6) / 0.4); // staggered as the stream opens
      if (show <= 0) { gl.el.style.opacity = '0'; continue; }
      const u = (ambT / 3600 + i / GLYPHS) % 1;
      if (u < gl.u) gl.el.textContent = Math.random() < 0.5 ? '0' : '1';
      gl.u = u;
      const [x, y] = bez(streamBez, u);
      gl.el.setAttribute('x', f1(x));
      gl.el.setAttribute('y', f1(y));
      gl.el.style.opacity = String(show * Math.min(1, Math.sin(Math.PI * u) * 2.2));
    }
  }

  // Choreography (timeline units: 1000 = full explode). Reassembly is the same timeline seeked backwards.
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOutCubic' } });
  // camera: swing left and down, orbit right and up, spring past and settle in the last 10%
  tl.add(st, { yaw: -22, elev: -6, duration: 300, ease: 'inOutSine' }, 0)
    .add(st, { yaw: 12, duration: 600, ease: 'inSine' }, 300)
    .add(st, { yaw: 16, duration: 100, ease: 'outBack(2.2)' }, 900)
    .add(st, { elev: 6, duration: 600, ease: 'inOutSine' }, 300)
    .add(st, { elev: 5, duration: 100, ease: 'outBack(2.2)' }, 900)
    .add(st, { zoom: 0.8, panY: -50, duration: 600, ease: 'inOutSine' }, 40)
    // 1. the lid lifts off
    .add(st, { lid: 1, duration: 380, ease: 'inOutQuart' }, 40)
    .add(st, { guide: 1, duration: 500, ease: 'inOutSine' }, 200)
    // 2. the cup rises out of the well and leans; the shim ring hops out onto the table
    .add(st, { cup: 1, duration: 380, ease: 'inOutQuart' }, 220)
    .add(st, { shim: 1, duration: 380, ease: 'inOutSine' }, 360)
    // 3. the diffuser slides up out of its slot, the LEDs pull out of the box, the photoresistors out of their holders
    .add(st, { diffuser: 1, duration: 320, ease: 'inOutQuart' }, 420)
    .add(st, { led: 1, duration: 360, ease: 'inOutQuart' }, 470)
    .add(st, { ldr: 1, duration: 360, ease: 'inOutQuart' }, 500)
    .add(st, { ldr90: 1, duration: 360, ease: 'inOutQuart' }, 530)
    .add(st, { spin: 1, duration: 360, ease: 'inOutSine' }, 520)
    // 4. the UNO Q lifts off the table; the laptop slides back
    .add(st, { uno: 1, duration: 400, ease: 'inOutQuart' }, 400)
    .add(st, { laptop: 1, duration: 380 }, 420)
    // 5. data starts streaming, the curve on the laptop draws in
    .add(st, { stream: 1, duration: 220, ease: 'outSine' }, 700)
    .add(st, { piCurve: 1, duration: 140, ease: 'inOutSine' }, 860);
  // 6. labels 01 → 07: leader draws in, number lands, title types; reversed they leave first
  LABELS.forEach((_, i) => {
    tl.add(st, { ['ld' + i]: 1, duration: 100, ease: 'outCubic' }, 720 + i * 22)
      .add(st, { ['ty' + i]: 1, duration: 120, ease: 'linear' }, 760 + i * 22);
  });

  const total = tl.duration;
  let current = 0;
  function seekTo(p) {
    current = clamp01(p);
    tl.seek(current * total);
    render();
    wake();
  }

  // ambient loop: runs the beam pulse, the travelling light and the data glyphs while exploded and on screen
  let amb = 0, ambLast = 0, onScreen = false, destroyed = false;
  function ambient(now) {
    amb = 0;
    if (destroyed || !onScreen || current <= AMBIENT_FROM) {
      ambLast = 0;
      if (!destroyed) renderFx();
      return;
    }
    const dt = ambLast ? Math.min(64, now - ambLast) : 16;
    ambLast = now;
    ambT += dt;
    renderFx();
    amb = requestAnimationFrame(ambient);
  }
  function wake() {
    if (!amb && !reduced && !destroyed && onScreen && current > AMBIENT_FROM) amb = requestAnimationFrame(ambient);
  }
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; wake(); })
    : null;
  if (io && !reduced) io.observe(host);

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
      if (handle._stopScroll) handle._stopScroll();
      destroyed = true;
      if (amb) cancelAnimationFrame(amb);
      if (io) io.disconnect();
      if (narrow) narrow.removeEventListener('change', frameView);
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

/* ───────────────────────── idle loop + scroll ───────────────────────── */

// assemble → hold 1.2 s → explode 3.5 s → hold 2.5 s → assemble 3 s → …
const LOOP = { hold0: 1200, up: 3500, hold1: 2500, down: 3000 };
const LOOP_MS = LOOP.hold0 + LOOP.up + LOOP.hold1 + LOOP.down;
const easeIO = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeIOInv = (p) => Math.acos(1 - 2 * clamp01(p)) / Math.PI;

function loopProgress(ms) {
  let m = ms % LOOP_MS;
  if (m < LOOP.hold0) return 0;
  m -= LOOP.hold0;
  if (m < LOOP.up) return easeIO(m / LOOP.up);
  m -= LOOP.up;
  if (m < LOOP.hold1) return 1;
  m -= LOOP.hold1;
  return 1 - easeIO(m / LOOP.down);
}

// Loop time to resume from progress p. A resume follows an idle pause, so a fully exploded drawing starts
// assembling right away; anything in between assembles from where it is.
function loopTimeFor(p) {
  if (p <= 0.001) return 0;
  return LOOP.hold0 + LOOP.up + LOOP.hold1 + LOOP.down * easeIOInv(1 - p);
}

function runLoop(handle, until) {
  let raf = 0, last = 0, visible = false, stopped = false;
  let t = loopTimeFor(handle.progress);
  function frame(now) {
    raf = 0;
    if (stopped) return;
    if (until && until()) return stop();
    if (!visible) return;
    if (last) t += Math.min(64, now - last);
    last = now;
    handle._seek(loopProgress(t));
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
  return stop;
}

export function autoDemo(handle) {
  if (!handle || handle.reduced) return () => {};
  if (handle._stopDemo) handle._stopDemo();
  const stop = runLoop(handle, () => handle.driven);
  handle._stopDemo = stop;
  return stop;
}

// Scroll drives progress (anime onScroll, smoothed with sync). After idleAfterMs without scrolling while the
// stage is on screen, the idle loop resumes from the current progress; the next scroll takes over again.
export function attachScroll(handle, { stage, idleAfterMs = 2500, enter = 'bottom top+=10%', leave = 'top bottom-=90%', sync = 0.25 } = {}) {
  if (!handle || handle.reduced) return { stop() {} };
  if (handle._stopDemo) handle._stopDemo();
  if (handle._stopScroll) handle._stopScroll();
  const target = stage || handle.el;
  let loopStop = null, timer = 0, lastY = null, onScreen = false, stopped = false;
  const proxy = { p: 0 };
  const follow = animate(proxy, {
    p: [0, 1],
    duration: 1000,
    ease: 'linear',
    autoplay: false,
    onUpdate: () => { if (!loopStop && !stopped) handle._seek(proxy.p); },
  });
  function idle() {
    timer = 0;
    if (stopped || loopStop || !onScreen) return; // off screen: re-armed when the stage returns
    loopStop = runLoop(handle);
  }
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(idle, idleAfterMs);
  }
  function takeOver() {
    if (loopStop) {
      loopStop();
      loopStop = null;
      // smoothing continues from where the loop left the drawing, not from the old scroll value
      follow.seek(handle.progress * follow.duration, true);
    }
    arm();
  }
  // progress: the observer's smoothed sync seeks `follow`, whose onUpdate drives the drawing
  const obs = onScroll({ target, enter, leave, sync });
  obs.link(follow);
  // takeover: any scroll, including past either end of the observer's range where it stops updating
  const onUserScroll = () => {
    const y = obs.scroll;
    if (y === lastY) return;
    lastY = y;
    takeOver();
  };
  addEventListener('scroll', onUserScroll, { passive: true });
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !loopStop && !timer && !stopped) arm();
  });
  io.observe(target);
  arm();
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (loopStop) loopStop();
    loopStop = null;
    io.disconnect();
    removeEventListener('scroll', onUserScroll);
    obs.revert();
    follow.pause();
    if (handle._stopScroll === stop) handle._stopScroll = null;
  }
  handle._stopScroll = stop;
  return { stop };
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
  // the only fills with colour: the purple print, the clear cup, the tablet, the LEDs, the resistors, the diffuser
  vf: 'fill="#2E2A55" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"',
  cf: 'fill="rgba(190,225,255,0.05)" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"',
  tf: 'fill="#E9EEF2" stroke="rgba(255,255,255,0.55)" stroke-width="1"',
  df: 'fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.55)" stroke-width="1"',
  rf: 'fill="#C9B48A" stroke="rgba(255,255,255,0.55)" stroke-width="1"',
  lw: 'fill="#F2F1EC" stroke="rgba(255,255,255,0.7)" stroke-width="1.25"',
  lb: 'fill="#2F6BFF" stroke="rgba(255,255,255,0.7)" stroke-width="1.25"',
  lr: 'fill="#C8574B" stroke="rgba(255,255,255,0.7)" stroke-width="1.25"',
};

// Every path carries data-draw="<order>" so the page can stroke-draw the figure in.
function figSvg(items) {
  const body = items.map((it, i) => `<path ${FIG_STYLE[it.c]} data-draw="${i}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" d="${it.d}"/>`).join('');
  return `<svg xmlns="${NS}" viewBox="0 0 300 300" fill="none" aria-hidden="true">${body}</svg>`;
}

function figKit(S, pivot, oy = 160, yaw = 0) {
  return kit(makeCam({ S, ox: 150, oy, pivot, yaw }));
}

const FIG_ST = { led: 0, spin: 0, diffuser: 0, piCurve: 1, fx: {} };

// Fig 0.1: the chamber with its lid off: the cup of water in the well, the beam across, the 90° path
function figChamber() {
  const k = figKit(16, [0, 1.0, 4.2], 150);
  const a = k.cam.a;
  const items = [k.line([0, 0, -1], [0, 0, 10], 'g')];
  items.push(...partBody(k));
  // inside the well: the back half of the cup rim and of the water surface show over the far wall
  items.push(k.arc([0, 0, CUP.z1], CUP.r1, Math.PI - a, TAU - a, 'p', X, Y, 32));
  items.push(k.arc([0, 0, CUP.water], CUP.r0 + 0.25, Math.PI - a, TAU - a, 'w', X, Y, 32));
  // light path: LED box → across the cup → in-line holder; the scatter path to the 90° holder
  items.push(k.line([0, POD.y0, CH.az], [0, -CH.Rw, CH.az], 'bb'));
  items.push(k.line([0, 0, CH.az], [CH.Rw, 0, CH.az], 'g'));
  for (const [c, dx] of LEDS) items.push(k.ring([dx, POD.y1, CH.az], 0.26, X, Z, c, 14));
  return figSvg(items);
}

// Fig 0.2: the LED box: three LEDs pulled out of their holes, the diffuser plate lifted out of its slot
function figLedBox() {
  const k = figKit(24, [0, 6.7, 3.5], 158);
  const items = [
    k.arc([0, 0, 0], CH.Ro, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7, 'g', X, Y, 16),
    k.arc([0, 0, POD.z1 + 1.2], CH.Ro, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7, 'g', X, Y, 16),
    ...k.solid(corners(-POD.w, POD.y0, 0, POD.w, POD.y1, POD.z1), 'vf'),
  ];
  for (const [dx, dz] of [[0, 0.8], [0, -0.8], [-0.8, 0], [0, 0], [0.8, 0]]) items.push(k.ring([dx, POD.y1, CH.az + dz], 0.26, X, Z, 'p', 14));
  items.push(k.poly([[-DIFF.w, DIFF.y0, POD.z1], [DIFF.w, DIFF.y0, POD.z1], [DIFF.w, DIFF.y1, POD.z1], [-DIFF.w, DIFF.y1, POD.z1]], true));
  // diffuser plate halfway out of its slot
  items.push(...k.solid(corners(-DIFF.w, DIFF.y0, POD.z1 + 0.6, DIFF.w, DIFF.y1, POD.z1 + 0.6 + (DIFF.z1 - DIFF.z0)), 'df'));
  // the three LEDs, pulled 1.6 cm out of their holes along the insertion axis
  const lk = kit(k.cam, [0, 1.6, 0]);
  items.push(k.multi(LEDS.map(([, dx]) => [[dx, POD.y1, CH.az], [dx, POD.y1 + 1.6, CH.az]]), 'g'));
  items.push(...partLed(lk, FIG_ST));
  return figSvg(items);
}

// Fig 0.3: a photoresistor holder seen from inside the well: the pocket in the wall, the photoresistor pulled
// out toward the cup, its leads lined up with the pocket (they leave through the holder's two leg holes)
function figLdrHolder() {
  const k = figKit(28, [3.3, 0, 3], 160, 180);
  const t0 = -0.62, t1 = 0.62, zt = 6;
  const inner = (z) => circ([0, 0, z], CH.Rw, X, Y, 16, t0, t1);
  const outer = (z) => circ([0, 0, z], CH.Ro, X, Y, 16, t0, t1);
  const items = [
    // the holder fin behind the wall (hidden)
    k.poly(holderFace(0, BOSS.out).pts, true, 'g'),
    k.hull(inner(0).concat(inner(zt)), 'vf'),
    k.poly(inner(zt).concat(outer(zt).reverse()), true, 'vf'),
    k.ring([CH.Rw, 0, CH.az], 0.27, Y, Z, 'p', 20), // the pocket
    k.line([1.0, 0, CH.az], [CH.Rw, 0, CH.az], 'g'),
  ];
  const S = 2.4;
  const { M, a } = sensorFrame([1.9, 0, CH.az], Math.PI, S);
  items.push(...ldrBody(k, M, a, S));
  return figSvg(items);
}

// Fig 0.4 (next): a thermistor bead dangling through the lid's one small hole into the water
function figThermistor() {
  const k = figKit(24, [0, 0, -0.67], 150);
  const [hx, hy] = LID.hole;
  const items = [
    k.ring([0, 0, -3], CUP.r1, X, Y, 'w', 48),
    k.multi([[[hx - 0.06, hy, LID.z1 - LID.z0 + 1.6], [hx - 0.06, hy, -2.6]], [[hx + 0.06, hy, LID.z1 - LID.z0 + 1.6], [hx + 0.06, hy, -2.6]]], 'p'),
    ...k.cyl([0, 0, 0], [0, 0, LID.z1 - LID.z0], LID.r, LID.r, X, Y, 'vf', 56),
    k.ring([hx, hy, LID.z1 - LID.z0], LID.holeR, X, Y, 'p', 14),
    k.multi([[[hx - 0.06, hy, LID.z1 - LID.z0], [hx - 0.06, hy, LID.z1 - LID.z0 + 1.6], [hx - 0.5, hy, LID.z1 - LID.z0 + 2.2]], [[hx + 0.06, hy, LID.z1 - LID.z0], [hx + 0.06, hy, LID.z1 - LID.z0 + 1.6], [hx + 0.5, hy, LID.z1 - LID.z0 + 2.2]]]),
  ];
  // the bead, below the lid (hidden behind it → dashed), sitting under the water line
  const bead = [];
  for (const [dz, r] of [[-0.3, 0.1], [-0.15, 0.25], [0.05, 0.28], [0.2, 0.18], [0.3, 0.06]]) bead.push(...circ([hx, hy, -2.9 + dz], r, X, Y, 16));
  items.push(k.hull(bead, 'g'));
  return figSvg(items);
}

// Fig 0.5 (next): the DC-motor lid from the CAD: a tower on the lid, the motor in its pocket, a rod down to a
// four-blade paddle that turns below the beam
function figStirrer() {
  const k = figKit(15, [0, 0, -1.6], 150);
  const lz = LID.z1 - LID.z0; // plate top (lid local, skirt bottom at 0)
  const tw = 0.99, tl = 1.24; // tower half-sizes: (motor 15.8 × 20.8 mm) + 4 mm walls
  const items = [
    k.line([0, 0, -9.4], [0, 0, 6.6], 'g'),
    // paddle: hub and four blades
    ...k.cyl([0, 0, -8.6], [0, 0, -7.6], 0.45, 0.45, X, Y, 'pf', 16),
  ];
  for (const t of [0, 90, 180, 270]) {
    const c = Math.cos(t * RAD), s = Math.sin(t * RAD);
    items.push(k.poly([[0.4 * c, 0.4 * s, -8.6], [1.8 * c, 1.8 * s, -8.6], [1.8 * c, 1.8 * s, -7.6], [0.4 * c, 0.4 * s, -7.6]], true));
  }
  items.push(k.line([0, 0, -7.6], [0, 0, -1.6], 'p')); // the rod
  items.push(...k.cyl([0, 0, -1.9], [0, 0, -0.5], 0.45, 0.45, X, Y, 'pf', 16)); // coupler
  items.push(...k.cyl([0, 0, 0], [0, 0, lz], LID.r, LID.r, X, Y, 'vf', 56));
  items.push(...k.solid(corners(-tw, -tl, lz, tw, tl, lz + 2.0), 'vf'));
  // the motor, lifted out of its pocket
  items.push(...k.solid(corners(-0.79, -1.04, lz + 2.8, 0.79, 1.04, lz + 2.8 + 2.55)));
  items.push(k.multi([[[0, 0, lz + 2.8], [0, 0, lz + 2.2]]]));
  return figSvg(items);
}

// Fig 0.6: the Arduino UNO Q and the breadboard with the two 10 kΩ dividers and the shared 330 Ω
function figUno() {
  const k = figKit(15, [0, 2.9, 0], 158);
  const items = [
    k.multi([[[-5.2, -4.0, 0], [5.2, -4.0, 0]], [[-5.2, 9.8, 0], [5.2, 9.8, 0]]], 'g'),
    ...unoBoard(k, { x0: -3.43, x1: 3.43, y0: -3.1, y1: 2.23, z0: 0, z1: 0.16 }),
    ...breadboard(k, { x0: -4.1, x1: 4.15, y0: 3.4, y1: 8.9, z0: 0, z1: 0.85 }),
  ];
  return figSvg(items);
}

// Fig 0.7: the laptop with Pill Gate on screen
function figLaptop() {
  const k = figKit(14, [LAP.x + 2.2, (LAP.y0 + LAP.y1) / 2, 3.4], 156);
  const items = [k.multi([[[LAP.x - 3, LAP.y0 + 2, 0], [LAP.x + LAP.depth + 2, LAP.y0 + 2, 0]], [[LAP.x - 3, LAP.y1 - 2, 0], [LAP.x + LAP.depth + 2, LAP.y1 - 2, 0]]], 'g')];
  items.push(...partLaptop(k, FIG_ST, false));
  return figSvg(items);
}

export const partFigures = {
  container: figChamber(),
  led: figLedBox(),
  ldr: figLdrHolder(),
  thermistor: figThermistor(),
  stepper: figStirrer(),
  esp32: figUno(),
  pi: figLaptop(),
};
