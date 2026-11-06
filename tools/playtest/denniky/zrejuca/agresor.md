# Strategický denník — Bitkár Rudo (štýl agresor) — Zrejúca

Charakter štýlu: `../../styly.json` (kľúč `agresor`). Formát: `../README.md`.
Denník vedie hráč štýlu sám; sudca len pripisuje poznámky k chybám v pravidlách.

## Aktuálna stratégia (po partii 3, pravidlá v11.6, stredná partia 5+finále)
**Cieľ:** vyhrať bitku K(n) s 3–4 červenými strachmi tak, aby si v K(n+1) mal 4 červených **už pred bitkou** (4c sa kontroluje PRED Nakladačkou 4e, takže 4. červenú musíš mať z predošlej Nakladačky) → výhra strachom hneď. P3: červení po K1 = 1, po K2 = 3 (Nakladačka 15), 4. (Hrobár) až v K5 → výhra sa nestihla; keby K3 (prehra 5:7) vyšla, výhra strachom v K4 bola reálna. Záložný plán = **špaky zo starších**: víťaz dostane za každého staršieho svoj najvyšší marker (červená 5, oranžová 3): so 4 červenými je to **+16 až +18 za jednu vyhratú bitku** (P3 K5 +18, K2 +5 pri 1 červenom). Strach teda nie je „ozdoba“ — je to najväčší zdroj špakov, ak vyhráš bitky po tom, čo ho máš.
> Sudca 2026-11-06: Časovanie 4c pred 4e je správne (§9.4 Nakladačka bod 4, §10 Výhra strachom) — overené v partiách 20261106-010635-1 K5 aj 20261106-024710-2 K5.
1. **Červené treba mať skoro (K1–K2) a bitky K3+ nesmieš prehrať** — P3: dve prehry (K3 5:7, K4 7:11) stáli ~25 špakov (jej starší +6/+4, karty +8/+10, Exekútor mne −3/−4). Prvá Nakladačka (K1, 6 b) na JEDNÉHO staršieho do červenej (Veterinár; pre súperku bezcenná priazeň Advokát), druhá (K2, 15 b): 6+6+3 (dve červené + oranžová) – zajatie už červeného staršieho nepridá červenú.
> Sudca 2026-11-06: Priazeň nesie scorecard rozdaný náhodne pre každú partiu (§3, §10 Priazeň) — „Veterinár = Advokát“ platilo len v tej partii (v 20261106-015313-1 mal Veterinár Robotu). Pred rozdelením čítaj priazeň zo scorecardu.
2. **Šetri na finále, nie na bitky: finále konvertuje tuhé 1 : 1 na špaky** (P3: 3:17 → ≈ +27 špakov súperke z 28 → 50, hoci som viedol 40:28). Do finále choď s ≥ 4 cigaretami a ≥ 3 kartami v ruke; prvý ťah draftu stojí 1 cigaretu a bez nej draft vypadne (P3: 0 cigariet = prázdna fáza). V K5 už vyhratú bitku nekupuj za posledné cigarety (minul som 4 na 3 karty pri 10:4).
> Sudca 2026-11-06: Finále v 20261106-024710-2 bolo podľa priebeh.log tuhé 21 : 3 pre Klebetnú, Nakladačka 18 = 18 špakov, hádka 2 — jej finále dalo spolu 27 hrubých + výkupné 4 (nie „3 : 17“).
3. **Finále: útočník (zaostávajúci) vykladá prvý a podstrčí Manželku/kartu ako prvú do MOJHO kraja → vezme mi hranu lokality** (P3: Petelica ×2 chaty jej, tuhé 3:17). Obranca musí mať v ruke aspoň 2 telá, alebo vybrať lokalitu s neškodnou hranou na svojej strane a ako prvú vyložiť Záverečnú.
4. **Jej Bzdocha + Zrážka**: keď je na stole Bzdocha súperky, moje NA EX na JEJ kartu zničí zrážka (Výtržník len pre ňu, K3 5:7). NA EX dávaj len na VLASTNÉ karty (jej odpoveď tam je zrážka = Výtržník pre mňa, čo by jej uškodilo) alebo vôbec.
5. **Pred NA EX na vlastnú kartu skontroluj pečeň:** karta s aktívnou Pečeňou (Pijan, Hasič, Traktorista) ju NA EX zdvojí → Cirhóza (K1 2× Cirhóza, Hasič v K3 +3). Lokalita **Kar** (pečeň za NA EX dostane súper) robí z NA EX zadarmo – vyber ju, keď plánuješ NA EX; Kostol/Kultúrny dom/Vandal sú súperkina odpoveď na NA EX štýl.
6. **Tuhé bez lokality:** karty s Pecka/Pecka na spoji outer–inner (Mäsiar→Kočovník→Degustátorka, K5: 10 tuhých z 3 kariet) a Vymáhač + Sypač (Podpora: Vymáhač má Rany ako Pecky, K4: 11:3). Vymáhač rastie s priznanými Dlhmi (5 Dlhov = 2 Rany).
7. **Nakladačka:** zajatie sa oplatí, keď súper má pri staršom vysoký marker (K5 Starosta: 3 špaky preč jej, 3 mne za 5 b; zmizne mu priazeň Kmotor) – ale vo finále potom z toho staršieho nebodujem (markery zanikli). Priazeň z môjho strachu dostáva súper: nezvyšuj strach u Vychovávateľky (Bitkár), Farára (Veriaci), Krčmárky (Robota), Autobusára (Fajčiar).
> Sudca 2026-11-06: Zoznam „Vychovávateľka (Bitkár), Farár (Veriaci), Krčmárka (Robota), Autobusár (Fajčiar)“ platí len pre partiu 20261106-024710-2 — scorecardy s priazňou sa rozdávajú náhodne každú partiu (§3, §10).
8. **Pas v Z (cigarety) je dobrý len pri prehratej bitke**; súperka (Klebetný) pasovala K1–K5 a vošla do finále s 8 cigaretami a 10 kartami – jej plán je hromadiť na finále.

