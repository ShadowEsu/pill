"""
evidence.py - the "evidence engine": what the world already knows about this exact bottle.

Stages (each one has its own timeout; if a stage fails, it is skipped and the report is built from what exists):
  1. vision      Claude reads the bottle photo and the tablet photo -> structured fields (personal details dropped)
  2. normalize   RxNav (US National Library of Medicine) -> standard drug name + RxCUI; NDC / lot clean-up
  3. lookups     openFDA NDC directory + openFDA drug recall (enforcement) reports; exact lot match if possible
  4. web         Claude with the web-search tool, limited to regulator websites -> cited alerts
  5. report      Claude writes the plain-language report, using ONLY numbered sources
  6. guardrail   deterministic code checks the report against the stored evidence and fixes it

Without ANTHROPIC_API_KEY (or with MOCK_AI=1) stages 1, 4 and 5 use a mock / template so the app still runs.
"""
from __future__ import annotations
import base64, json, os, re, time, urllib.parse

import httpx

MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "8"))
OPENFDA_KEY = os.getenv("OPENFDA_API_KEY", "")
REGULATOR_DOMAINS = ["fda.gov", "who.int", "canada.ca", "gov.uk", "nafdac.gov.ng", "ema.europa.eu", "tga.gov.au"]
HERE = os.path.dirname(os.path.abspath(__file__))


def ai_enabled():
    return bool(os.getenv("ANTHROPIC_API_KEY")) and os.getenv("MOCK_AI", "0") != "1"


def _client():
    import anthropic
    return anthropic.Anthropic(timeout=90)


# ============================================================================ 1. vision
LABEL_FIELDS = {
    "drug_name": "active ingredient or product name as printed",
    "strength": "e.g. '100 mg'",
    "dosage_form": "tablet, capsule, ...",
    "ndc": "National Drug Code if printed, digits and hyphens only",
    "lot": "lot / batch number",
    "expiry": "expiry date as printed",
    "manufacturer": "manufacturer or distributor company",
    "quantity": "count in the container",
}
IMPRINT_FIELDS = {
    "imprint": "characters stamped or printed on the tablet, both sides separated by ' / '",
    "color": "main colour",
    "shape": "round, oval, capsule-shaped, ...",
    "score_line": "yes / no",
}
PII_RULE = ("Never return personal details: patient name, address, phone, date of birth, pharmacy name, "
            "prescriber, prescription (Rx) number, or barcodes that encode them. If a field is not visible, use null.")


