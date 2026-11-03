---
name: naex-styly
description: Spustí playtest herných štýlov NA EX! — 1 alebo 2 partie naraz, v každej dvaja AI hráči rôznych charakterov (ekonomický — investuje a body berie na konci; agresívny — sila, strach a zatváranie starších; klebetný — hádky, reči a prehováranie starších, body aj z prehier; sabotér — dlhy, kliatby a rušenie súperových plánov). Štýl je správanie, nie zoznam kariet: nástroje si hráči hľadajú sami, v každej partii skúšajú nové veci ako experimenty a vedú si strategický denník štýlu, takže sa z turnusu na turnus zlepšujú. Sudca štýlov potom napíše report — matica štýl proti štýlu, prečo štýl funguje alebo nie, overenie hypotézy „najviac cigariet a Vízií vyhrá vo finále“ a návrhy zmien kariet, akcií, mechanizmov a bodovania, aby každý štýl mohol vyhrať; s max ich stratég preverí turnajmi botov a navrhár dá do sekcie Playtest na rozhodnutie. Použi, keď používateľ povie /naex-styly, „playtest štýlov“, „otestuj herné štýly“, „funguje agresívny / ekonomický / klebetný / sabotér štýl“, „dá sa vyhrať inak ako cigaretami“, „rôzne stratégie“.
argument-hint: "[1|2|<styl>-<styl>…] [kratka|stredna|dlha] [max] [silni]"
---

# Playtest herných štýlov NA EX!

Si **organizátor** playtestu štýlov. Založíš partie, spustíš hráčov štýlov,
počkáš, kým dohrajú, a dáš spracovať report. Sám nehráš a do partií
nezasahuješ.

**Prečo (Michal 2026-11-03):** hráč si má vedieť zvoliť herný štýl odlišný
od súpera a s ním vyhrať. Dnes má Michal pocit, že vyhrá vždy ten, kto má
najviac cigariet a Vízií, v poslednom kole. Tento playtest neskúma 12
kritérií ani zábavu (to robí `naex-playtest`) — skúma, **či každý štýl vie
viesť k víťazstvu** a čo na kartách, akciách, mechanizmoch či bodovaní
zmeniť, aby to tak bolo.

## Štýly — `tools/playtest/styly.json`

| Kľúč | Štýl | AI účet | Charakter |
|---|---|---|---|
| `ekonom` | Ekonomický | Ekonóm Ďuro | trpezlivý investor — teraz menej, neskôr viac; rozhodujúci úder na koniec |
| `agresor` | Agresívny | Bitkár Rudo | rabiát — rozhodnúť silou a čo najskôr, strašiť starších, zatvárať ich do pivnice |
| `klebetnik` | Klebetný | Klebetná Mara | klebetnica — vyhrávať hádky, mať reči u starších, prehovárať ich; body aj z prehier |
| `saboter` | Sabotér | Sabotér Zdeno | záškodník — stačí, aby bol súper horší: dlhy, kliatby, rušenie jeho plánov |

V `styly.json` je **charakter**, **správanie**, čo štýl **nerobí**
a **ukazovatele** — žiadne karty (Michal 2026-11-03: štýl je správanie,
nástroje si hráč nájde sám). Nový štýl = ďalšia položka a prázdny denník
podľa `tools/playtest/denniky/README.md`.

## Učenie — strategické denníky (Michal 2026-11-03)

Každý štýl má **strategický denník** `tools/playtest/denniky/<kluc>.md`:
aktuálna stratégia, objavené nástroje (aj nezvyčajné použitia, napr. Nástroj
do Dedičstva namiesto línie) so stavom a dôkazom, experimenty s výsledkom,
zásobník nápadov a čo štýlu v hre chýba. Hráč štýlu ho pred partiou číta,
**v každej partii skúša 1–3 experimenty** (aspoň jeden úplne nový) a po
partii denník **sám** aktualizuje. Sudca stratégiu neprepisuje — len pripíše
poznámku, keď položka stojí na zle pochopenom pravidle alebo na čísle, ktoré
partia neukázala. Denníky sú v gite, takže história učenia je v `git log`.

## Parametre

`$ARGUMENTS`, v ľubovoľnom poradí, všetky voliteľné:

- **partie** — `1` alebo `2` (predvolene **2** = všetky štyri štýly naraz),
  alebo konkrétne dvojice `ekonom-agresor` (`klebetnik-saboter` …). Každý
  štýl má jeden AI účet, takže v turnuse hrá najviac raz — viac ako 2 partie
  ani zrkadlový zápas sa nedajú. Bez dvojíc vyberie `styly.ts` dvojice,
  ktoré sa v histórii (`docs/playtesty/styly-historia.json`) hrali najmenej
  — za tri turnusy sa odohrá celá matica 6 zápasov.
- **dĺžka** — `kratka` | `stredna` (predvolená) | `dlha`. Štýly, ktoré
  stavajú na neskorej hre (ekonóm), a štýly na skorú výhru (agresor) sa
  na dĺžke líšia najviac — pri porovnávaní turnusov ju drž rovnakú.