## Nástroje
- **NA EX na vlastnú obrannú kartu (Manželka: Viera ×2 + Dlh ×2)** — súperove tuhé spadne na 0 namiesto navyšovania svojich · stav: overený (1×) · dôkaz: K1 Pitka 1, 3:3 → 4:0, Nakladačka 9 po ďalších kartách; cena Dlh +2 (kompenzuje Robota ×2 na hrane) a nerest 2 · pravidlá: v11.6
- **Podstrčenie karty s Petelicou na súperovu stranu ako prvá karta jeho kraja** — beriem jeho hranu lokality, kým má on menej kariet v kraji · stav: overený · dôkaz: K1 (Vymáhač 3 Rana, Poľovník Petelica; 6:0 → 9:0), K3 (Zberný dvor 11:0), K5 (Poľovník superova) · pravidlá: v11.6
- **Pamätník s Petelicou + Opatrovateľka (alebo Manželka/Poľovník v jej okolí)** — Petelica ×2 = 6 tuhých za 2 karty · stav: sľubný (K5: 6:2, potom ho súper zrušil NA EX) · pravidlá: v11.5
- **Počet kariet v kraji (Ihrisko, hrana lokality)** — 2 moje karty v kraji proti 1 jeho vezmú prevahu: +2 Ihrisko, hrana, a Traktoristovo „Pecka navyše“ sa zmení na Dlh · stav: overený · dôkaz: K2 5:7 → 9:1 (Miňištrant + Dievčina) · pravidlá: v11.6
- **Praudovravec súpera ako prvá karta v mojom kraji** — jeho Odpor sa ráta ako Posilnenie a zdvojí MOJU Petelicu na spoji (K3: 6 tuhých z jednej karty) · stav: kandidát (náhoda; ale nezvyčajné: oplatí sa nechať súperovi hranu, kde moja Petelica ide do jeho Odporu) · pravidlá: v11.5
- **Nakladačka 9/7/6 rozdelená 6 + 3** — červená + oranžová hneď · stav: overený (K1, K2, K3) · 3 červení po K3 · pravidlá: v11.6
- **Robota priazeň (Vychovávateľka) súperovi** — stav: zavrhnutý (K1–K5: súper +3 špaky/bitka, spolu ≥ 12) — dávať iba keď ju zajmeš v nasledujúcom kole.
- **Zajatie** — stav: podmienený (P2 K5: klient už zajatie pustil, `{"type":"prebytok","zdvihy":[],"zajatia":["farar"]}`); Nakladačka 5 → väzeň Farár (ráta sa ako červená, markery zmiznú, súper dal 0 špakov lebo jeho marker bol 0); stálo 5 b a −5 špakov/výhra z Farára vo finále · väzeň v strednej partii nestihne 3 (po K5 len 1) · schopnosť Farára vo finále zrušila jeho NA EX (Dvojčatá, obrat 13:17 → 17:14) · pravidlá v11.6
- **Kapybara, Strýko Kšeft, Valaška/Vidly do Dedičstva, Vynútené NA EX (Krčma), Vízia na spálenie Cirhózy** — kandidáti, nevyskúšané (pozri nápady).

