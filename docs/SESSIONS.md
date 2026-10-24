# Jedna session a agenti — pravidlá práce

Od 2026-10-24 (Michal) beží NA EX! v **jednej session — Leader**. Michal hovorí
len s ním. Prácu robia **agenti**, ktorých Leader spúšťa nástrojom Agent na
jednu úlohu: začnú s malým kontextom, prácu urobia a vrátia krátku správu.
Predtým bežalo naraz 7–8 sessions s pevnými rolami. Meranie z 2026-10-24
ukázalo, že 97 % tokenov išlo na opakované čítanie ich rastúceho kontextu,
nie na prácu.

Druhú session Michal otvorí len na dlhú prácu, ktorú chce viesť sám (napr.
viac kôl dizajnu). Vtedy pre ňu platí časť „Ďalšia session“ nižšie.

## Agenti

| Agent | Model | Na čo |
|---|---|---|
| `naex-programator` | Opus | funkcie, opravy, UI v klientovi, nástroje — vetva v pracovisku, commit, bez push |
| `naex-napady` | Opus | dávky nápadov, scenár výučby, osnovy a audity pravidiel |
| `naex-admin` | Opus | karty v tvorcovi, priradenie ilustrácií, rebalans, Novinky |
| `naex-ilustrator` | Opus | všetky obrázky (Leonardo) vo všetkých aktívnych štýloch, koláž na výber, katalóg štýlov `tools/admin/styly.json` |
| `naex-ui`, `naex-ux` | Opus | návrhy dizajnu s ukážkami (skill `naex-dizajn`) |
| `naex-ui-inspektor` | Sonnet | meranie UI chýb na lokálnom serveri (1 kolo + kontrola opráv) |
| `naex-oko` | Sonnet | snímky: čo je kde, orezané, prekryté, konzola — vráti text |
| `naex-citac` | Sonnet | dlhé dokumenty, reporty, logy — odpovede s `cesta:riadok` |
| `naex-overovac` | Haiku | rebase, test, typecheck, build — verdikt a padnuté testy |
| `Explore` (vstavaný) | — | kde je čo v kóde |
| playtest, stratég, rozhodca, bot-tréner, developer | podľa definície | cez svoje skilly (`/naex-playtest`, `/naex-strategia`, …) |

Model sa vyberá podľa úlohy: Opus na kód a návrhy, Sonnet na pozeranie
a čítanie, Haiku na mechanické overenie. **Nový druh agenta** Leader nezakladá
sám (Michal 2026-10-24). Keď by sa na úlohu hodil, upozorní Michala a navrhne
mu rolu a model. Agenta vytvorí až po jeho súhlase. Bežiaceho agenta Leader oslovuje znova
(SendMessage na jeho meno), ak úloha pokračuje (napr. oprava nálezov
z inšpekcie). Nového agenta zakladá len na novú úlohu.

## Pracoviská (worktree a porty)

Agent, ktorý mení súbory, dostane od Leadera **pracovisko**, teda worktree
s vlastnými portami. Dva súbežné agenti nikdy nedostanú to isté pracovisko.

| Pracovisko | Dev porty (PORT / NAEX_WEB_PORT) |
|---|---|
| `F:\Projects\naex-features` | 8789 / 5175 |
| `F:\Projects\naex-bugfix` | 8788 / 5174 |
| `F:\Projects\naex-ui` | 8790 / 5176 |
| `F:\Projects\naex-admin` | 8791 / 5177 |
| `F:\Projects\naex-navrhar` | 8794 / 5180 |
| `F:\Projects\naex-inspektor` (detached, len meranie) | 8793 / 5179 |
| `F:\Projects\naex-playtest` (playtesty) | 8792 / 5178, servery playtestu od 8800 |

Do hlavného stromu `F:\Projects\naex` (master, 8787 / 5173) píše len Leader.
Agent začína na čistom worktree príkazom
`git checkout -B <vetva> origin/master`. Ak worktree nie je čistý, nič nemaže
a povie to.

## Zdroje, o ktoré sa nebiť

1. **master, push, nasadenie** robí len Leader. Agent commitne na vetvu a vráti
   jej meno. Leader zmerguje vetvu do master, ak prejdú testy, typecheck
   a build (výpis do súboru, push len pri zelenom výsledku), a nasadzuje
   skillom `/naex-nasad`.
