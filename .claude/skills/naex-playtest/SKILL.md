---
name: naex-playtest
description: Spustí playtest hry NA EX! — 1 až 3 partie naraz, v každej dvaja AI playtesteri náhodne vybraní zo šiestich postáv s rôznym herným štýlom (poznajú všetky pravidlá, hrajú cez skutočný server bez znalosti súperovej ruky) a spätnú väzbu zverejnia na živom webe. Podľa parametra followup potom nič (min), spisovateľ napíše report zo všetkých partií (predvolene), alebo navyše stratég s navrhárom spoločne pripravia návrhy zmien, o ktorých Michal rozhoduje v sekcii Playtest na webe (max). S parametrom vyucba namiesto partie traja nováčikovia prejdú výučbu „Prvá hra“ v prehliadači. Použi, keď používateľ povie /naex-playtest, „spusti playtest", „nech to zahrajú agenti", „otestuj hru agentmi", „otestuj výučbu nováčikmi".
argument-hint: "[počet partií 1–3] [min|max] [kratka|stredna|dlha] | vyucba [1–3]"
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
    a stojí viac — preto `max` len pred veľkým rozhodnutím (napr. pred
    zmrazením pravidiel), inak predvolený report (Michal 2026-10-23, tokeny).
- **dĺžka hry** `kratka` (3 lokality) | `stredna` (5, predvolená) | `dlha` (7).
- **`vyucba [1–3]`**: namiesto partie playtest výučby „Prvá hra“ s nováčikmi
  v prehliadači (predvolene 3). Postup je v časti **Režim vyucba** nižšie,
  kroky 1–10 vtedy neplatia.

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

2b. **Návrhy na overenie** (Michal 2026-10-21: návrh sa uzavrie, až keď
   playtest ukáže, že zabral):
   ```bash
   $A navrhy implementovane --zivy --json
   ```
   Ber tie, ktorých commit (vo `vysledok`) je v kóde, ktorý sa hrá
   (`git merge-base --is-ancestor <hash> HEAD`) — inak by sa overovalo staré
   správanie. Z každého si zober id, názov a otázky `overenie` (návrh bez nich:
   jedna otázka „Trvá problém <problem jednou vetou>?“). Pri followupe `min`
   sa neoveruje (nie je spisovateľ) — preskoč.

3. **Spusti všetkých playtesterov naraz** — v jednej správe `2 × počet`
   volaní Agent (`naex-playtester`, `run_in_background: true`), pre každého:
   „Relácia: R. Si hráč N. Postava: <meno> — štýl: <štýl> Zameranie:
   <zameranie>. Web: živý (--zivy) (alebo nedostupný). Najprv sa priprav
   (celé pravidlá, karty, moznosti.md), potom odohraj celú partiu ako expert.
   Hlavne potrebujem rozbor náhoda vs. zručnosť, nezrovnalosti medzi
   pravidlami a hrou, návrhy, ako hru spraviť strategickejšou, a tvoje
   zameranie. Zošit skúseností: tools/playtest/skusenosti/<kluc>.md
   a spolocne.md — prečítaj ich pred partiou, v pláne napíš, ktoré
   použiješ, a vo feedback.md navrhni nové (časť Návrhy skúseností). Napíš
   spätnú väzbu a zverejni ju na webe.“ Kľúč postavy je v `turnus.json`
   (výpis turnusu ho ukáže ako riadok „Zošit:“).

   Ak existuje predošlý rozbor `docs/playtesty/strategia-*.html`, pridaj do
   zadania jeho otázky z časti „Čo sledovať v ďalšom playteste“. Ak sú návrhy
   na overenie (krok 2b), pridaj: „Otázky na overenie zmien (odpovedz v
   feedback.md, časť Overenie zmien): #<id> <názov>: <otázky>; …“.

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
   Skúsenosti ostanú len ako návrhy vo `feedback.md` (bez spisovateľa ich
   nik neoverí). Zapíšu sa pri najbližšom reporte, keď ich spisovateľ nájde
   cez `skusenosti.ts cakajuce`. Relácie preto nemaž.

