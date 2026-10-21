---
name: naex-playtest
description: Spustí playtest hry NA EX! — 1 až 3 partie naraz, v každej dvaja AI playtesteri náhodne vybraní zo šiestich postáv s rôznym herným štýlom (poznajú všetky pravidlá, hrajú cez skutočný server bez znalosti súperovej ruky) a spätnú väzbu zverejnia na živom webe. Podľa parametra followup potom nič (min), spisovateľ napíše report zo všetkých partií (predvolene), alebo navyše stratég s navrhárom spoločne pripravia návrhy zmien, o ktorých Michal rozhoduje v sekcii Playtest na webe (max). Použi, keď používateľ povie /naex-playtest, „spusti playtest", „nech to zahrajú agenti", „otestuj hru agentmi".
argument-hint: "[počet partií 1–3] [min|max] [kratka|stredna|dlha]"
---

# Playtest NA EX!

Si **organizátor** playtestu. Založíš partie, spustíš playtesterov, počkáš,
kým dohrajú, a podľa parametra followup dáš spracovať výsledky. Sám nehráš
a do partií nezasahuješ.

## Parametre

`$ARGUMENTS` — v ľubovoľnom poradí, všetky voliteľné (Michal 2026-10-21):

- **počet** `1`–`3` (predvolene 1) — koľko partií sa hrá **naraz**. V každej
  hrajú dvaja playtesteri, takže `2` = 4 agenti (2 v 2). Postáv je šesť,
  preto najviac 3. Viac ako 3 odmietni a vysvetli prečo.
- **followup**:
  - `min` — playtesteri dohrajú, uložia svoje súbory, zverejnia názory
    a komentáre na webe a **koniec** (žiadny report).
  - *(bez parametra)* — predvolený playtest: **spisovateľ** napíše report
    z dát **všetkých** playtesterov turnusu.
  - `max` — spisovateľ, a k tomu **stratég a navrhár**, ktorí spolu z celého
    feedbacku pripravia návrhy zmien, ktoré hru posunú k lepšiemu. Návrhy sa
    nahrajú do sekcie **Playtest** na živom webe (len admin a subadmin), kde
    o každom Michal rozhodne; schválené potom implementuje skill
    `naex-implementacia`. Cieľ je čo najlepší výsledok, aj keď to trvá dlhšie
    a stojí viac.
- **dĺžka hry** `kratka` (5 lokalít) | `stredna` (7, predvolená) | `dlha` (11).

## Agenti (`.claude/agents/`)

- `naex-playtester` — hrá jednu partiu za jednu **postavu**
  z `tools/playtest/hraci.json`: Jano Bitkár, Eva Stratégová, Fero Šenkár,
  Šimon Starešina, Hazardná Hela, Paragrafista Vilo. Každá má iný štýl
  a **zameranie** (téma, ktorej sa v spätnej väzbe venuje najviac). Postavy
  priraďuje náhodne `tools/playtest/turnus.ts`.
- `naex-spisovatel` — HTML report z celého turnusu (`docs/playtesty/<id>.html`).
- `naex-strateg` — meranie náhoda vs. zručnosť, varianty pravidiel, rozbor
  `docs/playtesty/strategia-<id>.html`; pri `max` posudzuje návrhy navrhára.
- `naex-navrhar` — pri `max` návrhy zmien (`docs/playtesty/navrhy-<id>.json`
  pre web a `navrhy-<id>.html`).

Sledovateľ vizuálu (`naex-sledovatel`) sa nespúšťa (Michal 2026-10-12).
Hru proti človeku zakladá skill `naex-protihrac`.

