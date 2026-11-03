---
name: naex-styly
description: Spustí playtest herných štýlov NA EX! — 1 alebo 2 partie naraz, v každej dvaja AI hráči rôznych štýlov (ekonomický — Vízie, veľa kariet a body vo finále; agresívny — tuhé poškodenie a zatváranie starších; klebetný — mäkké poškodenie, reči a prehováranie starších, body aj z prehier; sabotér — dlhy, Cirhózy a rušenie súperových kariet a NA EX), ktorí štýl držia aj tam, kde by univerzálny ťah bol lepší. Sudca štýlov potom napíše report — matica štýl proti štýlu, prečo štýl funguje alebo nie, overenie hypotézy „najviac cigariet a Vízií vyhrá vo finále“ a návrhy zmien kariet, akcií, mechanizmov a bodovania, aby každý štýl mohol vyhrať; s max ich stratég preverí turnajmi botov a navrhár dá do sekcie Playtest na rozhodnutie. Použi, keď používateľ povie /naex-styly, „playtest štýlov“, „otestuj herné štýly“, „funguje agresívny / ekonomický / klebetný / sabotér štýl“, „dá sa vyhrať inak ako cigaretami“, „rôzne stratégie“.
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

| Kľúč | Štýl | AI účet | Ako chce vyhrať |
|---|---|---|---|
| `ekonom` | Ekonomický | Ekonóm Ďuro | Vízie, veľa kariet, cigarety a poldeci; body hlavne vo finále a výkupnom |
| `agresor` | Agresívny | Bitkár Rudo | tuhé poškodenie, Nakladačka na strach, zatváranie starších (zajatie) — výhra strachom či väzňami |
| `klebetnik` | Klebetný | Klebetná Mara | mäkké poškodenie, hádka na reči, prehováranie starších (presvedčenie); body aj z prehratých bitiek |
| `saboter` | Sabotér | Sabotér Zdeno | súperovi dlhy, Cirhózy a Absťáky, rušenie jeho kariet a NA EX, podstrčené zlé karty |

Cieľ, páky (karty, akcie, lokality, priazne, väzni), disciplína a merané
ukazovatele každého štýlu sú v `styly.json` — štýl upravíš tam, nový štýl
pridáš ako ďalšiu položku (k nemu prázdny zošit
`tools/playtest/skusenosti/styl-<kluc>.md`; test zošitov to stráži).

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

- `naex-hrac-stylu` — hrá jednu partiu za jeden štýl a píše
  `R/hracN/rozbor-stylu.md` a `spaky.md` (špaky a zdroje po každej bitke).
- `naex-sudca-stylov` — report `docs/playtesty/styly-<id>.html`, história
  `docs/playtesty/styly-historia.json`, zošity skúseností štýlov.
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
   a pre každú partiu reláciu `R`, oboch hráčov so štýlom, cieľom a zošitom.

2b. **Otázky na overenie** — ak predošlý report štýlov
   (`docs/playtesty/styly-*.html`, najnovší) má časť „Čo sledovať v ďalšom
   playteste štýlov“, vezmi jej otázky. Ak boli odvtedy implementované
   zmeny z návrhov štýlov (`$A navrhy implementovane --zivy --json`, návrhy
   s pôvodom v reporte štýlov a commitom v kóde Zrejúcej — postup ako
   `naex-playtest` krok 2b), pridaj ich otázky `overenie`.

3. **Spusti hráčov naraz** — v jednej správe `2 × počet partií` volaní
   Agent (`naex-hrac-stylu`, `run_in_background: true`, pri `silni`
   `model: "opus"`), pre každého:
   „Relácia: R. Si hráč N. Štýl: <kluc> (<názov>) — tvoj AI účet <meno>.
   Súper hrá štýl <názov súpera>. Partia je na Zrejúcej (verzia pravidiel
   z hlavičky docs/PRAVIDLA.md). Priprav sa (celé pravidlá, karty,
   moznosti.md, plan-stylu.md), odohraj celú partiu ako expert, ktorý drží
   svoj štýl, veď spaky.md po každej bitke a napíš rozbor-stylu.md.
   Zošit: tools/playtest/skusenosti/styl-<kluc>.md a spolocne.md.“ +
   otázky z kroku 2b („Otázky na overenie: …“).

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
   Report, `styly-historia.json` a zošity `tools/playtest/skusenosti/`
   sa commitnú spolu (master a push len Leader, `docs/SESSIONS.md`).

10. **Odovzdaj výsledok používateľovi:**
    - odkaz na report (`<živý web>/playtest/reporty/styly-<id>.html`)
      a lokálny súbor,
    - výsledok každej partie (štýl proti štýlu, špaky, dôvod konca),
    - verdikt každého štýlu: tento turnus a doterajší (matica),
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
  hráči štýlov štýl dodržiavajú dôsledne a hodnotia len to, či štýl vedie
  k víťazstvu.
