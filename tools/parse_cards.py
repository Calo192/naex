import json, re, unicodedata, sys

SRC = "/mnt/user-data/uploads/Claude/kartyai_cards_20260713_rozsirene.txt"
raw = open(SRC, encoding="utf-8").read()

def slug(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s

TRIGGERS = ["Furt","Nastup","Nástup","Bitka","Pitka","Podpora","Zhromazdenie","Zhromaždenie",
            "Dedicstvo","Dedičstvo","Prestavka","Prestávka","Prehra","Výhra","Vyhra"]

blocks = re.split(r"-{40,}\nCARD (\d+): (.+?)\n-{40,}\n", raw)
# blocks[0] = header; then triples (num, name, body)
cards = []
for i in range(1, len(blocks), 3):
    num  = int(blocks[i])
    name = blocks[i+1].strip()
    body = blocks[i+2]

    m = re.search(r"^Tags:\s*(.+)$", body, re.M)
    tags = [t.strip() for t in m.group(1).split(",")] if m else []

    m = re.search(r"^EFECT:\s*(.*?)(?=\n\nLEFT side:)", body, re.M | re.S)
    effect = m.group(1).strip() if m else ""
    effect = re.sub(r"\s*\n\s*", " ", effect).strip()

    trig = []
    for t in re.findall(r"(?:^|\s)([A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽ][a-záčďéíľĺňóôŕšťúýž]+)\s*:", effect):
        if t in TRIGGERS and t not in trig:
            trig.append(t)

    def side(tag):
        m = re.search(tag + r" side:\n"
                      r"\s*Blocked positions:\s*(.+?)\n"
                      r"\s*Available slots:\s*(\d+) of 4\n"
                      r"\s*Actions:\s*(.+?)\n", body)
        if not m:
            raise SystemExit("parse fail %s %s" % (num, tag))
        bl_raw, avail, act_raw = m.group(1).strip(), int(m.group(2)), m.group(3).strip()
        blocked = [] if bl_raw == "none" else sorted(int(x.strip()[1:]) for x in bl_raw.split(","))
        actions = {}
        if act_raw != "none":
            for part in act_raw.split(","):
                pm = re.match(r"\s*(.+?)\s*x(\d+)\s*$", part)
                actions[pm.group(1)] = int(pm.group(2))
        assert avail == 4 - len(blocked), (num, tag)
        assert sum(actions.values()) <= avail, ("overflow", num, tag)
        return {"blocked": blocked, "actions": actions}

    m = re.search(r"Total permutations:\s*(\d+)\s*\(left (\d+) x right (\d+)\)", body)
    perms = {"total": int(m.group(1)), "left": int(m.group(2)), "right": int(m.group(3))} if m else None

    cards.append({
        "id": slug(name), "index": num, "name": name, "tags": tags,
        "effect_text": effect, "triggers": trig,
        "left": side("LEFT"), "right": side("RIGHT"), "permutations": perms,
    })

ids = [c["id"] for c in cards]
assert len(set(ids)) == len(ids), [x for x in ids if ids.count(x) > 1]

all_actions = sorted({a for c in cards for s in ("left","right") for a in c[s]["actions"]})
all_tags    = sorted({t for c in cards for t in c["tags"]})

out = {"source": "kartyai_cards_20260713_rozsirene.txt",
       "actions": all_actions, "tags": all_tags, "cards": cards}
open("packages/core/data/cards.json","w",encoding="utf-8").write(
    json.dumps(out, ensure_ascii=False, indent=1))

print("cards:", len(cards))
print("actions:", all_actions)
print("tags:", all_tags)
from collections import Counter
print("by tag:", Counter(t for c in cards for t in c["tags"]))
print("triggers seen:", Counter(t for c in cards for t in c["triggers"]))
print("no-trigger cards:", [c["name"] for c in cards if not c["triggers"] and c["effect_text"]])
