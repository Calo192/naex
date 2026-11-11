# Otázky prekladateľa HU — dorovnanie po v12.1 a v12.2 (2026-11-11)

Dorovnané podľa master ace26eb8: `apps/web/src/i18n/hu.json` (69 prázdnych kľúčov — pečiatky stavov, výber z ponuky, duchovia kariet, posun línie, texty v12.2), oblasti `pravidla` (37 polí), `pojmy` (11), `vyucba` (49 zastaraných + 6 nových bublín výučby v12.2), `napovedy` (`pas-cigarety`), `achievementy` (kategória *Okolo krčmy* a 38 nových) a `docs/preklady/karty/hu.json` (13 kariet so zmeneným efektom: Vínko, Pasca, Výherný automat, Vychovávateľka, Kostol, Jednota, Družstvo, Kapybara, Traktorista, Hrable, Jogurt, Izolačka, Predavačka). Krčmárka sa nezmenila. Kde sa zmenila len časť vety, ostal pôvodný preklad a zmenila sa len tá časť.

## Nové pojmy v12.2 — návrh do glosára

1. **vykladanie za poldeci** = *kijátszás felesért*; v texte „minden kártya egy teli felesbe kerül“ a „egyet üresre fordít“. Zamietnuté: *fizetés felessel* (platidlo, nie pitie).
2. **maximum poldeci** (Vínko, Krčmárka, barter) = *felesmaximum* („A felesmaximumod 1-gyel magasabb“). Zamietnuté: *feleskorlát* (mýlil by sa s *kijátszási korlát*).
3. **karta navyše** = *extra kártya* (súlad s glosárom „extra akció“); „ďalšia karta v ťahu“ = *a lépés következő kártyája*.
4. **„nestojí poldeci“** (Nástroj, Dedičstvo, priznanie, Robota na Družstve) = *nem kerül felesbe* — nahrádza staré *nem fogyasztja a korlátot*.
5. **doliatie po Pitke** = *újratöltés az Ivászat után* („egy üres feles ingyen újratöltődik“); **obnova po bitke** = *verekedés után mind újratöltődik*, štítok prísunu *Verekedés után*.
6. **Pečiatky na stole** (tvar ako *MEGGYŐZVE* / *ELFOGVA*): VÝTRŽNÍK! = *GARÁZDA!*, VZBURA! = *LÁZADÁS!*, FORSÁŽ! = *PADLÓGÁZ!*, ZAHASENÉ! = *ELOLTVA!*, POSILNENÉ! = *ERŐSÍTVE!*, ZÁVEREČNÁ = *ZÁRÓRA*, ODPOVEĎ = *VÁLASZ*, pod pečiatkou *képpel lefelé* / *felfedve*, majiteľ NA EX *tiéd* / *mindketten* / *rejtve*, „Rany pre {koho}“ = *Pofonok: {koho}*.
7. **Výber z ponuky**: VZIAŤ! (do ruky) = *VIDD!* + *a kézbe*, NAVRCH! (do balíčka) = *FELÜLRE!* + *a pakliba*. Zamietnuté: *ELVENNI!* (neosobný infinitív), *A TETEJÉRE!* (dlhé).
8. **Okolo krčmy** (kategória achievementov) = *A kocsma körül*.

## Pochybnosti

9. **`pojmy` › `naex`** — „skryté či z Vínka zahasí“ prekladám ako „a rejtett vagy a Borocskából jövő NA EX-et az Ellenállás eloltja“. Pozor: starý HU preklad (pred v12.1) mal podmet obrátený („a pár nélküli Ellenállást a NA EX eloltja“); nový je podľa slovenčiny a `plocha.odporTitul`.
10. **`plocha.tahStojiNavyse`** — {cigarety} je v akuzatíve (*1 cigarettát*), preto „…, és {cigarety} is fizetsz (extra kártyák: máj +{n}, bűn)“ namiesto doslovného „a {cigarety}“.
11. **Nápoveda `pas-cigarety`** — „Ja by som ich nenechal stáť“ = *Én nem hagynám őket sokáig állni* (aj v HU sa nápoj „nehagyja állni“).
12. **Achievementy so slovnou hračkou**: *Sekera v pni* = *Tiszta tábla* (výhra zotrie krétu z tabule — sekera je v HU *kréta*); *Huba nevymáchaná* = *Felvágott nyelv*; *Zlé oko* = *Szemmel verés*; *Ruka ako lopata* = *Lapátkéz*; *O fúz* = *Egy hajszállal*, *O chlp* = *Éppen hogy*; *Šichta* = *Gürcölés*, *Poctivá smena* = *Becsületes műszak*; *Rekvalifikácia* = *Szakmaváltás* (*Átképzés* je glosárový Preškolenie); *Zatĺkať, zatĺkať* = *Tagadni, tagadni*; *Ani ryba, ani rak* = *Se hús, se hal*; *Platím rundu* = *Én fizetem a kört*.
13. **Dĺžky**: *Vissza a kínálathoz* (Späť k ponuke) je o 46 % dlhšie, *mindketten* (obaja, pod pečiatkou NA EX) o 100 % — krátke absolútne, ale treba overiť na stole.

## Rozpory v slovenskom zdroji (nemenil som ich)

14. **`os.zhromazdenieText2`** (sk.json) stále píše „Kto pasuje … dostane cigaretu za každú kartu, ktorú ešte smel vyložiť“ a „Končí, keď obaja vyčerpajú limit“ — od v12.2 pas cigarety nedáva. HU preklad zodpovedá starému originálu; po oprave slovenčiny treba kľúč vyprázdniť a preložiť znova.
15. **Achievement `abstinent`** — popis „… nedolievaj …“: dolievanie za cigarety v12.2 zaniklo. Ostáva po starom, kým sa nezmení slovenčina.
