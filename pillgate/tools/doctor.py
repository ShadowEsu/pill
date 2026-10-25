"""doctor.py - is the UNO Q station healthy? Reads ~10 lines from the board (or a recorded CSV) and prints a verdict table.

    app/.venv/bin/python tools/doctor.py                          # auto-finds /dev/cu.usbmodem* or /dev/cu.usbserial*
    app/.venv/bin/python tools/doctor.py --port /dev/cu.usbmodem8422867792
    app/.venv/bin/python tools/doctor.py --replay runs/REAL_aspirin_first_test.csv   # same checks on a file, no board

Run it with the lid closed and clear water in the cup (the first 10 lines are treated as the clean-water blank).
It only reads, except: if the banner or header has not shown up after 3 s it sends "?" (prints the banner line) and
"G1" (prints the header, keeps streaming on). It refuses to open a port another program holds (the app, the IDE
Serial Monitor, a flashing job): stop that program first, or pass --force.
Exit code: 0 = no FAIL rows, 1 = at least one FAIL, 2 = could not read anything.
"""
import argparse, glob, math, os, statistics, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "app"))
from device import KNOWN, _clean  # the backend's own header table and line cleaner, so the doctor agrees with the app

N_LINES = 10
WAIT_S = 20.0
REF = {  # the numbers the suggestions quote (pillgate/roadmap.md)
    "wiring": "roadmap §4: 3V3 - LDR - node - 10 kΩ - GND, node -> A0 (LDR A) / A1 (LDR B); LED anodes -> one 330 Ω -> 5V, cathodes -> D5 blue, D6 white, D7 green, D8 red",
    "dividers": "roadmap §13: 10 kΩ on LDR A, 100 kΩ on LDR B",
    "led_res": "roadmap §8: if A0 saturates near 4095 use a bigger LED resistor (never below ~220 Ω) or tape in front of the LDR",
    "noise": "roadmap §8 test 0: clear water, lid on - the net signal wanders only a few %; app README: aspirin blank noise was 0.006 log units",
    "leds": "roadmap §4 troubleshooting: one LED dim/dead = backwards, or its short leg on the wrong pin",
    "leak": "app README water-only control: if the side line rises without a tablet, shade LDR B with black tape or paper and keep the lid opening small; roadmap §8: bubbles in the beam are enemy #1",
    "reset": "roadmap §12: UNO Q silent -> press reset, unplug/replug, reselect the port, update the board package",
    "firmware": "roadmap §13 step 2: upload firmware v1.0-nomotor or later; the header ends in R_a,R_b,temp_c,stir",
    "temp": "roadmap §4 step 5: A2 jumpered to GND -> temp_c is nan; type the water temperature with K36.5",
    "stuck": "roadmap §4 troubleshooting: A0/A1 stuck near 0 or 4095 = LDR leg not in the node column / resistor missing",
}


# ---------------------------------------------------------------- sources
def port_holders(port):
    try:
        out = subprocess.run(["lsof", "-t", port], capture_output=True, text=True, timeout=5).stdout.split()
    except Exception:
        return []
    names = []
    for pid in out:
        try:
            cmd = subprocess.run(["ps", "-o", "command=", "-p", pid], capture_output=True, text=True, timeout=5).stdout.strip()
        except Exception:
            cmd = "?"
        names.append(f"pid {pid}: {cmd[:90]}")
    return names


def find_port():
    ports = sorted(glob.glob("/dev/cu.usbmodem*")) + sorted(glob.glob("/dev/cu.usbserial*"))
    return ports[0] if ports else None


