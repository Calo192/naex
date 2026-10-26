# NA EX!

Webová verzia kartovej hry **NA EX!** (Michal Calík) — dvaja hráči,
dva prehliadače, cez internet. Beží všade, kde je prehliadač.

Web má tri časti a prihlásenie:

| Časť | Kto | Čo |
|---|---|---|
| **Pravidlá** (`/pravidla`) | ktokoľvek | pravidlá v2 po kapitolách s ilustráciami a interaktívnymi ukážkami |
| **Karty** (`/karty`) | ktokoľvek | glosár kariet v tlačovom vzhľade, tooltipy akcií a pojmov, varianty |
| **Pravidlá › Karty** (`/pravidla/karty`) | ktokoľvek | každá karta s ilustráciou, efektom, príbehom a účelom v hre (texty píše admin v tvorcovi; hra ani výučba ich neukazujú) |
| **Hrať** (`/hra`) | prihlásený hráč | súkromná hra s kódom alebo verejná hra zo zoznamu, mená a avatary |
| **Tvorba** (`/admin`) | admin, subadmin | webová verzia MAUI aplikácie KartyAI — návrhy kariet, tvorca, akcie, kľúčové slová, farby, bodovacie karty, tlač, import/export, zverejnenie sady |
| **Hráči** (`/hraci`) | admin, subadmin | účty a úrovne (admin / subadmin / hráč / návštevník), značka AI; úrovne mení len admin |
| **Profil** (`/profil`, `/hrac/:id`) | prihlásený | herné meno, avatar, heslo; **Frajerina** a podrobné štatistiky z dohraných partií |
| **Rebríček** (`/rebricek`) | prihlásený | poradie hráčov podľa Frajeriny, hodnosti |
| **Spätná väzba** (`/spatna-vazba`) | prihlásený | názory na hru, komentáre, cigarety (obdoba „páči sa mi“); admin mení stav názoru |

**Stav:** míľniky M0–M14 hotové, k tomu Frajerina, štatistiky hráča a spätná
väzba; `npm run typecheck` a `npm test` končia s kódom 0 (130 testov vrátane
celej partie cez server, filtrovania pohľadu, účtov, rolí, zverejnenia sady,
Frajeriny, spätnej väzby a dĺžky hry).

## Spustenie

```bash
npm install
npm run dev   # server :8787 + klient http://localhost:5173
```

Heslo admina daj do `.env` v koreni repozitára (`NAEX_ADMIN_HESLO=…`, súbor
je mimo gitu) — server pri štarte založí účet **Admin**. Pri prvom štarte sa databáza (`data/naex.sqlite`) naplní tlačovou
sadou kariet a zverejní ako verzia 1. Obrázky z `docs/NA EX` pridáš do
knižnice tvorcu: `npm run kniznica -- "docs/NA EX/NA EX"`.

Ďalšie príkazy: `npm test`, `npm run typecheck`, `npm run build`,
`npm start` (produkčný server s klientom na :8787).

**Nasadenie na internet:** `docs/NASADENIE.md` (Hetzner VPS + Docker +
Caddy s HTTPS, ~6 € mesačne).

## Architektúra

```
packages/core/     jadro pravidiel — čistý TS, bez I/O, deterministické
  data/cards.json    východisková sada (z tlačového PDF, tools/import_print_pdf.py)
  data/elders.json   8 starších (len zoznam)
  data/scorecards.json  8 scorecardov z KartyAI — podmienky a body
packages/tvorba/   model tvorcu kariet — čistý TS (varianty, farby, geometria
                   karty, formát textu, export/import TXT)
packages/server/   autoritatívny server: hra (ws), REST API, SQLite, médiá
  seed/              ilustrácie a vzhľad kariet pre prvé spustenie
apps/web/          klient (React + Vite)
tools/             import z tlačového PDF, piktogramy akcií
  playtest/          AI playtest: konzolový klient (hrac.ts), založenie partie agentov
                     (zaloz.ts) aj agent proti človeku (zaloz-clovek.ts), spätná väzba
                     agentov na webe (web.ts) — skilly /naex-playtest a /naex-protihrac
```

- **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.**
  `viewFor()` posiela súperovu ruku a všetky doberacie balíčky len ako
  počty; dokazuje to test filtrovania a e2e test kontroluje každú správu.
