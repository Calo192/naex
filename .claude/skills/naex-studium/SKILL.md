---
name: naex-studium
description: Spustí agenta naex-student — naštuduje, ako jeden problém NA EX! riešia iné stolové a kartové hry (rešerš na webe so zdrojmi), a doplní knižnicu mechaník docs/kniznica/ (čo mechanika robí, kde funguje a prečo, prevod do NA EX!, riziká, čo zmerať). Z knižnice čerpajú Nápadník a Navrhár. Beží v utorok o 04:00 SEČ ako cloudová routine; ručne, keď používateľ povie /naex-studium, „ako to riešia iné hry“, „naštuduj mechaniky“, „inšpirácia z iných hier“.
argument-hint: "[téma — problém, napr. „náhoda v dobere“; predvolene podľa roadmapy a playtestov]"
---

# Štúdium iných hier

Spustíš agenta `naex-student` (nástroj Agent, na pozadí) so zadaním:

> Štúdium, dátum `<dnešok>`, téma `<$ARGUMENTS alebo „vyber podľa svojej
> definície“>`. Postupuj podľa svojej definície; výstup do `docs/kniznica/`
> na vetve `student/<dátum>`. Pravidlá ani kód nemeníš, Michalovi priamo
> nenavrhuješ.

Lokálne mu prideľ pracovisko (worktree, porty netreba). V cloude pushne len
svoju vetvu.

**Keď skončí:** Leader zmerguje vetvu (len dokumenty) a 1–2 najsľubnejšie
mechaniky zo správy pridá do najbližšieho zadania Nápadníka alebo Navrhára
(„pozri docs/kniznica/<téma>.html“). Michalovi stačí jedna veta v prehľade.
