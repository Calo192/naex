---
name: naex-upratovanie
description: Spustí agenta naex-upratovac — vyčistí jednu časť kódu NA EX! (nepoužitý kód, duplicity, dlhé funkcie, názvy, typy, komentáre) bez zmeny správania, overí testami, typecheckom, buildom a odtlačkom hry a otvorí PR do master, ktorý zmerguje Leader. Beží každý piatok o 04:00 SEČ ako cloudová routine; ručne, keď používateľ povie /naex-upratovanie, „uprac kód“, „vyčisti kód“, „refaktoring“, „odstráň nepoužitý kód“.
argument-hint: "[časť kódu, napr. packages/server/src — predvolene podľa docs/upratovanie/stav.json]"
---

# Týždenné upratovanie kódu

Spustíš agenta `naex-upratovac` (nástroj Agent). Model a effort (Opus, xhigh)
nesie jeho definícia. Kód nečítaj sám, všetko robí agent.

1. **Zadanie agentovi:**

   > Upratovanie kódu, dátum `<dnešok>`, časť `<$ARGUMENTS alebo „podľa
   > docs/upratovanie/stav.json“>`. Postupuj podľa svojej definície: vetva
   > `upratovanie/<dátum>`, správanie nemeníš (odtlačok pred = po), najviac
   > okolo 800 zmenených riadkov, výstup PR do master. Do master nemerguj.
   > Úlohy z poľa `naRade` v `docs/upratovanie/stav.json` (zadal ich Michal) majú
   > prednosť pred poradím častí (`poradie`, `dalsia`) — vezmi ich ako prvé.

   V cloudovej routine (bez lokálneho disku F:) dočasné súbory patria do
   `/tmp` a PR otvor nástrojom na GitHub, ktorý je v behu dostupný.
2. **Keď skončí:** jeho výstup (najviac 5 riadkov) je správa behu. V cloude ju
   pošli aj ako PushNotification („Upratovanie <dátum>: PR #…, odtlačok
   zhodný“), lokálne Leaderovi.
3. **Merge robí Leader:** `naex-overovac` na vetve upratovanie/<dátum>, pri
   zelenom výsledku merge do master a push. Nasadenie podľa `/naex-nasad`
   s ostatnými zmenami.