- Klient posiela zámery (`Command`), server počíta (`apply`), klient
  kreslí (`ClientState`). Náhoda je jeden seedovaný generátor v stave.
- **Sady kariet:** admin upravuje návrhy; hráči, glosár a nové partie
  vidia len poslednú **zverejnenú** sadu. Rozohraná partia dohrá na sade,
  s ktorou začala. Zverejnenie overí návrhy cez `loadGameData` jadra;
  karta s vlastnou akciou bez pravidiel v jadre sa zverejniť nedá.
- **Pravidlá v3** (2026-10-11): dĺžka hry sa volí v lobby — krátka 3, stredná 5
  (predvolená), dlhá 7 lokalít (od 2026-10-24, predtým 5 / 7 / 11); dĺžka sa dá
  zvoliť, až keď má sada dosť lokalít.
  Každú kartu možno vyložiť do vlastnej aj súperovej partie a **patrí tomu,
  kto ju zahral** — akcie aj efekty sa rátajú majiteľovi (`evaluateLine`
  pripisuje súčty podľa `playedBy`, efekty cez `kartyHraca`/`maKartu`).
  Kočovník na súperovu stranu nemíňa limit (navrhnutý efekt, BRIEF otázka 10).
  **Názvoslovie:** polovice línie sú **strany** (`state.strany`), **partia** hráča
  = jeho karty na ktorejkoľvek strane (`partiaHraca`, `vPartii`). **NA EX** len na
  vlastnú kartu, s náhľadom bitky v hre; **Vypiť** (`{ type: "vypit" }`) v
  Zhromaždení: limit −1, pečeň +1, ďalšie vyloženie bez odovzdania ťahu. Akcie
  lokality dostane majiteľ susednej karty. Svokra za NA EX súpera ukradne 2 cigarety (BRIEF 11).
  **Ruka 5 kariet:** štartovacie karty idú do doberacieho balíčka, do ruky 5,
  na začiatku kola sa ruka dopĺňa na 5 (`KONSTANTY.VELKOST_RUKY`); nové
  kliatby idú do odhadzovacieho balíčka. V simulácii klesla priemerná ruka
  z 12–15 na ~7 kariet.