def read_serial(port, baud):
    """Returns (comments, header, data_lines, info) read from the board."""
    import serial
    ser = serial.Serial(port, baud, timeout=0.3)
    comments, header, data, junk = [], None, [], 0
    t0 = time.time()
    poked = False
    banner_deadline = t0 + WAIT_S
    try:
        while True:
            now = time.time()
            banner = any("PEEL" in c for c in comments)
            if not poked and now - t0 > 3 and (not banner or header is None):
                ser.write(b"?\n")
                if header is None:
                    ser.write(b"G1\n")
                poked = True
            if len(data) >= N_LINES and (banner and header or now > banner_deadline):
                break
            if now > banner_deadline + (N_LINES + 5 if data else 0):
                break
            raw = ser.readline()
            if not raw:
                continue
            try:
                text = raw.decode("ascii")
            except UnicodeDecodeError:
                junk += 1
                continue
            line = _clean(text)
            if not line:
                continue
            if line.startswith("#"):
                comments.append(line)
                print(f"  {line}")
            elif line.startswith("ms,"):
                header = line
                print(f"  {line}")
            elif line[0].isdigit():
                if len(data) < N_LINES:
                    print(f"  {line}")
                data.append(line)
            elif not line.startswith("live,"):
                junk += 1
    finally:
        ser.close()
    return comments, header, data[:max(N_LINES, len(data))], {"junk": junk, "elapsed": time.time() - t0, "poked": poked}


def read_file(path):
    comments, header, data = [], None, []
    for text in open(path, errors="replace"):
        line = _clean(text)
        if not line:
            continue
        if line.startswith("#"):
            comments.append(line)
        elif line.startswith("ms,"):
            header = header or line
        elif line[0].isdigit():
            data.append(line)
    for line in ([header] if header else []) + data[:N_LINES]:
        print(f"  {line}")
    return comments, header, data, {"junk": 0, "elapsed": 0.0, "poked": False}