- **NA EX na vlastnú kartu s neaktívnou Petelicou/Pecka (Hasič, Petelica pos.4 bez páru)** — stav: overený (2×) · dôkaz: P2 K3 9:8 → 13:8 (Pijan odpoveďou 15:9), K4 6:3 → 11:3 (po jeho odpovedi 7:3); cena pečeň +1, nerest 2 (zároveň Chuť splnená → bez Absťáka) · pravidlá: v11.6
- **Záverečná na vlastnú stranu ako rozhodujúci hlas o prevahe** — stav: overený (1×) · dôkaz: P2 K1: Sabotér už nemal limit, moja skrytá Manželka vyrovnala 3:3, prvá karta pri lokalite (moja) → prevaha → 4:0/5:0; K3 jeho Záverečná zamkla jeho kraj (za Záverečnú sa nedá priložiť) · pravidlá: v11.6
- **Poľovník na SÚPEROVU stranu** — stav: overený (1×) · dôkaz: K5 spálil jeho Pes z MOJEJ strany (Nástup pôsobí na druhú stranu od miesta Poľovníka); K3 Petelica+Petelica z hrany lokality · pravidlá: v11.6
- **Pas v prehratej bitke + Dievčina na jeho strane** — stav: sľubný/overený · dôkaz: P2 K2 (0:9) cigarety 1 → 13 (pasy 2+3+2, Dievčina Cigareta×2 za Pitku) → K3 draft 7 tiel · pravidlá: v11.6
- **NA EX na súperovo Dvojčatá v prehratej bitke** — stav: sľubný · dôkaz: K2 Nakladačka 12 → 9, jeho Dlh +2/Pitku · nerest 2 + limit −1 v ďalšom Zhromaždení · pravidlá: v11.6
- **Valaška do Dedičstva (2 cig. ako 2. Nástroj)** — stav: podmienený · dôkaz: P2 finále 13 → 16 tuhé (Pecky +1 s Veteránom ×2) · cena 2 cig. = nutné mať ich po drafte · pravidlá: v11.6
- **Kostol (NA EX len pri oltári)** — stav: sľubný pre obranu pred jeho NA EX trikmi · dôkaz: K5 6:1, no jeho NA EX na altárny Šofér zrušil Ranu (2:2); Šofér bez NA EX = Pecka navyše + cig · pravidlá: v11.6
- **Bzdocha (moja)** — stav: sľubný · dôkaz: K4 vidím jeho NA EX (v stave len značka pri karte, ľahko prehliadnuť!) · pravidlá: v11.6
- **Stryná/Manželka ako odpoveď na jeho kliatkové NA EX** — stav: overený (1×) · K4 Stryná: Dlh −2, pečeň −2 · pravidlá: v11.6
- **Pasca (Dedičstvo)** — stav: kandidát/nejasné (K2 neukázala efekt, súper nič nepriložil k mojej karte).

- **Vízia na spálenie Cirhózy** — stav: overený (1×) · dôkaz: P3 K1 Vízia ukázala práve Cirhózu, spálená (−3 špaky ušetrené) · náhoda: vrchná karta; Dievčina (Vízia+Pakt) dala Víziu · pravidlá: v11.6
- **Spoj outer–inner reťaz Pecka+Pecka (Mäsiar, Kočovník, Degustátorka)** — stav: overený (1×) · dôkaz: P3 K5 10:4 z 3 kariet za 4 cig · pravidlá: v11.6
- **Vymáhač + Sypač (Podpora: Rany ako Pecky) + priznané Dlhy** — stav: overený (1×) · dôkaz: P3 K4 3 karty = 11:3 pred jej NA EX/Vandalom · pravidlá: v11.6
- **Lokalita Kar (pečeň za NA EX dostane súper)** — stav: sľubný · dôkaz: P3 K3 moje NA EX mi nedali pečeň, jej dali Cirhózu; ale Bzdocha+Zrážka · pravidlá: v11.6
- **Zajatie staršieho s jej vysokým markerom (Starosta, jej oranžová)** — stav: overený/podmienený · dôkaz: P3 K5 +3/−3 špaky za 5 b Nakladačky, zmizla priazeň Kmotor; väzeň Starosta má použiteľnú schopnosť (všetky akcie lokality ×2 – symetricky, v P3 nepoužitá) · pravidlá: v11.6
- **Výhra strachom (4 červení PRED bitkou)** — stav: podmienený · dôkaz: P3 3 červení po K2, 4. až po K5; kontrola 4c je pred 4e, takže posledná červená z tej istej Nakladačky nestačí (PRAVIDLA §9 tabuľka) · pravidlá: v11.6
- **Pasca na agresora: jej Zrážka NA EX (Bzdocha), jej Kostol/Kultúrny dom (bez tuhého na hrane), Vandal po mojej výhre 11:4 (otočená lokalita), NA EX na vlastné Veterán/Policajtka (Rana ×2)** — stav: zaznamenané ako súperove protinástroje · P3 K3, K4, K5

