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
   pre prvé spustenie a testy (generuje ju `tools/import_print_pdf.py`).
6. **Server púšťa `.ts` priamo (strip-types)** — len vymazateľná syntax
   (`erasableSyntaxOnly`): žiadne parametrické vlastnosti, enumy, namespaces.

## Príkazy

```bash
npm install
npm run dev          # server :8787 + klient :5173 (heslo admina: .env, NAEX_ADMIN_HESLO)
npm start            # produkcia: server + zbuildovaný klient :8787
npm run kniznica -- "docs/NA EX/NA EX"   # obrázky do knižnice tvorcu
npm test             # vitest
npm run typecheck    # tsc --build
npm run build
```

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
  data/cards.json      50 kariet tlačovej sady (generované, neupravuj ručne)
  data/elders.json     8 starších; hodnoty sú PROVIZÓRNE, viď TODO
packages/tvorba/     model tvorcu kariet — čistý TS (varianty, geometria karty,
                     farby, formát textu, export/import TXT, štatistiky)
packages/server/     server: hra (ws), REST API (/api), SQLite, médiá (/media)
  seed/                ilustrácie a vzhľad kariet pre prvé spustenie
apps/web/            klient (React + Vite): stranky/, hra/, admin/, karta/
deploy/, Dockerfile  nasadenie (docs/NASADENIE.md)
docs/BRIEF.md        zadanie M0–M10
docs/PRAVIDLA.md     špecifikácia pravidiel
tools/               import z tlačového PDF, piktogramy akcií
```
