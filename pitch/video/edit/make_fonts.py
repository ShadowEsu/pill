#!/usr/bin/env python3
"""Cuts static Inter instances out of fonts/Inter-Variable.ttf (libass renders a variable font at its default instance).
    .venv/bin/python make_fonts.py      (needs fonttools)
Writes fonts/Inter-Medium.ttf (family "Inter Medium", wght 500) and fonts/Inter-SemiBold.ttf (family "Inter SemiBold", wght 600).
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "fonts", "Inter-Variable.ttf")
for family, wght in (("Inter Medium", 500), ("Inter SemiBold", 600)):
    f = TTFont(SRC)
    axes = {a.axisTag: a.defaultValue for a in f["fvar"].axes}
    axes.update({"wght": wght, "opsz": 14 if "opsz" in axes else None})
    axes = {k: v for k, v in axes.items() if v is not None}
    inst = instantiateVariableFont(f, axes)
    name = inst["name"]
    ps = family.replace(" ", "-")
    for rec in list(name.names):
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (2, 17):
            rec.string = "Regular"
        elif rec.nameID == 4:
            rec.string = family
        elif rec.nameID == 6:
            rec.string = ps
        elif rec.nameID == 3:
            rec.string = f"{ps};static-instance"
    inst["OS/2"].usWeightClass = 400  # one face per family, so libass picks it for \b0
    out = os.path.join(HERE, "fonts", ps + ".ttf")
    inst.save(out)
    print("wrote", os.path.relpath(out), os.path.getsize(out), "bytes")
