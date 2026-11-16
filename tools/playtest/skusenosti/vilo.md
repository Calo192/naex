# Skúsenosti — Paragrafista Vilo

Štýl a zameranie postavy sú v `../hraci.json` (kľúč `vilo`). Formát
a kolobeh: `README.md`. Zapisuje len spisovateľ; playtester navrhuje
vo feedback.md.

## Skúsenosti

### vilo-1 · Keď bitku môže rozhodnúť remíza v tuhom, nevyrábam si priznaný Dlh (NA EX na vlastnú kartu s neaktívnym Hazardom, Poštárka, Dievčina) a Dlhy oboch si pred bitkou spočítam, lebo remízu v tuhom aj v Absťákoch prehráva, kto má viac priznaných Dlhov (§9.4) — jediný Dlh zmení výhru na prehru.
- stav: overená
- pravidlá: v12
- potvrdenia: 4
- vyvrátenia: 0
- dátum: 2026-11-11
- partie: 20261027-131033-3, 20261031-004030-2, 20261109-115955-2, 20261111-221937-2
- prečo: PRAVIDLA §9.4 (remíza: Absťáky, potom Dlhy), §15 Jednota. 131033-3 K1: tuhé 1 : 1, Dlhy 1 : 1 → sekera (log „Sekera: remíza v tuhom, v Absťákoch aj v Dlhoch“); bez Vilovho Dlhu z Jednoty by rozhodol 0 : 1 v jeho prospech. 004030-2 K1: remíza 4 : 4 by prešla na Dlhy (0 : 4 pre Evu), Vilo ju Pohoršením k sebe na Bitkára zmenil na 5 : 4. 20261109-115955-2 K1: remíza 8 : 8, log „remíza v tuhom aj v Absťákoch, menej priznaných Dlhov“ — rozhodol jediný Hazard Manželky (Dlhy 2 : 0); Vilo v partii 3 K5 Dlhy oboch (9 : 5) spočítal, ale remíza nenastala. 20261111-221937-2 K4: remíza 5 : 5 rozhodli Absťáky 0 : 1 (log „remíza v tuhom, menej Absťákov“), Dlhy mal Vilo spočítané pred NA EX.
- oprava: 2026-10-30 20261030-115654-1: pôvodné znenie stálo na Kšefte Jednoty (1 Dlh → 2 cigarety), ktorý §15 v7 nemá (Jednota: kto má viac Dlhov, nesmie fajčiť ani dolievať) — Vilo to v partii overil a skúsenosť nepoužil; jadro (Dlh rozhoduje remízu) platí: 20261030-115654-2 K1 Hela prehrala 7 : 7 na Dlhy 1 : 0 po vlastnom Dlhovom NA EX (−8 špakov); prepísané bez Jednoty.

