"""
server.py - the app's backend.  Start it on the laptop (or Pi) that the Arduino is plugged into:

    pip install -r requirements.txt
    python server.py                          # auto-finds the Arduino serial port
    SERIAL_PORT=COM5 python server.py         # or choose the port   (Windows PowerShell: $env:SERIAL_PORT="COM5")
    REPLAY_FILE=../runs/SIM_good.csv python server.py     # no board: replay a recorded/simulated run

Then open http://localhost:8000 (on a phone on the same Wi-Fi: http://<laptop-IP>:8000).
Put ANTHROPIC_API_KEY in your environment for the AI parts; without it the app runs in mock mode.
"""
from __future__ import annotations
import concurrent.futures as cf
import glob, json, os, re, time, traceback

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import analysis as A
import evidence as E
import guide as G
from device import Device
from store import Store

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS_DIR = os.path.abspath(os.getenv("RUNS_DIR", os.path.join(HERE, "..", "runs")))
UPLOADS = os.path.join(HERE, "data", "uploads")
PROFILES = os.path.join(HERE, "data", "profiles")
APP_NAME = os.getenv("APP_NAME", "Pill Gate")
for d in (RUNS_DIR, UPLOADS, PROFILES):
    os.makedirs(d, exist_ok=True)

db = Store(os.path.join(HERE, "data", "app.db"))
device = Device(port=os.getenv("SERIAL_PORT") or None, replay=os.getenv("REPLAY_FILE") or None,
                replay_speed=float(os.getenv("REPLAY_SPEED", "1")))
pool = cf.ThreadPoolExecutor(max_workers=4)
stage_pool = cf.ThreadPoolExecutor(max_workers=8)

app = FastAPI(title=APP_NAME)


# ============================================================================ profiles
def load_profiles():
    out = {}
    for p in sorted(glob.glob(os.path.join(PROFILES, "*.json"))):
        try:
            d = json.load(open(p))
            out[os.path.splitext(os.path.basename(p))[0]] = d
        except Exception:
            pass
    return out


def marker_opts(markers):
    """Turn the app's button presses into analysis options: water check passed, Continue pressed."""
    m = markers or {}
    o = {}
    if m.get("tablet_in") is not None:
        o["drop_index"] = m["tablet_in"]
    if m.get("water_ok") is not None:
        o["water_ok_index"] = m["water_ok"]
    return o


def window_for(mode):
    return G.QUICK_S if mode == "quick" else None


def match_profile(label, mode="quick"):
    name = " ".join(str((label or {}).get(k) or "") for k in ("drug_name", "strength")).lower()
    best = None
    for pid, p in load_profiles().items():
        if not (p.get("calibration") or p.get("reference")):
            continue
        if p.get("reference") and (p["reference"].get("window_s") is not None) != (mode == "quick"):
            continue                                   # reference recorded in the other mode
        if is_demo(pid, p):
            continue                                   # simulated demo profiles are used only when picked by hand
        if any(m in name for m in p.get("match_names", [])):
            best = best or pid
    return best


def is_demo(pid, p):
    return pid.startswith("demo") or "SIMULATED" in str(p.get("name", "")).upper() or bool(p.get("simulated"))


# ============================================================================ device + runs
@app.get("/api/config")
def config():
    return {"app_name": APP_NAME, "ai": E.ai_enabled(), "model": E.MODEL,
            "timing": {"blank_s": G.BLANK_STABLE_S, "min_s": G.MIN_DISSOLVE_S, "max_s": G.MAX_DISSOLVE_S, "quick_s": G.QUICK_S}}


@app.get("/api/device")
def device_status():
    return device.status()


_ref_saved_for = None


@app.get("/api/live")
def live():
    st = device.status()
    out = {"status": st}
    csv = device.recording_csv()
    if csv:
        try:
            run = A.parse_csv(csv)
            mk = device.markers.get("tablet_in")
            rep = A.analyze(run, None, marker_opts(device.markers) or None)
            c = rep["curve"]
            out["live"] = {"seconds": round(run.t[-1], 1), "samples": len(run), "tablet_in_at_s": rep["numbers"]["tablet_in_at_s"],
                           "curve": c, "colours": rep["numbers"]["colours"],
                           "raw_last": A.jsonable({k: v[-1] for k, v in run.cols.items() if k != "ms"})}
            if mk is not None:
                out["guide"] = A.jsonable({"phase": "dissolving", **G.dissolve_progress(rep, device.run_mode)})
            else:
                wc = G.water_check(run)
                global _ref_saved_for
                if wc["ok"] and _ref_saved_for != device.rec_start:     # remember this clean water for next time
                    G.save_ref(wc["nets"]); _ref_saved_for = device.rec_start
                out["guide"] = A.jsonable({"phase": "water", **wc})
        except Exception as e:
            out["live"] = {"waiting": str(e)}
    elif device.lines:
        last = device.lines[-1].split(",")
        hdr = (device.header or "").split(",")
        out["raw_last"] = dict(zip(hdr, last))
    return out