## Experimenty
### E1 · Keď má súper rovnaké tuhé, dám NA EX na vlastnú kartu s neaktívnymi Vierami, čakám, že jeho tuhé klesne na 0
- partie: 20261106-010635-1 (K1)
- výsledok: funguje
- čísla: 3:3 → 4:0 pri cene Dlh +2, nerest 2, pečeň +1; súper žiadne NA EX nedal
- čo ďalej: skúsiť aj na Opatrovateľku/Manželku v K3+ (K5 mal súper svoj NA EX na Poľovníka)
- pravidlá: v11.6
### E2 · Keď vyhrám K1 s Nakladačkou 9, dám 6 na jedného neškodného staršieho a v K2 ho zajmem za 5
- partie: 20261106-010635-1 (K1–K3)
- výsledok: nejasné — červená v K1 vyšla (Vychovávateľka 3), zajatie v K2 aj K3 klient zablokoval (N1); zvolená Vychovávateľka bola zlá voľba (Robota 3 súperovi)
- čísla: 3 červení po K3 (Vychov., Starosta, Farár), 4. (Krčmárka) po K5; spolu ~24 bodov Nakladačky na 4 červených
- čo ďalej: zopakovať s Fajčiar/Kmotor/Advokát/Abstinent ako prvou červenou; zajatie skúsiť, len keď N1 opravia
- pravidlá: v11.6
### E3 · Keď nemám tuhé v ruke, kúpim ho: Strýko z Ameriky Kšeft (2 cig → +1 Rana)
- partie: nevyskúšané (Strýko som v K5 dal do šenku; nikdy som nemal cigarety navyše)
- výsledok: nejasné
- čo ďalej: nechať si 2 cigarety v K3–K5 a vziať Strýka v drafte
- pravidlá: v11.6

### E4 (P2) · Keď je bitka prehratá, pasujem a NA EX-ujem jeho Dvojčatá/Cigareta karty, čakám cigarety a menšiu Nakladačku
- partie: 20261106-015313-2 (K2)
- výsledok: funguje čiastočne — Nakladačka 12 → 9, cigarety 1 → 13 (pasy), ale NA EX na Podvodník nezvýšilo jeho cigarety dolu (náhľad „súper −6“ nesedel, nezrovnalosť 1)
- čo ďalej: prehra v bitke so špakovým rozdielom ~−12 je preto zníženie škôd, nie zisk; lepšie nehrať lokalitu, kde jeho podstrčenie zoberie moju hranu
- pravidlá: v11.6
### E5 (P2) · NA EX na vlastný Hasič (neaktívna Petelica ×2) / Veterán; Pijan ako odpoveď
- partie: 20261106-015313-2 (K3, K4, finále)
- výsledok: funguje — pozri Nástroje
- pravidlá: v11.6
### E1 (uzavretie, P2) · Zajatie po oprave klienta
- výsledok: zajatie prešlo (K5, Farár); v strednej partii nedáva špaky (stratil som červenú 5/výhru), väzňov je len 1 z 3 — výhra väzňami nedosiahnuteľná; schopnosť väzňa (Farár) užitočná
- čo ďalej: skúsiť v KRÁTKEJ partii (2 väzni) alebo zajať toho, pri ktorom súper má vysoký marker (krádež špakov 3–5 hneď)
### E6 (P2) · Valaška do Dedičstva
- výsledok: +3 tuhé vo finále za 2 cig.; nutné nechať si cigarety po drafte (pasom v Z1 → cigarety → Dedičstvo v Z2)

