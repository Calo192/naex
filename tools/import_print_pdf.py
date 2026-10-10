"""Import sady kariet z tlačového PDF (KartyAI „Print File").

Použitie:
    py tools/import_print_pdf.py docs/KartyAI_PrintFile_*.pdf

Výstup:
    packages/core/data/cards.json        herné dáta (rovnaký formát ako doteraz)
    packages/server/seed/navrhy.json     vzhľad kariet pre tvorcu (farba, mierky, kópie…)
    packages/server/seed/karty/<id>.jpg  ilustrácie v plnom rozlíšení

Tlačový súbor má každú permutáciu karty × počet kópií na samostatnej strane,
takže z neho vieme spätne odvodiť všetko, čo tvorca kariet uložil:

* multimnožina akcií strany = akcie na ľubovoľnej strane PDF danej karty,
* voľné pozície = zjednotenie obsadených pozícií naprieč permutáciami,
* obmedzenia pozícií = ak počet rôznych rozložení v PDF je menší než
  počet permutácií multimnožiny, pozícia povoľuje len akcie, ktoré na nej
  v PDF naozaj stoja,
* kópie na tlač = počet strán / počet rôznych rozložení.
"""

import collections
import io
import itertools
import json
import re
import sys
import unicodedata
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_icons import PIKTOGRAMY, signature, slot_groups  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CARDS_OUT = ROOT / "packages/core/data/cards.json"
SEED = ROOT / "packages/server/seed"

SPUSTACE = ["Furt", "Nástup", "Bitka", "Pitka", "Podpora", "Zhromaždenie", "Dedičstvo",
            "Prestávka", "Prehra", "Výhra", "Exekúcia"]

# Rozmery a mierky odmerané z PDF (orez 54 × 80 mm; titulok 11.04 pt = 10 × 1.104;
# slot 22.15 pt = 6 mm × 1.3).
KARTA_MM = (54.0, 80.0)
MIERKA_TEXTU = 1.1
MIERKA_IKON = 1.3


def slug(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def akcia(sig):
    if sig == (22,):
        return "Robota"  # kľúč na matice — pravidlá v2
    a = PIKTOGRAMY.get(sig)
    if a is None:
        raise SystemExit(f"Neznámy piktogram {sig}")
    return a


def rozlozenia(volne, multiset, povolene=None):
    """Všetky rôzne rozloženia multimnožiny po voľných pozíciách (ako core/variants.ts)."""
    symboly = list(multiset.elements()) + [""] * (len(volne) - sum(multiset.values()))
    out = set()
    for perm in set(itertools.permutations(symboly)):
        if povolene and any(a and povolene.get(p) and a not in povolene[p] for p, a in zip(volne, perm)):
            continue
        out.add(perm)
    return out


def main(pdf_path):
    doc = pymupdf.open(pdf_path)
    karty = collections.OrderedDict()

    for page in doc:
        lines = [l.strip() for l in page.get_text().split("\n") if l.strip()]
        name = lines[0]
        k = karty.setdefault(name, {
            "name": name,
            "tags": [t.strip() for t in lines[1].split("•")],
            "efekt": " ".join(lines[2:]),
            "strany": [],
            "farba": None,
            "obrazok": None,
        })
        rozlozenie = {"L": [None] * 4, "R": [None] * 4}
        for (side, idx), g in slot_groups(page).items():
            rozlozenie[side][idx] = akcia(signature(g["paths"]))
        k["strany"].append(rozlozenie)
        if k["farba"] is None:
            for dr in page.get_drawings():
                r = dr["rect"]
                if dr["type"] == "f" and abs(r.y0 - 170.08) < 0.5 and r.width > 160:
                    k["farba"] = "#%02x%02x%02x" % tuple(round(c * 255) for c in dr["fill"])
            xref = page.get_images()[0][0]
            k["obrazok"] = doc.extract_image(xref)["image"]

    cards, navrhy = [], []
    (SEED / "karty").mkdir(parents=True, exist_ok=True)
    for index, k in enumerate(karty.values(), start=1):
        cid = slug(k["name"])
        strany = {}
        pocty = {}
        for side, key in (("L", "left"), ("R", "right")):
            vsetky = [tuple(s[side]) for s in k["strany"]]
            multiset = collections.Counter(a for a in vsetky[0] if a)
            obsadene = sorted({i for v in vsetky for i, a in enumerate(v) if a})
            volne = obsadene if multiset else []
            unikatne = {tuple(v[i] or "" for i in volne) for v in vsetky}
            plne = rozlozenia(volne, multiset)
            povolene = {}
            if len(unikatne) < len(plne):
                for j, p in enumerate(volne):
                    povolene[p] = sorted({u[j] for u in unikatne if u[j]})
                if rozlozenia(volne, multiset, povolene) != unikatne:
                    print(f"POZOR {k['name']} {side}: obmedzenia nevysvetľujú rozloženia v PDF")
            pocty[side] = len(unikatne)
            strana = {
                "blocked": [i for i in range(4) if i not in volne],
                "actions": dict(sorted(multiset.items())),
            }
            if povolene:
                strana["allowed"] = {str(p): a for p, a in povolene.items()}
            strany[key] = strana

        rozne = len({(tuple(s["L"]), tuple(s["R"])) for s in k["strany"]})
        kopie = len(k["strany"]) // max(1, rozne)
        spustace = [t for t in SPUSTACE if re.search(rf"(^|\s){t}:", k["efekt"])]
        cards.append({
            "id": cid,
            "index": index,
            "name": k["name"],
            "tags": k["tags"],
            "effect_text": k["efekt"],
            "triggers": spustace,
            "left": strany["left"],
            "right": strany["right"],
            "permutations": {"total": pocty["L"] * pocty["R"], "left": pocty["L"], "right": pocty["R"]},
        })
        navrhy.append({
            "id": cid,
            "farba": k["farba"],
            "sirkaMm": KARTA_MM[0],
            "vyskaMm": KARTA_MM[1],
            "mierkaTextu": MIERKA_TEXTU,
            "mierkaIkon": MIERKA_IKON,
            "kopie": kopie,
            "obrazok": f"{cid}.jpg",
        })
        img = Image.open(io.BytesIO(k["obrazok"])).convert("RGB")
        img.save(SEED / "karty" / f"{cid}.jpg", quality=86, optimize=True, progressive=True)

    out = {
        "source": Path(pdf_path).name,
        "actions": sorted({a for c in cards for s in ("left", "right") for a in c[s]["actions"]}),
        "tags": sorted({t for c in cards for t in c["tags"]}),
        "cards": cards,
    }
    CARDS_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    (SEED / "navrhy.json").write_text(json.dumps(navrhy, ensure_ascii=False, indent=1) + "\n",
                                      encoding="utf-8", newline="\n")
    print(f"{len(cards)} kariet, {sum(c['permutations']['total'] for c in cards)} rozložení")


if __name__ == "__main__":
    main(sys.argv[1])
