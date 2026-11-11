# Otázky — HU, vlna 3d (herný stôl, profil, Domov, prechody, vzory motora)

Súbor: `apps/web/src/i18n/hu.json` (1544 kľúčov doplnených 2026-11-11). Glosár sa nemenil;
nové pojmy a pochybnosti sú tu.

## Otázky na Michala / programátora

1. **Vzory motora: zachytené časti ostávajú po slovensky.** `motor.priznava` „{meno} priznáva kartu {karta}.“
   → „Fero bevallja: Cirhóza.“ — `{karta}` z hlášky jadra je slovenský názov karty. Rovnako `motor.doPonuky`,
   `motor.zaverecnaSaOtaca`, `log.taha`. Možnosti: (a) nechať, (b) klient preloží zachytený názov karty
   cez `nazovKarty` (zásah do `hlasky.ts`/`jazyk.tsx`, nie prekladateľa).
2. **Rod v maďarčine.** `tRod` kľúče `.m` a `.z` sú v hu zhodné; `.n` má tam, kde sk má neosobný tvar,
   neosobný tvar aj v hu (napr. `plocha.vybralSi.n` „A választás kész.“, `plocha.cintorin.n` „Vereség a Temetőben“).
   Voľba „Muž / Žena / Neuvádzať“ v profile (`profil.muzPopis`…) v hu nič nemení — ukážky sú rovnaké.
   Skryť túto voľbu pri jazyku hu? (rozhodnutie UI, nie prekladu)
3. **`domov.hero` — Pionier → Simson.** „…nech ten druhý vidí, že tebe nikto nebude blatníky na Pionieri ohýbať“
   → „…a te Simsonod sárvédőjét aztán senki nem fogja görbítgetni“. Jawa Pionier Maďar nepozná ako dedinský
   moped; Simson je maďarský ekvivalent toho istého motívu. Alternatíva: Babetta. Schváliť?
4. **`hrac.prvychPat` „Prvých päť poldecí“** → „Az első öt feles“. Je to nadpis prvých piatich partií (narážka
   na rank Poldeci), alebo niečo iné? Preklad ponecháva slovnú hru s felesom.
5. **`hrac.V / R / P`** (Výhra / Remíza / Prehra) → „Gy / D / V“ (Győzelem / Döntetlen / Vereség). Pozor:
   maďarské „V“ = Vereség (prehra), nie výhra. Farbu dáva `<span>` v Profil.tsx, nie písmeno — funguje;
   len upozornenie pre testerov.
6. **`plocha.kartu`** sa v kóde používa v dvoch pádoch (akuzatív „potiahni kartu“ aj „NA EX na kartu“).
   Maďarčina má jeden tvar: zvolený akuzatív „egy kártyát“; vety s „na kartu“ (`plocha.hrozbaCele`,
   `plocha.kliatby*`) sú postavené tak, aby karta stála v zátvorke. Pri prázdnom `pl` (zriedkavé) vznikne
   „NA EX-et ide (egy kártyát)“ — drobná gramatická chyba. Riešenie: samostatný kľúč pre „na kartu“.
7. **Cena v cigaretách.** `cigariet()` a `stol.cigariet` sú akuzatív („3 cigarettát“), preto všetky ceny
   sú „… {cig} fizetsz érte“ (zaplatíš), nie „ára {cig}“ (cena = nominatív). Opravené aj staršie
   `zhrom.nastroj` z vlny 3b.

## Nové pojmy (nie sú v glosári — navrhujem doplniť)

| sk | hu | prečo |
|---|---|---|
| Návrh (tlačidlo rozdelenia) | Javaslat | bežné slovo, krátke |
| Log | Napló | |
| nástenka (krátko) | faliújság | z glosára „kocsmai faliújság“ |
| dlaždica (Starší) | csempe | |
| šrafa (reči na teplomere) | sraffozás | |
| prah (Dlh, Cirhóza) | küszöb | už v kartách „Májzsugor-küszöb“ |
| marker (posun starších) | jelölő | |
| patronát | pártfogás | |
| sekera: „na sekeru / na sekere / zo sekery“ | krétára / krétán / a krétáról | podľa glosára „kréta“ |
| Kšeft väzňa | Biznisz | glosár (zaniknutý pojem) |
| karta v UI vs. v efekte | UI „kártya“, efekty kariet „lap“ | v hre sa obe používajú; zjednotiť? |
| tlačidlá Pitky | Rágyújt, Tölts!, Ivászat vége | glosár: „Rágyújt“, „Tölts!“ |
| skratky počtu špakov | cs. | „csikk“ |
