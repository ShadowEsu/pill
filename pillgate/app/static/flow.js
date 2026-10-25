// "How Pill fits together": the shared diagram from pitch/FLOW-SPEC.md, drawn from the tables below.
// Facts are fixed by the spec; change the words here, not in the SVG. Words stay ink; colour is only fill.
// A dashed arrow means "not yet run" (the paid 200). Loaded before app.js; app.js calls PillFlow.html().
"use strict";
(() => {
  // [id, x, y, w, h, fill, lines[], extra]: the first line is the title (bold). fill: plain mint amber grey red violet sky
  const NODES = [
    // 1 · Measure
    ["tablet", 20, 44, 230, 44, "plain", ["One tablet"]],
    ["station", 20, 120, 230, 118, "violet", ["Station (UNO Q)", "blue · white · red LEDs", "2 photoresistors", "1 CSV line/s", "the firmware decides nothing"]],
    ["analysis", 20, 272, 230, 74, "plain", ["analysis.py", "deterministic: curve maths,", "quality gates"]],
    // 2 · Three answers
    ["pass", 290, 110, 210, 52, "mint", ["Passed the screen"]],
    ["lab", 290, 190, 210, 52, "amber", ["Needs lab testing"]],
    ["unable", 290, 270, 210, 52, "grey", ["Unable to verify"]],
    // 3 · Policy agent (clinic app)
    ["in-recall", 540, 44, 84, 64, "plain", ["Recall lookup", "(openFDA)"], { small: true }],
    ["in-label", 632, 44, 84, 64, "plain", ["Bottle label", "by Gemini;", "unreadable", "= null"], { small: true }],
    ["in-amount", 724, 44, 84, 64, "plain", ["Invoice", "amount vs cap"], { small: true }],
    ["in-tap", 816, 44, 84, 64, "plain", ["Pharmacist's", "tap"], { small: true }],
    ["policy", 540, 150, 360, 120, "sky", ["Policy agent (clinic app, pill/pay)", "Six clauses P1–P6, in code → a ceiling.", "Claude may only return the ceiling", "or escalate."]],
    ["release", 580, 300, 320, 62, "mint", ["Release · escrow → supplier", "Passed + no recall + amount within cap + tap"]],
    ["hold", 580, 384, 320, 62, "red", ["Hold + lab referral draft", "Needs lab testing"]],
    ["escalate", 580, 468, 320, 62, "grey", ["Escalate to a person", "Unable to verify · nothing moves"]],
    // 4 · The money (Coinbase)
    ["chip", 940, 40, 280, 40, "violet", ["escrow moves: mode: simulated", "until a CDP key"], { small: true, chip: true }],
    ["w-clinic", 940, 100, 280, 56, "plain", ["pill-clinic", "CDP server wallet"]],
    ["w-escrow", 940, 220, 280, 56, "plain", ["pill-escrow", "hold, when the delivery is logged"]],
    ["w-supplier", 940, 340, 280, 56, "plain", ["pill-supplier", "release"]],
    ["nessie", 940, 456, 280, 58, "sky", ["Capital One Nessie mirrors every", "move in sandbox dollars (SANDBOX)"], { small: true }],
    // the x402 lane
    ["x-buyer", 6, 640, 180, 80, "plain", ["Buyer agent", "another clinic or an agent", "with no local reference"]],
    ["x-post", 212, 640, 180, 80, "plain", ["POST /verify", "with a curve"]],
    ["x-402", 418, 640, 180, 80, "amber", ["402 Payment Required", "0.05 USDC · Base Sepolia", "TESTNET · price in the 402"]],
    ["x-sign", 624, 640, 180, 80, "plain", ["Buyer reads the price,", "checks its 1 USDC / 24 h", "cap, signs"]],
    ["x-fac", 830, 640, 180, 80, "plain", ["Facilitator", "verifies the signature"]],
    ["x-200", 1036, 640, 180, 80, "mint", ["200 + verdict JSON", "paid 200: pending a CDP key", "0.05 test USDC"], { dashed: true }],
  ];
  // [path, style, label?, [lx, ly, anchor, rotate?]]: every arrow is ink; style true = dashed (not yet run), "line" = no head
  const ARROWS = [
    ["M135 88 V120"], ["M135 238 V272"],
    ["M250 309 H270 V136 H290"], ["M270 216 H290"], ["M270 296 H290"],
    ["M500 136 H520 V296 H500", "line"], ["M500 216 H520", "line"], ["M520 216 H540", false, "the verdict", [531, 250, "middle", -90]],
    ["M582 108 V150"], ["M674 108 V150"], ["M766 108 V150"], ["M858 108 V150"],
    ["M556 270 V331 H580"], ["M556 331 V415 H580"], ["M556 415 V499 H580"],
    ["M900 331 H920 V368 H940"],
    ["M1080 156 V220", false, "hold", [1090, 194, "start"]],
    ["M1080 276 V340", false, "release", [1090, 314, "start"]],
    ["M1220 248 C1246 248 1246 128 1220 128", false, "refund", [1238, 196, "end"]],
    ["M135 346 V616 H302 V640", false, "this station's verdict can be sold", [145, 470, "start"]],
    ["M186 680 H212"], ["M392 680 H418"], ["M598 680 H624"], ["M804 680 H830"],
    ["M1010 680 H1036", true],
  ];
  const TEXT = [
    [20, 24, "1 · Measure", "h"], [290, 24, "2 · Three answers", "h"], [540, 24, "3 · Policy agent (clinic app)", "h"], [940, 24, "4 · The money (Coinbase)", "h"],
    [290, 350, "Three answers, never four.", "c"], [290, 366, "No model sets a verdict.", "c"],
    [940, 422, "USDC on Base Sepolia (TESTNET)", "c"], [940, 438, "Coinbase CDP SDK server wallets", "c"],
    [420, 604, "Second lane · selling a verdict over Coinbase x402", "h"],
    [6, 748, "Real 402 today; the facilitator's verify step answered (insufficient_balance on our unfunded test wallet).", "c"],
    [6, 766, "Libraries: @x402/express · @x402/evm · CDP SDK. Service modes: cdp · public-facilitator · simulated, each named in every response.", "c"],
  ];
  const MODELS = [
    ["Claude", "claude-sonnet-5 in this station app tonight; claude-sonnet-5-5 named in the Devpost text",
      "Station: reads the bottle label and the imprint, writes the report, answers Ask, all behind the guardrail. Clinic: the two-sentence \"why\"; the escrow clerk (returns the ceiling computed in code, or escalate).", "Sets a verdict; moves money"],
    ["Gemini", "clinic app",
      "Clinic: reads the bottle label into editable fields (unreadable → null); runs the agentic checker (label, up to three cup frames, code tools for the recall lookup).", "Sets a verdict; invents a field"],
    ["Deterministic code", "analysis.py, rules.ts, policy",
      "analysis.py and rules.ts (U1 U2 U3 N1 N2 N3 P1) set every verdict; policy computes the ceiling; the clause filter drops any model sentence with a banned claim word (more than half dropped → rule text instead).", "Calls a model to decide"],
  ];
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function svg() {
    const nodes = NODES.map(([id, x, y, w, h, fill, lines, o = {}], i) => {
      const fs = o.small ? 10.5 : 12, lh = o.small ? 13 : 15, top = y + (h - lh * lines.length) / 2 + fs;
      return `<g class="fl-node f-${fill}${o.dashed ? " dashed" : ""}${o.chip ? " chip" : ""}" style="--i:${i}" data-id="${id}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.chip ? h / 2 : 10}"/>
        ${lines.map((t, k) => `<text x="${x + (o.chip ? 16 : o.small ? 6 : 10)}" y="${top + k * lh}" class="${k ? "fl-l" : "fl-t"}" font-size="${k ? fs - 0.5 : fs}">${e(t)}</text>`).join("")}</g>`;
    }).join("");
    const arrows = ARROWS.map(([d, style, label, at]) => `<path class="fl-arrow${style === true ? " dashed" : ""}" d="${d}"${style === "line" ? "" : ' marker-end="url(#fl-head)"'}/>${label ? `<text x="${at[0]}" y="${at[1]}" text-anchor="${at[2]}" class="fl-al"${at[3] ? ` transform="rotate(${at[3]} ${at[0]} ${at[1]})"` : ""}>${e(label)}</text>` : ""}`).join("");
    const text = TEXT.map(([x, y, t, k]) => `<text x="${x}" y="${y}" class="fl-${k}">${e(t)}</text>`).join("");
    return `<svg class="flow-svg" viewBox="0 0 1250 780" role="img" aria-labelledby="fl-title fl-desc">
      <title id="fl-title">How Pill fits together</title>
      <desc id="fl-desc">The station measures one tablet; analysis.py gives one of three answers; the clinic app's policy agent turns the answer into Release, Hold or Escalate; Coinbase CDP server wallets move test USDC from clinic to escrow to supplier. A second lane sells a verdict over x402: POST /verify, 402 Payment Required for 0.05 test USDC, the buyer signs, the facilitator checks the signature, and the paid 200 is still pending a CDP key.</desc>
      <defs><marker id="fl-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="fl-headp"/></marker></defs>
      <line x1="0" y1="584" x2="1250" y2="584" class="fl-rule"/>
      ${arrows}${nodes}${text}</svg>`;
  }
  function models() {
    return `<div class="fl-table-wrap"><table class="fl-table"><caption>The models: who does what, and what each never does</caption>
      <thead><tr><th scope="col">Model</th><th scope="col">Does</th><th scope="col">Never</th></tr></thead>
      <tbody>${MODELS.map(([m, sub, does, never]) => `<tr><th scope="row">${e(m)}<small>${e(sub)}</small></th><td>${e(does)}</td><td>${e(never)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  window.PillFlow = {
    html: () => `<div class="flow-scroll" tabindex="0" aria-label="Diagram, scrolls sideways on small screens">${svg()}</div>
      <p class="flow-hint">Scroll sideways to see the whole diagram →</p>${models()}`,
  };
})();