- **`max`** — po reporte stratég preverí odporúčané zmeny turnajmi botov
  a variantmi pravidiel a navrhár z nich spraví návrhy do sekcie
  **Playtest** na živom webe, kde o nich Michal rozhodne (kroky 7–8).
- **`silni`** — hráči štýlov bežia na modeli `opus` (inak `sonnet`
  z definície agenta). Drahšie; použi, keď predošlý turnus ukázal, že
  hráči štýl hrali zle a výsledok o štýle nič nehovorí.

## Agenti (`.claude/agents/`)

- `naex-hrac-stylu` — hrá jednu partiu za jeden charakter: prieskum
  nástrojov, plán s experimentmi, `spaky.md` po každej bitke, po partii
  aktualizuje strategický denník a napíše `R/hracN/rozbor-stylu.md`.
- `naex-sudca-stylov` — report `docs/playtesty/styly-<id>.html` (aj ako sa
  štýly učia), história `docs/playtesty/styly-historia.json`, poznámky
  k faktom v denníkoch, spoločné skúsenosti.
- pri `max`: `naex-strateg` (turnaje botov, varianty) a `naex-navrhar`
  (návrhy pre web).

## Postup

`A` = `node --experimental-strip-types --no-warnings tools/admin/admin.ts`,
`P` = `node --experimental-strip-types --no-warnings tools/playtest`.

0. **Prvé spustenie** — AI účty štýlov vzniknú samy pri založení partie.
   Avatar im nastav raz (Leonardo, Michal povolil):
   `$A avatar-generuj styl-<kluc> "<avatar zo styly.json>"`, najlepší
   obrázok `$P/web.ts avatar --ako "<meno>" --zivy <subor>`. Nie je to
   podmienka playtestu — môže sa dorobiť neskôr.

1. **Weby** — rovnako ako `naex-playtest`, krok 1: hrá sa na **Zrejúcej**
   (`$P/web.ts dostupny --zrejuca`, `$A server-stav --zrejuca` — commit
   Zrejúcej má byť `origin/master`, inak navrhni najprv
   `/naex-nasad zrejuca`). Nebeží Zrejúca → spýtaj sa, či hrať na dočasných
   lokálnych serveroch (bez `--zrejuca`; klient musí byť zbuildovaný).

2. **Založ turnus:**
   ```bash
   $P/styly.ts <partie|dvojice> <dĺžka> --zrejuca
   ```
   Výpis dá id turnusu (`playtest/turnus-<id>/turnus.json`, `druh: "styly"`)
   a pre každú partiu reláciu `R`, oboch hráčov so štýlom, charakterom
   a denníkom.

2b. **Otázky na overenie** — ak predošlý report štýlov
   (`docs/playtesty/styly-*.html`, najnovší) má časť „Čo sledovať v ďalšom
   playteste štýlov“, vezmi jej otázky a odporúčaný experiment pre každý
   štýl. Ak boli odvtedy implementované
   zmeny z návrhov štýlov (`$A navrhy implementovane --zivy --json`, návrhy
   s pôvodom v reporte štýlov a commitom v kóde Zrejúcej — postup ako
   `naex-playtest` krok 2b), pridaj ich otázky `overenie`.

3. **Spusti hráčov naraz** — v jednej správe `2 × počet partií` volaní
   Agent (`naex-hrac-stylu`, `run_in_background: true`, pri `silni`
   `model: "opus"`), pre každého:
   „Relácia: R. Si hráč N. Štýl: <kluc> (<názov>) — tvoj AI účet <meno>.
   Súper hrá štýl <názov súpera>. Partia je na Zrejúcej (verzia pravidiel
   z hlavičky docs/PRAVIDLA.md). Strategický denník štýlu:
   tools/playtest/denniky/<kluc>.md. Priprav sa (celé pravidlá, karty,
   moznosti.md, prieskum nástrojov, plan-stylu.md s 1–3 experimentmi),
   odohraj celú partiu ako expert, ktorý je svojím charakterom, veď
   spaky.md po každej bitke, potom aktualizuj denník a napíš
   rozbor-stylu.md.“ + otázky z kroku 2b („Otázky na overenie: …“,
   „Sudca odporúča vyskúšať: …“).

   Používateľovi povedz: kto proti komu (štýly a mená), dĺžku, followup
   a že partia trvá desiatky minút. Upozorni, aby sa do Zrejúcej
   neprihlasoval za AI účty štýlov (prevzal by im spojenie).

4. **Čakaj** — agenti sa ozvú sami, nepolluj. Keď dohrajú oba hráči
   partie:
   ```bash
   $P/hrac.ts R 1 stav > R/koniec-hrac1.txt
   $P/hrac.ts R 2 stav > R/koniec-hrac2.txt
   $P/ukonci.ts R
   ```
   Ak agent skončí bez dohranej partie, zapíš, čo sa stalo, do
   `R/organizator.md` a pokračuj — aj nedohraná partia je podklad.

