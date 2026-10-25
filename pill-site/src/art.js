// Small line-art drawings for the "one run" steps and the clinic/personal screens.
// Paper sections use ink strokes; the station module supplies the dark FIG grid drawings.
const S = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
const G = 'fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 4" opacity=".45"';
const wrap = (inner, label) => `<svg viewBox="0 0 400 300" width="100%" role="img" aria-label="${label}" style="color:var(--ink-2)">${inner}</svg>`;

const art = {
  bottle: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/><line x1="200" y1="30" x2="200" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M150 90 h100 v22 h-8 v140 a10 10 0 0 1 -10 10 h-64 a10 10 0 0 1 -10 -10 v-140 h-8 z"/>
      <rect x="166" y="140" width="68" height="70" rx="4"/>
      <path d="M176 156 h48 M176 168 h36 M176 180 h44 M176 192 h28"/>
      <rect x="150" y="68" width="100" height="22" rx="4"/>
    </g>
    <g ${S} data-draw><rect x="290" y="110" width="70" height="120" rx="8"/><rect x="302" y="130" width="46" height="60" rx="3"/><circle cx="325" cy="206" r="6"/></g>
    <g ${S} data-draw><path d="M258 170 h32"/><path d="M284 164 l6 6 l-6 6"/></g>
    <text x="362" y="100" text-anchor="end" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">lot · drug · maker</text>
    <text x="362" y="250" text-anchor="end" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">no record for this lot</text>
  `, 'A pill bottle photographed by a phone; the label fields are read and the lot is checked'),

  blank: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M120 70 h160 l-10 180 h-140 z"/>
      <path d="M128 150 h144" stroke-dasharray="6 5"/>
      <path d="M134 120 q66 -14 132 0" opacity=".6"/>
    </g>
    <g ${S} data-draw><rect x="60" y="150" width="22" height="22" rx="4"/><path d="M82 161 h38" stroke-dasharray="2 3"/></g>
    <g ${S} data-draw><rect x="318" y="150" width="22" height="22" rx="4"/><path d="M280 161 h38" stroke-dasharray="2 3"/></g>
    <text x="58" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">LED off → dark</text>
    <text x="238" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">water → blank</text>
    <text x="150" y="235" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">lid closed · steady for 10 s</text>
  `, 'The chamber with plain water: a dark reading, then a blank reading'),

  drop: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M120 70 h160 l-10 180 h-140 z"/>
      <path d="M128 150 h144" stroke-dasharray="6 5"/>
      <rect x="190" y="168" width="20" height="10" rx="5"/>
      <path d="M200 40 v40" stroke-dasharray="3 4"/><path d="M194 74 l6 8 l6 -8"/>
      <path d="M170 90 h60 M200 90 v30" /><path d="M186 120 h28" />
    </g>
    <g data-draw><path d="M72 161 h110" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round"/><path d="M214 161 h104" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" opacity=".35"/></g>
    <g data-draw><path d="M200 182 v52" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2 4" opacity=".7"/></g>
    <rect x="52" y="150" width="20" height="22" rx="4" ${S}/><rect x="318" y="150" width="20" height="22" rx="4" ${S}/><rect x="190" y="234" width="20" height="22" rx="4" ${S}/>
    <text x="50" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">LEDs · B W R</text>
    <text x="300" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">inline · A0</text>
    <text x="216" y="250" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">90° · scatter · A1</text>
  `, 'A tablet dropping into a small cup; light crosses one corner to the inline sensor, and the side sensor at ninety degrees reads the light that scatters as the water clouds'),

  curve: wrap(`
    <g ${G}><line x1="60" y1="240" x2="360" y2="240"/><line x1="60" y1="40" x2="60" y2="240"/><rect x="60" y="96" width="300" height="44" fill="currentColor" stroke="none" opacity=".07"/></g>
    <path d="M60 238 C 120 236, 150 150, 200 122 S 300 112, 360 110" fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round" data-draw/>
    <path d="M60 238 C 120 236, 150 230, 200 226 S 300 222, 360 222" fill="none" stroke="var(--lab)" stroke-width="2.2" stroke-linecap="round" data-draw/>
    <text x="66" y="92" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">reference spread · 3 or more good runs</text>
    <text x="250" y="104" font-family="var(--mono)" font-size="10" fill="var(--blue-ink)">PASS · P1</text>
    <text x="250" y="258" font-family="var(--mono)" font-size="10" fill="var(--lab)">NEEDS LAB · N1</text>
  `, 'Illustration: two curves, one inside the reference spread and one far below it'),

  delivery: wrap(`
    <g ${S} data-draw>
      <rect x="70" y="30" width="260" height="240" rx="16"/>
      <path d="M90 66 h120 M90 84 h80"/>
      <rect x="90" y="104" width="220" height="40" rx="8"/>
      <path d="M100 126 h70" stroke="currentColor" opacity=".7"/>
      <path d="M90 164 h220 M90 182 h180 M90 200 h200"/>
      <rect x="90" y="222" width="64" height="26" rx="13" fill="currentColor" opacity=".15"/>
      <rect x="164" y="222" width="64" height="26" rx="13"/>
      <rect x="238" y="222" width="72" height="26" rx="13"/>
    </g>
    <text x="90" y="60" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">Delivery #118 · lot B2-07</text>
    <text x="228" y="130" font-family="var(--mono)" font-size="11" fill="currentColor">$1,240 held · SANDBOX</text>
    <text x="96" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Release</text>
    <text x="178" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Hold</text>
    <text x="250" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Escalate</text>
    <text x="96" y="160" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".55">12:04 · P1 · "release requires PASS + no recall record + cap + pharmacist tap"</text>
  `, 'The clinic delivery screen: held sandbox money, a decision log and release, hold and escalate buttons'),

  medicines: wrap(`
    <g ${S} data-draw>
      <rect x="110" y="20" width="180" height="260" rx="22"/>
      <path d="M130 60 h90"/>
      ${[0, 1, 2].map((i) => `<rect x="128" y="${84 + i * 56}" width="144" height="44" rx="8"/><circle cx="146" cy="${106 + i * 56}" r="5"/><path d="M160 ${100 + i * 56} h70 M160 ${112 + i * 56} h40"/>`).join('')}
    </g>
    <text x="130" y="54" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">My medicines</text>
    <text x="236" y="${110}" font-family="var(--mono)" font-size="9" fill="var(--pass)">PASS</text>
    <text x="236" y="${166}" font-family="var(--mono)" font-size="9" fill="var(--pass)">PASS</text>
    <text x="226" y="${222}" font-family="var(--mono)" font-size="9" fill="var(--unable)">UNABLE</text>
    <text x="128" y="262" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".55">tap a row to log "taken"</text>
  `, 'The personal screen: a list of bottles, each with the verdict of its one tested tablet'),
};

// fallbacks for the FIG grid until the station module provides real drawings
const partFallback = (label) => `<svg viewBox="0 0 300 300" width="100%" role="img" aria-label="${label}"><rect x="40" y="40" width="220" height="220" rx="18" fill="none" stroke="rgba(255,255,255,.3)" stroke-dasharray="4 5"/></svg>`;
['container', 'led', 'ldr', 'thermistor', 'stepper', 'esp32', 'pi'].forEach((k) => { art[k] = partFallback(k); });

// Fig 0.8: the data path, drawn in the dark-section line style
{
  const W = 'fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"';
  const D = 'fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3 4"';
  const F = 'rgba(255,255,255,0.8)';
  const M = 'rgba(139,144,151,1)';
  const node = (x, y, w, h, title, sub, accent) => `
    <g data-draw-group>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${W} ${accent ? `stroke="${accent}"` : ''} data-draw/>
      <text x="${x + 14}" y="${y + 26}" font-family="var(--sans)" font-size="13" font-weight="600" fill="${F}">${title}</text>
      ${sub.map((s, i) => `<text x="${x + 14}" y="${y + 46 + i * 15}" font-family="var(--mono)" font-size="10.5" fill="${M}">${s}</text>`).join('')}
    </g>`;
  const arrow = (x1, y, x2) => `<path d="M${x1} ${y} H${x2 - 8}" ${W} class="flow" data-draw/><path d="M${x2 - 8} ${y - 4} l8 4 l-8 4" ${W}/>`;
  art.pipeline = `<svg viewBox="0 0 1100 270" width="100%" role="img" aria-label="Data path: station to backend to verdict to policy to sandbox bank and pharmacist">
    ${node(10, 70, 185, 96, 'Station', ['UNO Q · 1 CSV line/s', 'dark · blue · white · red', 'two photoresistors'])}
    ${arrow(195, 118, 235)}
    ${node(235, 70, 215, 96, 'Backend', ['absorbance = log(blank/now)', 'plateau · t80 · scatter', '7 rules, in order'])}
    ${arrow(450, 118, 490)}
    ${node(490, 70, 165, 96, 'Verdict', ['PASS · NEEDS LAB ·', 'UNABLE TO VERIFY', 'rule id on the card'])}
    ${arrow(655, 118, 695)}
    ${node(695, 70, 190, 96, 'Policy', ['policy.md P1–P6', 'release · hold · escalate', 'spend cap · log line'])}
    ${arrow(885, 118, 925)}
    ${node(925, 70, 165, 96, 'Money', ['simulated today', 'clinic → escrow →', 'supplier'], 'rgba(47,107,255,0.9)')}
    ${node(255, 196, 240, 56, 'Claude', ['"why" text · log line · bottle fields'])}
    <path d="M375 196 V166" ${D}/>
    ${node(695, 196, 170, 56, 'openFDA', ['recall by lot · cached'])}
    <path d="M780 196 V166" ${D}/>
    ${node(925, 196, 165, 56, 'Pharmacist', ['taps every release'])}
    <path d="M1007 196 V166" ${D}/>
    <text x="10" y="30" font-family="var(--mono)" font-size="11" fill="${M}">MEASURES</text>
    <text x="235" y="30" font-family="var(--mono)" font-size="11" fill="${M}">DECIDES (deterministic)</text>
    <text x="695" y="30" font-family="var(--mono)" font-size="11" fill="${M}">HOLDS OR RELEASES</text>
  </svg>`;
}

// Reference profile: three or more runs of a known-good tablet
art.calibration = wrap(`
  <g ${G}><line x1="60" y1="240" x2="360" y2="240"/><line x1="60" y1="40" x2="60" y2="240"/><rect x="60" y="104" width="300" height="34" fill="currentColor" stroke="none" opacity=".07"/></g>
  ${Array.from({ length: 3 }, (_, i) => `<path d="M60 238 C 120 ${236 - i * 0.8}, 150 ${152 + i * 4}, 200 ${126 + i * 3} S 300 ${116 + i * 4}, 360 ${114 + i * 3}" fill="none" stroke="var(--blue)" stroke-width="1.5" stroke-linecap="round" opacity="${0.45 + i * 0.18}" data-draw/>`).join('')}
  <text x="66" y="98" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">reference profile · 3 or more good runs</text>
  <text x="210" y="258" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">illustration · first profile not recorded yet</text>
