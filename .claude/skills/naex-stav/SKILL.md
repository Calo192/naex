---
name: naex-stav
description: Ranný prehľad linky NA EX! — čo čaká na Michala (návrhy na rozhodnutie, nezabraté zmeny, Prijímač roadmapy, nové názory ľudí), čo na Developera (stĺpec Teraz, návrhy na implementáciu), čo na overenie playtestom, čo na nasadenie (commity, ktoré nie sú na živom webe, rozohrané partie) a stav pracovného stromu — s jedným odporúčaným ďalším krokom. Použi, keď používateľ povie /naex-stav, „čo čaká“, „ako sme na tom“, „čo mám rozhodnúť“, „prehľad“, „čo ďalej“.
argument-hint: "(bez argumentov)"
---

# Prehľad: čo kde čaká

Rýchly prehľad bez agentov a bez partie — pár volaní API a gitu.

1. Pozbieraj:
   ```bash
   git fetch origin --quiet
   node --experimental-strip-types --no-warnings tools/admin/admin.ts prehlad --zivy
   ```
   Príkaz vypíše skupiny: **čaká na Michala** (návrhy na rozhodnutie, nezabraté
   návrhy, Prijímač roadmapy, nové názory ľudí na Spätnej väzbe), **čaká na
   Developera** (stĺpec Teraz, návrhy na implementáciu — upozorní na
   rozhodnutia účtu AI), **čaká na playtest** (implementované, neoverené),
   **server a nasadenie** (nasadený commit, rozohrané partie, commity
   v `origin/master`, ktoré nie sú na živom webe) a **pracovný strom**
   (necommitnuté súbory, nepushnutý master, `TODO` v herných dátach).
   Ak živý web nebeží, povedz to a spusti príkaz bez `--zivy` (lokálny web
   `npm run dev`), ak beží.
2. Doplň, čo príkaz nevie:
   - bežiace lokálne relácie: `git worktree list` (rozpracované varianty
     stratéga, nasadzovací worktree) a `ls -t playtest | head` (dnešné relácie),
   - posledný report: najnovší `docs/playtesty/2*.html` a jeho dátum.
3. **Odovzdaj** krátko, v termináli (nie HTML — je to prehľad na pár
   sekúnd): tabuľka *kto · čo čaká · koľko · odkaz* (`<živý web>/playtest`,
   `/vyvoj/roadmapa`, `/spatna-vazba`) a pod ňou **jeden odporúčaný ďalší
   krok** s príkazom, podľa tohto poradia:
   1. necommitnutá alebo nepushnutá práca, ktorá by sa stratila → dokončiť ju,
   2. návrhy na rozhodnutie alebo nezabraté → Michal v `<živý web>/playtest`,
   3. návrhy na implementáciu / Teraz → `/naex-implementacia`,
   4. nenasadené commity → `/naex-nasad`,
   5. implementované, neoverené → `/naex-playtest` (predvolený alebo `max`),
   6. nič nečaká → `/naex-playtest 2 max` alebo `/naex-strategia`.
   Nič nemeň, nič nespúšťaj — len odporuč.
