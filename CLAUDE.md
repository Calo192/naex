# NA EX! — kontext projektu

Webová verzia kartovej hry **NA EX!** (autor Michal Calík).
Dvaja hráči, dva prehliadače, cez internet. Web má tri časti: **pravidlá**
(vzdelávanie), **tvorba kariet** pre admina (port MAUI aplikácie KartyAI)
a **hra**; k tomu účty s úrovňami admin / subadmin / hráč / návštevník a profil
(herné meno, avatar).

`docs/PRAVIDLA.md` je špecifikácia pravidiel — v `master` v11 Strach a reči
(Zrejúca), vo vetve `vypalena` v10.4 (Vypálená, hrajú ju hráči). Kto čo robí
a o aké zdroje sa nebiť: `docs/SESSIONS.md`. Pôvodné zadanie (M0–M10, otvorené
otázky) je `docs/BRIEF.md` — história; platforma M11–M14 je v `README.md`.

## Rozsah

Hra je **1 na 1** a pribúda formát **2 na 2** — dva tímy po dvoch hráčoch,
ktorý bude súčasťou hry (Michal 2026-10-28; roadmapa #21–#31, otázky
docs/napady/2na2-otazky.html). Rozhodnuté: jedna línia, strany patria tímom,
poradie striedavo tímy U1 → O1 → U2 → O2, „súper“ = druhý tím ako celok.
Kým nie je § Formát 2 na 2 v PRAVIDLA.md, platí všetko pre 1 na 1.

## Nemenné pravidlá

1. **`packages/core` a `packages/tvorba` neobsahujú žiadne I/O.** Žiadne DOM, `fetch`,
   `WebSocket`, `Date.now()`, `Math.random()`. Ten istý kód beží v prehliadači
   aj na serveri.
2. **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.** Skryť kartu
   v rozhraní je bezcenné — stačí konzola prehliadača. Filtrovanie patrí do
   `viewFor()` a musí byť otestované.
3. **Klient posiela zámery, nikdy výsledky.** Server počíta, klient kreslí.
4. **Náhoda je deterministická.** Jeden seedovaný generátor v `GameState`.
5. **Dáta, nie kód.** Karty upravuje admin v tvorcovi (SQLite): Vypálená hrá
   zverejnenú sadu, Zrejúca rozpracovaný stav tvorcu. `packages/core/data/cards.json`
   (východisko pre prvé spustenie a testy) je kópia sady z tvorcu bez Presbitera
   a karty Dlh, ručne sa neupravuje: v `master` rozpracovanej, vo `vypalena`
   zverejnenej. Značku v `dorovnajSoSeedom` meň až po skopírovaní cards.json (inak
   bežiaci dev server preseeduje tvorcu starou sadou); ilustrácie a vzhľad prenesie
   `tools/admin/do-seedu.ts` (docs/NASADENIE.md). História sád je v gite.
6. **Server púšťa `.ts` priamo (strip-types)** — len vymazateľná syntax
   (`erasableSyntaxOnly`): žiadne parametrické vlastnosti, enumy, namespaces.

## Príkazy

```bash
npm install
npm run dev          # server :8787 + klient :5173 (heslo admina: .env, NAEX_ADMIN_HESLO)
npm start            # produkcia: server + zbuildovaný klient :8787
npm run kniznica -- "docs/NA EX/NA EX"   # obrázky do knižnice tvorcu
npm run hudba -- "<priečinok s MP3>"     # hudba počas partie (stiahnutá zo Suno) do data/hudba
npm run melichar -- "data/majster_melichar"   # hlášky Melichara: priečinok = skupina na pulte (skupina.json: názov,
                     # ikona, farba, kláves, nálady momentov); nová hláška = súbor do priečinka, nová skupina =
                     # nový priečinok + skupina.json; „_“ sa nenahrá; import synchronizuje (docs/NASADENIE.md 5c).
                     # Hlášky s etnickými nadávkami sa nepridávajú (Michal 2026-10-23)
node --experimental-strip-types --no-warnings tools/admin/admin.ts <príkaz>   # nástroje agenta naex-admin
                     # ilustrácie: Leonardo.Ai API, kľúč NAEX_LEONARDO_KEY v .env (stojí API kredit);
                     # Michal 2026-10-21: na AKÝKOĽVEK nový obrázok smieš Leonardo použiť bez pýtania
node --experimental-strip-types --no-warnings tools/playtest/turnus.ts 2 stredna   # 2 partie AI playtesterov naraz (skill naex-playtest)
node --experimental-strip-types --no-warnings tools/playtest/styly.ts 2 stredna --zrejuca   # playtest herných štýlov (skill naex-styly):
                     # ekonóm, agresor, klebetník, sabotér (styly.json); report docs/playtesty/styly-<id>.html
node --experimental-strip-types --no-warnings tools/bot/turnaj.ts 20 chamtivy stredna stamgast   # sila povahy bota
node --experimental-strip-types --no-warnings tools/bot/strategickost.ts   # náhoda vs. zručnosť (rebrík, duplikát), ≈ 8 min
node --experimental-strip-types --no-warnings tools/upratovanie/odtlacok.ts   # odtlačok hry: partie botov s pevnými semienkami;
                     # refaktor (agent naex-upratovac, piatok 04:00 SEČ, PR do master) ho nesmie zmeniť
npm test             # vitest
npm run typecheck    # tsc --build
npm run build
```

