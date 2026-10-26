---
name: naex-prevadzka
description: Spustí agenta naex-prevadzkar — kontrola živého webu NA EX! na serveri OVH — dostupnosť a odozva, chyby v logoch, reštarty, disk, pamäť, veľkosť databázy, denná záloha (vznikla, dá sa otvoriť, je celá), certifikát, nasadená verzia a aktualizácie systému. Len číta, vráti semafor. Beží lokálne (SSH kľúč je len na Michalovom PC). Použi, keď používateľ povie /naex-prevadzka, „ako je na tom server“, „funguje živý web“, „sú zálohy“, „kontrola servera“, a pred nasadením.
---

# Prevádzka živého webu

Spustíš agenta `naex-prevadzkar` (nástroj Agent, na pozadí) so zadaním:

> Kontrola živého webu, dátum `<dnešok>`. Postupuj podľa svojej definície:
> len čítaš, nič nereštartuješ ani nenasadzuješ, report do
> `F:/Projects/handoff/prevadzka/<dátum>.md`.

Pracovisko netreba: agent nič nemení, číta z hlavného stromu `F:\Projects\naex`.

**Keď skončí:**
- zelená → jedna veta do prehľadu pre Michala,
- oranžová → do zoznamu Leadera (napr. dopredu naplánovať aktualizáciu
  systému s nasadením),
- červená → Michalovi hneď, s tým, čo agent navrhuje a kto to urobí.
  Zásahy na serveri (reštart, čistenie disku, aktualizácie) robí Leader len
  s Michalovým súhlasom.

**Pravidelne:** denne ráno, napr. v rámci `/naex-stav` alebo strážnej
slučky Leadera. Cloudová routine nejde, lebo v cloude nie je SSH kľúč.
