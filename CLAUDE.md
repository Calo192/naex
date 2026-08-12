# NA EX! — kontext projektu

Webová verzia kartovej hry **NA EX!** (autor Michal Calík).
Dvaja hráči, dva prehliadače, cez internet.

**Prečítaj najprv `docs/BRIEF.md`** — je to zadanie s míľnikmi a akceptačnými
kritériami. `docs/PRAVIDLA.md` je špecifikácia pravidiel.

## Rozsah

Hra je podľa pravidiel **striktne pre dvoch hráčov**. „Multiplayer" znamená
dvaja ľudia na dvoch zariadeniach, nie viac hráčov naraz.

## Nemenné pravidlá

1. **`packages/core` neobsahuje žiadne I/O.** Žiadne DOM, `fetch`,
   `WebSocket`, `Date.now()`, `Math.random()`. Ten istý kód beží v prehliadači
   aj na serveri.
2. **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.** Skryť kartu
   v rozhraní je bezcenné — stačí konzola prehliadača. Filtrovanie patrí do
   `viewFor()` a musí byť otestované.
3. **Klient posiela zámery, nikdy výsledky.** Server počíta, klient kreslí.
4. **Náhoda je deterministická.** Jeden seedovaný generátor v `GameState`.
5. **Dáta v `packages/core/data/*.json`, nie v kóde.**

## Príkazy

```bash
npm install
npm run dev          # server :8787 + klient :5173
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
- Bez ďalších závislostí — čo treba, je v `package.json`.

## Čo nerobiť

- Žiadny klient pred míľnikom M8, žiadne AI, žiadne DSL na efekty.
- Žiadna databáza, ORM, Redux ani UI kit.
- Nevymýšľaj si chýbajúce herné hodnoty potichu — daj ich do `data/` s `TODO`
  a spýtaj sa. Zoznam otvorených otázok je v `docs/BRIEF.md`.

## Kde je čo

```
packages/core/       jadro pravidiel — čistý TS, bez I/O
  data/cards.json      50 kariet (generované, neupravuj ručne — viď tools/)
  data/elders.json     8 starších; hodnoty sú PROVIZÓRNE, viď TODO
packages/server/     autoritatívny server (Node + ws)
apps/web/            klient (React + Vite)
docs/BRIEF.md        zadanie: míľniky, akceptačné kritériá, otvorené otázky
docs/PRAVIDLA.md     špecifikácia pravidiel v11
tools/parse_cards.py regenerácia cards.json z exportu KartyAI
```