**Živý web** je https://15-235-242-12.sslip.io (OVH, `deploy/nahraj.sh`;
heslo admina v `deploy/.env.produkcia`, mimo gitu). Nástroje agentov naň idú
prepínačom `--zivy`. Playtesty a návrhy z nich sú v sekcii **Playtest**
(len admin a subadmin); Michal tam o návrhoch rozhoduje a schválené
implementuje skill `naex-implementacia` (agent `naex-developer`): hneď commit,
push a merge do master bez pýtania (Michal 2026-10-21). Implementovaný návrh
sa uzavrie až verdiktom ďalšieho playtestu (overené / nezabralo — nezabratý
sa vráti Michalovi); návrhy z dizajnu (`naex-dizajn`) a rozpory pravidiel
s kódom (`naex-rozhodca`) idú tou istou cestou. Na živý web nasadzuje
`/naex-nasad` (počká na rozohrané partie), čo kde čaká ukáže `/naex-stav`.

**Vypálená a Zrejúca** (Michal 2026-11-02): **Vypálená** = oficiálna hra
(živý web vyššie, vetva `vypalena`, zverejnená sada). **Zrejúca** = ďalšia
verzia hry v testovaní, „aktuálna + 1“, ktorá raz celá nahradí Vypálenú; kód
z `master`, samostatný kontajner s vlastnou databázou, účty z Vypálenej.
- **Jedna adresa:** Zrejúca je ďalšia voľba hry na stránke Hrať; prehliadač
  prepne cookie `naex_instancia` (Caddy), nástroje agentov idú na `<doména>/zrejuca`. Hrá ten, komu admin
  udelí oprávnenie — predvolene admin, subadmini, AI účty a hráči s rankom
  Sedmička.
- **Nasadenie:** `/naex-nasad zrejuca` okamžite na Michalov pokyn, bez
  uzávierky a čakania; nesmie zhodiť partie Vypálenej. Vypálená
  `/naex-nasad` (čaká na partie).
- **Obsah Zrejúcej sú pravidlá, módy aj zmeny kariet.** Zmeny kariet pre
  Zrejúcu robí admin ako **rozpracovaný stav tvorcu Vypálenej** (nezverejniť —
  Vypálená hrá zverejnenú sadu, Zrejúca rozpracovanú); `cards.json` v `master`
  zodpovedá Zrejúcej, vo vetve `vypalena` zverejnenej sade.
- **Prechod do Vypálenej** len po Michalovom schválení celého stavu naraz:
  posun `vypalena` na master + zverejnenie sady + Novinky (nikdy na žiadosť
  agenta). **Výučba** pre novú verziu sa robí až pri tomto prechode.
- Nástroje: `--zivy` = Vypálená, `--zrejuca` = Zrejúca; playtest
  `turnus.ts … --zrejuca` (známky AI zo Zrejúcej nejdú do /vyvoj). Detail
  v docs/NASADENIE.md, časť 9.

Verejná stránka **Vývoj** (`/vyvoj`, Michal 2026-10-21): priemery známok hry
podľa 12 kritérií playtestu v čase (ľudia, AI, spolu; ľudia až od 3
hodnotiteľov, nikdy jednotlivec) a **roadmapa** (`/vyvoj/roadmapa`, stĺpce =
horizonty, poradie zhora = priorita). Schválený návrh z Playtestu padne sám do
Prijímača roadmapy; Developer berie stĺpec Teraz zhora (`admin.ts roadmapa`).
Hráči hodnotia v Spätnej väzbe, AI playtesteri po partii `web.ts znamky`
(história: `tools/playtest/znamky-import.ts`). Návštevník je hráčom po prvej
dohratej partii, aj proti botovi (do štatistík sa partie s botom nerátajú).

