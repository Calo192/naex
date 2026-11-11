# Otázky EN — dorovnanie po v12.1 / v12.2 (2026-11-11)

Dorovnané `apps/web/src/i18n/en.json` (68 kľúčov: pečiatky stavov, výber z ponuky, duchovia kariet, posun línie,
vykladanie za poldeci), oblasti `pravidla` (37), `pojmy` (11), `vyucba` (55), `napovedy` (1), `achievementy`
(82 polí: druhá dávka 38 + kategória) a karty `docs/preklady/karty/en.json` (Vínko, Pasca, Výherný automat,
Vychovávateľka, Kostol, Jednota, Družstvo, Kapybara, Traktorista, Hrable, Jogurt, Izolačka, Predavačka).
Glosár sa nemenil — nové pojmy na doplnenie sú nižšie.

## Nové pojmy v12.2 na doplnenie do glosára

1. **Vykladanie za poldeci** (limit = plné poldeci, každá karta jeden otočí na vypitý) → *every card costs a full
   shot*; *every card turns one to empty*. Limit ostáva *play limit* (glosár).
2. **Maximum poldeci** (Vínko, barter, Krčmárka) → *shot maximum* („Your shot maximum is 1 higher.“).
3. **Karta navyše / ďalšia karta v ťahu** (Vypiť = n kariet = n poldeci + n − 1 cigariet) → *extra card* (pojem,
   nerest, achievement), *another card in a turn* (štítky, cenník). Tlačidlo **Vypiť** ostáva *Down one* (glosár),
   vo vete *down it in one* („piješ do dna“).
4. **Obnova po bitke** → *all shots are restored to full*; **doliatie po Pitke** → *refill after the Booze-up*
   (pojem *refill* z glosára; doliatie za cigarety zaniklo: *There's no refilling for cigarettes*).
5. **Pečiatky stavov na karte**: VÝTRŽNÍK! → **HOOLIGAN!**, VZBURA! → **REVOLT!**, FORSÁŽ! → **OVERDRIVE!**,
   ZAHASENÉ! → **SNUFFED OUT!** (sloveso *snuff out* už v Pravidlách), POSILNENÉ! → **BOOSTED!**, ZÁVEREČNÁ →
   **LAST ORDERS**, ODPOVEĎ → **ANSWER**; riadky pod pečiatkou *face down*, *revealed*, *yours*, *both*, *hidden*,
   *Punches for {koho}*. Dĺžky v limite (SNUFFED OUT! je o 33 % dlhšie než ZAHASENÉ!).
6. **Výber z ponuky**: VZIAŤ! → **TAKE!**, NAVRCH! → **ON TOP!**, „do ruky“ / „do balíčka“ → *to hand* / *to deck*.
7. **Kategória achievementov „Okolo krčmy“** (Spätná väzba, známky, dni hrania) → **Around the Pub**.
8. **Duch karty mimo pohľadu** („miesto“, „miesto · spoj: n“) → *spot*, *spot · link: {pary}*; posun línie
   *Shift the line left/right*, *past the edge: {n}*, *To the location*.

## Zdroj (sk) a význam

9. **Achievement `do-dna`** — podľa výkladu v12.2 (bod 11) ráta len karty navyše, ale slovenský popis ostal „Vypi do
   dna za jedno kolo aspoň {prah} poldeci“ (preto ho dorovnaj nehlási). EN ostáva *Down at least {prah} shots in a
   single round*. Keď sa slovenčina spresní, preklad sa ukáže ako zastaraný.
10. **`zle-oko.popis`: „Povier, ktoré neprerušila súperova Viera“** — v hre Viera Povery *ruší*; preložené *that your
    opponent's Faith didn't cancel*. Ak „neprerušila“ znamená niečo iné, opravím.
11. **`sekera-v-pni`** — slovná hračka (sekera v pni / bitky na sekere) v angličtine nejde (glosár: *the Tab*).
    Preložené **„The Tab Comes Due“**. Možnosti: *Running Tab* / *The Tab Comes Due* / *Settling the Tab* (zamietnuté,
    plietlo by sa s *All Square* = Vyrovnaný účet).
12. **Mená achievementov** (voľby s príchuťou): *Gobby* (Huba nevymáchaná), *Holy Joe* (Svätuškár), *Bodger* (Fušer),
    *Reskilled* (Rekvalifikácia — „Retraining“ je herný pojem Preškolenie), *Hard Graft* (Šichta), *Familiar Face*
    (Stály hosť — „Regular“ je už Štamgast), *Deny, Deny, Deny* (Zatĺkať, zatĺkať), *Neither fish nor fowl* (Ani
    ryba, ani rak).
13. **`plocha.tahStojiNavyse`** „(karty navyše: pečeň +{n}, nerest)“ — preložené *vices* (množné), lebo každá karta
    navyše je jedna nerest.