- **Starší a body počas hry:** rad starších je nad stolom (lupa sa nebije s rukou,
  dá sa zmenšiť). Pri každom staršom je ♥ priazeň (komu, s akým účinkom) a ★
  koho sa bojí a koľko bodov by dal teraz; súčet „body teraz" je pri hráčoch.
  Počíta to `bodyTeraz` v jadre z pohľadu hráča — vlastné skryté kliatby pozná
  cez `mojeKliatbyVBalicku`, súperove nevidí (odhad je potom označený „?").
- **Frajerina** je hodnotenie hráča podľa šachového Elo (`packages/server/src/frajerina.ts`):
  štart 1200, K = 32, súčet zmien je nulový. Rovný proti rovnému ±16, favorit
  s náskokom 400 nad slabším ±3, prekvapenie ±29. Prvých 5 partií je hodnotenie
  provizórne („1200?“). Vzdaná partia (`{ type: "vzdat" }`) je prehra; keď je
  súper odpojený 3 minúty, hráč si vyžiada kontumačnú výhru.
- **Štatistiky** počíta čistý modul jadra `statistiky.ts`: server po každom
  ťahu zavolá `zapisTah()` a po konci partie uloží súčty oboch hráčov do
  `partie` / `partie_hraci` (SQLite). Profil je súčet riadkov hráča.
- **Účty:** heslá scrypt, relácia v HttpOnly cookie (v databáze len hash
  tokenu), každá zmena nesie hlavičku `X-Naex` (CSRF), admin cesty
  overujú rolu na serveri. Nahraté súbory sa overujú podľa obsahu.

## Efekty kariet (M10)

Register `packages/core/src/effects.ts` pokrýva všetkých 50 id tlačovej sady.
Nová karta z tvorcu (neznáme id) beží automaticky v režime MANUAL.

- **Natívne v motore:** `dlh`, `cirhoza`, `kocovnik`, `abstak`.
- **Implementované:** všetky ostatné. Od 2026-10-12 (playtest
  20261012-055944) aj bývalé MANUAL efekty — výklad ich textov je
  v `docs/PRAVIDLA.md` §16. Efekty závislé od polohy v línii (Liberál,
  Silná nezávislá žena, Veterán, Zámočník, Šarlatán, Pijan) sú v
  `partia.ts` (`kartoveEfekty`), voľby hráča (Policajtka, Veštica,
  Benzínka, Poštárka, Starosta) sú príkazy motora.
- **Režim MANUAL** ostáva len pre nové karty z tvorcu, kým nedostanú
  implementáciu (hra ich v správnej fáze vypíše do logu so ⚠).

## Rozhodnuté nejasnosti (otvorené otázky z BRIEF-u)

Pravidlá v11 tieto veci nehovoria jednoznačne; správanie sa dá zmeniť
na jednom mieste v kóde (odkazy v zátvorkách). Michal ich všetky potvrdil
2026-10-22 (roadmapa #11).

1. **Posilnenie + Posilnenie** na spoji → nič sa nedeje (`partia.ts`).
2. **NA EX** je tá istá operácia na vlastnej aj súperovej karte: zruší
   aktívne, zdvojnásobí neaktívne akcie cieľovej karty; dôsledky jej
   akcií na susedoch (Posilnenie ×2, zrušenie Odporom) ostávajú
   (`partia.ts`, `applyNaex`).
3. **Podpora** — pojem aj spúšťač vypadli v pravidlách v4 (2026-10-23).
4. **Vzbura na lokalite** aktivuje len stranu patriacu danej partii
   (`partia.ts`, `markVzbura`).
5. **Cirhóza** — každá **priznaná** Cirhóza dá súperovi v každej bitke
   +1 tuhé (Michal 2026-10-20; predtým Cirhóza v línii) (`engine.ts`,
   `cirhozaBonus`; Veterinár ho znižuje).
6. **Absťák / neresti** — ako nerest sa počíta každý vypitý poldeci
   a každá minutá fyzická cigareta (fajčenie, refill, barter). Podľa
   pravidiel v2: menej než minulé kolo → Absťák rovno priznaný; viac →
   jeden Absťák späť do zásoby; prvé kolo len nastaví základ
   (`engine.ts`, `koniecBitky`).
10. **Robota** spáli priznaný Dlh (z hry, Michal 2026-10-21; predtým ho
   odhodila do balíčka), pred kontrolou prahu Exekútora (`engine.ts`).
11. **Prah Cirhózy** — pravidlá v2 uvádzajú raz „základ 3“, inde
   „Alkoholik: 2 + priazeň“. Michal 2026-10-12 rozhodol 3 + priazeň
   (`constants.ts`). Prah Dlhu (zadĺženie z akcií Dlh) je 2 + sila Úžerníka
   (Michal 2026-10-20).
7. **Štartovacia ruka** — 3× Pijan, 2× Miňištrant, 1× Milujúca
   manželka, 1× Dievčina na vydaj (Michal 2026-10-22, predtým 4/2/2/2;
   `KONSTANTY.START_RUKA`).
8. **Lokality** — dĺžka hry = počet bitiek o lokalitu: krátka 3, stredná 5,
   dlhá 7 (`DLZKY_HRY`, od 2026-10-24; predtým 5 / 7 / 11); sada má 15 lokalít.
9. **Šenok** — v každom kole sa stavia z toľkých kariet, koľko je
   nenahradených starších (nadol na párne, najviac polovica spoločného
   balíčka); po braní sa doplní z balíčka na 8. Keď sa spoločný balíček
   minie, šenok sa zmenšuje až na nulu (`engine.ts`, `velkostStavby`).

Ďalšie drobné rozhodnutia: prebytok rozdeľuje jeho **držiteľ** (vyššie
celkové) smerom k súperovi; veľkosť balíčka sa kontroluje po drafte
a na konci kola (nie uprostred, keď karty ležia v partiách); Vízia sa
vyhodnocuje automaticky (zahodí kliatby z práve dobraných); Pohreb
Závislého berie kartu zo šenku priamo (Liečba sa v4 zlúčila do Pohrebu); barter berie
len fyzické cigarety.

## Zmeny pravidiel po playteste 20261012-055944 (2026-10-12)

Rozhodnutia Michala z rozhovoru o odporúčaniach, skúšobné (podrobne
v `docs/playtesty/zmeny-pravidiel.html`, znenie v `docs/PRAVIDLA.md`):

- **Odpoveď na NA EX** — po súperovom NA EX jedna karta z ruky mimo limitu,
  striedavo (`engine.ts`, `PitkaStav.reakcia`, príkazy `place`/`bezReakcie`).
- **Nahradený starší ostáva v hre** (marker, priazeň, body, vydesenie).
- ~~Bitka o staršieho~~ — od 2026-10-20 ju nahradil **patronát** (krok draftu
  `patronat`, príkazy `patronat`/`bezPatronatu`, tajná náhrada v
  `GameState.patronat`, náhľad `nahladPatronatu` vo `view.ts`).
- **Úžerník** (prah Dlhu 2 + sila; nahradil Zberateľa a ten Očumovateľa — alias
  `OCUMOVATEL, ZBERATEL → UZERNIK`, server premenuje bodovaciu kartu v databáze).
- **Útočník draftuje prvý**, pitiek `max(1, |rozdiel|)`.
- **Body za kus** lokalita a starší 2; server berie body vždy z jadra.
- **Všetky efekty** tlačovej sady vyhodnocuje motor.
- Web: obrazovka konca hry, mobil, náhľad spojov, cena prebytku, značky NA EX.

## Zmeny pravidiel po playteste 20261011-183315 (2026-10-12)

Rozhodnutia Michala, skúšobné. Prečo a čo sledovať je v
`docs/playtesty/zmeny-pravidiel.html`, znenie pravidiel v `docs/PRAVIDLA.md`.

1. **Body za kus až od oranžovej zóny** — podmienky scorecardov za
   ovládnuté lokality, získaných starších a zvyšné cigarety bodujú, len keď
   je marker aspoň v oranžovej zóne (Strach); tresty za Dlhy a Cirhózy
   platia od žltej. V playteste dali riadky za kus v žltej zóne 51:1
   (`elders.ts`, `PRAH_PODMIENKY` / `prahPodmienky`).
2. **Nevyhnutné ťahy robí hra sama** — pas, keď hráč nemá čo vyložiť;
   „bez NA EX“, keď v Pitke nemá inú možnosť; vynechanie Pohrebu. Vypiť sa
   neponúka, keď sa nedá nič vyložiť do línie (`engine.ts`,
   `dohrajNevyhnutne`, `legalCommands`). Tretina príkazov playtestu boli
   takéto potvrdenia.
3. **Priznanie neodovzdá ťah** — kliatby sa priznávajú za sebou, nie na
   striedačku (`engine.ts`, `cmdPlace`).
4. **Prah Cirhózy 3** + priazeň Alkoholika (predtým 2;
   `KONSTANTY.PRAH_CIRHOZY_ZAKLAD`).
5. **Prah Dlhu 2** — akcie Hazard plnia počítadlo `zadlzenie` hráča
   (verejné, v hre ukazovateľ „Zadĺženie“); kartu Dlh hráč dostane až pri
   prahu. Dlhy, ktoré dávajú efekty kariet priamo (Poštárka, Výherný
   automat), idú rovno (`engine.ts`, `pridajZadlzenie`;
   `KONSTANTY.PRAH_DLHU`). Ďalšie pravidlá k zadĺženiu pribudnú.

Testy: `packages/core/test/tempo.test.ts`, `elders.test.ts`.

## Herné hodnoty mimo pravidiel v11

Všetko na jednom mieste: `packages/core/src/constants.ts`
a `packages/core/data/scorecards.json`. Michal ich potvrdil 2026-10-22
(roadmapa #11):

- **body za podmienky scorecardov** — za zóny strachu (1/2/3) a za kus
  lokality, získaného staršieho, cigarety, nepriznanej cirhózy (pravidlá
  udávajú len −1 za dlh); kladné za kus platia až od oranžovej zóny. Rozloženie podmienok je z KartyAI,
  scorecardy sa starším rozdávajú náhodne (rozhodnutie Michala 2026-10-11),
- rozdelenie **štartovacej ruky** (3/2/1/1) a počet **kópií kariet**
  v spoločnom balíčku (2).

## Zdroje

- Pravidlá v11: `C:\Users\Michal\Documents\Claude\naex_pravidla_v11_tlac.docx`
- Export kariet: `C:\Users\Michal\Documents\Claude\kartyai_cards_20260713_rozsirene.txt`
- `tools/parse_cards.py` — staršia cesta: `cards.json` z TXT exportu MAUI (ten istý TXT dnes importuje aj tvorca na webe)
