// "One tablet's three minutes": a pinned, scroll-synced story in six scenes (SomniQ / Apple style),
// plus the Coinbase flow diagram and the FIG-grid data-flow arrows.
// Every scene is a pure function of one number p in [0, 6): scene i owns [i, i + 1). The desktop pin drives
// one stage from the scroll position (anime.js onScroll + sync); phones and reduced motion get the same scenes stacked.
import { animate, createTimer, onScroll, stagger, utils } from 'animejs';
import './story.css';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const outCubic = (t) => 1 - (1 - t) ** 3;
const inQuad = (t) => t * t;
const money = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SCENES = [
  { n: '01', name: 'Label', time: '0:00', line: 'It starts with the label, the one part anyone can copy.', cap: 'phone camera · drug, strength, lot, maker, expiry · openFDA recall check' },
  { n: '02', name: 'Drop', time: '0:40', line: 'A quarter tablet goes into 900 mL of water.', cap: 'lid closed · stirred by hand · water temperature typed in' },
  { n: '03', name: 'Light', time: '0:40 → 3:00', line: 'Blue light crosses the cup. As riboflavin dissolves, less of it gets through.', cap: 'inline sensor · blue plastic · absorbance = log(blank / now)' },
  { n: '04', name: 'Glow', time: '0:40 → 3:00', line: 'At 90°, behind green plastic, the water starts to glow. Chalk does not.', cap: '90° sensor · green plastic · riboflavin glows green' },
  { n: '05', name: 'Curve', time: '3:00', line: 'The curve flattens inside last night’s band.', cap: 'plateau vs ten reference runs on this box · seven rules, in order' },
  { n: '06', name: 'Verdict', time: '3:12 → 3:41', line: 'PASS proposes release. A pharmacist taps. Only then does the money move.', cap: 'P1 · escrow → supplier · USDC on Base Sepolia · TESTNET' },
];

/* ---------- geometry ---------- */
const xl = (y) => 200 + (14 * (y - 150)) / 330; // cup left wall
const xr = (y) => 440 - (14 * (y - 150)) / 330; // cup right wall
const WL = 200; // water line
const WATER = `M${xl(WL).toFixed(1)} ${WL} L${xr(WL).toFixed(1)} ${WL} L426 480 L214 480 Z`;
// the app's capsule (PillFill), 140 x 300 box
const CAP = 'M12 152 V62 A58 58 0 0 1 128 62 V152 Z';
const BODY = 'M14 140 V240 A56 56 0 0 0 126 240 V140 Z';
const BODY_EDGE = 'M14 152 V240 A56 56 0 0 0 126 240 V152';
// chart (scene 5)
const CX0 = 48, CX1 = 392, CY0 = 130, CY1 = 430;
const cy = (a) => CY1 - (a / 0.6) * (CY1 - CY0);
const cx = (s) => CX0 + (s / 180) * (CX1 - CX0);
const CURVE = (() => { let d = ''; for (let s = 0; s <= 180; s += 3) { const a = s < 12 ? 0 : 0.41 * (1 - Math.exp(-0.042 * (s - 12))); d += (s ? 'L' : 'M') + cx(s).toFixed(1) + ' ' + cy(a).toFixed(1) + ' '; } return d; })();
const GLOWC = (() => { let d = ''; for (let s = 0; s <= 180; s += 3) { const a = s < 14 ? 0 : 0.2 * (1 - Math.exp(-0.04 * (s - 14))); d += (s ? 'L' : 'M') + cx(s).toFixed(1) + ' ' + cy(a).toFixed(1) + ' '; } return d; })();
const FIELDS = [['drug', 'Riboflavin 100 mg'], ['lot', 'B2-07'], ['maker', 'Nature’s Bounty'], ['expiry', '2027-03']];

let uidN = 0;

