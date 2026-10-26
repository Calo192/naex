---
name: naex-analytika
description: Spustí agenta naex-analytik — týždenný rozbor správania ľudí na živom webe NA EX! — lievik registrácia → výučba → prvá partia → návrat, dohraté a opustené partie, dĺžka a tempo, retencia, proti komu hrajú, známky a spätná väzba; 3–5 zistení s číslami pre Navrhára a návrhy, čo začať merať. Len číta, beží lokálne (heslo admina). Použi, keď používateľ povie /naex-analytika, „ako hrajú ľudia“, „kde odchádzajú“, „koľko ľudí hrá“, „retencia“, „analytika hráčov“.
argument-hint: "[obdobie, napr. 14 dní — predvolene posledný týždeň]"
---

# Analytika hráčov

Spustíš agenta `naex-analytik` (nástroj Agent, na pozadí) so zadaním:

> Analytika hráčov, dátum `<dnešok>`, obdobie `<$ARGUMENTS alebo posledných 7 dní>`.
> Postupuj podľa svojej definície: len čítaš, ľudia oddelene od AI, nikdy
> jednotlivec, report do `F:/Projects/handoff/analytika/<dátum>.html`.

Pracovisko netreba: agent nič nemení, číta z hlavného stromu `F:\Projects\naex`.

**Keď skončí:**
- zistenia s príjemcom „Navrhár“ pridaj do zadania najbližšieho behu
  `/naex-navrhy` (cesta k reportu),
- návrhy na meranie (`roadmapa-*.json` vedľa reportu) nahraj do Prijímača
  roadmapy (`admin.ts roadmapa-pridaj --zivy`), ak s tým Michal súhlasí,
- Michalovi 3 vety: koľko ľudí a partií, kde najviac odchádzajú, čo z toho
  plynie.

**Pravidelne:** raz týždenne (napr. pondelok ráno). Cloudová routine nejde,
lebo v cloude nie je heslo admina.
