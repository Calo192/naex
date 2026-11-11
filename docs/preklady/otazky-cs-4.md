# Otázky CS — dorovnanie po v12.1 / v12.2 (2026-11-11)

Dorovnané `apps/web/src/i18n/cs.json` (68 kľúčov: pečiatky stavov, výber z ponuky, duchovia kariet, posun línie,
vykladanie za poldeci), oblasti `pravidla` (37), `pojmy` (11), `vyucba` (55), `napovedy` (1), `achievementy`
(82 polí: druhá dávka 38 + kategória) a karty `docs/preklady/karty/cs.json` (Vínko, Pasca, Výherný automat,
Vychovávateľka, Kostol, Jednota, Družstvo, Kapybara, Traktorista, Hrable, Jogurt, Izolačka, Predavačka).
Glosár sa nemenil — nové pojmy na doplnenie sú nižšie.

## Nové pojmy v12.2 na doplnenie do glosára

1. **Vykladanie za poldeci** → *každá karta tě stojí plného panáka*; *každá karta jednoho otočí na vypitého*.
   Limit ostáva *limit vykládání* (glosár).
2. **Maximum poldeci** → *maximum panáků* („Tvoje maximum panáků je o 1 vyšší.“).
3. **Karta navyše / ďalšia karta v ťahu** → *karta navíc* (pojem, neřest, Pravidlá), *další karta v tahu* (štítky,
   cenník). Tlačidlo **Vypiť** ostáva *Vypít* (glosár), vo vete „piješ do dna“ → *piješ do dna*.
4. **Obnova po bitke** → *všechny panáky se obnoví na plné*; **doliatie po Pitke** → *dolití po Pitce*
   (za cigarety zaniklo: *Za cigarety se nedolévá*).
5. **Pečiatky stavov na karte**: VÝTRŽNÍK! → **VÝTRŽNÍK!**, VZBURA! → **VZPOURA!**, FORSÁŽ! → **FORSÁŽ!**,
   ZAHASENÉ! → **UHAŠENO!** (sloveso *uhasit* už v Pravidlách), POSILNENÉ! → **POSÍLENO!**, ZÁVEREČNÁ →
   **ZAVÍRAČKA** (otázka CS-3 č. 1 sa tým uzatvára), ODPOVEĎ → **ODPOVĚĎ**; riadky pod pečiatkou *lícem dolů*,
   *odhalená*, *tvoje* (NA EX je s. r.), *oba*, *skrytě*, *Rány pro {koho}*.
6. **Výber z ponuky**: VZIAŤ! → **VZÍT!**, NAVRCH! → **NAVRCH!** (v češtine rovnako; *NAHORU!* zamietnuté — znie ako
   smer, nie miesto v balíčku), „do ruky“ / „do balíčka“ → *do ruky* / *do balíčku*.
7. **Kategória achievementov „Okolo krčmy“** → **Kolem hospody**.
8. **Duch karty mimo pohľadu** → *místo*, *místo · spoj: {pary}*; posun línie *Posunout linii doleva/doprava*,
   *za okrajem: {n}*, *Na lokalitu*.

## Zdroj (sk) a význam

9. **Tvar „plní panáci“ vs. glosár „panáky“** — nové texty píšu *plné panáky* (glosár: r. m. neživ.: panáky, panáků).
   V nezmenenom texte Pravidiel ostal raz tvar „plní panáci“ (`pravidla` `bodovanie.p27`, výkupné); nemenil som ho, lebo sa
   slovenčina nezmenila. Zjednotiť pri ďalšej kontrole?
10. **Achievement `do-dna`** — podľa výkladu v12.2 (bod 11) ráta len karty navyše, ale slovenský popis ostal „Vypi do
    dna za jedno kolo aspoň {prah} poldeci“. CS ostáva *Vypij do dna za jedno kolo aspoň {prah} panáky*.
11. **`zle-oko.popis`: „neprerušila“** — v hre Viera Povery *ruší*; preložené *které nezrušila soupeřova Víra*.
12. **Mená achievementov**: *Sekyra v pařezu* (slovná hračka so sekerou ostáva, glosár *na sekyru*), *Nevymáchaná
    huba*, *Svatoušek*, *Rudá vesnice* (Červená dedina — „rudá“ nesie aj komunistickú príchuť), *Mlčeti zlato*,
    *Zapírat, zapírat* (Zatĺkať, zatĺkať — česká obdoba porekadla), *Stížnost hostinskému*, *Poctivá směna*
    (nie *šichta*, tá je už Šichta).
13. **Prahy 4–10 pri „aspoň {prah} aktivní Víry / Omezení“** (`svatuskar`, `zakaz-vstupu`) — podľa slovenčiny a
    doterajšieho `petelica-z-neba` je tvar pre 2–4; pri prahu 7 a 10 by správne bolo „aktivních Vír“. Prestavať na
    „Aktivní Víry v jedné rvačce: aspoň {prah}“ ako pri `stokar`?
