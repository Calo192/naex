# NA EX!

Webová verzia kartovej hry **NA EX!** (Michal Calík) — dvaja hráči,
dva prehliadače, cez internet. Beží všade, kde je prehliadač.

**Stav: kostra projektu. Hra ešte nie je implementovaná.**

## Kde začať

| Súbor | Načo |
|---|---|
| `docs/BRIEF.md` | zadanie — míľniky, akceptačné kritériá, otvorené otázky |
| `docs/PRAVIDLA.md` | destilovaná špecifikácia pravidiel v11 |
| `CLAUDE.md` | kontext a konvencie pre Claude Code |

## Spustenie

```bash
npm install
npm run dev     # server na :8787, klient na http://localhost:5173
```

Ďalšie príkazy: `npm test`, `npm run typecheck`, `npm run build`.

## Štruktúra

```
packages/core/     jadro pravidiel — čistý TypeScript, bez DOM a bez siete
packages/server/   autoritatívny server (Node + ws)
apps/web/          klient (React + Vite)
```

Jadro nesmie obsahovať I/O, aby bežalo v prehliadači aj na serveri a dalo sa
deterministicky prehrať. Server je jediné miesto, ktoré pozná celý stav —
klientovi posiela vždy len odfiltrovaný pohľad.

## Čo už je pripravené

- `packages/core/data/cards.json` — **50 kariet** vygenerovaných z exportu
  KartyAI: tagy, text efektu, rozpoznané spúšťače, blokované pozície
  a multimnožina akcií pre obe strany. Overené proti počtom permutácií.
- `packages/core/data/elders.json` — 8 starších. **Hodnoty sú provizórne**
  a treba ich doladiť podľa fyzických komponentov (viď TODO v súbore).
- `tools/parse_cards.py` — regenerácia `cards.json`, keď sa zmení zoznam kariet.

## Zdroje

- Pravidlá v11: `C:\Users\Michal\Documents\Claude\naex_pravidla_v11_tlac.docx`
- Export kariet: `C:\Users\Michal\Documents\Claude\kartyai_cards_20260713_rozsirene.txt`
- Interaktívne pravidlá: `C:\Users\Michal\Documents\Claude\NAEX\NAEX_pravidla.html`
