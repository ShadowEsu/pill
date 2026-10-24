// CSS phone mock for the Pill station app.
// Every screen is a pure function of its own elapsed time (render(t, segmentMs, opts)), and each
// phone owns one anime.js timer, so several phones can run different loops on one page.
//
//   const phone = mountPhone(el, {
//     sequence: PHONE_SEQUENCES.clinic,   // [[state, ms, { lot?, caption? }], ...]
//     caption: true,                      // mono caption line under the phone
//     state: 'released',                  // static screen for reduced motion / before play()
//     autoplay: true,
//   });
//   phone.play(); phone.pause(); phone.setState('calibration'); phone.destroy();
import { animate, createTimer } from 'animejs';
import './phone.css';

export const PHONE_STATES = [
  'scan', 'pass', 'needslab', 'unable', 'delivery',
  'released', 'bottle', 'recall', 'medicines', 'calibration',
];

// Round-1 loop plus calibration at the end.
export const DEFAULT_SEQUENCE = [
  ['scan', 6000, { lot: 'B2-07' }],
  ['pass', 3000],
  ['scan', 4000, { lot: 'TM-02' }],
  ['needslab', 4000],
  ['delivery', 4000],
  ['calibration', 8000],
];

export const PHONE_SEQUENCES = {
  default: DEFAULT_SEQUENCE,
  verdict: [
    ['scan', 6000, { lot: 'B2-07' }],
    ['pass', 3400],
    ['scan', 4600, { lot: 'TM-02' }],
    ['needslab', 4200],
    ['unable', 3400],
  ],
  clinic: [
    ['bottle', 8000],
    ['scan', 5400, { lot: 'B2-07' }],
    ['pass', 3200],
    ['delivery', 3800],
    ['released', 4800],
    ['recall', 8000],
  ],
  personal: [
    ['bottle', 8000],
    ['scan', 5400, { lot: 'B2-07' }],
    ['pass', 3200],
    ['medicines', 5600],
    ['calibration', 8000],
  ],
};

const CAPTIONS = {
  scan: (o) => `Station · live scan · lot ${o.lot || 'B2-07'}`,
  pass: () => 'Result · PASS · plateau inside the reference band',
  needslab: () => 'Result · NEEDS LAB · no glow, payment held',
  unable: () => 'Result · UNABLE TO VERIFY · no reference on this box',
  delivery: () => 'Clinic · delivery #118 · payment held',
  released: () => 'Clinic · pharmacist tap · payment released · SANDBOX',
  bottle: () => 'Bottle label · lot read · openFDA recall check',
  recall: () => 'Bottle label · lot AS1413A · recall record · payment held',
  medicines: () => 'Personal · my medicines · history, not a re-test',
  calibration: () => 'Calibration · 10 reference runs set the band',
};

// Length of each screen's intro when shown with setState().
const INTRO = {
  scan: 4600, pass: 2600, needslab: 3000, unable: 2400, delivery: 2400,
  released: 4000, bottle: 7600, recall: 7600, medicines: 4600, calibration: 7600,
};

// Scan scenarios. Absorbance follows A(t) = plateau * (1 - e^(-t/tau)); glow uses its own plateau.
const LOTS = {
  'B2-07': { plateau: 0.41, glow: 0.78, ms: 4200 },
  'TM-02': { plateau: 0.52, glow: 0.03, ms: 3300 },
};
const TAU = 65; // seconds; at t = 63 s the curve sits at ~62% of plateau
const T_END = 63; // elapsed seconds shown at the end of the scan
const PCT_END = 62; // % of expected plateau at the end of the scan

// Scan chart geometry (SVG user units, viewBox 0 0 326 268).
const CH = { x0: 34, x1: 312, y0: 232, y1: 18, tMax: 100, aMax: 0.6 };
const cx = (t) => CH.x0 + (t / CH.tMax) * (CH.x1 - CH.x0);
const cy = (a) => CH.y0 - (a / CH.aMax) * (CH.y0 - CH.y1);

// Calibration chart (viewBox 0 0 326 214): ten full reference runs, plotted to plateau.
const CC = { x0: 34, x1: 312, y0: 182, y1: 14 };
const kx = (t) => CC.x0 + (t / 100) * (CC.x1 - CC.x0);
const ky = (a) => CC.y0 - (a / 0.6) * (CC.y0 - CC.y1);
const RUNS = [
  [0.405, 19], [0.418, 17], [0.398, 21], [0.426, 18], [0.412, 20],
  [0.431, 16], [0.401, 22], [0.420, 19], [0.409, 18], [0.415, 20],
];
const BAND = [0.36, 0.47];
const CAL_LINES = [
  'runs 10/10',
  'band 0.36–0.47 (mean ± 3 SD)',
  'leave-one-out 10/10 inside',
  'scatter limit 0.12',
  'go/no-go: CV 7% ≤ 15% ✓',
];

const GLOW = { pass: '27 138 90', needslab: '224 83 46', recall: '236 96 44' };
const CHECKS = ['LED', 'dark', 'paddle', 'lid'];

const BOTTLE = {
  bottle: { lot: 'B2-07' },
  recall: { lot: 'AS1413A' },
};
const FIELDS = (lot) => [
  ['drug', 'Riboflavin 100 mg'],
  ['lot', lot],
  ['maker', 'Nature’s Bounty'],
  ['expiry', '2027-03'],
];

