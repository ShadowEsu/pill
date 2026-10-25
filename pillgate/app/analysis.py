"""
analysis.py - turns one run of the optical tester into a screening result.

Input : the CSV the Arduino prints (ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir), pasted or logged.
Output: a dict with the curve, key numbers, quality gates and one of three results:
        PASSED_SCREEN | NEEDS_LAB | UNABLE_TO_VERIFY

How the numbers are made (all steps are plain, explainable maths - no AI here):
  1. Photoresistor (LDR) readings are not linear in light.  For the divider  VCC - LDR - node - 10k - GND:
         v/ADCmax = 10k / (10k + R_ldr)   and   R_ldr ~ light^(-gamma)        (gamma ~ 0.7, an assumption)
     so  light ~ (v / (ADCmax - v)) ^ (1/gamma).   Net light = light(LED on) - light(LED off / dark).
  2. Blank: the first seconds of clear water (before the lid is lifted to drop the tablet).
     Transmission T(t) = net(t) / net(blank).  Absorbance A(t) = -log10 T(t)   (0 = clear, 1 = 10 % gets through).
  3. Tablet-in time: the lid-lift (dark reading jumps) or, if none, the first 6 % drop in blue transmission.
  4. Colour-specific absorbance = A(blue) - A(red).  Cloudiness dims every colour about equally, a yellow dye
     like riboflavin dims blue much more than red - so the difference isolates the colour.
  5. Plateau = the curve stops changing.  t80 = time to reach 80 % of the plateau.
  6. With a calibration profile (known standards), plateau absorbance -> concentration -> % of the label dose.
     With a reference profile (runs of a known-good tablet), the run is compared to those runs instead.
  7. Quality gates decide when NOT to trust the run (saturated sensor, cloudy, noisy blank, too short, ...).
"""
from __future__ import annotations
import io, json, math, statistics
from dataclasses import dataclass, field

KNOWN_HEADERS = {
    9:  "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,temp_c,stir",
    11: "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir",
}

RESULT_TEXT = {
    "PASSED_SCREEN":    "Passed the screen",
    "NEEDS_LAB":        "Needs lab testing",
    "UNABLE_TO_VERIFY": "Unable to verify",
}


# ----------------------------------------------------------------------------- parsing
@dataclass
class Run:
    t: list            # seconds from first sample
    cols: dict         # column name -> list of floats
    adc_max: float

    def __len__(self):
        return len(self.t)


def parse_csv(text: str) -> Run:
    """Accepts a clean CSV or text pasted from the Arduino Serial Monitor (timestamps, '#' lines, 'live,' lines)."""
    head, rows = None, []
    for line in io.StringIO(text):
        line = line.strip()
        if "->" in line[:20]:
            line = line.split("->", 1)[1].strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("ms,"):
            head, rows = line.split(","), []          # a new header restarts the table
            continue
        if not line[0].isdigit():
            continue
        parts = line.split(",")
        if head is None:
            if len(parts) in KNOWN_HEADERS:
                head = KNOWN_HEADERS[len(parts)].split(",")
            else:
                continue
        if len(parts) != len(head):
            continue
        try:
            rows.append([float(x) if x.strip().lower() not in ("nan", "") else float("nan") for x in parts])
        except ValueError:
            continue
    if head is None or len(rows) < 5:
        raise ValueError("no run data found (need the 'ms,...' header or numeric rows)")
    cols = {h: [r[i] for r in rows] for i, h in enumerate(head)}
    t = [(m - cols["ms"][0]) / 1000.0 for m in cols["ms"]]
    biggest = max(max(v for v in cols[c] if not math.isnan(v)) for c in cols if c.endswith(("_a", "_b")))
    adc_max = 4095.0 if biggest > 1100 else 1023.0
    return Run(t=t, cols=cols, adc_max=adc_max)


# ----------------------------------------------------------------------------- helpers
def _light(v: float, adc_max: float, gamma: float) -> float:
    v = min(max(v, 0.5), adc_max - 0.5)
    return (v / (adc_max - v)) ** (1.0 / gamma)


def _median(xs):
    xs = [x for x in xs if x is not None and not math.isnan(x)]
    return statistics.median(xs) if xs else float("nan")


def _std(xs):
    xs = [x for x in xs if x is not None and not math.isnan(x)]
    return statistics.pstdev(xs) if len(xs) > 1 else 0.0


