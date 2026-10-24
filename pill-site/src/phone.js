// CSS phone mock for the Pill station app. Five screens, one anime.js loop.
// Usage: const phone = mountPhone(el, { state: 'scan', autoplay: true }); phone.play();
import { animate, createTimeline } from 'animejs';
import './phone.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STATES = ['scan', 'pass', 'needslab', 'unable', 'delivery'];

// Scan scenarios. Absorbance follows A(t) = plateau * (1 - e^(-t/tau)); glow uses its own plateau.
const LOTS = {
  'B2-07': { plateau: 0.41, glow: 0.78 },
  'TM-02': { plateau: 0.52, glow: 0.03 },
};
const TAU = 65; // seconds; at t = 63 s the curve sits at ~62% of plateau
const T_END = 63; // elapsed seconds shown at the end of the scan
const PCT_END = 62; // % of expected plateau at the end of the scan

// Chart geometry (SVG user units, viewBox 0 0 326 268).
const CH = { x0: 34, x1: 312, y0: 232, y1: 18, tMax: 100, aMax: 0.6 };
const cx = (t) => CH.x0 + (t / CH.tMax) * (CH.x1 - CH.x0);
const cy = (a) => CH.y0 - (a / CH.aMax) * (CH.y0 - CH.y1);

// Loop schedule (ms). Each segment shows one screen.
const SEGMENTS = [
  { name: 'scan', lot: 'B2-07', start: 0, end: 6000 },
  { name: 'pass', start: 6000, end: 9000 },
  { name: 'scan', lot: 'TM-02', start: 9000, end: 13000 },
  { name: 'needslab', start: 13000, end: 17000 },
  { name: 'delivery', start: 17000, end: 21000 },
];
const LOOP_MS = 21000;

const GLOW = { pass: '27 138 90', needslab: '224 83 46' };

const CHECKS = ['LED', 'dark', 'paddle', 'lid'];

