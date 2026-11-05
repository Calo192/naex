---
name: naex-styly
description: Spustí playtest herných štýlov NA EX! — 1 alebo 2 partie naraz, v každej dvaja AI hráči rôznych charakterov (ekonomický — investuje a body berie na konci; agresívny — sila, strach a zatváranie starších; klebetný — hádky, reči a prehováranie starších, body aj z prehier; sabotér — dlhy, kliatby a rušenie súperových plánov). Štýl je správanie, nie zoznam kariet: nástroje si hráči hľadajú sami, v každej partii skúšajú nové veci ako experimenty a vedú si strategický denník štýlu, takže sa z turnusu na turnus zlepšujú. Sudca štýlov potom napíše report — matica štýl proti štýlu, prečo štýl funguje alebo nie, overenie hypotézy „najviac cigariet a Vízií vyhrá vo finále“ a návrhy zmien kariet, akcií, mechanizmov a bodovania, aby každý štýl mohol vyhrať; s max ich stratég preverí turnajmi botov a navrhár dá do sekcie Playtest na rozhodnutie. Použi, keď používateľ povie /naex-styly, „playtest štýlov“, „otestuj herné štýly“, „funguje agresívny / ekonomický / klebetný / sabotér štýl“, „dá sa vyhrať inak ako cigaretami“, „rôzne stratégie“.
argument-hint: "[vypalena|zrejuca] [1|2|<styl>-<styl>…|kazdy] [kratka|stredna|dlha] [lokalne] [max] [silni]"
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
nástroje si hráč nájde sám). Nový štýl = ďalšia položka a prázdny denník v `vypalena/` aj `zrejuca/`
podľa `tools/playtest/denniky/README.md`.

## Učenie — strategické denníky (Michal 2026-11-03)

Každý štýl má **strategický denník** za každú verziu hry —
`tools/playtest/denniky/vypalena/<kluc>.md` a `…/zrejuca/<kluc>.md`
(pravidlá sa líšia, čo platí na jednej, na druhej nemusí):
aktuálna stratégia, objavené nástroje (aj nezvyčajné použitia, napr. Nástroj
do Dedičstva namiesto línie) so stavom a dôkazom, experimenty s výsledkom,
zásobník nápadov a čo štýlu v hre chýba. Hráč štýlu ho pred partiou číta,
**v každej partii skúša 1–3 experimenty** (aspoň jeden úplne nový) a po
partii denník **sám** aktualizuje. Sudca stratégiu neprepisuje — len pripíše
poznámku, keď položka stojí na zle pochopenom pravidle alebo na čísle, ktoré
partia neukázala. Denníky sú v gite, takže história učenia je v `git log`.

## Parametre

`$ARGUMENTS`, v ľubovoľnom poradí:

- **verzia hry** — `vypalena` (živý web, oficiálna hra, zverejnená sada)
  alebo `zrejuca` (pokusná, kód `master`, rozpracovaná sada). **Vyberá ju
  Michal pred každým playtestom** (2026-11-05): ak v argumentoch chýba,
  najprv sa spýtaj (AskUserQuestion, dve možnosti s jednou vetou, čo sa na
  nich teraz líši — `git log --oneline origin/vypalena..origin/master`
  zhrnuté) a až potom pokračuj. Nehádaj ju.

Ostatné sú voliteľné:

- **partie** — `1` alebo `2` (predvolene **2** = všetky štyri štýly naraz),
  alebo konkrétne dvojice `ekonom-agresor` (`klebetnik-saboter` …). Každý
  štýl má jeden AI účet, takže v turnuse hrá najviac raz — viac ako 2 partie
  ani zrkadlový zápas sa nedajú. Bez dvojíc vyberie `styly.ts` dvojice,
  ktoré sa v histórii (`docs/playtesty/styly-historia.json`) hrali najmenej
  — za tri turnusy sa odohrá celá matica 6 zápasov (každá verzia má vlastnú
  maticu).
