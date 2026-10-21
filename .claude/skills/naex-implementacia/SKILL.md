---
name: naex-implementacia
description: Implementuje návrhy z playtestov, ktoré Michal na živom webe (sekcia Playtest) označil na implementáciu — pozbiera ich s jeho voľbou a poznámkou, zmeny kariet zadá agentovi naex-admin, kód a pravidlá agentovi naex-developer, ktorý ich naprogramuje, overí, commitne, pushne, zmerguje do master a označí na webe ako implementované. Použi, keď používateľ povie /naex-implementacia, „implementuj návrhy“, „sprav, čo som schválil“, „naprogramuj schválené návrhy z playtestu“.
argument-hint: "[id návrhu …] (predvolene všetky na implementáciu)"
---

# Implementácia schválených návrhov

Si **organizátor implementácie** (v úlohe admina projektu). Sám neprogramuješ —
pozbieraš, čo Michal schválil, a rozdelíš prácu:

- `naex-developer` (`.claude/agents/naex-developer.md`) — kód, pravidlá,
  testy, dokumenty; commit, push, merge do master,
- `naex-admin` (`.claude/agents/naex-admin.md`) — zmeny kariet v tvorcovi,
  ilustrácie, zverejnenie sady.

**Trvalé súhlasy Michala (2026-10-21):** implementácia = hneď commit, push
a merge do master bez pýtania; zverejnenie sady pri návrhu schválenom na webe
je povolené (sady sa dajú vrátiť `admin.ts vrat`); Leonardo smie generovať
každý nový obrázok, ktorý návrh potrebuje.

Argumenty: `$ARGUMENTS` — voliteľne id návrhov (čísla z webu). Bez nich
všetky v stave `implementovat`.

## Postup

1. **Pozbieraj návrhy** zo živého webu:
   ```bash
   A="node --experimental-strip-types --no-warnings tools/admin/admin.ts"
   $A navrhy implementovat --zivy --json
   ```
   Ber len návrhy, o ktorých rozhodol **človek** (`rozhodol.ai === false`).
   Návrh s rozhodnutím od účtu AI preskoč a povedz to používateľovi. Pri
   voľbe `vlastne` je riešenie v poznámke. Ak nie je nič na implementáciu,
   povedz to a skonči (odkaz `<živý web>/playtest`).

2. **Rozplánuj.** Pre každý návrh urč, čo je kód/pravidlá (Developer) a čo
   karty v tvorcovi (Admin); zisti, či sa návrhy dotýkajú toho istého (poradie).
   Ak Michalova poznámka návrhu odporuje alebo niečo zásadné chýba tak, že
   by sa muselo hádať pravidlo, opýtaj sa používateľa **len na to** — zvyšok
   rozbehni.

3. **Karty (ak treba)** — `naex-admin` na pozadí, na lokálnom webe (vývojová
   databáza, `npm run dev`): zmeny kariet podľa návrhu, záloha, `overit`,
   `zverejni --potvrdene` (súhlas je daný schválením návrhu). Potom
   `naex-developer` skopíruje zverejnenú sadu do `packages/core/data/cards.json`,
   spustí `tools/admin/do-seedu.ts` a pridá značku migrácie
   (docs/NASADENIE.md, „Karty na produkciu“) — ako súčasť toho istého návrhu.

4. **Kód** — `naex-developer` (na pozadí; viac návrhov jednému agentovi
   postupne, aby sa commity nebili). Zadanie pre každý návrh: id, názov,
   problém, príčina, **presný text vybranej možnosti** (alebo vlastné riešenie
   z poznámky), Michalova poznámka (má prednosť), otázky navrhára s Michalovými
   odpoveďami z poznámky, čo robí Admin, a koncovka commitu:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   Developer návrh na webe sám označí `rozpracovane` a po merge `implementovane`.

5. **Kontrola po Developerovi** — `git log --oneline -5 master`, či je commit
   v master a na origin, a `$A navrhy implementovane --zivy`, či je návrh
   označený. Ak Developer zlyhal (testy, konflikt), vráť návrh na
   implementovať (`$A navrh <id> spat --zivy --vysledok "<prečo>"`) — Michalovo
   rozhodnutie ostane — a povedz používateľovi prečo.

6. **Nasadenie** — implementované zmeny sú na živom webe až po nasadení
   (`deploy/nahraj.sh`, docs/NASADENIE.md). Reštart zhodí rozohrané partie,
   preto nasadenie **ponúkni** a urob ho, keď používateľ súhlasí.

7. **Odovzdaj** používateľovi: pre každý návrh jednu-dve vety (čo sa zmenilo,
   commit), čo ostalo otvorené (hodnoty s `TODO`, chyby mimo návrhu, ktoré
   Developer našiel) a odporúčanie overiť zmenu ďalším playtestom
   (`/naex-playtest`).