const MEDS = [
  ['Riboflavin 100 mg', 'B2-07', 'Oct 24', 'pass'],
  ['Vitamin D3 1000 IU', 'D3-118', 'Oct 22', 'pass'],
  ['Ibuprofen 200 mg', 'IB-4471', 'Oct 19', 'unable'],
  ['Magnesium 250 mg', 'MG-30', 'Oct 15', 'pass'],
];
const TAG = {
  pass: ['ptag--pass', 'PASS'],
  lab: ['ptag--lab', 'NEEDS LAB'],
  unable: ['ptag--unable', 'UNABLE TO VERIFY'],
};

// ---- small math helpers ---------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (t, start, dur) => clamp01((t - start) / dur);
const E = {
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inQuad: (p) => p * p,
  outSine: (p) => Math.sin((p * Math.PI) / 2),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outCubic: (p) => 1 - (1 - p) ** 3,
  outBack: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
};
// Fade-out over the last `ms` of a finite segment; 0 for static screens.
const tail = (t, dur, ms = 350) => (Number.isFinite(dur) ? ramp(t, dur - ms, ms) : 0);
// Piecewise keyframes [[to, ms], ...] starting from `from` at `start`.
function keys(t, start, from, list) {
  let at = start;
  let v = from;
  for (const [to, ms] of list) {
    if (t < at + ms) return v + (to - v) * E.inOutSine(ramp(t, at, ms));
    at += ms;
    v = to;
  }
  return t < start ? from : v;
}
const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

function runPath(plateau, tau) {
  let d = '';
  for (let i = 0; i <= 40; i++) {
    const t = (100 * i) / 40;
    d += `${i ? 'L' : 'M'}${kx(t).toFixed(1)} ${ky(plateau * (1 - Math.exp(-t / tau))).toFixed(1)}`;
  }
  return d;
}

// ---- templates ------------------------------------------------------------
const STATUS = `
      <div class="phone__status" aria-hidden="true">
        <span class="phone__time">9:41</span>
        <span class="phone__island"></span>
        <span class="phone__icons">
          <svg viewBox="0 0 18 12" class="phone__sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
          <svg viewBox="0 0 16 12" class="phone__wifi"><path d="M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0L8 11.5Z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0L3.4 6.9Z"/><path d="M1.2 4.7a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0L1.2 4.7Z"/></svg>
          <svg viewBox="0 0 27 12" class="phone__batt"><rect x="0.5" y="0.5" width="23" height="11" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="1.6"/><path d="M25 4v4a2 2 0 0 0 0-4Z" fill-opacity=".4"/></svg>
        </span>
      </div>`;

const scanView = () => `
        <section class="pv pv--scan" data-view="scan">
          <div class="pv__bar">
            <span class="pv__app">PILL · STATION 01</span>
            <span class="pv__live"><i></i>LIVE SENSOR</span>
          </div>
          <h3 class="pv__drug">Riboflavin 100 mg (1/4 tablet) <span class="pv__lot">· lot <b data-k="lot">B2-07</b></span></h3>

          <div class="pv__progress">
            <div class="pv__plabel">dissolving... <b data-k="pct">62</b>% of expected plateau</div>
            <div class="pv__track"><div class="pv__fill" data-k="fill"></div></div>
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
              <path class="ch__glow" data-k="glow" d=""/>
              <path class="ch__abs" data-k="abs" d=""/>
              <circle class="ch__head ch__head--glow" data-k="glowhead" r="2.5" cx="${CH.x0}" cy="${CH.y0}"/>
              <circle class="ch__head" data-k="abshead" r="3.5" cx="${CH.x0}" cy="${CH.y0}"/>
            </svg>
            <div class="pv__legend">
              <span><i class="plg plg--abs"></i>absorbance</span>
              <span><i class="plg plg--glow"></i>90° glow</span>
              <span><i class="plg plg--band"></i>reference band</span>
            </div>
          </div>

          <div class="pv__readouts">
            <div><span class="pv__k">temp</span><span class="pv__v">24.6 °C</span></div>
            <div><span class="pv__k">elapsed</span><span class="pv__v">t = <b data-k="t">63</b> s</span></div>
          </div>

          <div class="pv__ck">station checks</div>
          <ul class="pv__checks">
            ${CHECKS.map((c, i) => `<li data-k="check${i}"><i></i>${c}</li>`).join('')}
          </ul>
        </section>`;

const verdictView = (name, tag, drug, line, nums, rule, actions) => `
        <section class="pv pv--verdict pv--${name}" data-view="${name}">
          <span class="pv__app">PILL · RESULT</span>
          <span class="ptag ${TAG[tag][0]}" data-k="tag"><i></i>${TAG[tag][1]}</span>
          <p class="pv__drugsm" data-k="drug">${drug}</p>
          <p class="pv__line" data-k="line" data-type>${line}</p>
          ${nums ? `<div class="pv__nums" data-k="nums">${nums.map((n, i) => `<div data-k="num${i}">${n}</div>`).join('')}</div>` : ''}
          <div class="pv__rule" data-k="rule">rule <b>${rule}</b></div>
          ${actions ? `<div class="pv__actions" data-k="actions">${actions}</div>` : ''}
        </section>`;