### vilo-2 · Keď mám priznané Dlhy, počítam s Exekútorom v každej bitke (polovica Dlhov nahor a rovnako špakov, aj pri jedinom Dlhu; Advokát špaky ušetrí, Záhradkár exekúciu obíde), preto Dlhy nenarábam (NA EX zdvojujúci moje neaktívne Dlhy, Silná vedľa Dlhu), držím Záhradkára a pri tesnej remíze si Dlhy spočítam, lebo menej Dlhov vyhráva.
- stav: overená
- pravidlá: v12
- potvrdenia: 6
- vyvrátenia: 0
- dátum: 2026-11-14
- partie: 20261028-090549-1, 20261030-115654-1, 20261031-004030-2, 20261109-115955-3, 20261111-221937-2, 20261114-003916-1
- prečo: PRAVIDLA §11 v8 (Exekútor bez prahu, pred poškodením), §9.4. P1 K2 Exekútor spálil Vilov jediný Dlh a 1 špak pred poškodením a Ferove 2 Povery nič neurobili; finále Ferov Exekútor sily 2 (Hrobár) zhorel Vilovi 1 Dlh a 1 špak; Vilo sa kvôli tomu vyhýbal Silnej, Snúbenici a Kulturistovi. 115654-1 K1: Exekútor spálil presne ceil(2/2) + 1 (Ferova Povera na Hrobára) = 2 Dlhy a 2 špaky hneď v prvom kole; Vilo potom Dlhy celé kolo odmietal a Ferov trik s Poradkyňou (4 zadĺženia) zrazil odpoveďou Vdovou na 1. 004030-2 K2 Exekútor Vilovi zjedol 6 špakov (12 Dlhov po Evinom NA EX), K3 3 Dlhy + 1 špak (Advokát ušetril 2); K5 Eva s Dlhmi si prisadla Robotu. 20261109-115955-3: Exekútor Vilovi s Advokátom 2–3 zobral 1–3 špaky za kolo (log „Exekútor: hráčovi 2 zhorí 2 priznané Dlhy a 0 špakov (Advokát ušetril 2 špaky)“). 20261111-221937-2: Exekútor stál Vila −3, −4, −2, −2, −1; v K3 vedome prijal Dlh ×4 za Nakladačku 9 (zajatie Krčmárky). 20261114-003916-1 finále: 12 Dlhov, Exekútor zhorel 5 priznaných Dlhov a 5 špakov (log), Robota 3 spálila.
- oprava: 2026-10-28 20261028-090549-1: pôvodné znenie (prah Exekútora 7 − priazeň, Poštárka tesne pod prahom) odporovalo §11 v8 — prah zrušený (Michal 2026-10-28), Exekútor príde ku každému s priznaným Dlhom; prepísané.
- oprava: 2026-11-09 20261109-115955-3: vypustená „súperova priazeň Exekútora“ (zanikla, dnes je to Advokát, §10, §11) a veta o Poverách proti jedinému Dlhu (Povery nepôsobia proti Dlhom od v10, §9.1).

### vilo-5 · Keď má súper v línii Bzdochu, nedávam NA EX na jeho kartu (ani zadarmo s Alkoholikom), lebo hrá Pitku až po mne, vidí môj cieľ a zrážkou na vlastnej karte z nej spraví Výtržníka — všetky jej akcie sú Rany pre neho.
- stav: overená
- pravidlá: v12
- potvrdenia: 3
- vyvrátenia: 0
- dátum: 2026-11-11
- partie: 20261030-115654-1, 20261031-004030-3, 20261111-221937-2
- prečo: PRAVIDLA §7 Bzdocha, Výtržník. 115654-1 K5 P2: Vilov NA EX na Ferovho Záhradkára (Poldeci ×2 + Pečeň ×2 = Cirhóza/Pitku) → Fero s Bzdochou videl cieľ a dal NA EX na tú istú kartu → „Výtržník, všetky jej akcie sú Rany pre hráča 1“ = 6 Rán, 5 : 3 → 5 : 10 (−13 špakov). 004030-3 K2: Janov NA EX na Pijana proti Hele s Bzdochou → zrážka, Výtržník, 5 : 15 (z 7 : 10), −20 špakov podľa Jana. 20261111-221937-2 (obrátene): K4 mal Bzdochu Vilo, Fero dal NA EX na vlastného Veterána a Vilo ho zrážkou zmenil na Výtržníka (12 : 5 → 7 : 5).

