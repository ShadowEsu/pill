// Pill Gate front end: plain JavaScript, no build step. Hash routes in one page (#/welcome, #/, #/check/bottle …).
// Every page calls the same backend contract (see app/CLAUDE.md); the mode (Clinic / Personal / Check) only changes
// copy, the home page and the nav labels. Words stay ink; colour lives in fills, lines and chips.
"use strict";

// ================================================================ helpers
const $ = (id) => document.getElementById(id);
const api = async (path, opts = {}) => {
  const r = await fetch(path, opts);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { detail: t }; }
  if (!r.ok) throw new Error(j.detail || r.statusText);
  return j;
};
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RESULT_TEXT = { PASSED_SCREEN: "Passed the screen", NEEDS_LAB: "Needs lab testing", UNABLE_TO_VERIFY: "Unable to verify" };
const RESULT_CLASS = { PASSED_SCREEN: "pass", NEEDS_LAB: "lab", UNABLE_TO_VERIFY: "unable" };
const RESULT_TONE = { PASSED_SCREEN: "mint", NEEDS_LAB: "amber", UNABLE_TO_VERIFY: "grey" };
const DISCLAIMER = "This is a screening device: it checks how a tablet dissolves, it does not identify ingredients.";
const timeAgo = (sec) => {
  const m = Math.max(0, Math.round((Date.now() / 1000 - sec) / 60));
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); return h < 36 ? `${h} h ago` : new Date(sec * 1000).toLocaleDateString();
};
function toast(text) {
  const t = document.createElement("div"); t.className = "toast"; t.role = "status"; t.textContent = text;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
/** Serif title whose words rise in 40 ms apart (CSS .title .tw). */
const splitTitle = (text, tag = "h1") => `<${tag} class="title" aria-label="${esc(text)}">${String(text).split(/\s+/).filter(Boolean).map((w, i) => `<span class="tw" aria-hidden="true" style="--w:${i}">${esc(w)}</span>`).join(" ")}</${tag}>`;
/** Page header: eyebrow with a breathing dot, split serif title, optional back button, side slot, tone wash. */
function head({ eyebrow = "", title, tone = "sky", back = null, side = "" }) {
  return `<header class="head tone-${tone}"><div class="wash" aria-hidden="true"></div>
    <div class="head-main">${back ? `<a class="btn ghost icon" href="${esc(back)}" aria-label="Back">←</a>` : ""}
      <div class="head-text">${eyebrow ? `<p class="eyebrow"><span class="eb-dot"></span>${esc(eyebrow)}</p>` : ""}${splitTitle(title)}</div></div>
    ${side ? `<div class="head-side">${side}</div>` : ""}</header>`;
}
/** Animated number: counts up to `to` once (reduced motion: instant). */
function countUp(el, to, ms = 900) {
  if (!el) return;
  if (reduceMotion() || !to) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / ms); el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// Button ripple: the press point becomes --rx/--ry on the pressed .btn.
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest && e.target.closest(".btn"); if (!b) return;
  const r = b.getBoundingClientRect(); b.style.setProperty("--rx", `${e.clientX - r.left}px`); b.style.setProperty("--ry", `${e.clientY - r.top}px`);
}, { passive: true });

// ================================================================ local prefs (localStorage.pillgate.*)
const PREF = {
  get mode() { return localStorage.getItem("pillgate.mode") || ""; },
  set mode(v) { localStorage.setItem("pillgate.mode", v); },
  get sound() { return localStorage.getItem("pillgate.sound") !== "off"; },
  set sound(v) { localStorage.setItem("pillgate.sound", v ? "on" : "off"); },
  get speak() { return localStorage.getItem("pillgate.speak") === "on"; },
  set speak(v) { localStorage.setItem("pillgate.speak", v ? "on" : "off"); },
  reset() { Object.keys(localStorage).filter((k) => k.startsWith("pillgate.")).forEach((k) => localStorage.removeItem(k)); },
};
const MODES = {
  clinic: { name: "Clinic", tone: "sky", lab: "held", who: "Pharmacist at the station: each delivery is held or released at the gate." },
  personal: { name: "Personal", tone: "mint", lab: "show this to a pharmacist", who: "Check a bottle you bought: one tablet, one minute, one answer." },
  check: { name: "Check", tone: "violet", lab: "send for lab testing", who: "Straight to the four steps: bottle, tablet, measure, result." },
};
const mode = () => (MODES[PREF.mode] ? PREF.mode : "");

// ================================================================ app state
const S = {
  config: { app_name: "Pill Gate", ai: false, model: "", timing: { blank_s: 10, min_s: 120, max_s: 600, quick_s: 60 } },
  live: null,                      // last /api/live
  leave: [],                       // cleanups for the current page
  onLive: null,                    // page hook, called on every /api/live
  check: { bottle: null, imprint: null, bottleUrl: "", imprintUrl: "", profileId: "", runMode: "quick" },
  chats: {},                       // scanId -> [{role, content}]
};

