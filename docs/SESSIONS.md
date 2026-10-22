# Súbežné sessions — pravidlá spolupráce

Michal komunikuje len s **Leaderom**. Leader rozdeľuje prácu, ostatné sessions
hlásia jemu a medzi sebou si píšu cez `SendMessage` (adresát = meno z `ListAgents`).

| Session       | Rola                                              | Worktree / vetva              | Dev porty (PORT / NAEX_WEB_PORT) |
|---------------|---------------------------------------------------|-------------------------------|----------------------------------|
| Leader        | koordinácia, merge do master, nasadenie           | `F:\Projects\naex` (hlavný)   | 8787 / 5173                      |
| Bugfixing     | opravy chýb                                       | `F:\Projects\naex-bugfix`     | 8788 / 5174                      |
| New features  | nové funkcie, roadmapa                            | `F:\Projects\naex-features`   | 8789 / 5175                      |
| UX/UI         | dizajn a jeho implementácia v klientovi           | `F:\Projects\naex-ui`         | 8790 / 5176                      |
| Admin         | karty v tvorcovi, ilustrácie (Leonardo), rebalans | `F:\Projects\naex-admin`      | 8791 / 5177                      |
| Playtesting   | playtesty, návrhy, rozhodca, stratég              | `F:\Projects\naex-playtest`   | 8792 / 5178 (playtest servery si volia porty samy) |

## Zdroje, o ktoré sa nebiť

1. **Pracovný strom.** Do `F:\Projects\naex` píše len Leader. Každá iná session
   pracuje vo vlastnom worktree:
   `git worktree add ../naex-<meno> -b <meno>/<téma> origin/master`,
   potom `npm install` a skopíruj `.env` (je mimo gitu). `data/` je v každom
   worktree vlastná (vlastná SQLite) — pri prvom štarte sa naseeduje.
2. **Porty.** Dev server púšťaj s vlastnými portami z tabuľky:
   `PORT=8788 NAEX_WEB_PORT=5174 npm run dev` (PowerShell: `$env:PORT=8788; $env:NAEX_WEB_PORT=5174; npm run dev`).
3. **master a push.** Do `master` merguje **len Leader** (alebo ten, komu Leader
   dá „zámok merge“ správou). Pred žiadosťou o merge: rebase na `origin/master`,
   `npm test`, `npm run typecheck`, `npm run build`. Pošli Leaderovi meno vetvy
   a jednu vetu, čo mení.
4. **Živý web.** Nasadzuje len Leader (`/naex-nasad`). Kto chce niečo na živý
   web, povie Leaderovi.
5. **Zdieľané súbory s vysokým rizikom konfliktu** — kto ich ide meniť, najprv
   to ohlási Leaderovi (a Leader dá vedieť ostatným):
   `packages/core/data/cards.json`, značka v `dorovnajSoSeedom`,
   `docs/PRAVIDLA.md`, `packages/core/src/bot.ts`, `tools/playtest/tahak.md`,
   `apps/web/src/schemy.css`, `package.json` / `package-lock.json`.
6. **Sada kariet na živom webe** mení len Admin a zverejňuje len so súhlasom
   Michala (cez Leadera). Počas bežiaceho playtestu na živom webe Admin
   nezverejňuje — Playtesting ohlási začiatok a koniec.
7. **Ťažké výpočty** (turnaje botov, `strategickost.ts` ≈ 8 min, 3 playtesty
   naraz) ohlás Leaderovi pred spustením; naraz beží najviac jeden.
8. **Leonardo.Ai kredit** používa Admin (a UX/UI po dohode s Leaderom).

## Komunikácia

- Začiatok úlohy, koniec úlohy, blokér → krátka správa Leaderovi.
- Otázka na inú session (napr. UX/UI → Bugfixing „meníš aj HraStol.tsx?“) →
  priamo jej; ak z toho vyjde rozhodnutie, jedna veta Leaderovi.
- Rozhodnutia, ktoré patria Michalovi, idú cez Leadera — sessions sa Michala
  nepýtajú priamo.
- Prvý riadok správy = samostatná veta, o čo ide.
