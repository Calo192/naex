---
name: naex-strazca
description: Spustí agenta naex-strazca — bezpečnostná kontrola NA EX! na lokálnom serveri — či server neposiela hráčovi skryté informácie (súperova ruka, balíček, semienko), či sa dá podvádzať cudzími a nepovolenými príkazmi cez WebSocket, či drží admin API, účty, nahrávanie súborov a vstupy. Nálezy len do súkromného reportu (repozitár je verejný). Beží v stredu o 04:00 SEČ ako cloudová routine; ručne, keď používateľ povie /naex-strazca, „bezpečnostná kontrola“, „dá sa podvádzať“, „uniká súperova ruka“, „security audit“.
argument-hint: "[oblasť: unik | podvadzanie | ucty | vstupy | vsetko (predvolené)]"
---

# Strážca tajomstiev

Spustíš agenta `naex-strazca` (nástroj Agent, na pozadí) so zadaním:

> Bezpečnostná kontrola, dátum `<dnešok>`, oblasť `<$ARGUMENTS alebo vsetko>`.
> Postupuj podľa svojej definície. Útočíš len na lokálny server, ktorý si
> spustíš (lokálne porty `8795` / `5181`). Na živý web neútočíš. Report len
> súkromne (lokálne `F:/Projects/handoff/strazca/<dátum>.html`, v cloude
> Claude Docs), nič do gitu. Kód nemeníš.

**Pracovisko lokálne:** vlastný worktree (napr. `F:\Projects\naex-strazca`),
porty 8795 / 5181 — nekolidujú s tabuľkou v `docs/SESSIONS.md`.

**Keď skončí:**
- **Kritický nález** (únik skrytej informácie, ťah za súpera, admin bez
  práv): Leader ho hneď zadá `naex-programator` s neutrálnym názvom vetvy
  a správou commitu (bez popisu zneužitia), oprava ide na živý web čo
  najskôr (`/naex-nasad`, so súhlasom Michala). Test, ktorý dieru dokazuje,
  ide do repa spolu s opravou.
- Ostatné nálezy: do zadania programátora podľa závažnosti.
- Michalovi: počet nálezov podľa závažnosti a pri kritickom jedna veta.