// ================================================================ glyphs (hand-drawn line icons, draw in on mount)
const GLYPHS = {
  bottle: {
    wash: 'sky', fill: 'M15 19.5c0-2.2 1.7-3.6 3.6-3.6h10.6c2 0 3.8 1.5 3.8 3.6V40c0 1.9-1.6 3.4-3.5 3.4H18.6c-2 0-3.6-1.5-3.6-3.4z',
    strokes: [
      'M18.2 9.1c3.9-.4 7.8-.3 11.7.1l.2 6.4c-3.9.3-7.9.3-11.9 0z',
      'M15.1 20.2c-.2-2.6 1.6-4.4 4-4.5 3.4-.2 6.7-.1 10.1 0 2.4.1 4 1.7 3.9 4.2l-.2 19.5c0 2.3-1.6 3.9-3.9 4-3.4.2-6.8.2-10.1 0-2.3-.1-3.8-1.7-3.8-3.9z',
      'M15.4 25.6c5.7.5 11.4.4 17.3-.1M15.6 35.2c5.6.4 11.2.4 16.9-.1',
      'M20 30.3h8.1',
    ],
  },
  cup: {
    wash: 'mint', fill: 'M12.5 21.5h23l-2.6 18.6c-.3 2-2 3.4-4 3.4H19c-2 0-3.7-1.4-4-3.4z',
    strokes: [
      'M11.2 20.8c8.5-.6 17-.6 25.6.1',
      'M12.4 21.2l2.5 18.7c.3 2.1 2 3.6 4.1 3.6h9.8c2.1 0 3.8-1.6 4.1-3.6l2.6-18.6',
      'M14.2 28.3c6.4.6 12.9.6 19.5-.2',
      'M21.1 15.9c-1.3-1.6-1.2-3.4.2-5M26.8 16c-1.2-1.7-1-3.3.4-4.9',
    ],
  },
  led: {
    wash: 'amber', fill: 'M24 6.5c6.8 0 11.6 5.1 11.6 11.4 0 4.4-2.5 7.2-4.6 9.6-1.2 1.4-1.8 3-1.8 4.6H18.9c0-1.7-.7-3.3-1.9-4.6-2.2-2.4-4.7-5.2-4.7-9.6C12.3 11.6 17.2 6.5 24 6.5z',
    strokes: [
      'M24.2 6.4c6.6-.2 11.5 4.9 11.5 11.3.1 4.4-2.4 7.3-4.5 9.7-1.2 1.3-1.9 2.9-1.9 4.7l-10.5.1c0-1.8-.6-3.4-1.9-4.8-2.1-2.3-4.6-5.1-4.6-9.5 0-6.5 5.1-11.6 11.9-11.5z',
      'M19 36.6c3.4.3 6.7.3 10.1-.1M20.4 41.1c2.5.3 5 .3 7.5-.1',
      'M21.2 25.8l2.6-5.2 2.7 5.2',
    ],
  },
  sensor: {
    wash: 'sky', fill: 'M9.5 15.8h29v17.6h-29z',
    strokes: [
      'M9.3 16.1c9.8-.5 19.6-.5 29.4.1.4 5.8.4 11.6 0 17.4-9.8.4-19.6.4-29.3 0-.5-5.9-.5-11.7-.1-17.5z',
      'M14.4 24.8c1.8-3 3.6-3 5.3 0s3.6 3 5.4 0 3.5-3 5.3 0 2.6 2.4 3.6.6',
      'M16.4 40.2l.1-6.6M31.7 40.3l-.1-6.6M14.2 40.4c3.6.2 7.1.2 10.6 0',
    ],
  },
  lab: {
    wash: 'violet', fill: 'M19.8 22.5h8.6l8.3 14.4c1.3 2.3-.3 5-2.9 5H14.4c-2.6 0-4.2-2.8-2.9-5z',
    strokes: [
      'M19.5 7.6c3-.2 6.1-.2 9.1.1',
      'M20.6 7.9l-.2 13.6-8.9 15.3c-1.4 2.4.3 5.3 3.1 5.2l18.9.1c2.8 0 4.5-2.9 3.1-5.3l-9-15.4.1-13.4',
      'M15.4 31.6c5.8.6 11.5.5 17.3-.2',
      'M22.2 36.5h.1M26.9 35.6h.1',
    ],
  },
  escrow: {
    wash: 'violet', fill: 'M11.5 21.5h25v20h-25z',
    strokes: [
      'M11.1 21.3c8.6-.4 17.2-.4 25.9.1.3 6.7.3 13.4-.1 20.1-8.5.4-17.1.4-25.6 0-.5-6.7-.5-13.5-.2-20.2z',
      'M16.4 21.1c-.2-4.1.2-7.2 2.1-9.1 1.6-1.6 3.6-2.3 5.6-2.3s4.1.7 5.6 2.3c1.9 1.9 2.3 5 2.1 9.1',
      'M24 28.6c1.3 0 2.2.9 2.2 2.1 0 .9-.5 1.6-1.2 1.9l.3 3.9h-2.7l.3-3.9c-.7-.3-1.2-1-1.2-1.9.1-1.2 1-2.1 2.3-2.1z',
    ],
  },
  supplier: {
    wash: 'amber', fill: 'M8.5 17.5h20.8v17.8H8.5zM29.3 23h7.4l3.8 5.6v6.7H29.3z',
    strokes: [
      'M8.2 17.3c7.1-.4 14.2-.4 21.3.1.3 6 .2 12 0 17.9-7.1.3-14.2.3-21.2 0-.4-6-.4-12-.1-18z',
      'M29.6 22.8c2.4-.2 4.8-.2 7.2 0l3.9 5.8-.1 6.7-11-.1',
      'M14.7 39.6a3.3 3.3 0 1 0 .1-.1zM33.7 39.6a3.3 3.3 0 1 0 .1-.1z',
      'M13.3 23.6c3.8.3 7.5.2 11.2-.1',
    ],
  },
  clinic: {
    wash: 'mint', fill: 'M9.5 20.5l14.5-11 14.5 11v20.8h-29z',
    strokes: [
      'M7.4 21.5L24.1 8.9l16.6 12.8',
      'M10.2 19.5c-.3 7.3-.3 14.5.1 21.8 9.2.3 18.4.3 27.6 0 .3-7.3.3-14.5-.1-21.8',
      'M24 22.2l.1 11.3M18.3 27.9c3.8.2 7.6.2 11.5-.1',
    ],
  },
  pharmacist: {
    wash: 'sky', fill: 'M11 41.5c0-7.4 5.8-12.4 13-12.4s13 5 13 12.4z',
    strokes: [
      'M24.1 8.6c4 0 6.8 3 6.7 6.9-.1 3.9-3 6.8-6.8 6.8-3.9 0-6.7-3-6.7-6.9.1-3.9 2.9-6.8 6.8-6.8z',
      'M10.8 41.6c-.3-7.4 5.7-12.6 13.2-12.6 7.6 0 13.4 5.3 13.2 12.7',
      'M19.4 29.9l4.6 7.3 4.6-7.3',
      'M29.6 35.1c1.4.1 2.8.1 4.2-.1M31.7 33l.1 4.2',
    ],
  },
  calendar: {
    wash: 'sky', fill: 'M9.5 12.5h29v28.8h-29z',
    strokes: [
      'M9.3 12.4c9.8-.4 19.6-.4 29.5.1.3 9.6.3 19.2-.1 28.9-9.8.3-19.6.3-29.3 0-.4-9.7-.4-19.3-.1-29z',
      'M9.8 20.2c9.5.4 19 .4 28.6-.1',
      'M17 8.4l.1 7.4M31.1 8.3l-.1 7.5',
      'M16.4 27.6h.1M24 27.4h.1M31.6 27.6h.1M16.5 34.4h.1M24.1 34.6h.1',
    ],
  },
  wallet: {
    wash: 'mint', fill: 'M8.5 15.5h31v25h-31z',
    strokes: [
      'M8.4 15.3c10.4-.4 20.8-.4 31.2.1.3 8.4.3 16.8-.1 25.2-10.4.3-20.7.3-31-.1-.4-8.4-.4-16.8-.1-25.2z',
      'M10.1 15.1l20.6-6.8 2 6.9',
      'M39.8 23.6c-3.6-.2-7.1-.1-10.6.2-.3 2.7-.2 5.4.1 8.1 3.5.3 7 .3 10.5.1',
      'M33 27.9h.1',
    ],
  },
  station: {
    wash: 'sky', fill: 'M9.5 8.5h29v31h-29z',
    strokes: [
      'M9.4 8.3c9.8-.4 19.6-.4 29.3.1.4 10.4.4 20.8 0 31.2-9.7.4-19.5.4-29.2 0-.5-10.4-.5-20.8-.1-31.3z',
      'M14.4 14.3c6.4-.3 12.8-.2 19.3.1.2 3.4.2 6.8-.1 10.2-6.4.3-12.8.3-19.2 0-.3-3.4-.3-6.8 0-10.3z',
      'M18.3 31.9a2.6 2.6 0 1 0 .1-.1z',
      'M26.4 31.5c2.4.2 4.8.2 7.2-.1M13.4 43.9c7.1.3 14.2.3 21.3-.1',
    ],
  },
  tablet: {
    wash: 'mint', fill: 'M17.5 10.5h13c3.9 0 7 3.1 7 7v13c0 3.9-3.1 7-7 7h-13c-3.9 0-7-3.1-7-7v-13c0-3.9 3.1-7 7-7z',
    strokes: [
      'M24.1 9.6c8.2-.1 14.4 6.2 14.3 14.5-.1 8.2-6.3 14.4-14.4 14.3-8.2 0-14.3-6.3-14.3-14.5.1-8.1 6.3-14.4 14.4-14.3z',
      'M13.1 24.3c7.3.4 14.6.3 21.9-.2',
      'M17.3 18.2c1.4-1.6 3-2.7 4.9-3.3',
    ],
  },
  quarter: {
    wash: 'amber', fill: 'M24 8.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31z',
    strokes: [
      'M24.2 8.2c8.6 0 15.6 7.1 15.4 15.9-.1 8.6-7.1 15.5-15.7 15.4-8.6 0-15.5-7.1-15.4-15.7.1-8.6 7.1-15.7 15.7-15.6z',
      'M24 12.9c6.1 0 11 5 10.9 11.2',
      'M21 20.6c.9-1.4 2.2-2.1 3.7-2 1.9.1 3.1 1.2 3 2.6-.1 3.1-6.6 2.4-6.7 5.4 0 1.5 1.4 2.6 3.4 2.6 1.6 0 2.9-.7 3.6-2',
      'M24.4 16.4l-.1 2.2M24.1 29.3l.1 2.4',
    ],
  },
};
const WASH = { bottle: "sky", cup: "mint", led: "amber", sensor: "sky", lab: "violet", escrow: "violet", supplier: "amber", clinic: "mint", pharmacist: "sky", calendar: "sky", wallet: "mint", station: "sky", tablet: "mint", quarter: "amber" };
function glyph(name, size = 56) {
  const d = GLYPHS[name]; if (!d) return "";
  return `<svg class="glyph wash-${d.wash || WASH[name]}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" style="--sw:${(96 / size).toFixed(2)}">
    <path class="g-wash" d="${d.fill}"/>${d.strokes.map((s, i) => `<path class="g-ink" d="${s}" pathLength="1" style="--k:${i}"/>`).join("")}</svg>`;
}