# ---------------------------------------------------------------- checks
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--replay", help="run the checks on a recorded CSV instead of the board")
    ap.add_argument("--force", action="store_true", help="open the port even if another program holds it")
    a = ap.parse_args()

    if a.replay:
        src = f"replay {a.replay}"
        print(f"doctor: {src} (file, not live)\n")
        comments, header, data, info = read_file(a.replay)
    else:
        port = a.port or find_port()
        if not port:
            print("doctor: no /dev/cu.usbmodem* or /dev/cu.usbserial* port. Plug the UNO Q in (it needs ~60 s to boot), or use --replay FILE.")
            return 2
        held = port_holders(port)
        if held and not a.force:
            print(f"doctor: {port} is held by another program, not opening it:")
            for h in held:
                print(f"  {h}")
            print("Stop it first (the app, the IDE Serial Monitor, or a flashing job), or pass --force.")
            return 2
        src = f"serial {port} @ {a.baud}"
        print(f"doctor: {src} (waiting up to {WAIT_S:.0f} s for the banner and header)\n")
        try:
            comments, header, data, info = read_serial(port, a.baud)
        except Exception as e:
            print(f"doctor: could not open {port}: {e}")
            return 2

    rows = []  # (check, result, status, note, refs): refs = REF keys quoted under "suggestions" when WARN/FAIL

    def row(check, result, status, note="", refs=()):
        rows.append((check, result, status, note, refs))

    live = not a.replay
    # baud
    if live:
        if data:
            row("baud", f"{a.baud}", "OK", f"{len(data)} clean CSV lines, {info['junk']} undecodable/junk")
        else:
            row("baud", f"{a.baud}", "FAIL", f"no CSV line in {info['elapsed']:.0f} s ({info['junk']} junk lines): wrong baud, or the sketch is not running", ("reset",))
    else:
        row("baud", "n/a", "INFO", "file replay")

    # banner
    banner = next((c for c in comments if "PEEL" in c), None)
    build = next((c for c in comments if c.startswith("# build:")), None)
    if banner:
        row("banner", banner.split("commands")[0].lstrip("# ").strip()[:36], "OK", "sent '?' to ask for it" if info["poked"] else "")
    else:
        row("banner", "not seen", "WARN" if live else "INFO",
            "the board did not print '# PEEL …' even after '?': old firmware or a hung sketch" if live else "not stored in recorded files", ("firmware", "reset"))

    # header
    width = len(data[0].split(",")) if data else 0
    if header:
        ok = header in KNOWN.values()
        row("header", f"{len(header.split(','))} columns", "OK" if ok else "FAIL",
            "matches device.py KNOWN" if ok else f"not in device.py KNOWN {sorted(KNOWN)}: the app will drop these lines (LEDs must be B W R: send LBWR)", ("firmware",))
    elif width in KNOWN:
        header = KNOWN[width]
        row("header", f"{width} columns (inferred)", "WARN", "no 'ms,' line seen; the app infers it from the column count the same way")
    else:
        row("header", "none", "FAIL", f"no header and {width} columns is not in device.py KNOWN {sorted(KNOWN)}", ("firmware",))

    if not data or not header:
        print_table(src, rows)
        suggestions(rows)
        return 2 if not data else 1

    cols = header.split(",")
    rowsv = []
    for line in data:
        p = line.split(",")
        if len(p) != len(cols):
            continue
        try:
            rowsv.append({c: float(v) for c, v in zip(cols, p)})
        except ValueError:
            continue
    first = rowsv[:N_LINES]
    if len(first) < 3:
        row("lines", f"{len(first)} usable", "FAIL", "too few lines to judge")
        print_table(src, rows)
        return 1

    amax = 4095.0
    if build and "adc_max=" in build:
        try:
            amax = float(build.split("adc_max=")[1].split()[0])
        except ValueError:
            pass
    elif max(max(r[c] for c in cols if c.endswith(("_a", "_b"))) for r in first) <= 1023.5:
        amax = 1023.0
    s = amax / 4095.0  # thresholds below are on the 12-bit scale
    med = lambda c: statistics.median(r[c] for r in first)

    # dark
    for side, name in (("a", "LDR A (A0)"), ("b", "LDR B (A1)")):
        d = med(f"dark_{side}")
        lit_ref = med(f"B_{side}") if f"B_{side}" in cols else d
        # the app's own lid test compares LIGHT, not counts (guide.py): room light as a share of the blue LED light
        light = lambda v: (min(max(v, 0.5), amax - 0.5) / (amax - min(max(v, 0.5), amax - 0.5))) ** (1 / 0.7)
        frac = light(d) / max(light(lit_ref), 1e-9)
        if d < 300 * s:
            row(f"dark {side}", f"{d:.0f}/{amax:.0f}", "OK", f"lid closed and dark; room light {frac * 100:.1f} % of blue")
        elif frac < 0.35:
            row(f"dark {side}", f"{d:.0f}/{amax:.0f}", "WARN",
                f"above 300, but the app's lid test passes: room light is {frac * 100:.1f} % of the blue LED at {name} (needs < 35 %). "
                "Likely the photoresistor's slow recovery after the LED flash ('light memory') or a small leak", ("leak", "dividers"))
        else:
            row(f"dark {side}", f"{d:.0f}/{amax:.0f}", "FAIL",
                f"light leak: room light is {frac * 100:.0f} % of the blue LED at {name} (app needs < 35 %). Close the lid, black tape over gaps", ("leak",))

    # lit counts per LED
    leds = [c[:-2] for c in cols if c.endswith("_a") and c != "dark_a"]
    names = {"B": "blue (D5)", "W": "white (D6)", "G": "green (D7)", "R": "red (D8)"}
    for led in leds:
        for side in ("a", "b"):
            c = f"{led}_{side}"
            v, net = med(c), med(c) - med(f"dark_{side}")
            who = f"{names.get(led, led)} -> LDR {side.upper()}"
            if v > 4000 * s:
                row(f"lit {c}", f"{v:.0f} (net {net:+.0f})", "FAIL",
                    f"{who} saturated: a smaller divider resistor next to LDR {side.upper()}, or a bigger LED resistor / tape", ("dividers", "led_res"))
            elif v < 100 * s or net < 20 * s:
                row(f"lit {c}", f"{v:.0f} (net {net:+.0f})", "FAIL" if side == "a" else "WARN",
                    f"{who}: almost no LED light - LED backwards, short leg on the wrong pin, or the divider resistor missing", ("leds", "stuck", "wiring"))
            elif v > 3800 * s:
                row(f"lit {c}", f"{v:.0f} (net {net:+.0f})", "WARN", f"{who} near the top of the scale: little headroom if the water gets brighter", ("led_res",))
            elif v < 400 * s:
                row(f"lit {c}", f"{v:.0f} (net {net:+.0f})", "WARN" if side == "a" else "INFO",
                    f"{who} low: a larger divider resistor next to LDR {side.upper()} gives more counts" + (" (side sensor: low is normal)" if side == "b" else ""), ("dividers",))
            else:
                row(f"lit {c}", f"{v:.0f} (net {net:+.0f})", "OK", who)

    # noise: SD of log10(net) over the 10 blank lines, per LED, both sensors
    worst = (0.0, "")
    for led in leds:
        for side in ("a", "b"):
            nets = [r[f"{led}_{side}"] - r[f"dark_{side}"] for r in first]
            if min(nets) <= 0:
                continue
            sd = statistics.pstdev(math.log10(x) for x in nets)
            if sd > worst[0]:
                worst = (sd, f"{led}_{side}")
    sd, ch = worst
    row("noise", f"{sd:.4f} log ({ch})", "OK" if sd < 0.01 else "FAIL",
        f"worst channel over {len(first)} blank lines (expect < 0.01)" if sd < 0.01 else
        f"unsteady blank on {ch}: loose dupont (hot-glue it), bubbles in the beam, or the lid moving", ("noise",))

    # period
    ms = [r["ms"] for r in rowsv]
    gaps = [b - a for a, b in zip(ms, ms[1:]) if b > a]
    if gaps:
        per = statistics.median(gaps) / 1000
        row("period", f"{per:.2f} s/line", "OK" if 0.8 <= per <= 1.3 else "WARN",
            "~1 line/s" if 0.8 <= per <= 1.3 else "the app expects ~1 line/s: send R1000, or use fewer LEDs (LBWR)")
    else:
        row("period", "?", "WARN", "ms column did not increase")

    # temp
    temps = [r["temp_c"] for r in first if "temp_c" in r]
    finite = [t for t in temps if not math.isnan(t)]
    if not finite:
        row("temp_c", "nan", "INFO", "no thermistor (A2 parked on GND): type the water temperature with K36.5")
    elif all(10 <= t <= 45 for t in finite):
        row("temp_c", f"{statistics.median(finite):.1f} °C", "OK", "")
    else:
        row("temp_c", f"{statistics.median(finite):.1f} °C", "WARN", "random-looking: thermistor on but A2 not wired - set USE_THERMISTOR 0", ("temp",))

    print_table(src, rows)
    suggestions(rows)
    return 1 if any(r[2] == "FAIL" for r in rows) else 0


def print_table(src, rows):
    print(f"\nverdict table ({src})")
    w0 = max(len(r[0]) for r in rows)
    w1 = max(len(r[1]) for r in rows)
    for c, res, st, note, _ in rows:
        print(f"  {st:<4}  {c:<{w0}}  {res:<{w1}}  {note}")
    n = {k: sum(r[2] == k for r in rows) for k in ("OK", "WARN", "FAIL", "INFO")}
    print(f"  => {n['OK']} OK, {n['WARN']} WARN, {n['FAIL']} FAIL, {n['INFO']} INFO")


def suggestions(rows):
    keys = {k for r in rows if r[2] in ("FAIL", "WARN") for k in r[4]}
    print("\nsuggestions")
    if not keys:
        print("  none: the station looks ready. Next: the water check in the app (Start, lid closed).")
        return
    for k in REF:
        if k in keys:
            print(f"  - {REF[k]}")


if __name__ == "__main__":
    sys.exit(main())