2. **Rizikové zdieľané súbory**: `packages/core/data/cards.json`, značka
   v `dorovnajSoSeedom`, `docs/PRAVIDLA.md`, `packages/core/src/bot.ts`,
   `tools/playtest/tahak.md`, `apps/web/src/schemy.css`, `package.json`
   a `package-lock.json`. Naraz ich mení najviac jeden agent a Leader to
   uvedie v zadaní.
3. **Sada kariet na živom webe**: mení ju agent `naex-admin`. Zverejňuje sa len
   so súhlasom Michala, ktorý prechádza cez Leadera. Počas playtestu na živom
   webe sa nezverejňuje.
4. **Playtest partie** spúšťa Leader len so súhlasom Michala. Výučbu smie
   opakovať v cykle zlepšovania, ktorý Michal schválil.
5. **Ťažké výpočty** (turnaje botov, `strategickost.ts`, viac partií naraz)
   bežia najviac po jednom.
6. **Leonardo.Ai** používa `naex-ilustrator` (do 1 USD na zadanie, Michal 2026-10-24). Na ľubovoľný obrázok smie bez
   pýtania. Dym na obrázku len z cigarety, popolníka alebo úst, žiadne zložité
   polohy rúk.
7. **Dočasné súbory a Chrome** patria na `F:\Projects\naex-tmp` (Michal
   2026-10-23, disk C sa dvakrát zaplnil). Headless Chrome spúšťaj len cez
   `spustiChrome` z `tools/docasne.ts` a `zastav()` volaj vo `finally`. Iné
   dočasné priečinky vytváraj cez `docasnyPriecinok`. Zvyšky staršie ako 2 h
   upratuje každý nástroj aj `npm test`. Ručne:
   `node --experimental-strip-types --no-warnings tools/docasne.ts`.
   `.claude/settings.json` nastavuje TEMP/TMP/NAEX_TMP.
8. **Živý web** je len na čítanie (`--zivy` nástroje), okrem krokov, ktoré
   povolil Michal: nasadenie, zverejnenie a playtest.

## Ako Leader zadáva a preberá

- **Zadanie** je samostatné, lebo agent nemá kontext. Obsahuje úlohu,
  kritérium hotového, pracovisko, porty, vetvu, súbory, na ktoré nesiahať,
  a rozhodnutia Michala doslova.
- **UI práca:** programátor → `naex-ui-inspektor` na jeho dev serveri (jedno
  kolo) → ak sú vysoké alebo stredné nálezy, Leader ich pošle tomu istému
  programátorovi → jedna kontrola opráv → merge. Snímky pre Michala (je často
  na telefóne) posiela Leader cez SendUserFile a sám ich nečíta, ak netreba.
- **Správa agenta** má najviac 5 riadkov. Podrobnosti patria do commitu,
  reportu alebo súboru.
- **Rozhodnutia** patria Michalovi. Leader sa ho pýta (AskUserQuestion)
  a odporúčanú voľbu dá na prvé miesto.

## Šetrenie tokenov

- Snímky, dlhé výpisy a dlhé dokumenty Leader nečíta sám. Pošle ich agentovi
  (`naex-oko`, `naex-overovac`, `naex-citac`) a vezme si len text.
- Inšpekcia má jedno kolo a jednu kontrolu opráv. Ďalšie kolo len pri novom
  vysokom náleze.
- Playtest predvolene 1 partia s reportom, `max` len pred veľkým rozhodnutím.
- Leader vedie `F:\Projects\handoff\leader.md` (stav, čo beží, čo čaká na
  Michala). Po `/clear` alebo reštarte ho prečíta spolu s týmto súborom
  a pokračuje. Pri nedostatku tokenov ho prebúdza strážna slučka (`/loop`
  každú hodinu).

## Ďalšia session (len keď ju Michal otvorí)

Pracuje vo vlastnom pracovisku z tabuľky, ktoré jej pridelí Leader. Do master
nemerguje. Leaderovi pošle meno vetvy a jednu vetu. Rolu jej dá Leader.
Po `/clear` platí meno okna. Odovzdanie vedie v
`F:\Projects\handoff\<rola>.md`.

## Prechod (2026-10-24)

Sessions z režimu viacerých sessions (UX/UI, New features, Bugfixing, Admin,
Playtest, UI Inspector, Navrhár) dokončia rozrobené úlohy a potom sa
nepoužívajú. Ich worktree ostávajú ako pracoviská agentov.
