# Pravidlá v5: dávka zmien

V4 je zmrazená 2026-10-24. Sem sa zapisujú zmeny, ktoré Michal schválil alebo
ktoré sa merajú pre ďalšiu dávku. Nič z toho ešte nie je v hre.

| # | Zmena | Stav | Zdroj |
|---|---|---|---|
| 1 | **Fajčenie len v Pitke**: vyfajčiť cigaretu (dobrať kartu) sa dá len počas Pitky, v Zhromaždení nie. Draft zo šenku ostáva bez zmeny. | schválené | Michal 2026-10-24 |
| 2 | **NA EX naraz + Výtržník**: v Pitke obaja vyberú NA EX skryto naraz, odpovede ostávajú v poradí. Pri zrážke na tej istej karte sa z nej stane Výtržník (všetky akcie sa správajú ako Rana pre majiteľa). Pečeň platí ako dnes ten, kto NA EX dal. | meria stratég | Michal 2026-10-24 |
| 3 | **Prestavba bodovania**: body pribúdajú aj ubúdajú pomalšie, každý bod má váhu, výsledky okolo 15 : 13 namiesto 88 : 10. Návrh Michala je nižšie. | návrh, meria stratég | Michal 2026-10-24, roadmapa #91 |
| 5 | **Nové podmienky scorecardov: Absťák** (vyhrá, kto má na konci menej Absťákov) **a Rezerva** (vyhrá, kto má viac plných poldeci). Scorecardy sa preusporiadajú: 8 podmienok, rozmanité, každý starší iný charakter (návrh docs/napady/scorecardy-v5.html). | schválené, návrh rozloženia sa robí | Michal 2026-10-24 |
| 6 | **Priazne starších:** Bitkár ostáva, ale slabší (+1/+2/+3 tuhého namiesto +2/+4/+6). Lakomec dostane novú priazeň (nie zľava v šenku). Ostatné priazne podľa docs/napady/priazne-v5.html na meranie. Násobok bodov za staršieho ostáva V1 (koho sa bojí). Rovnosť podmienky ostáva nikomu (nie hráčovi s priazňou). | schválené smerom, meria stratég | Michal 2026-10-24 |
| 7 | **Pohoršenie oboma smermi:** hráč, ktorého Pohoršenie sa aktivovalo, posunie marker zvoleného staršieho o 1 k súperovi (ako dnes) ALEBO k sebe. K sebe znamená, že priazeň toho staršieho získa on, a keďže Pohoršenie mení priazeň hneď, platí už v tej istej bitke (môže ju rozhodnúť). Limit dvoch hraníc zón, zákaz krajnej pozície a Policajtka platia v oboch smeroch. | schválené, meria stratég | Michal 2026-10-24 |
| 4 | **Prehra balíčkom pod 5 kariet sa ruší.** Okamžitá výhra vydesením ostáva. | schválené | Michal 2026-10-24 |

## Bodovanie v5: návrh Michala (2026-10-24)

Smery a diagnóza sú v docs/napady/bodovanie-v5.html. Michal z nich vyskladal
tento návrh (väčšiny podľa starších):

1. **Body sa počítajú za každého staršieho zvlášť.** Aktívne podmienky na
   scorecarde staršieho (aktivované jeho akciami ako dnes) sa vyhodnotia ako
   **súboj hráčov podmienka po podmienke**. Pri každej podmienke vyhrá ten, kto
   ju spĺňa lepšie: viac lokalít, cigariet, patronátu a strachu ostatných
   starších, alebo menej Dlhov a Cirhóz.
2. **Body za staršieho získa hráč, ktorý vyhrá viac jeho podmienok.** Pri
   rovnosti získajú body **obaja**, každý podľa svojho vzťahu so starším (bod 3).
3. **Koľko bodov:** **1 bod + 1 za každú zónu strachu, v ktorej sa starší
   bojí toho hráča.** Žltá zóna = 2 b, oranžová = 3 b atď. Hráč, ktorému starší
   prejavuje priazeň (marker na jeho strane alebo v strede), dostane len 1 bod.
