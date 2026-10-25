// Pill Gate front end - plain JavaScript, no build step.
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
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const RESULT_TEXT = { PASSED_SCREEN: "Passed the screen", NEEDS_LAB: "Needs lab testing", UNABLE_TO_VERIFY: "Unable to verify" };

const state = { step: 1, recording: false, runId: null, scanId: null, chat: [], pollTimer: null };

// ---------------------------------------------------------------- tabs
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
  if (b.dataset.view === "history") loadHistory();
  if (b.dataset.view === "profiles") loadProfilesView();
  if (b.dataset.view === "atlas") loadAtlas();
}));

// ---------------------------------------------------------------- steps
function go(n) {
  state.step = n;
  for (let i = 1; i <= 4; i++) $("step-" + i).classList.toggle("hidden", i !== n);
  document.querySelectorAll("#stepper li").forEach((li) => li.classList.toggle("on", +li.dataset.step <= n));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(+b.dataset.go)));

function preview(input, img) {
  input.addEventListener("change", () => { const f = input.files[0]; img.src = f ? URL.createObjectURL(f) : ""; });
}
preview($("bottleFile"), $("bottlePrev"));
preview($("imprintFile"), $("imprintPrev"));

// ---------------------------------------------------------------- config + device pill
async function boot() {
  try {
    const c = await api("/api/config");
    $("appName").textContent = c.app_name; document.title = c.app_name;
    if (!c.ai) $("voiceNote").textContent = "AI is in mock mode (no ANTHROPIC_API_KEY on the server).";
    if (c.timing) G.timing = c.timing;
  } catch {}
  loadProfileSelect(); loadRunSelect(); setInterval(tick, 1000); tick();
}
async function tick() {
  let d;
  try { d = await api("/api/live"); } catch { $("devicePill").textContent = "server offline"; $("devicePill").className = "pill bad"; return; }
  const st = d.status, p = $("devicePill");
  const fresh = st.seconds_since_last !== null && st.seconds_since_last < 4;
  p.textContent = st.mode === "no device" ? "no device" : `${st.mode}${fresh ? " · live" : " · waiting"}`;
  p.className = "pill " + (st.mode.startsWith("serial") && fresh ? "ok" : st.mode.startsWith("replay") ? "warn" : "bad");
  if (st.mode.startsWith("replay")) p.textContent = "REPLAY (not live) · " + st.mode.slice(7);
  if (state.recording && d.live && d.live.curve) drawLive(d.live);
  else if (state.recording && d.live && d.live.waiting) { $("liveSec").textContent = "…"; }
  if (state.recording) guideTick(d);
}

// ---------------------------------------------------------------- charts
function makeChart(canvas) {
  return new Chart(canvas, {
    type: "line", data: { datasets: [] },
    options: {
      animation: false, maintainAspectRatio: false, parsing: false, normalized: true,
      scales: { x: { type: "linear", title: { display: true, text: "seconds after tablet in" }, ticks: { color: css("--muted") } },
                y: { title: { display: true, text: "absorbance" }, ticks: { color: css("--muted") } } },
      plugins: { legend: { labels: { color: css("--ink"), boxWidth: 12 } } },
      elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
    },
  });
}
const liveChart = makeChart($("liveChart"));
const resultChart = makeChart($("resultChart"));
const SERIES = [["A_B", "blue", "--blue"], ["A_W", "white", "--white"], ["A_G", "green", "--green"], ["A_R", "red (reference)", "--red"], ["A_side", "cloudiness (side sensor)", "--scatter"], ["A_specific", "colour only (blue − red)", "--brand"]];
function setCurve(chart, curve) {
  const t = curve.t || [];
  chart.data.datasets = SERIES.filter(([k]) => curve[k]).map(([k, label, color]) => ({
    label: k === "A_specific" && curve.signal === "cloud" ? "cloudiness (red light)" : k === "A_specific" && curve.signal === "scatter" ? "cloudiness (side sensor)" : label, borderColor: css(color), backgroundColor: css(color), borderDash: k === "A_specific" ? [6, 4] : [],
    data: t.map((x, i) => ({ x, y: curve[k][i] })).filter((p) => p.y !== null),
  }));
  chart.update();
}
function drawLive(l) {
  $("liveSec").textContent = Math.round(l.seconds); $("liveN").textContent = l.samples;
  $("liveIn").textContent = G.phase === "dissolving" && l.tablet_in_at_s ? Math.round(l.tablet_in_at_s) + " s" : "–";
  setCurve(liveChart, l.curve);
}