### vilo-7 · Keď dávam NA EX (aj zadarmo s Alkoholikom), najprv skontrolujem, či nemám v línii Šoféra (bez NA EX dá Pecku navyše, s ním nič) a či pečeň NA EX 1 + zdvojené Poldeci/Pečeň cieľa nedosiahne prah 3, lebo Cirhóza z vlastného NA EX stojí −3 alebo +1 tuhé súperovi v každej bitke.
- stav: overená
- pravidlá: v12
- potvrdenia: 4
- vyvrátenia: 0
- dátum: 2026-11-14
- partie: 20261030-115654-1, 20261031-004030-2, 20261111-221937-2, 20261114-003916-1
- prečo: PRAVIDLA §7 (pečeň NA EX pri odkrytí), §8 prah 3, §16 Šofér. 115654-1 K5: Vilov NA EX zrušil Šoférov bonus +2 (a Fero zrážkou získal 6 Rán); K3 NA EX na vlastnú Vychovávateľku: pečeň 1 + Poldeci ×2 = 3 → log „Hráč 2 dosahuje prah pečene (3) — Cirhóza“, zahodená až Víziou. 004030-2 K5: Vypiť 1 + NA EX 1 + Živnostník ✓ 1 = prah pečene 3 → Cirhóza (rátané, nie z vlastného NA EX náhľadu). 20261111-221937-2: K2 Pitka 3 Vilo pred NA EX na Miňištranta spároval jeho Pečeň Psom (NA EX ju zrušilo, Cirhóza nebola); K5 NA EX nedal pri pečeni 2 + 1 = 3. Šofér a „Alkoholik“ sa v partii nevyskytli. 20261114-003916-1: K2 Pijan (pečeň 3) a K5 NA EX +1 pečeň → Cirhóza; 3 Cirhózy z nespočítaného súčtu Vypiť + hrana + karta.

### vilo-9 · Keď má súper silnú kartu s Odporom na hrane (Recidivista, Vdova) alebo mám kartu s Odporom, ktorú môžem priložiť, podstrčím ju na ten istý index (Odpor + Odpor = Vzbura: spojené akcie oboch kariet sa vypnú, nespojené zapnú) a kladiem ju až v poslednom Zhromaždení pred Pitkou, lebo súper Vzburu zhasne priložením karty k jej vonkajšej hrane.
- stav: overená
- pravidlá: v12
- potvrdenia: 4
- vyvrátenia: 0
- dátum: 2026-11-14
- partie: 20261109-115955-2, 20261109-115955-3, 20261111-221937-2, 20261114-003916-1
- prečo: §6 Vzbura (Odpor + Odpor, Posilnenie + Odpor), §12 Vidly. 20261109-115955-3 K5: Fero priložil Policajtku k Vilovmu Recidivistovi — jeho Rana + Petelica (5 tuhých) klesli na 1, Ferova Petelica z „Nepriateľ: Kriminál“ ostala; K2 to isté Vilo proti Ferovi (Recidivista k Dvojčatám, +4 a imunita voči NA EX), o ťah neskôr ju Ferova Svokra zhasla. 20261109-115955-2: Helin Krokodíl pri Evinom Hasičovi (Vzbura, Pecka ×2) a Hrable (Posilnenie → Odpor, Odpor → Posilnenie) pod Hasiča a pod Manželku dvakrát prevrátili bitku a hádku (9 : 5, 6 : 7 → 6 : 3). Navrhli Vilo a Fero nezávisle. 20261111-221937-2 K5: Policajtka (Odpor) podstrčená k Ferovmu Recidivistovi (Odpor) → Vzbura, Ferova Rana + Petelica zhasli (−4) a NA EX na kartu so Vzburou nešlo; Fero ju nezhasol. 20261114-003916-1 K2: Vilov Krokodíl + Vdova na Recidivistu a Kočovníka, Fero zhasol Vzburu Miňištrantom priloženým k vonkajšej hrane (Petelica −3; denník Vila).

### vilo-10 · Keď prehrávam bitku o málo a súper má Absťák (verejný počet) a ja menej, vyrobím remízu v tuhom (NA EX na vlastnú kartu s neaktívnymi Vierami či Ranami, telo navyše), lebo remízu v tuhom vyhráva menej Absťákov a až potom menej Dlhov, a náhľad bitky tiebreak neukáže.
- stav: overená
- pravidlá: v12
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-11-11
- partie: 20261111-221937-2
- prečo: §9.4 Výsledok. 20261111-221937-2 K4: pri 5 : 8 dal Vilo NA EX na vlastného Miňištranta (Viery ×2) → 5 : 5, Fero mal 1 Absťák (z K3, Chuť 2 bez nerestí), Vilo 0 → log „remíza v tuhom, menej Absťákov“, +8 špakov a Fero bez Nakladačky. Navrhol ako spoločnú; je to obranný opak vilo-1 a jano-2.