// ================================================================ binary pill (the site's capsule printed in 1s and 0s)
function mountBinaryPill(cv, { dark = true, cell = 8, scale = 1.9 } = {}) {
  const ctx = cv.getContext("2d"); if (!ctx) return () => {};
  const R = 0.36, HALF = 0.82;
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const LIGHT = norm([-0.45, 0.7, 1.2]);
  const sd = (x, y, z) => { const cx = Math.max(-HALF, Math.min(HALF, x)); return Math.hypot(x - cx, y, z) - R; };
  const rot = (x, y, z, ay, az) => { const cy = Math.cos(ay), sy = Math.sin(ay); const x1 = cy * x + sy * z, z1 = -sy * x + cy * z; const cz = Math.cos(az), sz = Math.sin(az); return [cz * x1 - sz * y, sz * x1 + cz * y, z1]; };
  const reduce = reduceMotion();
  let COLS, ROWS, cw, ch, bits, aspect, font, raf = 0, running = false, start = performance.now();
  const size = () => {
    const w = cv.clientWidth || 320, h = cv.clientHeight || 200, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    COLS = Math.max(16, Math.round(w / cell)); ROWS = Math.max(10, Math.round(h / (cell * 1.55)));
    cw = cv.width / COLS; ch = cv.height / ROWS; aspect = w / h;
    bits = new Uint8Array(COLS * ROWS).map(() => (Math.random() < 0.5 ? 1 : 0));
    font = `${dark ? 400 : 500} ${Math.floor(ch * 0.92)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  };
  function draw(t) {
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.font = font; ctx.textBaseline = "top";
    const ay = t * 0.6, az = 0.35 + Math.sin(t * 0.3) * 0.12, breathe = 0.88 + Math.sin(t * 1.6) * 0.12, wave = ((t * 0.55) % 2.6) - 1.3;
    const [dx, dy, dz] = rot(0, 0, -1, -ay, -az);
    if (!reduce && Math.random() < 0.35) bits[(Math.random() * bits.length) | 0] ^= 1;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const sx = ((i + 0.5) / COLS * 2 - 1) * scale * aspect * 0.5, sy = -((j + 0.5) / ROWS * 2 - 1) * scale * 0.5;
      const [ox, oy, oz] = rot(sx, sy, 3, -ay, -az);
      let s = 0, hit = false, px = 0, py = 0, pz = 0;
      for (let k = 0; k < 40; k++) { px = ox + dx * s; py = oy + dy * s; pz = oz + dz * s; const d = sd(px, py, pz); if (d < 0.005) { hit = true; break; } s += d; if (s > 7) break; }
      if (!hit) continue;
      const e = 0.002;
      const n = norm([sd(px + e, py, pz) - sd(px - e, py, pz), sd(px, py + e, pz) - sd(px, py - e, pz), sd(px, py, pz + e) - sd(px, py, pz - e)]);
      const nw = rot(n[0], n[1], n[2], az, ay);
      const lum = Math.max(0, nw[0] * LIGHT[0] + nw[1] * LIGHT[1] + nw[2] * LIGHT[2]);
      const w = Math.exp(-((px - wave) ** 2) / 0.018), half = px > 0, hi = lum > 0.82 || w > 0.6;
      const a = Math.min(1, (0.45 + lum * 0.55) * breathe + w * 0.35);
      ctx.fillStyle = dark
        ? (hi ? `rgba(236,246,255,${Math.min(1, 0.7 + lum * 0.3)})` : half ? `rgba(110,195,255,${a})` : `rgba(120,225,175,${a})`)
        : (hi ? `rgba(22,24,27,${Math.min(1, 0.6 + lum * 0.4)})` : half ? `rgba(42,143,224,${Math.min(1, a + 0.2)})` : `rgba(47,168,116,${Math.min(1, a + 0.2)})`);
      const bit = lum > 0.5 || w > 0.6 ? 1 : (bits[j * COLS + i] & (lum > 0.25 ? 1 : 0));
      ctx.fillText(bit ? "1" : "0", i * cw, j * ch);
    }
  }
  const frame = (now) => { raf = 0; if (!running) return; draw((now - start) / 1000); raf = requestAnimationFrame(frame); };
  const play = () => { if (running || reduce || document.hidden) return; running = true; start = performance.now() - 900; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
  size(); draw(0.9);
  const io = new IntersectionObserver(([en]) => (en.isIntersecting ? play() : stop()), { threshold: 0.05 }); io.observe(cv);
  const vis = () => (document.hidden ? stop() : null); document.addEventListener("visibilitychange", vis);
  const ro = new ResizeObserver(() => { size(); if (!running) draw(0.9); }); ro.observe(cv);
  return () => { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); };
}

// ================================================================ device chip + live polling (2×/s)
function deviceText(st) {
  if (!st) return ["server offline", "bad"];
  const fresh = st.seconds_since_last !== null && st.seconds_since_last < 4;
  if (st.mode === "no device") return ["no device", "bad"];
  if (st.mode.startsWith("replay")) return ["REPLAY (not live) · " + st.mode.slice(7), "warn"];
  return [`${st.mode}${fresh ? " · live" : " · waiting"}`, st.mode.startsWith("serial") && fresh ? "ok beat" : "bad"];
}
function paintDevice() {
  const [text, cls] = deviceText(S.live && S.live.status);
  document.querySelectorAll("[data-device]").forEach((el) => { el.className = "chip " + cls; el.querySelector(".dp-text").textContent = text; el.title = text; });
  const p = $("devicePill"); p.className = "chip " + cls; p.querySelector(".dp-text").textContent = text; p.title = text;
  const lines = S.live && S.live.status ? S.live.status.lines : null;
  document.querySelectorAll("[data-lines]").forEach((el) => (el.textContent = lines == null ? "–" : String(lines)));
}
const deviceChip = () => `<span class="chip" data-device><span class="dot"></span><span class="dp-text">device…</span></span>`;
let tickBusy = false;
async function tick() {
  if (tickBusy) return; tickBusy = true;
  try { S.live = await api("/api/live"); } catch { S.live = null; }
  tickBusy = false;
  paintDevice();
  if (S.live && Run.recording) Run.onLive(S.live);
  if (S.onLive && S.live) S.onLive(S.live);
}

// ================================================================ nav
const ICONS = {
  gate: "M4 20V9l8-5 8 5v11M9 20v-6h6v6",
  home: "M4 11l8-6 8 6v9H4zM10 20v-5h4v5",
  check: "M9 4.5a4.5 4.5 0 0 1 6.4 0l4.1 4.1a4.5 4.5 0 0 1-6.4 6.4l-8.6-8.6zM10.9 10.9l-4.4 4.4a4.5 4.5 0 0 0 6.4 6.4l4.4-4.4",
  history: "M3 18c3 0 4-11 7-11s3 7 5 7 2-3 6-3",
  profiles: "M5 6h14M5 12h14M5 18h9",
  atlas: "M12 4a3 3 0 1 1 0 .1zM5 17a2.5 2.5 0 1 1 0 .1zM19 17a2.5 2.5 0 1 1 0 .1zM10.6 6.6l-4 8.2M13.4 6.6l4 8.2M7.5 17.5h9",
  settings: "M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7",
};
const NAV = {
  clinic: [["/", "Gate", "gate"], ["/check/bottle", "Check", "check"], ["/history", "History", "history"], ["/profiles", "Profiles", "profiles"], ["/atlas", "Atlas", "atlas"]],
  personal: [["/", "Home", "home"], ["/check/bottle", "Check", "check"], ["/history", "History", "history"], ["/atlas", "Atlas", "atlas"], ["/settings", "Settings", "settings"]],
  check: [["/check/bottle", "Check", "check"], ["/history", "History", "history"], ["/profiles", "Profiles", "profiles"], ["/atlas", "Atlas", "atlas"], ["/settings", "Settings", "settings"]],
};
const navKey = (path) => (/^\/(check|result|ask|issue)\b/.test(path) ? "/check/bottle" : path);
let navMode = null, navArmed = false;
function renderNav(path) {
  const nav = $("nav"), m = mode();
  const hide = !m || path === "/welcome";
  document.body.classList.toggle("no-nav", hide); nav.hidden = hide;
  if (hide) return;
  if (navMode !== m) {
    navMode = m; navArmed = false;
    if (nav._stopPill) nav._stopPill();
    nav.innerHTML = `<a class="nav-brand" href="#/"><span class="serif">${esc(S.config.app_name)}</span><span class="eyebrow">${esc(MODES[m].name)}</span></a>
      <ul class="nav-list still"><li class="nav-ind" aria-hidden="true"></li>${NAV[m].map(([to, label, ic]) =>
        `<li><a class="nav-item" href="#${to}" data-to="${to}"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[ic]}"/></svg><span>${label}</span></a></li>`).join("")}</ul>
      <div class="nav-foot"><div class="nav-station"><canvas class="bpill" style="width:100%;height:84px" aria-label="Pill printed in ones and zeros" role="img"></canvas>
        ${deviceChip()}<span class="footnote">lines read <span class="mono" data-lines>–</span></span></div>
        <a class="footnote" href="#/settings">Settings</a><a class="footnote" href="#/welcome" style="text-decoration:underline">Change mode</a></div>`;
    if (window.matchMedia("(min-width: 900px)").matches) nav._stopPill = mountBinaryPill(nav.querySelector("canvas"), { dark: false, cell: 5, scale: 1.5 });
    paintDevice();
  }
  const key = navKey(path);
  nav.querySelectorAll(".nav-item").forEach((a) => { const on = a.dataset.to === key; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  placeIndicator();
}
function placeIndicator() {
  const list = $("nav").querySelector(".nav-list"); if (!list) return;
  const ind = list.querySelector(".nav-ind"), on = list.querySelector(".nav-item.on");
  if (!on) { ind.style.opacity = "0"; return; }
  const li = on.parentElement;
  const a = on.getBoundingClientRect(), l = list.getBoundingClientRect();
  ind.style.width = a.width + "px"; ind.style.height = a.height + "px";
  ind.style.transform = `translate(${a.left - l.left}px, ${a.top - l.top + (li ? 0 : 0)}px)`; ind.style.opacity = "1";
  if (!navArmed) { navArmed = true; requestAnimationFrame(() => requestAnimationFrame(() => list.classList.remove("still"))); }
}
window.addEventListener("resize", placeIndicator);

// ================================================================ router
const ROUTES = [];
const route = (re, fn) => ROUTES.push([re, fn]);
async function render() {
  const path = (location.hash.slice(1) || "/").split("?")[0];
  if (!mode() && path !== "/welcome") { location.replace("#/welcome"); return; }
  if (path === "/" && mode() === "check") { location.replace("#/check/bottle"); return; }
  S.leave.splice(0).forEach((f) => { try { f(); } catch {} });
  S.onLive = null;
  document.body.dataset.mode = mode();
  const view = $("view");
  let hit = null;
  for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { hit = [fn, m.slice(1)]; break; } }
  if (!hit) { location.replace("#/"); return; }
  view.classList.remove("page-enter"); void view.offsetWidth; view.classList.add("page-enter");
  view.innerHTML = "";
  renderNav(path);
  window.scrollTo(0, 0);
  try { await hit[0](view, ...hit[1].map(decodeURIComponent)); } catch (e) { view.insertAdjacentHTML("beforeend", `<div class="card banner note">Could not load this page: ${esc(e.message)}</div>`); }
  paintDevice();
}
window.addEventListener("hashchange", render);

// ================================================================ sound
function beep(times = 1) {
  if (PREF.sound) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.value = 0.15; o.start(ctx.currentTime + i * 0.3); o.stop(ctx.currentTime + i * 0.3 + 0.18);
      }
    } catch {}
  }
  if (navigator.vibrate) navigator.vibrate(200);
}

// ================================================================ the guided run (page-independent: keeps going if you look at another page)
// idle → water (clean-water check) → add (beep, ~10 s to drop + stir + close) → dissolving (auto stop) → analyzing → result
const Run = {
  phase: "idle", started: 0, recording: false, slow: false, listeners: new Set(),
  set(p) { this.phase = p; this.started = Date.now(); this.slow = false; this.listeners.forEach((f) => f()); },
  async start() {
    await post("/api/run/start", { mode: S.check.runMode });
    this.recording = true; this.set("water");
  },
  onLive(d) {
    const g = d.guide; if (!g) return;
    if (this.phase === "water" && g.phase === "water") {
      if (g.ok) { post("/api/run/mark", { name: "water_ok" }).catch(() => {}); this.set("add"); beep(2); }
      else if (!this.slow && (Date.now() - this.started) / 1000 > 60) { this.slow = true; this.listeners.forEach((f) => f()); }
    }
    if (this.phase === "dissolving" && g.phase === "dissolving" && g.stop) { beep(3); this.finish("auto: " + g.why); }
  },
  async tabletIn() { await post("/api/run/mark", { name: "tablet_in" }); this.set("dissolving"); },
  async finish() {
    if (this.phase === "analyzing") return;
    this.set("analyzing");
    try {
      const r = await post("/api/run/stop", { label: "check", profile_id: S.check.profileId || null });
      this.recording = false;
      await startScan(r.run_id);
    } catch (e) { this.recording = false; toast("Could not stop: " + e.message); this.set("idle"); }
  },
  async cancel() {
    try { await post("/api/run/stop", { label: "cancelled" }); } catch {}
    this.recording = false; this.set("idle");
  },
};
async function startScan(runId) {
  const fd = new FormData();
  fd.append("run_id", runId); fd.append("profile_id", S.check.profileId || "");
  if (S.check.bottle) fd.append("bottle", S.check.bottle);
  if (S.check.imprint) fd.append("imprint", S.check.imprint);
  const r = await api("/api/scans", { method: "POST", body: fd });
  Run.set("idle");
  location.hash = "#/result/" + encodeURIComponent(r.scan_id);
}
function resetCheck() {
  ["bottleUrl", "imprintUrl"].forEach((k) => S.check[k] && URL.revokeObjectURL(S.check[k]));
  Object.assign(S.check, { bottle: null, imprint: null, bottleUrl: "", imprintUrl: "" });
}

// ================================================================ shared bits: result chips, scan capsules
function resultChips(overall, done = true) {
  if (!overall) return `<span class="chip live beat"><span class="dot"></span>${done ? "no result" : "checking…"}</span>`;
  let h = `<span class="chip wash-${RESULT_CLASS[overall]}">${esc(RESULT_TEXT[overall])}</span>`;
  if (overall === "NEEDS_LAB" && mode() === "clinic") h += ` <span class="chip wash-held"><span class="dot" style="background:var(--warm)"></span>held</span>`;
  return h;
}
function capsule(s, i = 0) {
  const cls = !s.overall ? "pending" : s.overall === "NEEDS_LAB" && mode() === "clinic" ? "held" : RESULT_CLASS[s.overall];
  return `<a class="card capsule rise" style="--i:${i}" href="#/result/${encodeURIComponent(s.id)}">
    <span class="cap-icon cap-${cls}" aria-hidden="true"></span>
    <span class="meta"><b>${esc(s.drug || "Unknown medicine")}${s.lot ? " · lot " + esc(s.lot) : ""}</b><small>${esc(s.id)} · ${s.created ? esc(timeAgo(s.created)) : ""}</small></span>
    <span>${resultChips(s.overall, s.done)}</span></a>`;
}
const dateEyebrow = () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// ================================================================ 1. Welcome
route(/^\/welcome$/, (v) => {
  const m = mode();
  v.innerHTML = `<div class="stack welcome">
    <div class="wel-grid">
      <section class="hero ink-panel rise" aria-label="${esc(S.config.app_name)}">
        <canvas class="bpill" aria-label="A capsule drawn in ones and zeros" role="img"></canvas>
        <div class="hero-text">
          <p class="eyebrow">Dissolution screening · ${esc(S.config.app_name)}</p>
          <p class="hero-word">${esc(S.config.app_name)}</p>
          <p class="hero-line">One tablet, one curve, one answer.</p>
          <p class="hero-sub"><span class="typed"></span><span class="caret" aria-hidden="true"></span></p>
        </div>
      </section>
      <section class="modes">
        <div class="row between wrap"><h2 class="title" style="font-size:34px">Who is this for?</h2>${deviceChip()}</div>
        ${[["clinic", "clinic", "Clinic", "I run the gate at a clinic or pharmacy", MODES.clinic.who],
           ["personal", "bottle", "Personal", "I'm checking my own medicine", MODES.personal.who],
           ["check", "sensor", "Check", "Just run a check", MODES.check.who]].map(([k, g, name, line, sub], i) =>
          `<button type="button" class="card mode-card tone-${MODES[k].tone} rise${m === k ? " on" : ""}" style="--i:${i + 1}" data-mode="${k}">
            <span class="gl-box">${glyph(g, 46)}</span>
            <span><span class="eyebrow">${name}</span><h3>${line}</h3><p>${esc(sub)}</p></span>
            <span class="arrow" aria-hidden="true">→</span></button>`).join("")}
        <p class="footnote">You can change this later in Settings. ${esc(DISCLAIMER)}</p>
      </section>
    </div></div>`;
  S.leave.push(mountBinaryPill(v.querySelector(".hero canvas"), { dark: true, cell: 8, scale: 1.9 }));
  v.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
    PREF.mode = b.dataset.mode; navMode = null;
    location.hash = b.dataset.mode === "check" ? "#/check/bottle" : "#/";
  }));
  // typed sub-line
  const el = v.querySelector(".typed"), text = "the box measures how it dissolves · the app explains";
  if (reduceMotion()) el.textContent = text;
  else { let i = 0; const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(t); }, 34); S.leave.push(() => clearInterval(t)); }
});

// ================================================================ 2. Home (per mode; Check mode goes straight to the stepper)
route(/^\/$/, async (v) => {
  const m = mode();
  const scans = await api("/api/scans").catch(() => []);
  scans.sort((a, b) => (b.created || 0) - (a.created || 0));
  if (m === "clinic") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = scans.filter((s) => (s.created || 0) * 1000 >= today.getTime());
    const n = (k) => todays.filter((s) => s.overall === k).length;
    v.innerHTML = `${head({ eyebrow: dateEyebrow(), title: "Today's gate", tone: "sky", side: `<a class="btn" href="#/check/bottle">Start a check</a>` })}
      <section class="counts" aria-label="Today's checks">
        <div class="card count tile rise" style="--accent:var(--mint);--i:0"><span class="num" data-n="${n("PASSED_SCREEN")}">0</span><span class="lbl">Passed the screen</span></div>
        <div class="card count tile rise" style="--accent:var(--warm);--i:1"><span class="num" data-n="${n("NEEDS_LAB")}">0</span><span class="lbl">Needs lab testing · held</span></div>
        <div class="card count tile rise" style="--accent:var(--grey);--i:2"><span class="num" data-n="${n("UNABLE_TO_VERIFY")}">0</span><span class="lbl">Unable to verify</span></div>
      </section>
      <div class="wide-2">
        <section class="card stack rise" style="--i:3"><div class="row between"><h2 class="h">Last checks</h2><a class="footnote" href="#/history">History →</a></div>
          <div class="capsules">${scans.slice(0, 5).map(capsule).join("") || `<p class="muted">No checks yet. Start one: it takes about two minutes.</p>`}</div></section>
        <section class="card ink-panel station rise" style="--i:4">
          <p class="eyebrow">Station</p>
          <canvas class="bpill" style="width:100%;height:150px" role="img" aria-label="Pill printed in ones and zeros"></canvas>
          <div class="row wrap">${deviceChip()}</div>
          <p class="lines">lines read <span data-lines>–</span> · quick test ${S.config.timing.quick_s} s · full ${mmss(S.config.timing.min_s)}–${mmss(S.config.timing.max_s)}</p>
          <a class="btn ghost" href="#/check/bottle">Start a check</a>
        </section>
      </div>
      <p class="disclaimer">${esc(DISCLAIMER)} In Clinic mode a "Needs lab testing" result holds the delivery.</p>`;
    v.querySelectorAll("[data-n]").forEach((el) => countUp(el, +el.dataset.n));
    S.leave.push(mountBinaryPill(v.querySelector(".station canvas"), { dark: true, cell: 7, scale: 1.7 }));
    return;
  }
  const last = scans[0];
  v.innerHTML = `${head({ eyebrow: dateEyebrow(), title: "Check my medicine", tone: "mint" })}
    <section class="card hero-light tone-mint rise" style="background:linear-gradient(160deg, var(--mint-tint), #fff 70%)">
      <div class="stack"><p class="eyebrow">About two minutes</p><h2>Is this tablet dissolving the way it should?</h2>
        <p class="muted">Photograph the bottle and one tablet, then let the box watch one tablet dissolve for a minute.</p>
        <div class="actions"><a class="btn" href="#/check/bottle">Check my medicine</a></div></div>
      <div class="row" style="justify-content:center">${glyph("bottle", 96)}${glyph("tablet", 80)}</div>
    </section>
    <section class="card stack rise" style="--i:1"><div class="row between"><h2 class="h">Your last check</h2><a class="footnote" href="#/history">History →</a></div>
      ${last ? `<div class="capsules">${capsule(last)}</div>` : `<p class="muted">Nothing checked yet.</p>`}</section>
    <section class="stack"><h2 class="h">How it works</h2><div class="how">
      ${[["bottle", "Bottle", "A photo of the label. Your name and pharmacy details are removed."], ["tablet", "Tablet", "A close photo of one tablet so the imprint is readable."],
         ["cup", "Measure", "One tablet in clean water. Light through the cup shows how it dissolves."], ["pharmacist", "Result", "One of three answers, with the reasons and the sources."]]
        .map(([g, t, p], i) => `<div class="card rise" style="--i:${i + 2}">${glyph(g, 44)}<span class="step-n">0${i + 1}</span><h3>${t}</h3><p>${p}</p></div>`).join("")}
    </div></section>
    <p class="disclaimer">${esc(DISCLAIMER)} If the result is not "Passed the screen", show it to a pharmacist.</p>`;
});

// ================================================================ boot
async function boot() {
  try {
    const c = await api("/api/config");
    Object.assign(S.config, c); if (!c.timing) S.config.timing = { blank_s: 10, min_s: 120, max_s: 600, quick_s: 60 };
    $("appName").textContent = c.app_name; document.title = c.app_name;
  } catch {}
  render();
  tick(); setInterval(tick, 500);
}
boot();
