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
Predvolené: dĺžka **stredna** (7 lokalít) a štýl:

- **„Krčmár Jožo"**: vyvážený a prefíkaný. Hrá na body aj na bitky podľa
  situácie, rád podstrčí súperovi do partie sabotéra s Odporom, šetrí poldeci
  na rozhodujúcu Pitku.

Meno do 19 znakov (web doň pridá „ (AI)"), štýl jednou-dvoma vetami.

## Postup

1. **Založ partiu**:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/zaloz-clovek.ts "<meno>" <dlzka>
   ```
   Skript spustí **vlastný server partie** (port od 8800, bez `--watch`) nad
   databázou `data/` — reštart vývojového servera po zmene kódu ho nezhodí,
   miestnosti totiž žijú len v pamäti servera. Ak je build klienta starší než
   zdrojáky, najprv ho zbuildí (chvíľu trvá). Vývojový server `npm run dev`
   netreba. Z výpisu si zober reláciu `R`, adresu servera partie `<web>`
   a odkaz na pripojenie. (`--url <web>` založí partiu na existujúcom webe
   bez vlastného servera — len na výslovnú žiadosť, viď Poznámky.)

2. **AI účet musí byť hráč**, inak nezverejní spätnú väzbu (nový účet je
   návštevník). Nástroj ho pri prihlásení sám zaradí ako hráča so značkou AI
   heslom admina z `.env` (`NAEX_ADMIN_HESLO`); ak heslo chýba, povedz
   používateľovi, nech ho v Tvorba → Hráči povýši — dá sa to aj počas partie.

3. **Daj používateľovi odkaz** — povedz mu: odkaz (`…/hra?kod=XXXX`), proti
   komu hrá a aký má agent štýl, dĺžku hry a že partia sa počíta do Frajeriny.
   Pripomeň, že sa musí prihlásiť vlastným účtom (nie AI účtom) a že agent
   na jeho ťahy trpezlivo čaká.

4. **Spusti agenta** `naex-protihrac` na pozadí (`run_in_background: true`):
   „Relácia: R. Meno: …, štýl: …. Web: <url>. Odohraj partiu proti človeku,
   napíš spätnú väzbu a zverejni ju na webe."
   Kým hrá, nepolluj. Ak sa používateľ medzitým ozve, odpovedz mu — agent
   beží ďalej.

5. **Po partii** ulož posledný stav:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 1 stav > R/koniec.txt
   ```
   zastav server partie:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/ukonci.ts R
   ```
   a odovzdaj používateľovi: výsledok partie, čo agent na hru povedal (3–5
   bodov), jeho odhad zručnosť : náhoda, nezrovnalosti medzi pravidlami
   a hrou (`R/hrac1/nezrovnalosti.md`), najsilnejšie návrhy na strategickosť
   a odkaz na stránku Spätná väzba (`http://localhost:8787/spatna-vazba`
   alebo `npm start`, server partie je už zastavený), kde sú
   jeho názory. Ak chce prehľadný report, napíš ho ako interaktívne HTML
   (pravidlo pre dokumenty pre ľudí) z `R/hrac1/feedback.md` a `dennik.md`.

## Poznámky

- Relácie sú v `playtest/` (mimo gitu), heslá AI účtov v `playtest/ucty.json`.
- Agent vidí len to, čo hráč — ruku človeka nepozná.
- Prihlásenie z `localhost:8787` platí aj na serveri partie (relácie sú
  v databáze, cookie nerozlišuje porty). Log servera je v `R/server.log`.
- Ak miestnosť zmizne („Miestnosť s týmto kódom neexistuje"), pozri
  `R/server.log` — server partie spadol.
- Na produkčný web (iný než localhost) zakladaj partiu len, keď to používateľ
  výslovne chce — AI účet tam bude verejne viditeľný.