**Živý web** = `https://<DOMENA z deploy/.env.produkcia>` (dnes
https://15-235-242-12.sslip.io). Nástroje naň idú prepínačom `--zivy`. Účty
playtesterov („<meno> (AI)“) sú tam hráči so značkou AI a vlastným avatarom.

**Hlavná téma (Michal 2026-10-19): strategickosť.** Hra má odmeňovať skill,
nie náhodu. Playtesteri hrajú ako experti, rozoberú náhodu vs. zručnosť,
nezrovnalosti pravidiel a hry a navrhnú zmeny (`tools/playtest/kriteria.md`,
časť C).

## Postup

`A` = `node --experimental-strip-types --no-warnings tools/admin/admin.ts`,
`P` = `node --experimental-strip-types --no-warnings tools/playtest`.

1. **Živý web** — over `$P/web.ts dostupny --zivy`. Ak nebeží, playtest aj tak
   spusti a playtesterom povedz „Web: nedostupný“ (názory ostanú v súboroch).

2. **Založ turnus** (každá partia vlastný server na voľnom porte a dočasná
   databáza; postavy náhodne):
   ```bash
   $P/turnus.ts <počet> <dĺžka>
   ```
   Výpis dá id turnusu (`playtest/turnus-<id>/turnus.json`) a pre každú partiu
   reláciu `R` (`playtest/<id>-<n>`), port a oboch hráčov so štýlom
   a zameraním. Ak zlyhá, pozri `R/server.log` a povedz používateľovi prečo.
   Klient musí byť zbuildovaný (`npm run build --workspace=@naex/web`).

3. **Spusti všetkých playtesterov naraz** — v jednej správe `2 × počet`
   volaní Agent (`naex-playtester`, `run_in_background: true`), pre každého:
   „Relácia: R. Si hráč N. Postava: <meno> — štýl: <štýl> Zameranie:
   <zameranie>. Web: živý (--zivy) (alebo nedostupný). Najprv sa priprav
   (celé pravidlá, karty, moznosti.md), potom odohraj celú partiu ako expert.
   Hlavne potrebujem rozbor náhoda vs. zručnosť, nezrovnalosti medzi
   pravidlami a hrou, návrhy, ako hru spraviť strategickejšou, a tvoje
   zameranie. Napíš spätnú väzbu a zverejni ju na webe.“

   Ak existuje predošlý rozbor `docs/playtesty/strategia-*.html`, pridaj do
   zadania jeho otázky z časti „Čo sledovať v ďalšom playteste“.

   Používateľovi povedz: koľko partií beží, kto proti komu (mená postáv),
   followup a že partia trvá desiatky minút. Upozorni, aby sa na porty
   playtestu neprihlasoval za hráčov — prevzal by im spojenie.

4. **Čakaj** — agenti ti dajú vedieť sami, nepolluj. Keď dohrajú oba hráči
   partie, ulož jej posledný stav a zastav jej server:
   ```bash
   $P/hrac.ts R 1 stav > R/koniec-hrac1.txt
   $P/hrac.ts R 2 stav > R/koniec-hrac2.txt
   $P/ukonci.ts R
   ```
   Ak agent skončí bez dohranej partie, pozri `R/koniec-hrac*.txt`
   a `R/server.log`, zapíš, čo sa stalo, do `R/organizator.md` a pokračuj —
   aj nedohraná partia je podklad. Keď sú hotové všetky partie, pokračuj
   podľa followupu.

5. **Followup `min`** — koniec. Odovzdaj: výsledok každej partie (jedna veta),
   známky hráčov v jednom riadku (z `R/hrac*/feedback.md`), odkaz na Spätnú
   väzbu (`<živý web>/spatna-vazba`) a kde sú súbory (`playtest/<id>-<n>/`).

6. **Followup predvolený a `max` — report.** Spusti `naex-spisovatel` na
   pozadí: „Turnus: playtest/turnus-<id>/turnus.json. Napíš report zo všetkých
   partií.“ (spomeň `organizator.md`, ak vznikol). Pri `max` v **tej istej
   správe** spusti aj `naex-strateg`: „Turnus: … . Zmeraj náhodu a zručnosť,
   vyhodnoť návrhy playtesterov, najsľubnejšie vyskúšaj ako varianty a napíš
   rozbor. Potom ťa požiadam o posudok návrhov navrhára.“

7. **Len `max` — návrhy (stratég a navrhár spolu).** Zapamätaj si mená/id
   agentov, budeš s nimi pokračovať cez SendMessage (kontext im ostane).
   1. Keď dobehnú spisovateľ aj stratég, spusti `naex-navrhar`: „Turnus: … .
      Playtest max — počet bodov 5 (alebo koľko treba, najviac 8). Podklady:
      report docs/playtesty/<id>.html, rozbor stratéga
      docs/playtesty/strategia-<id>.html a všetka spätná väzba. Priprav
      koncept playtest/navrhy/<id>/koncept.json na posudok stratégovi.“
   2. Koncept pošli stratégovi (SendMessage): „Posúď koncept návrhov
      playtest/navrhy/<id>/koncept.json, zmeraj, čo sa dá, a zapíš
      posudok-stratega.md.“
   3. Posudok pošli navrhárovi (SendMessage): „Zapracuj posudok stratéga
      a dokonči návrhy (JSON pre web a HTML).“ Ak navrhár zapíše otázky
      stratégovi (`otazky-stratego.md`), prenes ich a odpoveď vráť — najviac
      dve kolá, potom nech navrhár dokončí s tým, čo má.
   4. Over JSON: `node -e "JSON.parse(require('fs').readFileSync('docs/playtesty/navrhy-<id>.json','utf8'))"`.

8. **Nahraj na živý web** (účet Admin (AI), subadmin):
   ```bash
   $A report-nahraj docs/playtesty/<id>.html --zivy                 # + strategia-<id>.html, navrhy-<id>.html pri max
   $A navrhy-nahraj docs/playtesty/navrhy-<id>.json --zivy          # len max
   ```
   Obrázky reportu v `docs/playtesty/<id>/` nahraj tým istým príkazom.

9. **Záznamy** (predvolený aj `max`):
   - do `docs/playtesty/zmeny-pravidiel.html` pri dotknutých zmenách blok
     „Výsledok playtestu <id>“ (1–3 vety z reportu),
   - do `docs/playtesty/vyvoj-znamok.html` na koniec poľa `PARTIE` každú
     partiu turnusu (známky oboch hráčov z `R/hrac*/feedback.md`, výsledok,
     dĺžka, odkaz na report; `zmenyPred` = doterajšie `CAKAJUCE`) a do
     `CAKAJUCE` zmeny pravidiel, ktoré vznikli po tomto playteste,
   - oba súbory potom nahraj na živý web (`$A report-nahraj … --zivy`).

10. **Odovzdaj výsledok používateľovi** (texty z playtestu pre ľudí píš ako
    interaktívne HTML, nie Markdown):
    - report: `<živý web>/playtest/reporty/<id>.html` a lokálny súbor
      (otvor ho v prehliadači),
    - výsledok každej partie (jedna veta), tabuľka známok 12 kritérií (každý
      hráč, priemer) a ako sa priemer pohol oproti predošlému playtestu,
    - náhoda vs. zručnosť: odhady hráčov a čo rozhodlo partie,
    - nezrovnalosti — potvrdené chyby v hre zvlášť (ponúkni opravu), otázky na
      autora zvlášť,
    - 3–5 najsilnejších návrhov na strategickosť a čo bolo dobré,
    - pri `max`: odkaz na **`<živý web>/playtest`**, kde čakajú návrhy na
      rozhodnutie — pre každý jeden riadok (téma, kritickosť, odporúčaná
      možnosť, verdikt stratéga) a že po rozhodnutí ich implementuje
      `/naex-implementacia`; kľúčové čísla stratéga.
    Zmeny pravidiel sám nezavádzaj.

## Poznámky

- Relácie a turnusy sú v `playtest/` (v `.gitignore`); reporty
  v `docs/playtesty/` sú v gite.
- Heslá AI účtov sú v `playtest/ucty.json` (mimo gitu), kľúčované adresou
  webu; rovnaké meno = rovnaký účet. Na živom webe ich nástroj zaradí heslom
  admina z `deploy/.env.produkcia`. Spätnú väzbu AI web predvolene skrýva
  (prepínač „Zobraziť aj spätnú väzbu od AI“).
- Avatar novej postavy: `$A avatar-generuj <kluc> "<námet z hraci.json>"`
  (Leonardo, Michal povolil), najlepší obrázok `$P/web.ts avatar --ako "<meno>" --zivy <subor>`.
- Playtester vidí len výstup `tools/playtest/hrac.ts` — filtrovaný pohľad
  servera (`viewFor`), súperovu ruku ani balíčky nepozná.
- Partia je jeden údaj; viac partií v turnuse s rôznymi štýlmi je silnejší
  podklad — pripomeň to pri porovnávaní reportov.
