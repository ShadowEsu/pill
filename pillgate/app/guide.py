"""
guide.py - the logic behind the guided, automatic run:

  1. WATER CHECK   after Start, the clean-water readings must be steady for BLANK_STABLE_S seconds
                   (lid closed, LED light reaching the sensor, no drift). Compared with the last good
                   clean-water reading if one was saved.
  2. ADD TABLET    the person drops the tablet, stirs, closes the lid and presses Continue.
  3. DISSOLVING    auto-stops when the curve has flattened (plateau), never before MIN_DISSOLVE_S,
                   and always at MAX_DISSOLVE_S.

QUICK DEMO MODE (default in the app): a fixed 60 s after Continue. Every run - including the reference runs -
covers the same 60 s, and the app compares the shape of those 60 s against the reference runs. It does not wait for
the tablet to finish dissolving, so it judges "does it START dissolving like a good tablet", not the final dose.

Why the full-mode times: official dissolution tests for ordinary (immediate-release) tablets usually expect
most of the drug (often 75-80 %) to be released within about 30-45 minutes in a stirred bath at 37 C.
A hackathon demo can't wait that long, and our cup is stirred only once, so instead of a fixed time
the app stops as soon as the light curve stops changing (most of the visible change in a vitamin
tablet happens in the first few minutes - check this with your own runs).  Tune with environment
variables if your tablets are slower.
"""
import json, os, statistics

BLANK_STABLE_S = float(os.getenv("BLANK_STABLE_S", "10"))      # steady clean-water seconds needed
MIN_DISSOLVE_S = float(os.getenv("MIN_DISSOLVE_S", "120"))     # never stop before this
PLATEAU_WINDOW_S = float(os.getenv("PLATEAU_WINDOW_S", "60"))  # "flat" = little change over this window
MAX_DISSOLVE_S = float(os.getenv("MAX_DISSOLVE_S", "600"))     # always stop here (10 min)
QUICK_S = float(os.getenv("QUICK_S", "60"))                    # QUICK DEMO MODE: stop exactly this long after Continue
REF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "water_ref.json")


def _rel_sd(xs):
    m = statistics.mean(xs)
    return statistics.pstdev(xs) / abs(m) if m else 1.0


def water_check(run):
    """run = analysis.Run of the recording so far (before the tablet). Returns a dict for the UI."""
    cols, amax = run.cols, run.adc_max
    n = len(run)
    win = max(5, int(BLANK_STABLE_S))
    out = {"samples": n, "needed": win, "checks": [], "ok": False}
    if n < 3:
        return out
    last = slice(max(0, n - win), n)
    dark = cols["dark_a"][last]
    nets = {}
    for c in ("B", "W", "R"):
        if f"{c}_a" in cols:
            nets[c] = [a - d for a, d in zip(cols[f"{c}_a"][last], dark)]

    def chk(name, ok, msg):
        out["checks"].append({"name": name, "ok": bool(ok), "message": msg})
        return ok

    # Room light vs LED light, compared as LIGHT (not raw counts) so it works with any divider resistor
    # (10k, 47k, 100k, 1M...): light ~ (v / (ADCmax - v)) ^ (1/0.7)
    def light(v):
        v = min(max(v, 0.5), amax - 0.5)
        return (v / (amax - v)) ** (1 / 0.7)
    d_raw = statistics.median(dark)
    lit_raw = statistics.median(cols["B_a"][last]) if "B_a" in cols else d_raw
    room_frac = light(d_raw) / max(light(lit_raw), 1e-9)
    lid_ok = chk("dark", room_frac < 0.35,
                 f"Room light is {room_frac * 100:.0f} % of the blue LED light at the sensor "
                 + ("(dark enough)" if room_frac < 0.35 else "- close the lid / cover light leaks with tape"))
    sat = [c for c in ("B", "W", "R") if f"{c}_a" in cols and statistics.median(cols[f"{c}_a"][last]) >= 0.985 * amax]
    chk("range", not sat, "Sensor not saturated" if not sat else
        f"{'/'.join(sat)} light hits the top of the scale ({amax:.0f}) - use a smaller resistor next to LDR A (e.g. 100k instead of 1M)")
    lid_ok = lid_ok and not sat
    blue = nets.get("B", [0])
    light_ok = chk("light", statistics.median(blue) > 0.02 * amax,
                   f"Blue LED light reaching the sensor: {statistics.median(blue):.0f} counts"
                   + ("" if statistics.median(blue) > 0.02 * amax else " - too little: check the LED points at the sensor"))
    stable = all(_rel_sd(v) < 0.03 for v in nets.values() if statistics.mean(v) > 0) and n >= win
    steady_s = 0
    if "B" in nets:                       # how many recent seconds have been steady (for the progress bar)
        allb = [a - d for a, d in zip(cols["B_a"], cols["dark_a"])]
        m = statistics.median(allb[-3:])
        for v in reversed(allb):
            if m and abs(v - m) / abs(m) < 0.05:
                steady_s += 1
            else:
                break
    out["steady_s"] = min(steady_s, win)
    chk("steady", stable, "Readings steady" if stable else f"Waiting for steady readings ({min(steady_s, win)}/{win} s)")
    ref = load_ref()
    out["vs_reference"] = None
    if ref and stable:
        ratios = {c: statistics.median(v) / ref[c] for c, v in nets.items() if ref.get(c)}
        if ratios:
            worst = min(ratios.values())
            out["vs_reference"] = round(worst, 2)
            chk("reference", 0.75 <= worst <= 1.33,
                f"Compared with your last clean-water reading: {worst * 100:.0f} % of the light"
                + ("" if 0.75 <= worst <= 1.33 else " - cloudy water, a different cup position or a moved LED?"))
    out["ok"] = bool(lid_ok and light_ok and stable)
    out["nets"] = {c: round(statistics.median(v), 1) for c, v in nets.items()}
    return out


