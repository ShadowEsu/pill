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
/** Only http(s) URLs become links (sources come from model output and lookups). */
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
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
  get speak() { const v = localStorage.getItem("pillgate.speak"); return v ? v === "on" : PREF.easy; },   // Easy mode reads aloud unless switched off
  get easy() { return localStorage.getItem("pillgate.easy") === "on"; },
  set easy(v) { localStorage.setItem("pillgate.easy", v ? "on" : "off"); document.body.classList.toggle("easy", !!v); },
  set speak(v) { localStorage.setItem("pillgate.speak", v ? "on" : "off"); },
  reset() {   // preferences only: the schedule and its log are the person's data and stay
    const keep = ["pillgate.schedule", "pillgate.takelog", "pillgate.remind", "pillgate.notified"];
    Object.keys(localStorage).filter((k) => k.startsWith("pillgate.") && !keep.includes(k)).forEach((k) => localStorage.removeItem(k));
    document.body.classList.remove("easy");
  },
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
  if (S.live && !Run.recording && S.live.status && S.live.status.recording) await Run.adopt(S.live);
  if (S.live && Run.recording) Run.onLive(S.live);
  if (S.onLive && S.live) S.onLive(S.live);
  paintRunBar();
}

// ================================================================ nav
const ICONS = {
  gate: "M4 20V9l8-5 8 5v11M9 20v-6h6v6",
  home: "M4 11l8-6 8 6v9H4zM10 20v-5h4v5",
  check: "M9 4.5a4.5 4.5 0 0 1 6.4 0l4.1 4.1a4.5 4.5 0 0 1-6.4 6.4l-8.6-8.6zM10.9 10.9l-4.4 4.4a4.5 4.5 0 0 0 6.4 6.4l4.4-4.4",
  history: "M3 18c3 0 4-11 7-11s3 7 5 7 2-3 6-3",
  profiles: "M5 6h14M5 12h14M5 18h9",
  atlas: "M12 4a3 3 0 1 1 0 .1zM5 17a2.5 2.5 0 1 1 0 .1zM19 17a2.5 2.5 0 1 1 0 .1zM10.6 6.6l-4 8.2M13.4 6.6l4 8.2M7.5 17.5h9",
  medicines: "M8.5 3h7v3.2h-7zM7 6.2h10V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM9.8 13.6h4.4M12 11.4v4.4",
  schedule: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.6V12l3 2",
  more: "M5 10.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM12 10.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM19 10.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  settings: "M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7",
};
const NAV = {
  clinic: [["/", "Gate", "gate"], ["/check/bottle", "Check", "check"], ["/history", "History", "history"], ["/profiles", "Profiles", "profiles"], ["/atlas", "Atlas", "atlas"]],
  personal: [["/", "Home", "home"], ["/check/bottle", "Check", "check"], ["/medicines", "Medicines", "medicines"], ["/schedule", "Schedule", "schedule"], ["/more", "More", "more"]],
  check: [["/check/bottle", "Check", "check"], ["/history", "History", "history"], ["/profiles", "Profiles", "profiles"], ["/atlas", "Atlas", "atlas"], ["/settings", "Settings", "settings"]],
};
const navKey = (path) => (/^\/(check|result|ask|issue)\b/.test(path) ? "/check/bottle"
  : mode() === "personal" && /^\/(history|profiles|atlas|settings)$/.test(path) ? "/more" : path);
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
  if (/^\/check\/(bottle|tablet)$/.test(path) && (Run.recording || Run.phase === "analyzing")) { location.replace("#/check/measure"); return; }   // mid-run "Check" goes back to the run
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
  Dock.place(path);
  window.scrollTo(0, 0);
  paintRunBar();
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
// One global poller (tick, 2×/s) drives it on every page, so you can open History or Profiles mid-run: the auto stop and the
// scan still happen. A small marker in sessionStorage lets a reloaded tab re-attach to its own recording (never another tab's).
const RUN_KEY = "pillgate.run";
const Run = {
  phase: "idle", started: 0, recording: false, slow: false, stopping: false, listeners: new Set(),
  dissolveS: 0, readyScan: null,            // elapsed seconds for the run bar; a scan made while you were on another page
  set(p) { this.phase = p; this.started = Date.now(); this.slow = false; this.save(); this.listeners.forEach((f) => f()); paintRunBar(); },
  save() {
    try {
      if (this.recording) sessionStorage.setItem(RUN_KEY, JSON.stringify({ phase: this.phase, runMode: S.check.runMode, profileId: S.check.profileId, continuedAt: this.continuedAt || null }));
      else sessionStorage.removeItem(RUN_KEY);
    } catch {}
  },
  async start() {
    await post("/api/run/start", { mode: S.check.runMode });
    this.recording = true; this.stopping = false; this.continuedAt = null; this.readyScan = null; this.set("water");
  },
  /** The server is recording but this page doesn't know it (reload): re-attach if this tab started it. */
  async adopt(d) {
    let m = null; try { m = JSON.parse(sessionStorage.getItem(RUN_KEY) || "null"); } catch {}
    if (!m || this.adopting) return;
    this.adopting = true;
    Object.assign(S.check, { runMode: m.runMode || "quick", profileId: m.profileId || "" });
    await Photos.restore();
    this.recording = true; this.stopping = false; this.continuedAt = m.continuedAt;
    this.set(d.guide && d.guide.phase === "dissolving" ? "dissolving" : m.phase === "add" ? "add" : "water");
    this.adopting = false;
  },
  onLive(d) {
    const g = d.guide; if (!g) return;
    if (this.phase === "water" && g.phase === "water") {
      if (g.ok) { post("/api/run/mark", { name: "water_ok" }).catch(() => {}); this.set("add"); beep(2); }
      else if (!this.slow && (Date.now() - this.started) / 1000 > 60) { this.slow = true; this.listeners.forEach((f) => f()); }
    }
    if (g.phase === "dissolving") this.dissolveS = g.elapsed_s || 0;
    if (this.phase === "dissolving" && g.phase === "dissolving" && g.stop) { beep(3); this.finish("auto: " + g.why); }
  },
  async tabletIn() { await post("/api/run/mark", { name: "tablet_in" }); this.continuedAt = Date.now(); this.set("dissolving"); },
  async finish() {
    if (this.stopping || this.phase === "analyzing") return;      // one stop per run, whichever page asked
    this.stopping = true;
    this.set("analyzing");
    try {
      const r = await post("/api/run/stop", { label: "check", profile_id: S.check.profileId || null });
      this.recording = false; this.save();
      await startScan(r.run_id);
    } catch (e) { this.recording = false; this.save(); toast("Could not stop: " + e.message); this.set("idle"); }
    this.stopping = false;
  },
  async cancel() {
    this.stopping = true;
    try { await post("/api/run/stop", { label: "cancelled" }); } catch {}
    this.recording = false; this.stopping = false; this.set("idle");
  },
};
const onPath = (re) => re.test((location.hash.slice(1) || "/").split("?")[0]);
/** Slim sticky bar on every page except Measure while a run is going, then "Result ready" once its scan exists. */
function paintRunBar() {
  const bar = $("runbar"); if (!bar) return;
  const show = (cls, html) => {             // only touch the DOM when the words change (it runs 2×/s)
    if (bar.className !== cls) bar.className = cls;
    if (bar._html !== html) { bar._html = html; bar.innerHTML = html; }
    if (bar.hidden) { document.documentElement.style.setProperty("--top-h", $("topbar").offsetHeight + "px"); bar.hidden = false; }
  };
  const onMeasure = onPath(/^\/check\/measure$/);
  if (Run.recording || Run.phase === "analyzing") {
    if (onMeasure) { bar.hidden = true; return; }
    const T = S.config.timing, g = S.live && S.live.guide;
    const what = Run.phase === "water" ? `Clean water ${g && g.phase === "water" ? `${Math.floor(g.steady_s || 0)}/${g.needed || T.blank_s} s` : ""}`
      : Run.phase === "add" ? "Add the tablet now"
      : Run.phase === "dissolving" ? `Dissolving ${mmss(Run.dissolveS)}${S.check.runMode === "quick" ? " of " + mmss(T.quick_s) : ""}`
      : "Building the result…";
    show("runbar" + (Run.phase === "add" ? " urgent" : ""), `<span class="rb-dot" aria-hidden="true"></span><span class="rb-text"><b>Run in progress</b> · ${esc(what)}</span><a class="rb-go" href="#/check/measure">↩ back to the run</a>`);
    return;
  }
  if (Run.readyScan && onPath(new RegExp("^/result/" + Run.readyScan.replace(/[^\w-]/g, "") + "$"))) Run.readyScan = null;   // seen it
  if (Run.readyScan) {
    show("runbar ready", `<span class="rb-dot" aria-hidden="true"></span><span class="rb-text" role="status"><b>Result ready</b> · your check finished</span><a class="rb-go" href="#/result/${encodeURIComponent(Run.readyScan)}">Open result →</a>`);
    return;
  }
  bar.hidden = true;
}
async function startScan(runId) {
  const fd = new FormData();
  fd.append("run_id", runId); fd.append("profile_id", S.check.profileId || "");
  if (S.check.bottle) fd.append("bottle", S.check.bottle);
  if (S.check.imprint) fd.append("imprint", S.check.imprint);
  const r = await api("/api/scans", { method: "POST", body: fd });
  S.check.scanId = r.scan_id;
  Photos.clear();
  const stayed = onPath(/^\/check\//);          // still on the check flow: go straight to the result
  Run.readyScan = stayed ? null : r.scan_id;      // elsewhere (History, Profiles…): don't yank the page, show "Result ready"
  Run.set("idle");
  if (stayed) location.hash = "#/result/" + encodeURIComponent(r.scan_id);
}
// Photos survive a reload during a run (IndexedDB holds the File blobs; sessionStorage can't). Best effort: failures are silent.
const Photos = {
  db() { return new Promise((ok, bad) => { const q = indexedDB.open("pillgate", 1); q.onupgradeneeded = () => q.result.createObjectStore("photos"); q.onsuccess = () => ok(q.result); q.onerror = () => bad(q.error); }); },
  async put(key, file) { try { const d = await this.db(); d.transaction("photos", "readwrite").objectStore("photos").put(file || null, key); } catch {} },
  async restore() {
    try {
      const d = await this.db();
      const get = (k) => new Promise((ok) => { const q = d.transaction("photos").objectStore("photos").get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); });
      for (const k of ["bottle", "imprint"]) { const f = await get(k); if (f && !S.check[k]) { S.check[k] = f; S.check[k + "Url"] = URL.createObjectURL(f); } }
    } catch {}
  },
  clear() { this.put("bottle", null); this.put("imprint", null); },
};
function resetCheck() {
  Photos.clear();
  ["bottleUrl", "imprintUrl"].forEach((k) => S.check[k] && URL.revokeObjectURL(S.check[k]));
  Object.assign(S.check, { bottle: null, imprint: null, bottleUrl: "", imprintUrl: "", scanId: null });
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
    <span class="cap-chips">${resultChips(s.overall, s.done)}</span></a>`;
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
          <p class="hero-sub"><span class="ghost" aria-hidden="true">the box measures how it dissolves · the app explains</span><span class="typed-line"><span class="typed"></span><span class="caret" aria-hidden="true"></span></span></p>
        </div>
      </section>
      <section class="modes">
        <div class="stack" style="gap:8px"><h2 class="title" style="font-size:34px">Who is this for?</h2><div class="chip-line">${deviceChip()}</div></div>
        ${[["clinic", "clinic", "Clinic", "I run the gate at a clinic or pharmacy", MODES.clinic.who],
           ["personal", "bottle", "Personal", "I'm checking my own medicine", MODES.personal.who],
           ["check", "sensor", "Check", "Just run a check", MODES.check.who]].map(([k, g, name, line, sub], i) =>
          `<button type="button" class="card mode-card tone-${MODES[k].tone} rise${m === k ? " on" : ""}" style="--i:${i + 1}" data-mode="${k}">
            <span class="gl-box">${glyph(g, 46)}</span>
            <span><span class="eyebrow">${name}</span><h3>${line}</h3><p>${esc(sub)}</p></span>
            <span class="arrow" aria-hidden="true">→</span></button>`).join("")}
        <p class="footnote">You can change this later in Settings. ${esc(DISCLAIMER)}</p>
      </section>
    </div>
    <section class="card how-strip rise" style="--i:4" aria-label="How a check works">
      <p class="eyebrow">How a check works</p>
      <ol>${[["bottle", "Photo", "the bottle and one tablet"], ["cup", `Water ${S.config.timing.blank_s} s`, "clean water, lid closed, steady"], ["tablet", "Tablet in", "drop, stir 5 circles, close, Continue"], ["sensor", `${S.config.timing.quick_s} s`, "light through the cup as it dissolves"]]
        .map(([g, t, sub], i) => `<li style="--i:${i}">${glyph(g, 40)}<span><b>${t}</b><small>${sub}</small></span></li>`).join("")}
        <li class="answers" style="--i:4"><span><b>Three answers</b><span class="row wrap" style="gap:6px;margin-top:4px"><span class="chip wash-pass">Passed the screen</span><span class="chip wash-lab">Needs lab testing</span><span class="chip wash-unable">Unable to verify</span></span></span></li>
      </ol>
    </section></div>`;
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
    const [profiles, runs] = await Promise.all([api("/api/profiles").catch(() => []), api("/api/runs").catch(() => [])]);
    const lastRun = runs.length ? await api("/api/runs/" + encodeURIComponent(runs[0].id)).catch(() => null) : null;
    const refs = profiles.filter((p) => p.reference);
    const words = refs.flatMap((p) => (p.match_names || []).map((w) => w.toLowerCase()));
    const drugs = [...new Set(scans.map((x) => x.drug).filter(Boolean))];
    const missing = drugs.filter((d) => !words.some((w) => d.toLowerCase().includes(w)));
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
        <div class="stack">
        <section class="card ink-panel station rise" style="--i:4">
          <div class="row between"><p class="eyebrow">Station</p><span class="lines">quick ${S.config.timing.quick_s} s · full ${mmss(S.config.timing.min_s)}–${mmss(S.config.timing.max_s)}</span></div>
          <canvas class="bpill" style="width:100%;height:120px" role="img" aria-label="Pill printed in ones and zeros"></canvas>
          <div class="row wrap">${deviceChip()}</div>
          <dl class="st-stats"><div><dt>lines read</dt><dd data-lines>–</dd></div><div><dt>last run</dt><dd>${lastRun && lastRun.created ? esc(timeAgo(lastRun.created)) : "none yet"}</dd></div><div><dt>runs saved</dt><dd>${runs.length}</dd></div></dl>
        </section>
        <section class="card stack tile rise" style="--accent:var(--violet);--i:5">
          <div class="row between"><h2 class="h">Reference profiles</h2><a class="footnote" href="#/profiles">Profiles →</a></div>
          <p><span class="num" style="font-size:34px" data-n="${refs.length}">0</span> <span class="muted">with a reference · ${profiles.length} in total${refs.some((p) => p.demo) ? ` · ${refs.filter((p) => p.demo).length} simulated demo` : ""}</span></p>
          ${missing.map((d) => `<p class="banner note">${esc(d)} has no reference profile yet: record 3 runs to build one.</p>`).join("")}
        </section>
        </div>
      </div>
      <p class="disclaimer">${esc(DISCLAIMER)} In Clinic mode a "Needs lab testing" result holds the delivery.</p>`;
    v.querySelectorAll("[data-n]").forEach((el) => countUp(el, +el.dataset.n));
    S.leave.push(mountBinaryPill(v.querySelector(".station canvas"), { dark: true, cell: 7, scale: 1.7 }));
    return;
  }
  const last = scans[0], nextDose = Sched.next();
  v.innerHTML = `${head({ eyebrow: dateEyebrow(), title: "Check my medicine", tone: "mint" })}
    <section class="card hero-light tone-mint rise" style="background:linear-gradient(160deg, var(--mint-tint), #fff 70%)">
      <div class="stack"><p class="eyebrow">About two minutes</p><h2>Is this tablet dissolving the way it should?</h2>
        <p class="muted">Photograph the bottle and one tablet, then let the box watch one tablet dissolve for a minute.</p>
        <div class="actions"><a class="btn" href="#/check/bottle">Check my medicine</a></div></div>
      <div class="row" style="justify-content:center">${glyph("bottle", 96)}${glyph("tablet", 80)}</div>
    </section>
    <div class="wide-2">
      <section class="card stack rise" style="--i:1"><div class="row between"><h2 class="h">Your last check</h2><a class="footnote" href="#/medicines">My medicines →</a></div>
        ${last ? `<div class="capsules">${capsule(last)}</div>` : `<p class="muted">Nothing checked yet.</p>`}</section>
      <section class="card stack tile rise" style="--accent:var(--sky);--i:2"><div class="row between"><h2 class="h">Next dose</h2><a class="footnote" href="#/schedule">Schedule →</a></div>
        ${nextDose ? `<p class="next-dose"><span class="mono">${esc(fmtTime(nextDose.t))}</span><b>${esc(nextDose.m.name)}</b>${nextDose.m.dose ? `<small>${esc(nextDose.m.dose)}</small>` : ""}</p>` : `<p class="muted">${Sched.meds.length ? "All of today's doses are marked." : "Add your medicines and times to get a daily list and reminders."}</p>`}</section>
    </div>
    <button type="button" class="card easy-btn rise" style="--i:3" id="easy-btn" aria-pressed="${PREF.easy}"><span class="easy-aa" aria-hidden="true">Aa</span>
      <span><b>${PREF.easy ? "Easy mode is on" : "Turn on Easy mode"}</b><small>Bigger text, stronger contrast, answers read aloud.${PREF.easy ? " Tap to turn it off." : ""}</small></span></button>
    <section class="stack"><h2 class="h">How it works</h2><div class="how">
      ${[["bottle", "Bottle", "A photo of the label. Your name and pharmacy details are removed."], ["tablet", "Tablet", "A close photo of one tablet so the imprint is readable."],
         ["cup", "Measure", "One tablet in clean water. Light through the cup shows how it dissolves."], ["pharmacist", "Result", "One of three answers, with the reasons and the sources."]]
        .map(([g, t, p], i) => `<div class="card rise" style="--i:${i + 2}">${glyph(g, 44)}<span class="step-n">0${i + 1}</span><h3>${t}</h3><p>${p}</p></div>`).join("")}
    </div></section>
    <p class="disclaimer">${esc(DISCLAIMER)} If the result is not "Passed the screen", show it to a pharmacist.</p>`;
  $("easy-btn").onclick = () => { PREF.easy = !PREF.easy; toast(PREF.easy ? "Easy mode on" : "Easy mode off"); render(); };
});

// ================================================================ check flow: shared pieces
const STEPS = ["Bottle", "Tablet", "Measure", "Result"];
const stepsRail = (on) => `<ol class="steps" aria-label="Check steps">${STEPS.map((s, i) => `<li class="${i < on ? "done" : i === on ? "on" : ""}"${i === on ? ' aria-current="step"' : ""}><i></i>${s}</li>`).join("")}</ol>`;
function viewfinderPage(v, { key, step, title, eyebrow, tone, tips, next, back, hint }) {
  const has = !!S.check[key];
  v.innerHTML = `${head({ eyebrow, title, tone, back })}${stepsRail(step)}
    <div class="vf-wrap">
      <label class="vf${has ? " has-photo" : ""}" for="file-${key}">
        <input type="file" accept="image/*" capture="environment" id="file-${key}">
        ${has ? `<img alt="Your photo" src="${esc(S.check[key + "Url"])}">` : ""}
        <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
        <span class="scan" aria-hidden="true"></span>
        <span class="vf-hint"><span class="eyebrow">Tap to open the camera</span><b>${esc(hint)}</b></span>
        ${has ? `<span class="chip ok vf-tag"><span class="dot"></span>photo ready</span>` : ""}
      </label>
      <section class="card stack tone-${tone}">
        <ul class="tips">${tips.map((t) => `<li><span>${t}</span></li>`).join("")}</ul>
        <div class="actions">
          <label class="btn ghost" for="file-${key}">${has ? "Retake" : "Take or choose a photo"}</label>
          <a class="btn" href="#${next}" id="vf-next">${has ? "Use this photo" : "Next"}</a>
        </div>
        <button type="button" class="btn ghost sm" id="vf-skip" style="align-self:flex-start">Skip this photo</button>
      </section>
    </div>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>`;
  v.querySelector(`#file-${key}`).addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (S.check[key + "Url"]) URL.revokeObjectURL(S.check[key + "Url"]);
    S.check[key] = f; S.check[key + "Url"] = URL.createObjectURL(f); Photos.put(key, f);
    viewfinderPage(v, { key, step, title, eyebrow, tone, tips, next, back, hint });
  });
  v.querySelector("#vf-skip").onclick = () => {
    if (S.check[key + "Url"]) URL.revokeObjectURL(S.check[key + "Url"]);
    S.check[key] = null; S.check[key + "Url"] = ""; Photos.put(key, null); location.hash = "#" + next;
  };
}

