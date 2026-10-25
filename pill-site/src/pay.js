// Payments section: the verdict is the invoice.
// Three interactive pieces: the rail (verdict → money), the x402 call, the pricing calculator.
// All money is SANDBOX / testnet; nothing here talks to a network.
import { animate, utils } from 'animejs';

const reduced = document.documentElement.classList.contains('reduced');
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------- the rail ---------- */
const RAIL = {
  pass: {
    title: 'PASS · P1 · release',
    escrowAmt: '0.00', supplierAmt: '1,240.00', hold: false,
    lines: [
      ['dim', '00:03:12  verdict PASS  rule P1  plateau 0.41 in band 0.36–0.47'],
      ['dim', '00:03:12  policy: release needs PASS · no recall on lot B2-07 · ≤ cap · pharmacist tap'],
      ['ok', '00:03:40  pharmacist tapped RELEASE'],
      ['ok', '00:03:41  SIMULATED  escrow → supplier  USDC 0.124 (invoice 1,240 at ×0.0001 test scale)  ·  Base Sepolia  ·  nothing moved'],
      ['dim', '00:03:41  Nessie sandbox mirror: built, runs only if its key lands  ·  log line written'],
    ],
  },
  needslab: {
    title: 'NEEDS LAB · N1 · hold',
    escrowAmt: '1,240.00', supplierAmt: '0.00', hold: true,
    lines: [
      ['dim', '00:03:12  verdict NEEDS LAB  rule N1  plateau 0.12 below band'],
      ['ok', '00:03:12  policy: HOLD  ·  funds stay in escrow  ·  no tap offered'],
      ['ok', '00:03:13  lab referral drafted: lot B2-07, curve + raw trace attached'],
      ['dim', '00:03:13  supplier notified: payment held pending lab result  (SANDBOX)'],
    ],
  },
  unable: {
    title: 'UNABLE TO VERIFY · U1 · escalate',
    escrowAmt: '1,240.00', supplierAmt: '0.00', hold: true,
    lines: [
      ['dim', '00:00:04  verdict UNABLE TO VERIFY  rule U1  no reference band for this drug'],
      ['ok', '00:00:04  policy: ESCALATE to a person  ·  no money moves'],
      ['dim', '00:00:04  log line written  ·  nothing sent to the supplier'],
    ],
  },
};

function railSvg() {
  return `
  <svg class="rail-svg" viewBox="0 0 640 230" role="img" aria-label="Clinic wallet, Pill escrow and supplier wallet, with the amount moving between them by verdict">
    <g class="w1"><rect class="node" x="10" y="60" width="180" height="110" rx="16"/>
      <text class="lbl" x="28" y="92">Clinic</text><text class="sub" x="28" y="110">wallet · USDC on Base</text>
      <text class="amt" x="28" y="150" id="rail-clinic">8,760.00</text></g>
    <g class="w2"><rect class="node escrow" id="rail-escrow-node" x="230" y="60" width="180" height="110" rx="16"/>
      <text class="lbl" x="248" y="92">Pill escrow</text><text class="sub" x="248" y="110" id="rail-escrow-sub">holds until verdict + tap</text>
      <text class="amt" x="248" y="150" id="rail-escrow">1,240.00</text></g>
    <g class="w3"><rect class="node" x="450" y="60" width="180" height="110" rx="16"/>
      <text class="lbl" x="468" y="92">Supplier</text><text class="sub" x="468" y="110">wallet · USDC on Base</text>
      <text class="amt" x="468" y="150" id="rail-supplier">0.00</text></g>
    <path class="wire" id="wire-a" d="M190 115 H230"/>
    <path class="wire" id="wire-b" d="M410 115 H450"/>
    <g id="rail-token" opacity="0"><circle class="token" cx="0" cy="0" r="13"/><text class="token-lbl" y="3">USDC</text></g>
    <text class="sub" x="10" y="205">delivery logged → clinic pays into escrow → tablet tested → policy decides → pharmacist taps</text>
    <text class="sub" x="10" y="222">illustration · simulated, nothing moves · Base Sepolia once a CDP key is in</text>
  </svg>`;
}