Verejná stránka **Novinky** (`/novinky`, Michal 2026-10-22): zmeny, ktoré sa
týkajú hráčov (pravidlá, karty, dizajn, web, opravy). Spravuje ju agent
naex-admin (`admin.ts novinka-pridaj`) — novinka sa píše až po nasadení na
živý web, pre hráča, nie pre vývojára.

## Konvencie

- **Doménové pojmy po slovensky**: `Partia`, `poldeci`, `zhromazdenie`,
  `naex`, `staresina`, `priazen`. Neprekladaj ich.
- Programátorské názvy (`apply`, `resolve`, `state`) anglicky.
- Komentáre po slovensky a len tam, kde vysvetľujú **prečo**.
- `strict` TypeScript, žiadne `any`, nemenný stav.
- Bez ďalších závislostí — čo treba, je v `package.json`. Databáza je
  vstavané `node:sqlite` (rozhodnutie Michala 2026-10-10), heslá `node:crypto`.

## Čo nerobiť

- **Žiadne umelé stropy a limity zdrojov** („najviac X cigariet“, „najviac N za Pitku“,
  „nad X prepadne“). Prebytok, ktorý sa hromadí, musí hra riešiť tým, že dá hráčovi
  možnosť ho minúť alebo zúžitkovať — nová akcia, karta, výkupné za špaky (Michal 2026-10-27).
- Žiadne AI, žiadne DSL na efekty.
- Žiadne ORM, Redux, router ani UI kit — router je `apps/web/src/lib/router.tsx`.
- Nevymýšľaj si chýbajúce herné hodnoty potichu — daj ich do `data/` s `TODO`
  a spýtaj sa. Zoznam otvorených otázok je v `docs/BRIEF.md`.

## Kde je čo

```
packages/core/       jadro pravidiel — čistý TS, bez I/O
  data/cards.json      sada kariet (master = Zrejúca, vypalena = zverejnená; pravidlo 5, neupravuj ručne)
  data/elders.json     8 starších; priazeň nesie scorecard (scorecards.json)
  src/bot.ts           offline protihráč (NPC: heuristiky + výpočet dopredu, žiadne
                       LLM); tri povahy (POVAHY) — Štamgast, Rapavý Fero, Teta
                       Gizka; server losuje. Skryté info pred výpočtom zamieša
packages/tvorba/     model tvorcu kariet — čistý TS (varianty, geometria karty,
                     farby, formát textu, export/import TXT)
packages/server/     server: hra (ws), REST API (/api), SQLite, médiá (/media)
  seed/                ilustrácie a vzhľad kariet pre prvé spustenie
  seed/avatary/        predvolené avatary (náhodný pre hráča bez fotky), boti/<povaha>.jpg
apps/web/            klient (React + Vite): stranky/, hra/, admin/, karta/,
                     playtest/ (sekcia Playtest: návrhy na rozhodnutie, reporty)
deploy/, Dockerfile  nasadenie (docs/NASADENIE.md)
docs/BRIEF.md        pôvodné zadanie M0–M10 (história) a otvorené otázky
docs/PRAVIDLA.md     špecifikácia pravidiel (staré znenia v docs/pravidla-historia.md)
tools/               import z tlačového PDF, piktogramy akcií
  bot/turnaj.ts        turnaj offline protihráča (proti náhodnému / chamtivému / sebe /
                       starej verzii bota z iného worktree); vypíše, ktoré ťahy bot používa
  bot/strategickost.ts meranie strategickosti — podklad agenta naex-strateg (skill naex-strategia)
  admin/               nástroje agenta naex-admin (admin API, rebalans, štýl ilustrácií,
                       nahrávanie reportov a návrhov, avatary AI účtov, linka, server-stav)
  playtest/            klient AI playtesterov; hraci.json = 6 postáv (štýl, zameranie),
                       turnus.ts = 1–3 partie naraz s náhodnými dvojicami,
                       tahak.md = ťahák pravidiel AI hráčov (jediné miesto, čísla stráži test)
                       styly.json = 4 herné štýly ako charaktery (ekonóm, agresor, klebetník, sabotér)
                       pre playtest štýlov — či každý štýl vie vyhrať (skill naex-styly, agenti
                       naex-hrac-stylu, naex-sudca-stylov); denniky/<kluc>.md = strategický denník
                       štýlu, ktorý si hráč sám vedie a zlepšuje experimentmi
  rozhodca/            mapa „paragraf PRAVIDLA.md → test“ agenta naex-rozhodca
```