// ================================================================ 3. Bottle
route(/^\/check\/bottle$/, (v) => viewfinderPage(v, {
  key: "bottle", step: 0, tone: "sky", eyebrow: "Step 1 of 4 · the bottle", title: "Photograph the bottle", hint: "Label facing the camera",
  back: mode() === "check" ? null : "#/", next: "/check/tablet",
  tips: ["Label facing the camera, the whole label in the frame.", "Drug name, strength, lot and expiry are read from it.",
         "<b>Privacy:</b> personal details (your name, pharmacy, Rx number) are removed before anything is stored."],
}));

// ================================================================ 4. Tablet
route(/^\/check\/tablet$/, (v) => viewfinderPage(v, {
  key: "imprint", step: 1, tone: "mint", eyebrow: "Step 2 of 4 · one tablet", title: "Photograph one tablet", hint: "One tablet, imprint up",
  back: "#/check/bottle", next: "/check/measure",
  tips: ["One tablet on a plain background, close up.", "The imprint (letters or numbers stamped on it) should be readable.",
         "Marked on both sides? Photograph the side with more marks first; the photo describes imprint, colour and shape, it does not guess the drug."],
}));

// ================================================================ 5. Measure (the guided run as a phase rail)
const LINE = { A_B: "#4FB3FF", A_W: "#9AA0A6", A_G: "#5FD39A", A_R: "#E09A3A", A_side: "#7A5CFF", A_specific: "#16181B" };
const SERIES = [["A_B", "blue"], ["A_W", "white"], ["A_G", "green"], ["A_R", "red (reference)"], ["A_side", "cloudiness (side sensor)"], ["A_specific", "colour only (blue − red)"]];
const checkpointPlugin = {
  id: "checkpoints",
  afterDatasetsDraw(chart, _a, opts) {
    const xs = opts && opts.at; if (!xs || !xs.length) return;
    const { ctx, chartArea: a, scales: { x, y } } = chart;
    // the signal line the checkpoints are judged on (dashed "colour only" / cloudiness line, else the first line)
    const ds = chart.data.datasets.find((d) => d.borderDash && d.borderDash.length && d.label !== "reference") || chart.data.datasets[0];
    const pts = ds ? ds.data : [];
    const lastT = pts.length ? pts[pts.length - 1].x : -1;
    const yAt = (t) => { let best = null; for (const p of pts) { if (p.x > t) break; best = p; } return best ? best.y : null; };
    ctx.save();
    xs.forEach((t) => {
      const px = x.getPixelForValue(t); if (px < a.left || px > a.right) return;
      ctx.strokeStyle = "rgba(22,24,27,.12)"; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.setLineDash([]);
      const v = t <= lastT ? yAt(t) : null;
      if (v !== null) {          // reached: a filled dot sitting on the curve
        const py = Math.max(a.top, Math.min(a.bottom, y.getPixelForValue(v)));
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fillStyle = "#16181B"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      } else {                   // still to come: a hollow dot on the top rail
        ctx.beginPath(); ctx.arc(px, a.top + 4, 3.2, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(22,24,27,.45)"; ctx.stroke();
      }
    });
    ctx.restore();
  },
};
function makeChart(canvas, { checkpoints = null, xTitle = "seconds after tablet in" } = {}) {
  if (!window.Chart) return null;
  const mono = { family: "JetBrains Mono, ui-monospace, Menlo, monospace", size: 10.5 };
  return new Chart(canvas, {
    type: "line", data: { datasets: [] }, plugins: [checkpointPlugin],
    options: {
      animation: false, maintainAspectRatio: false, parsing: false, normalized: true,
      scales: {
        x: { type: "linear", min: checkpoints ? 0 : undefined, max: checkpoints ? checkpoints[checkpoints.length - 1] : undefined, title: { display: true, text: xTitle, color: "#7C8188", font: mono }, ticks: { color: "#7C8188", font: mono }, grid: { color: "rgba(22,24,27,.06)" }, border: { color: "rgba(22,24,27,.12)" } },
        y: { title: { display: true, text: "absorbance", color: "#7C8188", font: mono }, ticks: { color: "#7C8188", font: mono }, grid: { color: "rgba(22,24,27,.06)" }, border: { color: "rgba(22,24,27,.12)" } },
      },
      plugins: { legend: { labels: { color: "#16181B", boxWidth: 10, boxHeight: 2, padding: 8, font: { family: "Inter, system-ui, sans-serif", size: 11 } } }, checkpoints: { at: checkpoints }, tooltip: { enabled: false } },
      elements: { point: { radius: 0 }, line: { borderWidth: 2, tension: 0.25 } },
    },
  });
}
function setCurve(chart, curve, extra = []) {
  if (!chart) return;
  const t = curve.t || [];
  chart.data.datasets = SERIES.filter(([k]) => curve[k]).map(([k, label]) => ({
    label: k === "A_specific" && curve.signal === "cloud" ? "cloudiness (red light)" : k === "A_specific" && curve.signal === "scatter" ? "cloudiness (side sensor)" : label,
    borderColor: LINE[k], backgroundColor: LINE[k], borderDash: k === "A_specific" ? [6, 4] : [],
    data: t.map((x, i) => ({ x, y: curve[k][i] })).filter((p) => p.y !== null && p.y !== undefined),
  })).concat(extra);
  chart.update();
}
const tickSvg = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.3 2.3 4.7-5" pathLength="1"/></svg>`;
const crossSvg = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5"/></svg>`;
// guide.water_check() check names → the headline for each row; the backend message is the one-line reason under it
const CHECK_NAME = { dark: "Lid closed", range: "Sensor in range", light: "Light reaches the sensor", steady: "Steady", reference: "Same as your last clean water" };
const RAW_COLS = [["dark", "dark"], ["B", "blue"], ["W", "white"], ["R", "red"]];
/** Raw ADC counts from the board: A0 = LDR A (light through the cup), A1 = LDR B (side, 90°). */
function rawTable(raw) {
  const cell = (k) => { const v = raw ? raw[k] : null; return v === null || v === undefined || v === "" || isNaN(+v) ? "–" : String(Math.round(+v)); };
  return `<table class="raw"><thead><tr><th></th>${RAW_COLS.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>
    <tr><th>A0 <small>through</small></th>${RAW_COLS.map(([c]) => `<td>${cell(c + "_a")}</td>`).join("")}</tr>
    <tr><th>A1 <small>side 90°</small></th>${RAW_COLS.map(([c]) => `<td>${cell(c + "_b")}</td>`).join("")}</tr></tbody></table>`;
}
const ringHtml = (id, color) => `<div class="ring" id="${id}" style="--rc:${color}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/><circle class="glow" cx="60" cy="60" r="52" pathLength="100" stroke-dashoffset="100"/><circle class="val" cx="60" cy="60" r="52" pathLength="100" stroke-dashoffset="100"/></svg><div class="ring-txt"><span class="num">0</span><small></small></div></div>`;
function setRing(el, frac, big, small) {
  if (!el) return;
  const off = String(100 - Math.max(0, Math.min(1, frac)) * 100);
  el.querySelectorAll(".val, .glow").forEach((c) => c.setAttribute("stroke-dashoffset", off));
  el.querySelector(".num").textContent = big; el.querySelector("small").textContent = small;
}
const PHASES = [["prep", "Prepare", "checks"], ["water", "Water", null], ["add", "Tablet in", "≈ 10 s"], ["dissolve", "Dissolving", null], ["stop", "Result", "auto"]];
const PHASE_INDEX = { idle: 0, water: 1, add: 2, dissolving: 3, analyzing: 4 };
const PHASE_TITLE = { idle: "Prepare", water: "Clean water", add: "Add the tablet", dissolving: "Dissolving", analyzing: "Analyzing" };

route(/^\/check\/measure$/, async (v) => {
  const T = S.config.timing;
  const [profiles, runs] = await Promise.all([api("/api/profiles").catch(() => []), api("/api/runs").catch(() => [])]);
  const usable = profiles.filter((p) => p.calibration || p.reference);
  let chart = null, countdown = null;
  const dissolveLabel = () => (S.check.runMode === "quick" ? `${T.quick_s} s` : `${mmss(T.min_s)}–${mmss(T.max_s)}`);
  v.innerHTML = `<div id="m-head"></div>${stepsRail(2)}
    <section class="card rail" aria-label="Run phases">
      <div class="rail-top"><span class="row" style="gap:12px;align-items:baseline"><span class="eyebrow" id="r-n"></span><span class="serif" id="r-name"></span></span>
        <span class="mono small" id="r-time"></span></div>
      <ol class="rail-list" id="r-list"></ol>
    </section>
    <div class="wide-2">
      <section class="card scene" id="scene" aria-live="polite"></section>
      <div class="stack">
        <section class="card stack" id="chart-card" hidden>
          <div class="row between"><h2 class="h">Live curve</h2><span class="chip live beat"><span class="dot"></span>recording</span></div>
          <div class="chartbox"><canvas id="live-chart"></canvas></div>
          <p class="legend-note">Absorbance (0 = clear water). Blue rising faster than red means colour; the violet side-sensor line rises when the water turns cloudy (white tablets like aspirin).${S.check.runMode === "quick" ? " Dots mark the 12 checkpoints compared with the reference." : ""}</p>
        </section>
        <section class="card stack">
          <div class="row between wrap"><h2 class="h">Device</h2>${deviceChip()}</div>
          <dl class="live-stats"><div><dt>lines read</dt><dd data-lines>–</dd></div><div><dt>seconds</dt><dd id="l-sec">–</dd></div><div><dt>samples</dt><dd id="l-n">–</dd></div></dl>
          <div id="raw" class="raw-wrap">${rawTable(null)}</div>
          <p class="footnote">Raw counts from the board, newest line. A0 = light through the cup, A1 = side sensor at 90°.</p>
          <p class="footnote" id="l-in"></p>
        </section>
        <details class="card alt">
          <summary>No live connection? Paste data or reuse a run</summary>
          <div class="stack">
            <textarea id="paste" rows="5" placeholder="Paste the Arduino Serial Monitor text here (Ctrl+A, Ctrl+C in the Serial Monitor)"></textarea>
            <button type="button" class="btn ghost sm" id="btn-paste">Use pasted data</button>
            <select id="old-run" aria-label="Saved run"><option value="">…or pick a saved run</option>${runs.map((r) => `<option value="${esc(r.id)}">${esc(r.label)} · ${r.samples} samples · ${esc(r.id)}</option>`).join("")}</select>
            <button type="button" class="btn ghost sm" id="btn-old">Use this run</button>
          </div>
        </details>
      </div>
    </div>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>`;

  const drawRail = () => {
    const i = PHASE_INDEX[Run.phase];
    $("m-head").innerHTML = head({ eyebrow: "Step 3 of 4 · measure", title: PHASE_TITLE[Run.phase], tone: ["mint", "sky", "violet", "sky", "grey"][i], back: Run.recording ? null : "#/check/tablet" });
    $("r-n").textContent = `${i + 1} of 5`; $("r-name").textContent = PHASE_TITLE[Run.phase];
    $("r-list").innerHTML = PHASES.map(([k, name, tm], j) => `<li class="p-${k} ${j < i ? "done" : j === i ? "on" : ""}"${j === i ? ' aria-current="step"' : ""}>
      <span class="bar">${j < i ? tickSvg : ""}</span><span class="nm">${name}</span><span class="tm">${tm || (k === "water" ? `${T.blank_s} s` : dissolveLabel())}</span></li>`).join("");
  };
  const scene = $("scene");
  const drawScene = () => {
    clearInterval(countdown);
    const p = Run.phase;
    $("chart-card").hidden = p !== "dissolving";
    if (p !== "dissolving" && chart) { chart.destroy(); chart = null; }
    if (p === "idle") {
      scene.innerHTML = `${glyph("cup", 84)}
        <p class="serif big">Clean water first</p>
        <p class="lead">Fill the clear cup with clean water to the marked line, put it in the chamber and close the lid. Then press <b>Start</b>.</p>
        <div class="mode-pick" role="group" aria-label="Test length" style="width:100%;max-width:520px">
          <button type="button" class="mode-opt" data-run="quick" aria-pressed="${S.check.runMode === "quick"}"><b>Quick · ${T.quick_s} s</b><small>${T.quick_s} s after the tablet goes in</small></button>
          <button type="button" class="mode-opt" data-run="full" aria-pressed="${S.check.runMode === "full"}"><b>Full · ${mmss(T.min_s)}–${mmss(T.max_s)}</b><small>stops when the curve flattens</small></button>
        </div>
        <label class="field" style="width:100%;max-width:520px;text-align:left">Product profile
          <select id="profile"><option value="">Auto-match from the bottle label${S.config.ai ? "" : " (needs the AI key)"}</option>
          ${usable.map((p) => `<option value="${esc(p.id)}"${p.id === S.check.profileId ? " selected" : ""}>${p.demo ? "[DEMO - simulated] " : ""}${esc(p.name)}${p.mode === "any" ? "" : " · " + esc(p.mode)}</option>`).join("")}</select></label>
        ${S.config.ai ? "" : `<p class="banner note" style="max-width:520px;text-align:left">AI is in mock mode on this server: the photos are not read and the profile can't be matched automatically, so pick one here.</p>`}
        <div class="row wrap" style="justify-content:center">
          <span class="chip ${S.check.bottle ? "ok" : ""}"><span class="dot"></span>bottle ${S.check.bottle ? "photo ready" : "skipped"}</span>
          <span class="chip ${S.check.imprint ? "ok" : ""}"><span class="dot"></span>tablet ${S.check.imprint ? "photo ready" : "skipped"}</span>
        </div>
        <button type="button" class="btn" id="btn-start" style="min-width:220px">Start</button>`;
      scene.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => { S.check.runMode = b.dataset.run; drawRail(); drawScene(); }));
      $("profile").onchange = (e) => (S.check.profileId = e.target.value);
      $("btn-start").onclick = async (e) => { e.target.disabled = true; try { await Run.start(); } catch (err) { toast("Could not start: " + err.message); e.target.disabled = false; } };
    }
    if (p === "water") {
      scene.innerHTML = `${ringHtml("ring", "var(--sky)")}<p class="serif big">Checking the water…</p>
        <p class="lead" id="w-text">Keep the lid closed and don't touch the box.</p><ul class="checks" id="w-checks"></ul>
        <div class="row wrap" style="justify-content:center"><button type="button" class="btn hidden" id="btn-anyway">Continue anyway</button><button type="button" class="btn ghost" id="btn-cancel">Cancel</button></div>`;
      setRing($("ring"), 0, "0", `of ${T.blank_s} s steady`);
      if (Run.slow) { $("w-text").innerHTML = "Still not steady after a minute. Check the lid is closed and nothing moves, or press <b>Continue anyway</b> (the result may be less reliable)."; $("btn-anyway").classList.remove("hidden"); }
      $("btn-anyway").onclick = () => Run.tabletIn();
    }
    if (p === "add") {
      scene.innerHTML = `${ringHtml("ring", "var(--violet)")}<p class="serif big">Add the tablet now</p>
        <p class="lead">Water looks good. <b>Lift the lid, drop the tablet in the middle, stir 5 slow circles with the stick, take the stick out and close the lid, all within about 10 seconds.</b> Then press <b>Continue</b> right away.</p>
        <div class="row wrap" style="justify-content:center"><button type="button" class="btn" id="btn-continue" style="min-width:240px">Tablet is in · Continue</button><button type="button" class="btn ghost" id="btn-cancel">Cancel</button></div>`;
      $("ring").classList.add("pulse");
      const t0 = Run.started; let rang = Date.now() - t0 > 10000;   // re-attaching keeps the original countdown, no second beep
      const step = () => {
        const left = Math.max(0, 10 - (Date.now() - t0) / 1000);
        setRing($("ring"), left / 10, String(Math.ceil(left)), left > 0 ? "seconds" : "press Continue");
        if (!left && !rang) beep(1);
        if (!left) { rang = true; $("ring").classList.add("due"); }
      };
      step(); countdown = setInterval(step, 200);
      $("btn-continue").onclick = (e) => { e.target.disabled = true; Run.tabletIn().catch((err) => { toast(err.message); e.target.disabled = false; }); };
    }
    if (p === "dissolving") {
      const cps = S.check.runMode === "quick" ? Math.round(T.quick_s / 5) : 0;
      scene.innerHTML = `${Run.continuedAt ? `<span class="chip ok confirm"><span class="dot"></span>You pressed Continue at ${new Date(Run.continuedAt).toLocaleTimeString()} · tablet in marked</span>` : ""}
        ${ringHtml("ring", "var(--sky-ink)")}<p class="serif big">Dissolving…</p><p class="lead" id="d-text">Keep the lid closed.</p>
        ${cps ? `<div class="cp-strip" aria-label="${cps} checkpoints, one every 5 s"><span class="eyebrow">checkpoints</span><ol id="cp">${Array.from({ length: cps }, (_, k) => `<li title="${(k + 1) * 5} s"></li>`).join("")}</ol><span class="mono small" id="cp-n">0 / ${cps}</span></div>` : ""}
        <div class="row wrap" style="justify-content:center">${S.check.runMode === "full" ? `<button type="button" class="btn" id="btn-stop">Stop now &amp; analyze</button>` : ""}<button type="button" class="btn ghost" id="btn-cancel">Cancel</button></div>`;
      setRing($("ring"), 0, "0:00", S.check.runMode === "quick" ? `of ${mmss(T.quick_s)}` : "elapsed");
      if ($("btn-stop")) $("btn-stop").onclick = () => Run.finish();
      if (!chart) chart = makeChart($("live-chart"), { checkpoints: S.check.runMode === "quick" ? Array.from({ length: Math.round(T.quick_s / 5) }, (_, k) => (k + 1) * 5) : null });
    }
    if (p === "analyzing") {
      scene.innerHTML = `<div class="ring pulse" style="--rc:var(--ink)"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/></svg><div class="ring-txt"><span class="tick run" style="width:34px;height:34px;justify-self:center"></span></div></div>
        <p class="serif big">Building your result</p><p class="lead">The run is saved; the photos and the curve are being checked.</p>`;
    }
    const c = $("btn-cancel"); if (c) c.onclick = () => Run.cancel();
  };
  const onPhase = () => { drawRail(); drawScene(); };
  Run.listeners.add(onPhase); S.leave.push(() => { Run.listeners.delete(onPhase); clearInterval(countdown); if (chart) chart.destroy(); });
  onPhase();

  S.onLive = (d) => {
    const l = d.live, g = d.guide;
    if (l && l.curve) { $("l-sec").textContent = Math.round(l.seconds); $("l-n").textContent = l.samples; }
    const raw = (l && l.raw_last) || d.raw_last;
    if (raw && $("raw")) $("raw").innerHTML = rawTable(raw);
    const fresh = d.status && d.status.seconds_since_last !== null && d.status.seconds_since_last < 4;
    v.querySelectorAll("[data-lines]").forEach((el) => el.classList.toggle("breathe", !!fresh));
    $("l-in").textContent = Run.phase === "dissolving" && l && l.tablet_in_at_s ? `tablet in at ${Math.round(l.tablet_in_at_s)} s into the recording` : "";
    if (!g) return;
    if (Run.phase === "water" && g.phase === "water") {
      $("w-checks").innerHTML = (g.checks || []).map((c) => {
        const st = c.ok ? "ok" : c.name === "steady" ? "wait" : "bad";
        return `<li class="wc-${st}"><span class="tick ${st}">${c.ok ? tickSvg : st === "bad" ? crossSvg : ""}</span><span><b>${esc(CHECK_NAME[c.name] || c.name)}</b><span class="why">${esc(c.message)}</span></span></li>`;
      }).join("");
      setRing($("ring"), (g.steady_s || 0) / (g.needed || T.blank_s), String(Math.floor(g.steady_s || 0)), `of ${g.needed || T.blank_s} s steady`);
    }
    if (Run.phase === "dissolving" && g.phase === "dissolving") {
      const e = g.elapsed_s || 0;
      if (g.mode === "quick") {
        const q = g.quick_s || T.quick_s;
        setRing($("ring"), e / q, mmss(e), `of ${mmss(q)}`);
        $("d-text").innerHTML = `Keep the lid closed. <b>${mmss(e)} of ${mmss(q)}</b>: quick test, stops by itself.`;
      } else {
        const target = g.plateau ? Math.max(e, T.min_s) : Math.min(T.max_s, Math.max(T.min_s, e + 60));
        setRing($("ring"), e / target, mmss(e), "elapsed");
        $("d-text").innerHTML = `Keep the lid closed. It stops by itself when the curve flattens (at least ${mmss(T.min_s)}, at most ${mmss(T.max_s)}).` + (g.plateau ? " <b>Curve is flattening…</b>" : "");
      }
      $("r-time").textContent = `${mmss(e)} · ${g.mode === "quick" ? mmss(g.quick_s || T.quick_s) : "auto"}`;
      if (chart && l && l.curve) setCurve(chart, l.curve);
      const cp = $("cp");
      if (cp) { const n = Math.min(cp.children.length, Math.floor(e / 5)); [...cp.children].forEach((li, k) => li.classList.toggle("on", k < n)); $("cp-n").textContent = `${n} / ${cp.children.length}`; }
    }
  };
  $("btn-paste").onclick = async () => {
    const fd = new FormData(); fd.append("label", "pasted"); fd.append("csv_text", $("paste").value); fd.append("profile_id", S.check.profileId || ""); fd.append("mode", S.check.runMode);
    try { const r = await api("/api/run/upload", { method: "POST", body: fd }); await startScan(r.run_id); } catch (e) { toast("Could not read that text: " + e.message); }
  };
  $("btn-old").onclick = () => { if ($("old-run").value) startScan($("old-run").value).catch((e) => toast(e.message)); };
});

// ================================================================ 6. Result (stamp, live stage log, curve vs reference, report)
const STAGE_NAME = { load: "Read the run", vision: "Read the photos", normalize: "Match the name and profile", lookups: "RxNav and openFDA lookups", web: "Regulator web search", report: "Write the report", guardrail: "Check the report against the records" };
const stageTick = (st) => {
  if (st === "done" || st === "ok") return `<span class="tick ok">${tickSvg}</span>`;
  if (st === "skipped") return `<span class="tick skip"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 6h6"/></svg></span>`;
  if (st === "running") return `<span class="tick run"></span>`;
  if (st === "pending") return `<span class="tick pend"></span>`;
  return `<span class="tick err"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 3v3.6M6 8.8v.1"/></svg></span>`;
};
function modeLine(v) {
  const m = mode();
  if (m === "clinic") return v === "NEEDS_LAB" ? `<span class="chip wash-held"><span class="dot" style="background:var(--warm)"></span>held</span> Delivery held: send a sample for lab testing.`
    : v === "PASSED_SCREEN" ? `The pharmacist can release this delivery. Release is a human tap, never automatic.` : `Delivery stays at the gate until the test is repeated.`;
  if (m === "personal") return v === "PASSED_SCREEN" ? `Passed this screen. It checks how the tablet dissolves; it does not identify ingredients.` : `Show this to a pharmacist before taking more of it.`;
  return v === "NEEDS_LAB" ? "Send a sample for lab testing." : "";
}
// every value evidence.recall_status() returns; anything else is shown verbatim
const RECALL_TEXT = { LOT_RECALLED: "This lot matches an FDA recall record", PRODUCT_HAS_RECALLS_OTHER_LOTS: "Other lots of this product have recalls", NO_RECALL_FOUND: "No FDA recall found for this product", NOT_CHECKED: "Recall databases not checked" };
const RECALL_CLASS = { LOT_RECALLED: "bad", PRODUCT_HAS_RECALLS_OTHER_LOTS: "warn", NO_RECALL_FOUND: "ok", NOT_CHECKED: "" };
const kpiCell = (label, val) => `<div><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>`;
const kvList = (o) => Object.entries(o || {}).filter(([, x]) => x !== null && x !== undefined && x !== "" && typeof x !== "object").map(([k, x]) => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${esc(x)}</dd>`).join("");

route(/^\/result\/([^/]+)$/, async (v, id) => {
  let chart = null, timer = 0, lastTitle = "", drewCurve = false, left = false;
  v.innerHTML = `<div id="r-head"></div>${stepsRail(3)}
    <section class="card stamp-card" id="stamp"><span class="stamp pending">Checking…</span><p class="muted">The run is in. Reading the photos, looking up recalls and writing the report.</p></section>
    <div class="wide-2">
      <section class="card stack"><div class="row between"><h2 class="h">What the app is doing</h2><span class="chip" id="r-stage-chip"><span class="dot"></span>working</span></div><ul class="stagelog" id="stages"></ul></section>
      <section class="card stack"><div class="row between"><h2 class="h">Report</h2><span class="footnote" id="r-by"></span></div><p class="writing hidden" id="r-writing" role="status"><span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>Claude is writing the final report</p><div class="report" id="report"><p class="skeleton">Writing the first report from the database lookups…</p></div>
        <h3 class="h" style="font-size:14px;margin-top:6px">Sources</h3><ol class="sources" id="sources"><li class="muted">No sources yet.</li></ol><p class="footnote" id="guard"></p></section>
    </div>
    <div class="wide-2">
      <section class="card stack"><div class="row between"><h2 class="h">Dissolution curve</h2><span class="footnote" id="r-ref"></span></div><div class="chartbox"><canvas id="r-chart"></canvas></div>
        <details><summary class="small">Quality checks</summary><ul class="gates" id="gates"></ul></details></section>
      <section class="card stack"><h2 class="h">Label and tablet</h2>${S.check.scanId === id && (S.check.bottleUrl || S.check.imprintUrl) ? `<div class="thumbs">${[S.check.bottleUrl, S.check.imprintUrl].filter(Boolean).map((u) => `<img src="${esc(u)}" alt="Your photo">`).join("")}</div>` : ""}<div id="recall"></div><dl class="kv" id="fields"></dl><p class="banner note hidden" id="mock">Mock mode: the AI is off on this server, so the bottle and tablet photos were not read and no profile was matched automatically.</p></section>
    </div>
    <section class="card actions" style="align-items:center">
      <a class="btn ghost" href="#/ask/${encodeURIComponent(id)}">Ask about this result</a>
      <a class="btn ghost" href="#/issue/${encodeURIComponent(id)}">Report an issue</a>
      <button type="button" class="btn" id="r-new">Check another</button>
    </section>
    <p class="disclaimer">${esc(DISCLAIMER)} Results that need lab testing should go to a qualified laboratory or pharmacist.</p>`;
  $("r-new").onclick = () => { resetCheck(); location.hash = "#/check/bottle"; };
  S.leave.push(() => { left = true; clearTimeout(timer); if (chart) chart.destroy(); });

  const profiles = await api("/api/profiles").catch(() => []);
  /** The label was read but there's nothing on this station to compare it with: say so plainly (the reading itself was fine). */
  const noRefLine = (s, verdict) => {
    const L = s.label || {};
    if (verdict !== "UNABLE_TO_VERIFY" || s.profile_id || !L.drug_name || L.mock) return "";
    const name = String(L.drug_name).trim(), low = name.toLowerCase();
    const prof = profiles.find((p) => (p.match_names || []).some((m) => m && low.includes(String(m).toLowerCase())));
    const what = `${name}${L.strength ? " " + String(L.strength).trim() : ""}`;
    return `<div class="noref"><span class="g-ic">${glyph("bottle", 30)}</span><p>We read <b>${esc(what)}</b> from the label. <b>Unable to verify</b> means there is no reference for ${esc(name)} on this station yet${prof && !prof.reference ? ` (the ${esc(prof.name)} profile has no reference runs)` : ""}: record 3 good runs to build one. <a href="#/profiles">Profiles →</a></p></div>`;
  };
  const render1 = (s) => {
    const a = s.analysis, verdict = s.overall || (a && a.result);
    const title = verdict ? "Result" : "Checking…";
    if (title !== lastTitle) { lastTitle = title; $("r-head").innerHTML = head({ eyebrow: `Step 4 of 4 · ${id}${s.label && s.label.drug_name ? " · " + s.label.drug_name : ""}`, title, tone: verdict ? RESULT_TONE[verdict] : "sky", back: "#/history" }); }
    // stamp
    const st = $("stamp");
    if (verdict && !st.dataset.v) {
      st.dataset.v = verdict;
      st.className = `card stamp-card tone-${RESULT_TONE[verdict]}`;
      const n = a ? a.numbers : null, q = a ? a.quantity : null, k = [];
      if (a) {
        if (q && q.percent_of_label !== null && q.percent_of_label !== undefined && a.result !== "UNABLE_TO_VERIFY") k.push(kpiCell("of labelled dose", q.percent_of_label + " %"));
        k.push(kpiCell("time to 80 %", n.t80_s ? Math.round(n.t80_s) + " s" : "–"));
        k.push(kpiCell("final level (A)", n.A_specific_end ?? "–"));
        k.push(kpiCell("run after tablet in", Math.round(n.run_s_after_drop) + " s"));
      }
      st.innerHTML = `<p class="eyebrow">Screening result</p><span class="stamp" role="status">${esc(RESULT_TEXT[verdict])}</span>
        ${noRefLine(s, verdict)}
        <p class="headline" id="r-headline"></p>
        <ul class="reasons">${(a ? a.reasons : []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        ${modeLine(verdict) ? `<p class="mode-line">${modeLine(verdict)}</p>` : ""}
        ${k.length ? `<dl class="kpis">${k.join("")}</dl>` : ""}
        ${s.profile_name ? `<p class="footnote">Compared with profile: ${esc(s.profile_name)}</p>` : ""}`;
    }
    if (s.report && $("r-headline")) $("r-headline").textContent = s.report.headline || "";
    if (s.error && $("r-headline")) $("r-headline").textContent = "Error: " + s.error;
    // stage log
    const stages = Object.entries(s.stages || {});
    $("stages").innerHTML = stages.map(([k, x], i) => `<li style="--i:${i}">${stageTick(x.status)}<span>${esc(STAGE_NAME[k] || k)}${x.why ? `<span class="why">${esc(x.why)}</span>` : ""}</span><span class="ms">${x.status === "done" && x.ms != null ? x.ms + " ms" : esc(x.status)}</span></li>`).join("");
    const doneN = stages.filter(([, x]) => !["pending", "running"].includes(x.status)).length;
    $("r-stage-chip").className = "chip " + (s.done ? "ok" : "live beat");
    $("r-stage-chip").innerHTML = `<span class="dot"></span>${s.done ? "done" : `${doneN} of ${stages.length}`}`;
    // report
    const r = s.report;
    if (r) {
      const num = {}; (r.sources || []).forEach((x, i) => (num[x.id] = i + 1));
      $("report").innerHTML = `<p>${esc(r.plain_summary)}</p><p class="what">${esc(r.what_to_do)}</p>` +
        (r.evidence || []).map((e) => `<p class="ev">${esc(e.claim)}${(e.source_ids || []).map((i) => `<button type="button" class="sup" data-src="${esc(i)}" aria-label="Source ${esc(num[i] || i)}">${esc(num[i] || i)}</button>`).join("")}</p>`).join("");
      $("r-by").textContent = `${s.report_stage === "final" ? "final report" : "first report"} · ${r.generated_by === "template" ? "template" : "written by " + r.generated_by}`;
      $("sources").innerHTML = (r.sources || []).map((x, i) => `<li id="src-${esc(x.id)}"><b>${i + 1}</b><span>${safeUrl(x.url) ? `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a>` : esc(x.title)}<small class="src-kind">${esc(x.kind)}</small></span></li>`).join("") || "<li class='muted'>No sources yet.</li>";
      $("guard").textContent = (r.guardrail_fixes || []).length ? "Guardrail corrections: " + r.guardrail_fixes.join(" ") : "";
      $("report").querySelectorAll("[data-src]").forEach((b) => (b.onclick = () => { const t = document.getElementById("src-" + b.dataset.src); if (t) t.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" }); }));
    }
    // Claude pulse: from the template report until the model's report lands (or the scan finishes)
    $("r-writing").classList.toggle("hidden", !(S.config.ai && r && r.generated_by === "template" && !s.done));
    // recall + fields
    if (s.recall_status === "LOT_RECALLED") $("recall").innerHTML = `<p class="banner held">${RECALL_TEXT.LOT_RECALLED}.${mode() === "clinic" ? " Delivery held." : ""}</p>`;
    else if (s.recall_status) { const [txt, cls] = s.recall_status in RECALL_TEXT ? [RECALL_TEXT[s.recall_status], RECALL_CLASS[s.recall_status]] : [s.recall_status, ""]; $("recall").innerHTML = `<span class="chip ${cls}"><span class="dot"></span>${esc(txt)}</span>`; }
    $("fields").innerHTML = kvList(s.label) + kvList(s.imprint) || `<dt>photos</dt><dd>none read yet</dd>`;
    $("mock").classList.toggle("hidden", !((s.label && s.label.mock) || (s.imprint && s.imprint.mock)));
    // curve vs reference (once)
    if (a && a.curve && !drewCurve) {
      drewCurve = true;
      const fp = a.fingerprint;
      const extra = fp && fp.kind === "curve" && fp.checkpoints ? [{
        label: "reference", borderColor: "rgba(22,24,27,.55)", backgroundColor: fp.checkpoints.map((c) => (c.ok ? "#5FD39A" : "#E09A3A")), borderDash: [3, 4], borderWidth: 1.5,
        pointRadius: 4, pointBorderColor: "#fff", data: fp.checkpoints.map((c) => ({ x: c.t, y: c.ref })),
      }] : [];
      $("r-ref").textContent = extra.length ? `${fp.checkpoints.filter((c) => c.ok).length} of ${fp.checkpoints.length} checkpoints match` : (s.profile_name ? "" : "no reference profile");
      chart = makeChart($("r-chart"), {});
      setCurve(chart, a.curve, extra);
      $("gates").innerHTML = (a.gates || []).map((g) => `<li><span class="tick ${g.ok ? "ok" : g.blocking ? "err" : "skip"}">${g.ok ? tickSvg : ""}</span><span>${esc(g.message)}</span></li>`).join("");
    }
  };
  const poll = async () => {
    let s;
    try { s = await api("/api/scans/" + encodeURIComponent(id)); } catch (e) {
      if (/not found|404/i.test(e.message)) { $("stamp").innerHTML = `<p class="banner note">No scan with id ${esc(id)}.</p>`; return; }
      if (!left) timer = setTimeout(poll, 1500); return;
    }
    if (left) return;
    render1(s);
    if (!s.done) timer = setTimeout(poll, 1000);
  };
  await poll();
});

// ================================================================ 7. Ask (grounded in the report; voice where the browser allows)
/** What the model sees: the real exchanges only (local help answers stay out), as {role, content}. */
const chatHistory = (hist) => hist.filter((m) => !m.local).map(({ role, content }) => ({ role, content }));
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
route(/^\/ask\/([^/]+)$/, async (v, id) => {
  const s = await api("/api/scans/" + encodeURIComponent(id)).catch(() => null);
  const hist = (S.chats[id] = S.chats[id] || []);
  const voiceOk = SR && window.isSecureContext;
  v.innerHTML = `${head({ eyebrow: `Scan ${id}${s && s.label && s.label.drug_name ? " · " + s.label.drug_name : ""}`, title: "Ask about this result", tone: "violet", back: `#/result/${encodeURIComponent(id)}`, side: s ? resultChips(s.overall, s.done) : "" })}
    <section class="card stack">
      <div class="chat" id="chat" aria-live="polite"></div>
      <div class="suggest" id="suggest">${["What does this result mean?", "What should I do next?", "Was this lot recalled?"].map((q) => `<button type="button" class="chip">${q}</button>`).join("")}</div>
      <div class="ask-bar"><input id="ask-in" placeholder="e.g. What does this recall mean for me?" aria-label="Your question">
        ${voiceOk ? `<button type="button" class="btn ghost icon mic" id="mic" aria-label="Speak your question"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button>` : `<span></span>`}
        <button type="button" class="btn" id="ask-go">Ask</button></div>
      <div class="set-row" style="border-top:1px solid var(--line)"><span><b>Read answers aloud</b><small>${"speechSynthesis" in window ? "Uses this device's voice." : "Not available in this browser."}</small></span><button type="button" class="switch" role="switch" id="speak" aria-checked="${PREF.speak}" aria-label="Read answers aloud"></button></div>
      <p class="footnote">Answers come only from this report and its sources. ${S.config.ai ? "" : "AI is in mock mode on this server, so answers are templates."} ${!SR ? "Voice input isn't supported in this browser: type your question." : !window.isSecureContext ? "Voice input needs https or localhost: type your question here." : ""}</p>
    </section>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>`;
  const chat = $("chat");
  const add = (who, text) => { const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; chat.appendChild(d); chat.scrollTop = 1e9; return d; };
  if (!hist.length) add("bot", s && s.report ? `Ask me anything about this result (${RESULT_TEXT[s.overall] || "still checking"}). I answer only from the report.` : "Ask me anything about this result. I answer only from the report.");
  hist.forEach((m) => add(m.role === "user" ? "me" : "bot", m.content));
  $("speak").onclick = (e) => { PREF.speak = !PREF.speak; e.currentTarget.setAttribute("aria-checked", String(PREF.speak)); };
  const ask = async (q) => {
    q = (q || $("ask-in").value).trim(); if (!q) return;
    $("ask-in").value = ""; add("me", q);
    const typing = add("bot", ""); typing.innerHTML = `<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>`;
    try {
      const r = await post(`/api/scans/${encodeURIComponent(id)}/ask`, { question: q, history: chatHistory(hist) });
      hist.push({ role: "user", content: q }, { role: "assistant", content: r.answer });
      typing.textContent = r.answer;
      if (PREF.speak && "speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(r.answer));
    } catch (e) { typing.textContent = "Sorry, " + e.message; }
  };
  $("ask-go").onclick = () => ask();
  $("ask-in").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
  $("suggest").querySelectorAll("button").forEach((b) => (b.onclick = () => ask(b.textContent)));
  if (voiceOk) $("mic").onclick = (e) => {
    const btn = e.currentTarget, rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
    btn.classList.add("on"); rec.onend = () => btn.classList.remove("on");
    rec.onresult = (ev) => { $("ask-in").value = ev.results[0][0].transcript; ask(); };
    rec.start();
  };
  S.leave.push(() => { if ("speechSynthesis" in window) speechSynthesis.cancel(); });
});

// ================================================================ 8. Report an issue (draft → edit → Submit only on tap)
route(/^\/issue\/([^/]+)$/, async (v, id) => {
  const s = await api("/api/scans/" + encodeURIComponent(id)).catch(() => null);
  v.innerHTML = `${head({ eyebrow: `Scan ${id}${s && s.label && s.label.drug_name ? " · " + s.label.drug_name : ""}`, title: "Report an issue", tone: "amber", back: `#/result/${encodeURIComponent(id)}`, side: s ? resultChips(s.overall, s.done) : "" })}
    <div class="wide-2">
      <section class="card stack">
        <h2 class="h">Where did it come from?</h2>
        <div class="grid2">
          <label class="field">Where bought (shop / seller)<input id="i-seller"></label>
          <label class="field">City<input id="i-city"></label>
          <label class="field">When<input id="i-when" placeholder="e.g. Oct 2026"></label>
          <label class="field">Anything else<input id="i-notes"></label>
        </div>
        <button type="button" class="btn ghost" id="i-draft">Draft the report</button>
      </section>
      <section class="card stack">
        <h2 class="h">Your report</h2>
        <textarea id="i-text" rows="9" placeholder="Tap “Draft the report” to start, then edit it here." aria-label="Report text"></textarea>
        <button type="button" class="btn hidden" id="i-submit">Submit</button>
        <p class="footnote" id="i-msg">Nothing is sent until you tap Submit. No reporter identity is stored.</p>
      </section>
    </div>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>`;
  $("i-draft").onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const r = await post(`/api/scans/${encodeURIComponent(id)}/issue/draft`, { where: $("i-seller").value + ($("i-city").value ? ", " + $("i-city").value : ""), when: $("i-when").value, notes: $("i-notes").value });
      $("i-text").value = r.draft; $("i-submit").classList.remove("hidden");
      $("i-msg").textContent = "Check and edit the text. Nothing is sent until you tap Submit. No reporter identity is stored.";
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  };
  $("i-submit").onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const r = await post("/api/issues", { scan_id: id, text: $("i-text").value, seller: $("i-seller").value, city: $("i-city").value, when: $("i-when").value });
      $("i-msg").textContent = `Saved (${r.issue_id}). ${r.note}`; btn.classList.add("hidden");
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
});

// ================================================================ 9. History
route(/^\/history$/, async (v) => {
  const [sc, rs] = await Promise.all([api("/api/scans").catch(() => []), api("/api/runs").catch(() => [])]);
  sc.sort((a, b) => (b.created || 0) - (a.created || 0));   // runs already come newest first
  v.innerHTML = `${head({ eyebrow: `${sc.length} checks · ${rs.length} runs`, title: "History", tone: "sky", side: `<a class="btn ghost" href="#/check/bottle">New check</a>` })}
    <div class="wide-2">
      <section class="card stack"><h2 class="h">Checks</h2><div class="capsules">${sc.map(capsule).join("") || `<p class="muted">No checks yet.</p>`}</div></section>
      <section class="card stack"><h2 class="h">Runs</h2><ul class="list">${rs.map((r, i) => `<li class="rise" style="--i:${Math.min(i, 12)}"><span>${esc(r.label)}<br><small>${esc(r.id)} · ${r.samples} samples · ${esc(r.source)} · ${esc(r.mode)}</small></span><span class="cap-chips">${r.result ? `<span class="chip wash-${RESULT_CLASS[r.result]}">${esc(RESULT_TEXT[r.result])}</span>` : ""}</span></li>`).join("") || `<li class="muted">No runs yet.</li>`}</ul></section>
    </div>`;
});

// ================================================================ 10. Profiles (reference / calibration builders)
route(/^\/profiles$/, async (v) => {
  const [ps, rs] = await Promise.all([api("/api/profiles").catch(() => []), api("/api/runs").catch(() => [])]);
  const runOpts = rs.map((r) => `<option value="${esc(r.id)}">${esc(r.label)} · ${esc(r.id)}</option>`).join("");
  v.innerHTML = `${head({ eyebrow: `${ps.length} profiles`, title: "Profiles", tone: "violet" })}
    <section class="card stack"><h2 class="h">What a good tablet looks like</h2>
      <p class="muted">A profile tells the app what a good tablet looks like. <b>Reference</b> = 3 or more runs of a known-good tablet. <b>Calibration</b> = solutions of known strength, so the app can estimate the dose released.</p>
      <ul class="list">${ps.map((p) => `<li><span><b>${esc(p.name)}</b> ${p.demo ? `<span class="sim">DEMO, simulated</span>` : ""}<br><small>${esc(p.id)} · ${p.reference ? "reference ✓ (" + esc(p.mode) + " mode, " + esc(p.signal) + ")" : "no reference"}${p.match_names && p.match_names.length ? " · matches: " + esc(p.match_names.join(", ")) : ""} · ${p.calibration ? "calibration ✓" : "no calibration"}</small></span></li>`).join("")}</ul>
    </section>
    <div class="wide-2">
      <section class="card stack"><h2 class="h">Build a reference profile</h2>
        <div class="grid2">
          <label class="field">Profile id<input id="ref-id" placeholder="aspirin_ref"></label>
          <label class="field">Name<input id="ref-name" placeholder="Aspirin 325 mg uncoated, brand X"></label>
          <label class="field">Label words that match it<input id="ref-match" placeholder="aspirin"></label>
        </div>
        <fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="field" style="margin-bottom:8px">What changes when it dissolves?</legend>
          ${[["scatter", "Cloudiness, side sensor", "White tablet, e.g. plain aspirin. Recommended."], ["colour", "Colour", "Yellow water, e.g. riboflavin / B-complex."], ["cloud", "Cloudiness, straight-through red light", "Weaker signal."]]
            .map(([val, t, sub], i) => `<label class="mode-opt check"><input type="radio" name="ref-signal" value="${val}"${i === 0 ? " checked" : ""}><span><b>${t}</b><br><small>${sub}</small></span></label>`).join("")}
        </fieldset>
        <p class="footnote">Tick 3 or more runs of the same known-good tablet, recorded in the same mode:</p>
        <ul class="list" id="ref-runs">${rs.map((r) => `<li><label class="check"><input type="checkbox" value="${esc(r.id)}"> <span>${esc(r.label)}<br><small>${esc(r.mode)} · ${esc(r.id)} · ${r.samples} samples</small></span></label></li>`).join("") || `<li class="muted">Record some runs first.</li>`}</ul>
        <button type="button" class="btn" id="btn-ref">Build reference</button><pre class="pre" id="ref-out"></pre>
      </section>
      <section class="card stack"><h2 class="h">Build a calibration</h2>
        <p class="footnote">One run per standard (include plain water = 0). Each run: cup with the standard, lid on, record about 60 s.</p>
        <div class="grid2">
          <label class="field">Profile id<input id="cal-id" placeholder="riboflavin_ref"></label>
          <label class="field">Name<input id="cal-name"></label>
          <label class="field">Label words<input id="cal-match" placeholder="riboflavin"></label>
          <label class="field">Label dose (mg per tablet)<input id="cal-mg" type="number" step="any"></label>
          <label class="field">Water volume (mL)<input id="cal-vol" type="number" value="145"></label>
        </div>
        <div class="stack" id="cal-rows"></div>
        <div class="actions"><button type="button" class="btn ghost" id="btn-row">Add standard</button><button type="button" class="btn" id="btn-cal">Build calibration</button></div>
        <pre class="pre" id="cal-out"></pre>
      </section>
    </div>`;
  const addRow = (conc) => {
    const d = document.createElement("div"); d.className = "row";
    d.innerHTML = `<select class="cal-run" aria-label="Run">${runOpts}</select><input class="cal-conc" type="number" step="any" placeholder="mg/L" style="max-width:110px" aria-label="Concentration mg/L" value="${conc ?? ""}">`;
    $("cal-rows").appendChild(d);
  };
  addRow(0); addRow(); addRow();
  $("btn-row").onclick = () => addRow();
  const words = (id) => $(id).value.split(",").map((x) => x.trim()).filter(Boolean);
  $("btn-ref").onclick = async () => {
    const ids = [...$("ref-runs").querySelectorAll("input:checked")].map((i) => i.value);
    try {
      const r = await post("/api/profiles/reference", { profile_id: $("ref-id").value || "my_reference", name: $("ref-name").value || "My reference",
        match_names: words("ref-match"), run_ids: ids, signal: v.querySelector('input[name="ref-signal"]:checked').value });
      $("ref-out").textContent = JSON.stringify(r.reference, null, 2); toast("Reference saved");
    } catch (e) { $("ref-out").textContent = "Error: " + e.message; }
  };
  $("btn-cal").onclick = async () => {
    const standards = [...$("cal-rows").children].map((d) => ({ run_id: d.querySelector(".cal-run").value, conc_mg_per_l: parseFloat(d.querySelector(".cal-conc").value) })).filter((x) => x.run_id && !isNaN(x.conc_mg_per_l));
    try {
      const r = await post("/api/profiles/calibration", { profile_id: $("cal-id").value || "my_calibration", name: $("cal-name").value || "My calibration",
        match_names: words("cal-match"), label_mg: parseFloat($("cal-mg").value), volume_ml: parseFloat($("cal-vol").value) || 145, standards });
      $("cal-out").textContent = JSON.stringify(r.calibration, null, 2); toast("Calibration saved");
    } catch (e) { $("cal-out").textContent = "Error: " + e.message; }
  };
});

// ================================================================ Atlas (3D graph: library loaded on first open, graph destroyed on leave)
const KIND_COLORS = { medicine: "#3fb79c", lot: "#f3b25b", manufacturer: "#7aa2ff", recall: "#ff6b6b", seller: "#c792ea" };
function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
route(/^\/atlas$/, async (v) => {
  v.innerHTML = `${head({ eyebrow: "medicines · lots · makers · recalls · sellers", title: "Atlas", tone: "sky" })}
    <section class="card stack"><p class="muted">Medicines, lots, manufacturers, recalls and the sellers named in reports. Sellers show a report count, never who reported.</p>
      <div class="legend">${Object.entries(KIND_COLORS).map(([k, c]) => `<span style="--c:${c}">${k}</span>`).join("")}</div>
      <div id="atlas" class="atlas"><p>Loading the graph…</p></div></section>`;
  let graph = null, gone = false;
  const onResize = () => { if (graph) graph.width($("atlas").clientWidth); };
  S.leave.push(() => {
    gone = true; window.removeEventListener("resize", onResize);
    if (graph) { try { graph.pauseAnimation(); graph._destructor && graph._destructor(); } catch {} graph = null; }
  });
  const data = await api("/api/atlas");
  if (gone) return;
  if (!data.nodes.length) { $("atlas").innerHTML = "<p>No checks yet.</p>"; return; }
  if (!window.ForceGraph3D) { try { await loadScript("/static/vendor/3d-force-graph-1.80.0.min.js"); } catch { $("atlas").innerHTML = "<p>Could not load the 3D library.</p>"; return; } }
  if (gone) return;
  const box = $("atlas"); box.innerHTML = "";
  graph = ForceGraph3D()(box).width(box.clientWidth).height(box.clientHeight)
    .graphData(data).nodeLabel((n) => esc(n.label)).nodeColor((n) => (n.kind === "recall" && n.lot_match ? "#ff2d2d" : KIND_COLORS[n.kind] || "#ccc"))
    .nodeVal((n) => (n.kind === "seller" ? 2 + (n.reports || 1) * 2 : n.kind === "medicine" ? 6 : 3))
    .linkOpacity(0.5).backgroundColor("#0d1014")
    .cooldownTicks(120).onEngineStop(() => graph && graph.zoomToFit(400, 60));
  window.addEventListener("resize", onResize);
});

// ================================================================ Settings
route(/^\/settings$/, (v) => {
  const sw = (id, on, label) => `<button type="button" class="switch" role="switch" id="${id}" aria-checked="${on}" aria-label="${label}"></button>`;
  const c = S.config;
  v.innerHTML = `${head({ eyebrow: MODES[mode()] ? MODES[mode()].name + " mode" : "", title: "Settings", tone: "grey" })}
    <div class="wide-2">
      <section class="card stack"><h2 class="h">Who is this for?</h2>
        <div class="stack">${Object.entries(MODES).map(([k, m]) => `<button type="button" class="mode-opt" data-mode="${k}" aria-pressed="${mode() === k}"><b>${m.name}</b><small>${esc(m.who)}</small></button>`).join("")}</div>
        <p class="footnote">The mode changes the words, the home page and the menu. The checks themselves are the same.</p>
      </section>
      <section class="card stack"><h2 class="h">This device</h2>
        <div class="set-row"><span><b>Sounds</b><small>Beeps when it's time to add the tablet and when the run stops.</small></span>${sw("s-sound", PREF.sound, "Sounds")}</div>
        <div class="set-row"><span><b>Easy mode</b><small>Bigger text (125 %), stronger contrast, answers read aloud.</small></span>${sw("s-easy", PREF.easy, "Easy mode")}</div>
        <div class="set-row"><span><b>Read answers aloud</b><small>On the Ask page and in Ask Pill.</small></span>${sw("s-speak", PREF.speak, "Read answers aloud")}</div>
        <div class="set-row"><span><b>Reset local preferences</b><small>Forgets the mode and these switches on this browser only.</small></span><button type="button" class="btn ghost sm" id="s-reset">Reset</button></div>
      </section>
      <section class="card stack span-2"><h2 class="h">Server</h2>
        <dl class="kv"><dt>app</dt><dd>${esc(c.app_name)}</dd><dt>AI</dt><dd>${c.ai ? "on · " + esc(c.model) : "mock mode (no API key)"}</dd>
          <dt>quick test</dt><dd>${c.timing.quick_s} s</dd><dt>full test</dt><dd>${mmss(c.timing.min_s)}–${mmss(c.timing.max_s)}</dd><dt>clean water</dt><dd>${c.timing.blank_s} s steady</dd>
          <dt>device</dt><dd>${deviceChip()}</dd><dt>lines read</dt><dd data-lines>–</dd></dl>
        <p class="footnote">${esc(DISCLAIMER)}</p>
      </section>
    </div>`;
  v.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { PREF.mode = b.dataset.mode; navMode = null; render(); toast(MODES[b.dataset.mode].name + " mode"); }));
  $("s-sound").onclick = (e) => { PREF.sound = !PREF.sound; e.currentTarget.setAttribute("aria-checked", String(PREF.sound)); if (PREF.sound) beep(1); };
  $("s-speak").onclick = (e) => { PREF.speak = !PREF.speak; e.currentTarget.setAttribute("aria-checked", String(PREF.speak)); };
  $("s-easy").onclick = (e) => { PREF.easy = !PREF.easy; e.currentTarget.setAttribute("aria-checked", String(PREF.easy)); $("s-speak").setAttribute("aria-checked", String(PREF.speak)); toast(PREF.easy ? "Easy mode on" : "Easy mode off"); };
  $("s-reset").onclick = (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed) { PREF.reset(); navMode = null; location.hash = "#/welcome"; return; }
    b.dataset.armed = "1"; b.textContent = "Tap again to reset";
  };
});

// ================================================================ Personal: My medicines (every drug read off a label, grouped by name + strength)
const normName = (x) => String(x || "").trim().replace(/\s+/g, " ");
const recallChip = (rs) => (!rs ? "" : `<span class="chip ${RECALL_CLASS[rs] ?? ""}"><span class="dot"></span>${esc(RECALL_TEXT[rs] || rs)}</span>`);
route(/^\/medicines$/, async (v) => {
  v.innerHTML = `${head({ eyebrow: "From your checks", title: "My medicines", tone: "mint", side: `<a class="btn" href="#/check/bottle">Check a medicine</a>` })}<div id="meds" class="stack"><p class="skeleton">Reading your checks…</p></div>`;
  const list = (await api("/api/scans").catch(() => [])).sort((a, b) => (b.created || 0) - (a.created || 0));
  const recent = list.slice(0, 40);                                  // details carry the strength and the recall status
  const full = (await Promise.all(recent.map((x) => api("/api/scans/" + encodeURIComponent(x.id)).catch(() => null)))).filter(Boolean);
  const groups = new Map(); let unread = 0;
  for (const s of full) {
    const L = s.label || {}; const name = normName(L.drug_name);
    if (!name || L.mock) { unread++; continue; }
    const strength = normName(L.strength);
    const k = (name + "|" + strength).toLowerCase();
    if (!groups.has(k)) groups.set(k, { name, strength, maker: L.manufacturer || "", scans: [] });
    groups.get(k).scans.push(s);                                       // newest first, so scans[0] is the latest
  }
  const G = [...groups.values()];
  if (!$("meds")) return;
  $("meds").innerHTML = G.length ? `<div class="med-grid">${G.map((g, i) => {
    const s = g.scans[0], n = g.scans.length, label = `${g.name}${g.strength ? " " + g.strength : ""}`;
    return `<article class="card med rise" style="--i:${i}">
      <div class="med-top">${glyph("bottle", 48)}<div class="med-name"><h2>${esc(g.name)}</h2><p class="muted">${esc(g.strength || "strength not read")}${g.maker ? " · " + esc(g.maker) : ""}</p></div></div>
      <div class="row wrap">${resultChips(s.overall, s.done)}${recallChip(s.recall_status)}</div>
      <p class="med-n"><b>Tested ${n} time${n === 1 ? "" : "s"}</b> · last ${s.created ? esc(timeAgo(s.created)) : "–"}</p>
      <div class="row wrap"><a class="btn ghost sm" href="#/result/${encodeURIComponent(s.id)}">Latest result</a><a class="btn ghost sm" href="#/schedule?add=${encodeURIComponent(label)}">Add to my schedule</a></div>
    </article>`;
  }).join("")}</div>` : `<section class="card stack"><p class="serif" style="font-size:26px">No medicines yet</p><p class="muted">Each medicine whose label the app reads during a check appears here, with its latest result.</p><div class="actions"><a class="btn" href="#/check/bottle">Check my first medicine</a></div></section>`;
  $("meds").insertAdjacentHTML("beforeend", `${unread ? `<p class="footnote">${unread} check${unread === 1 ? "" : "s"} had no label read, so ${unread === 1 ? "it isn't" : "they aren't"} listed here. <a href="#/history">History →</a></p>` : ""}
    ${list.length > recent.length ? `<p class="footnote">Showing medicines from your latest ${recent.length} checks.</p>` : ""}<p class="disclaimer">${esc(DISCLAIMER)}</p>`);
});

// ================================================================ Personal: Schedule (this browser only: localStorage, no backend)
const Sched = {
  get meds() { try { return JSON.parse(localStorage.getItem("pillgate.schedule") || "[]"); } catch { return []; } },
  set meds(x) { localStorage.setItem("pillgate.schedule", JSON.stringify(x)); },
  get log() { try { return JSON.parse(localStorage.getItem("pillgate.takelog") || "[]"); } catch { return []; } },
  set log(x) { localStorage.setItem("pillgate.takelog", JSON.stringify(x.slice(-200))); },
  day: (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  mins: (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); },
  /** Today's doses, one per medicine × time, with whether each was marked taken today. */
  today() {
    const day = this.day(), log = this.log;
    return this.meds.flatMap((m) => m.times.map((t) => ({ m, t, taken: log.find((e) => e.med === m.id && e.slot === t && e.day === day) })))
      .sort((a, b) => this.mins(a.t) - this.mins(b.t));
  },
  next() { const now = new Date(), n = now.getHours() * 60 + now.getMinutes(); return this.today().find((d) => !d.taken && this.mins(d.t) >= n - 30) || null; },
};
const fmtTime = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
// Reminders: checked every 30 s while the app is open in a tab; one notification per dose per day.
const Reminders = {
  get on() { return localStorage.getItem("pillgate.remind") === "on"; },
  set on(v) { localStorage.setItem("pillgate.remind", v ? "on" : "off"); },
  supported: () => "Notification" in window,
  check() {
    if (!Reminders.on || !Reminders.supported() || Notification.permission !== "granted") return;
    const now = new Date(), n = now.getHours() * 60 + now.getMinutes(), day = Sched.day();
    let sent = {}; try { sent = JSON.parse(localStorage.getItem("pillgate.notified") || "{}"); } catch {}
    if (sent.day !== day) sent = { day, keys: [] };
    for (const d of Sched.today()) {
      const key = d.m.id + "@" + d.t, due = Sched.mins(d.t);
      if (d.taken || sent.keys.includes(key) || n < due || n > due + 30) continue;
      sent.keys.push(key);
      try {
        const note = new Notification(`Time for ${d.m.name}`, { body: `${d.m.dose ? d.m.dose + " · " : ""}${fmtTime(d.t)}. Open Pill Gate and tap "I took it".`, tag: key });
        note.onclick = () => { window.focus(); location.hash = "#/schedule"; note.close(); };
      } catch {}
    }
    localStorage.setItem("pillgate.notified", JSON.stringify(sent));
  },
};
/** One daily repeating event per medicine × time, with an alarm at the time. Floating local times (no time zone). */
function scheduleIcs(meds) {
  const icsEsc = (x) => String(x || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const day = Sched.day().replace(/-/g, "");
  const ev = meds.flatMap((m) => m.times.map((t) => [
    "BEGIN:VEVENT", `UID:${m.id}-${t.replace(":", "")}@pillgate.local`, `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${t.replace(":", "")}00`, "DURATION:PT10M", "RRULE:FREQ=DAILY",
    `SUMMARY:${icsEsc("Take " + m.name + (m.dose ? " (" + m.dose + ")" : ""))}`,
    `DESCRIPTION:${icsEsc("From your Pill Gate schedule." + (m.note ? " " + m.note : ""))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("Take " + m.name)}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n")));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pill Gate//Schedule//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR", ""].join("\r\n");
}
route(/^\/schedule$/, (v) => {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  v.innerHTML = `${head({ eyebrow: dateEyebrow(), title: "My schedule", tone: "sky" })}<div id="sc-body" class="stack" style="gap:16px"></div>`;
  const body = $("sc-body");
  let first = true;                                   // rows rise in once; later redraws (a tap) don't replay it
  const draw = () => {
    const meds = Sched.meds, today = Sched.today(), log = Sched.log;
    const now = new Date(), n = now.getHours() * 60 + now.getMinutes();
    const state = (d) => d.taken ? "taken" : Sched.mins(d.t) <= n + 15 && Sched.mins(d.t) >= n - 60 ? "due" : Sched.mins(d.t) < n ? "late" : "later";
    const perm = !Reminders.supported() ? "unsupported" : Notification.permission;
    body.innerHTML = `<section class="card stack"><div class="row between wrap"><h2 class="h">Today</h2><span class="footnote">${today.filter((d) => d.taken).length} of ${today.length} taken</span></div>
        ${today.length ? `<ol class="doses">${today.map((d, i) => { const st = state(d); return `<li class="dose dose-${st}${first ? " rise" : ""}" style="--i:${i}">
          <span class="dose-t">${esc(fmtTime(d.t))}</span>
          <span class="dose-w"><b>${esc(d.m.name)}</b><small>${esc(d.m.dose || "")}${st === "taken" ? ` · taken at ${esc(new Date(d.taken.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}` : st === "due" ? " · now" : st === "late" ? " · not marked yet" : ""}</small></span>
          ${st === "taken" ? `<button type="button" class="btn ghost sm" data-undo="${esc(d.m.id)}|${esc(d.t)}" aria-label="Undo ${esc(d.m.name)} at ${esc(fmtTime(d.t))}"><span class="tick ok">${tickSvg}</span>Undo</button>`
            : `<button type="button" class="btn took" data-took="${esc(d.m.id)}|${esc(d.t)}">I took it</button>`}</li>`; }).join("")}</ol>`
          : `<p class="muted">No doses yet. Add a medicine below${meds.length ? "" : ", or start from one you checked on My medicines"}.</p>`}
      </section>
      <div class="wide-2">
        <section class="card stack"><h2 class="h">${q.get("add") ? "Add to your schedule" : "Add a medicine"}</h2>
          <form id="sc-form" class="stack" autocomplete="off">
            <label class="field">Medicine<input id="sc-name" required maxlength="80" value="${esc(q.get("add") || "")}" placeholder="e.g. Aspirin 325 mg"></label>
            <label class="field">How much<input id="sc-dose" maxlength="60" placeholder="e.g. 1 tablet with food"></label>
            <fieldset class="sc-times"><legend>Times each day</legend><div id="sc-times" class="row wrap"><input type="time" value="08:00" aria-label="Time 1" required></div>
              <button type="button" class="btn ghost sm" id="sc-more">+ another time</button></fieldset>
            <button type="submit" class="btn">Save to my schedule</button>
          </form>
          ${meds.length ? `<ul class="sc-list">${meds.map((m) => `<li><span><b>${esc(m.name)}</b><small>${esc(m.dose || "")}${m.dose ? " · " : ""}${m.times.map(fmtTime).map(esc).join(", ")}</small></span><button type="button" class="btn ghost sm" data-del="${esc(m.id)}">Remove</button></li>`).join("")}</ul>` : ""}
        </section>
        <section class="card stack"><h2 class="h">Reminders</h2>
          <div class="set-row"><span><b>Remind me at each time</b><small>${perm === "unsupported" ? "This browser can't show notifications. Use Add to calendar instead." : perm === "denied" ? "Notifications are blocked for this site in the browser settings. Use Add to calendar instead." : "Works while Pill Gate is open in a browser tab. For reminders when it's closed, add the schedule to your calendar."}</small></span>
            <button type="button" class="switch" role="switch" id="sc-remind" aria-checked="${Reminders.on && perm === "granted"}" aria-label="Remind me at each time"${perm === "unsupported" || perm === "denied" ? " disabled" : ""}></button></div>
          <div class="set-row"><span><b>Add to calendar</b><small>Downloads a calendar file with a daily event and an alarm for each time. Your calendar app keeps the reminders.</small></span>
            <button type="button" class="btn ghost sm" id="sc-ics"${meds.length ? "" : " disabled"}>Add to calendar</button></div>
          <h3 class="h" style="font-size:14px;margin-top:8px">Recent log</h3>
          ${log.length ? `<ol class="sc-log">${log.slice(-12).reverse().map((e) => `<li><span class="mono small">${esc(new Date(e.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }))}</span><span>${esc(e.name)}${e.dose ? " · " + esc(e.dose) : ""}</span></li>`).join("")}</ol>` : `<p class="muted">Each "I took it" tap is logged here, on this browser only.</p>`}
        </section>
      </div>
      <p class="disclaimer">Your schedule and log stay in this browser. They are not sent to the station. Follow the dose on your prescription label.</p>`;
    first = false;
    body.querySelectorAll("[data-took]").forEach((b) => (b.onclick = () => {
      const [id, slot] = b.dataset.took.split("|"), m = Sched.meds.find((x) => x.id === id); if (!m) return;
      Sched.log = [...Sched.log, { med: id, slot, day: Sched.day(), at: Date.now(), name: m.name, dose: m.dose }];
      beep(1); toast(`${m.name} marked as taken`); draw();
    }));
    body.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = () => {
      const [id, slot] = b.dataset.undo.split("|"), day = Sched.day();
      Sched.log = Sched.log.filter((e) => !(e.med === id && e.slot === slot && e.day === day)); draw();
    }));
    body.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Tap again"; return; }
      Sched.meds = Sched.meds.filter((x) => x.id !== b.dataset.del); draw();
    }));
    $("sc-more").onclick = () => { const box = $("sc-times"); if (box.children.length >= 6) return; box.insertAdjacentHTML("beforeend", `<input type="time" aria-label="Time ${box.children.length + 1}">`); box.lastElementChild.focus(); };
    $("sc-form").onsubmit = (e) => {
      e.preventDefault();
      const times = [...new Set([...$("sc-times").querySelectorAll("input")].map((i) => i.value).filter((x) => /^\d\d:\d\d$/.test(x)))].sort();
      const name = normName($("sc-name").value); if (!name || !times.length) return;
      Sched.meds = [...Sched.meds, { id: "m" + Date.now().toString(36), name, dose: normName($("sc-dose").value), times }];
      if (q.get("add")) history.replaceState(null, "", "#/schedule");
      q.delete("add"); toast(`${name} added`); draw();
    };
    $("sc-remind").onclick = async (e) => {
      const b = e.currentTarget;
      if (Reminders.on && Notification.permission === "granted") { Reminders.on = false; b.setAttribute("aria-checked", "false"); return; }
      const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      Reminders.on = p === "granted"; if (p !== "granted") toast("Notifications weren't allowed"); draw();
      if (p === "granted") Reminders.check();
    };
    $("sc-ics").onclick = () => {
      const url = URL.createObjectURL(new Blob([scheduleIcs(Sched.meds)], { type: "text/calendar" }));
      const a = document.createElement("a"); a.href = url; a.download = "pill-gate-schedule.ics"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  };
  draw();
  const t = setInterval(() => { const f = $("sc-form"); if (f && !f.contains(document.activeElement)) draw(); }, 60000);   // keeps "now" fresh, never while typing
  S.leave.push(() => clearInterval(t));
});

// ================================================================ Personal: More (the rest of the app, one tap away)
route(/^\/more$/, (v) => {
  const items = [["/history", "history", "History", "Every check, newest first"], ["/profiles", "profiles", "Profiles", "Reference runs for each medicine"],
    ["/atlas", "atlas", "Atlas", "Recalls and lots as a 3D map"], ["/settings", "settings", "Settings", "Easy mode, sounds, mode"]];
  v.innerHTML = `${head({ eyebrow: MODES[mode()] ? MODES[mode()].name + " mode" : "", title: "More", tone: "grey" })}
    <section class="more-grid">${items.map(([to, ic, t, p], i) => `<a class="card more-tile rise" style="--i:${i}" href="#${to}"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[ic]}"/></svg><b>${t}</b><small>${p}</small></a>`).join("")}
      <button type="button" class="card more-tile rise" style="--i:4" id="more-ask"><span class="dock-ic" aria-hidden="true"><i></i><i></i></span><b>Ask Pill</b><small>Questions about a result or the app</small></button>
      <a class="card more-tile rise" style="--i:5" href="#/welcome"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg><b>Change mode</b><small>Clinic, Personal or Check</small></a></section>`;
  $("more-ask").onclick = () => Dock.show();
});

// ================================================================ Ask Pill (docked on every page; a sheet with a chat)
// With a finished scan, free questions go to POST /api/scans/{id}/ask (the latest finished scan, named in the sheet).
// The help topics always answer from this fixed list, so they never cost a model call; with no scan, everything does.
const HELP = [
  { q: "How does a check work?", keys: ["how", "work", "check", "step", "start", "use", "water", "photo", "lid", "stir"],
    a: () => `Four steps. 1) Photograph the bottle label and one tablet. 2) Fill the cup with clean water to the line, close the lid and press Start: the station checks the water for ${S.config.timing.blank_s} s. 3) When it beeps, drop the tablet in, stir 5 slow circles, close the lid and press Continue. 4) For ${S.config.timing.quick_s} s (quick test) light shines through the cup and the station records how the tablet dissolves. Then you get one of three answers.` },
  { q: "What do the three answers mean?", keys: ["mean", "answer", "result", "passed", "pass", "lab", "unable", "verify", "three"],
    a: () => `Passed the screen: the dissolving curve stayed close to this product's reference at the checkpoints. Needs lab testing: it did not, so send a sample to a laboratory or show it to a pharmacist (in Clinic mode the delivery is held). Unable to verify: the station could not compare, most often because there is no reference for that product on this station yet, or the run was too short or unsteady. ${DISCLAIMER}` },
  { q: "What is a reference profile?", keys: ["reference", "profile", "build", "record", "runs", "calibrat"],
    a: () => `A reference is how a known-good tablet of the same product dissolves on this station, recorded in 3 good runs. Each new check is compared with it at ${Math.round(S.config.timing.quick_s / 5)} checkpoints (one every 5 s). Without one the answer is "Unable to verify". You can build one on the Profiles page.` },
  { q: "What can't the station tell me?", keys: ["can't", "cannot", "ingredient", "identify", "dose", "take", "doctor", "medical", "side effect"],
    a: () => `${DISCLAIMER} It does not tell you what to take or how much. For questions about your medicine, ask a pharmacist or your doctor.` },
];
const HELP_FALLBACK = "I only know this app: how a check works, what the three answers mean and what a reference profile is. Try one of the questions below. For anything about your medicine itself, ask a pharmacist.";
function helpAnswer(q) {
  const low = q.toLowerCase();
  let best = null, score = 0;
  for (const h of HELP) { const n = h.keys.filter((k) => low.includes(k)).length; if (n > score) { score = n; best = h; } }
  return best ? best.a() : HELP_FALLBACK;
}
const Dock = {
  scan: null, open: false, chats: { help: [] },
  async latest() {
    const list = await api("/api/scans").catch(() => []);
    const done = list.filter((x) => x.done).sort((a, b) => (b.created || 0) - (a.created || 0));
    this.scan = done[0] || null;
  },
  mount() {
    const b = document.createElement("button");
    b.type = "button"; b.id = "dock"; b.className = "dock"; b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML = `<span class="dock-ic" aria-hidden="true"><i></i><i></i></span><span>Ask Pill</span>`;
    b.onclick = () => this.show();
    document.body.appendChild(b);
    const w = document.createElement("div");
    w.id = "sheet-wrap"; w.className = "sheet-wrap"; w.hidden = true;
    w.innerHTML = `<div class="sheet-back" data-close></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-grab" aria-hidden="true"></div>
        <div class="row between"><div><p class="eyebrow"><span class="eb-dot"></span><span id="sheet-about">help</span></p><h2 class="serif" id="sheet-title">Ask Pill</h2></div>
          <button type="button" class="btn ghost icon" data-close aria-label="Close">✕</button></div>
        <div class="chat" id="d-chat" aria-live="polite"></div>
        <div class="suggest" id="d-suggest">${HELP.map((h, i) => `<button type="button" class="chip" data-h="${i}">${esc(h.q)}</button>`).join("")}</div>
        <div class="ask-bar"><input id="d-in" placeholder="Ask a question" aria-label="Your question"><span></span><button type="button" class="btn" id="d-go">Ask</button></div>
        <p class="footnote" id="d-note"></p>
      </section>`;
    document.body.appendChild(w);
    w.querySelectorAll("[data-close]").forEach((x) => (x.onclick = () => this.hide()));
    w.addEventListener("keydown", (e) => { if (e.key === "Escape") this.hide(); });
    w.querySelectorAll("[data-h]").forEach((x) => (x.onclick = () => this.ask(HELP[+x.dataset.h].q, true)));
    $("d-go").onclick = () => this.ask($("d-in").value);
    $("d-in").addEventListener("keydown", (e) => { if (e.key === "Enter") this.ask($("d-in").value); });
  },
  /** Hidden on Welcome and on the full Ask page (that page already is the chat). */
  place(path) { const b = $("dock"); if (!b) return; const off = path === "/welcome" || /^\/ask\//.test(path); b.hidden = off; document.body.classList.toggle("has-dock", !off); if (off && this.open) this.hide(); },
  key() { return this.scan ? this.scan.id : "help"; },
  async show() {
    this.open = true; $("sheet-wrap").hidden = false; document.body.classList.add("sheet-open");
    this.opener = document.activeElement;
    await this.latest();
    const s = this.scan;
    $("sheet-about").textContent = s ? `latest scan · ${s.drug || "unnamed"} · ${RESULT_TEXT[s.overall] || "no result"}` : "help · no finished scan yet";
    $("d-note").textContent = s ? `Typed questions are answered by ${S.config.ai ? S.config.model || "the AI" : "templates (AI off on this server)"} from scan ${s.id} only. The questions above answer from this app's help.` : "No finished scan yet, so I answer only from this app's help. I only know this app.";
    const chat = $("d-chat"); chat.innerHTML = "";
    const hist = this.scan ? (S.chats[this.scan.id] = S.chats[this.scan.id] || []) : this.chats.help;
    if (!hist.length) this.add("bot", s ? `Ask me about your latest result (${s.drug || "scan " + s.id}: ${RESULT_TEXT[s.overall] || "no result"}), or about how the station works.` : "Hi. I can explain how a check works, what the three answers mean and what a reference profile is.");
    hist.forEach((m) => this.add(m.role === "user" ? "me" : "bot", m.content));
    setTimeout(() => $("d-in").focus(), 50);
  },
  hide() {
    this.open = false; $("sheet-wrap").hidden = true; document.body.classList.remove("sheet-open");
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (this.opener && this.opener.focus) this.opener.focus();
  },
  add(who, text) { const chat = $("d-chat"), d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; chat.appendChild(d); chat.scrollTop = 1e9; return d; },
  speak(text) { if (PREF.speak && "speechSynthesis" in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } },
  async ask(q, local = false) {
    q = String(q || "").trim(); if (!q) return;
    $("d-in").value = ""; this.add("me", q);
    const s = this.scan, hist = s ? (S.chats[s.id] = S.chats[s.id] || []) : this.chats.help;
    if (local || !s) {
      const a = helpAnswer(q); hist.push({ role: "user", content: q, local: true }, { role: "assistant", content: a, local: true });
      const d = this.add("bot", a); d.classList.add("local"); this.speak(a); return;
    }
    const typing = this.add("bot", ""); typing.innerHTML = `<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>`;
    try {
      const r = await post(`/api/scans/${encodeURIComponent(s.id)}/ask`, { question: q, history: chatHistory(hist) });
      hist.push({ role: "user", content: q }, { role: "assistant", content: r.answer });
      typing.textContent = r.answer; this.speak(r.answer);
    } catch (e) { typing.textContent = "Sorry, " + e.message; }
  },
};

// ================================================================ boot
async function boot() {
  try {
    const c = await api("/api/config");
    Object.assign(S.config, c); if (!c.timing) S.config.timing = { blank_s: 10, min_s: 120, max_s: 600, quick_s: 60 };
    $("appName").textContent = c.app_name; document.title = c.app_name;
  } catch {}
  document.body.classList.toggle("easy", PREF.easy);
  Dock.mount();
  render();
  tick(); setInterval(tick, 500);
  Reminders.check(); setInterval(Reminders.check, 30000);
}
boot();