- **`kazdy`** — každý s každým: všetkých 6 zápasov v **troch kolách** za
  sebou (každé kolo = turnus s 2 partiami, všetky štyri štýly):
  `ekonom-agresor klebetnik-saboter`, potom `ekonom-klebetnik
  agresor-saboter`, potom `ekonom-saboter agresor-klebetnik`. Ďalšie kolo
  založ, až keď sú obe partie predošlého dohraté a hráči aktualizovali
  denníky — ďalšie kolo sa tak učí z predošlého. Sudca píše na konci
  **jeden** report za všetky tri turnusy (krok 5 dostane všetky
  `turnus.json`). Trvá rádovo hodiny.
- **`lokalne`** — len so `zrejuca`: Zrejúca na dočasných lokálnych
  serveroch (`styly.ts … --zrejuca --lokalne`; kód `master`, sada
  z `cards.json`, ktorá môže mierne zaostávať za tvorcom). Keď session
  živý web nedosiahne (cloud bez siete na doménu a bez hesiel; Michal
  2026-11-05). Ide do denníkov a histórie Zrejúcej; v reporte sa to uvedie.
  Kroky 1 a 6 vtedy odpadnú (web), klient musí byť zbuildovaný
  (`npm run build --workspace=@naex/web`), po partii `$P/ukonci.ts R`
  zastaví jej server.
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

Ďalej `W` = `--zivy` (Vypálená) alebo `--zrejuca` (Zrejúca) podľa zvolenej
verzie, `D` = `tools/playtest/denniky/<vypalena|zrejuca>/<kluc>.md`.

1. **Web zvolenej verzie** — `$P/web.ts dostupny W` a `$A server-stav W`:
   - Vypálená: nasadený commit má byť `origin/vypalena`; ak práve beží
     `/naex-nasad` (uzávierka), počkaj.
   - Zrejúca: nasadený commit má byť `origin/master`, inak navrhni najprv
     `/naex-nasad zrejuca` (inak by sa hral starší kód, než aký čítajú
     hráči v `master`).
   Nebeží → povedz to používateľovi a skonči. Na druhú verziu ani lokálne
   sa náhradou nehrá — výsledok by patril do iného denníka.

1b. **Koreň verzie `V`** — klient, pravidlá, ťahák a sada musia byť z tej
   istej verzie ako server:
   - Vypálená: `git fetch -q origin`, potom
     `git worktree add --detach ../naex-styly-vyp origin/vypalena` (ak už
     existuje: `git -C ../naex-styly-vyp checkout --detach origin/vypalena`)
     a v ňom `npm ci`. `V` = jeho absolútna cesta. Vo `V` sa nič nemení.
   - Zrejúca: `V` = hlavný strom (absolútna cesta), aktuálny `origin/master`
     (`git pull --ff-only`, ak je strom čistý; inak povedz, čo bráni).

2. **Založ turnus** (z hlavného stromu):
   ```bash
   $P/styly.ts <partie|dvojice> <dĺžka>              # Vypálená
   $P/styly.ts <partie|dvojice> <dĺžka> --zrejuca    # Zrejúca
   ```
   Partie vzniknú na zvolenej verzii pod AI účtami štýlov. `--lokalne` je
   len na skúšku nástroja (dočasný server z `master`) — taká partia do
   denníkov ani do histórie nejde.
   Výpis dá id turnusu (`playtest/turnus-<id>/turnus.json`, `druh: "styly"`)
   a pre každú partiu reláciu `R`, oboch hráčov so štýlom, charakterom
   a denníkom.

2b. **Otázky na overenie** — ak predošlý report štýlov
   (`docs/playtesty/styly-*.html`, najnovší) má časť „Čo sledovať v ďalšom
   playteste štýlov“, vezmi jej otázky a odporúčaný experiment pre každý
   štýl. Ak boli odvtedy implementované
   zmeny z návrhov štýlov (`$A navrhy implementovane --zivy --json`, návrhy
   s pôvodom v reporte štýlov, ktorých commit je už v hranej verzii:
   `git merge-base --is-ancestor <hash> origin/vypalena` pri Vypálenej,
   `origin/master` pri Zrejúcej), pridaj ich otázky `overenie`.