class StartIn(BaseModel):
    mode: str = "quick"


@app.post("/api/run/start")
def run_start(s: StartIn | None = None):
    device.start((s.mode if s else None) or "quick")
    return {"ok": True}


class MarkIn(BaseModel):
    name: str = "tablet_in"


@app.post("/api/run/mark")
def run_mark(m: MarkIn):
    device.mark(m.name)
    return {"ok": True, "markers": device.markers}


class StopIn(BaseModel):
    label: str = "run"
    profile_id: str | None = None


def save_run(csv_text, label, markers=None, profile_id=None, source="device", mode="full"):
    run = A.parse_csv(csv_text)
    rid = db.new_id("run")
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", label or "run")[:40]
    path = os.path.join(RUNS_DIR, f"{safe}_{rid}.csv")
    open(path, "w").write(csv_text)
    prof = load_profiles().get(profile_id) if profile_id else None
    opts = marker_opts(markers)
    if window_for(mode):
        opts["window_s"] = window_for(mode)
    rep = A.analyze(run, prof, opts)
    doc = {"label": label, "path": path, "source": source, "markers": markers or {}, "profile_id": profile_id, "mode": mode,
           "analysis": rep, "created": time.time(), "samples": len(run)}
    db.put("run", rid, doc)
    return rid, doc


@app.post("/api/run/stop")
def run_stop(s: StopIn):
    csv, markers = device.stop()
    if not csv:
        raise HTTPException(400, "not recording or no data yet")
    try:
        rid, doc = save_run(csv, s.label, markers, s.profile_id, mode=device.run_mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"run_id": rid, "analysis": doc["analysis"]}


@app.post("/api/run/upload")
async def run_upload(label: str = Form("pasted"), csv_text: str = Form(""), file: UploadFile | None = File(None),
                     profile_id: str = Form(""), mode: str = Form("full")):
    text = csv_text
    if file is not None:
        text = (await file.read()).decode(errors="replace")
    try:
        rid, doc = save_run(text, label, None, profile_id or None, source="upload", mode=mode if mode in ("quick", "full") else "full")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"run_id": rid, "analysis": doc["analysis"]}


@app.get("/api/runs")
def runs():
    return [{"id": r["id"], "label": r.get("label"), "result": r["analysis"]["result"], "samples": r.get("samples"),
             "source": r.get("source"), "mode": r.get("mode", "full")} for r in db.all("run")]


@app.get("/api/runs/{rid}")
def run_get(rid: str):
    d = db.get("run", rid)
    if not d:
        raise HTTPException(404)
    return d


# ============================================================================ profiles API
@app.get("/api/profiles")
def profiles():
    return [{"id": k, "name": v.get("name", k), "calibration": bool(v.get("calibration")),
             "reference": bool(v.get("reference")), "label_mg": v.get("label_mg"), "notes": v.get("notes"),
             "signal": v.get("signal", "colour"), "demo": is_demo(k, v), "match_names": v.get("match_names", []),
             "mode": ("quick" if (v.get("reference") or {}).get("window_s") else "full") if v.get("reference") else "any"}
            for k, v in load_profiles().items()]


class RefIn(BaseModel):
    profile_id: str
    name: str
    match_names: list[str] = []
    run_ids: list[str]
    analyte_color: str = "B"
    reference_color: str = "R"
    expect_color: bool | None = True
    signal: str = "colour"          # "colour" (yellow, e.g. riboflavin), "scatter" (white tablet, side sensor) or "cloud"


