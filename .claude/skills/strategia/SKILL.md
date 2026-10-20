---
name: strategia
description: Spustí rozbor strategickosti NA EX! bez novej partie — agent naex-strateg turnajmi botov zmeria, koľko o výsledku rozhoduje zručnosť a koľko náhoda, zmapuje zdroje náhody, zozbiera návrhy z doterajších playtestov, najsľubnejšie zmeny vyskúša ako varianty pravidiel a napíše HTML rozbor s odporúčaniami na balans. Použi, keď používateľ povie /strategia, „je v hre veľa náhody", „ako spraviť hru strategickejšou", „zmeraj náhodu", „over návrh pravidla simuláciou".
argument-hint: "[téma alebo konkrétny návrh na overenie] [| relácia playtest/<id>]"
---

# Rozbor strategickosti NA EX!

Spustíš agenta `naex-strateg` (`.claude/agents/naex-strateg.md`) a odovzdáš
výsledok. Sám nemeriaš ani nemeníš pravidlá.

Argumenty: `$ARGUMENTS` — voliteľná téma alebo konkrétny návrh („mulligan
štartovacej ruky“, „odkrytý šenok“), voliteľne za `|` relácia playtestu.
Bez relácie stratég vychádza zo všetkých doterajších playtestov v `playtest/`
a z reportov v `docs/playtesty/`.

1. Spusti `naex-strateg` na pozadí: „Rozbor bez playtestu (alebo Relácia: R).
   Téma: …. Zmeraj náhodu a zručnosť, vyhodnoť návrhy z playtestov,
   najsľubnejšie vyskúšaj ako varianty a napíš rozbor.“ Ak téma je jeden
   konkrétny návrh, nech ho vyskúša v 2–3 podobách (rôzne čísla) proti
   východisku.
2. Používateľovi povedz, že rozbor beží (turnaje botov trvajú desiatky minút)
   a že hlavnú vetvu nemení — varianty skúša vo worktree v `playtest/varianty/`.
3. Keď skončí, odovzdaj: odkaz `http://localhost:8787/admin/playtesty/strategia-<id>.html`
   (a lokálny súbor `docs/playtesty/strategia-<id>.html`), kľúčové čísla,
   3 odporúčané zmeny s nameraným posunom, otázky na Michala. Ponúkni,
   ktorú zmenu implementovať — implementácia je samostatná úloha (pravidlá,
   testy, `docs/PRAVIDLA.md`, `zmeny-pravidiel.html`).