def _rolling_median(xs, w):
    h = w // 2
    return [_median(xs[max(0, i - h):i + h + 1]) for i in range(len(xs))]


def _colors(run: Run):
    return [c for c in "BWGRI" if f"{c}_a" in run.cols]


def fit_line(xs, ys):
    """Least-squares y = m x + b.  Returns (m, b, r2)."""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    m = sxy / sxx if sxx else 0.0
    b = my - m * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((y - (m * x + b)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    return m, b, r2


def jsonable(o):
    """Replace NaN / inf with None everywhere so the result is valid JSON."""
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    return o


# ----------------------------------------------------------------------------- main analysis
DEFAULTS = dict(
    gamma=0.7,              # LDR exponent - an assumption; calibration absorbs the error
    blank_s=10.0,           # seconds of clear water used as the blank when there is no lid-lift
    drop_frac=0.06,         # 6 % transmission drop = tablet went in (only used if no lid-lift was seen)
    min_signal=15.0,        # min (LED on - dark) raw counts for a colour to count as wired / visible
    min_run_s=120.0,        # need at least this long after the tablet went in
    noisy_blank_A=0.02,     # std of blank absorbance above this = unstable light / loose wire
    dark_T=0.02,            # transmission below 2 % = too dark to measure (saturated absorbance)
    cloudy_A_ref=0.30,      # absorbance on the reference colour (red) above this = cloudy water
    plateau_frac=0.05,      # plateau: last 20 s changed < 5 % of the total change
)


def _at(xs, ys, x):
    """Linear interpolation of the curve (xs, ys) at x (None if out of range)."""
    pts = [(a, b) for a, b in zip(xs, ys) if b is not None and not (isinstance(b, float) and math.isnan(b))]
    if not pts or x < pts[0][0] or x > pts[-1][0]:
        return None
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def checkpoints(window_s, step=5.0):
    return [round(step * i, 1) for i in range(1, int(window_s // step) + 1)]


def analyze(run: Run, profile: dict | None = None, opts: dict | None = None) -> dict:
    o = dict(DEFAULTS, **(opts or {}))
    win = o.get("window_s")
    if win and not o.get("_windowed"):
        # QUICK MODE: find the tablet-in moment, keep exactly `win` seconds after it, analyse only that window
        first = analyze(run, None, dict(opts or {}, window_s=None))
        t_in = first["numbers"]["tablet_in_at_s"] or 0
        di = next((i for i, x in enumerate(run.t) if x >= t_in), 0)
        end = max(i for i, x in enumerate(run.t) if x - run.t[di] <= win + 0.5)
        sub = Run(t=run.t[:end + 1], cols={k: v[:end + 1] for k, v in run.cols.items()}, adc_max=run.adc_max)
        return analyze(sub, profile, dict(opts or {}, drop_index=di, _windowed=True))
    prof = profile or {}
    t, cols, amax = run.t, run.cols, run.adc_max
    n = len(t)
    colors = _colors(run)

    # --- 1. lid openings and the tablet-in moment ---------------------------------------------------------
    # The dark reading (all LEDs off) jumps while the lid is open. Either sensor may show it: LDR A sits deep in its
    # pocket and barely sees room light, LDR B usually sees much more. Thresholds are relative, so any resistor works.
    wo = o.get("water_ok_index")                    # app: the moment the clean-water check passed
    ci = o.get("drop_index")                        # app: the Continue press (pass 2 of quick mode: tablet-in index)
    base_end = int(wo) if wo is not None else max(5, sum(1 for x in t if x <= o["blank_s"]))
    base_end = max(3, min(base_end, n))
    base0 = max(0, base_end - 10)

    def opened(col):
        d = cols.get(col)
        if not d:
            return [False] * n
        d0, sd = _median(d[base0:base_end]), _std(d[base0:base_end])
        thr = d0 + max(6 * sd, 0.15 * abs(d0), 10)
        return [x > thr for x in d]

    lid = [a or b for a, b in zip(opened("dark_a"), opened("dark_b"))]
    lid = [False if i < base_end else x for i, x in enumerate(lid)]
    lid_idx = [i for i, x in enumerate(lid) if x]
    segs = []
    for i in lid_idx:
        if segs and i <= segs[-1][1] + 2:           # merge flickers 1-2 samples apart
            segs[-1][1] = i
        else:
            segs.append([i, i])
    lid_open_s = sum(t[e] - t[s0] + 1 for s0, e in segs)

    if wo is not None:
        blank_end = int(wo)
    elif segs:
        blank_end = max(3, segs[0][0] - 2)          # a hand / lid shadow reaches the sensors ~1 s before the dark jump
    elif ci is not None:
        blank_end = int(ci)
    else:
        blank_end = None
    if segs and (ci is None or segs[0][0] <= int(ci) + 2):
        drop_i = segs[0][0]                         # the tablet goes in while the lid is open
    elif ci is not None:
        drop_i = max(3, min(int(ci), n - 1))
    else:
        drop_i = None
    masked = set()
    for s0, e in segs:                              # lid-open seconds (+2 s to settle) are not measurements
        masked.update(range(max(0, s0 - 1), min(n, e + 3)))

    # --- 2. net light per colour, blank ---------------------------------------------------------------
    def net_series(colname, darkname):
        lit = cols[colname]
        dk = cols[darkname]
        return [_light(a, amax, o["gamma"]) - _light(d, amax, o["gamma"]) for a, d in zip(lit, dk)]

    if blank_end is None:
        blank_end = max(5, sum(1 for x in t if x <= o["blank_s"]))
        blank_end = min(blank_end, max(3, n - 3))
    blank_end = max(3, blank_end)

    # the blank = the last ~10 s of clear water just before the tablet (settled; ignores the first seconds after Start)
    b0 = max(0, blank_end - int(o.get("blank_window", 10)))
    present, raw_signal = [], {}
    for c in colors:
        sig = _median([a - d for a, d in zip(cols[f"{c}_a"][b0:blank_end], cols["dark_a"][b0:blank_end])])
        raw_signal[c] = sig
        if sig >= o["min_signal"]:
            present.append(c)

    A, Tr = {}, {}
    blank_sd = {}
    for c in present:
        net = net_series(f"{c}_a", "dark_a")
        b = _median(net[b0:blank_end])
        Tr[c] = [x / b if b > 0 else float("nan") for x in net]
        A[c] = [-math.log10(min(max(x, 1e-4), 10)) for x in Tr[c]]
        if o.get("smooth", 3) > 1:                        # rolling median of 3 s: removes single-sample spikes
            A[c] = _rolling_median(A[c], int(o.get("smooth", 3)))
        blank_sd[c] = _std(A[c][b0:blank_end])
        A[c] = [float("nan") if i in masked else v for i, v in enumerate(A[c])]

    # scatter (side sensor) relative to blank, on the reference colour if present, else blue
    sc_col = "R" if "R" in present and f"R_b" in cols else ("B" if "B" in present else None)
    scatter = None
    if sc_col:
        sn = net_series(f"{sc_col}_b", "dark_b")
        sb = _median(sn[b0:blank_end])
        scatter = [float("nan") if (i in masked or sb <= 0) else x / sb for i, x in enumerate(sn)]
        # log scale, same units as absorbance: +0.30 = the side sensor sees twice as much scattered light as in clear water
        sc_log = [math.log10(max(x / sb, 1e-3)) if sb > 0 else float("nan") for x in sn]
        if o.get("smooth", 3) > 1:
            sc_log = _rolling_median(sc_log, int(o.get("smooth", 3)))
        blank_sd["side"] = _std(sc_log[b0:blank_end])
        sc_log = [float("nan") if i in masked else v for i, v in enumerate(sc_log)]

    # --- 3. tablet-in time fallback: 6 % transmission drop -------------------------------------------
    main = prof.get("analyte_color", "B") if prof.get("analyte_color", "B") in present else (present[0] if present else None)
    if drop_i is None and main:
        for i in range(blank_end, n - 2):
            if all(Tr[main][j] < 1 - o["drop_frac"] for j in (i, i + 1, i + 2)):
                drop_i = i
                break
    if drop_i is None:
        drop_i = blank_end

    # --- 4. colour-specific absorbance ---------------------------------------------------------------
    ref = prof.get("reference_color", "R")
    spec = None
    if main and ref in present and ref != main:
        spec = [a - r for a, r in zip(A[main], A[ref])]
    elif main:
        spec = A[main][:]
    signal = prof.get("signal", "colour")       # "colour" (yellow drug, e.g. riboflavin) or "cloud" (white tablet, e.g. aspirin)
    if signal == "cloud":
        cc = ref if ref in present else main     # red light: dimmed by cloudiness, not by colour
        spec = A[cc][:] if cc else None
    elif signal == "scatter":                    # side sensor: brightens as particles scatter light sideways
        spec = sc_log[:] if sc_col else None
    cloudish = signal in ("cloud", "scatter")

    # --- 5. plateau and t80 (on the colour-specific curve) -------------------------------------------
    tt = [x - t[drop_i] for x in t[drop_i:]]
    curve = spec[drop_i:] if spec else []
    run_s = tt[-1] if tt else 0.0
    out_curve = {"t": [round(x, 1) for x in tt]}
    for c in present:
        out_curve[f"A_{c}"] = [round(x, 4) for x in A[c][drop_i:]]
    if spec:
        out_curve["A_specific"] = [round(x, 4) for x in curve]
        out_curve["signal"] = signal
    if scatter:
        out_curve["scatter"] = [round(x, 3) for x in scatter[drop_i:]]
        if signal != "scatter":                  # side-sensor cloudiness, shown as its own line
            out_curve["A_side"] = [round(x, 4) for x in sc_log[drop_i:]]

    k = max(5, sum(1 for x in tt if x >= run_s - 20))          # samples in the last ~20 s
    A_end = _median(curve[-k:]) if curve else float("nan")
    A_prev = _median(curve[-2 * k:-k]) if len(curve) >= 2 * k else float("nan")
    valid = [y for y in curve if y is not None and not math.isnan(y)]
    start = _median(valid[:3]) if valid else 0.0
    total = A_end - start
    plateau = (not math.isnan(A_prev)) and abs(A_end - A_prev) <= max(o["plateau_frac"] * abs(total), 3 * blank_sd.get(main, 0.005), 0.005)
    t80 = None
    if curve and abs(total) > 0.01:
        for x, y in zip(tt, curve):
            if y is None or math.isnan(y):
                continue
            if (y - start) / (A_end - start) >= 0.8:
                t80 = round(x, 1)
                break

    # --- 6. quality gates ------------------------------------------------------------------------------
    gates = []

    def gate(code, ok, msg, blocking=True):
        gates.append({"code": code, "ok": bool(ok), "blocking": blocking, "message": msg})

    gate("COLOURS_PRESENT", main is not None, f"LED colours seen by the straight-through sensor: {', '.join(present) or 'none'}")
    bright_sat = any(_median(cols[f"{c}_a"][b0:blank_end]) >= amax - 10 for c in present)
    gate("SENSOR_NOT_SATURATED", not bright_sat, "Blank reading is at the top of the scale - LED too bright / sensor saturated.")
    too_dark = bool(main) and _median(Tr[main][-k:]) < o["dark_T"]
    gate("NOT_TOO_DARK", not too_dark,
         f"Less than {o['dark_T']*100:.0f} % of the {main} light gets through at the end - too concentrated for this cup "
         "(absorbance can't be measured; dilute or use a narrower vial).", blocking=bool(prof.get("calibration")))
    noise_c = "side" if signal == "scatter" else (ref if (signal == "cloud" and ref in present) else main)  # what the verdict uses
    gate("STABLE_BLANK", (blank_sd.get(noise_c, 0) if noise_c else 0) <= o["noisy_blank_A"],
         f"Blank noise {blank_sd.get(noise_c, 0):.3f} absorbance units on {noise_c} (limit {o['noisy_blank_A']}).")
    cloudy_val = _median(A[ref][-k:]) if (ref in present and not cloudish) else None
    if signal == "scatter" and not sc_col:
        gate("SIDE_SENSOR", False, "Scatter profile, but the side sensor (LDR B) sees no LED light - check its wiring.")
    if not cloudish:
        gate("NOT_CLOUDY", cloudy_val is None or cloudy_val <= prof.get("cloudy_A_ref", o["cloudy_A_ref"]),
             "Cloudiness check on the red (reference) light: "
             + ("no red LED - not checked" if cloudy_val is None else f"A_red = {cloudy_val:.2f}"),
             blocking=prof.get("cloudy_blocks", True))
    gate("LID_OPEN_SHORT", lid_open_s <= o.get("max_lid_open_s", 25),
         f"Lid was open for {lid_open_s:.0f} s" + ("" if lid_open_s <= o.get("max_lid_open_s", 25) else
         f" - too long (limit {o.get('max_lid_open_s', 25)} s): drop the tablet, stir 5 circles and close the lid within ~10 s, then press Continue right away."))
    windowed = bool(o.get("_windowed"))
    if windowed:
        gate("LONG_ENOUGH", run_s >= 0.9 * win,
             f"Quick mode: recorded {run_s:.0f} of {win:.0f} s after the tablet went in.")
    else:
        gate("LONG_ENOUGH", run_s >= prof.get("min_run_s", o["min_run_s"]) and plateau,
             f"Ran {run_s:.0f} s after the tablet went in; plateau {'reached' if plateau else 'NOT reached'}.")
    refp0 = prof.get("reference") or {}
    if refp0:
        ref_win = refp0.get("window_s")
        same = (ref_win == win) if windowed else (ref_win is None)
        gate("PROFILE_MODE_MATCH", same,
             "Reference runs were recorded in the same mode as this run." if same else
             f"Reference runs were recorded in {'quick ' + str(int(ref_win)) + ' s' if ref_win else 'full'} mode, "
             f"this run in {'quick ' + str(int(win)) + ' s' if windowed else 'full'} mode - record references in the same mode.")
    exp = prof.get("expect_color")         # False = this drug should NOT colour the water
    if exp is False and spec is not None and main and ref in present:
        coloured = A_end > max(0.05, 5 * blank_sd.get(main, 0.005))
        gate("NO_UNEXPECTED_COLOUR", not coloured,
             f"Colour-specific absorbance {A_end:.3f}, but this drug should not colour the water.")
    gate("PROFILE_AVAILABLE", bool(prof.get("calibration") or prof.get("reference")),
         "A calibration or reference profile exists for this product." if prof else "No profile for this product.")

    blockers = [g for g in gates if g["blocking"] and not g["ok"]]

    # --- 7. quantity (calibration) and/or fingerprint (reference) ---------------------------------------
    quant, finger, reasons = None, None, []
    cal = prof.get("calibration")
    if cal and spec is not None and not math.isnan(A_end):
        m, b = cal["slope"], cal["intercept"]
        conc = (A_end - b) / m if m else float("nan")
        vol_l = prof.get("volume_ml", 150) / 1000.0
        mg = conc * vol_l
        pct = 100.0 * mg / prof["label_mg"] if prof.get("label_mg") else None
        lod = cal.get("lod")
        quant = {"conc_mg_per_l": round(conc, 3), "released_mg": round(mg, 2),
                 "percent_of_label": None if pct is None else round(pct, 1),
                 "lod_mg_per_l": lod, "r2": cal.get("r2")}
    refp = prof.get("reference")
    if refp and windowed and refp.get("curve"):
        rc = refp["curve"]
        rows, bad = [], 0
        for x, ra, sd in zip(rc["t"], rc["A"], rc["sd"]):
            ya = _at(tt, curve, x)
            if ya is None:                          # no measurement there (lid open): skip, don't count
                continue
            tol = max(refp.get("tol_frac", 0.25) * abs(ra), 3 * sd, 0.015)
            ok = abs(ya - ra) <= tol
            bad += 0 if ok else 1
            rows.append({"t": x, "A": round(ya, 4), "ref": ra, "tol": round(tol, 4), "ok": ok})
        coverage = len(rows) / max(1, len(rc["t"]))
        frac = (1 - bad / len(rows)) if rows and coverage >= 0.5 else 0.0
        finger = {"kind": "curve", "checkpoints": rows, "match_fraction": round(frac, 2),
                  "end_ok": bool(rows and rows[-1]["ok"]), "window_s": win}
    elif refp:
        rt = refp.get("t80_s"); ra = refp.get("plateau_A")
        tol_t = refp.get("t80_tol", 0.25); tol_a = refp.get("plateau_tol", 0.20)
        ok_t = t80 is not None and rt and abs(t80 - rt) <= tol_t * rt
        ok_a = ra not in (None, 0) and abs(A_end - ra) <= tol_a * abs(ra)
        finger = {"t80_s": t80, "ref_t80_s": rt, "plateau_A": round(A_end, 4), "ref_plateau_A": ra,
                  "t80_within_tol": bool(ok_t), "plateau_within_tol": bool(ok_a)}

    # --- 8. verdict -------------------------------------------------------------------------------------
    if blockers:
        result = "UNABLE_TO_VERIFY"
        reasons = [g["message"] for g in blockers]
    elif windowed:
        if finger and finger.get("kind") == "curve":
            if finger["match_fraction"] >= 0.8 and finger["end_ok"]:
                result, reasons = "PASSED_SCREEN", [f"The first {win:.0f} s of dissolving match the reference runs for this product."]
            else:
                result = "NEEDS_LAB"
                off = [r for r in finger["checkpoints"] if not r["ok"]]
                faster = sum(1 for r in off if r["A"] is not None and r["A"] > r["ref"])
                reasons = [f"{len(off)} of {len(finger['checkpoints'])} checkpoints differ from the reference "
                           f"({'more' if faster >= len(off) - faster else 'less'} {'cloudiness' if cloudish else 'colour'} than expected)."]
        else:
            result, reasons = "UNABLE_TO_VERIFY", ["Quick mode needs a reference profile recorded in quick mode (3 quick runs of a known-good tablet)."]
        if quant and quant.get("percent_of_label") is not None:
            reasons.append(f"About {quant['percent_of_label']:.0f} % of the labelled dose dissolved within {win:.0f} s (information only).")
    elif quant and quant["percent_of_label"] is not None:
        lod = quant.get("lod_mg_per_l") or 0
        t80_max = prof.get("t80_max_s")
        if quant["conc_mg_per_l"] < lod:
            result, reasons = "NEEDS_LAB", ["Active ingredient not detected (below the detection limit)."]
        else:
            pct = quant["percent_of_label"]
            slow = t80_max is not None and (t80 is None or t80 > t80_max)
            if 90 <= pct <= 110 and not slow:
                result, reasons = "PASSED_SCREEN", [f"Released {pct:.0f} % of the labelled dose" + (f", t80 = {t80:.0f} s." if t80 else ".")]
            else:
                result = "NEEDS_LAB"
                if not 90 <= pct <= 110:
                    reasons.append(f"Released {pct:.0f} % of the labelled dose (screen range 90-110 %).")
                if slow:
                    reasons.append(f"Dissolved too slowly (t80 {t80} s, limit {t80_max} s).")
    elif finger:
        if finger["t80_within_tol"] and finger["plateau_within_tol"]:
            result, reasons = "PASSED_SCREEN", ["Dissolution curve matches the reference runs for this product."]
        else:
            result = "NEEDS_LAB"
            if not finger["t80_within_tol"]:
                reasons.append(f"Time to 80 % ({t80} s) differs from the reference ({finger['ref_t80_s']} s).")
            if not finger["plateau_within_tol"]:
                reasons.append(f"Final {'cloudiness' if cloudish else 'colour'} level ({A_end:.3f}) differs from the reference ({finger['ref_plateau_A']}).")
    else:
        result, reasons = "UNABLE_TO_VERIFY", ["No calibration or reference profile for this product."]

    return jsonable({
        "result": result,
        "result_text": RESULT_TEXT[result],
        "reasons": reasons,
        "numbers": {
            "adc_max": amax, "colours": present, "run_s_after_drop": round(run_s, 1),
            "tablet_in_at_s": round(t[drop_i], 1), "lid_lift_detected": bool(lid_idx), "lid_open_s": round(lid_open_s, 1),
            "plateau_reached": bool(plateau), "t80_s": t80, "mode": f"quick {win:.0f} s" if windowed else "full",
            "A_specific_end": None if math.isnan(A_end) else round(A_end, 4),
            "blank_noise_A": {c: round(v, 4) for c, v in blank_sd.items()},
            "signal": signal,
            "raw_signal_counts": {c: round(v, 1) for c, v in raw_signal.items()},
        },
        "quantity": quant,
        "fingerprint": finger,
        "gates": gates,
        "curve": out_curve,
        "disclaimer": "Screening only. This does not identify ingredients or certify a medicine; "
                      "a 'needs lab testing' result should go to a qualified laboratory.",
    })


# ----------------------------------------------------------------------------- profiles
def build_calibration(standards: list[tuple[float, Run]], opts: dict | None = None, profile: dict | None = None) -> dict:
    """standards = [(concentration_mg_per_L, run_of_that_standard), ...] - include 0 (plain water).
    Each standard's absorbance = median colour-specific absorbance over its last 20 s, vs. its own blank... but a
    standard has no 'tablet drop', so all standards are measured against the FIRST run (plain water) as blank."""
    o = dict(DEFAULTS, **(opts or {}))
    prof = profile or {}
    water = sorted(standards, key=lambda s: s[0])[0][1]
    main = prof.get("analyte_color", "B"); ref = prof.get("reference_color", "R")

    def level(run, c):
        net = [_light(a, run.adc_max, o["gamma"]) - _light(d, run.adc_max, o["gamma"])
               for a, d in zip(run.cols[f"{c}_a"], run.cols["dark_a"])]
        return net

    blank = {c: _median(level(water, c)) for c in (main, ref) if f"{c}_a" in water.cols}
    pts, noise = [], []
    for conc, run in standards:
        a_main = [-math.log10(max(x / blank[main], 1e-4)) for x in level(run, main)]
        if ref in blank and f"{ref}_a" in run.cols:
            a_ref = [-math.log10(max(x / blank[ref], 1e-4)) for x in level(run, ref)]
            a = [x - y for x, y in zip(a_main, a_ref)]
        else:
            a = a_main
        pts.append((conc, _median(a[-20:])))
        if conc == 0:
            noise.append(_std(a))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    m, b, r2 = fit_line(xs, ys)
    sd = noise[0] if noise else 0.005
    lod = 3 * sd / m if m > 0 else None
    return {"slope": m, "intercept": b, "r2": round(r2, 4), "lod": None if lod is None else round(lod, 3),
            "points": [{"conc_mg_per_l": x, "A": round(y, 4)} for x, y in pts]}


def build_reference(runs: list[Run], profile: dict | None = None, opts: dict | None = None,
                    per_run_opts: list | None = None) -> dict:
    """Reference ('fingerprint') profile from >= 3 runs of a known-good tablet.
    per_run_opts: optional list (one dict per run) with that run's markers (drop_index / water_ok_index)."""
    per_run_opts = per_run_opts or [{}] * len(runs)
    res = [analyze(r, dict(profile or {}, reference=None, calibration=None), dict(opts or {}, **(po or {})))
           for r, po in zip(runs, per_run_opts)]
    win = (opts or {}).get("window_s")
    if win:
        cps = checkpoints(win)
        per = [[_at(x["curve"]["t"], x["curve"].get("A_specific") or x["curve"].get("A_B") or [], c) for c in cps] for x in res]
        keep_t, mean, sd = [], [], []
        for j, c in enumerate(cps):                 # skip checkpoints that fall in the lid-open seconds
            vals = [p[j] for p in per if p[j] is not None]
            if len(vals) >= max(2, (len(per) + 1) // 2):
                keep_t.append(c); mean.append(statistics.mean(vals)); sd.append(statistics.pstdev(vals))
        if len(keep_t) < 4:
            raise ValueError("need at least 2 usable quick reference runs (3+ recommended) with the lid closed for most of the window")
        return {"window_s": win, "n_runs": len(per),
                "curve": {"t": keep_t, "A": [round(v, 4) for v in mean], "sd": [round(v, 4) for v in sd]},
                "tol_frac": 0.25}
    t80s = [x["numbers"]["t80_s"] for x in res if x["numbers"]["t80_s"] is not None]
    ends = [x["numbers"]["A_specific_end"] for x in res if x["numbers"]["A_specific_end"] is not None]
    if len(t80s) < 2 or len(ends) < 2:
        raise ValueError("need at least 2 usable reference runs (3+ recommended)")
    mt, ma = statistics.mean(t80s), statistics.mean(ends)
    spread_t = (max(t80s) - min(t80s)) / 2 / mt if mt else 0
    spread_a = (max(ends) - min(ends)) / 2 / abs(ma) if ma else 0
    return {"t80_s": round(mt, 1), "plateau_A": round(ma, 4),
            "t80_tol": round(max(0.25, 2 * spread_t), 3), "plateau_tol": round(max(0.20, 2 * spread_a), 3),
            "n_runs": len(runs), "t80_runs": t80s, "plateau_runs": ends}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        sys.exit("usage: python analysis.py run.csv [profile.json]")
    run = parse_csv(open(sys.argv[1], errors="replace").read())
    prof = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
    rep = analyze(run, prof)
    rep.pop("curve")
    print(json.dumps(rep, indent=2))