function template() {
  return `
  <div class="phone__frame">
    <div class="phone__screen">
      <div class="phone__status" aria-hidden="true">
        <span class="phone__time">9:41</span>
        <span class="phone__island"></span>
        <span class="phone__icons">
          <svg viewBox="0 0 18 12" class="phone__sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
          <svg viewBox="0 0 16 12" class="phone__wifi"><path d="M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0L8 11.5Z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0L3.4 6.9Z"/><path d="M1.2 4.7a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0L1.2 4.7Z"/></svg>
          <svg viewBox="0 0 27 12" class="phone__batt"><rect x="0.5" y="0.5" width="23" height="11" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="1.6"/><path d="M25 4v4a2 2 0 0 0 0-4Z" fill-opacity=".4"/></svg>
        </span>
      </div>

      <div class="phone__views">
        <section class="pv pv--scan" data-view="scan">
          <div class="pv__bar">
            <span class="pv__app">PILL · STATION 01</span>
            <span class="pv__live"><i></i>LIVE SENSOR</span>
          </div>
          <h3 class="pv__drug">Riboflavin 100 mg (1/4 tablet) <span class="pv__lot">· lot <b data-lot>B2-07</b></span></h3>

          <div class="pv__progress">
            <div class="pv__plabel">dissolving... <b data-pct>62</b>% of expected plateau</div>
            <div class="pv__track"><div class="pv__fill" data-fill></div></div>
          </div>

          <div class="pv__chart">
            <svg viewBox="0 0 326 268" role="img" aria-label="Absorbance and 90 degree glow rising over time toward the reference band">
              <g class="ch__grid">
                <line x1="${CH.x0}" y1="${CH.y0}" x2="${CH.x1}" y2="${CH.y0}"/>
                <line x1="${CH.x0}" y1="${CH.y1}" x2="${CH.x0}" y2="${CH.y0}"/>
                ${[0.2, 0.4].map((a) => `<line class="ch__tick" x1="${CH.x0}" y1="${cy(a)}" x2="${CH.x1}" y2="${cy(a)}"/>`).join('')}
              </g>
              <g class="ch__axis">
                <text x="${CH.x0 - 6}" y="${cy(0) + 3}" text-anchor="end">0</text>
                <text x="${CH.x0 - 6}" y="${cy(0.2) + 3}" text-anchor="end">.2</text>
                <text x="${CH.x0 - 6}" y="${cy(0.4) + 3}" text-anchor="end">.4</text>
                <text x="${CH.x0 - 6}" y="${cy(0.6) + 3}" text-anchor="end">.6</text>
                <text x="${cx(0)}" y="${CH.y0 + 14}" text-anchor="start">0 s</text>
                <text x="${cx(50)}" y="${CH.y0 + 14}" text-anchor="middle">50</text>
                <text x="${cx(100)}" y="${CH.y0 + 14}" text-anchor="end">100 s</text>
                <text x="${CH.x0}" y="${CH.y0 + 30}" class="ch__name">absorbance vs time</text>
              </g>
              <rect class="ch__band" x="${CH.x0}" y="${cy(0.47)}" width="${CH.x1 - CH.x0}" height="${cy(0.36) - cy(0.47)}"/>
              <line class="ch__bandline" x1="${CH.x0}" y1="${cy(0.47)}" x2="${CH.x1}" y2="${cy(0.47)}"/>
              <line class="ch__bandline" x1="${CH.x0}" y1="${cy(0.36)}" x2="${CH.x1}" y2="${cy(0.36)}"/>
              <text class="ch__bandlabel" x="${CH.x1 - 4}" y="${cy(0.47) - 5}" text-anchor="end">reference band</text>
              <path class="ch__glow" data-glow d=""/>
              <path class="ch__abs" data-abs d=""/>
              <circle class="ch__head ch__head--glow" data-glowhead r="2.5" cx="${CH.x0}" cy="${CH.y0}"/>
              <circle class="ch__head" data-abshead r="3.5" cx="${CH.x0}" cy="${CH.y0}"/>
            </svg>
            <div class="pv__legend">
              <span><i class="plg plg--abs"></i>absorbance</span>
              <span><i class="plg plg--glow"></i>90° glow</span>
              <span><i class="plg plg--band"></i>reference band</span>
            </div>
          </div>

          <div class="pv__readouts">
            <div><span class="pv__k">temp</span><span class="pv__v">24.6 °C</span></div>
            <div><span class="pv__k">elapsed</span><span class="pv__v">t = <b data-t>63</b> s</span></div>
          </div>

          <div class="pv__ck">station checks</div>
          <ul class="pv__checks">
            ${CHECKS.map((c) => `<li><i></i>${c}</li>`).join('')}
          </ul>
        </section>

        <section class="pv pv--verdict pv--pass" data-view="pass">
          <span class="pv__app">PILL · RESULT</span>
          <span class="ptag ptag--pass"><i></i>PASS</span>
          <p class="pv__drugsm">Riboflavin 100 mg (1/4 tablet) · lot B2-07</p>
          <p class="pv__line">consistent with the riboflavin reference: this lot, one tablet</p>
          <div class="pv__nums">
            <div>plateau 0.41 · band 0.36-0.47</div>
            <div>glow 0.78 · min 0.40</div>
          </div>
          <div class="pv__rule">rule <b>P1</b></div>
        </section>

        <section class="pv pv--verdict pv--needslab" data-view="needslab">
          <span class="pv__app">PILL · RESULT</span>
          <span class="ptag ptag--lab"><i></i>NEEDS LAB</span>
          <p class="pv__drugsm">Riboflavin 100 mg (1/4 tablet) · lot TM-02</p>
          <p class="pv__line">light dropped but no green glow: not consistent with riboflavin</p>
          <div class="pv__nums">
            <div>plateau 0.52 · band 0.36-0.47</div>
            <div>glow 0.03 · min 0.40</div>
          </div>
          <div class="pv__rule">rule <b>N1</b></div>
          <div class="pv__actions">
            <button type="button" class="pbtn pbtn--fill" tabindex="-1">Hold payment</button>
            <button type="button" class="pbtn pbtn--ghost" tabindex="-1">Draft lab referral</button>
          </div>
        </section>

        <section class="pv pv--verdict pv--unable" data-view="unable">
          <span class="pv__app">PILL · RESULT</span>
          <span class="ptag ptag--unable"><i></i>UNABLE TO VERIFY</span>
          <p class="pv__drugsm">no reference loaded</p>
          <p class="pv__line">no reference for this drug on this box</p>
          <div class="pv__rule">rule <b>U1</b></div>
          <div class="pv__actions">
            <button type="button" class="pbtn pbtn--ghost" tabindex="-1">Escalate to pharmacist</button>
          </div>
        </section>

        <section class="pv pv--delivery" data-view="delivery">
          <span class="pv__app">PILL · CLINIC</span>
          <h3 class="pv__title">Delivery #118</h3>
          <p class="pv__meta">Supplier: Meridian Pharma · Lot B2-07</p>
          <div class="pv__money">
            <span>$1,240.00 held · <b>SANDBOX</b></span>
            <span class="pv__held" data-held>HELD</span>
          </div>
          <div class="pv__logk">decision log</div>
          <ol class="pv__log">
            <li><time>09:40:58</time> <b>P1</b> <span>PASS · plateau 0.41 in band 0.36-0.47</span></li>
            <li><time>09:41:02</time> <b>P1</b> <span>"release requires PASS + no recall record + amount &lt;= cap + pharmacist tap"</span></li>
            <li data-logline><time>09:41:03</time> <b>HOLD</b> <span>awaiting pharmacist tap · $1,240.00 SANDBOX</span></li>
          </ol>
          <div class="pv__actions pv__actions--3">
            <button type="button" class="pbtn pbtn--off" aria-disabled="true" tabindex="-1">Release</button>
            <button type="button" class="pbtn pbtn--fill" tabindex="-1">Hold</button>
            <button type="button" class="pbtn pbtn--ghost" tabindex="-1">Escalate</button>
          </div>
        </section>
      </div>
      <span class="phone__home" aria-hidden="true"></span>
    </div>
  </div>`;
}