def load_ref():
    try:
        return json.load(open(REF_PATH))
    except Exception:
        return None


def save_ref(nets):
    os.makedirs(os.path.dirname(REF_PATH), exist_ok=True)
    json.dump(nets, open(REF_PATH, "w"))


def dissolve_progress(rep, mode="full"):
    """rep = analysis of the recording with drop_index = the Continue press. Decides when to auto-stop.
    mode "quick": always stop at QUICK_S seconds (same window every run, so runs are comparable).
    mode "full":  stop when the curve flattens (between MIN_DISSOLVE_S and MAX_DISSOLVE_S)."""
    if mode == "quick":
        t = rep.get("curve", {}).get("t", [])
        e = t[-1] if t else 0.0
        done = e >= QUICK_S
        return {"elapsed_s": round(e, 1), "mode": "quick", "quick_s": QUICK_S, "stop": done,
                "why": f"the {QUICK_S:.0f}-second quick test is complete" if done else ""}
    c = rep.get("curve", {})
    t = c.get("t", [])
    y = c.get("A_specific") or c.get("A_B") or []
    pts = [(a, b) for a, b in zip(t, y) if b is not None]
    elapsed = pts[-1][0] if pts else 0.0
    out = {"elapsed_s": round(elapsed, 1), "min_s": MIN_DISSOLVE_S, "max_s": MAX_DISSOLVE_S,
           "plateau": False, "stop": False, "why": ""}
    if len(pts) < 10:
        return out
    start = statistics.median([b for a, b in pts[:3]])
    now = statistics.median([b for a, b in pts[-10:]])
    then_pts = [b for a, b in pts if elapsed - PLATEAU_WINDOW_S - 5 <= a <= elapsed - PLATEAU_WINDOW_S + 5]
    total = now - start
    if then_pts and elapsed >= PLATEAU_WINDOW_S:
        change = abs(now - statistics.median(then_pts))
        out["plateau"] = change <= max(0.03 * abs(total), 0.01)
        out["change_last_window"] = round(change, 4)
    out["total_change"] = round(total, 4)
    if elapsed >= MAX_DISSOLVE_S:
        out.update(stop=True, why=f"reached the {MAX_DISSOLVE_S / 60:.0f}-minute limit")
    elif elapsed >= MIN_DISSOLVE_S and out["plateau"]:
        out.update(stop=True, why="the curve has flattened" if abs(total) > 0.02 else "nothing has changed for a while")
    return out