6. **Followup predvolený a `max` — report.** Spusti `naex-spisovatel` na
   pozadí: „Turnus: playtest/turnus-<id>/turnus.json. Napíš report zo všetkých
   partií. Over a zapíš navrhnuté skúsenosti do zošitov
   (tools/playtest/skusenosti/, aj čakajúce z turnusov min).“ (spomeň `organizator.md`, ak vznikol; ak sú návrhy na overenie,
   pridaj „Návrhy na overenie: #<id> <názov> — <otázky>; … Daj každému verdikt.“). Pri `max` v **tej istej
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

8b. **Verdikty overenia** zo zhrnutia spisovateľa zapíš k návrhom:
   ```bash
   $A navrh <id> overene --vysledok "<dôvod> (playtest <id turnusu>)" --zivy      # zabralo
   $A navrh <id> nezabralo --vysledok "<dôvod> (playtest <id turnusu>)" --zivy    # vráti sa Michalovi na rozhodnutie
   ```
   „Málo dát“ nechaj tak — návrh počká na ďalší playtest. Nezabraté návrhy
   sa samy vrátia do Prijímača roadmapy a navrhár ich pri ďalších návrhoch
   berie ako najsilnejší signál.

9. **Záznamy** (predvolený aj `max`):
   - do `docs/playtesty/zmeny-pravidiel.html` pri dotknutých zmenách blok
     „Výsledok playtestu <id>“ (1–3 vety z reportu),
   - do `docs/playtesty/vyvoj-znamok.html` na koniec poľa `PARTIE` každú
     partiu turnusu (známky oboch hráčov z `R/hrac*/feedback.md`, výsledok,
     dĺžka, odkaz na report; `zmenyPred` = doterajšie `CAKAJUCE`) a do
     `CAKAJUCE` zmeny pravidiel, ktoré vznikli po tomto playteste,
   - oba súbory potom nahraj na živý web (`$A report-nahraj … --zivy`),
   - zošity skúseností: `$P/skusenosti.ts kontrola` musí skončiť
     „Zošity sedia“ a zmeny v `tools/playtest/skusenosti/` sa commitnú
     spolu s reportom (master a push len Leader, `docs/SESSIONS.md`).

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
    - overenie zmien: pre každý overovaný návrh verdikt (zabralo / nezabralo /
      málo dát) a jedna veta; nezabraté čakajú na Michala v `<živý web>/playtest`,
    - pri `max`: odkaz na **`<živý web>/playtest`**, kde čakajú návrhy na
      rozhodnutie — pre každý jeden riadok (téma, kritickosť, odporúčaná
      možnosť, verdikt stratéga) a že po rozhodnutí ich implementuje
      `/naex-implementacia`; kľúčové čísla stratéga.
    Zmeny pravidiel sám nezavádzaj.

## Režim vyucba — playtest výučby „Prvá hra“ (Michal 2026-10-23, roadmapa #85)

Traja **nováčikovia** (`naex-novacik`, postavy v
`tools/playtest/novacikovia.json`) prejdú naraz výučbu ako ľudia, ktorí hru
nepoznajú: v headless Chrome so svojím rozlíšením (1920×1080, 1440×800,
1366×650), zo snímok obrazovky, myšou a klávesnicou. Pravidlá ani ťahák
nečítajú. Beží to na **lokálnom** dočasnom serveri (od :8800) s
`NAEX_VYUCBA=1`, takže výučbu dostane obyčajný návštevník aj pri vypnutom
vypínači `zverejnena`. Na živý web nič nejde.

`V` = `node --experimental-strip-types --no-warnings tools/playtest/vyucba.ts`.

1. Klient musí byť zbuildovaný z kódu, ktorý sa testuje
   (`npm run build --workspace=@naex/web`), inak nováčikovia uvidia starú UI.
   Over scenár: `node --experimental-strip-types --no-warnings tools/vyucba/prehraj.ts --ticho`
   musí vypísať „Scenár sedí.“
2. **Založ**: `$V zaloz [1–3]` vypíše reláciu `R` (`playtest/vyucba-<id>`),
   port a nováčikov s rozlíšením. Prehliadače stoja na titulnej stránke,
   každý účet je nový návštevník.
3. **Spusti nováčikov naraz** (v jednej správe, `naex-novacik`,
   `run_in_background: true`): „Relácia: R. Si nováčik N. Postava: <meno>,
   kto: <kto>, ako: <ako>, zameranie: <zameranie>. Rozlíšenie: <š×v>.
   Prejdi celú výučbu Prvá hra ako človek, ktorý hru nepozná, veď si denník
   a napíš spätnú väzbu s testom pochopenia.“ Používateľovi povedz, kto
   beží a že výučba trvá desiatky minút.
4. **Čakaj**, kým sa ozvú všetci (nepolluj). Potom `$V R suhrn`
   (zapíše `R/suhrn.json`) a `$V R ukonci`. Ak nováčik skončil predčasne,
   zapíš prečo do `R/organizator.md`.
5. **Report**: `naex-spisovatel` na pozadí: „Playtest výučby: relácia R.
   Napíš report podľa šablóny tools/playtest/vyucba-report.md do
   docs/playtesty/vyucba-<id>.html.“
6. **Odovzdaj** Leaderovi (session Playtesting) alebo používateľovi: verdikt,
   priemer V1–V10, skóre testu pochopenia, počet zaseknutí, tri hlavné
   opravy a cestu k reportu. Report na živý web nahraj
   (`admin.ts report-nahraj … --zivy`) len na pokyn.

Nástroj hľadá prvky výučby v DOM podľa dohody s UX/UI:
`[data-vyucba-bublina]` (s `data-vyucba-krok`) a `[data-vyucba-zvyraznene]`.
Krok výučby a hlášky servera berie zo záznamu WebSocketu (strážca v
`R/hrac<n>/zaznam/`), takže fungujú aj bez týchto atribútov.

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
- **Skúsenosti** (Michal 2026-10-25): playtesteri si vedú zošity
  v `tools/playtest/skusenosti/` (formát a kolobeh v `README.md`). Každá
  postava má vlastný zošit a všetci zdieľajú `spolocne.md`. Playtester
  skúsenosti len navrhuje, overuje a zapisuje ich spisovateľ. Pri novej
  `VERZIA_PRAVIDIEL` ich `skusenosti.ts over-verziu` označí ako neoverené
  (test to stráži). Nováčikovia výučby zošity nečítajú, majú byť vždy
  čerství.