const deliveryView = () => `
        <section class="pv pv--delivery" data-view="delivery">
          <span class="pv__app">PILL · CLINIC</span>
          <h3 class="pv__title" data-k="title">Delivery #118</h3>
          <p class="pv__meta" data-k="meta">Supplier: Meridian Pharma · Lot B2-07</p>
          <div class="pv__money" data-k="money">
            <span>$1,240.00 held · <b>SANDBOX</b></span>
            <span class="pv__held" data-k="held">HELD</span>
          </div>
          <div class="pv__logk">decision log</div>
          <ol class="pv__log">
            <li data-k="log0"><time>09:40:58</time> <b>P1</b> <span>PASS · plateau 0.41 in band 0.36-0.47</span></li>
            <li data-k="log1"><time>09:41:02</time> <b>P1</b> <span>"release requires PASS + no recall record + amount &lt;= cap + pharmacist tap"</span></li>
            <li data-k="log2"><time>09:41:03</time> <b>HOLD</b> <span data-k="log2t" data-type>awaiting pharmacist tap · $1,240.00 SANDBOX</span></li>
          </ol>
          <div class="pv__actions pv__actions--3" data-k="actions">
            <button type="button" class="pbtn pbtn--off" aria-disabled="true" tabindex="-1">Release</button>
            <button type="button" class="pbtn pbtn--fill" tabindex="-1">Hold</button>
            <button type="button" class="pbtn pbtn--ghost" tabindex="-1">Escalate</button>
          </div>
        </section>`;

const BAL = [
  ['Clinic', 8760, 8760],
  ['Pill Escrow', 1240, 0],
  ['Supplier', 3100, 4340],
];
const releasedView = () => `
        <section class="pv pv--delivery pv--released" data-view="released">
          <span class="pv__app">PILL · CLINIC</span>
          <h3 class="pv__title">Delivery #118</h3>
          <p class="pv__meta">Supplier: Meridian Pharma · Lot B2-07</p>
          <div class="pv__money">
            <span class="pv__swap">
              <span data-k="mheld">$1,240.00 held · <b>SANDBOX</b></span>
              <span data-k="mrel">$1,240.00 released · <b>SANDBOX</b></span>
            </span>
            <span class="pv__swap pv__swap--stamp">
              <span class="pv__held" data-k="held">HELD</span>
              <span class="pv__held pv__held--ok" data-k="rel">RELEASED</span>
            </span>
          </div>
          <div class="pv__logk">decision log</div>
          <ol class="pv__log">
            <li><time>09:40:58</time> <b>P1</b> <span>PASS · plateau 0.41 in band 0.36-0.47</span></li>
            <li><time>09:41:03</time> <b class="pv__b--hold">HOLD</b> <span>awaiting pharmacist tap · $1,240.00 SANDBOX</span></li>
            <li class="pv__lognew" data-k="log"><time>09:41:12</time> <span data-k="logt" data-type>· released · $1,240.00 → Meridian Pharma · SANDBOX</span></li>
          </ol>
          <div class="pv__logk">balances · <b class="pv__sbx">SANDBOX</b></div>
          <div class="pv__bal">
            ${BAL.map(([n], i) => `<div class="pv__balrow" data-k="bal${i}"><span>${n}</span><b data-k="balv${i}"></b><i data-k="bald${i}"></i></div>`).join('')}
          </div>
          <div class="pv__actions pv__actions--3">
            <button type="button" class="pbtn pbtn--release" data-k="release" tabindex="-1"><span class="pbtn__fx" data-k="releasefx"></span><span class="pbtn__l">Release</span><span class="pv__tapfx" data-k="tap"></span></button>
            <button type="button" class="pbtn pbtn--off" aria-disabled="true" tabindex="-1">Hold</button>
            <button type="button" class="pbtn pbtn--off" aria-disabled="true" tabindex="-1">Escalate</button>
          </div>
        </section>`;

