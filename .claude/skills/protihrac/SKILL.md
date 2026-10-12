---
name: protihrac
description: Založí partiu NA EX! proti AI protihráčovi — agent naex-protihrac hrá proti človeku na skutočnom webe (človek v prehliadači), hrá ako playtester a po partii zverejní spätnú väzbu na stránke Spätná väzba. Použi, keď používateľ povie /protihrac, „chcem hrať proti AI", „zahraj si so mnou", „daj mi súpera agenta".
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

1. **Web** — predvolene vývojový server `http://localhost:8787`
   (`NAEX_WEB_URL` alebo `--url` ho zmení). Over ho:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny
   ```
   Ak nebeží, spusti ho na pozadí (`npm run dev`, `run_in_background`) a over
   znova. Ak zmeny v klientovi ešte nie sú v buildi, `npm run dev` ich má.

2. **Založ partiu**:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/zaloz-clovek.ts "<meno>" <dlzka>
   ```
   Z výpisu si zober reláciu `R` a odkaz na pripojenie.

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
   a odovzdaj používateľovi: výsledok partie, čo agent na hru povedal (3–5
   bodov) a odkaz na stránku Spätná väzba (`<web>/spatna-vazba`), kde sú
   jeho názory. Ak chce prehľadný report, napíš ho ako interaktívne HTML
   (pravidlo pre dokumenty pre ľudí) z `R/hrac1/feedback.md` a `dennik.md`.

## Poznámky

- Relácie sú v `playtest/` (mimo gitu), heslá AI účtov v `playtest/ucty.json`.
- Agent vidí len to, čo hráč — ruku človeka nepozná.
- Na produkčný web (iný než localhost) zakladaj partiu len, keď to používateľ
  výslovne chce — AI účet tam bude verejne viditeľný.