4. **Podmienka strachu** na scorecarde staršieho ráta len strach **ostatných**
   starších. Vlastný strach sa pre neho nepočíta. Tematicky: starší majú medzi
   sebou rozpory.
5. Plošné body za kusy (lokalita +2 za kus, Dlh −1, Cirhóza −2, 3 cigarety = 1 b)
   aj násobenie počtom aktívnych podmienok končia.

Na zmeranie (stratég, varianta a turnaj botov):
- rozptyl skóre a tesnosť (cieľ okolo 15 : 13),
- či sa ešte oplatí bitka o lokalitu,
- ako často rozhodne rovnosť podmienok,
- či sa výsledok dá čítať počas partie (návrh: pri každom staršom ukazovať,
  kto by ho teraz bodoval),
- podiel zručnosti voči náhode oproti v4.

## Priazne v5: interview s Michalom (2026-10-24)

Podklady: docs/napady/priazne-v5.html a docs/playtesty/priazne-rozbor-20261024.html.

| Priazeň | Rozhodnutie |
|---|---|
| Úžerník | **Premenovať.** Efekt: po bitke sa ti zníži priznaný Dlh o 1/2/3. |
| Lakomec | **Premenovať, nová priazeň** (návrh treba). Zľavu v šenku a doterajší barter nechce. |
| Neprajník | **Výpalné**: súperovo NA EX na tvoju kartu ho stojí 1/2/3 cigarety, dostaneš ich ty. |
| Bitkár | Ostáva, slabší: +1/+2/+3 tuhého. |
| Veriaci | Zatiaľ bez zmeny (Viera navyše +1/+2/+3). |
| Fajčiar | Ostáva +1/+2/+3 cigarety, ale **po výbere zo šenku** (nie v 1. Pitke). Súperovo **Obmedzenie ich neuberá** (priazeň je chránená). |
| Alkoholik | **Na zdravie**: tvoje NA EX ti nepoškodí pečeň (sila 1 prvé v kole, 2 dve, 3 všetky). |
| Exekútor | **Nová priazeň** (návrh treba). Dnešný prah Exekúcie sa neprejavil nikdy. |

Ďalšie rozhodnutia:
- **Priazeň dediny** (tuhé za rozdiel súčtu priazní) **nie**.
- **Pohoršenie mení priazeň hneď**, už v tej istej bitke, ako dnes kód. Treba to dopísať do pravidiel (dnes PRAVIDLA hovoria o ďalších kolách).
- **Bot**: naučiť ho dávať súperovi najslabšiu priazeň. Zároveň zmerať, ktoré priazne sú najslabšie, a vyrovnať ich tak, aby žiadna nebola mŕtva. **Cieľ Michala: pridelenie priazne staršiemu (komu dám prebytok) musí byť ťažké rozhodnutie**, nie vopred známe „tieto priazne nič nerobia“.

## Priazne v5: interview 2 (Michal 2026-10-25)

Podklad: docs/napady/priazne-v5-set.html.

- **Miera sily:** 1 bod sily priazne ≈ 1 cigareta za kolo. Bitkár +1/+2/+3 jej zodpovedá (zmerané), ďalej sa neoslabuje; ostatné priazne sa zdvihnú na túto úroveň.
- **Lakomec → Abstinent:** v bitke +1/+2/+3 Pohoršenie („uvidíme, čo to spraví“ — meria stratég).
- **Exekútor:** súperov prah Exekúcie je nižší o 1/2/3.
- **Úžerník → Kmotor:** po bitke zníži priznaný Dlh o 1/2/3. Bez Dlhu nerobí nič (nechať tak, bez náhrady).
- Návrhy nápadníka Výpalné za každé súperovo NA EX a Na zdravie „do dna“ (poldeci z tvojho NA EX sa vráti plný) zatiaľ nerozhodnuté — čakajú na meranie.
