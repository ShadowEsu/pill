#!/usr/bin/env python3
"""OPTIONAL recorder for the Peel Arduino's CSV stream (laptop with pyserial).

  UNO Q NOTE: this is UNTESTED on the UNO Q. Its USB-C port is normally the programming link, and whether it
  also shows up as a plain serial port depends on the core version. EASY PATH (works everywhere): open the
  Arduino IDE Serial Monitor at 115200, let it run, Ctrl+A, Ctrl+C, paste into runs/<name>.csv, then use overlay.py
  (it understands pasted Serial Monitor text, timestamps and all). Use this script only if a port is found.

  pip install pyserial
  python3 capture.py --label ribo1_36C --cmd LBW --cmd K36.5     # auto-finds /dev/ttyACM0 or COMx; K = water temp you read on a thermometer
  python3 capture.py --label vitC_run1 --port /dev/ttyACM0 --minutes 10
Press Ctrl+C to stop. Output: runs/<label>_<timestamp>.csv  (header line + data lines, '#' comments dropped).
"""
import argparse, os, sys, time, glob

def find_port():
    import serial.tools.list_ports as lp
    for p in lp.comports():
        if p.vid in (0x2341, 0x2A03) or "Arduino" in (p.manufacturer or "") or "ACM" in p.device or "usbmodem" in p.device or "CH340" in (p.description or ""):
            return p.device
    ports = glob.glob("/dev/ttyACM*") + glob.glob("/dev/ttyUSB*")
    return ports[0] if ports else None

def keep(line):
    """True for the CSV header ('ms,...') and numeric data lines; False for '# comments' and 'live,' lines."""
    return bool(line) and (line.startswith("ms,") or line[0].isdigit())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port"); ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--label", default="run"); ap.add_argument("--minutes", type=float, default=0, help="0 = until Ctrl+C")
    ap.add_argument("--outdir", default="runs")
    ap.add_argument("--cmd", action="append", default=[], help="command sent after reset, e.g. --cmd LBW --cmd K36.5 (S<n> only if you built a stirrer)")
    a = ap.parse_args()
    import serial
    port = a.port or find_port()
    if not port: sys.exit("No Arduino found - pass --port")
    os.makedirs(a.outdir, exist_ok=True)
    path = os.path.join(a.outdir, f"{a.label}_{time.strftime('%Y%m%d_%H%M%S')}.csv")
    ser = serial.Serial(port, a.baud, timeout=1)
    time.sleep(2.2)                      # the UNO resets when the port opens
    ser.reset_input_buffer()
    for c in a.cmd: ser.write((c + "\n").encode()); time.sleep(0.1)
    ser.write(b"G1\n")                   # (re)start streaming and re-print the header
    t_end = time.time() + a.minutes*60 if a.minutes else None
    print(f"recording {port} -> {path}   (Ctrl+C to stop)")
    n = 0
    with open(path, "w") as f:
        try:
            while t_end is None or time.time() < t_end:
                line = ser.readline().decode(errors="ignore").strip()
                if keep(line):
                    f.write(line + "\n"); f.flush(); n += 1
                    if n % 10 == 0: print(line)
        except KeyboardInterrupt:
            pass
    ser.write(b"S0\n"); ser.close()          # harmless if there is no stirrer
    print(f"saved {n} lines to {path}")

if __name__ == "__main__":
    main()