`, 'Illustration: three runs of a known-good tablet overlapping into a reference profile');

export function artFor(key) { return art[key] || ''; }

/* ---------- stats band: small charts under each number ---------- */
// 0 and 1 draw the sourced figure to scale; 2 and 3 are decorative. All are labelled.
export function statSpark(i) {
  const W = 240, H = 56;
  const svg = (inner, note) => `<div class="spark" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${inner}</svg><p class="spark-note">${note}</p></div>`;
  if (i === 0) {
    const bw = 18, gap = (W - 10 * bw) / 9;
    return svg(Array.from({ length: 10 }, (_, k) => `<rect class="sp-bar${k === 6 ? ' sp-hot' : ''}" x="${(k * (bw + gap)).toFixed(1)}" y="8" width="${bw}" height="44" rx="9"/>`).join(''), 'illustration · 1 of 10, to scale');
  }
  if (i === 1) {
    // modelled range 64,000–158,000 on a 0–160,000 axis
    const x = (v) => (v / 160000) * (W - 4) + 2;
    return svg(`<line x1="2" x2="${W - 2}" y1="40" y2="40" class="sp-axis"/>
      <rect class="sp-range" x="${x(64000)}" y="30" width="${x(158000) - x(64000)}" height="20" rx="10"/>
      <line class="sp-mark" x1="${x(116000)}" x2="${x(116000)}" y1="22" y2="56"/>
      <circle class="sp-dot" cx="${x(116000)}" cy="40" r="5"/>`, 'illustration · modelled range 64k–158k, to scale');
  }
  if (i === 2) {
    const pts = [6, 8, 7, 11, 10, 14, 19, 17, 24, 31, 28, 36, 42, 39, 47];
    const step = W / (pts.length - 1);
    const line = pts.map((v, k) => `${(k * step).toFixed(1)} ${(H - 4 - v).toFixed(1)}`).join(' L');
    return svg(`<path class="sp-area" d="M0 ${H} L${line} L${W} ${H} Z"/><path class="sp-line" d="M${line}"/>`, 'illustration · not data');
  }
  const vals = [18, 22, 20, 26, 24, 30, 28, 34, 33, 38, 41, 44];
  const bw = 14, gap = (W - vals.length * bw) / (vals.length - 1);
  return svg(vals.map((v, k) => `<rect class="sp-bar sp-bar--sky" x="${(k * (bw + gap)).toFixed(1)}" y="${H - v}" width="${bw}" height="${v}" rx="3"/>`).join(''), 'illustration · not data');
}

/* ---------- clinic: a day on one timeline, from the app's demo deliveries ---------- */
// [hour logged, lot, verdict + rule, decision, outcome class, lane]
const DAY = [
  [9, 'B2-01', 'PASS · P1', 'released after the tap', 'pass', 0],
  [10, 'B2-06', 'PASS · P1', 'released after the tap', 'pass', 1],
  [11, 'B2-05', 'UNABLE TO VERIFY · U2', 'escalated · lid opened', 'unable', 0],
  [13, 'TM-03', 'NEEDS LAB · N2', 'held · lab referral', 'lab', 1],
  [15, 'B2-08', 'recall record · P4', 'held, whatever the curve says', 'recall', 0],
  [17, 'B2-11', 'PASS · above cap · P5', 'escalated to a person', 'unable', 1],
];
export function timetable() {
  const pos = (h) => (((h - 8) / 11) * 100).toFixed(2);
  const hours = Array.from({ length: 12 }, (_, k) => 8 + k);
  return `<div class="tt">
    <div class="tt-axis" aria-hidden="true">${hours.map((h) => `<span style="left:${pos(h)}%">${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
    <div class="tt-lanes" role="list" aria-label="A day in a clinic: six deliveries logged, tested, then released or held">${DAY.map(([h, lot, verdict, decision, cls, lane]) => `
      <div class="tt-b tt-${cls}" role="listitem" style="--l:${pos(h)}%; --lane:${lane}">
        <p class="tt-time"><b>${String(h).padStart(2, '0')}:00</b> · lot ${lot}</p>
        <div class="tt-bar" aria-hidden="true"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>
        <p class="tt-v">${verdict}</p>
        <p class="tt-d">${decision}</p>
      </div>`).join('')}
    </div>
    <div class="tt-key" aria-hidden="true"><span><i class="k1"></i>logged, label read</span><span><i class="k2"></i>tested, about 3 min</span><span><i class="k3"></i>decision</span><span class="tt-nts">blocks not to scale</span></div>
  </div>`;
}

/* ---------- clinic: verdicts by lot and day (the app's seven seeded days) ---------- */
const SLOTS = ['09', '10', '11', '13–14', '15–16', '17'];
const DAYS = ['−6d', '−5d', '−4d', '−3d', '−2d', '−1d', 'today'];
// [day, slot, lot, class, words]
const HEAT = [
  [0, 0, 'B2-01', 'pass', 'PASS · released'], [0, 3, 'TM-01', 'lab', 'NEEDS LAB · held'],
  [1, 1, 'B2-02', 'pass', 'PASS · released'], [1, 4, 'B2-03', 'lab', 'NEEDS LAB · held'],
  [2, 0, 'B2-04', 'pass', 'PASS · released'], [2, 2, 'B2-05', 'unable', 'UNABLE TO VERIFY · escalated'],
  [3, 1, 'B2-06', 'pass', 'PASS · released'], [3, 4, 'B2-08', 'recall', 'recall record · held'],
  [4, 0, 'B2-09', 'pass', 'PASS · released'], [4, 3, 'TM-03', 'lab', 'NEEDS LAB · held'],
  [5, 1, 'B2-10', 'pass', 'PASS · released'], [5, 5, 'B2-11', 'unable', 'PASS · above the cap · escalated'],
  [6, 3, 'B2-07', 'pending', 'logged · waiting for its test'], [6, 4, 'TM-02', 'pending', 'logged · waiting for its test'],
];
export function heatmap() {
  const cell = (d, s) => HEAT.find((h) => h[0] === d && h[1] === s);
  let cells = '<span></span>' + DAYS.map((d) => `<span class="hm-col">${d}</span>`).join('');
  SLOTS.forEach((slot, s) => {
    cells += `<span class="hm-row">${slot}</span>`;
    DAYS.forEach((day, d) => {
      const h = cell(d, s);
      cells += h
        ? `<span class="hm-c hm-${h[3]}" role="img" title="${day} · ${slot}:00 · lot ${h[2]} · ${h[4]}" aria-label="${day}, ${slot}:00, lot ${h[2]}: ${h[4]}"><em>${h[2]}</em></span>`
        : '<span class="hm-c hm-empty" aria-hidden="true"></span>';
    });
  });
  return `<div class="hm" role="group" aria-label="Verdicts by lot and day, seven days of the app's demo deliveries">${cells}</div>
    <div class="hm-legend" aria-hidden="true"><span><i class="hm-pass"></i>PASS · released</span><span><i class="hm-lab"></i>NEEDS LAB · held</span><span><i class="hm-unable"></i>escalated</span><span><i class="hm-recall"></i>recall · held</span><span><i class="hm-pending"></i>pending</span><span><i class="hm-empty"></i>no delivery</span></div>`;
}