### vilo-11 · Keď súper položí Finančnú poradkyňu k lokalite, nechám si v každej Pitke plný poldeci na odpoveď a odpovedám kartou, ktorá spáruje jej vonkajšie Dlhy, lebo jej vnútorný Dlh oproti hrane lokality ostáva neaktívny, NA EX naň je vždy legálne a spárované Dlhy NA EX zruší.
- stav: overená
- pravidlá: v12
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-11-11
- partie: 20261111-221937-2
- prečo: §7 (podmienka NA EX, Odpoveď na NA EX), §16 Finančná poradkyňa. 20261111-221937-2 K2: Fero dal NA EX na vlastnú Poradkyňu (výhľad „súper Dlh +9 za kolo“), Vilo odpovedal Bzdochou na koniec pri nej → 2 Dlhy za Pitku namiesto 4, spolu +3 namiesto +9 (potvrdili Vilo aj Fero).

### vilo-12 · Keď mám v ruke Vandala a súper postaví silnú kartu k hrane lokality, Vandala zahrám až potom a tak, aby moja karta pri druhej hrane po otočení dostala jej akcie, lebo otočenie presunie obe hrany naraz a súper už kraj nestihne prestavať.
- stav: overená
- pravidlá: v12
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-11-11
- partie: 20261111-221937-2
- prečo: §16 Vandal („Nástup: Otoč lokalitu o 180°“), §6 Prevaha a akcie lokality. 20261111-221937-2 finále Herňa: log „Vandal: hráč 1 otáča lokalitu o 180° — jej hrany si vymenili kraje“; Ferov Veterán stratil Petelicu + Pecku hrany, Vilova Bzdocha (Pakt) skopírovala Petelicu, 8 : 7 → 13 : 7, bitka 20 : 12. To isté nezávisle Jano v 20261111-221937-3 (K3 Ihrisko) a Hela v 20261111-221937-1 (K1, K4).

### vilo-13 · Keď je finále na Predsedovej vile a mám cigarety, fajčím v Pitke 1 + 2 + 3 cigarety a po každej druhej zaplatenej zdvihnem reči pri staršom (hra čaká na `vila`, kým nerozhodnem), lebo vila reči zdvíha aj vo finále, bodujú po finálovej bitke a súper ich nemá ako zmariť.
- stav: overená
- pravidlá: v12
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-11-14
- partie: 20261114-003916-1
- prečo: §15 Predsedova vila (reči o stupeň za 2 vyfajčené cigarety), §14b starší bodujú po finálovej bitke. 20261114-003916-1 finále Pitka 2: 1 + 2 + 3 cigarety, vila zdvihla Starostu, Veterinára a Starostu (log), starší po bitke 24 špakov namiesto 16 (reči 12: Krčmárka 3, Starosta 5, Veterinár 3, Vychovávateľka 1), finále 23 : 21. Výhrada: §9.1 a §14b tvrdia „vo finále sa reči nedvíhajú“ (text pravidiel si odporuje, autor nerozhodol); fajčenie stojí aj nerest a karty z balíčka (Vilo dobral Cirhózu a Krokodíla).

### vilo-14 · Keď v poslednom Zhromaždení vidím, že súper nemá cigarety a najviac 1 plný poldeci, položím dve karty jedným ťahom Vypiť na kraj, kde potrebujem prevahu (rovnosť berie prvá karta pri lokalite), lebo medzi kartami nemôže odpovedať a po ťahu nemá čím dorovnať.
- stav: overená
- pravidlá: v12
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-11-14
- partie: 20261114-003916-1
- prečo: §13 Vypiť (n kariet = n plných poldeci a n − 1 cigariet), §6 Prevaha. 20261114-003916-1 finále Zh3: Fero 1 plný poldeci a 0 cigariet, Vilo 2 poldeci a 1 cigareta, Vypiť + Snúbenica + Krokodíl vľavo, odhad 16 : 18 → 23 : 16 (denník Vila); bitka 23 : 21 (Fero ešte NA EX na Veterána). Potvrdil Fero („nemal som poldeci ani cigarety pre posledné slovo“).
