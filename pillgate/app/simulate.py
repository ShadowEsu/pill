"""
simulate.py - makes realistic fake runs (same CSV as the Arduino) so the app can be built and demoed
before the hardware is ready.  THESE ARE NOT MEASUREMENTS - label anything made with this as simulated.

  python simulate.py --out ../runs/sim_good.csv
  python simulate.py --dose 0.5 --out ../runs/sim_halfdose.csv
  python simulate.py --tau 200 --out ../runs/sim_slow.csv
  python simulate.py --cloud 0.8 --out ../runs/sim_cloudy.csv
  python simulate.py --standard 4 --out ../runs/std_4mgL.csv      (calibration standard: steady, no tablet)
"""
# Realistic routine: lid opens at 12 s, tablet drops ~2 s later, lid closed again by 22 s (10 s open).
import argparse, math, random

ADC = 4095.0
GAMMA = 0.7
HEADER = "ms,dark_a,dark_b,B_a,B_b,W_a,W_b,R_a,R_b,temp_c,stir"
# absorbance per (mg/L) of the coloured drug on each LED colour, for this cup  (riboflavin-like: blue >> white > red)
K = {"B": 0.045, "W": 0.018, "R": 0.002}
L_CLEAR = {"B": 1.9, "W": 2.6, "R": 1.4}        # light at the straight-through sensor in clear water (sensor units)
L_SIDE = {"B": 0.25, "W": 0.35, "R": 0.20}      # light at the 90-degree sensor in clear water


def adc(light):
    r = max(light, 1e-6) ** GAMMA
    return ADC * r / (1 + r)


def make(seconds=420, t_in=14, lid=(12, 22), conc_end=8.0, dose=1.0, tau=45.0, cloud=0.15,
         standard=None, noise=4.0, seed=1, ambient=0.06, white=False):
    """white=True: a white tablet (e.g. plain aspirin) - no colour, only cloudiness."""
    rnd = random.Random(seed)
    lines = ["# simulated run - NOT a measurement", HEADER]
    for s in range(seconds):
        lid_off = lid[0] <= s < lid[1] and standard is None
        amb_a = ambient * (8 if lid_off else 1)
        amb_b = ambient * 0.5 * (8 if lid_off else 1)
        if standard is not None:
            c, cl = standard, 0.0
        else:
            f = 0.0 if s < t_in else 1 - math.exp(-(s - t_in) / tau)
            c = conc_end * dose * f
            # cloud: rises as the tablet breaks up, then partly settles
            x = max(0.0, s - t_in)
            cl = cloud * (x / 30.0) * math.exp(1 - x / 30.0) * 0.7 + cloud * 0.3 * f
        row = [s * 1000 + 3406]
        da, db = adc(amb_a) + rnd.gauss(0, noise), adc(amb_b) + rnd.gauss(0, noise)
        row += [da, db]
        for col in "BWR":
            k = 0.0 if white else K[col]
            A = k * c + cl
            la = amb_a + L_CLEAR[col] * 10 ** (-A)
            lb = amb_b + L_SIDE[col] * (1 + 4 * cl) * 10 ** (-0.5 * k * c)
            row += [adc(la) + rnd.gauss(0, noise), adc(lb) + rnd.gauss(0, noise)]
        row += ["nan", 0]
        lines.append(",".join(f"{v:.2f}" if isinstance(v, float) else str(v) for v in row))
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--seconds", type=int, default=420)
    ap.add_argument("--dose", type=float, default=1.0, help="1.0 = full labelled dose")
    ap.add_argument("--tau", type=float, default=45.0, help="dissolution time constant, s (bigger = slower)")
    ap.add_argument("--cloud", type=float, default=0.15)
    ap.add_argument("--standard", type=float, default=None, help="make a steady calibration standard at this mg/L")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--white", action="store_true", help="white tablet (aspirin-like): cloudiness only, no colour")
    a = ap.parse_args()
    open(a.out, "w").write(make(seconds=a.seconds if a.standard is None else 60, dose=a.dose, tau=a.tau,
                                cloud=a.cloud, standard=a.standard, seed=a.seed, white=a.white))
    print("wrote", a.out)
