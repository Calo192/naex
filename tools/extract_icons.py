"""Vytiahne vektorové piktogramy akcií z tlačového PDF (export KartyAI).

Použitie:
    py tools/extract_icons.py docs/KartyAI_PrintFile_*.pdf

Výstup: apps/web/src/karta/ikony.ts (generovaný, neupravuj ručne).

Piktogram je v PDF biela výplň (jedna alebo viac ciest) vnútri čierneho
štvorca slotu. PDF nemá názvy akcií, tvary sa rozlišujú podľa počtu segmentov
ciest. Priradenie je ručné podľa významu obrázka a overené na kartách, ktoré
sa s cards.json zhodujú (Noviny, Nealko, Pasca, Puška, Kostol, Čierna mačka…).
Vylučovanie nestačí — PDF je novšia sada a pri časti kariet sa rozloženie líši.
"""

import collections
import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "packages/core/data/cards.json"
OUT = ROOT / "apps/web/src/karta/ikony.ts"

# Geometria tlačového hárku (pt): orez 17.0079 od okraja, slot 0 je
# 22.93 pt pod horným orezom, krok slotov 10 mm.
TRIM = 17.0079
SLOT_TOP = 22.93
SLOT_STEP = 28.346
WHITE = (1.0, 1.0, 1.0)

# Podpis tvaru (zoradené počty segmentov ciest) → akcia.
PIKTOGRAMY = {
    (23,): "Cigaretka",  # cigareta
    (109,): "Dlh",  # zväzok bankoviek
    (42,): "Rana",  # päsť vo výbuchu
    (106,): "Povera",  # rečové bubliny (klebety)
    (59,): "Poldeci",  # pohárik
    (65,): "Odpor",  # zdvihnutá päsť
    (61,): "Pecka",  # boxer
    (4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 6, 8, 8, 21): "Viera",  # žiariaci kríž
    (48,): "Posilnenie",  # postava v žiare
    (17,): "PoškodeniePečene",  # pečeň
    (82,): "Pohoršenie",  # lebka
    (160,): "Vízia",  # lapač snov
    (188,): "Obmedzenie",  # putá
    (60,): "Petelica",  # puška
    (22,): "Robota",  # kľúč na matice (pravidlá v2)
}


def slot_groups(page):
    """{(strana, index): {'inner': Rect, 'paths': [drawing, ...]}}"""
    inner = {}
    paths = collections.defaultdict(list)
    for dr in page.get_drawings():
        r = dr["rect"]
        if dr["type"] != "f" or r.width > 30 or r.height > 30:
            continue
        side = "L" if r.x0 < 90 else "R"
        cy = (r.y0 + r.y1) / 2 - TRIM
        idx = round((cy - SLOT_TOP - 11.07) / SLOT_STEP)
        if dr["fill"] == (0.0, 0.0, 0.0) and [it[0] for it in dr["items"]] == ["re"]:
            inner[(side, idx)] = r
        elif dr["fill"] == WHITE:
            paths[(side, idx)].append(dr)
    return {k: {"inner": inner[k], "paths": v} for k, v in paths.items() if k in inner}


def signature(paths):
    return tuple(sorted(len(p["items"]) for p in paths))


def main(pdf_path):
    doc = pymupdf.open(pdf_path)

    example = {}
    for page in doc:
        for g in slot_groups(page).values():
            example.setdefault(signature(g["paths"]), g)
    mapping = {sig: a for sig, a in PIKTOGRAMY.items() if sig in example}

    all_actions = json.loads(CARDS.read_text("utf-8"))["actions"]
    missing = sorted(set(all_actions) - set(mapping.values()))
    if missing:
        sys.exit(f"Nepodarilo sa priradiť piktogramy pre: {missing}")

    def num(v):
        return f"{v:.2f}".rstrip("0").rstrip(".")

    def to_svg(dr, box):
        # Súradnice v štvorci 0..100 (vnútro slotu).
        s = 100 / box.width

        def pt(p):
            return f"{num((p.x - box.x0) * s)} {num((p.y - box.y0) * s)}"

        out, last = [], None
        for it in dr["items"]:
            kind = it[0]
            if kind == "re":
                r = it[1]
                out.append(f"M{pt(r.tl)}L{pt(r.tr)}L{pt(r.br)}L{pt(r.bl)}Z")
                last = None
                continue
            if kind == "qu":
                q = it[1]
                out.append(f"M{pt(q.ul)}L{pt(q.ur)}L{pt(q.lr)}L{pt(q.ll)}Z")
                last = None
                continue
            start = it[1]
            if last is None or abs(start.x - last.x) > 1e-3 or abs(start.y - last.y) > 1e-3:
                if out and dr.get("closePath"):
                    out.append("Z")
                out.append(f"M{pt(start)}")
            if kind == "l":
                out.append(f"L{pt(it[2])}")
                last = it[2]
            elif kind == "c":
                out.append(f"C{pt(it[2])} {pt(it[3])} {pt(it[4])}")
                last = it[4]
        if dr.get("closePath"):
            out.append("Z")
        return "".join(out)

    lines = [
        "// GENEROVANÉ nástrojom tools/extract_icons.py z tlačového PDF — neupravuj ručne.",
        "// Piktogramy akcií v súradniciach vnútra slotu 0..100.",
        "",
        'import type { Action } from "@naex/core";',
        "",
        "export interface IkonaCesta {",
        "  readonly d: string;",
        "  readonly evenOdd: boolean;",
        "}",
        "",
        "export const IKONY: Readonly<Record<Action, readonly IkonaCesta[]>> = {",
    ]
    for sig, action in sorted(mapping.items(), key=lambda kv: kv[1]):
        g = example[sig]
        lines.append(f"  {json.dumps(action, ensure_ascii=False)}: [")
        for dr in g["paths"]:
            even = "true" if dr.get("even_odd") else "false"
            lines.append(f'    {{ d: "{to_svg(dr, g["inner"])}", evenOdd: {even} }},')
        lines.append("  ],")
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{OUT.relative_to(ROOT)}: {len(mapping)} akcií")


if __name__ == "__main__":
    main(sys.argv[1])