5. **Report** — spusti `naex-sudca-stylov` na pozadí: „Turnus:
   playtest/turnus-<id>/turnus.json. Napíš report štýlov
   docs/playtesty/styly-<id>.html, doplň docs/playtesty/styly-historia.json
   a zapíš overené skúsenosti štýlov.“ (spomeň `organizator.md`, ak vznikol;
   pri otázkach na overenie: „Daj každej verdikt zabralo / nezabralo / málo
   dát.“)

6. **Nahraj report na živý web** (sekcia Playtest → Reporty, len admin
   a subadmin): `$A report-nahraj docs/playtesty/styly-<id>.html --zivy`.
   Verdikty overenia zapíš k návrhom ako v `naex-playtest`, krok 8b.

7. **Len `max` — stratég.** Spusti `naex-strateg`: „Playtest štýlov,
   turnus … . Report docs/playtesty/styly-<id>.html a história
   docs/playtesty/styly-historia.json. Odporúčané zmeny zo sekcie Návrhy
   zmien preveri: najsľubnejšie vyskúšaj ako varianty pravidiel vo worktree
   (turnaje botov, tools/bot/turnaj.ts — povahy botov sa štýlom len
   približujú, povedz, nakoľko). Pre každú zmenu: mení výsledok, posúva
   výhody medzi štýlmi, nevznikne nový dominant? Napíš
   docs/playtesty/strategia-styly-<id>.html.“

8. **Len `max` — návrhy na rozhodnutie.** Keď stratég dobehne, spusti
   `naex-navrhar`: „Playtest štýlov, turnus … . Podklady: report
   docs/playtesty/styly-<id>.html, rozbor stratéga
   docs/playtesty/strategia-styly-<id>.html. Z odporúčaných zmien priprav
   návrhy (najviac 5) — téma každého je štýl, ktorému chýba cesta
   k víťazstvu; v alternatívach uveď, ako zmena pôsobí na ostatné štýly.
   Výstup docs/playtesty/navrhy-styly-<id>.json a .html.“ Over JSON
   (`node -e "JSON.parse(require('fs').readFileSync('…','utf8'))"`) a nahraj:
   `$A report-nahraj docs/playtesty/strategia-styly-<id>.html --zivy`,
   `$A report-nahraj docs/playtesty/navrhy-styly-<id>.html --zivy`,
   `$A navrhy-nahraj docs/playtesty/navrhy-styly-<id>.json --zivy`.
   Schválené potom implementuje `/naex-implementacia` a overí ďalší
   playtest štýlov.

9. **Záznamy** — `$P/skusenosti.ts kontrola` musí skončiť „Zošity sedia“.
   Report, `styly-historia.json`, denníky `tools/playtest/denniky/`
   a `tools/playtest/skusenosti/spolocne.md` sa commitnú spolu (master
   a push len Leader, `docs/SESSIONS.md`). Ak agent skončil bez
   aktualizácie denníka, nedopisuj ho za neho — zapíš to do
   `organizator.md`.

10. **Odovzdaj výsledok používateľovi:**
    - odkaz na report (`<živý web>/playtest/reporty/styly-<id>.html`)
      a lokálny súbor,
    - výsledok každej partie (štýl proti štýlu, špaky, dôvod konca),
    - verdikt každého štýlu: tento turnus a doterajší (matica),
    - čo sa každý štýl naučil (experimenty, nové nástroje, zmena stratégie),
    - hypotéza o cigaretách a Víziách: potvrdená / vyvrátená / málo dát
      a mechanizmus,
    - 3–5 odporúčaných zmien (druh, ktorý štýl posilní / oslabí),
    - otázky pre Michala a potvrdené chyby v hre zvlášť,
    - pri `max` odkaz na `<živý web>/playtest` s návrhmi na rozhodnutie.
    Pripomeň, že partia je jeden údaj — o štýle hovorí až matica z viacerých
    turnusov. Zmeny pravidiel ani kariet sám nezavádzaj.

## Poznámky

- Relácie a turnusy sú v `playtest/` (v `.gitignore`); reporty
  a `styly-historia.json` v `docs/playtesty/` sú v gite.
- Hráč štýlu vidí len výstup `tools/playtest/hrac.ts` (`viewFor`) — súperov
  plán ani ruku nepozná; vie len názov súperovho štýlu, ako by ho vedel
  človek, ktorý súpera pozná.
- Na Spätnú väzbu webu hráči štýlov nepíšu a známky na /vyvoj nedávajú —
  výstupom je report pre Michala, nie názor hráča.
- Bežný playtest (`naex-playtest`, 6 postáv, 12 kritérií, strategickosť)
  ostáva samostatný: postavy majú voľnejší štýl a hodnotia celú hru;
  hráči štýlov sú dôsledne svojím charakterom, učia sa cez denník
  a hodnotia len to, či štýl vedie k víťazstvu.