### E1 (P3) · Zajať staršieho, pri ktorom má súper VYSOKÝ marker (krádež špakov) — Starosta v K5
> Sudca 2026-11-06: Číslovanie experimentov má rásť (README denníkov: „číslo rastie, staré sa nemažú“); E1–E5 (P3) sú nové experimenty E9–E13, nie opakovania E1–E5. Krádež +3/−3 sedí s logom (zajatie Starostu, K5).
- výsledok: funguje čiastočne — 5 b Nakladačky = +3 mne / −3 jej (rozdiel 6) a zmizla jej priazeň Kmotor; slabina: väzeň už nebodoval vo finále (markery zanikli) a väzni 1/3 sú ďaleko
### E2 (P3) · Vízia spáli Cirhózu — K1
- výsledok: funguje (jednorazovo, náhoda vrchnej karty)
### E3 (P3) · Strýko Kšeft / cigarety na tuhé — nevyskúšané (cigarety vždy 0–3, minuté na draft)
### E4 (P3) · NA EX na vlastné karty s aktívnou Pečeňou + Kar — K1: 12 → 17 tuhé stálo 2 Cirhózy (−6 špakov, 1 spálená Víziou); K2: NA EX Traktorista 12 → 17 bez pečeňového trestu
> Sudca 2026-11-06: Podľa priebeh.log bola K1 6 : 0 a 12 → 17 bolo K2 (Traktorista, 17 : 2, Nakladačka 15). Dve Cirhózy z K1 (Pijan) sedia.
### E5 (P3) · Podstrčiť Vymáhača ako prvú kartu na jej stranu vo finále (aby mi vrátil hranu) — nefungovalo: ona mala viac kariet (3 : 1)
- čo ďalej: do finále prísť s 3+ kartami a 4+ cigaretami

## Nápady na vyskúšanie
0. **(P3, najsilnejšie)** Prejsť na plán „4 červení pred K3“: K1 Nakladačka 6 → červená #1; K2 Nakladačka ≥15 → 2 červené + oranžová; K3 vyhrať + oranžová → červená #4; **K4 výhra = koniec hry**. Rozhodujúce je neprehrať K3 (jej Bzdocha/Zrážka) — v K3 ako obranca vyber lokalitu bez Bzdochy v jej šenku (nevieš), alebo NA EX nedávať na jej karty.
0b. Pred finále nechať 4 cigarety a 3 karty (v K5 si zobrať len 1–2 karty); vo finále mať Záverečnú alebo 2 telá do vlastného kraja proti podstrčeniu.
0c. Zajať Poštárku (4 cigarety) namiesto Starostu, ak chýbajú cigarety na draft finále.
1. **Ako obranca vybrať lokalitu, kde hrana na mojej strane je prázdna/Viera, a ako prvé vyložiť Záverečnú** (súper nevidí, nemôže za ňu priložiť) — chrániť prevahu v mojom kraji bez toho, aby ju podstrčená karta zoberie.
2. Zajať staršieho s VYSOKÝM súperovým markerom (oranžová/červená) v K3–K4 — krádež 3–5 špakov hneď (P2 Farár dal 0 lebo súper nemal marker).
3. Krátka partia (3 lokality): väzni 2 → výhra väzňami reálna? (nevyskúšané).
4. Krabička cigariet / Zapaľovač (Cigareta) proti Sabotérovi, ktorý žije z cigariet? neskúšané.
5. Vandal (otočiť lokalitu 180°) ako odpoveď na jeho Záverečnú alebo podstrčenie: v P2 K2 by otočil Petelicu/Pecku z mojej hrany na jeho kraj (nemal som ho — dal som ho naspodok!). Držať Vandala v šenku/ruke.
6. Pasca + Praudovravec súpera ako prvá karta v mojom kraji (zdvojí MOJU Petelicu) – z P1, nevyskúšané v P2.
7. Kapybara na reči súpera — nepotrebné; Predsedova vila nevyskúšané.
8. Valaška + Vidly + Veterán všetko spolu so zdvojením NA EX (Veterán zdvojí aktívne, nezruší) — dopočítať stropy.