// ---------------------------------------------------------------- measure step
async function loadProfileSelect() {
  const ps = await api("/api/profiles").catch(() => []);
  const sel = $("profileSel"); sel.length = 1;
  ps.filter((p) => p.calibration || p.reference).forEach((p) => sel.add(new Option(`${p.demo ? "[DEMO - simulated] " : ""}${p.name}${p.mode === "any" ? "" : " · " + p.mode}`, p.id)));
}
async function loadRunSelect() {
  const rs = await api("/api/runs").catch(() => []);
  const sel = $("oldRunSel"); sel.length = 1;
  rs.forEach((r) => sel.add(new Option(`${r.label} · ${r.samples} samples · ${r.id}`, r.id)));
}
// ---- guided run: water check -> add tablet -> dissolve -> auto stop -> result
const G = { phase: "idle", started: 0, timing: { blank_s: 10, min_s: 120, max_s: 600, quick_s: 60 } };
const runMode = () => (document.querySelector('input[name="mode"]:checked') || {}).value || "quick";
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function beep(times = 1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.15; o.start(ctx.currentTime + i * 0.3); o.stop(ctx.currentTime + i * 0.3 + 0.18);
    }
  } catch {}
  if (navigator.vibrate) navigator.vibrate(200);
}
function guideUI(step, phase, text, bar, buttons) {
  $("gStep").textContent = step; $("gPhase").textContent = phase; $("gText").innerHTML = text;
  $("gBar").style.width = Math.max(0, Math.min(100, bar)) + "%";
  ["btnStart", "btnContinue", "btnStopNow", "btnCancel"].forEach((b) => $(b).classList.toggle("hidden", !buttons.includes(b)));
}
function setPhase(p) {
  G.phase = p; G.started = Date.now();
  $("guideBox").classList.toggle("attention", p === "add");
  $("liveChartWrap").classList.toggle("hidden", p !== "dissolving");
  $("modeBox").disabled = !(p === "idle");
  if (p === "idle") {
    guideUI("Step 1 of 3", "Clean water first", "Fill the clear cup with clean water to the marked line, put it in the chamber and close the lid. Then press <b>Start</b>.", 0, ["btnStart"]);
    $("gChecks").innerHTML = "";
  }
  if (p === "water") guideUI("Step 1 of 3", "Checking the water…", "Keep the lid closed and don't touch the box.", 5, ["btnCancel"]);
  if (p === "add") {
    guideUI("Step 2 of 3", "Add the tablet now",
      "Water looks good. <b>Lift the lid, drop the tablet in the middle, stir 5 slow circles with the stick, take the stick out and close the lid — all within about 10 seconds.</b> Then press <b>Continue</b> right away.",
      100, ["btnContinue", "btnCancel"]);
    beep(2);
  }
  if (p === "dissolving") { $("gChecks").innerHTML = ""; guideUI("Step 3 of 3", "Dissolving…", "Keep the lid closed.", 0, runMode() === "quick" ? ["btnCancel"] : ["btnStopNow", "btnCancel"]); setCurve(liveChart, { t: [] }); }
  if (p === "analyzing") guideUI("Step 3 of 3", "Analyzing…", "Building your result.", 100, []);
}
function guideTick(d) {
  if (!d.guide || !d.live) return;
  const g = d.guide;
  if (G.phase === "water" && g.phase === "water") {
    $("gChecks").innerHTML = (g.checks || []).map((c) => `<li>${c.ok ? "✅" : "⏳"} ${esc(c.message)}</li>`).join("");
    $("gBar").style.width = Math.round(100 * (g.steady_s || 0) / (g.needed || 10)) + "%";
    const waited = (Date.now() - G.started) / 1000;
    if (g.ok) { post("/api/run/mark", { name: "water_ok" }).catch(() => {}); setPhase("add"); }
    else if (waited > 60) {
      $("gText").innerHTML = "Still not steady after a minute. Check the lid is closed and nothing moves, or press <b>Continue anyway</b> (the result may be less reliable).";
      $("btnContinue").textContent = "Continue anyway"; $("btnContinue").classList.remove("hidden");
    }
  }
  if (G.phase === "dissolving" && g.phase === "dissolving") {
    const T = G.timing, e = g.elapsed_s || 0;
    if (g.mode === "quick") {
      const q = g.quick_s || T.quick_s;
      $("gBar").style.width = Math.round(100 * e / q) + "%";
      $("gText").innerHTML = `Keep the lid closed. <b>${mmss(e)} of ${mmss(q)}</b> — quick demo, stops by itself.`;
      if (g.stop) { beep(3); finishRun("auto: " + g.why); }
      return;
    }
    const target = g.plateau ? Math.max(e, T.min_s) : Math.min(T.max_s, Math.max(T.min_s, e + 60));
    $("gBar").style.width = Math.round(100 * e / target) + "%";
    $("gText").innerHTML = `Keep the lid closed. ${mmss(e)} so far. It stops by itself when the curve flattens ` +
      `(at least ${mmss(T.min_s)}, at most ${mmss(T.max_s)}).` + (g.plateau ? " <b>Curve is flattening…</b>" : "");
    if (g.stop) { beep(3); finishRun("auto: " + g.why); }
  }
}
async function finishRun(reason) {
  if (G.phase === "analyzing") return;
  setPhase("analyzing");
  try {
    const r = await post("/api/run/stop", { label: "check", profile_id: $("profileSel").value || null });
    state.recording = false; startScan(r.run_id);
  } catch (e) { alert("Could not stop: " + e.message); setPhase("idle"); }
}
$("btnStart").onclick = async () => {
  await post("/api/run/start", { mode: runMode() }); state.recording = true; $("btnContinue").textContent = "Tablet is in — Continue";
  setPhase("water");
};
$("btnContinue").onclick = async () => { await post("/api/run/mark", { name: "tablet_in" }); setPhase("dissolving"); };
$("btnStopNow").onclick = () => finishRun("manual");
$("btnCancel").onclick = async () => {
  try { await post("/api/run/stop", { label: "cancelled" }); } catch {}
  state.recording = false; setPhase("idle");
};
$("btnPaste").onclick = async () => {
  const fd = new FormData(); fd.append("label", "pasted"); fd.append("csv_text", $("pasteBox").value); fd.append("profile_id", $("profileSel").value); fd.append("mode", runMode());
  try { const r = await api("/api/run/upload", { method: "POST", body: fd }); startScan(r.run_id); }
  catch (e) { alert("Could not read that text: " + e.message); }
};
$("btnOldRun").onclick = () => { if ($("oldRunSel").value) startScan($("oldRunSel").value); };

