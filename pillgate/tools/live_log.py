#!/usr/bin/env python3
"""LIVE logger for the Peel tester: serial port -> CSV file (+ optional live graph).   Runs on your laptop or the Pi.

  pip install pyserial matplotlib numpy          (Windows: use  py -m pip install ...)

  python3 live_log.py --list                     show the serial ports this computer can see
  python3 live_log.py --label ribo1              auto-pick the port, log until Ctrl+C       -> runs/ribo1_<time>.csv
  python3 live_log.py --label ribo1 --plot       same, plus a live graph window
  python3 live_log.py --label ribo1 --port COM5  choose the port yourself (Linux/Pi: /dev/ttyACM0)
  python3 live_log.py --replay runs/old.csv --plot   no board? replay an old run (also good for a demo backup)

Rules
  * CLOSE the Arduino IDE Serial Monitor first - only ONE program can use the port at a time.
  * This script does not send any commands to the board (the sketch streams by default: blue + white LEDs).
  * UNTESTED ON THE UNO Q: if --list shows no port, the board's USB-C is not appearing as a serial port on this
    computer. Then use the fallback: Arduino IDE Serial Monitor -> Ctrl+A, Ctrl+C -> paste into a .csv file.
"""
import argparse, os, sys, time, glob, statistics

KNOWN_HEADERS = {9: "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,temp_c,stir",              # firmware v0.3 (blue + white)
                 11: "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir"}   # firmware v0.4 (blue + white + red)

def list_ports():
    try:
        import serial.tools.list_ports as lp
    except ImportError:
        sys.exit("pyserial is not installed.  Run:  pip install pyserial")
    return list(lp.comports())

def looks_like_arduino(p):
    """Arduino boards use USB vendor id 0x2341 (your UNO Q shows VID:PID=2341:0078). Skip Bluetooth ports."""
    hw = (getattr(p, "hwid", "") or "").upper()
    if "BTHENUM" in hw or "BLUETOOTH" in (p.description or "").upper():
        return False
    if getattr(p, "vid", None) in (0x2341, 0x2A03) or "VID:PID=2341" in hw:
        return True
    txt = ((p.manufacturer or "") + (p.description or "")).lower()
    return "arduino" in txt or "ACM" in p.device or "usbmodem" in p.device


def pick_port():
    ports = list_ports()
    pref = [p for p in ports if looks_like_arduino(p)]
    if pref: return pref[0].device
    if len(ports) == 1: return ports[0].device
    return None

def clean(line):
    line = line.strip()
    if "->" in line[:20]: line = line.split("->", 1)[1].strip()     # Serial-Monitor timestamps
    return line

def keep(line):
    return bool(line) and (line.startswith("ms,") or line[0].isdigit())

def source_serial(port, baud):
    import serial
    ser = serial.Serial(port, baud, timeout=1)
    time.sleep(2.0)                      # some boards reset when the port opens
    ser.reset_input_buffer()
    while True:
        yield ser.readline().decode(errors="ignore")

def source_replay(path, speed):
    for line in open(path, errors="replace"):
        line = clean(line)
        yield line + "\n"
        if line and line[0].isdigit(): time.sleep(1.0 / speed)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true"); ap.add_argument("--port"); ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--label", default="run"); ap.add_argument("--outdir", default="runs")
    ap.add_argument("--minutes", type=float, default=0, help="stop after N minutes (0 = until Ctrl+C)")
    ap.add_argument("--chan", default="B_a", help="column shown live (B_a, B_b, W_a, W_b)")
    ap.add_argument("--plot", action="store_true"); ap.add_argument("--replay"); ap.add_argument("--speed", type=float, default=20.0)
    a = ap.parse_args()

    if a.list:
        ports = list_ports()
        if not ports: print("No serial ports found. (See the 'UNTESTED ON THE UNO Q' note at the top of this file.)")
        for p in ports: print(f"{p.device}\t{p.description}\t{p.manufacturer or ''}")
        return

    if a.replay: src = source_replay(a.replay, a.speed)
    else:
        port = a.port or pick_port()
        if not port: sys.exit("No Arduino port found. Run with --list, or pass --port COM5 (or /dev/ttyACM0). "
                              "No port at all? Use the Serial Monitor copy/paste fallback.")
        print("using port", port); src = source_serial(port, a.baud)

    os.makedirs(a.outdir, exist_ok=True)
    path = os.path.join(a.outdir, f"{a.label}_{time.strftime('%Y%m%d_%H%M%S')}.csv")
    head, t0, base_vals, rows_ts, rows_y = None, None, [], [], []
    deadline = time.time() + a.minutes * 60 if a.minutes else None

    if a.plot:
        import matplotlib.pyplot as plt
        plt.ion(); fig, ax = plt.subplots(); (line_plot,) = ax.plot([], [])
        ax.set_xlabel("seconds"); ax.set_ylabel(f"{a.chan} net signal / clear-water baseline"); ax.grid(alpha=.3); ax.set_ylim(0, 1.2)

    n = 0
    print(f"logging -> {path}   (Ctrl+C to stop)")
    with open(path, "w") as f:
        try:
            for raw in src:
                if deadline and time.time() > deadline: break
                line = clean(raw)
                if not keep(line): continue
                if line.startswith("ms,"):
                    head = line.split(","); f.write(line + "\n"); f.flush(); continue
                parts = line.split(",")
                if head is None:                                   # joined after the header scrolled by
                    if len(parts) not in KNOWN_HEADERS: continue
                    head = KNOWN_HEADERS[len(parts)].split(","); f.write(KNOWN_HEADERS[len(parts)] + "\n")
                if len(parts) != len(head): continue               # half-received line
                f.write(line + "\n"); f.flush(); n += 1
                try:
                    v = dict(zip(head, [float(x) if x.lower() != "nan" else float("nan") for x in parts]))
                except ValueError:
                    continue
                if t0 is None: t0 = v["ms"]
                t = (v["ms"] - t0) / 1000.0
                ch = a.chan if a.chan in v else None
                if ch is None: print(line); continue
                dark = v["dark_a"] if ch.endswith("_a") else v["dark_b"]
                net = v[ch] - dark
                if len(base_vals) < 10: base_vals.append(net)
                base = statistics.median(base_vals) or 1.0
                y = net / base
                rows_ts.append(t); rows_y.append(y)
                flag = "  <-- baseline (clear water, lid on)" if n <= 10 else ""
                print(f"t={t:6.0f}s  {ch} net={net:8.1f}  curve={y*100:5.1f}%  dark_a={v['dark_a']:7.1f}{flag}")
                if a.plot and n % 2 == 0:
                    line_plot.set_data(rows_ts, rows_y); ax.set_xlim(0, max(60, t)); plt.pause(0.001)
        except KeyboardInterrupt:
            pass
    print(f"saved {n} samples to {path}")
    print("compare runs:  python3 tools/overlay.py runs/<run1>.csv runs/<run2>.csv --chan", a.chan)

if __name__ == "__main__":
    main()