@app.post("/api/profiles/reference")
def make_reference(p: RefIn):
    docs = [db.get("run", r) for r in p.run_ids]
    modes = {d.get("mode", "full") for d in docs}
    if len(modes) != 1:
        raise HTTPException(400, "Pick runs recorded in the same mode (all quick or all full).")
    mode = modes.pop()
    runs_ = [A.parse_csv(open(d["path"]).read()) for d in docs]
    sig = p.signal if p.signal in ("colour", "cloud", "scatter") else "colour"
    base = {"name": p.name, "match_names": [m.lower() for m in p.match_names], "analyte_color": p.analyte_color,
            "reference_color": p.reference_color, "expect_color": p.expect_color if sig == "colour" else None, "signal": sig}
    try:
        base["reference"] = A.build_reference(runs_, base, {"window_s": window_for(mode)} if window_for(mode) else None,
                                              per_run_opts=[marker_opts(d.get("markers")) for d in docs])
    except ValueError as e:
        raise HTTPException(400, str(e))
    base["built_from_runs"] = p.run_ids
    json.dump(base, open(os.path.join(PROFILES, re.sub(r"[^A-Za-z0-9_-]", "_", p.profile_id) + ".json"), "w"), indent=2)
    return base


class CalIn(BaseModel):
    profile_id: str
    name: str
    match_names: list[str] = []
    label_mg: float
    volume_ml: float = 145
    standards: list[dict]            # [{"run_id": ..., "conc_mg_per_l": ...}], include a 0 mg/L water run
    analyte_color: str = "B"
    reference_color: str = "R"
    t80_max_s: float | None = None


@app.post("/api/profiles/calibration")
def make_calibration(p: CalIn):
    stds = [(float(s["conc_mg_per_l"]), A.parse_csv(open(db.get("run", s["run_id"])["path"]).read())) for s in p.standards]
    path = os.path.join(PROFILES, re.sub(r"[^A-Za-z0-9_-]", "_", p.profile_id) + ".json")
    base = json.load(open(path)) if os.path.exists(path) else {}
    base.update({"name": p.name, "match_names": [m.lower() for m in p.match_names], "label_mg": p.label_mg,
                 "volume_ml": p.volume_ml, "analyte_color": p.analyte_color, "reference_color": p.reference_color,
                 "expect_color": True, "t80_max_s": p.t80_max_s})
    base["calibration"] = A.build_calibration(stds, profile=base)
    json.dump(base, open(path, "w"), indent=2)
    return base


# ============================================================================ scans (the evidence pipeline)
STAGES = ["load", "vision", "normalize", "lookups", "web", "report", "guardrail"]
TIMEOUTS = {"vision": 60, "normalize": 15, "lookups": 25, "web": 90, "report": 60}


def _stage(sid, name, fn, timeout=30):
    scan = db.get("scan", sid)
    st = scan["stages"]
    st[name] = {"status": "running", "t": time.time()}
    db.update("scan", sid, stages=st)
    t0 = time.time()
    try:
        res = stage_pool.submit(fn).result(timeout=timeout)
        if isinstance(res, dict) and res.get("skipped"):
            st[name] = {"status": "skipped", "why": res["skipped"]}
        else:
            st[name] = {"status": "done", "ms": int((time.time() - t0) * 1000)}
        return res
    except cf.TimeoutError:
        st[name] = {"status": "skipped", "why": f"timeout after {timeout}s"}
    except Exception as e:
        st[name] = {"status": "skipped", "why": f"{type(e).__name__}: {str(e)[:200]}"}
    finally:
        db.update("scan", sid, stages=st)
    return None