// ---------------------------------------------------------------- scan + result
async function startScan(runId) {
  state.runId = runId; state.chat = []; $("chat").innerHTML = "";
  const fd = new FormData();
  fd.append("run_id", runId); fd.append("profile_id", $("profileSel").value);
  if ($("bottleFile").files[0]) fd.append("bottle", $("bottleFile").files[0]);
  if ($("imprintFile").files[0]) fd.append("imprint", $("imprintFile").files[0]);
  const r = await api("/api/scans", { method: "POST", body: fd });
  openScan(r.scan_id);
}
function openScan(id) {
  state.scanId = id; go(4);
  document.querySelector('.tab[data-view="check"]').click();
  go(4); resetResult(); poll();
}
function resetResult() {
  $("verdictCard").className = "card verdict"; $("vLabel").textContent = "Analyzing…"; $("vHead").textContent = "";
  ["vReasons", "kpis", "stageChips", "reportBox", "sources", "gates"].forEach((i) => ($(i).innerHTML = ""));
  $("recallBanner").classList.add("hidden"); $("guardNote").textContent = ""; $("fields").textContent = "";
  $("issText").classList.add("hidden"); $("btnSubmitIssue").classList.add("hidden");
}
async function poll() {
  clearTimeout(state.pollTimer);
  let s; try { s = await api("/api/scans/" + state.scanId); } catch { state.pollTimer = setTimeout(poll, 1500); return; }
  renderScan(s);
  if (!s.done) state.pollTimer = setTimeout(poll, 1000);
}
function kpi(label, val) { return `<div class="kpi"><b>${esc(val)}</b><small>${esc(label)}</small></div>`; }
function renderScan(s) {
  const a = s.analysis, v = s.overall || (a && a.result);
  if (v) { $("verdictCard").className = "card verdict " + v; $("vLabel").textContent = RESULT_TEXT[v]; }
  if (s.report) $("vHead").textContent = s.report.headline || "";
  if (a) {
    $("vReasons").innerHTML = a.reasons.map((r) => `<li>${esc(r)}</li>`).join("");
    const n = a.numbers, q = a.quantity, k = [];
    if (q && q.percent_of_label !== null && a.result !== "UNABLE_TO_VERIFY") k.push(kpi("of labelled dose", q.percent_of_label + " %"));
    k.push(kpi("time to 80 %", n.t80_s ? Math.round(n.t80_s) + " s" : "–"));
    k.push(kpi("final colour (A)", n.A_specific_end ?? "–"));
    k.push(kpi("run after tablet in", Math.round(n.run_s_after_drop) + " s"));
    $("kpis").innerHTML = k.join("") + (s.profile_name ? `<p class="small muted" style="grid-column:1/-1;margin:2px 0 0">Compared with profile: ${esc(s.profile_name)}</p>` : "");
    setCurve(resultChart, a.curve);
    $("gates").innerHTML = a.gates.map((g) => `<li>${g.ok ? "✅" : g.blocking ? "⛔" : "⚠️"} ${esc(g.message)}</li>`).join("");
  }
  $("stageChips").innerHTML = Object.entries(s.stages || {}).map(([k, x]) =>
    `<span class="chip ${x.status}" title="${esc(x.why || (x.ms ? x.ms + " ms" : ""))}">${k}${x.status === "skipped" ? " (skipped)" : ""}</span>`).join("");
  const r = s.report;
  if (r) {
    $("reportBox").innerHTML = `<p>${esc(r.plain_summary)}</p><p class="what">${esc(r.what_to_do)}</p>` +
      (r.evidence || []).map((e) => `<p class="small">• ${esc(e.claim)} ${e.source_ids.map((i) => `[${esc(i)}]`).join("")}</p>`).join("") +
      `<p class="small muted">${s.report_stage === "final" ? "Final report" : "First report — still researching…"} · written by ${esc(r.generated_by)}</p>`;
    $("sources").innerHTML = (r.sources || []).map((x) => `<li><b>${esc(x.id)}</b> ${esc(x.kind)} — <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("") || "<li class='muted'>No sources yet.</li>";
    $("guardNote").textContent = (r.guardrail_fixes || []).length ? "Guardrail corrections: " + r.guardrail_fixes.join(" ") : "";
  }
  if (s.recall_status === "LOT_RECALLED") { $("recallBanner").textContent = "⚠ This lot matches an FDA recall record."; $("recallBanner").classList.remove("hidden"); }
  $("fields").textContent = JSON.stringify({ label: s.label, tablet: s.imprint, recall_status: s.recall_status }, null, 2);
  const mock = (s.label && s.label.mock) || (s.imprint && s.imprint.mock);
  $("mockNote").classList.toggle("hidden", !mock);
  if (s.error) $("vHead").textContent = "Error: " + s.error;
}
$("btnNew").onclick = () => {
  ["bottleFile", "imprintFile"].forEach((i) => ($(i).value = "")); $("bottlePrev").src = ""; $("imprintPrev").src = "";
  loadRunSelect(); setPhase("idle"); go(1);
};

// ---------------------------------------------------------------- ask (text + optional voice)
function addMsg(who, text) { const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; $("chat").appendChild(d); $("chat").scrollTop = 1e9; }
async function ask() {
  const q = $("askInput").value.trim(); if (!q || !state.scanId) return;
  $("askInput").value = ""; addMsg("me", q);
  try {
    const r = await post(`/api/scans/${state.scanId}/ask`, { question: q, history: state.chat });
    state.chat.push({ role: "user", content: q }, { role: "assistant", content: r.answer });
    addMsg("bot", r.answer);
    if ($("speakToggle").checked && "speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(r.answer));
  } catch (e) { addMsg("bot", "Sorry — " + e.message); }
}
$("askBtn").onclick = ask;
$("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR || !window.isSecureContext) {
  $("micBtn").classList.add("hidden");
  $("voiceNote").textContent += (SR ? " Voice input needs https or localhost - type your question here." : " Voice input isn't supported in this browser - type your question.");
} else {
  $("micBtn").onclick = () => {
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
    rec.onresult = (e) => { $("askInput").value = e.results[0][0].transcript; ask(); };
    rec.start();
  };
}

// ---------------------------------------------------------------- issue report
$("btnDraft").onclick = async () => {
  const r = await post(`/api/scans/${state.scanId}/issue/draft`, { where: $("issSeller").value + ($("issCity").value ? ", " + $("issCity").value : ""), when: $("issWhen").value, notes: $("issNotes").value });
  $("issText").value = r.draft; $("issText").classList.remove("hidden"); $("btnSubmitIssue").classList.remove("hidden");
  $("issMsg").textContent = "Check and edit the text. Nothing is sent until you tap Submit.";
};
$("btnSubmitIssue").onclick = async () => {
  const r = await post("/api/issues", { scan_id: state.scanId, text: $("issText").value, seller: $("issSeller").value, city: $("issCity").value, when: $("issWhen").value });
  $("issMsg").textContent = "Saved (" + r.issue_id + "). " + r.note; $("btnSubmitIssue").classList.add("hidden");
};

// ---------------------------------------------------------------- history
async function loadHistory() {
  const [sc, rs] = await Promise.all([api("/api/scans"), api("/api/runs")]);
  $("scanList").innerHTML = sc.map((s) => `<li data-id="${esc(s.id)}"><span>${esc(s.drug || "unknown")} ${s.lot ? "· lot " + esc(s.lot) : ""}<br><small class="muted">${new Date(s.created * 1000).toLocaleString()}</small></span><span class="tag ${esc(s.overall || "")}">${esc(RESULT_TEXT[s.overall] || "…")}</span></li>`).join("") || "<li class='muted'>No checks yet.</li>";
  $("scanList").querySelectorAll("li[data-id]").forEach((li) => (li.onclick = () => openScan(li.dataset.id)));
  $("runList").innerHTML = rs.map((r) => `<li><span>${esc(r.label)} <small class="muted">${esc(r.id)} · ${r.samples} samples · ${esc(r.source)}</small></span><span class="tag ${esc(r.result)}">${esc(RESULT_TEXT[r.result])}</span></li>`).join("") || "<li class='muted'>No runs yet.</li>";
}

// ---------------------------------------------------------------- profiles
async function loadProfilesView() {
  const [ps, rs] = await Promise.all([api("/api/profiles"), api("/api/runs")]);
  $("profList").innerHTML = ps.map((p) => `<li><span><b>${esc(p.name)}</b><br><small class="muted">${esc(p.id)} · ${p.demo ? "<b>DEMO, simulated</b> · " : ""}${p.reference ? "reference ✓ (" + esc(p.mode) + " mode, " + esc(p.signal) + ")" : "no reference"}${p.match_names && p.match_names.length ? " · matches: " + esc(p.match_names.join(", ")) : ""} · ${p.calibration ? "calibration ✓" : "no calibration"}</small></span></li>`).join("");
  $("refRuns").innerHTML = rs.map((r) => `<li><label class="check"><input type="checkbox" value="${esc(r.id)}"> ${esc(r.label)} <small class="muted">${esc(r.mode)} · ${esc(r.id)} · ${r.samples} samples</small></label></li>`).join("") || "<li class='muted'>Record some runs first.</li>";
  state.runsForCal = rs; if (!$("calRows").children.length) { addCalRow(0); addCalRow(); addCalRow(); }
}
function addCalRow(conc) {
  const d = document.createElement("div"); d.className = "row wrap";
  d.innerHTML = `<select class="calRun">${(state.runsForCal || []).map((r) => `<option value="${esc(r.id)}">${esc(r.label)} · ${esc(r.id)}</option>`).join("")}</select>
                 <input class="calConc" type="number" step="any" placeholder="mg/L" style="max-width:120px" value="${conc ?? ""}">`;
  $("calRows").appendChild(d);
}
$("btnCalRow").onclick = () => addCalRow();
$("btnRef").onclick = async () => {
  const ids = [...$("refRuns").querySelectorAll("input:checked")].map((i) => i.value);
  try {
    const r = await post("/api/profiles/reference", { profile_id: $("refId").value || "my_reference", name: $("refName").value || "My reference",
      match_names: $("refMatch").value.split(",").map((s) => s.trim()).filter(Boolean), run_ids: ids, signal: $("refSignal").value });
    $("refOut").textContent = JSON.stringify(r.reference, null, 2); loadProfileSelect(); loadProfilesView();
  } catch (e) { $("refOut").textContent = "Error: " + e.message; }
};
$("btnCal").onclick = async () => {
  const standards = [...$("calRows").children].map((d) => ({ run_id: d.querySelector(".calRun").value, conc_mg_per_l: parseFloat(d.querySelector(".calConc").value) })).filter((s) => s.run_id && !isNaN(s.conc_mg_per_l));
  try {
    const r = await post("/api/profiles/calibration", { profile_id: $("calId").value || "my_calibration", name: $("calName").value || "My calibration",
      match_names: $("calMatch").value.split(",").map((s) => s.trim()).filter(Boolean), label_mg: parseFloat($("calMg").value), volume_ml: parseFloat($("calVol").value) || 145, standards });
    $("calOut").textContent = JSON.stringify(r.calibration, null, 2); loadProfileSelect(); loadProfilesView();
  } catch (e) { $("calOut").textContent = "Error: " + e.message; }
};

// ---------------------------------------------------------------- atlas (3D graph, library loaded on first open)
const KIND_COLORS = { medicine: "#3fb79c", lot: "#f3b25b", manufacturer: "#7aa2ff", recall: "#ff6b6b", seller: "#c792ea" };
let atlasGraph = null;
function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
async function loadAtlas() {
  $("legend").innerHTML = Object.entries(KIND_COLORS).map(([k, c]) => `<span style="--c:${c}">${k}</span>`).join("");
  const data = await api("/api/atlas");
  if (!window.ForceGraph3D) { try { await loadScript("/static/vendor/3d-force-graph-1.80.0.min.js"); } catch { $("atlasBox").textContent = "Could not load the 3D library."; return; } }
  if (!data.nodes.length) { $("atlasBox").innerHTML = "<p style='color:#aaa;padding:16px'>No checks yet.</p>"; atlasGraph = null; return; }
  const box = $("atlasBox"); box.innerHTML = "";
  atlasGraph = ForceGraph3D()(box).width(box.clientWidth).height(box.clientHeight)
    .graphData(data).nodeLabel((n) => n.label).nodeColor((n) => (n.kind === "recall" && n.lot_match ? "#ff2d2d" : KIND_COLORS[n.kind] || "#ccc"))
    .nodeVal((n) => (n.kind === "seller" ? 2 + (n.reports || 1) * 2 : n.kind === "medicine" ? 6 : 3))
    .linkOpacity(0.5).backgroundColor("#0d1014")
    .cooldownTicks(120).onEngineStop(() => atlasGraph && atlasGraph.zoomToFit(400, 60));
}
window.addEventListener("resize", () => { if (atlasGraph) atlasGraph.width($("atlasBox").clientWidth); });

setPhase("idle");
boot();
