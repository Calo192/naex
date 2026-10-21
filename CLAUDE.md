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

Hra je podľa pravidiel **striktne pre dvoch hráčov**. „Multiplayer" znamená
dvaja ľudia na dvoch zariadeniach, nie viac hráčov naraz.

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
   pre prvé spustenie a testy — kópia zverejnenej sady v15 (2026-10-21:
   v12 + Kultúrny dom z patronátu + texty po M23 — verejný dlh; `cardsJson` z tabuľky `sady`;
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
node --experimental-strip-types --no-warnings tools/admin/admin.ts <príkaz>   # nástroje agenta naex-admin
                     # ilustrácie: Leonardo.Ai API, kľúč NAEX_LEONARDO_KEY v .env (stojí API kredit);
                     # Michal 2026-10-21: na AKÝKOĽVEK nový obrázok smieš Leonardo použiť bez pýtania
node --experimental-strip-types --no-warnings tools/playtest/turnus.ts 2 stredna   # 2 partie AI playtesterov naraz (skill naex-playtest)
node --experimental-strip-types --no-warnings tools/bot/turnaj.ts 20 chamtivy stredna stamgast   # sila povahy bota
node --experimental-strip-types --no-warnings tools/bot/strategickost.ts   # náhoda vs. zručnosť (rebrík, duplikát), ≈ 8 min
npm test             # vitest
npm run typecheck    # tsc --build
npm run build
```

**Živý web** je https://15-235-242-12.sslip.io (OVH, `deploy/nahraj.sh`;
heslo admina v `deploy/.env.produkcia`, mimo gitu). Nástroje agentov naň idú
prepínačom `--zivy`. Playtesty a návrhy z nich sú v sekcii **Playtest**
(len admin a subadmin); Michal tam o návrhoch rozhoduje a schválené
implementuje skill `naex-implementacia` (agent `naex-developer`): hneď commit,
push a merge do master bez pýtania (Michal 2026-10-21).

## Konvencie

- **Doménové pojmy po slovensky**: `Partia`, `poldeci`, `zhromazdenie`,
  `naex`, `staresina`, `priazen`. Neprekladaj ich.
- Programátorské názvy (`apply`, `resolve`, `state`) anglicky.
- Komentáre po slovensky a len tam, kde vysvetľujú **prečo**.
- `strict` TypeScript, žiadne `any`, nemenný stav.
- Bez ďalších závislostí — čo treba, je v `package.json`. Databáza je
  vstavané `node:sqlite` (rozhodnutie Michala 2026-10-10), heslá `node:crypto`.

## Čo nerobiť

- Žiadne AI, žiadne DSL na efekty.
- Žiadne ORM, Redux, router ani UI kit — router je `apps/web/src/lib/router.tsx`.
- Nevymýšľaj si chýbajúce herné hodnoty potichu — daj ich do `data/` s `TODO`
  a spýtaj sa. Zoznam otvorených otázok je v `docs/BRIEF.md`.

## Kde je čo

```
packages/core/       jadro pravidiel — čistý TS, bez I/O
  data/cards.json      60 kariet — kópia zverejnenej sady v15 (neupravuj ručne)
  data/elders.json     8 starších; hodnoty sú PROVIZÓRNE, viď TODO
  src/bot.ts           offline protihráč (NPC: heuristiky + výpočet dopredu, žiadne
                       LLM); tri povahy (POVAHY) — Štamgast, Rapavý Fero, Teta
                       Gizka; server losuje. Skryté info pred výpočtom zamieša
packages/tvorba/     model tvorcu kariet — čistý TS (varianty, geometria karty,
                     farby, formát textu, export/import TXT, štatistiky)
packages/server/     server: hra (ws), REST API (/api), SQLite, médiá (/media)
  seed/                ilustrácie a vzhľad kariet pre prvé spustenie
  seed/avatary/        predvolené avatary (náhodný pre hráča bez fotky), boti/<povaha>.jpg
apps/web/            klient (React + Vite): stranky/, hra/, admin/, karta/,
                     playtest/ (sekcia Playtest: návrhy na rozhodnutie, reporty)
deploy/, Dockerfile  nasadenie (docs/NASADENIE.md)
docs/BRIEF.md        zadanie M0–M10
docs/PRAVIDLA.md     špecifikácia pravidiel
tools/               import z tlačového PDF, piktogramy akcií
  bot/turnaj.ts        turnaj offline protihráča (proti náhodnému / chamtivému / sebe)
  bot/strategickost.ts meranie strategickosti — podklad agenta naex-strateg (skill naex-strategia)
  admin/               nástroje agenta naex-admin (admin API, rebalans, štýl ilustrácií,
                       nahrávanie reportov a návrhov, avatary AI účtov)
  playtest/            klient AI playtesterov; hraci.json = 6 postáv (štýl, zameranie),
                       turnus.ts = 1–3 partie naraz s náhodnými dvojicami
```