function curvePath(plateau, tau, tNow, scale = 1) {
  if (tNow <= 0) return { d: '', x: cx(0), y: cy(0) };
  const n = 48;
  let d = '';
  let x = 0;
  let y = 0;
  for (let i = 0; i <= n; i++) {
    const t = (tNow * i) / n;
    x = cx(t);
    y = cy(plateau * scale * (1 - Math.exp(-t / tau)));
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return { d, x, y };
}

export function mountPhone(el, opts = {}) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.className = 'phone';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Pill station app: live scan, PASS / NEEDS LAB / UNABLE TO VERIFY results, and the clinic payment hold screen');
  root.innerHTML = template();
  el.appendChild(root);

  const frame = root.querySelector('.phone__frame');
  const views = Object.fromEntries([...root.querySelectorAll('[data-view]')].map((v) => [v.dataset.view, v]));
  const q = (sel) => root.querySelector(sel);
  const ui = {
    lot: q('[data-lot]'), pct: q('[data-pct]'), fill: q('[data-fill]'), t: q('[data-t]'),
    abs: q('[data-abs]'), glow: q('[data-glow]'), absHead: q('[data-abshead]'), glowHead: q('[data-glowhead]'),
    held: q('[data-held]'), logline: q('[data-logline]'),
  };

  let current = null;
  let lot = 'B2-07';
  let tl = null; // loop timeline
  let manual = []; // one-off animations started by setState
  let wantPlay = false; // play() requested and not paused by the caller
  let visible = true;
  let io = null;

  // ---- renderers -------------------------------------------------------
  function renderScan(p) {
    const cfg = LOTS[lot] || LOTS['B2-07'];
    ui.lot.textContent = lot;
    ui.pct.textContent = String(Math.round(PCT_END * p));
    ui.fill.style.width = `${PCT_END * p}%`;
    const tNow = T_END * p;
    ui.t.textContent = String(Math.round(tNow));
    const a = curvePath(cfg.plateau, TAU, tNow);
    const g = curvePath(cfg.glow, 50, tNow, CH.aMax); // glow plotted on a 0..1 right axis
    ui.abs.setAttribute('d', a.d);
    ui.glow.setAttribute('d', g.d);
    ui.absHead.setAttribute('cx', a.x); ui.absHead.setAttribute('cy', a.y);
    ui.glowHead.setAttribute('cx', g.x); ui.glowHead.setAttribute('cy', g.y);
    ui.absHead.style.opacity = ui.glowHead.style.opacity = p > 0 ? 1 : 0;
  }

  function setGlow(kind, v) {
    if (kind) frame.style.setProperty('--glow-rgb', GLOW[kind]);
    frame.style.setProperty('--glow', String(v));
  }

  function renderDelivery(held, log) {
    ui.held.style.opacity = held;
    ui.held.style.transform = `scale(${0.85 + 0.15 * held})`;
    ui.logline.style.opacity = log;
    ui.logline.style.transform = `translateY(${(1 - log) * 6}px)`;
  }

  // ---- screen switching --------------------------------------------------
  function show(name, instant) {
    if (name === current) return;
    const prev = current ? views[current] : null;
    const next = views[name];
    current = name;
    root.dataset.state = name;
    for (const v of Object.values(views)) {
      if (v !== next && v !== prev) { v.style.opacity = 0; v.style.visibility = 'hidden'; }
    }
    next.style.visibility = 'visible';
    if (instant || reduced || !prev) {
      next.style.opacity = 1; next.style.transform = 'none';
      if (prev) { prev.style.opacity = 0; prev.style.visibility = 'hidden'; }
      return;
    }
    animate(prev, {
      opacity: 0, y: -12, duration: 350, ease: 'inQuad',
      onComplete: () => { if (current !== prev.dataset.view) prev.style.visibility = 'hidden'; },
    });
    animate(next, { opacity: [0, 1], y: [12, 0], duration: 350, delay: 120, ease: 'outQuad' });
  }

  // Static final look of each screen.
  function finalize(name) {
    if (name === 'scan') renderScan(1);
    setGlow(name === 'pass' || name === 'needslab' ? name : null, name === 'pass' ? 1 : name === 'needslab' ? 0.8 : 0);
    if (name === 'delivery') renderDelivery(1, 1);
  }

  // ---- loop timeline -----------------------------------------------------
  const proxy = { a: 0, gp: 0, b: 0, gr: 0, held: 0, log: 0, end: 0 };

  function segmentAt(t) {
    for (const s of SEGMENTS) if (t >= s.start && t < s.end) return s;
    return SEGMENTS[SEGMENTS.length - 1];
  }

  function tick(self) {
    const t = self.iterationCurrentTime;
    const seg = segmentAt(t);
    if (seg.lot && seg.lot !== lot) lot = seg.lot;
    show(seg.name);
    if (seg.name === 'scan') renderScan(seg.lot === 'TM-02' ? proxy.b : proxy.a);
    if (seg.name === 'pass') setGlow('pass', proxy.gp);
    else if (seg.name === 'needslab') setGlow('needslab', proxy.gr);
    else setGlow(null, 0);
    if (seg.name === 'delivery') renderDelivery(proxy.held, proxy.log);
    else renderDelivery(0, 0);
  }

  function buildTimeline() {
    return createTimeline({ loop: true, autoplay: false, onUpdate: tick })
      // scan, lot B2-07: bar 0 -> 62% and chart drawn over ~4 s
      .add(proxy, { a: [0, 1], duration: 4200, ease: 'outSine' }, 0)
      // pass: green glow fades in, then out before the next screen
      .add(proxy, { gp: [0, 1], duration: 700, ease: 'outQuad' }, 6000)
      .add(proxy, { gp: [1, 0], duration: 350, ease: 'inQuad' }, 8650)
      // scan, lot TM-02
      .add(proxy, { b: [0, 1], duration: 3300, ease: 'outSine' }, 9000)
      // needslab: red glow pulses twice then holds
      .add(proxy, {
        gr: [
          { from: 0, to: 1, duration: 320 },
          { to: 0.3, duration: 320 },
          { to: 1, duration: 320 },
          { to: 0.3, duration: 320 },
          { to: 0.8, duration: 420 },
        ],
        ease: 'inOutSine',
      }, 13000)
      .add(proxy, { gr: [0.8, 0], duration: 350, ease: 'inQuad' }, 16650)
      // delivery: HELD stamp, then the HOLD line is appended to the log
      .add(proxy, { held: [0, 1], duration: 420, ease: 'outBack' }, 17500)
      .add(proxy, { log: [0, 1], duration: 500, ease: 'outQuad' }, 18400)
      // pad to full loop length
      .add(proxy, { end: [0, 1], duration: 1 }, LOOP_MS - 1);
  }

  function stopManual() {
    for (const m of manual) m.cancel();
    manual = [];
  }

  function syncPlayback() {
    if (!tl) return;
    if (wantPlay && visible) tl.resume();
    else tl.pause();
  }

  // ---- public API ----------------------------------------------------------
  function setState(name, { instant = false } = {}) {
    if (!STATES.includes(name)) throw new Error(`mountPhone: unknown state "${name}"`);
    wantPlay = false;
    syncPlayback();
    stopManual();
    if (name === 'scan') lot = 'B2-07';
    const fresh = name !== current;
    show(name, instant);
    if (instant || reduced) { finalize(name); return; }
    // Play the screen's own intro once.
    const o = { v: 0 };
    if (name === 'scan') {
      renderScan(0);
      manual.push(animate(o, { v: 1, duration: 4200, ease: 'outSine', onUpdate: () => renderScan(o.v) }));
      setGlow(null, 0);
    } else if (name === 'pass') {
      if (fresh) manual.push(animate(o, { v: 1, duration: 700, delay: 150, ease: 'outQuad', onUpdate: () => setGlow('pass', o.v) }));
      else setGlow('pass', 1);
    } else if (name === 'needslab') {
      setGlow('needslab', 0);
      manual.push(animate(o, {
        v: [{ to: 1, duration: 320 }, { to: 0.3, duration: 320 }, { to: 1, duration: 320 }, { to: 0.3, duration: 320 }, { to: 0.8, duration: 420 }],
        ease: 'inOutSine', delay: 150, onUpdate: () => setGlow('needslab', o.v),
      }));
    } else if (name === 'delivery') {
      setGlow(null, 0);
      renderDelivery(0, 0);
      const d = { held: 0, log: 0 };
      manual.push(animate(d, {
        held: { to: 1, duration: 420, delay: 400, ease: 'outBack' },
        log: { to: 1, duration: 500, delay: 1100, ease: 'outQuad' },
        onUpdate: () => renderDelivery(d.held, d.log),
      }));
    } else {
      setGlow(null, 0);
    }
  }

  function play() {
    if (reduced) { setState('pass', { instant: true }); return; }
    stopManual();
    if (!tl) tl = buildTimeline();
    wantPlay = true;
    syncPlayback();
  }

  function pause() {
    wantPlay = false;
    syncPlayback();
    for (const m of manual) m.pause();
  }

  function destroy() {
    stopManual();
    if (tl) { tl.revert(); tl = null; }
    if (io) { io.disconnect(); io = null; }
    root.remove();
  }

  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      syncPlayback();
    }, { threshold: 0.05 });
    io.observe(root);
  }

  // Initial state.
  const initial = reduced ? 'pass' : STATES.includes(opts.state) ? opts.state : 'scan';
  show(initial, true);
  finalize(initial);
  if (opts.autoplay && !reduced) play();

  return { setState, play, pause, destroy };
}