## Čo štýlu chýba v hre
- Cesta „väzni“ (hlavný cieľ charakteru) cez klienta nehrateľná (N1). Mimo toho je v strednej partii drahá: 3 väzni = ~33 bodov Nakladačky (3 × (červená 6 + zajatie 5)), čo je viac než výhra strachom (4 červení ≈ 24 a väzeň sa ráta ako červená) — väzni sú lacnejší len v krátkej partii (2 väzni).
- Agresor nemá ako „kúpiť“ tuhé (cigarety → draft karty → tuhé), kým súper investuje; keď má 0 cigariet, draft vypadne, ruka ostane 1–2 slabé karty (K4: ruka Manželka + Vymáhač → 0:11).
- Obrana proti podstrčeniu: súper položí prvú kartu v mojom kraji a vezme moju hranu (K2, K4, K5, K6). Agresor tu nemá reakciu, len „viac kariet v kraji“ — ktoré mu chýbajú.
- Veľká Nakladačka (7–11) nemá kam ísť, keď sú všetci neškodní starší na červenej; bezpečná červená je drahá (6) a priazeň dáva súperovi výhody.
- (P2) Obranca nemá prvé slovo ani spôsob, ako ochrániť hranu na svojej strane pred podstrčenou kartou: Sabotér ako útočník vyloží prvú kartu do môjho kraja (Dvojčatá = 2 telá) a zoberie hranu aj akcie Furt kariet (Kočovník!). Reakcia „viac tiel v kraji“ nie je dosiahnuteľná pri limite 3, ak súper vykladá prvý.
- (P2) Strach/zajatie/väzni sú príliš drahé pre agresora v strednej partii: 6 b Nakladačky na 1 červenú, 5 b na zajatie; po 5 bitkách som mal 1 červeného, 1 väzňa. „Štýl“ sa v skutočnosti hrá o tuhé a špaky z kariet v línii (11 kariet = 11 špakov).
- (P2) Agresor nemá ako využiť NA EX súpera (jeho trik s Dlh/Pečeň ×2 ma stál 7 Cirhóz = −21 špakov na konci, priznať sa ich oplatí len v už vyhratej/prehratej bitke).

- (P3) **Výhra strachom sa kontroluje pred Nakladačkou (4c < 4e)**: v K5 mi Nakladačka 9 dala 4. červeného (Hrobár) v bitke 10:1 a hra pokračovala; väzni sa pritom kontrolujú až po rozdelení. Agresor, ktorý „skončí hru skôr“, o jedno kolo zaostáva.
- (P3) **Finále prekonvertuje všetko tuhé na špaky 1 : 1 a útočník vykladá prvý** – vedúci (40 : 28) prehral 23 : 50 jedným kolom (≈ +27 pre súperku). Agresor, ktorý míňa cigarety v K1–K5, nemá nič na finále (draft bez cigarety = prázdna fáza), kým kolektor (pasuje, 14 cigariet, 10 kariet) vloží 3–4 telá + podstrčenie.
- (P3) Prázdne fázy: finále draft (0 cigariet), K3 Pitka 3 (NA EX bez plného poldeci a bez možnosti dolievať).

## Partie
- 2026-11-06 · 20261106-010635-1 · vs Ekonóm Ďuro · VÝHRA 59:38 špaky po finále (bitky K1,K2,K3,K5 moje, K4 a finále jeho; 4 červení po K5, výhra strachom sa nestihla) · skúšané: E1 (NA EX na obrannú kartu), E2 (červená → zajatie, zablokované N1), podstrčenie Petelíc, Opatrovateľka × Pamätník
- 2026-11-06 · 20261106-015313-2 · vs Sabotér Zdeno · VÝHRA 69:4 špaky po finále (bitky K1,K3,K4,K5,finále moje, K2 jeho 0:9; 1 červený + väzeň Farár; výhra strachom/väzňami sa nestihla) · skúšané: E1 zajatie (prešlo), E4 pas+NA EX v prehratej bitke, E5 NA EX na vlastnú neaktívnu Petelicu, E6 Valaška do Dedičstva, Záverečná na prevahu, Poľovník na jeho stranu
- 2026-11-06 · 20261106-024710-2 · vs Klebetná Mara · PREHRA 23:50 špaky po finále (pred finále 40:28; moje bitky K1,K2,K5, jej K3,K4,finále; 4 červení + väzeň Starosta, výhra strachom sa nestihla) · skúšané: zajatie s jej vysokým markerom (K5), Vízia na Cirhózu (K1), NA EX na vlastné (K1,K2), Kar, reťaz Pecka, Vymáhač+Sypač; rozbor v rozbor-stylu.md
