---
name: naex-protihrac
description: Založí partiu NA EX! proti AI protihráčovi — agent naex-protihrac hrá proti človeku na skutočnom webe (človek v prehliadači), hrá ako playtester a po partii zverejní spätnú väzbu na stránke Spätná väzba. Použi, keď používateľ povie /naex-protihrac, „chcem hrať proti AI", „zahraj si so mnou", „daj mi súpera agenta".
argument-hint: "[štýl agenta] [kratka|stredna|dlha]"
---

# Partia proti AI protihráčovi

Si **organizátor**. Založíš miestnosť na webe, dáš používateľovi odkaz,
spustíš agenta `naex-protihrac` a po partii odovzdáš výsledok. Sám nehráš.

## Argumenty

`$ARGUMENTS` — voliteľne štýl agenta a dĺžka hry (`kratka`, `stredna`, `dlha`).
Predvolené: dĺžka **stredna** (5 lokalít) a štýl:

- **„Krčmár Jožo"**: vyvážený a prefíkaný. Hrá na body aj na bitky podľa
  situácie, rád podstrčí súperovi do partie sabotéra s Odporom, šetrí poldeci
  na rozhodujúcu Pitku.

Meno do 19 znakov (web doň pridá „ (AI)"), štýl jednou-dvoma vetami.

## Postup

Protihráč hrá proti ľuďom na **Vypálenej** (živý web, vetva `vypalena`;
Michal 2026-11-02) — `master` je pokusná Zrejúca s inými pravidlami.

1. **Založ partiu** na živom webe (z hlavného stromu):
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/zaloz-clovek.ts "<meno>" <dlzka> --zivy
   ```
   Z výpisu si zober reláciu `R` (v `playtest/`, absolútnu cestu dáš agentovi)
   a odkaz na pripojenie. Lokálny server partie z `master` (bez `--zivy`, hrá
   Zrejúcu) len na výslovnú žiadosť používateľa — viď Poznámky.

2. **Worktree Vypálenej `V`** (klient musí byť z rovnakej verzie ako server,
   pravidlá a ťahák tiež): `git fetch -q origin`, potom
   `git worktree add --detach ../naex-protihrac-vyp origin/vypalena` (ak už
   existuje: `git -C ../naex-protihrac-vyp checkout --detach origin/vypalena`)
   a v ňom `npm ci`. `V` = jeho absolútna cesta.

   **AI účet musí byť hráč**, inak nezverejní spätnú väzbu (nový účet je
   návštevník). Nástroj ho pri prihlásení sám zaradí ako hráča so značkou AI
   heslom admina (živý web: `deploy/.env.produkcia`, lokálne `.env`); ak heslo
   chýba, povedz používateľovi, nech ho v Tvorba → Hráči povýši — dá sa to aj
   počas partie.

3. **Daj používateľovi odkaz** — povedz mu: odkaz (`…/hra?kod=XXXX`), proti
   komu hrá a aký má agent štýl, dĺžku hry a že partia sa počíta do Frajeriny.
   Pripomeň, že sa musí prihlásiť vlastným účtom (nie AI účtom) a že agent
   na jeho ťahy trpezlivo čaká.

4. **Spusti agenta** `naex-protihrac` na pozadí (`run_in_background: true`):
   „Relácia: R (absolútne). Meno: …, štýl: …. Web: <url> (Vypálená).
   Worktree Vypálenej: V — pravidlá, ťahák aj klient sú odtiaľ. Pred partiou
   si prečítaj zošity skúseností (`skusenosti.ts citaj vypalena protihrac
   spolocne`). Odohraj partiu proti človeku, napíš spätnú väzbu, zverejni ju
   na webe a nakoniec over a zapíš skúsenosti do protihrac.md."
   Kým hrá, nepolluj. Ak sa používateľ medzitým ozve, odpovedz mu — agent
   beží ďalej.

5. **Po partii** ulož posledný stav (klient z `V`):
   ```bash
   cd V && node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 1 stav > R/koniec.txt
   ```
   lokálny server partie (len bez `--zivy`) zastav
   `node --experimental-strip-types --no-warnings tools/playtest/ukonci.ts R`
   a odovzdaj používateľovi: výsledok partie, čo agent na hru povedal (3–5
   bodov), jeho odhad zručnosť : náhoda, nezrovnalosti medzi pravidlami
   a hrou (`R/hrac1/nezrovnalosti.md`), najsilnejšie návrhy na strategickosť
   a odkaz na stránku Spätná väzba (`<web>/spatna-vazba`), kde sú
   jeho názory, a čo sa agent naučil (zmeny v
   `tools/playtest/skusenosti/protihrac.md`). Zošit je v gite. Zmenu over
   (`node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts kontrola`)
   a commitni ju (master a push len Leader, `docs/SESSIONS.md`). Ak chce prehľadný report, napíš ho ako interaktívne HTML
   (pravidlo pre dokumenty pre ľudí) z `R/hrac1/feedback.md` a `dennik.md`.

## Poznámky

- Relácie sú v `playtest/` (mimo gitu), heslá AI účtov v spoločnom `.git/naex-ucty.json` (`tools/playtest/ucty.ts`).
- Agent vidí len to, čo hráč — ruku človeka nepozná.
- Protihráč sa učí (Michal 2026-10-25): jeden zošit `protihrac.md` pre všetky
  štýly. Overenie skúseností robí sám na konci partie, lebo spisovateľ tu
  nebeží; skúsenosti nesú verziu pravidiel Vypálenej. Formát a verzie sú
  v `tools/playtest/skusenosti/README.md`.
- Partia na živom webe sa počíta do Frajeriny a štatistík a AI účet je tam
  verejne viditeľný — to je zámer.
- **Lokálne (len na výslovnú žiadosť):** `zaloz-clovek.ts` bez `--zivy` spustí
  vlastný server partie z hlavného stromu (port od 8800, bez `--watch`, nad
  databázou `data/`; ak je build klienta starší než zdrojáky, zbuildí ho).
  Hrá sa Zrejúca (`master`): agentovi nedávaj `V`, nech číta pravidlá
  a zošity pre `zrejuca`. Prihlásenie z `localhost:8787` tam platí (cookie
  nerozlišuje porty); keď miestnosť zmizne („Miestnosť s týmto kódom
  neexistuje“), server partie spadol — pozri `R/server.log`.
- Po partii worktree `V` nechaj (ďalšia partia ho len prepne na
  `origin/vypalena`), nič v ňom nemeň.