const bottleView = (kind, uid) => {
  const { lot } = BOTTLE[kind];
  const alert = kind === 'recall';
  return `
        <section class="pv pv--bottle pv--${kind}" data-view="${kind}">
          <div class="pv__bar">
            <span class="pv__app">PILL · BOTTLE CHECK</span>
            <span class="pv__live pv__live--cam"><i></i>CAMERA</span>
          </div>
          <h3 class="pv__title pv__title--sm">Scan the label</h3>
          <div class="pv__vf" data-k="vf">
            <svg viewBox="0 0 350 232" role="img" aria-label="Camera viewfinder reading a bottle label">
              <defs>
                <linearGradient id="${uid}-${kind}-sweep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#2F6BFF" stop-opacity="0"/>
                  <stop offset="1" stop-color="#2F6BFF" stop-opacity="0.32"/>
                </linearGradient>
              </defs>
              <g class="pv__vfc">
                <path d="M14 42V14h28"/><path d="M308 14h28v28"/><path d="M336 190v28h-28"/><path d="M42 218H14v-28"/>
              </g>
              <g class="pv__btl">
                <rect x="141" y="22" width="68" height="26" rx="5"/>
                <path d="M151 27v16M160 27v16M169 27v16M178 27v16M187 27v16M196 27v16" class="pv__btl-ridge"/>
                <path d="M150 48h50v8c0 4 20 6 30 12 6 4 8 9 8 16v114c0 9-6 14-14 14H126c-8 0-14-5-14-14V84c0-7 2-12 8-16 10-6 30-8 30-12Z"/>
                <rect x="122" y="96" width="106" height="92" rx="4" class="pv__lbl"/>
                <text x="175" y="114" text-anchor="middle" class="pv__lt pv__lt--big">RIBOFLAVIN</text>
                <text x="175" y="126" text-anchor="middle" class="pv__lt">100 mg · 100 tablets</text>
                <text x="175" y="142" text-anchor="middle" class="pv__lt">Nature’s Bounty</text>
                <text x="132" y="164" class="pv__lt">LOT ${lot}</text>
                <text x="132" y="176" class="pv__lt">EXP 2027-03</text>
                <path d="M196 158v22M199 158v22M201 158v22M205 158v22M207 158v22M211 158v22M214 158v22M216 158v22" class="pv__btl-bars"/>
              </g>
              <g class="pv__boxes">
                <rect data-k="box0" x="127" y="104" width="96" height="26" rx="3"/>
                <rect data-k="box1" x="128" y="155" width="${alert ? 62 : 50}" height="12" rx="3"/>
                <rect data-k="box2" x="137" y="133" width="76" height="13" rx="3"/>
                <rect data-k="box3" x="128" y="167" width="58" height="12" rx="3"/>
              </g>
              <g data-k="scan">
                <rect x="14" y="-34" width="322" height="34" fill="url(#${uid}-${kind}-sweep)"/>
                <line x1="14" y1="0" x2="336" y2="0" class="pv__scanline"/>
              </g>
              <text x="175" y="224" text-anchor="middle" class="pv__vft" data-k="vfa">reading label…</text>
              <text x="175" y="224" text-anchor="middle" class="pv__vft pv__vft--ok" data-k="vfb">label read · 4 fields</text>
            </svg>
          </div>
          <div class="pv__fields" data-k="fields">
            ${FIELDS(lot).map(([k, v], i) => `<div data-k="f${i}"><span class="pv__k">${k}</span><span class="pv__fv" data-k="fv${i}" data-type>${v}</span></div>`).join('')}
          </div>
          <div class="pv__chip" data-k="chip">
            <span class="pv__chipl pv__chipl--wait" data-k="chipa"><i class="pv__spin" data-k="spin"></i>checking openFDA…</span>
            <span class="pv__chipl ${alert ? 'pv__chipl--recall' : 'pv__chipl--none'}" data-k="chipb">
              <span class="pv__chipm"><i></i>${alert ? 'RECALL D-1515-2016 · Class II' : 'no openFDA record for this lot'}</span>
              <span class="pv__chips"><span data-k="sub" data-type>${alert ? 'payment HELD' : 'live · 2 s'}</span>${alert ? '<span class="pv__chipr">live · 2 s</span>' : ''}</span>
            </span>
          </div>
          <p class="pv__hint" data-k="hint"><span data-k="hintt" data-type>${alert ? 'scan blocked · recall record on this lot' : 'next · drop 1/4 tablet into the station'}</span></p>
          <div class="pv__actions">
            <button type="button" class="pbtn ${alert ? 'pbtn--off' : 'pbtn--fill'}" data-k="btn" tabindex="-1">Start scan</button>
          </div>
        </section>`;
};

const medicinesView = () => `
        <section class="pv pv--meds" data-view="medicines">
          <div class="pv__bar">
            <span class="pv__app">PILL · PERSONAL</span>
            <span class="pv__count">4 items</span>
          </div>
          <h3 class="pv__title" data-k="title">My medicines</h3>
          <p class="pv__meta" data-k="meta">results saved from station scans</p>
          <ul class="pv__meds">
            ${MEDS.map(([drug, lot, date, v], i) => `
            <li class="pv__med" data-k="m${i}">
              <div class="pv__medl">
                <span class="pv__medn">${drug}</span>
                <span class="pv__medm">lot ${lot} · ${date}</span>
                <span class="pv__medm">recall · no record</span>
              </div>
              <div class="pv__medr">
                <span class="ptag ptag--sm ${TAG[v][0]}"><i></i>${TAG[v][1]}</span>
                ${i === 0 ? '<span class="pv__taken" data-k="taken">taken 08:30</span>' : ''}
              </div>
              ${i === 0 ? '<span class="pv__tapfx" data-k="tap"></span>' : ''}
            </li>`).join('')}
          </ul>
          <p class="pv__banner" data-k="banner"><i></i><span data-k="bannert" data-type>Measuring a dose needs the station. This list does not re-test.</span></p>
        </section>`;

