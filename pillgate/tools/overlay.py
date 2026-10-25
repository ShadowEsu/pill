#!/usr/bin/env python3
"""Overlay several runs and print how repeatable they are  (pip install matplotlib numpy).

  python3 overlay.py runs/ribo_run1_*.csv runs/ribo_run2_*.csv runs/ribo_run3_*.csv --chan B_a
  python3 overlay.py runs/ribo*.csv runs/vitc*.csv --chan B_a --save overlay.png

The files can be pasted straight from the Arduino IDE Serial Monitor (Ctrl+A, Ctrl+C, paste into a .csv/.txt file).

How it works
  net signal = channel - dark      (dark = same-sample reading with every LED off -> cancels room light)
  curve      = net / baseline      (baseline = median of the first --base rows = clear water, lid on)
  Rows where the lid was lifted (dark jumps) are dropped; t = 0 when the lid goes back on.
  t50        = first time the curve has travelled halfway from its start to its end value.
"""
import argparse, sys
import numpy as np

def read_rows(path):
    """Accepts a clean CSV *or* text pasted from the Arduino Serial Monitor:
       - strips timestamps like '12:34:56.789 -> '
       - skips '# comment' lines, 'live,...' lines and any other junk
       - uses the LAST header line that starts with 'ms,'; keeps only rows with that many numeric fields."""
    head, rows = None, []
    for line in open(path, errors="replace"):
        line = line.strip()
        if "->" in line[:20]: line = line.split("->", 1)[1].strip()
        if not line or line.startswith("#"): continue
        if line.startswith("ms,"):
            head = line.split(","); rows = []; continue          # a new header restarts the table
        if head is None: continue
        parts = line.split(",")
        if len(parts) != len(head): continue
        try: rows.append([float(x) if x.strip().lower() not in ("nan", "") else np.nan for x in parts])
        except ValueError: continue
    if head is None or len(rows) < 3: sys.exit(f"{path}: no CSV data found (need a line starting 'ms,' and some number rows)")
    return head, np.array(rows)

def load(path, chan, base_n):
    head, data = read_rows(path)
    col = {n: i for i, n in enumerate(head)}
    if chan not in col: sys.exit(f"{path}: no column '{chan}'. Columns: {', '.join(head)}")
    dark = col["dark_a"] if chan.endswith("_a") else col["dark_b"]
    t = (data[:, col["ms"]] - data[0, col["ms"]]) / 1000.0
    net = data[:, col[chan]] - data[:, dark]
    d = data[:, dark]
    d0 = np.median(d[:base_n]); b0 = np.median(net[:base_n])
    # lid lifted = dark reading jumps well above its starting level (scale-free: works for 10-bit and 12-bit boards)
    lid_off = d > d0 + max(0.02 * abs(b0), 3 * np.std(d[:base_n]), 8)
    t0 = t[np.where(lid_off)[0][-1]] if lid_off.any() else t[0]
    keep = (~lid_off) & (t >= t0)
    tt = t[keep] - t0; y = net[keep] / b0
    return tt, y, bool(lid_off.any())

def t50(t, y):
    if len(y) < 10: return np.nan
    y0 = np.median(y[:3]); y1 = np.median(y[-max(3, len(y)//10):])
    if abs(y1 - y0) < 0.02: return np.nan             # nothing happened
    prog = (y - y0) / (y1 - y0)
    i = np.where(prog >= 0.5)[0]
    return t[i[0]] if len(i) else np.nan

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+"); ap.add_argument("--chan", default="B_a"); ap.add_argument("--base", type=int, default=10)
    ap.add_argument("--save"); a = ap.parse_args()
    import matplotlib
    if a.save: matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    res = []
    for p in a.files:
        t, y, lid = load(p, a.chan, a.base)
        res.append((p, t, y, t50(t, y)))
        plt.plot(t, y, label=p.split("/")[-1])
        print(f"{p}: {len(t)} samples, lid-lift detected={lid}, t50={res[-1][3]:.0f}s, end={np.median(y[-5:]):.2f}")
    v = [r[3] for r in res if not np.isnan(r[3])]
    if len(v) > 1:
        print(f"t50 spread: {min(v):.0f}-{max(v):.0f}s  (+/-{(max(v)-min(v))/2/np.mean(v)*100:.0f}% around the mean)")
    plt.xlabel("seconds since lid closed"); plt.ylabel(f"{a.chan} net signal / clear-water baseline"); plt.grid(alpha=.3); plt.legend(fontsize=8)
    if a.save: plt.savefig(a.save, dpi=120, bbox_inches="tight"); print("saved", a.save)
    else: plt.show()

if __name__ == "__main__":
    main()
