---
name: naex-korektura
description: Spustí agenta naex-korektor — jazyková a terminologická kontrola textov NA EX! (karty, pravidlá, výučba, Melichar, Novinky, ťahák AI, rozhranie) — preklepy, diakritika, jednotnosť pojmov, rozpory medzi kartou, pravidlami a UI, nejasné vety. Nič nemení, vráti zoznam opráv rozdelený podľa toho, kto ich urobí. Použi, keď používateľ povie /naex-korektura, „skontroluj texty“, „korektúra“, „pravopis“, „sú pojmy jednotné“, a po väčšej zmene textov (nová sada, prestavba pravidiel, výučba).
argument-hint: "[rozsah: karty | pravidla | vyucba | melichar | ui | novinky | vsetko (predvolené) | zmeny]"
---

# Korektúra textov

Spustíš agenta `naex-korektor` (nástroj Agent, na pozadí) so zadaním:

> Korektúra, dátum `<dnešok>`, rozsah `<$ARGUMENTS alebo vsetko>`. Postupuj
> podľa svojej definície: nič nemeníš, Michalove texty len hlásiš, report do
> `F:/Projects/handoff/korektura/<dátum>.html`.

Pracovisko netreba: agent nič nemení, číta z hlavného stromu `F:\Projects\naex`.

**Keď skončí:** zoznamy opráv z reportu rozdaj:
- karty → `naex-admin` (zmeny v tvorcovi, zverejnenie len so súhlasom Michala),
- rozhranie, výučba, Melichar → `naex-programator` (Michalove texty len so
  súhlasom Michala),
- `docs/PRAVIDLA.md`, `tools/playtest/tahak.md` → Leader sám alebo jeden
  agent so zadaním (rizikové súbory),
- vecné rozpory → aj `naex-rozhodca`.

Michalovi: počet nálezov a 2–3 rozpory, ktoré treba rozhodnúť.
