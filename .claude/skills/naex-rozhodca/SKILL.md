---
name: naex-rozhodca
description: Spustí agenta naex-rozhodca — prevedie pravidlá NA EX! (docs/PRAVIDLA.md) na testy jadra — ku každému paragrafu nájde alebo dopíše test, rozpory pravidiel a kódu zaradí (chyba v hre / v pravidlách / nejasné) a predloží ako návrhy na rozhodnutie v sekcii Playtest. Engine nemení. Pri ďalšom behu prejde len zmenené paragrafy. Použi, keď používateľ povie /naex-rozhodca, „over pravidlá testami“, „sedí kód s pravidlami“, „nájdi nezrovnalosti bez playtestu“, „pokrytie pravidiel“.
argument-hint: "[celé | zmenené | §<číslo> …] (predvolene zmenené paragrafy, prvýkrát celé)"
---

# Rozhodca: pravidlá ako testy

Spustíš agenta `naex-rozhodca` (`.claude/agents/naex-rozhodca.md`) a odovzdáš
výsledok. Sám testy nepíšeš.

1. **Rozsah** z `$ARGUMENTS`: `celé`, `zmenené` alebo zoznam paragrafov
   (`§7`, `§8 Pohoršenie`). Bez argumentu: ak
   `tools/rozhodca/mapa.json` má `pravidlaCommit: null`, je to prvý prechod —
   povedz používateľovi, že celé pravidlá (~1100 riadkov, §1–§14) sú veľká
   práca na desiatky minút, a navrhni začať §4–§8 (jadro: aktivácia, poldeci,
   kolo, bitka); inak zmenené paragrafy
   (`node --experimental-strip-types --no-warnings tools/rozhodca/mapa.ts zmenene`).
   Ak sa nič nezmenilo, povedz to a skonči.
2. **Spusti `naex-rozhodca`** na pozadí: „Rozsah: … . Prever pravidlá testami,
   aktualizuj mapu, prechádzajúce testy commitni (koncovka commitu:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), nálezy zapíš
   ako návrhy.“ Používateľovi povedz, že beží a na čom.
3. **Keď skončí**, nahraj nálezy na živý web (ak nejaké sú):
   ```bash
   A="node --experimental-strip-types --no-warnings tools/admin/admin.ts"
   $A navrhy-nahraj docs/playtesty/navrhy-rozhodca-<davka>.json --zivy
   ```
4. **Odovzdaj:** pokrytie (koľko pravidiel, koľko pokrytých, pred → po), nové
   testy a commit, nálezy po jednom riadku (paragraf, druh, čo hovorí pravidlo
   vs. čo robí hra) s odkazom `<živý web>/playtest`, kde o nich Michal rozhodne
   (oprava kódu, alebo úprava pravidiel), a čo ostalo neprejdené.
