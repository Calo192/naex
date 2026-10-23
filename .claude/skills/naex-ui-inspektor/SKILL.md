---
name: naex-ui-inspektor
description: Spustí agenta naex-ui-inspektor — prejde jednu stránku webu NA EX! (parameter) alebo všetky stránky (bez parametra, aj herný stôl a admin) na lokálnom serveri pri 1920×1080, 1600×1000 a notebookoch (1512×860, 1440×800, 1366×650) a nájde UI chyby (orezaný a prekrytý text, nezarovnané ikony, prekrývajúce sa prvky, presah, malé ciele, fokus, kontrast, konzola, rozbité obrázky), overí ich a napíše HTML report so zoznamom na opravu, ktorý pošle Leaderovi. Použi, keď používateľ povie /naex-ui-inspektor, „skontroluj UI“, „nájdi UI chyby“, „prejdi stránky“, „orezaný text“, „inšpekcia webu“.
argument-hint: "[stránka, napr. /profil alebo „Spätná väzba“ — bez parametra všetky]"
---

# UI inšpekcia webu NA EX!

Spustíš agenta `naex-ui-inspektor` (`.claude/agents/naex-ui-inspektor.md`)
na lokálny server a jeho overený zoznam chýb odovzdáš. Sám nič neopravuješ.

`$ARGUMENTS` = cieľ: cesta (`/profil`, `hra`, `admin/karty`) alebo názov
stránky (prelož ho na cestu podľa `apps/web/src/App.tsx`). Prázdny = všetky
stránky vrátane `/hra` a admin.

1. **Lokálny server z čistého mastera** (Michal 2026-10-22: len lokálne). V tejto
   session pracuješ vo worktree `F:\Projects\naex-inspektor` (docs/SESSIONS.md,
   porty 8793 / 5179):
   ```bash
   git -C F:/Projects/naex fetch origin --quiet
   # prvýkrát: git -C F:/Projects/naex worktree add --detach ../naex-inspektor origin/master; cp F:/Projects/naex/.env ../naex-inspektor/
   cd F:/Projects/naex-inspektor && git checkout --detach origin/master && npm ci --prefer-offline --no-audit --no-fund && npm run build
   PORT=8793 npm start      # na pozadí; over curl http://localhost:8793/
   ```
2. **Id** = dátum a čas (`20261022-2130`), pri jednej stránke s jej slugom
   (`profil-20261022-2130`).
3. **Spusti agenta** `naex-ui-inspektor`: „Url: http://localhost:8793. Cesty: <cieľ alebo všetky>.
   Id: <id>. Pracuj vo F:\Projects\naex-inspektor.“ Používateľovi povedz, čo sa
   prechádza; pri všetkých stránkach s partiou to trvá desiatky minút.
4. **Keď skončí:** zastav server. Report a JSON commitni na vetvu
   `inspekcia/<id>` a pushni (`git switch -c inspekcia/<id>`, `git add docs/playtesty/ui-inspekcia-<id>*`).
5. **Odovzdaj:**
   - Leaderovi (SendMessage na session Leader, meno zisti cez ListAgents):
     vetva, počty podľa závažnosti a zoznam chýb, každá jednou vetou so
     zdrojom `súbor:riadok`. Leader rozdelí opravy a zmerguje report.
   - používateľovi: cestu k reportu `F:\Projects\naex-inspektor\docs\playtesty\ui-inspekcia-<id>.html`
     (otvor ho v prehliadači) a 5 najdôležitejších chýb.