def run_scan(sid):
    scan = db.get("scan", sid)
    try:
        run_doc = db.get("run", scan["run_id"])
        run = _stage(sid, "load", lambda: A.parse_csv(open(run_doc["path"]).read()))
        if run is None:
            raise RuntimeError("run could not be loaded")

        def vision():
            out = {}
            if scan.get("bottle_path"):
                out["label"] = E.read_bottle(scan["bottle_path"])
            if scan.get("imprint_path"):
                out["imprint"] = E.read_imprint(scan["imprint_path"])
            return out
        v = _stage(sid, "vision", vision, TIMEOUTS["vision"]) or {}
        label, imprint = v.get("label") or {}, v.get("imprint")
        db.update("scan", sid, label=label, imprint=imprint)

        def normalize():
            rx = None
            try:
                rx = E.rxnav_match(label.get("drug_name"), label.get("strength"))
            except Exception as e:
                rx = {"error": str(e)[:150]}
            pid = scan.get("profile_id") or match_profile(label, run_doc.get("mode", "full"))
            return {"rxnav": rx, "profile_id": pid, "ndc_clean": E.clean_ndc(label.get("ndc")), "lot_clean": E.clean_lot(label.get("lot"))}
        nm = _stage(sid, "normalize", normalize, TIMEOUTS["normalize"]) or {}
        pid = nm.get("profile_id") or scan.get("profile_id")
        prof = load_profiles().get(pid) if pid else None
        opts = marker_opts(run_doc.get("markers"))
        if window_for(run_doc.get("mode", "full")):
            opts["window_s"] = window_for(run_doc.get("mode", "full"))
        analysis = A.analyze(run, prof, opts)
        if not prof:                                   # say WHY there is no profile, in plain words
            why = ("No bottle photo, so no profile could be matched - add the photo or pick a profile by hand."
                   if not label else
                   "The bottle label wasn't read (mock mode, no API key), so no profile could be matched - pick one by hand."
                   if label.get("mock") else
                   f"No profile matches '{label.get('drug_name') or 'this label'}' - record 3 reference runs of a known-good "
                   "tablet and build a profile whose label words match it.")
            analysis["reasons"] = [why]
        if prof and is_demo(pid, prof):
            analysis["reasons"].append("Compared with a SIMULATED demo profile - not a real reference.")
        evidence = {"rxnav": nm.get("rxnav") if isinstance(nm.get("rxnav"), dict) and nm["rxnav"].get("rxcui") else None}
        db.update("scan", sid, profile_id=pid, profile_name=(prof or {}).get("name"), analysis=analysis, evidence=evidence)

        def lookups():
            out = {}
            try:
                out["ndc"], out["ndc_query"] = E.ndc_lookup(label)
            except Exception as e:
                out["ndc_error"] = str(e)[:150]
            out["recalls"], out["recall_query"] = E.recall_lookup(label, evidence.get("rxnav"))
            return out
        lk = _stage(sid, "lookups", lookups, TIMEOUTS["lookups"])
        if lk:
            evidence.update(lk)
        rs = E.recall_status(lk.get("recalls") if lk else None)
        overall = E.overall_result(analysis, rs, profile_ok=prof is not None)
        db.update("scan", sid, evidence=evidence, recall_status=rs, overall=overall)

        # first usable report (deterministic template) - available within a second or two
        s = db.get("scan", sid)
        sources = E.build_sources(s)
        db.update("scan", sid, report=E.guardrail(E.template_report(s, sources), s, sources), report_stage="deterministic")

        web = _stage(sid, "web", lambda: E.web_research(label, evidence.get("rxnav"), evidence.get("recalls")), TIMEOUTS["web"])
        if web:
            evidence["web"] = web
            db.update("scan", sid, evidence=evidence)
        s = db.get("scan", sid)
        sources = E.build_sources(s)
        rep = _stage(sid, "report", lambda: E.claude_report(s, sources) if E.ai_enabled() else E.template_report(s, sources),
                     TIMEOUTS["report"])
        final = _stage(sid, "guardrail", lambda: E.guardrail(rep or E.template_report(s, sources), s, sources), 10)
        if final:
            db.update("scan", sid, report=final, report_stage="final")
        db.update("scan", sid, done=True, finished=time.time())
    except Exception as e:
        traceback.print_exc()
        db.update("scan", sid, done=True, error=f"{type(e).__name__}: {e}")


@app.post("/api/scans", status_code=202)
async def scan_create(run_id: str = Form(...), profile_id: str = Form(""),
                      bottle: UploadFile | None = File(None), imprint: UploadFile | None = File(None)):
    if not db.get("run", run_id):
        raise HTTPException(404, "unknown run_id")
    sid = db.new_id("scan")
    doc = {"run_id": run_id, "profile_id": profile_id or None, "created": time.time(), "done": False,
           "stages": {k: {"status": "pending"} for k in STAGES}}
    for name, f in (("bottle", bottle), ("imprint", imprint)):
        if f is not None and f.filename:
            ext = os.path.splitext(f.filename)[1].lower() or ".jpg"
            p = os.path.join(UPLOADS, f"{sid}_{name}{ext}")
            open(p, "wb").write(await f.read())
            doc[f"{name}_path"] = p
    db.put("scan", sid, doc)
    pool.submit(run_scan, sid)
    return {"scan_id": sid}