def _image_block(path):
    ext = os.path.splitext(path)[1].lower()
    mt = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")
    data = base64.standard_b64encode(open(path, "rb").read()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": mt, "data": data}}


def _tool_call(content, tool_name, fields, system, max_tokens=800):
    """Forces Claude to answer through a tool whose input schema is our field list -> clean JSON."""
    schema = {"type": "object",
              "properties": {k: {"type": ["string", "null"], "description": d} for k, d in fields.items()},
              "required": list(fields)}
    schema["properties"]["confidence"] = {"type": "number", "description": "0-1, how sure you are overall"}
    msg = _client().messages.create(
        model=MODEL, max_tokens=max_tokens, system=system,
        tools=[{"name": tool_name, "description": "Record what is visible in the photo.", "input_schema": schema}],
        tool_choice={"type": "tool", "name": tool_name},
        messages=[{"role": "user", "content": content}])
    for b in msg.content:
        if getattr(b, "type", "") == "tool_use":
            return dict(b.input)
    return {}


_PII_PATTERNS = [re.compile(r"\b(?:rx|r x)\s*#?\s*\d+", re.I), re.compile(r"\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}")]


def scrub(fields: dict, allowed: dict) -> dict:
    out = {}
    for k in list(allowed) + ["confidence"]:
        v = fields.get(k)
        if isinstance(v, str):
            for p in _PII_PATTERNS:
                v = p.sub("[removed]", v)
            v = v.strip() or None
        out[k] = v
    return out


def read_bottle(path):
    if not ai_enabled():
        d = json.load(open(os.getenv("MOCK_LABEL") or os.path.join(HERE, "data", "mock_label.json")))
        return scrub(d, LABEL_FIELDS) | {"mock": True, "note": d.get("note")}
    f = _tool_call([_image_block(path), {"type": "text", "text": "Read this medicine container label."}],
                   "record_label", LABEL_FIELDS, "You read medicine labels for a screening tool. " + PII_RULE)
    return scrub(f, LABEL_FIELDS)


def read_imprint(path):
    if not ai_enabled():
        d = json.load(open(os.path.join(HERE, "data", "mock_imprint.json")))
        return scrub(d, IMPRINT_FIELDS) | {"mock": True, "note": d.get("note")}
    f = _tool_call([_image_block(path), {"type": "text", "text": "Describe this tablet's imprint, colour and shape."}],
                   "record_tablet", IMPRINT_FIELDS, "You describe tablets for a screening tool. Do not guess the drug. " + PII_RULE)
    return scrub(f, IMPRINT_FIELDS)


# ============================================================================ 2. normalize
def clean_ndc(ndc):
    if not ndc:
        return None
    s = re.sub(r"[^0-9-]", "", str(ndc))
    return s or None


def clean_lot(lot):
    return re.sub(r"[^A-Za-z0-9]", "", lot).upper() if lot else None


def rxnav_match(name, strength=None):
    if not name:
        return None
    term = f"{name} {strength or ''}".strip()
    r = httpx.get("https://rxnav.nlm.nih.gov/REST/approximateTerm.json",
                  params={"term": term, "maxEntries": 3}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    cands = (r.json().get("approximateGroup") or {}).get("candidate") or []
    if not cands:
        return None
    c = cands[0]
    rx = c.get("rxcui")
    nm = c.get("name")
    if rx and not nm:
        p = httpx.get(f"https://rxnav.nlm.nih.gov/REST/rxcui/{rx}/properties.json", timeout=HTTP_TIMEOUT)
        if p.status_code == 200:
            nm = ((p.json().get("properties") or {}).get("name"))
    return {"rxcui": rx, "name": nm, "score": c.get("score"),
            "url": f"https://rxnav.nlm.nih.gov/REST/rxcui/{rx}/properties.json" if rx else None}


# ============================================================================ 3. deterministic lookups
def _openfda(endpoint, search, limit=10):
    q = "search=" + urllib.parse.quote(search, safe=':"+()*') + f"&limit={limit}"
    if OPENFDA_KEY:
        q = f"api_key={OPENFDA_KEY}&" + q
    url = f"https://api.fda.gov/drug/{endpoint}.json?{q}"
    r = httpx.get(url, timeout=HTTP_TIMEOUT)
    if r.status_code == 404:                     # openFDA answers 404 when nothing matches
        return [], url
    r.raise_for_status()
    return r.json().get("results", []), url


def _q(s):
    return '"' + str(s).replace('"', "") + '"'


def ndc_lookup(label):
    ndc = clean_ndc(label.get("ndc"))
    if ndc:
        parts = ndc.split("-")
        prod = "-".join(parts[:2]) if len(parts) >= 2 else ndc
        res, url = _openfda("ndc", f"product_ndc:{_q(prod)}+packaging.package_ndc:{_q(ndc)}", 3)
        if res:
            return res, url
    if label.get("drug_name"):
        name = label["drug_name"].split()[0]
        s = f"generic_name:{_q(name)}+brand_name:{_q(name)}"
        res, url = _openfda("ndc", s, 20)
        nl = name.lower()
        res.sort(key=lambda r: (str(r.get("generic_name", "")).lower() != nl, str(r.get("brand_name", "")).lower() != nl))
        return res[:5], url
    return [], None


def recall_lookup(label, rx=None):
    terms = []
    ndc = clean_ndc(label.get("ndc"))
    if ndc:
        prod = "-".join(ndc.split("-")[:2])
        terms.append(f"openfda.product_ndc:{_q(prod)}")
    name = (rx or {}).get("name") or label.get("drug_name")
    if name:
        terms.append(f"openfda.generic_name:{_q(name.split()[0])}")
        terms.append(f"product_description:{_q(name.split()[0])}")
    if not terms:
        return None, None                       # nothing to search with -> "not checked", not "no recall"
    res, url = _openfda("enforcement", "+".join(terms), 20)
    lot = clean_lot(label.get("lot"))
    out = []
    for r in res:
        code = clean_lot(r.get("code_info", "")) or ""
        out.append({
            "recall_number": r.get("recall_number"), "classification": r.get("classification"),
            "status": r.get("status"), "reason": r.get("reason_for_recall"),
            "firm": r.get("recalling_firm"), "date": r.get("report_date"),
            "product": (r.get("product_description") or "")[:300],
            "lot_match": bool(lot and len(lot) >= 3 and lot in code),
            "url": "https://api.fda.gov/drug/enforcement.json?search=recall_number:" + urllib.parse.quote(_q(r.get("recall_number", ""))),
        })
    out.sort(key=lambda x: (not x["lot_match"], x["date"] or ""), reverse=False)
    return out, url


# ============================================================================ 4. live web research
def web_research(label, rx, recalls):
    if not ai_enabled():
        return {"skipped": "no ANTHROPIC_API_KEY (mock mode)", "text": "", "citations": []}
    drug = (rx or {}).get("name") or label.get("drug_name") or "unknown drug"
    prompt = (f"Find current official regulatory alerts, recalls or falsified-medicine warnings about: {drug}; "
              f"manufacturer: {label.get('manufacturer')}; lot: {label.get('lot')}; NDC: {label.get('ndc')}. "
              "Only report what the sources say. Say clearly if nothing specific to this product or lot was found. "
              "Answer in under 150 words.")
    msg = _client().messages.create(
        model=MODEL, max_tokens=1200,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 4, "allowed_domains": REGULATOR_DOMAINS}],
        messages=[{"role": "user", "content": prompt}])
    text, cites, seen = [], [], set()
    blocks = list(msg.content)
    last = max([i for i, b in enumerate(blocks) if getattr(b, "type", "") == "web_search_tool_result"], default=-1)
    for b in blocks[last + 1:]:                       # Claude's answer comes after the last search result
        if getattr(b, "type", "") == "text":
            text.append(b.text)
            for c in (getattr(b, "citations", None) or []):
                u = getattr(c, "url", None)
                if u and u not in seen:
                    seen.add(u)
                    cites.append({"url": u, "title": getattr(c, "title", u), "quote": getattr(c, "cited_text", "")})
    return {"text": "".join(text).strip(), "citations": cites}


