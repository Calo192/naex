---
name: naex-nasad
description: Bezpečne nasadí NA EX! na živý web — overí, že master je na origine a prejde testami, typecheckom a buildom, ukáže, čo pôjde von (commity od posledného nasadenia, zmena sady kariet), zapne uzávierku (nové partie nie), počká, kým dohrajú rozohrané partie ľudí aj s botmi, nasadí čistý master cez deploy/nahraj.sh, overí živý web (smoke test) a označí, čo je na živom webe. Použi, keď používateľ povie /naex-nasad, „nasaď“, „nahraj na živý web“, „vydaj novú verziu“, „daj to na produkciu“.
argument-hint: "[--hned] (nasadiť aj počas rozohraných partií)"
---

# Nasadenie na živý web

Si **vydávateľ**. Nasadzuješ len to, čo je v `origin/master` — nikdy pracovnú
kópiu s rozpracovanou prácou (`deploy/nahraj.sh` balí pracovný strom, aj
necommitnuté zmeny). Nasadenie reštartuje server a **zhodí rozohrané partie**
(stav partie je v pamäti); účty, karty a obrázky ostávajú v databáze.

Spúšťaš ho len na pokyn Michala (priamo, alebo keď súhlasil s ponukou
nasadenia napr. po `/naex-implementacia`). `$ARGUMENTS` môže obsahovať
`--hned` — vtedy nečakáš na dohranie partií (Michal to povedal výslovne).

`A` = `node --experimental-strip-types --no-warnings tools/admin/admin.ts`.
Adresa a IP servera sú v `deploy/.env.produkcia` (`IP=`, `DOMENA=`; mimo gitu).

## Postup

1. **Čo beží teraz:** `$A server-stav --zivy` — nasadený commit, kedy, a
   koľko partií beží (ľudia proti sebe, s botom, čakajúce miestnosti). Server
   nasadený pred zavedením `VERZIA.json` verziu nepozná — vtedy porovnávaj
   s dátumom posledného nasadenia, ak ho poznáš, inak ukáž posledných 10
   commitov.

2. **Čistý master:**
   ```bash
   git fetch origin
   git status --short            # v hlavnom strome môže byť práca iných — nevadí, nasadzuješ z worktree
   git worktree remove --force ../naex-nasadenie 2>/dev/null; git worktree add --detach ../naex-nasadenie origin/master
   cd ../naex-nasadenie && npm ci --prefer-offline --no-audit --no-fund && npm test && npm run typecheck && npm run build
   ```
   Ak niečo neprejde, **nenasadzuj** — povedz, čo padlo a v ktorom commite
   (`git log`), a skonči. Lokálny `master` pred `origin/master` (nepushnuté
   commity) spomeň — nasadzuje sa len origin.

3. **Čo pôjde von:** `git log --oneline <nasadený commit>..origin/master` —
   zhrň ľudskou rečou (3–8 bodov, nie hashe). Zmenil sa
   `packages/core/data/cards.json` alebo značka v `dorovnajSoSeedom`? Potom
   ide aj nová sada kariet: over, že `tools/admin/do-seedu.ts` je už v commite
   (seed v `packages/server/seed/` zodpovedá `cards.json`) — inak to povedz a
   nenasadzuj (docs/NASADENIE.md, „Karty na produkciu“). Ak nie je čo nasadiť,
   povedz to a skonči.

4. **Uzávierka a rozohrané partie** (Michal 2026-10-23): ak nemáš `--hned`,
   zapni uzávierku `$A uzavierka zapni --zivy`. Odteraz sa nedá založiť partia
   ani pripojiť do novej miestnosti (ľudia, boti ani AI playtesteri); hráči
   v lobby vidia oznam „Pripravujeme aktualizáciu hry…“, rozohrané partie bežia
   ďalej. Potom čakaj na dohranie **všetkých** partií — aj s botom: kontroluj
   `$A server-stav --zivy` každých 5 minút (Monitor / until-slučka, nie ručné
   pollovanie), kým `aktívne` nie je 0, najviac 45 minút. Partia bez ťahu
   30 minút sa ráta ako opustená (`opustené`) — na tú nečakaj, len ju spomeň;
   čakajúce miestnosti tiež nie. Ak sa partie do 45 minút nedohrajú, opýtaj sa
   používateľa, či nasadiť aj tak. Keď nasadenie nakoniec nepôjde, vypni
   uzávierku `$A uzavierka vypni --zivy` — inak by hráči nemohli zakladať
   partie až do reštartu. S `--hned` uzávierku nezapínaj, nasadzuj hneď.
   Server nasadený pred uzávierkou (fa8cb6c a starší) príkaz nepozná — vtedy
   čakaj len na partie ľudí ako predtým.

5. **Nasaď** z worktree:
   ```bash
   cd ../naex-nasadenie && bash deploy/nahraj.sh <IP z deploy/.env.produkcia>
   ```
   Skript potrebuje SSH kľúč (`~/.ssh/naex_server` alebo `NAEX_SSH_KLUC`) a do
   balíka zapíše `VERZIA.json` (commit, ktorý beží). Prepíše
   `deploy/.env.produkcia` vo worktree — skopíruj ho späť do hlavného stromu
   (`cp ../naex-nasadenie/deploy/.env.produkcia deploy/`), ak sa zmenil.
   Reštart servera uzávierku sám zruší (je len v pamäti) — po nasadení ju nevypínaj.
   Na konci skript čaká na HTTPS; ak neodpovie, ukáž príkaz na logy, ktorý
   vypísal, a skonči s chybou.

6. **Smoke test živého webu:**
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny --zivy
   $A server-stav --zivy          # commit = origin/master, partie 0, uzávierka vypnutá
   $A sady --zivy                 # pri novej sade: nová verzia je zverejnená
   ```
   a jedna stránka očami: `tools/playtest/snimka.ts web nasadenie --cesta / --url https://<DOMENA>`
   (prezri snímku nástrojom Read — stránka sa načítala, nie je biela ani
   chybová). Ak niečo zlyhá, povedz čo; návrat je nasadenie predošlého commitu
   (`git worktree add --detach … <starý commit>` a krok 5).

7. **Uprac** `git worktree remove --force ../naex-nasadenie`.

8. **Odovzdaj:** koľko minút trvala uzávierka a koľko opustených partií nasadenie zhodilo; čo je teraz na živom webe (commit, 3–8 bodov zmien), či išla
   nová sada kariet, koľko partií nasadenie zhodilo (ak `--hned`), výsledok
   smoke testu. Implementované návrhy teraz čakajú na overenie ďalším
   playtestom (`/naex-playtest`) — spomeň ich (`$A navrhy implementovane --zivy`).
   Hráčom nič nepíš sám; ak chce Michal oznámenie „Čo je nové“, navrhni text
   (2–5 viet pre hráčov, bez technických slov) a zverejni ho až na jeho pokyn.