const calibrationView = () => `
        <section class="pv pv--cal" data-view="calibration">
          <div class="pv__bar">
            <span class="pv__app">PILL · REFERENCE</span>
            <span class="pv__live"><i></i>LIVE SENSOR</span>
          </div>
          <h3 class="pv__title" data-k="title">Calibration · station 01</h3>
          <p class="pv__meta" data-k="meta">riboflavin · B2 · ten known-good tablets</p>
          <div class="pv__chart pv__chart--cal">
            <svg viewBox="0 0 326 214" role="img" aria-label="Ten reference runs settling into a grey band">
              <g class="ch__grid">
                <line x1="${CC.x0}" y1="${CC.y0}" x2="${CC.x1}" y2="${CC.y0}"/>
                <line x1="${CC.x0}" y1="${CC.y1}" x2="${CC.x0}" y2="${CC.y0}"/>
                ${[0.2, 0.4].map((a) => `<line class="ch__tick" x1="${CC.x0}" y1="${ky(a)}" x2="${CC.x1}" y2="${ky(a)}"/>`).join('')}
              </g>
              <g class="ch__axis">
                <text x="${CC.x0 - 6}" y="${ky(0) + 3}" text-anchor="end">0</text>
                <text x="${CC.x0 - 6}" y="${ky(0.2) + 3}" text-anchor="end">.2</text>
                <text x="${CC.x0 - 6}" y="${ky(0.4) + 3}" text-anchor="end">.4</text>
                <text x="${CC.x0 - 6}" y="${ky(0.6) + 3}" text-anchor="end">.6</text>
                <text x="${kx(0)}" y="${CC.y0 + 14}" text-anchor="start">0 s</text>
                <text x="${kx(100)}" y="${CC.y0 + 14}" text-anchor="end">100 s</text>
                <text x="${kx(50)}" y="${CC.y0 + 14}" text-anchor="middle" class="ch__name">absorbance, 10 runs</text>
              </g>
              <g data-k="band" class="ch__calband">
                <rect class="ch__band ch__band--cal" x="${CC.x0}" y="${ky(BAND[1])}" width="${CC.x1 - CC.x0}" height="${ky(BAND[0]) - ky(BAND[1])}"/>
                <line class="ch__bandline" x1="${CC.x0}" y1="${ky(BAND[1])}" x2="${CC.x1}" y2="${ky(BAND[1])}"/>
                <line class="ch__bandline" x1="${CC.x0}" y1="${ky(BAND[0])}" x2="${CC.x1}" y2="${ky(BAND[0])}"/>
              </g>
              <text class="ch__bandlabel" data-k="bandlabel" x="${CC.x1 - 4}" y="${ky(BAND[1]) - 6}" text-anchor="end">band 0.36–0.47</text>
              ${RUNS.map(([p, tau], i) => `<path class="ch__run" data-k="run${i}" pathLength="1" d="${runPath(p, tau)}"/>`).join('')}
              <text class="ch__runs" data-k="runs" x="${CC.x0 + 8}" y="${CC.y1 + 10}">run 0/10</text>
            </svg>
          </div>
          <div class="pv__cal">
            ${CAL_LINES.map((l, i) => `<div class="pv__cl${i === CAL_LINES.length - 1 ? ' pv__cl--ok' : ''}" data-k="cl${i}" data-type>${l}</div>`).join('')}
          </div>
          <div class="pv__toast" data-k="toast"><i></i>reference saved · riboflavin · B2</div>
          <div class="pv__actions">
            <button type="button" class="pbtn pbtn--fill" data-k="save" tabindex="-1">Save reference</button>
          </div>
        </section>`;

function template(uid) {
  return `
  <div class="phone__frame">
    <div class="phone__screen">${STATUS}
      <div class="phone__views">${scanView()}
${verdictView('pass', 'pass', 'Riboflavin 100 mg (1/4 tablet) · lot B2-07',
    'consistent with the riboflavin reference: this lot, one tablet',
    ['plateau 0.41 · band 0.36-0.47', 'glow 0.78 · min 0.40'], 'P1')}
${verdictView('needslab', 'lab', 'Riboflavin 100 mg (1/4 tablet) · lot TM-02',
    'light dropped but no green glow: not consistent with riboflavin',
    ['plateau 0.52 · band 0.36-0.47', 'glow 0.03 · min 0.40'], 'N2',
    `<button type="button" class="pbtn pbtn--fill" tabindex="-1">Hold payment</button>
            <button type="button" class="pbtn pbtn--ghost" tabindex="-1">Draft lab referral</button>`)}
${verdictView('unable', 'unable', 'no reference loaded',
    'no reference for this drug on this box', null, 'U1',
    '<button type="button" class="pbtn pbtn--ghost" tabindex="-1">Escalate to pharmacist</button>')}
${deliveryView()}${releasedView()}${bottleView('bottle', uid)}${bottleView('recall', uid)}${medicinesView()}${calibrationView()}
      </div>
      <span class="phone__home" aria-hidden="true"></span>
    </div>
  </div>`;
}

// Typing: the untyped remainder stays in the DOM as transparent text so layout never shifts.
function makeTyper(el) {
  const full = el.textContent;
  el.textContent = '';
  const a = document.createElement('span');
  const caret = document.createElement('i');
  caret.className = 'pv__caret';
  const b = document.createElement('span');
  b.className = 'pv__ghost';
  el.append(a, caret, b);
  let last = -1;
  const fn = (p) => {
    const n = Math.round(full.length * clamp01(p));
    if (n !== last) {
      a.textContent = full.slice(0, n);
      b.textContent = full.slice(n);
      last = n;
    }
    caret.style.visibility = p > 0 && p < 1 ? 'visible' : 'hidden';
  };
  fn.len = full.length;
  return fn;
}

function fade(el, v, dy = 8) {
  if (!el) return;
  el.style.opacity = v;
  el.style.transform = v >= 1 ? '' : `translateY(${((1 - v) * dy).toFixed(2)}px)`;
}

let uidCount = 0;

