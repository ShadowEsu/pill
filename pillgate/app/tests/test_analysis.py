"""Run:  python -m pytest -q tests      (uses simulated runs - no hardware or internet needed)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import analysis as A, simulate as S, evidence as E

PROF = {"label_mg": 1.2, "volume_ml": 150, "analyte_color": "B", "reference_color": "R", "expect_color": True, "t80_max_s": 240}
PROF["calibration"] = A.build_calibration([(c, A.parse_csv(S.make(standard=c, seconds=60, seed=10 + i)))
                                           for i, c in enumerate([0, 2, 4, 8, 12])], profile=PROF)

def res(**kw):
    return A.analyze(A.parse_csv(S.make(seed=3, **kw)), PROF)["result"]

def test_good_passes():        assert res() == "PASSED_SCREEN"
def test_half_dose_needs_lab(): assert res(dose=0.5) == "NEEDS_LAB"
def test_nothing_needs_lab():  assert res(dose=0.0) == "NEEDS_LAB"
def test_cloudy_unable():      assert res(cloud=2.0) == "UNABLE_TO_VERIFY"
def test_short_unable():       assert res(seconds=60) == "UNABLE_TO_VERIFY"
def test_no_profile_unable():  assert A.analyze(A.parse_csv(S.make()), None)["result"] == "UNABLE_TO_VERIFY"

def test_pasted_serial_monitor_text():
    txt = "\n".join("12:00:00.000 -> " + l for l in S.make(seed=4).splitlines())
    assert len(A.parse_csv(txt)) == 420

def test_guardrail_adds_missed_recall():
    scan = {"analysis": {"result": "PASSED_SCREEN", "reasons": [], "numbers": {}, "quantity": None},
            "label": {"drug_name": "X", "lot": "L1"}, "overall": "NEEDS_LAB", "recall_status": "LOT_RECALLED",
            "evidence": {"recalls": [{"recall_number": "D-1", "classification": "Class II", "status": "Ongoing", "lot_match": True, "url": "u"}]}}
    out = E.guardrail({"headline": "X is genuine", "plain_summary": "fine", "what_to_do": "keep"}, scan, E.build_sources(scan))
    assert "recall" in out["plain_summary"].lower() and "genuine" not in out["headline"].lower()

def test_pii_scrub():
    assert "445566" not in E.scrub({"lot": "AB12 Rx# 445566"}, E.LABEL_FIELDS)["lot"]

import guide as G

def test_water_check_and_autostop():
    run = A.parse_csv(S.make(seconds=480, t_in=55, lid=(40, 55), seed=5))
    first = A.Run(t=run.t[:30], cols={k: v[:30] for k, v in run.cols.items()}, adc_max=run.adc_max)
    assert G.water_check(first)["ok"]                       # steady clean water passes
    lidopen = A.Run(t=run.t[:48], cols={k: v[:48] for k, v in run.cols.items()}, adc_max=run.adc_max)
    assert not G.water_check(lidopen)["ok"]                 # lid open / moving -> not ok
    early = A.analyze(A.Run(t=run.t[:100], cols={k: v[:100] for k, v in run.cols.items()}, adc_max=run.adc_max), None, {"drop_index": 56})
    assert not G.dissolve_progress(early)["stop"]           # too early to stop
    full = A.analyze(run, None, {"drop_index": 56})
    assert G.dissolve_progress(full)["stop"]                # flat curve after a few minutes -> stop

def test_quick_mode():
    base = {"analyte_color": "B", "reference_color": "R"}
    ref = A.build_reference([A.parse_csv(S.make(seed=s)) for s in (21, 22, 23)], base, {"window_s": 60})
    prof = dict(base, reference=ref)
    q = lambda **kw: A.analyze(A.parse_csv(S.make(**kw)), prof, {"window_s": 60})["result"]
    assert q(seed=30) == "PASSED_SCREEN"
    assert q(dose=0.5) == "NEEDS_LAB"
    assert q(tau=120) == "NEEDS_LAB"
    assert q(seconds=48) == "UNABLE_TO_VERIFY"                    # stopped before 60 s
    assert A.analyze(A.parse_csv(S.make(seed=30)), prof)["result"] == "UNABLE_TO_VERIFY"   # full run vs quick profile
    run = A.parse_csv(S.make(seed=30))
    assert G.dissolve_progress(A.analyze(run, None, {"drop_index": 30}), "quick")["stop"]

def test_cloud_signal_for_white_tablets():
    asp = lambda **kw: A.parse_csv(S.make(conc_end=0.0, **kw))
    base = {"analyte_color": "B", "reference_color": "R", "signal": "cloud"}
    ref = A.build_reference([asp(cloud=0.6, seed=s) for s in (21, 22, 23)], base, {"window_s": 60})
    prof = dict(base, reference=ref)
    assert A.analyze(asp(cloud=0.6, seed=31), prof, {"window_s": 60})["result"] == "PASSED_SCREEN"
    assert A.analyze(asp(cloud=0.25, seed=31), prof, {"window_s": 60})["result"] == "NEEDS_LAB"

def test_scatter_signal_side_sensor():
    asp = lambda **kw: A.parse_csv(S.make(seconds=90, white=True, **kw))
    base = {"analyte_color": "B", "reference_color": "R", "signal": "scatter"}
    ref = A.build_reference([asp(cloud=0.3, seed=s) for s in (41, 42, 43)], base, {"window_s": 60})
    prof = dict(base, reference=ref)
    assert A.analyze(asp(cloud=0.3, seed=51), prof, {"window_s": 60})["result"] == "PASSED_SCREEN"
    assert A.analyze(asp(cloud=0.0, seed=51), prof, {"window_s": 60})["result"] == "NEEDS_LAB"   # nothing dissolved

def test_demo_profile_not_auto_matched():
    import server
    assert server.match_profile({"drug_name": "Riboflavin (vitamin B2)"}, "quick") is None
    assert server.match_profile({"drug_name": "Aspirin 325 mg"}, "quick") is None