3. **Spusti hráčov naraz** — v jednej správe `2 × počet partií` volaní
   Agent (`naex-hrac-stylu`, `run_in_background: true`, pri `silni`
   `model: "opus"`), pre každého:
   „Relácia: R (absolútne). Si hráč N. Štýl: <kluc> (<názov>) — tvoj AI účet
   <meno>. Súper hrá štýl <názov súpera>. Verzia hry: <Vypálená|Zrejúca>.
   Koreň verzie: V — pravidlá, ťahák, karty aj klient sú odtiaľ.
   Strategický denník štýlu (hlavný strom): D. Spoločný zošit čítaj pre
   <vypalena|zrejuca>. Priprav sa (celé pravidlá, karty,
   moznosti.md, prieskum nástrojov, plan-stylu.md s 1–3 experimentmi),
   odohraj celú partiu ako expert, ktorý je svojím charakterom, veď
   spaky.md po každej bitke, potom aktualizuj denník a napíš
   rozbor-stylu.md.“ + otázky z kroku 2b („Otázky na overenie: …“,
   „Sudca odporúča vyskúšať: …“).

   Používateľovi povedz: kto proti komu (štýly a mená), dĺžku, followup
   verziu hry a že partia trvá desiatky minút. Upozorni, aby sa na web
   neprihlasoval za AI účty štýlov (prevzal by im spojenie). Pri Vypálenej:
   kým partie bežia, `/naex-nasad` na ne počká; pri Zrejúcej:
   `/naex-nasad zrejuca` nečaká a partie by zhodil — počas playtestu ho
   nespúšťaj.

4. **Čakaj** — agenti sa ozvú sami, nepolluj. Keď dohrajú oba hráči
   partie:
   ```bash
   cd V && node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 1 stav > R/koniec-hrac1.txt
   cd V && node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 2 stav > R/koniec-hrac2.txt
   ```
   (Server je živý web, nič sa nezastavuje.)
   Ak agent skončí bez dohranej partie, zapíš, čo sa stalo, do
   `R/organizator.md` a pokračuj — aj nedohraná partia je podklad.

5. **Report** — spusti `naex-sudca-stylov` na pozadí: „Turnus:
   playtest/turnus-<id>/turnus.json. Verzia: <Vypálená|Zrejúca>, koreň
   verzie V. Napíš report štýlov
   docs/playtesty/styly-<id>.html, doplň docs/playtesty/styly-historia.json
   a zapíš overené skúsenosti štýlov.“ (spomeň `organizator.md`, ak vznikol;
   pri otázkach na overenie: „Daj každej verdikt zabralo / nezabralo / málo
   dát.“)

6. **Nahraj report na živý web** (ak ho session dosiahne; inak report
   commitni a pushni a nahraje ho najbližšia session na Michalovom PC) (sekcia Playtest → Reporty, len admin
   a subadmin): `$A report-nahraj docs/playtesty/styly-<id>.html --zivy`.
   Verdikty overenia zapíš k návrhom ako v `naex-playtest`, krok 8b.

7. **Len `max` — stratég.** Spusti `naex-strateg`: „Playtest štýlov,
   turnus … . Report docs/playtesty/styly-<id>.html a história
   docs/playtesty/styly-historia.json. Odporúčané zmeny zo sekcie Návrhy
   zmien preveri: najsľubnejšie vyskúšaj ako varianty pravidiel vo worktree
   nad hranou verziou (origin/vypalena alebo origin/master)
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
   Report, `styly-historia.json`, denníky `tools/playtest/denniky/<verzia>/`
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

- Partie štýlov sú medzi dvoma AI účtami: do Frajeriny ľudí
  ani do štatistík kariet „len ľudia“ (rebalans) sa nerátajú — server AI
  účty rozlišuje. Ľudia ich na webe môžu vidieť.
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
