"""Draws the wiring / chamber pictures used in roadmap.md  (python3 make_diagrams.py)"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, FancyBboxPatch, Polygon, Wedge
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "diagrams")

C5V, CGND, CAN, CLED, CMOT, CPWR = "#d62728", "#222222", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e"
C33 = "#d98200"   # 3V3 rail (UNO Q)

def wire(ax, pts, color, lw=2.2, z=2):
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=color, lw=lw, solid_capstyle="round", solid_joinstyle="round", zorder=z)

def box(ax, x, y, w, h, label, fc="#fff8dc", ec="k", fs=9, lw=1.5, bold=False):
    ax.add_patch(Rectangle((x, y), w, h, fc=fc, ec=ec, lw=lw, zorder=3))
    ax.text(x + w/2, y + h/2, label, ha="center", va="center", fontsize=fs, zorder=4,
            fontweight="bold" if bold else "normal")

def netlabel(ax, x, y, text, color, ha="center"):
    ax.text(x, y, text, color=color, fontsize=10, fontweight="bold", ha=ha, va="center", zorder=5)

def gnd(ax, x, y):
    wire(ax, [(x, y), (x, y-2)], CGND)
    for i, w in enumerate([5, 3.2, 1.4]):
        wire(ax, [(x-w, y-2-i*1.3), (x+w, y-2-i*1.3)], CGND, lw=2)

def dot(ax, x, y, c="k"):
    ax.add_patch(Circle((x, y), 0.9, fc=c, ec=c, zorder=6))

# =============================================================== 2. breadboard
from matplotlib.path import Path as MPath
from matplotlib.patches import PathPatch

NCOL = 41
PX = 3.0
def X(c): return 8 + (c-1)*PX
ROWY = {"a": 52, "b": 49, "c": 46, "d": 43, "e": 40, "f": 33, "g": 30, "h": 27, "i": 24, "j": 21}
RAIL = {"T+": 60, "T-": 57, "B+": 15, "B-": 12}
def H(c, r): return (X(c), ROWY[r] if r in ROWY else RAIL[r])

def jumper(ax, p1, p2, color, bow=0.0, lw=3.2, z=7, ls="-"):
    (x1, y1), (x2, y2) = p1, p2
    mx, my = (x1+x2)/2 + bow, (y1+y2)/2
    path = MPath([(x1, y1), (mx, my), (x2, y2)], [MPath.MOVETO, MPath.CURVE3, MPath.CURVE3])
    ax.add_patch(PathPatch(path, fc="none", ec=color, lw=lw, zorder=z, capstyle="round", ls=ls))
    for (x, y) in (p1, p2):
        ax.add_patch(Circle((x, y), 0.75, fc=color, ec="k", lw=0.8, zorder=z+1))

def resistor(ax, c1, c2, row, label, fc="#e8cf9a"):
    x1, y = H(c1, row); x2, _ = H(c2, row)
    ax.plot([x1, x2], [y, y], color="#999", lw=2, zorder=5)
    w = (x2-x1) - 3.2
    ax.add_patch(FancyBboxPatch((x1+1.6, y-1.2), w, 2.4, boxstyle="round,pad=0.1,rounding_size=0.8", fc=fc, ec="k", lw=1.2, zorder=6))
    ax.text((x1+x2)/2, y, label, ha="center", va="center", fontsize=8, fontweight="bold", zorder=7)

def flag(ax, xy, text, color, up=True, dx=0, length=9, fs=9, ha="center"):
    x, y = xy
    y2 = y + length if up else y - length
    ax.plot([x, x+dx], [y, y2], color=color, lw=3.2, zorder=7, solid_capstyle="round")
    ax.text(x+dx, y2 + (1.2 if up else -1.2), text, ha=ha, va="bottom" if up else "top", fontsize=fs, fontweight="bold", color=color, zorder=8)

def leads(ax, p1, p2, text):
    xm = (p1[0]+p2[0])/2
    for p, dx in ((p1, -1.2), (p2, 1.2)):
        ax.plot([p[0], xm+dx], [p[1], 64], color="#e08a00", lw=3.2, zorder=7, solid_capstyle="round")
        ax.add_patch(Circle(p, 0.75, fc="#e08a00", ec="k", lw=0.8, zorder=8))
    ax.text(xm, 64.8, text, ha="center", va="bottom", fontsize=8, fontweight="bold", color="#b86e00", zorder=8)

# =============================================================== 3. chamber
def fig_chamber():
    cup_d, clear, wall, floor_t, well_h, beam_z = 62, 1.0, 3.0, 4.0, 74, 28
    Rw = (cup_d + 2*clear)/2; Ro = Rw + wall; body_h = floor_t + well_h; axis_z = floor_t + beam_z
    led_depth, cav, win = 26, 24, 16
    DARK, LIGHTY = "#3a3a3a", "#fff4b0"
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(20, 10.5), gridspec_kw={"width_ratios": [1.15, 1]})

    # ---------------- top view
    ax = a1; ax.set_aspect("equal"); ax.axis("off")
    ax.set_xlim(-72, 56); ax.set_ylim(-50, 52)
    ax.set_title("TOP VIEW  (cut through the beam, lid removed)", fontsize=14, fontweight="bold")
    ax.add_patch(Rectangle((-(Ro+led_depth), -15), led_depth+8, 30, fc=DARK, ec="k"))                 # LED pod
    ax.add_patch(Circle((0, 0), Ro, fc=DARK, ec="k"))
    for ang, ln in ((0, 14), (90, 14)):                                                                  # LDR bosses
        ax.add_patch(Rectangle((Ro-8, -7) if ang == 0 else (-7, Ro-8), 14 if ang == 0 else 14, 14, fc=DARK, ec="k") if False else
                     Rectangle((Ro-8, -7), 8+6, 14, fc=DARK, ec="k") if ang == 0 else Rectangle((-7, Ro-8), 14, 8+6, fc=DARK, ec="k"))
    ax.add_patch(Circle((0, 0), Rw, fc="white", ec="k"))                                                 # well
    ax.add_patch(Rectangle((-(Ro+led_depth-3), -cav/2), led_depth-5, cav, fc=LIGHTY, ec="k"))            # mixing cavity (x from -(Ro+23) to -(Ro+2))
    ax.add_patch(Rectangle((-(Ro+2), -win/2), (Ro+2)-(Rw-1), win, fc=LIGHTY, ec="k", lw=0.5))            # window
    ax.plot([-(Ro+1.0)]*2, [-13, 13], color="#c0392b", lw=3)                                              # diffuser
    ax.add_patch(Circle((0, 0), cup_d/2, fc="#eef6ff", ec="#7aa6d9", lw=2))                               # cup
    ax.add_patch(Circle((0, 0), cup_d/2-2, fc="#cfe6ff", ec="none"))                                      # water
    # LDR pockets
    ax.add_patch(Rectangle((Rw-1, -2.7), (Ro+6-3)-(Rw-1), 5.4, fc="white", ec="k"))
    ax.add_patch(Rectangle((-2.7, Rw-1), 5.4, (Ro+6-3)-(Rw-1), fc="white", ec="k"))
    ax.add_patch(Rectangle((Ro+6-4.5, -2.4), 2.5, 4.8, fc="#e08a00", ec="k"))
    ax.add_patch(Rectangle((-2.4, Ro+6-4.5), 4.8, 2.5, fc="#e08a00", ec="k"))
    # LEDs at back
    cols = {(0, 0): "#2f6bff", (8, 0): "#f4f4f4", (-8, 0): "#2ecc40", (0, 8): "#ff3b30", (0, -8): "#8e44ad"}
    # beam (transmitted)
    ax.add_patch(Polygon([(-(Ro+1.5), -8), (-(Ro+1.5), 8), (Ro+2, 3), (Ro+2, -3)], fc="#ffd400", alpha=0.35, ec="none", zorder=5))
    ax.annotate("", xy=(0, Rw-1), xytext=(-12, 0), arrowprops=dict(arrowstyle="->", color="#c07000", lw=2.2, ls="--"), zorder=7)
    # tablet
    ax.add_patch(Circle((-6, -6), 3.2, fc="#f7c948", ec="#8a6d00", lw=1.5, zorder=8))
    # labels
    def lab(txt, xy, xyt, color="k", fs=10.5, ha="center"):
        ax.annotate(txt, xy=xy, xytext=xyt, fontsize=fs, ha=ha, va="center", color=color, fontweight="bold",
                    arrowprops=dict(arrowstyle="-", color=color, lw=1.2), zorder=10)
    lab("LED pod: 5 LEDs on the back wall\n(blue centre; white, green, red, IR around)", (-(Ro+25), 8), (-48, 40))
    lab("white MIXING CAVITY\n(line with white paper / foil)", (-(Ro+12), 8), (-34, 28), "#7a6a00")
    lab("diffuser slot\n(frosted plate slides in\nfrom the top)", (-(Ro+1), -13), (-60, -30), "#c0392b")
    lab("window", (-(Ro-2), -7), (-33, -24))
    lab("clear cup + water", (-20, -27), (-22, -43), "#2a6db0")
    lab("tablet", (-6, -6), (8, -43), "#8a6d00")
    lab("LDR A  (TRANSMITTED light)\nstraight across the cup", (Ro+2, 0), (46, 12), "#b86e00")
    lab("LDR B  (SCATTERED light)\n90 deg to the beam", (0, Ro+3), (32, 46), "#b86e00")
    lab("black wall 3 mm\n(dark = no room light)", (Ro*0.72, -Ro*0.72), (34, -40), "k")
    ax.text(-72, -48, "yellow = light path   |   everything outside the cup is black or white-lined, nothing shiny near the sensors", fontsize=9.5, color="#444")
    ax.text(-13, 14, "scattered\nlight", fontsize=9, color="#c07000", rotation=62, ha="center", va="center")

    # ---------------- side view
    ax = a2; ax.set_aspect("equal"); ax.axis("off")
    ax.set_xlim(-76, 66); ax.set_ylim(-6, 112)
    ax.set_title("SIDE VIEW  (cut through the beam)\\nshown with the optional DC-motor lid; LEAN build = plain flat lid, no motor / rod / paddle", fontsize=13, fontweight="bold")
    # body walls
    for sgn in (-1, 1):
        ax.add_patch(Rectangle((sgn*Rw if sgn > 0 else -Ro, 0), wall, body_h, fc=DARK, ec="k"))
    ax.add_patch(Rectangle((-Ro, 0), 2*Ro, floor_t, fc=DARK, ec="k"))
    # LED pod on left
    ax.add_patch(Rectangle((-(Ro+led_depth), axis_z-15), led_depth+0.5, 30, fc=DARK, ec="k"))
    ax.add_patch(Rectangle((-(Ro+led_depth-3), axis_z-cav/2), led_depth-5, cav, fc=LIGHTY, ec="k"))
    ax.add_patch(Rectangle((-(Ro+2), axis_z-win/2), (Ro+2)-(Rw-1), win, fc=LIGHTY, ec="k", lw=0.5))
    ax.plot([-(Ro+1.0)]*2, [axis_z-11, axis_z+15], color="#c0392b", lw=3)
    # LDR boss right
    ax.add_patch(Rectangle((Ro-0.5, axis_z-7), 6.5, 14, fc=DARK, ec="k"))
    ax.add_patch(Rectangle((Rw-1, axis_z-2.7), (Ro+6-3)-(Rw-1), 5.4, fc="white", ec="k"))
    ax.add_patch(Rectangle((Ro+6-4.5, axis_z-2.4), 2.5, 4.8, fc="#e08a00", ec="k"))
    # cup + water
    cup_h = 70; wl = floor_t + 2 + 40
    ax.add_patch(Rectangle((-cup_d/2, floor_t), cup_d, wl-floor_t, fc="#cfe6ff", ec="none"))
    ax.plot([-cup_d/2, -cup_d/2, cup_d/2, cup_d/2], [floor_t+cup_h, floor_t, floor_t, floor_t+cup_h], color="#7aa6d9", lw=2.5)
    ax.plot([-cup_d/2+1, cup_d/2-1], [wl, wl], color="#2a6db0", lw=1.2, ls="--")
    # beam
    ax.add_patch(Polygon([(-(Ro+1.5), axis_z-8), (-(Ro+1.5), axis_z+8), (Ro+2, axis_z+3), (Ro+2, axis_z-3)], fc="#ffd400", alpha=0.35, ec="none", zorder=5))
    # lid
    lid_z0 = body_h - 8
    ax.add_patch(Rectangle((-(Ro+0.5+2.4), lid_z0), 2.4, 8, fc="#555", ec="k"))   # skirt L
    ax.add_patch(Rectangle((Ro+0.5, lid_z0), 2.4, 8, fc="#555", ec="k"))          # skirt R
    ax.add_patch(Rectangle((-(Ro+2.9), body_h), 2*(Ro+2.9), 3, fc="#555", ec="k")) # plate
    ax.add_patch(Rectangle((-(Rw-0.6), lid_z0), 2*(Rw-0.6), 8, fc="#555", ec="k")) # plug
    tw, tl_top = motor_w_ = 19.8, body_h+3+20
    ax.add_patch(Rectangle((-tw/2, body_h+3), tw, 20, fc="#555", ec="k"))        # tower
    ax.add_patch(Rectangle((-7.9, lid_z0+2), 15.8, 25.5, fc="#ffd9a0", ec="k", zorder=6))  # motor
    ax.text(0, lid_z0+15, "DC\nmotor", ha="center", va="center", fontsize=9, fontweight="bold", zorder=7)
    # shaft + coupler + rod + paddle
    ax.add_patch(Rectangle((-4.5, lid_z0-14.5), 9, 14, fc="#9ec5ff", ec="k", zorder=6))
    rod_top = lid_z0-14.5+8; rod_bot = floor_t+2+5+8
    ax.plot([0, 0], [rod_bot, rod_top], color="#8b5a2b", lw=3.5, zorder=6)
    ax.add_patch(Rectangle((-4.5, floor_t+7), 9, 10, fc="#9ec5ff", ec="k", zorder=6))
    ax.add_patch(Rectangle((-18, floor_t+7), 36, 1.6, fc="#9ec5ff", ec="k", zorder=6))
    ax.add_patch(Rectangle((-18, floor_t+7), 36, 10, fc="none", ec="#4a79b8", lw=1, ls=":", zorder=6))
    # labels
    def lab(txt, xy, xyt, color="k", fs=10, ha="center"):
        ax.annotate(txt, xy=xy, xytext=xyt, fontsize=fs, ha=ha, va="center", color=color, fontweight="bold",
                    arrowprops=dict(arrowstyle="-", color=color, lw=1.2), zorder=10)
    lab("lid: skirt + plug = light trap", (-(Ro+1), lid_z0+4), (-60, 98), "#444")
    lab("motor tower (tape the top)", (-10, body_h+18), (-48, 108), "#444")
    lab("coupler (3D-printed)", (-4.5, lid_z0-8), (-50, 56), "#2a6db0")
    lab("stir rod: skewer / dowel\n(~45 mm)", (0, 50), (-50, 66), "#8b5a2b")
    lab("paddle (printed)\nspins BELOW the beam", (-16, floor_t+10), (-52, 14), "#2a6db0")
    lab("water level:\ncover the beam by 10+ mm", (cup_d/2-1, wl), (50, 66), "#2a6db0")
    lab("beam height 28 mm\nabove well floor", (Ro+10, axis_z), (52, 36), "#b86e00")
    lab("LDR A", (Ro+4, axis_z+3), (52, 26), "#b86e00")
    lab("LED pod\n+ diffuser", (-(Ro+14), axis_z+14), (-56, 82), "#c0392b")
    ax.text(-76, -4, "thermistor: tape it to the OUTSIDE of the cup (easy) or dangle it through the 3.6 mm lid hole, bead sealed with heat-shrink", fontsize=9, color="#444")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "03_chamber_cross_sections.png"), dpi=105, bbox_inches="tight", facecolor="white")
    plt.close(fig)

# =============================================================== LEAN build pictures
def fig_overview_lean():
    fig, ax = plt.subplots(figsize=(17, 11.5))
    ax.set_xlim(0, 176); ax.set_ylim(-2, 128); ax.axis("off")
    ax.text(88, 124, "Peel tester  -  LEAN build wiring (Arduino UNO Q)", ha="center", fontsize=17, fontweight="bold")
    ax.text(88, 119.5, "3.3 V logic board:  LDR dividers use the 3V3 pin ONLY (A0-A5 die at 5 V).  The 5V pin feeds ONLY the LED resistor.   No thermistor | no IR LED | no motor driver.",
            ha="center", fontsize=10.2, color="#444")
    ax.add_patch(FancyBboxPatch((72, 4), 38, 108, boxstyle="round,pad=0.5,rounding_size=2", fc="#cfe8ff", ec="#0b4f8a", lw=2.5, zorder=3))
    ax.text(91, 106, "ARDUINO UNO Q", ha="center", fontsize=13, fontweight="bold", zorder=5, color="#0b4f8a")
    ax.text(91, 101.5, "(USB-C -> laptop)", ha="center", fontsize=9.5, zorder=5, color="#0b4f8a")
    YA0, YA1, YA2 = 94, 50, 20
    left = {"A0": YA0, "A1": YA1, "A2": YA2, "3V3": 72, "5V": 62, "GND": 34}
    for n, y in left.items():
        ax.text(74, y, n, fontsize=11, fontweight="bold", va="center", zorder=5); dot(ax, 72, y)
    right = {"D5": 76, "D6": 66, "D7": 56, "D8": 46, "D9": 36, "D11": 26, "D12": 20, "D13": 14}
    for n, y in right.items():
        ax.text(108, y, n, fontsize=11, fontweight="bold", va="center", ha="right", zorder=5); dot(ax, 110, y)
    X0 = 40
    def divider(yn, name, sub):
        wire(ax, [(X0, yn+14), (X0, yn+11)], C33); netlabel(ax, X0, yn+16.3, "3V3", C33)
        box(ax, X0-6, yn+4, 12, 7, "LDR", fc="#ffe0b2", fs=10, bold=True)
        wire(ax, [(X0, yn+4), (X0, yn-4)], CAN)
        box(ax, X0-6, yn-11, 12, 7, "10 k", fc="#e8e8e8", fs=10, bold=True)
        wire(ax, [(X0, yn-11), (X0, yn-14)], CGND); gnd(ax, X0, yn-14)
        wire(ax, [(X0, yn), (72, yn)], CAN); dot(ax, X0, yn)
        ax.text(X0-9, yn+7.5, name, ha="right", va="center", fontsize=10.5, fontweight="bold")
        ax.text(X0-9, yn+1.5, sub, ha="right", va="center", fontsize=8.6, color="#444")
    divider(YA0, "LDR A", "transmitted light\n(opposite the LEDs)")
    divider(YA1, "LDR B", "scattered light\n(90 deg to the beam)")
    wire(ax, [(72, YA2), (50, YA2)], CGND); gnd(ax, 50, YA2)
    ax.text(48, YA2+1, "A2 jumpered to GND\n(no thermistor, parks the pin)", ha="right", va="center", fontsize=9, color="#444")
    wire(ax, [(72, 72), (62, 72)], C33); netlabel(ax, 56, 72, "3V3 rail", C33)
    wire(ax, [(72, 62), (62, 62)], C5V); netlabel(ax, 56, 62, "5V rail", C5V); ax.text(56, 58.6, "LED supply only", ha="center", fontsize=8, color="#666")
    wire(ax, [(72, 34), (62, 34)], CGND); netlabel(ax, 56, 34, "GND rail", CGND)
    names = [("D5", 76, "#2f6bff", "BLUE (centre)"), ("D6", 66, "#f4f4f4", "WHITE"), ("D7", 56, "#2ecc40", "GREEN (extra)"), ("D8", 46, "#ff3b30", "RED (extra)")]
    for pin, y, col, nm in names:
        wire(ax, [(110, y), (126, y)], CLED)
        # ACTIVE-LOW: current flows 5V -> resistor -> LED anode (right) -> cathode bar (left) -> pin
        ax.add_patch(Polygon([(132, y+2.8), (132, y-2.8), (126, y)], fc=col, ec="k", lw=1.5, zorder=4))
        wire(ax, [(126, y+2.8), (126, y-2.8)], "k", lw=2.5, z=4)
        wire(ax, [(132, y), (146, y)], CLED)
        ax.text(134, y+1.1, nm, fontsize=8, ha="left", va="bottom"); dot(ax, 146, y)
    wire(ax, [(146, 76), (146, 46)], CLED)     # common anode bus
    wire(ax, [(146, 76), (146, 80)], CLED)
    box(ax, 142, 80, 8, 9, "330", fc="#e8e8e8", fs=9.5, bold=True)
    wire(ax, [(146, 89), (146, 92)], C5V); netlabel(ax, 146, 94, "5V pin", C5V)
    ax.text(153, 84.5, "ONE shared 330 ohm\nfrom the Arduino 5V pin\n(only one LED lit at a time)", fontsize=9, va="center")
    ax.text(153, 62, "All LEDs sit in the LED pod.\nLONG legs (anode) twisted\ntogether -> the 330 ohm.\nSHORT legs (cathode) -> D5-D8.\nPin LOW = LED ON.", fontsize=9, color="#444", va="center")
    ax.add_patch(FancyBboxPatch((113, 98), 58, 17, boxstyle="round,pad=0.4,rounding_size=1.5", fc="#fff8dc", ec="#b8a000", lw=1.5, zorder=3))
    ax.text(142, 106.5, "STIRRER: none in this build.\nDrop the tablet, swirl the cup by hand (same way every run),\nlid on. Pins D2, D3, D4, D10 stay free.\nWant a motor? see 04_optional_stirrer_wiring.png", ha="center", va="center", fontsize=9.3, zorder=5)
    ax.text(142, 7, "D11/D12/D13 = optional status RGB LED (roadmap)", ha="center", fontsize=8.3, color="#666")
    for i, (c, t) in enumerate([(C33, "3V3 (sensors)"), (C5V, "5V (LED supply only)"), (CGND, "GND"), (CAN, "analog signal"), (CLED, "LED wires")]):
        ax.plot([4 + i*34, 10 + i*34], [-0.5, -0.5], color=c, lw=3); ax.text(11.5 + i*34, -0.5, t, fontsize=9, va="center")
    fig.savefig(os.path.join(OUT, "01_wiring_overview.png"), dpi=110, bbox_inches="tight", facecolor="white")
    plt.close(fig)

def fig_breadboard_lean():
    nc = 24
    fig, ax = plt.subplots(figsize=(15, 9.5))
    ax.set_xlim(-8, X(nc)+26); ax.set_ylim(-6, 84); ax.axis("off")
    ax.text((X(nc)-8)/2+4, 81.5, "LEAN build breadboard for the UNO Q  (half-size 400-point board is plenty)", ha="center", fontsize=15, fontweight="bold")
    ax.add_patch(Rectangle((X(1)-5, 9.5), X(nc)-X(1)+10, 53.5, fc="#f3efe6", ec="#8a8372", lw=2, zorder=1))
    ax.add_patch(Rectangle((X(1)-3, 35), X(nc)-X(1)+6, 3, fc="#d8d2c2", ec="none", zorder=2))
    for k, col in (("T+", C33), ("T-", "#1f4fd8"), ("B+", C5V), ("B-", "#bbbbbb")):
        y = RAIL[k]
        ax.plot([X(1)-2, X(nc)+2], [y+1.5, y+1.5], color=col, lw=1.5, zorder=2)
        for c in range(1, nc+1):
            if c % 6 == 0: continue
            ax.add_patch(Circle((X(c), y), 0.45, fc="#555", zorder=3))
    ax.text(X(1)-6.2, RAIL["T+"], "+ 3V3", ha="right", va="center", color=C33, fontsize=10, fontweight="bold")
    ax.text(X(1)-6.2, RAIL["T-"], "- GND", ha="right", va="center", color="#1f4fd8", fontsize=10, fontweight="bold")
    ax.text(X(1)-6.2, RAIL["B+"], "+ 5V\n(LEDs only)", ha="right", va="center", color=C5V, fontsize=9, fontweight="bold")
    ax.text(X(1)-6.2, RAIL["B-"], "(unused)", ha="right", va="center", color="#888", fontsize=8)
    for c in range(1, nc+1):
        for r, y in ROWY.items():
            ax.add_patch(Circle((X(c), y), 0.45, fc="#555", zorder=3))
        if c % 5 == 0: ax.text(X(c), 54.3, str(c), ha="center", fontsize=7, color="#777")
    for r, y in ROWY.items(): ax.text(X(1)-3.2, y, r, ha="center", va="center", fontsize=8, color="#777")
    G = "#111"
    flag(ax, H(1, "T+"), "from Arduino 3V3", C33, up=True, length=9, fs=9.5, ha="right")
    wire(ax, [H(23, "B+"), (X(23)+11, RAIL["B+"])], C5V, lw=3.2, z=7)
    ax.text(X(23)+12, RAIL["B+"], "from Arduino\n5V pin", ha="left", va="center", fontsize=9.5, fontweight="bold", color=C5V)
    flag(ax, H(2, "T-"), "from Arduino GND", G, up=True, length=19, fs=9.5)
    def ldr_block(c0, name, an):
        c1, c2, c3 = c0, c0+2, c0+4
        jumper(ax, H(c1, "T+"), H(c1, "c"), C33, bow=-1.2)
        leads(ax, H(c1, "a"), H(c2, "a"), f"{name}\n(2 wires to chamber)")
        jumper(ax, H(c2, "c"), (X(c2)+4.5, 74), CAN, bow=5.0)
        ax.text(X(c2)+4.5, 75.2, f"to Arduino {an}", ha="center", fontsize=8.8, fontweight="bold", color=CAN)
        resistor(ax, c2, c3, "e", "10k")
        jumper(ax, H(c3, "c"), H(c3, "T-"), G, bow=1.2)
    ldr_block(3, "LDR A", "A0")
    ldr_block(10, "LDR B", "A1")
    flag(ax, H(17, "a"), "LED ANODES\n(LONG legs twisted\ntogether)", CLED, dx=0, length=17, fs=8)
    resistor(ax, 17, 19, "e", "330")
    jumper(ax, H(19, "d"), H(19, "B+"), C5V, bow=4.5)
    ax.text(X(8.5), 32, "NOT on the breadboard:\n- each LED's SHORT leg -> an Arduino pin:\n   D5 blue, D6 white, D7 green, D8 red\n- Arduino A2 -> one jumper wire to GND\n- the LDRs and LEDs live in the chamber\nRed jumper = 330 ohm -> BOTTOM rail (5V).\nEverything else uses the TOP rails.",
            ha="center", va="top", fontsize=9, color="#333", bbox=dict(fc="#fffbe6", ec="#b8a000", pad=4), zorder=9)
    ax.text(X(1)+2, 4.5, "Resistor stripes: 10 kOhm = brown-black-orange.  330 ohm = orange-orange-brown.  LDRs and resistors have no polarity.", fontsize=9.5, color="#222")
    ax.text(X(1)+2, 0.5, "Column numbers match the step-by-step text in roadmap.md.", fontsize=9.5, color="#222")
    fig.savefig(os.path.join(OUT, "02_breadboard_layout.png"), dpi=110, bbox_inches="tight", facecolor="white")
    plt.close(fig)

def fig_stirrer_options():
    fig, axs = plt.subplots(1, 3, figsize=(22, 9))
    for a in axs: a.set_xlim(0, 100); a.set_ylim(0, 110); a.axis("off"); a.set_aspect("equal")
    # --- A: L293D
    a = axs[0]; a.set_title("A. DC motor + L293D chip\n(firmware: STIRRER = STIR_L293D)", fontsize=13, fontweight="bold")
    a.add_patch(Rectangle((38, 30), 26, 52, fc="#222", ec="k", lw=2))
    a.text(51, 76, "L293D", color="white", ha="center", fontsize=12, fontweight="bold")
    for y, lab, src, col in ((66, "1 EN", "Arduino D3 (PWM)", CMOT), (56, "2 1A", "Arduino D2", CMOT), (46, "7 2A", "Arduino D4", CMOT)):
        a.plot([14, 38], [y, y], color=col, lw=2.5); a.text(40, y, lab, color="white", fontsize=9, va="center"); a.text(12, y, src, ha="right", va="center", fontsize=9, color=col, fontweight="bold")
    a.plot([44, 44], [82, 94], color=C5V, lw=2.5); a.text(40, 96, "pin 16 -> 5V", ha="center", color=C5V, fontweight="bold", fontsize=9)
    a.plot([60, 60], [82, 94], color=CPWR, lw=2.5); a.text(68, 98, "pin 8 -> battery +\n(4xAA 6V)", ha="center", color=CPWR, fontweight="bold", fontsize=9)
    a.plot([51, 51], [30, 22], color=CGND, lw=2.5); a.text(51, 18, "pins 4,5,12,13,9 -> GND", ha="center", fontsize=9, fontweight="bold")
    a.plot([64, 80, 80], [66, 66, 60], color=CMOT, lw=2.5); a.plot([64, 80, 80], [46, 46, 52], color=CMOT, lw=2.5)
    a.text(66, 68, "pin 3", fontsize=8.5); a.text(66, 43, "pin 6", fontsize=8.5)
    a.add_patch(Circle((80, 56), 5, fc="#ffd9a0", ec="k", lw=1.8)); a.text(80, 56, "M", ha="center", va="center", fontsize=12, fontweight="bold")
    a.text(50, 8, "battery - ALSO to Arduino GND (common ground)\n100 uF across the battery rails is wise", ha="center", fontsize=9, color="#444")
    # --- B: NPN transistor
    a = axs[1]; a.set_title("B. DC motor + ONE NPN transistor\n(firmware: STIRRER = STIR_NPN)", fontsize=13, fontweight="bold")
    a.plot([12, 30], [50, 50], color=CMOT, lw=2.5); a.text(10, 50, "Arduino D3", ha="right", va="center", fontsize=9.5, color=CMOT, fontweight="bold")
    a.add_patch(Rectangle((30, 46), 14, 8, fc="#e8e8e8", ec="k", lw=1.5)); a.text(37, 50, "1 k", ha="center", va="center", fontsize=9.5, fontweight="bold")
    a.plot([44, 54], [50, 50], color=CMOT, lw=2.5)
    a.add_patch(Circle((62, 50), 10, fc="white", ec="k", lw=2)); a.plot([56, 56], [43, 57], color="k", lw=3)
    a.plot([56, 66], [53, 60], color="k", lw=2); a.plot([56, 66], [47, 40], color="k", lw=2)
    a.text(51, 53, "B", fontsize=9); a.text(68, 61, "C", fontsize=9); a.text(68, 38, "E", fontsize=9)
    a.plot([66, 66, 66], [60, 70, 76], color=CMOT, lw=2.5)
    a.add_patch(Circle((66, 84), 7, fc="#ffd9a0", ec="k", lw=1.8)); a.text(66, 84, "M", ha="center", va="center", fontsize=12, fontweight="bold")
    a.plot([66, 66], [76, 77], color=CMOT, lw=2.5)
    a.plot([66, 66, 52, 52], [91, 96, 96, 96], color=CPWR, lw=2.5); a.text(50, 96, "battery +", ha="right", va="center", fontsize=9.5, color=CPWR, fontweight="bold")
    a.plot([74, 80, 80, 66], [84, 84, 70, 70], color="#888", lw=1.5, ls="--")
    a.text(82, 77, "flyback diode: your 1N400x\nacross the motor, stripe (band)\ntoward battery +", fontsize=8.8, color="#444")
    a.plot([66, 66], [40, 30], color=CGND, lw=2.5); gnd(a, 66, 30)
    a.text(50, 12, "battery - ALSO to Arduino GND (common ground)\nAny small NPN works (2N2222 / PN2222 / S8050), but the E-B-C leg order\ndiffers by part - check YOUR datasheet before powering", ha="center", fontsize=9, color="#444")
    # --- C: stepper
    a = axs[2]; a.set_title("C. 28BYJ-48 stepper + ULN2003 board\n(firmware: STIRRER = STIR_ULN2003)", fontsize=13, fontweight="bold")
    a.add_patch(Rectangle((40, 28), 28, 58, fc="#1f8a4c", ec="k", lw=2)); a.text(54, 78, "ULN2003\nboard", color="white", ha="center", fontsize=11, fontweight="bold")
    for y, lab, src in ((70, "IN1", "Arduino D2"), (62, "IN2", "Arduino D3"), (54, "IN3", "Arduino D4"), (46, "IN4", "Arduino D10")):
        a.plot([16, 40], [y, y], color=CMOT, lw=2.5); a.text(42, y, lab, color="white", fontsize=9.5, va="center", fontweight="bold"); a.text(14, y, src, ha="right", va="center", fontsize=9.5, color=CMOT, fontweight="bold")
    a.plot([16, 40], [38, 38], color=C5V, lw=2.5); a.text(14, 38, "Arduino 5V", ha="right", va="center", fontsize=9.5, color=C5V, fontweight="bold"); a.text(42, 38, "+", color="white", fontsize=11, va="center", fontweight="bold")
    a.plot([16, 40], [32, 32], color=CGND, lw=2.5); a.text(14, 32, "Arduino GND", ha="right", va="center", fontsize=9.5, fontweight="bold"); a.text(42, 32, "-", color="white", fontsize=12, va="center", fontweight="bold")
    a.add_patch(Rectangle((68, 52), 8, 14, fc="white", ec="k", lw=1.5)); a.text(80, 59, "5-pin white\nplug: motor\nclips in here", fontsize=8.8, va="center")
    a.text(50, 14, "Stepper = slow (~10-15 rpm) but strong: a GENTLE swirl at best.\nPower from the Arduino 5V is OK for a test; if readings get noisy,\nuse a USB power bank for the board. Remember: no driver = no motor.", ha="center", fontsize=9, color="#444")
    fig.suptitle("OPTIONAL stirrers - the lean build needs none of these (swirl the cup by hand)", fontsize=15, fontweight="bold", y=1.0)
    fig.text(0.5, 0.955, "UNO Q: its 3.3 V output pins can drive all three (L293D, transistor base, ULN2003 inputs). Power the motor parts from the 5V pin or a battery - NEVER from 3V3.",
             ha="center", fontsize=11, color="#444")
    fig.savefig(os.path.join(OUT, "04_optional_stirrer_wiring.png"), dpi=105, bbox_inches="tight", facecolor="white")
    plt.close(fig)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    fig_overview_lean(); fig_breadboard_lean()
    fig_chamber()
    print("ok")