export function mountPhone(el, opts = {}) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uid = `phone${++uidCount}`;

  const root = document.createElement('div');
  root.className = 'phone';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Pill station app: bottle check, live scan, PASS / NEEDS LAB / UNABLE TO VERIFY results, clinic payment hold and release, my medicines, and station calibration');
  root.innerHTML = template(uid);
  el.appendChild(root);

  let captionEl = null;
  if (opts.caption) {
    captionEl = document.createElement('p');
    captionEl.className = 'phone__caption';
    captionEl.setAttribute('aria-live', 'off');
    el.appendChild(captionEl);
  }

  const frame = root.querySelector('.phone__frame');
  const views = {};
  const els = {};
  const typers = new Map();
  for (const v of root.querySelectorAll('[data-view]')) {
    const name = v.dataset.view;
    views[name] = v;
    els[name] = {};
    for (const n of v.querySelectorAll('[data-k]')) els[name][n.dataset.k] = n;
    for (const n of v.querySelectorAll('[data-type]')) typers.set(n, makeTyper(n));
  }
  const type = (node, p) => typers.get(node)(p);
  const typeMs = (node, perChar) => typers.get(node).len * perChar;

  let current = null;
  let timer = null; // loop timer
  let manual = null; // one-off intro timer started by setState
  let wantPlay = false;
  let visible = true;
  let io = null;
  let capAnim = null;
  let capText = null;

  const sequence = (Array.isArray(opts.sequence) && opts.sequence.length ? opts.sequence : DEFAULT_SEQUENCE)
    .map(([name, ms, o = {}]) => {
      if (!PHONE_STATES.includes(name)) throw new Error(`mountPhone: unknown state "${name}" in sequence`);
      return { name, ms: Math.max(500, ms | 0), o };
    });
  let acc = 0;
  for (const s of sequence) { s.start = acc; acc += s.ms; }
  const loopMs = acc;

  // ---- frame glow -----------------------------------------------------------
  function setGlow(kind, v) {
    if (kind) frame.style.setProperty('--glow-rgb', GLOW[kind]);
    frame.style.setProperty('--glow', v.toFixed(3));
  }

  // ---- renderers: render(t ms since screen start, segment ms or Infinity, opts) ----
  const R = {};

  R.scan = (t, dur, o) => {
    const e = els.scan;
    const lot = LOTS[o.lot] ? o.lot : 'B2-07';
    const cfg = LOTS[lot];
    const p = E.outSine(ramp(t, 150, cfg.ms));
    e.lot.textContent = lot;
    e.pct.textContent = String(Math.round(PCT_END * p));
    e.fill.style.width = `${PCT_END * p}%`;
    const tNow = T_END * p;
    e.t.textContent = String(Math.round(tNow));
    const a = curvePath(cfg.plateau, TAU, tNow);
    const g = curvePath(cfg.glow, 50, tNow, CH.aMax); // glow plotted on a 0..1 right axis
    e.abs.setAttribute('d', a.d);
    e.glow.setAttribute('d', g.d);
    e.abshead.setAttribute('cx', a.x); e.abshead.setAttribute('cy', a.y);
    e.glowhead.setAttribute('cx', g.x); e.glowhead.setAttribute('cy', g.y);
    e.abshead.style.opacity = e.glowhead.style.opacity = p > 0 ? 1 : 0;
    CHECKS.forEach((_, i) => {
      const v = E.outBack(ramp(t, 120 + i * 160, 260));
      const li = e[`check${i}`];
      li.style.opacity = 0.35 + 0.65 * clamp01(v);
      li.firstElementChild.style.transform = `scale(${Math.max(0, v)})`;
    });
    setGlow(null, 0);
  };

  function verdict(name, t) {
    const e = els[name];
    const s = ramp(t, 80, 440);
    e.tag.style.opacity = clamp01(s * 2.5);
    e.tag.style.transform = `scale(${(0.8 + 0.2 * E.outBack(s)).toFixed(3)})`;
    fade(e.drug, E.outQuad(ramp(t, 280, 300)));
    const tl = 420;
    const tlEnd = tl + typeMs(e.line, 17);
    type(e.line, ramp(t, tl, tlEnd - tl));
    let t2 = tlEnd + 80;
    if (e.nums) {
      fade(e.nums, E.outQuad(ramp(t, t2, 280)));
      fade(e.num0, ramp(t, t2 + 80, 260), 4);
      fade(e.num1, ramp(t, t2 + 220, 260), 4);
      t2 += 300;
    }
    fade(e.rule, E.outQuad(ramp(t, t2, 280)));
    if (e.actions) fade(e.actions, E.outQuad(ramp(t, t2 + 160, 340)), 12);
  }

  R.pass = (t, dur) => {
    verdict('pass', t);
    setGlow('pass', E.outQuad(ramp(t, 150, 700)) * (1 - E.inQuad(tail(t, dur))));
  };

  R.needslab = (t, dur) => {
    verdict('needslab', t);
    const g = keys(t, 150, 0, [[1, 320], [0.3, 320], [1, 320], [0.3, 320], [0.8, 420]]);
    setGlow('needslab', g * (1 - E.inQuad(tail(t, dur))));
  };

  R.unable = (t) => {
    verdict('unable', t);
    setGlow(null, 0);
  };

  R.delivery = (t) => {
    const e = els.delivery;
    fade(e.title, E.outQuad(ramp(t, 60, 300)));
    fade(e.meta, E.outQuad(ramp(t, 160, 300)));
    fade(e.money, E.outQuad(ramp(t, 260, 320)));
    const h = ramp(t, 520, 420);
    e.held.style.opacity = clamp01(h * 2);
    e.held.style.transform = `scale(${(0.85 + 0.15 * E.outBack(h)).toFixed(3)})`;
    fade(e.log0, ramp(t, 700, 260), 6);
    fade(e.log1, ramp(t, 860, 260), 6);
    fade(e.log2, ramp(t, 1100, 260), 6);
    type(e.log2t, ramp(t, 1180, typeMs(e.log2t, 16)));
    fade(e.actions, E.outQuad(ramp(t, 1500, 340)), 12);
    setGlow(null, 0);
  };

  R.released = (t, dur) => {
    const e = els.released;
    // Pharmacist tap on Release.
    const down = ramp(t, 260, 140);
    const up = ramp(t, 400, 260);
    e.release.style.transform = `scale(${(1 - 0.06 * (down - E.outQuad(up))).toFixed(4)})`;
    e.releasefx.style.opacity = E.outQuad(ramp(t, 300, 300));
    const tap = ramp(t, 260, 600);
    e.tap.style.opacity = tap > 0 && tap < 1 ? (0.55 * (1 - tap)).toFixed(3) : 0;
    e.tap.style.transform = `translate(-50%, -50%) scale(${(0.3 + 1.4 * E.outQuad(tap)).toFixed(3)})`;
    // Stamp and money label swap HELD -> RELEASED.
    const r = ramp(t, 620, 380);
    e.held.style.opacity = 1 - clamp01(r * 2);
    e.held.style.transform = `scale(${(1 - 0.15 * r).toFixed(3)})`;
    e.rel.style.opacity = clamp01(r * 2 - 0.4);
    e.rel.style.transform = `scale(${(0.8 + 0.2 * E.outBack(r)).toFixed(3)})`;
    e.mheld.style.opacity = 1 - r;
    e.mrel.style.opacity = r;
    // New log line types in.
    fade(e.log, ramp(t, 950, 220), 6);
    type(e.logt, ramp(t, 1020, typeMs(e.logt, 17)));
    // Balances count down / up.
    const c = E.outCubic(ramp(t, 2000, 1300));
    BAL.forEach(([, from, to], i) => {
      e[`balv${i}`].textContent = money(from + (to - from) * c);
      const d = to - from;
      e[`bald${i}`].textContent = d === 0 ? '±0.00' : `${d < 0 ? '−' : '+'}${money(Math.abs(d)).slice(1)}`;
      e[`bald${i}`].className = d < 0 ? 'is-down' : d > 0 ? 'is-up' : '';
      fade(e[`bald${i}`], ramp(t, 3200 + i * 90, 260), 4);
      const live = d !== 0 && t >= 2000 && t < 3500 ? 1 : 0;
      e[`bal${i}`].classList.toggle('is-live', !!live);
    });
    setGlow('pass', 0.7 * E.outQuad(ramp(t, 620, 500)) * (1 - E.inQuad(tail(t, dur, 400))));
  };

  function bottle(kind, t, dur) {
    const e = els[kind];
    const alert = kind === 'recall';
    // Two scanning sweeps, top to bottom.
    const sweeping = t >= 250 && t < 2450;
    const s = sweeping ? ((t - 250) % 1100) / 1100 : t >= 2450 ? 1 : 0;
    const y = 16 + E.inOutSine(s) * 202;
    e.scan.setAttribute('transform', `translate(0 ${y.toFixed(1)})`);
    e.scan.style.opacity = t < 250 ? 0 : sweeping ? 1 : 1 - ramp(t, 2450, 220);
    const read = ramp(t, 4700, 300);
    e.vfa.style.opacity = 1 - read;
    e.vfb.style.opacity = read;
    // Fields type in one by one, each lighting its box on the label.
    for (let i = 0; i < 4; i++) {
      const st = 2550 + i * 560;
      fade(e[`f${i}`], E.outQuad(ramp(t, st, 220)), 6);
      type(e[`fv${i}`], ramp(t, st + 80, typeMs(e[`fv${i}`], 30)));
      const box = ramp(t, st, 160) * (1 - 0.65 * ramp(t, st + 650, 400));
      e[`box${i}`].style.opacity = box.toFixed(3);
    }
    // openFDA recall lookup.
    fade(e.chip, E.outQuad(ramp(t, 4850, 320)), 10);
    const res = ramp(t, 6000, 320);
    e.chipa.style.opacity = 1 - res;
    e.chipb.style.opacity = res;
    e.chipb.style.transform = `scale(${(0.96 + 0.04 * E.outBack(res)).toFixed(4)})`;
    e.spin.style.transform = `rotate(${(t * 0.5) % 360}deg)`;
    type(e.sub, ramp(t, 6250, typeMs(e.sub, 32)));
    e.vf.classList.toggle('is-alert', alert && t >= 6000);
    fade(e.fields, E.outQuad(ramp(t, 2400, 260)), 6);
    e.hint.style.opacity = t >= 6450 ? 1 : 0;
    type(e.hintt, ramp(t, 6450, typeMs(e.hintt, 16)));
    if (alert) {
      setGlow('recall', 0.9 * E.outQuad(ramp(t, 6000, 600)) * (1 - E.inQuad(tail(t, dur, 400))));
    } else {
      e.btn.style.opacity = (0.35 + 0.65 * ramp(t, 6400, 300)).toFixed(3);
      const down = ramp(t, 6950, 130);
      const up = ramp(t, 7080, 240);
      e.btn.style.transform = `scale(${(1 - 0.04 * (down - E.outQuad(up))).toFixed(4)})`;
      setGlow(null, 0);
    }
  }
  R.bottle = (t, dur) => bottle('bottle', t, dur);
  R.recall = (t, dur) => bottle('recall', t, dur);

  R.medicines = (t) => {
    const e = els.medicines;
    fade(e.title, E.outQuad(ramp(t, 60, 300)));
    fade(e.meta, E.outQuad(ramp(t, 160, 300)));
    for (let i = 0; i < MEDS.length; i++) fade(e[`m${i}`], E.outCubic(ramp(t, 320 + i * 150, 380)), 14);
    // Tap on row 1, then the taken stamp slides in.
    const tap = ramp(t, 1500, 650);
    e.tap.style.opacity = tap > 0 && tap < 1 ? (0.5 * (1 - tap)).toFixed(3) : 0;
    e.tap.style.transform = `translate(-50%, -50%) scale(${(0.3 + 1.6 * E.outQuad(tap)).toFixed(3)})`;
    e.m0.classList.toggle('is-tapped', t >= 1500 && t < 2100);
    const k = ramp(t, 1800, 420);
    e.taken.style.opacity = clamp01(k * 2);
    e.taken.style.transform = `translateX(${((1 - E.outBack(k)) * 26).toFixed(2)}px)`;
    fade(e.banner, E.outQuad(ramp(t, 2400, 320)), 10);
    type(e.bannert, ramp(t, 2500, typeMs(e.bannert, 18)));
    setGlow(null, 0);
  };

  R.calibration = (t) => {
    const e = els.calibration;
    fade(e.title, E.outQuad(ramp(t, 60, 300)));
    fade(e.meta, E.outQuad(ramp(t, 160, 300)));
    let started = 0;
    const settle = E.inOutSine(ramp(t, 3300, 700));
    for (let i = 0; i < RUNS.length; i++) {
      const st = 250 + i * 250;
      if (t >= st) started++;
      const p = E.outSine(ramp(t, st, 900));
      const run = e[`run${i}`];
      run.style.strokeDashoffset = (1 - p).toFixed(4);
      run.style.opacity = p > 0 ? (0.9 - 0.55 * settle).toFixed(3) : 0;
    }
    e.runs.textContent = `run ${started}/10`;
    e.band.style.opacity = settle.toFixed(3);
    e.band.style.transform = `scaleY(${(0.2 + 0.8 * settle).toFixed(4)})`;
    e.bandlabel.style.opacity = settle.toFixed(3);
    let st = 3750;
    for (let i = 0; i < CAL_LINES.length; i++) {
      const line = e[`cl${i}`];
      line.style.opacity = t >= st ? 1 : 0;
      type(line, ramp(t, st, typeMs(line, 15)));
      st += typeMs(line, 15) + 120;
    }
    const down = ramp(t, st + 100, 140);
    const up = ramp(t, st + 240, 260);
    e.save.style.transform = `scale(${(1 - 0.05 * (down - E.outQuad(up))).toFixed(4)})`;
    e.save.classList.toggle('is-done', t >= st + 240);
    const k = ramp(t, st + 360, 420);
    e.toast.style.opacity = clamp01(k * 1.6).toFixed(3);
    e.toast.style.transform = `translateY(${((1 - E.outBack(k)) * 18).toFixed(2)}px)`;
    setGlow(null, 0);
  };

  // ---- caption ----------------------------------------------------------------
  function setCaption(name, o, instant) {
    if (!captionEl) return;
    const text = o.caption || CAPTIONS[name](o);
    if (text === capText) return;
    capText = text;
    if (capAnim) { capAnim.cancel(); capAnim = null; }
    if (instant || reduced || !captionEl.textContent) {
      captionEl.textContent = text;
      captionEl.style.opacity = 1;
      return;
    }
    capAnim = animate(captionEl, {
      opacity: 0, duration: 180, ease: 'inQuad',
      onComplete: () => {
        captionEl.textContent = text;
        capAnim = animate(captionEl, { opacity: 1, duration: 320, delay: 80, ease: 'outQuad', onComplete: () => { capAnim = null; } });
      },
    });
  }

  // ---- screen switching --------------------------------------------------------
  function show(name, o, instant) {
    setCaption(name, o, instant);
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

  // ---- loop ----------------------------------------------------------------------
  let seg = null;
  function tick(self) {
    const t = Math.min(self.iterationCurrentTime, loopMs - 1);
    let s = sequence[sequence.length - 1];
    for (const x of sequence) if (t < x.start + x.ms) { s = x; break; }
    if (s !== seg) { seg = s; show(s.name, s.o); }
    R[s.name](t - s.start, s.ms, s.o);
  }

  function stopManual() {
    if (manual) { manual.cancel(); manual = null; }
  }

  function syncPlayback() {
    const run = wantPlay && visible;
    if (timer) { if (run) timer.resume(); else timer.pause(); }
    if (manual) { if (visible) manual.resume(); else manual.pause(); }
  }

  // ---- public API ------------------------------------------------------------------
  function setState(name, { instant = false, lot, caption } = {}) {
    if (!PHONE_STATES.includes(name)) throw new Error(`mountPhone: unknown state "${name}"`);
    wantPlay = false;
    if (timer) timer.pause();
    stopManual();
    seg = null;
    const o = { lot, caption };
    show(name, o, instant);
    if (instant || reduced) { R[name](Infinity, Infinity, o); return; }
    R[name](0, Infinity, o);
    manual = createTimer({
      duration: INTRO[name],
      onUpdate: (self) => R[name](self.currentTime, Infinity, o),
      onComplete: () => { R[name](Infinity, Infinity, o); manual = null; },
    });
    syncPlayback();
  }

  const staticState = PHONE_STATES.includes(opts.state) ? opts.state : 'pass';

  function play() {
    if (reduced) { setState(staticState, { instant: true }); return; }
    stopManual();
    if (!timer) timer = createTimer({ duration: loopMs, loop: true, autoplay: false, onUpdate: tick });
    wantPlay = true;
    syncPlayback();
  }

  function pause() {
    wantPlay = false;
    syncPlayback();
    if (manual) manual.pause();
  }

  function destroy() {
    stopManual();
    if (capAnim) capAnim.cancel();
    if (timer) { timer.revert(); timer = null; }
    if (io) { io.disconnect(); io = null; }
    root.remove();
    if (captionEl) captionEl.remove();
  }

  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      syncPlayback();
    }, { threshold: 0.05 });
    io.observe(root);
  }

  // Initial screen in its final look.
  const initial = reduced ? staticState : PHONE_STATES.includes(opts.state) ? opts.state : sequence[0].name;
  const initialO = !reduced && !opts.state ? sequence[0].o : {};
  show(initial, initialO, true);
  R[initial](Infinity, Infinity, initialO);
  if (opts.autoplay && !reduced) play();

  return { setState, play, pause, destroy };
}
