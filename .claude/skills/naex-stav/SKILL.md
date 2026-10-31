---
name: naex-stav
description: Ranný prehľad linky NA EX! — čo čaká na Michala (návrhy na rozhodnutie, nezabraté zmeny, Prijímač roadmapy, nové názory ľudí), čo na Developera (stĺpec Teraz, návrhy na implementáciu), čo na overenie playtestom, čo na nasadenie (commity, ktoré nie sú na živom webe, rozohrané partie), výsledky cloudových routines (otvorené PR, nezlúčené vetvy, nočná kontrola zdravia, zlyhané behy, nálezy strážcu) a stav pracovného stromu — s jedným odporúčaným ďalším krokom. Použi, keď používateľ povie /naex-stav, „čo čaká“, „ako sme na tom“, „čo mám rozhodnúť“, „prehľad“, „čo ďalej“.
argument-hint: "(bez argumentov)"
---

# Prehľad: čo kde čaká

Rýchly prehľad bez agentov a bez partie — pár volaní API a gitu.

1. Pozbieraj:
   ```bash
   git fetch origin --quiet
   node --experimental-strip-types --no-warnings tools/admin/admin.ts linka --zivy
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
2b. **Výsledky cloudových routines** (Michal 2026-10-31; zoznam a id routines
   sú v pamäti `cloud-routines.md`). Routines nič nezlučujú do master, výstupy
   nechávajú na vetvách, v PR alebo v Claude Docs — skontroluj, či niečo
   nečaká na Leadera alebo Michala:
   ```bash
   gh pr list --repo Calo192/naex --state open --json number,title,headRefName,createdAt,isDraft
   git branch -r --no-merged origin/master --sort=-committerdate \
     | grep -E 'origin/(noc/|upratovanie/|playtest/tyzdenny|kontrola-stylu/|student/)'
   git log -1 --format='%cs %s' origin/noc/zdravie
   git show origin/noc/zdravie:docs/zdravie/$(git ls-tree --name-only origin/noc/zdravie docs/zdravie/ | sort | tail -1 | xargs basename)
   ```
   - **Otvorené PR** (upratovač piatok) → Leader ich zmerguje po overovači;
     PR starší ako 3 dni alebo s konfliktom uveď zvlášť.
   - **Nezlúčené vetvy routines** (playtest týždenný, kontrola štýlu, študent)
     → čo obsahujú (report, návrhy, knižnica) a či ich treba zlúčiť a nahrať
     na web (playtest: report + návrhy cez `admin.ts report-nahraj`/`navrhy-nahraj`).
     Vetva `noc/zdravie` sa nezlučuje, je to archív meraní.
   - **Nočná kontrola zdravia**: dátum posledného záznamu (ak je starší ako
     2 dni, routine asi nebeží) a verdikt — padnuté testy, typecheck, build,
     pokles strategickosti alebo turnaja botov oproti predošlému záznamu.
   - **Behy routines**: ak je k dispozícii nástroj `RemoteTrigger`, `list`
     routines a pri každej posledný beh — zlyhaný beh, chyba pushu (403) alebo
     beh, ktorý neprebehol podľa cronu, uveď.
   - **Claude Docs** (ranný prehľad, strážca tajomstiev — strážca píše len
     tam, lebo repo je verejné): ak je k dispozícii konektor Claude Docs,
     nájdi posledné dokumenty „NA EX! strážca …“ a „NA EX! ranný prehľad …“
     a vytiahni nálezy, ktoré treba riešiť (strážca: každý nález s
     závažnosťou; obsah nálezov nepíš do gitu ani do verejných súborov).
     Bez konektora napíš, že ich treba pozrieť ručne.
3. **Odovzdaj** krátko, v termináli (nie HTML — je to prehľad na pár
   sekúnd): tabuľka *kto · čo čaká · koľko · odkaz* (`<živý web>/playtest`,
   `/vyvoj/roadmapa`, `/spatna-vazba`), v nej riadky **Cloud routines**
   (otvorené PR, nezlúčené vetvy, nočné zdravie, zlyhané behy, nálezy
   strážcu) a pod ňou **jeden odporúčaný ďalší krok** s príkazom, podľa
   tohto poradia:
   1. necommitnutá alebo nepushnutá práca, ktorá by sa stratila → dokončiť ju,
   2. nález strážcu (únik skrytých informácií, podvádzanie) alebo červená
      nočná kontrola → opraviť (Developer / Programátor),
   3. otvorený PR alebo nezlúčená vetva z routines → Leader zmerguje po
      overovači, report playtestu nahrá na web,
   4. návrhy na rozhodnutie alebo nezabraté → Michal v `<živý web>/playtest`,
   5. návrhy na implementáciu / Teraz → `/naex-implementacia`,
   6. nenasadené commity → `/naex-nasad`,
   7. implementované, neoverené → `/naex-playtest` (predvolený alebo `max`),
   8. nič nečaká → `/naex-playtest 2 max` alebo `/naex-strategia`.
   Nič nemeň, nič nespúšťaj — len odporuč.