def _public(scan):
    s = {k: v for k, v in scan.items() if not k.endswith("_path")}
    return s


@app.get("/api/scans")
def scans():
    return [{"id": s["id"], "overall": s.get("overall"), "drug": (s.get("label") or {}).get("drug_name"),
             "lot": (s.get("label") or {}).get("lot"), "created": s.get("created"), "done": s.get("done")} for s in db.all("scan")]


@app.get("/api/scans/{sid}")
def scan_get(sid: str):
    s = db.get("scan", sid)
    if not s:
        raise HTTPException(404)
    return _public(s)


class AskIn(BaseModel):
    question: str
    history: list[dict] = []


@app.post("/api/scans/{sid}/ask")
def scan_ask(sid: str, q: AskIn):
    s = db.get("scan", sid)
    if not s:
        raise HTTPException(404)
    try:
        return {"answer": E.ask(s, q.question, q.history)}
    except Exception as e:
        raise HTTPException(502, f"assistant unavailable: {e}")


class IssueDraftIn(BaseModel):
    where: str = ""
    when: str = ""
    notes: str = ""


@app.post("/api/scans/{sid}/issue/draft")
def issue_draft(sid: str, d: IssueDraftIn):
    s = db.get("scan", sid)
    if not s:
        raise HTTPException(404)
    try:
        return {"draft": E.draft_issue(s, d.where, d.when, d.notes)}
    except Exception as e:
        return {"draft": f"Suspected problem with this medicine. Bought at {d.where}, {d.when}. {d.notes}", "warning": str(e)}


class IssueIn(BaseModel):
    scan_id: str
    text: str
    seller: str = ""
    city: str = ""
    when: str = ""


@app.post("/api/issues")
def issue_submit(i: IssueIn):
    """Only called when the person taps Submit. No reporter identity is stored."""
    s = db.get("scan", i.scan_id)
    if not s:
        raise HTTPException(404)
    iid = db.new_id("issue")
    db.put("issue", iid, {"scan_id": i.scan_id, "text": i.text, "seller": i.seller.strip(), "city": i.city.strip(),
                          "when": i.when, "created": time.time()})
    return {"issue_id": iid, "note": "Saved in this app. Sending to a regulator is a separate, manual step."}


# ============================================================================ atlas
@app.get("/api/atlas")
def atlas():
    nodes, links = {}, []

    def node(nid, kind, label, **extra):
        if nid not in nodes:
            nodes[nid] = {"id": nid, "kind": kind, "label": label, **extra}
        return nid

    for s in db.all("scan"):
        lab = s.get("label") or {}
        drug = (lab.get("drug_name") or "unknown drug").strip()
        d = node("drug:" + drug.lower(), "medicine", drug)
        if lab.get("manufacturer"):
            m = node("mfr:" + lab["manufacturer"].lower(), "manufacturer", lab["manufacturer"])
            links.append({"source": m, "target": d})
        lot_id = None
        if lab.get("lot"):
            lot_id = node("lot:" + (E.clean_lot(lab["lot"]) or ""), "lot", "Lot " + lab["lot"], result=s.get("overall"))
            links.append({"source": d, "target": lot_id})
        for r in ((s.get("evidence") or {}).get("recalls") or [])[:5]:
            rid = node("recall:" + str(r.get("recall_number")), "recall", f"Recall {r.get('recall_number')}", lot_match=r.get("lot_match"))
            links.append({"source": lot_id or d, "target": rid})
    counts = {}
    for i in db.all("issue"):
        if i.get("seller"):
            counts.setdefault(i["seller"].lower(), {"name": i["seller"], "n": 0, "scans": set()})
            counts[i["seller"].lower()]["n"] += 1
            counts[i["seller"].lower()]["scans"].add(i["scan_id"])
    for key, c in counts.items():
        sid_ = node("seller:" + key, "seller", f"{c['name']} ({c['n']} report{'s' if c['n'] != 1 else ''})", reports=c["n"])
        for sc in c["scans"]:
            s = db.get("scan", sc) or {}
            lot = (s.get("label") or {}).get("lot")
            tgt = "lot:" + (E.clean_lot(lot) or "") if lot else "drug:" + ((s.get("label") or {}).get("drug_name") or "unknown drug").lower()
            if tgt in nodes:
                links.append({"source": sid_, "target": tgt})
    return {"nodes": list(nodes.values()), "links": links}


# ============================================================================ static app
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")))