# ============================================================================ 5. report + 6. guardrail
VERDICT_ORDER = ["PASSED_SCREEN", "NEEDS_LAB", "UNABLE_TO_VERIFY"]


def recall_status(recalls):
    if recalls is None:
        return "NOT_CHECKED"
    if any(r["lot_match"] for r in recalls):
        return "LOT_RECALLED"
    if recalls:
        return "PRODUCT_HAS_RECALLS_OTHER_LOTS"
    return "NO_RECALL_FOUND"


def build_sources(scan):
    """Every source gets an id (S1, S2...) and a real URL from stored records - the report may only cite these."""
    src = []
    ev = scan.get("evidence", {})
    if ev.get("rxnav") and ev["rxnav"].get("url"):
        src.append({"id": "", "kind": "RxNav", "title": f"RxNorm: {ev['rxnav'].get('name')}", "url": ev["rxnav"]["url"]})
    for r in (ev.get("ndc") or [])[:2]:
        pn = r.get("product_ndc")
        src.append({"id": "", "kind": "openFDA NDC", "title": f"NDC {pn}: {r.get('brand_name') or r.get('generic_name')} ({r.get('labeler_name')})",
                    "url": "https://api.fda.gov/drug/ndc.json?search=product_ndc:" + urllib.parse.quote(_q(pn or ""))})
    for r in (ev.get("recalls") or [])[:6]:
        src.append({"id": "", "kind": "openFDA recall", "title": f"Recall {r['recall_number']} ({r['classification']}, {r['status']})"
                    + (" - LOT MATCH" if r["lot_match"] else ""), "url": r["url"], "lot_match": r["lot_match"]})
    for c in (ev.get("web") or {}).get("citations", [])[:6]:
        src.append({"id": "", "kind": "web", "title": c["title"], "url": c["url"]})
    for i, s in enumerate(src, 1):
        s["id"] = f"S{i}"
    return src


