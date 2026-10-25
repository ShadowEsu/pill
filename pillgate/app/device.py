"""device.py - reads the Arduino's CSV stream in the background (serial port, or a replayed file for demos).

Sources, in order:
  SERIAL_PORT=COM5 (or /dev/ttyACM0)   -> that port
  REPLAY_FILE=runs/x.csv               -> replays a recorded / simulated run at 1 line per second (label it as replay!)
  otherwise                            -> tries to auto-find an Arduino port; if none, status = "no device"
"""
import os, threading, time, glob

KNOWN = {9: "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,temp_c,stir",
         11: "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir"}


def _clean(line):
    line = line.strip()
    if "->" in line[:20]:
        line = line.split("->", 1)[1].strip()
    return line


def looks_like_arduino(p):
    """Arduino boards use USB vendor id 0x2341 (your UNO Q shows VID:PID=2341:0078). Skip Bluetooth ports."""
    hw = (getattr(p, "hwid", "") or "").upper()
    if "BTHENUM" in hw or "BLUETOOTH" in (p.description or "").upper():
        return False
    if getattr(p, "vid", None) in (0x2341, 0x2A03) or "VID:PID=2341" in hw:
        return True
    txt = ((p.manufacturer or "") + (p.description or "")).lower()
    return "arduino" in txt or "ACM" in p.device or "usbmodem" in p.device


class Device:
    def __init__(self, port=None, replay=None, baud=115200, replay_speed=1.0):
        self.port, self.replay, self.baud, self.speed = port, replay, baud, replay_speed
        self.mode = "starting"
        self.header = None
        self.lines = []            # every data line since the server started (CSV text)
        self.last = None
        self.error = None
        self.rec_start = None      # index into self.lines where the current recording started
        self.markers = {}          # e.g. {"tablet_in": index}
        self.run_mode = "quick"    # "quick" (fixed 60 s) or "full" (2-10 min, stops on plateau)
        self._stop = False
        threading.Thread(target=self._run, daemon=True).start()

    # ------------------------------------------------------------------ sources
    def _auto_port(self):
        try:
            import serial.tools.list_ports as lp
            ports = list(lp.comports())
        except Exception:
            return None
        for p in ports:
            if looks_like_arduino(p):
                return p.device
        usb = [p for p in ports if "USB" in (getattr(p, "hwid", "") or "").upper() and "BTHENUM" not in (p.hwid or "").upper()]
        return usb[0].device if len(usb) == 1 else None          # exactly one plain USB serial port -> use it

    def _serial_lines(self, port):
        import serial
        ser = serial.Serial(port, self.baud, timeout=1)
        time.sleep(2.0)
        ser.reset_input_buffer()
        self.mode = f"serial {port}"
        while not self._stop:
            yield ser.readline().decode(errors="ignore")

    def _replay_lines(self, path):
        self.mode = f"replay {os.path.basename(path)}"
        while not self._stop:
            for line in open(path, errors="replace"):
                line = _clean(line)
                yield line
                if line[:1].isdigit():
                    time.sleep(1.0 / self.speed)

    def _run(self):
        while not self._stop:
            try:
                if self.port:
                    src = self._serial_lines(self.port)
                elif self.replay:
                    src = self._replay_lines(self.replay)
                else:
                    p = self._auto_port()
                    if not p:
                        self.mode = "no device"
                        time.sleep(3)
                        continue
                    src = self._serial_lines(p)
                ms_offset, last_ms = 0, None
                for raw in src:
                    line = _clean(raw)
                    if not line or line.startswith("#") or line.startswith("live,"):
                        continue
                    if line.startswith("ms,"):
                        self.header = line
                        continue
                    if not line[0].isdigit():
                        continue
                    parts = line.split(",")
                    if self.header is None and len(parts) in KNOWN:
                        self.header = KNOWN[len(parts)]
                    if self.header is None or len(parts) != len(self.header.split(",")):
                        continue
                    # keep time increasing when a replay loops / the board resets
                    ms = float(parts[0])
                    if last_ms is not None and ms + ms_offset <= last_ms:
                        ms_offset = last_ms + 1000 - ms
                    last_ms = ms + ms_offset
                    parts[0] = str(int(last_ms))
                    line = ",".join(parts)
                    self.lines.append(line)
                    self.last = time.time()
                    self.error = None
            except Exception as e:                         # unplugged, port busy, ...
                self.error = str(e)
                self.mode = "error"
                time.sleep(2)

    # ------------------------------------------------------------------ recording
    def status(self):
        return {"mode": self.mode, "error": self.error, "lines": len(self.lines),
                "recording": self.rec_start is not None,
                "seconds_since_last": None if self.last is None else round(time.time() - self.last, 1),
                "header": self.header}

    def start(self, mode="quick"):
        self.run_mode = mode if mode in ("quick", "full") else "quick"
        self.rec_start = len(self.lines)
        self.markers = {}

    def mark(self, name):
        if self.rec_start is not None:
            self.markers[name] = len(self.lines) - self.rec_start

    def recording_csv(self):
        if self.rec_start is None or not self.header:
            return None
        return self.header + "\n" + "\n".join(self.lines[self.rec_start:]) + "\n"

    def stop(self):
        csv = self.recording_csv()
        markers = dict(self.markers)
        self.rec_start = None
        return csv, markers
