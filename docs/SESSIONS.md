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
| Playtesting   | playtesty, návrhy, rozhodca, stratég              | `F:\Projects\naex-playtest`   | 8792 / 5178 (servery playtestu: od 8800 vyššie) |
| UI Inspector  | UI inšpekcia (`/naex-ui-inspektor`), len hľadá chyby | `F:\Projects\naex-inspektor` (detached origin/master) | 8793 / 5179                      |
| Navrhár       | nové nápady do hry (karty, skórovanie, pravidlá, čo odstrániť), kód nemení | `F:Projects
aex-navrhar`  | 8794 / 5180                      |

Reštart Claude Code sessions premenuje (`naex-xx`) a po `/clear` štartujú
v hlavnom strome. Rolu neurčuje meno ani priečinok: session, ktorá ju nepozná,
sa opýta Leadera, nič nemení a potom prejde do worktree svojej roly.

Porty 8780–8799 a 5170–5199 patria dev serverom sessions, 8800+ dočasným
serverom playtestov (`tools/playtest/turnus.ts`).

## Zdroje, o ktoré sa nebiť

1. **Pracovný strom.** Do `F:\Projects\naex` píše len Leader. Každá iná session
   pracuje vo vlastnom worktree:
   `git worktree add ../naex-<meno> -b <meno>/<téma> origin/master`,
   potom `npm install` a skopíruj `.env` (je mimo gitu). `data/` je v každom
   worktree vlastná (vlastná SQLite) — pri prvom štarte sa naseeduje.
2. **Porty.** Dev server púšťaj s vlastnými portami z tabuľky:
   `PORT=8788 NAEX_WEB_PORT=5174 npm run dev` (PowerShell: `$env:PORT=8788; $env:NAEX_WEB_PORT=5174; npm run dev`).
3. **master a push.** Do `master` merguje **len Leader** (Michal 2026-10-23,
   po tom, čo auto režim sessions push blokuje). Session vetvu len commitne
   (repozitár je spoločný, Leader ju vidí aj nepushnutú): rebase na
   `origin/master`, `npm test`, `npm run typecheck`, `npm run build`, potom
   **jedna veta** Leaderovi: meno vetvy a čo mení. Push sa neskúša.
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
- **Správy Leaderovi najviac 3–5 riadkov** (Michal 2026-10-23 — šetrí tokeny).
  Podrobnosti patria do commitu, reportu alebo súboru, v správe len cesta.

## Šetrenie tokenov (Michal 2026-10-23)

- **Odovzdanie.** Každá session vedie `F:\Projects\handoff\<rola>.md` (mimo
  gitu, najviac ~30 riadkov): rola, worktree a vetva, čo je hotové, čo
  rozrobené, ďalší krok, otvorené otázky. Aktualizuj ho pri každom dokončení
  úlohy. Po `/clear` alebo reštarte ho session prečíta ako prvé (spolu s týmto
  súborom) a pokračuje.
- **`/clear` a `/compact`** píše Michal do okna session (príkazy sa nedajú
  poslať správou). Leader mu povie, ktorá session je v pokoji a dá sa vyčistiť
  (`/clear`), a ktorá potrebuje kontext, ale je dlhá (`/compact`). Pred
  `/clear` musí byť odovzdanie aktuálne.
- **Playtest** predvolene 1 partia s reportom; `max` len pred veľkým
  rozhodnutím (napr. pred zmrazením pravidiel).
- **Modely agentov:** UI inšpektor, spisovateľ reportov a AI playtesteri bežia
  na Sonnete; dizajnéri, stratég, navrhár, rozhodca a Developer na Opuse.