def template_report(scan, sources):
    a = scan["analysis"]
    rs = scan.get("recall_status", "NOT_CHECKED")
    lab = scan.get("label") or {}
    drug = lab.get("drug_name") or "this medicine"
    rec_ids = [s["id"] for s in sources if s["kind"] == "openFDA recall" and s.get("lot_match")]
    rec_txt = {
        "LOT_RECALLED": f"This lot appears in an FDA recall record ({', '.join(rec_ids)}).",
        "PRODUCT_HAS_RECALLS_OTHER_LOTS": "FDA has recall records for this product, but none matched this lot.",
        "NO_RECALL_FOUND": "No FDA recall record was found for this product.",
        "NOT_CHECKED": "Recall databases could not be checked.",
    }[rs]
    todo = {
        "PASSED_SCREEN": "Nothing unusual was found in this screen. Keep the packaging; this is not a lab certificate.",
        "NEEDS_LAB": "Do not rely on this batch until it has been tested by a qualified lab. Ask your pharmacist.",
        "UNABLE_TO_VERIFY": "The device could not get a trustworthy reading. Repeat the test or send a sample to a lab.",
    }[scan["overall"]]
    if rs == "LOT_RECALLED":
        todo = "Stop using this lot and contact your pharmacist or doctor about a replacement. " + todo
    return {
        "headline": f"{drug}: " + {"PASSED_SCREEN": "Passed the screen", "NEEDS_LAB": "Needs lab testing",
                                   "UNABLE_TO_VERIFY": "Unable to verify"}[scan["overall"]],
        "plain_summary": f"{' '.join(a['reasons'])} {rec_txt}".strip(),
        "what_to_do": todo,
        "recall_statement": rec_txt,
        "evidence": [{"claim": rec_txt, "source_ids": rec_ids}],
        "generated_by": "template",
    }


def claude_report(scan, sources):
    pack = {
        "instrument_result": scan["analysis"]["result"], "instrument_reasons": scan["analysis"]["reasons"],
        "numbers": scan["analysis"]["numbers"], "quantity": scan["analysis"]["quantity"],
        "label": scan.get("label"), "tablet": scan.get("imprint"),
        "recall_status": scan.get("recall_status"), "overall_result": scan["overall"],
        "web_findings": (scan.get("evidence", {}).get("web") or {}).get("text", ""),
        "sources": [{k: s[k] for k in ("id", "kind", "title")} for s in sources],
    }
    fields = {
        "headline": "one line, max 12 words, must state the overall_result in plain words",
        "plain_summary": "2-3 short sentences for a non-expert. No jargon. Only facts from the evidence.",
        "what_to_do": "1-2 sentences of practical next steps. Suggest a pharmacist/doctor/lab where relevant.",
        "recall_statement": "one sentence about recalls, consistent with recall_status",
    }
    schema = {"type": "object", "properties": {k: {"type": "string", "description": d} for k, d in fields.items()},
              "required": list(fields)}
    schema["properties"]["evidence"] = {"type": "array", "items": {"type": "object", "properties": {
        "claim": {"type": "string"}, "source_ids": {"type": "array", "items": {"type": "string"}}},
        "required": ["claim", "source_ids"]}}
    system = ("You write the result screen of a medicine SCREENING device. Use ONLY the evidence given. "
              "Never say a medicine is authentic, safe or certified, never name ingredients that were not measured, "
              "and never invent recalls. Cite sources only by their ids (S1, S2...). Keep the overall_result unchanged.")
    msg = _client().messages.create(
        model=MODEL, max_tokens=900, system=system,
        tools=[{"name": "write_report", "description": "Write the report.", "input_schema": schema}],
        tool_choice={"type": "tool", "name": "write_report"},
        messages=[{"role": "user", "content": json.dumps(pack)}])
    for b in msg.content:
        if getattr(b, "type", "") == "tool_use":
            return dict(b.input) | {"generated_by": MODEL}
    raise RuntimeError("no report returned")