/** One stage: an SVG that can show any moment of the six scenes. */
function makeStage() {
  const u = 'st' + (++uidN);
  const L = 'fill="none" stroke="rgba(233,238,242,.62)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const svgNS = `
  <svg class="st-svg" viewBox="0 0 640 560" role="img" aria-label="One tablet, six moments: the bottle label read by a phone camera; a quarter tablet dropped into the cup; blue light crossing the cup; the green glow at ninety degrees; the curve entering the reference band while a capsule fills; the PASS card and the payment moving from escrow to the supplier after a pharmacist's tap, on testnet">
    <defs>
      <pattern id="${u}-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(140,200,255,.13)"/></pattern>
      <radialGradient id="${u}-glow"><stop offset="0" stop-color="#7BF0B6" stop-opacity=".95"/><stop offset=".4" stop-color="#5FD39A" stop-opacity=".45"/><stop offset="1" stop-color="#5FD39A" stop-opacity="0"/></radialGradient>
      <radialGradient id="${u}-led"><stop offset="0" stop-color="#BFE4FF" stop-opacity="1"/><stop offset=".35" stop-color="#4FB3FF" stop-opacity=".6"/><stop offset="1" stop-color="#4FB3FF" stop-opacity="0"/></radialGradient>
      <linearGradient id="${u}-beam" x1="0" x2="1"><stop offset="0" stop-color="#4FB3FF" stop-opacity="1"/><stop offset="1" stop-color="#4FB3FF" stop-opacity="1" data-k="beamEnd"/></linearGradient>
      <clipPath id="${u}-water"><path d="${WATER}"/></clipPath>
      <clipPath id="${u}-pill"><path d="${CAP}"/><path d="${BODY}"/></clipPath>
    </defs>
    <rect width="640" height="560" fill="url(#${u}-dots)"/>

    <!-- scene 1: the label under the phone camera -->
    <g data-s="0">
      <rect x="130" y="118" width="140" height="38" rx="6" ${L}/>
      <path d="M146 126 v22 M162 126 v22 M178 126 v22 M194 126 v22 M210 126 v22 M226 126 v22 M242 126 v22 M258 126 v22" fill="none" stroke="rgba(233,238,242,.2)"/>
      <path d="M138 156 h124 v14 h-124 z" ${L}/>
      <path d="M126 170 h148 v296 a16 16 0 0 1 -16 16 h-116 a16 16 0 0 1 -16 -16 z" ${L}/>
      <rect x="140" y="236" width="120" height="170" rx="6" fill="rgba(233,238,242,.05)" stroke="rgba(233,238,242,.35)"/>
      <text x="151" y="266" class="st-lbl-big">RIBOFLAVIN</text>
      <text x="151" y="284" class="st-lbl">100 mg</text>
      <text x="152" y="302" class="st-lbl">Nature’s Bounty</text>
      <path d="M152 320 h96 M152 330 h80 M152 340 h88" stroke="rgba(233,238,242,.18)" stroke-width="4" stroke-linecap="round"/>
      <text x="152" y="372" class="st-lbl">LOT B2-07</text>
      <text x="152" y="390" class="st-lbl">EXP 2027-03</text>
      <g data-k="boxes" fill="rgba(79,179,255,.12)" stroke="#7FC4FF" stroke-width="1">
        <rect x="145" y="251" width="110" height="40" rx="4"/><rect x="145" y="292" width="92" height="15" rx="3"/><rect x="145" y="361" width="62" height="15" rx="3"/><rect x="145" y="379" width="72" height="15" rx="3"/>
      </g>
      <g fill="none" stroke="#A9D6FF" stroke-width="2.4" stroke-linecap="round">
        <path d="M128 240 v-16 h16"/><path d="M256 224 h16 v16"/><path d="M272 404 v16 h-16"/><path d="M144 420 h-16 v-16"/>
      </g>
      <text x="128" y="212" class="st-t">phone camera</text>
      <line data-k="scan" x1="134" x2="266" y1="236" y2="236" stroke="#9FD3FF" stroke-width="1.8" class="st-scan"/>
      <path d="M278 316 h44" fill="none" stroke="rgba(233,238,242,.35)" stroke-dasharray="3 4"/><path d="M316 311 l7 5 l-7 5" fill="none" stroke="rgba(233,238,242,.5)"/>
      <rect x="334" y="170" width="282" height="252" rx="16" class="st-panel"/>
      <text x="354" y="200" class="st-t">label → fields · photo deleted after</text>
      ${FIELDS.map(([k], i) => `<text x="354" y="${242 + i * 38}" class="st-t">${k}</text><text x="420" y="${242 + i * 38}" class="st-val" data-k="f${i}"></text><path d="M354 ${254 + i * 38} h242" stroke="rgba(233,238,242,.08)"/>`).join('')}
      <g data-k="chip"><rect x="350" y="380" width="254" height="28" rx="14" fill="rgba(79,179,255,.12)" stroke="rgba(79,179,255,.45)"/><circle cx="365" cy="394" r="4" fill="#4FB3FF"/><text x="376" y="398" class="st-t st-t--ink">openFDA · no record for this lot</text></g>
    </g>

    <!-- scenes 2-4: the cup, shared -->
    <g data-cup>
      <rect x="304" y="82" width="32" height="30" rx="4" ${L}/><text x="344" y="101" class="st-t">stir stick</text>
      <path d="M186 150 h268" stroke="rgba(233,238,242,.5)" stroke-width="3" stroke-linecap="round"/>
      <path d="M200 150 L214 480 L426 480 L440 150" ${L}/>
      <path d="${WATER}" fill="rgba(79,179,255,.09)"/>
      <path d="${WATER}" fill="#F3DA63" data-k="tint" opacity="0"/>
      <g clip-path="url(#${u}-water)"><circle cx="320" cy="400" r="40" fill="url(#${u}-glow)" data-k="bloom" opacity="0"/></g>
      <path d="M${xl(WL).toFixed(1)} ${WL} H${xr(WL).toFixed(1)}" stroke="rgba(79,179,255,.7)" stroke-width="1.5"/>
      <path d="M${(xl(WL) - 12).toFixed(1)} ${WL} h10" stroke="rgba(233,238,242,.4)"/><text x="${(xl(WL) - 16).toFixed(1)}" y="${WL + 4}" class="st-t" text-anchor="end">900 mL</text>
      <line x1="320" y1="112" x2="320" y2="344" stroke="rgba(233,238,242,.55)" stroke-width="2"/>
      <rect data-k="blade" x="294" y="344" width="52" height="18" rx="3" fill="rgba(233,238,242,.12)" stroke="rgba(233,238,242,.6)" stroke-width="1.2"/>
      <!-- tablet + bubbles -->
      <g data-k="bubbles" fill="none" stroke="rgba(190,225,255,.55)" stroke-width="1">${[0, 1, 2, 3, 4].map(() => '<circle r="2.5" cx="-20" cy="-20"/>').join('')}</g>
      <g data-k="tab" transform="translate(380 40)"><path d="M-10 -10 h20 a20 20 0 0 1 -20 20 z" fill="#E9C94A" stroke="#FFF1B8" stroke-width="1"/></g>
      <g data-k="tabcloud" fill="#E9C94A">${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${370 + k * 6}" cy="${462 - (k % 3) * 5}" r="${1.5 + (k % 2)}"/>`).join('')}</g>
      <!-- light path -->
      <circle cx="165" cy="400" r="34" fill="url(#${u}-led)" data-k="ledglow" opacity="0"/>
      <line x1="180" y1="400" x2="${xl(400).toFixed(1)}" y2="400" stroke="#4FB3FF" stroke-width="4" stroke-linecap="round" data-k="beamA" opacity="0"/>
      <line x1="${xl(400).toFixed(1)}" y1="400" x2="${xr(400).toFixed(1)}" y2="400" stroke="url(#${u}-beam)" stroke-width="4" data-k="beamB" opacity="0"/>
      <line x1="${xr(400).toFixed(1)}" y1="400" x2="452" y2="400" stroke="#4FB3FF" stroke-width="4" stroke-linecap="round" data-k="beamC" opacity="0"/>
      <line x1="182" y1="400" x2="452" y2="400" stroke="#E6F4FF" stroke-width="2" stroke-dasharray="2 16" stroke-linecap="round" data-k="photons" opacity="0"/>
      <rect x="150" y="388" width="30" height="24" rx="4" ${L}/><text x="146" y="380" class="st-t">blue LED</text>
      <rect x="452" y="386" width="6" height="28" fill="rgba(79,179,255,.55)"/><rect x="460" y="388" width="30" height="24" rx="4" ${L}/><text x="452" y="430" class="st-t">inline</text>
      <circle cx="320" cy="500" r="40" fill="url(#${u}-glow)" data-k="halo" opacity="0"/>
      <rect x="302" y="486" width="36" height="6" fill="rgba(95,211,154,.55)" data-k="gfilter"/>
      <rect x="305" y="494" width="30" height="24" rx="4" ${L}/><text x="346" y="512" class="st-t">90° · green plastic</text>
      <!-- readout panel (scenes 3 and 4) -->
      <g data-k="readA" opacity="0">
        <rect x="474" y="150" width="154" height="176" rx="14" class="st-panel"/>
        <text x="490" y="176" class="st-t">INLINE · A2</text><text x="490" y="194" class="st-t">absorbance</text>
        <text x="490" y="246" class="st-num" data-k="abs">0.00</text>
        <text x="490" y="276" class="st-t">light through</text>
        <rect x="490" y="286" width="122" height="8" rx="4" fill="rgba(233,238,242,.1)"/><rect x="490" y="286" width="122" height="8" rx="4" fill="#4FB3FF" data-k="tbar"/>
        <text x="612" y="312" class="st-t" text-anchor="end" data-k="tpct">100 %</text>
      </g>
      <g data-k="readG" opacity="0">
        <rect x="474" y="150" width="154" height="176" rx="14" class="st-panel"/>
        <text x="490" y="176" class="st-t">90° · A3</text><text x="490" y="194" class="st-t">green glow</text>
        <text x="490" y="242" class="st-word" data-k="gword">waking</text>
        <text x="490" y="270" class="st-t">riboflavin</text>
        <rect x="490" y="278" width="122" height="8" rx="4" fill="rgba(233,238,242,.1)"/><rect x="490" y="278" width="0" height="8" rx="4" fill="#5FD39A" data-k="gbar"/>
        <text x="490" y="304" class="st-t">chalk</text>
        <rect x="490" y="310" width="122" height="8" rx="4" fill="rgba(233,238,242,.1)"/><rect x="490" y="310" width="3" height="8" rx="2" fill="#8E9AA6"/>
      </g>
    </g>
    <!-- scene 2 extras: ripples and the label -->
    <g data-s="1">
      <g fill="none" stroke="rgba(190,225,255,.8)" stroke-width="1.4">${[0, 1, 2].map(() => `<ellipse cx="380" cy="${WL}" rx="0" ry="0" data-k="rip"/>`).join('')}</g>
      <g fill="#BFE4FF" data-k="splash">${[-1, -0.4, 0.4, 1].map(() => '<circle r="2" cx="-9" cy="-9"/>').join('')}</g>
      <text x="408" y="52" class="st-t st-t--ink" data-k="tabl">¼ tablet</text>
    </g>

    <!-- scene 5: curve + capsule -->
    <g data-s="4">
      <text x="${CX0}" y="${CY0 - 14}" class="st-t">absorbance · inline</text>
      <path d="M${CX0} ${CY0} V${CY1} H${CX1}" fill="none" stroke="rgba(233,238,242,.3)"/>
      <rect x="${CX0}" y="${cy(0.47)}" width="${CX1 - CX0}" height="${cy(0.36) - cy(0.47)}" fill="rgba(233,238,242,.09)"/>
      <path d="M${CX0} ${cy(0.47)} H${CX1} M${CX0} ${cy(0.36)} H${CX1}" stroke="rgba(233,238,242,.35)" stroke-dasharray="2 4"/>
      <text x="${CX0 + 8}" y="${cy(0.47) - 8}" class="st-t">reference band 0.36–0.47 · 10 runs</text>
      ${[0, 90, 180].map((s) => `<text x="${cx(s)}" y="${CY1 + 22}" class="st-t" text-anchor="middle">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</text>`).join('')}
      <path d="${GLOWC}" fill="none" stroke="#5FD39A" stroke-width="1.4" data-k="gcurve" opacity=".85"/>
      <path d="${CURVE}" fill="none" stroke="#4FB3FF" stroke-width="2.6" stroke-linecap="round" data-k="curve" class="st-curve"/>
      <circle r="5" fill="#4FB3FF" stroke="#0E1216" stroke-width="2" data-k="head"/>
      <text x="${cx(178)}" y="${cy(0.2) + 22}" class="st-t" text-anchor="end" style="fill:#5FD39A">green glow · 90°</text>
      <g data-k="plat"><text x="${cx(178)}" y="${cy(0.36) + 20}" class="st-t st-t--ink" text-anchor="end">plateau 0.41 · inside the band</text></g>
      <g transform="translate(456 112) scale(.95)">
        <path d="M0 0 H140 V300 H0 Z" fill="#4FB3FF" clip-path="url(#${u}-pill)" data-k="liq"/>
        <path d="${CAP}" fill="rgba(233,238,242,.04)" stroke="rgba(233,238,242,.75)" stroke-width="2"/>
        <path d="${BODY_EDGE}" fill="none" stroke="rgba(233,238,242,.75)" stroke-width="2"/>
        <path d="M14 152 H126" stroke="rgba(233,238,242,.4)" stroke-width="1.5"/>
      </g>
      <text x="522" y="464" class="st-num" text-anchor="middle" data-k="pct">0 %</text>
      <text x="522" y="486" class="st-t" text-anchor="middle">dissolved</text>
    </g>

    <!-- scene 6: verdict card + money line -->
    <g data-s="5">
      <g data-k="card">
        <rect x="150" y="70" width="340" height="196" rx="18" fill="rgba(22,26,31,.94)" stroke="rgba(95,211,154,.6)"/>
        <rect x="172" y="92" width="88" height="30" rx="15" fill="rgba(27,138,90,.22)" stroke="rgba(95,211,154,.75)"/>
        <circle cx="189" cy="107" r="4.5" fill="#5FD39A"/><text x="200" y="112" class="st-pass">PASS</text>
        <text x="468" y="112" class="st-t" text-anchor="end">rule P1</text>
        <text x="172" y="156" class="st-body">Plateau 0.41, inside the band 0.36–0.47.</text>
        <text x="172" y="180" class="st-body">The green glow rose with the curve.</text>
        <text x="172" y="204" class="st-body">Lot B2-07 · no record for this lot.</text>
        <path d="M172 222 h296" stroke="rgba(233,238,242,.12)"/>
        <text x="172" y="246" class="st-t">release proposed · needs the pharmacist’s tap</text>
      </g>
      <rect x="22" y="344" width="148" height="84" rx="14" class="st-node st-node--pass" data-k="n1"/>
      <text x="40" y="374" class="st-nlbl">Verdict</text><text x="40" y="404" class="st-pass">PASS · P1</text>
      <rect x="240" y="344" width="160" height="84" rx="14" class="st-node st-node--esc"/>
      <text x="258" y="370" class="st-nlbl">Pill escrow</text><text x="258" y="408" class="st-amt" data-k="escAmt">1,240.00</text>
      <rect x="470" y="344" width="148" height="84" rx="14" class="st-node" data-k="n3"/>
      <text x="488" y="370" class="st-nlbl">Supplier</text><text x="488" y="408" class="st-amt" data-k="supAmt">0.00</text>
      <path d="M170 386 H232" class="st-wire" data-k="w1"/><path d="M226 381 l7 5 l-7 5" fill="none" stroke="rgba(233,238,242,.5)"/>
      <path d="M400 386 H462" class="st-wire" data-k="w2"/><path d="M456 381 l7 5 l-7 5" fill="none" stroke="rgba(233,238,242,.5)"/>
      <g data-k="tap">
        <rect x="392" y="290" width="78" height="28" rx="14" fill="rgba(233,238,242,.92)"/><text x="431" y="309" class="st-btn" text-anchor="middle">Release</text>
        <circle cx="431" cy="304" r="10" fill="none" stroke="#E9EEF2" stroke-width="1.5" data-k="tapring" opacity="0"/>
        <text x="380" y="309" class="st-t" text-anchor="end">pharmacist taps</text>
      </g>
      <g data-k="token" opacity="0"><circle r="15" fill="#2775CA" stroke="#fff" stroke-width="2"/><text y="3.5" class="st-tok" text-anchor="middle">USDC</text></g>
      <text x="320" y="470" class="st-t st-t--ink" text-anchor="middle">USDC · Base Sepolia · TESTNET · mirrored in the Nessie SANDBOX</text>
      <text x="320" y="492" class="st-t" text-anchor="middle">no tap, no transfer · the model cannot release</text>
    </g>
  </svg>`;
  const holder = document.createElement('div');
  holder.className = 'st-holder';
  holder.innerHTML = svgNS.trim();
  const svg = holder.firstElementChild;
  const q = (k) => svg.querySelector(`[data-k="${k}"]`);
  const qa = (k) => [...svg.querySelectorAll(`[data-k="${k}"]`)];
  const groups = [...svg.querySelectorAll('[data-s]')].map((g) => [Number(g.dataset.s), g]);
  const cup = svg.querySelector('[data-cup]');
  const k = {
    scan: q('scan'), boxes: [...q('boxes').children], chip: q('chip'), f: FIELDS.map((_, i) => q('f' + i)),
    tint: q('tint'), bloom: q('bloom'), blade: q('blade'), bubbles: [...q('bubbles').children], tab: q('tab'), tabcloud: q('tabcloud'),
    ledglow: q('ledglow'), beamA: q('beamA'), beamB: q('beamB'), beamC: q('beamC'), beamEnd: svg.querySelector('[data-k="beamEnd"]'), photons: q('photons'),
    halo: q('halo'), gfilter: q('gfilter'), readA: q('readA'), readG: q('readG'), abs: q('abs'), tbar: q('tbar'), tpct: q('tpct'), gword: q('gword'), gbar: q('gbar'),
    rip: qa('rip'), splash: [...q('splash').children], tabl: q('tabl'),
    curve: q('curve'), gcurve: q('gcurve'), head: q('head'), plat: q('plat'), liq: q('liq'), pct: q('pct'),
    card: q('card'), w1: q('w1'), w2: q('w2'), tapring: q('tapring'), token: q('token'), escAmt: q('escAmt'), supAmt: q('supAmt'), n3: q('n3'),
  };
  const curveLen = k.curve.getTotalLength();
  const gLen = k.gcurve.getTotalLength();
  k.curve.style.strokeDasharray = curveLen;
  k.gcurve.style.strokeDasharray = gLen;

  const vis = (i, p) => {
    const inn = i === 0 ? 1 : seg(p, i - 0.12, i);
    const out = i === 5 ? 1 : seg(i + 1 - p, 0, 0.12);
    return Math.min(inn, out);
  };
  const local = (i, p) => seg(p, i, i + 0.8);
  const op = (el, v) => el.setAttribute('opacity', v.toFixed(3));

  function render(p) {
    const o = [0, 1, 2, 3, 4, 5].map((i) => vis(i, p));
    groups.forEach(([i, g]) => { g.setAttribute('opacity', o[i].toFixed(3)); g.style.visibility = o[i] > 0.001 ? 'visible' : 'hidden'; });
    const oc = Math.max(o[1], o[2], o[3]);
    cup.setAttribute('opacity', oc.toFixed(3));
    cup.style.visibility = oc > 0.001 ? 'visible' : 'hidden';

    // 1 · label
    if (o[0] > 0) {
      const t = local(0, p);
      const sy = 236 + 172 * seg(t, 0, 0.45);
      k.scan.setAttribute('y1', sy); k.scan.setAttribute('y2', sy);
      op(k.scan, t > 0.5 ? 0 : 1);
      [0.04, 0.16, 0.36, 0.42].forEach((a, i) => op(k.boxes[i], seg(t, a, a + 0.06)));
      FIELDS.forEach(([, v], i) => { const n = Math.round(v.length * seg(t, 0.2 + i * 0.13, 0.32 + i * 0.13)); k.f[i].textContent = v.slice(0, n); });
      op(k.chip, seg(t, 0.78, 0.88));
    }

    // cup layer (global p, so every stacked instance agrees)
    if (oc > 0) {
      const ph = p * 9;
      const bw = Math.max(4, 52 * Math.abs(Math.cos(ph)));
      k.blade.setAttribute('width', bw.toFixed(1)); k.blade.setAttribute('x', (320 - bw / 2).toFixed(1));
      // tablet: falls (scene 2), then rests and dissolves (3-4)
      const t2 = local(1, p);
      let ty, rot, sc;
      if (p < 2) {
        const fall = seg(t2, 0, 0.32), sink = seg(t2, 0.32, 0.9);
        ty = fall < 1 ? 40 + (WL - 4 - 40) * inQuad(fall) : WL - 4 + (460 - WL + 4) * outCubic(sink);
        rot = 160 * fall + 120 * sink; sc = 1;
      } else { ty = 460; rot = 280; sc = 1 - 0.7 * seg(p, 2, 3.8); }
      k.tab.setAttribute('transform', `translate(380 ${ty.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${sc.toFixed(3)})`);
      op(k.tabcloud, p < 2 ? 0 : 0.25 + 0.4 * seg(p, 2, 3));
      k.bubbles.forEach((b, i) => {
        const run = p < 2 ? seg(t2, 0.5, 1) : 1;
        const f = ((p * 1.7 + i * 0.21) % 1);
        b.setAttribute('cx', (372 + i * 5 + Math.sin(f * 6 + i) * 4).toFixed(1));
        b.setAttribute('cy', (452 - f * 240).toFixed(1));
        op(b, run * (1 - f) * 0.9);
      });
      // light: on from scene 3
      const on = seg(p, 2, 2.1);
      const A = 0.41 * outCubic(seg(p, 2.08, 2.8));
      const T = Math.pow(10, -A);
      op(k.ledglow, on); op(k.beamA, on); op(k.beamB, on * 0.95); op(k.beamC, on * T);
      k.beamEnd.setAttribute('stop-opacity', T.toFixed(3));
      op(k.photons, on * 0.8); k.photons.style.strokeDashoffset = String(-p * 420);
      op(k.tint, 0.24 * seg(p, 2, 3.6));
      op(k.readA, o[2] > 0 ? Math.min(1, seg(p, 2.02, 2.12)) * (1 - seg(p, 2.88, 3)) : 0);
      k.abs.textContent = A.toFixed(2);
      k.tbar.setAttribute('width', (122 * T).toFixed(1));
      k.tpct.textContent = Math.round(T * 100) + ' %';
      // glow: scene 4
      const g = outCubic(seg(p, 3.02, 3.75));
      op(k.bloom, g * 0.95); k.bloom.setAttribute('r', (40 + 150 * g).toFixed(1));
      op(k.halo, g); k.halo.setAttribute('r', (16 + 36 * g).toFixed(1));
      k.gfilter.setAttribute('fill', `rgba(95,211,154,${(0.55 + 0.45 * g).toFixed(3)})`);
      op(k.readG, seg(p, 3, 3.1));
      k.gbar.setAttribute('width', (122 * 0.82 * g).toFixed(1));
      k.gword.textContent = g < 0.08 ? 'dark' : g < 0.95 ? 'rising' : 'risen';
    }

    // 2 · ripples
    if (o[1] > 0) {
      const t = local(1, p);
      k.rip.forEach((e, i) => {
        const r = seg(t, 0.3 + i * 0.09, 0.62 + i * 0.09);
        e.setAttribute('rx', (6 + 74 * r).toFixed(1)); e.setAttribute('ry', ((6 + 74 * r) * 0.16).toFixed(1));
        op(e, r > 0 && r < 1 ? (1 - r) * 0.9 : 0);
      });
      const s = seg(t, 0.31, 0.5);
      k.splash.forEach((c, i) => {
        const dir = [-1, -0.4, 0.4, 1][i];
        c.setAttribute('cx', (380 + dir * 30 * s).toFixed(1));
        c.setAttribute('cy', (WL - 4 - 26 * Math.sin(Math.PI * s) * (1 - Math.abs(dir) * 0.3)).toFixed(1));
        op(c, s > 0 && s < 1 ? 1 : 0);
      });
      op(k.tabl, 1 - seg(t, 0.2, 0.3));
    }

    // 5 · curve and capsule
    if (o[4] > 0) {
      const t = local(4, p);
      const d = outCubic(seg(t, 0, 0.8));
      k.curve.style.strokeDashoffset = String(curveLen * (1 - d));
      k.gcurve.style.strokeDashoffset = String(gLen * (1 - d));
      const pt = k.curve.getPointAtLength(curveLen * d);
      k.head.setAttribute('cx', pt.x.toFixed(1)); k.head.setAttribute('cy', pt.y.toFixed(1));
      op(k.plat, seg(t, 0.78, 0.9));
      const f = outCubic(seg(t, 0.04, 0.85));
      const level = 296 - 292 * f;
      const ph = p * 14;
      let w = `M0 ${(level + 3 * Math.sin(ph)).toFixed(1)}`;
      for (let x = 10; x <= 140; x += 10) w += ` L${x} ${(level + 3 * Math.sin((x / 70) * Math.PI * 2 + ph)).toFixed(1)}`;
      k.liq.setAttribute('d', w + ' L140 300 L0 300 Z');
      const mix = (a, b) => Math.round(a + (b - a) * f * 0.75);
      k.liq.setAttribute('fill', `rgb(${mix(79, 95)}, ${mix(179, 211)}, ${mix(255, 154)})`);
      k.pct.textContent = Math.round(f * 100) + ' %';
    }

    // 6 · verdict and money
    if (o[5] > 0) {
      const t = local(5, p);
      const c = outCubic(seg(t, 0, 0.18));
      k.card.setAttribute('transform', `translate(0 ${(14 * (1 - c)).toFixed(1)})`); op(k.card, c);
      k.w1.classList.toggle('on', t > 0.2);
      const tap = seg(t, 0.36, 0.5);
      op(k.tapring, tap > 0 && tap < 1 ? 1 - tap : 0); k.tapring.setAttribute('r', (10 + 20 * tap).toFixed(1));
      const m = seg(t, 0.5, 0.85);
      k.w2.classList.toggle('on', t > 0.48);
      const e = outCubic(m);
      k.token.setAttribute('transform', `translate(${(392 + 86 * e).toFixed(1)} 386)`);
      op(k.token, m > 0 && m < 1 ? 1 : 0);
      k.escAmt.textContent = money(1240 * (1 - e));
      k.supAmt.textContent = money(1240 * e);
      k.n3.classList.toggle('st-node--pass', m >= 1);
    }
  }
  return { el: svg, render };
}

/* ---------- the story section ---------- */
const copyHTML = (s, i) => `<p class="sc-n"><b>${s.n}</b> / 06 · ${s.time}</p><p class="sc-line">${s.line}</p><p class="sc-cap">${s.cap}</p>`;

export function mountStory(section) {
  const track = section.querySelector('.story-track');
  const stack = section.querySelector('.story-stack');
  const wide = matchMedia('(min-width: 901px)');
  let pinBuilt = false, stackBuilt = false;

  function buildPin() {
    if (pinBuilt) return; pinBuilt = true;
    const rail = track.querySelector('.story-rail');
    const copy = track.querySelector('.story-copy');
    const stageEl = track.querySelector('.story-stage');
    const stage = makeStage();
    stageEl.appendChild(stage.el);
    rail.innerHTML = `<span class="rail-line" aria-hidden="true"><span class="rail-fill"></span></span>` + SCENES.map((s, i) => `<li><button type="button" data-i="${i}" aria-label="Scene ${s.n}: ${s.name}"><i aria-hidden="true"></i><span class="rn">${s.n}</span><span class="rl">${s.name}</span></button></li>`).join('');
    copy.innerHTML = SCENES.map((s, i) => `<div class="sc-copy" data-i="${i}">${copyHTML(s, i)}</div>`).join('');
    const fill = rail.querySelector('.rail-fill');
    const btns = [...rail.querySelectorAll('button')];
    const copies = [...copy.querySelectorAll('.sc-copy')];
    let active = -1;
    const render = (p) => {
      p = clamp(p, 0, 5.999);
      stage.render(p);
      fill.style.transform = `scaleY(${(p / 5.8).toFixed(4)})`;
      const a = Math.min(5, Math.floor(p));
      copies.forEach((c, i) => {
        // in during the last 14 % of the previous scene's window, out during the last 14 % of its own
        const inn = i === 0 ? 1 : seg(p, i - 0.14, i);
        const out = i === 5 ? 1 : seg(i + 1 - p, 0, 0.14);
        const v = Math.min(inn, out);
        c.style.opacity = v.toFixed(3);
        c.style.transform = `translateY(${((1 - v) * (p < i ? 22 : -22)).toFixed(1)}px)`;
        c.style.visibility = v > 0.01 ? 'visible' : 'hidden';
      });
      if (a !== active) {
        active = a;
        btns.forEach((b, i) => { b.classList.toggle('on', i === a); b.classList.toggle('past', i < a); b.setAttribute('aria-current', i === a ? 'step' : 'false'); });
        track.dataset.scene = String(a + 1);
      }
    };
    render(0);
    createTimer({
      duration: 6000,
      autoplay: onScroll({ target: track, enter: 'top+=60 top', leave: 'bottom bottom', sync: 0.35 }),
      onUpdate: (self) => render((self.currentTime / 6000) * 6),
    });
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const top = track.getBoundingClientRect().top + scrollY - 60;
      const span = track.offsetHeight - (innerHeight - 60);
      scrollTo({ top: top + ((i + 0.45) / 6) * span, behavior: 'smooth' });
    }));
  }

  function buildStack() {
    if (stackBuilt) return; stackBuilt = true;
    stack.innerHTML = SCENES.map((s, i) => `<article class="sc-card" data-i="${i}"><div class="sc-copy">${copyHTML(s, i)}</div><div class="sc-stage"></div></article>`).join('');
    stack.querySelectorAll('.sc-card').forEach((card, i) => {
      const stage = makeStage();
      card.querySelector('.sc-stage').appendChild(stage.el);
      const end = i + 0.82;
      if (reduced) { stage.render(end); return; }
      stage.render(i);
      const o = { p: i };
      utils.set(card, { opacity: 0 });
      animate(card, { opacity: [0, 1], translateY: [28, 0], duration: 900, ease: 'outCubic', autoplay: onScroll({ target: card, enter: 'bottom-=8% top', repeat: false }) });
      animate(o, { p: end, duration: 2600, delay: 250, ease: 'inOutSine', onUpdate: () => stage.render(o.p), autoplay: onScroll({ target: card, enter: 'bottom-=20% top', repeat: false }) });
    });
  }

  const pick = () => { if (wide.matches && !reduced) buildPin(); else buildStack(); };
  pick();
  wide.addEventListener('change', pick);
}

/* ---------- Coinbase: 402 → sign → settle → 200 ---------- */
export function mountCoinbase(section) {
  const flow = section.querySelector('.cbx-flow');
  if (!flow || reduced) return;
  const steps = flow.querySelectorAll('.cbx-step');
  const arrows = flow.querySelectorAll('.cbx-arrow path');
  const cards = section.querySelectorAll('.cbx-card');
  utils.set([...steps, ...cards], { opacity: 0 });
  arrows.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
  animate(steps, { opacity: [0, 1], translateY: [16, 0], duration: 700, delay: stagger(260), ease: 'outCubic', autoplay: onScroll({ target: flow, enter: 'bottom-=15% top', repeat: false }) });
  animate(arrows, {
    strokeDashoffset: 0, duration: 520, delay: stagger(130, { start: 380 }), ease: 'inOutSine',
    autoplay: onScroll({ target: flow, enter: 'bottom-=15% top', repeat: false }),
    onComplete: () => { arrows.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); flow.classList.add('live'); },
  });
  animate(cards, { opacity: [0, 1], translateY: [22, 0], duration: 800, delay: stagger(140), ease: 'outCubic', autoplay: onScroll({ target: section.querySelector('.cbx-three'), enter: 'bottom-=10% top', repeat: false }) });
}

/* ---------- FIG grid: curved data-flow arrows between the cards (desktop, three columns) ---------- */
// [from, to, label, side]: indexes into .figs children; h = horizontal neighbours, v = stacked
const FLOWS = [
  [1, 0, 'light in', 'h'],
  [1, 2, 'what gets through', 'h'],
  [2, 5, 'A0 · A1', 'v'],
  [5, 6, '1 CSV line/s', 'v'],
  [6, 7, 'to the software', 'v'],
];
export function mountFigArrows(figs) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'fig-arrows');
  svg.setAttribute('aria-hidden', 'true');
  figs.appendChild(svg);
  let drawn = false;
  const draw = () => {
    const cards = [...figs.children].filter((c) => c.classList.contains('fig'));
    const box = figs.getBoundingClientRect();
    const r = cards.map((c) => { const b = c.getBoundingClientRect(); return { x: b.left - box.left, y: b.top - box.top, w: b.width, h: b.height }; });
    const three = r.length >= 8 && Math.abs(r[0].y - r[2].y) < 2 && r[3].y > r[0].y + 10 && box.width >= 1000;
    svg.style.display = three ? '' : 'none';
    if (!three) return;
    svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(0)} ${box.height.toFixed(0)}`);
    let out = '';
    FLOWS.forEach(([a, b, label, side]) => {
      const A = r[a], B = r[b];
      if (side === 'h') {
        const leftToRight = B.x > A.x;
        const bx = leftToRight ? A.x + A.w : A.x;
        const y = A.y + A.h * 0.36;
        const x1 = leftToRight ? bx - 46 : bx + 46, x2 = leftToRight ? bx + 46 : bx - 46;
        out += `<path class="fa-p" d="M${x1} ${y} Q${bx} ${y - 44} ${x2} ${y}"/>`;
        const dir = leftToRight ? 1 : -1;
        out += `<path class="fa-h" d="M${x2 - dir * 9} ${y - 8} L${x2} ${y} L${x2 - dir * 11} ${y + 3}"/>`;
        out += `<g class="fa-l" transform="translate(${bx} ${y - 40})"><rect x="${-(label.length * 3.3 + 10)}" y="-11" width="${label.length * 6.6 + 20}" height="20" rx="10"/><text y="3" text-anchor="middle">${label}</text></g>`;
      } else {
        const x = A.x + A.w * (b === 7 ? 0.5 : 0.86);
        const by = A.y + A.h;
        const y1 = by - 30, y2 = by + 30;
        out += `<path class="fa-p" d="M${x} ${y1} Q${x + 40} ${by} ${x} ${y2}"/>`;
        out += `<path class="fa-h" d="M${x + 8} ${y2 - 9} L${x} ${y2} L${x - 3} ${y2 - 11}"/>`;
        out += `<g class="fa-l" transform="translate(${x - 24} ${by})"><rect x="${-(label.length * 6.6 + 20)}" y="-10" width="${label.length * 6.6 + 20}" height="20" rx="10"/><text x="-10" y="4" text-anchor="end">${label}</text></g>`;
      }
    });
    svg.innerHTML = out;
    const paths = svg.querySelectorAll('.fa-p');
    if (reduced || drawn) { svg.classList.add('in'); return; }
    paths.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    animate(paths, {
      strokeDashoffset: 0, duration: 900, delay: stagger(220), ease: 'inOutSine',
      autoplay: onScroll({ target: figs, enter: 'bottom-=25% top', repeat: false }),
      onComplete: () => { drawn = true; paths.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); svg.classList.add('in'); },
    });
    animate(svg.querySelectorAll('.fa-h, .fa-l'), { opacity: [0, 1], duration: 500, delay: stagger(220, { start: 600 }), ease: 'outCubic', autoplay: onScroll({ target: figs, enter: 'bottom-=25% top', repeat: false }) });
  };
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  new ResizeObserver(schedule).observe(figs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
}