export function mountRail(el) {
  el.innerHTML = `
    <div class="rail-head">
      <p class="caption">the rail · pick a verdict · simulated</p>
      <div class="rail-verdicts" role="group" aria-label="Verdict">
        <button type="button" data-v="pass" aria-pressed="true">PASS</button>
        <button type="button" data-v="needslab" aria-pressed="false">NEEDS LAB</button>
        <button type="button" data-v="unable" aria-pressed="false">UNABLE TO VERIFY</button>
      </div>
    </div>
    ${railSvg()}
    <div class="rail-log" id="rail-log" aria-live="polite"></div>
    <div class="rail-foot"><span id="rail-title">PASS · P1 · release</span><span>illustration · simulated, nothing moves</span></div>`;

  const log = el.querySelector('#rail-log');
  const token = el.querySelector('#rail-token');
  const wireB = el.querySelector('#wire-b');
  const escrowNode = el.querySelector('#rail-escrow-node');
  const escrowSub = el.querySelector('#rail-escrow-sub');
  const escrowAmt = el.querySelector('#rail-escrow');
  const supplierAmt = el.querySelector('#rail-supplier');
  const title = el.querySelector('#rail-title');
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; utils.remove(token); };

  function show(v) {
    clear();
    const cfg = RAIL[v];
    title.textContent = cfg.title;
    el.querySelectorAll('.rail-verdicts button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    escrowNode.classList.toggle('hold', cfg.hold);
    escrowSub.textContent = cfg.hold ? (v === 'unable' ? 'escalated · nothing moves' : 'HELD · lab referral drafted') : 'released on the tap';
    wireB.classList.remove('live', 'dead');
    wireB.classList.add(cfg.hold ? 'dead' : 'live');
    escrowAmt.textContent = '1,240.00';
    supplierAmt.textContent = '0.00';
    token.setAttribute('opacity', '0');
    log.innerHTML = '';

    const step = reduced ? 0 : 650;
    cfg.lines.forEach(([cls, text], i) => {
      timers.push(setTimeout(() => {
        const span = document.createElement('span');
        span.className = cls; span.textContent = text + '\n';
        log.appendChild(span);
        if (!reduced) animate(span, { opacity: [0, 1], translateY: [4, 0], duration: 320, ease: 'outQuad' });
      }, i * step));
    });
    if (!cfg.hold) {
      const at = reduced ? 0 : 3 * step + 200;
      timers.push(setTimeout(() => {
        if (reduced) { escrowAmt.textContent = cfg.escrowAmt; supplierAmt.textContent = cfg.supplierAmt; return; }
        token.setAttribute('opacity', '1');
        animate(token, {
          translateX: [320, 540], translateY: [115, 115], duration: 900, ease: 'inOutCubic',
          onComplete: () => { token.setAttribute('opacity', '0'); escrowAmt.textContent = cfg.escrowAmt; supplierAmt.textContent = cfg.supplierAmt; animate(supplierAmt, { opacity: [0, 1], duration: 300 }); },
        });
      }, at));
    }
  }

  el.querySelectorAll('.rail-verdicts button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));
  show('pass');
  return { show, destroy: clear };
}

/* ---------- x402: paying for a verdict ---------- */
const X402_LINES = [
  ['c', '$ curl https://pill.example/verify -d @curve.json'],
  ['k', '← 402 Payment Required'],
  ['c', '  PAYMENT-REQUIRED: {"scheme":"exact","network":"base-sepolia","asset":"USDC","amount":"0.05","payTo":"0x9c1f…a4d2"}'],
  ['c', '  … agent wallet signs 0.05 USDC (CDP wallet, TESTNET) …'],
  ['c', '$ curl https://pill.example/verify -H "X-PAYMENT: <signed>" -d @curve.json'],
  ['k', '← 200 OK  ·  pending: lands once the CDP key is in'],
  ['c', '  expected body: {"verdict":"PASS","rule":"P1","plateau":0.41,"band":[0.36,0.47],"run_id":"…","why":"…"}'],
];

export function mountX402(el) {
  el.innerHTML = `
    <h4>Pay-per-verdict, with x402</h4>
    <p>Another clinic, an NGO, or someone else's box can send a curve and buy a verdict for a few cents. No account, no key exchange: the server answers 402, the wallet pays, the server answers 200.</p>
    <div class="term" id="x402-term" aria-live="polite">${X402_LINES.map(([c, t]) => `<span class="line ${c}">${esc(t)}</span>`).join('')}</div>
    <div class="row"><button type="button" class="pbtn-call" id="x402-run">Call /verify</button><button type="button" class="pbtn-call alt" id="x402-reset">Reset</button><span class="caption" style="margin:0">testnet · 0.05 USDC · simulated here · the paid 200 is pending</span></div>`;
  const lines = [...el.querySelectorAll('.line')];
  const run = el.querySelector('#x402-run');
  const reset = el.querySelector('#x402-reset');
  let timers = [];
  const stop = () => { timers.forEach(clearTimeout); timers = []; };
  const doReset = () => { stop(); lines.forEach((l) => l.classList.remove('on')); run.disabled = false; };
  const play = () => {
    doReset(); run.disabled = true;
    const step = reduced ? 0 : 520;
    lines.forEach((l, i) => timers.push(setTimeout(() => { l.classList.add('on'); if (i === lines.length - 1) run.disabled = false; }, i * step)));
  };
  run.addEventListener('click', play);
  reset.addEventListener('click', doReset);
  if (reduced) lines.forEach((l) => l.classList.add('on'));
  return { play, reset: doReset, destroy: stop };
}

/* ---------- pricing calculator ---------- */
export function mountCalc(el) {
  el.innerHTML = `
    <div>
      <label for="calc-st">Stations <output id="calc-st-o">3</output></label>
      <input id="calc-st" type="range" min="1" max="40" value="3" step="1">
      <label for="calc-td">Tests per station per day <output id="calc-td-o">6</output></label>
      <input id="calc-td" type="range" min="1" max="30" value="6" step="1">
    </div>
    <div class="out">
      <div><b id="calc-month">$60</b><span>per month, proposed clinic plan</span></div>
      <div><b id="calc-test">$0.21</b><span>per test, including the tablet</span></div>
      <div><b id="calc-tests">540</b><span>tests a month</span></div>
      <div><b id="calc-lab">132×</b><span>cheaper than one Minilab sample (€25.85)</span></div>
    </div>
    <p class="note">proposed pricing, not a live offer · assumes a $0.10 tablet, one whole tablet per test · Minilab per-sample figure from the 13-country study (PMC9338985), at 1.08 USD per EUR · lab tester $20,000–$100,000 not included</p>`;
  const st = el.querySelector('#calc-st'), td = el.querySelector('#calc-td');
  const o = (id) => el.querySelector('#' + id);
  const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  function update() {
    const s = +st.value, t = +td.value;
    const month = s * 20;
    const tests = s * t * 30;
    const perTest = month / tests + 0.10;
    const lab = 25.85 * 1.08; // EUR→USD, rounded
    o('calc-st-o').textContent = s; o('calc-td-o').textContent = t;
    o('calc-month').textContent = '$' + fmt(month);
    o('calc-test').textContent = '$' + fmt(perTest, 2);
    o('calc-tests').textContent = fmt(tests);
    o('calc-lab').textContent = fmt(lab / perTest) + '×';
  }
  st.addEventListener('input', update); td.addEventListener('input', update);
  update();
  return { update };
}