def guardrail(report, scan, sources):
    """The stored evidence has the final say. Fixes recall claims in either direction and drops unknown citations."""
    fixes = []
    ids = {s["id"] for s in sources}
    rs = scan.get("recall_status", "NOT_CHECKED")
    tmpl = template_report(scan, sources)
    body = (report.get("plain_summary", "") + " " + report.get("what_to_do", "")).lower()
    claims_lot = re.search(r"(this|the|your) (lot|batch)[^.]{0,40}\b(is|was|has been|been)\s+recalled|recalled (lot|batch)", body)
    negated = re.search(r"\b(no|not|none)\b[^.]{0,30}recall", body)
    if rs != "LOT_RECALLED" and claims_lot and not negated:
        report["plain_summary"], report["what_to_do"] = tmpl["plain_summary"], tmpl["what_to_do"]
        fixes.append("Removed a lot-recall claim that the recall records do not support.")
    if rs == "LOT_RECALLED" and "recall" not in body:
        report["plain_summary"] = tmpl["recall_statement"] + " " + report.get("plain_summary", "")
        report["what_to_do"] = tmpl["what_to_do"]
        fixes.append("Added the lot recall that the model missed.")
    report["recall_statement"] = tmpl["recall_statement"]            # always the deterministic sentence
    words = {"PASSED_SCREEN": "passed", "NEEDS_LAB": "lab", "UNABLE_TO_VERIFY": "unable"}
    if words[scan["overall"]] not in report.get("headline", "").lower():
        report["headline"] = tmpl["headline"]
        fixes.append("Headline rewritten to match the measured result.")
    for bad in ("authentic", "genuine", "certified", "safe to take", "guaranteed"):
        for k in ("headline", "plain_summary", "what_to_do"):
            if bad in report.get(k, "").lower():
                report[k] = tmpl[k]
                fixes.append(f"Replaced text containing '{bad}'.")
    ev = []
    for e in report.get("evidence", []) or []:
        keep = [i for i in e.get("source_ids", []) if i in ids]
        if keep:
            ev.append({"claim": e.get("claim", ""), "source_ids": keep})
        elif e.get("source_ids"):
            fixes.append("Dropped a claim with an unknown citation.")
    report["evidence"] = ev
    report["sources"] = sources                      # citations rebuilt from stored records
    report["guardrail_fixes"] = fixes
    return report


def overall_result(analysis, rs, profile_ok=True):
    v = analysis["result"]
    if rs == "LOT_RECALLED" and v == "PASSED_SCREEN":
        v = "NEEDS_LAB"
    if not profile_ok:
        v = "UNABLE_TO_VERIFY"
    return v


# ============================================================================ Ask + issue report
def ask(scan, question, history=None):
    rep = scan.get("report") or {}
    if not ai_enabled():
        return ("(mock mode) I can only answer from this report: " + rep.get("plain_summary", "no report yet") +
                " " + rep.get("what_to_do", ""))
    system = ("You answer questions about ONE medicine screening report, given below as JSON. Use only that report. "
              "If the report doesn't contain the answer, say so. You are not a doctor: for anything about taking or "
              "stopping a medicine, tell the person to ask their pharmacist or doctor. Be short (max 80 words) and "
              "mention source ids like [S2] when you use them.\n\nREPORT:\n" + json.dumps(
                  {k: scan.get(k) for k in ("overall", "recall_status", "label", "imprint", "report")})[:12000])
    msgs = list(history or [])[-6:] + [{"role": "user", "content": question}]
    msg = _client().messages.create(model=MODEL, max_tokens=300, system=system, messages=msgs)
    return "".join(getattr(b, "text", "") for b in msg.content).strip()


def draft_issue(scan, where, when, notes):
    lab = scan.get("label") or {}
    base = (f"Suspected quality problem with {lab.get('drug_name') or 'a medicine'} {lab.get('strength') or ''}, "
            f"lot {lab.get('lot') or 'unknown'}, manufacturer {lab.get('manufacturer') or 'unknown'}. "
            f"Bought at: {where or 'not given'}, on {when or 'unknown date'}. "
            f"Screening result: {scan.get('overall')}. {notes or ''}").strip()
    if not ai_enabled():
        return base
    msg = _client().messages.create(
        model=MODEL, max_tokens=300,
        system="Rewrite this into a short, factual report a person could send to a pharmacy or medicine regulator. "
               "Do not add facts. Do not include any personal details about the reporter. Max 120 words.",
        messages=[{"role": "user", "content": base}])
    return "".join(getattr(b, "text", "") for b in msg.content).strip() or base
