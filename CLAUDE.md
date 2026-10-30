# NA EX! — kontext projektu

Webová verzia kartovej hry **NA EX!** (autor Michal Calík).
Dvaja hráči, dva prehliadače, cez internet. Web má tri časti: **pravidlá**
(vzdelávanie), **tvorba kariet** pre admina (port MAUI aplikácie KartyAI)
a **hra**; k tomu účty s úrovňami admin / subadmin / hráč / návštevník a profil
(herné meno, avatar).

**Prečítaj najprv `docs/BRIEF.md`** — je to zadanie s míľnikmi a akceptačnými
kritériami (M0–M10). Rozšírenie o platformu (M11–M14) popisuje `README.md`.
`docs/PRAVIDLA.md` je špecifikácia pravidiel (v11 + zmeny z pravidiel v2).

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
5. **Dáta, nie kód.** Karty upravuje admin v tvorcovi (SQLite); hra beží na
   zverejnenej sade. `packages/core/data/cards.json` je východisková sada
   pre prvé spustenie a testy — kópia lokálne zverejnenej sady v43 bez Presbitera (2026-10-30,
   pravidlá v8.4: náradie, Valaška, druhé tagy Šoféra, Dvojčiat a Snúbenice; `cardsJson`
   z `/api/sada` — lokálne a živé číslovanie sád sa líši, číslo živého webu dostane po nasadení;
   produkcia ho prevezme pri štarte cez novú značku v `dorovnajSoSeedom`, zmeny vzhľadu
   a ilustrácií navyše `tools/admin/do-seedu.ts`, viď docs/NASADENIE.md). Značku meň až
   po skopírovaní cards.json, inak bežiaci dev server preseeduje tvorcu starou sadou.
   Predtým ju generoval `tools/import_print_pdf.py` z tlačového PDF.
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
`/naex-nasad` (len čistý `origin/master`, počká na rozohrané partie), čo kde
čaká ukáže `/naex-stav`.

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
  data/cards.json      92 kariet — kópia lokálnej sady v43 bez Presbitera (neupravuj ručne)
  data/elders.json     8 starších; priazeň a body nesie scorecard (scorecards.json)
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
docs/BRIEF.md        zadanie M0–M10
docs/PRAVIDLA.md     špecifikácia pravidiel
tools/               import z tlačového PDF, piktogramy akcií
  bot/turnaj.ts        turnaj offline protihráča (proti náhodnému / chamtivému / sebe /
                       starej verzii bota z iného worktree); vypíše, ktoré ťahy bot používa
  bot/strategickost.ts meranie strategickosti — podklad agenta naex-strateg (skill naex-strategia)
  admin/               nástroje agenta naex-admin (admin API, rebalans, štýl ilustrácií,
                       nahrávanie reportov a návrhov, avatary AI účtov, linka, server-stav)
  playtest/            klient AI playtesterov; hraci.json = 6 postáv (štýl, zameranie),
                       turnus.ts = 1–3 partie naraz s náhodnými dvojicami,
                       tahak.md = ťahák pravidiel AI hráčov (jediné miesto, čísla stráži test)
  rozhodca/            mapa „paragraf PRAVIDLA.md → test“ agenta naex-rozhodca
```
