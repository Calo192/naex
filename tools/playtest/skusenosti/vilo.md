# Skúsenosti — Paragrafista Vilo

Štýl a zameranie postavy sú v `../hraci.json` (kľúč `vilo`). Formát
a kolobeh: `README.md`. Zapisuje len spisovateľ; playtester navrhuje
vo feedback.md.

## Skúsenosti

### vilo-1 · Keď bitku môže rozhodnúť remíza v tuhom, nevyrábam si priznaný Dlh (NA EX na vlastnú kartu s neaktívnym Hazardom, Poštárka, Dievčina) a Dlhy oboch si pred bitkou spočítam, lebo remízu v tuhom aj v Absťákoch prehráva, kto má viac priznaných Dlhov (§9.4) — jediný Dlh zmení výhru na prehru.
- stav: overená
- pravidlá: v11
- potvrdenia: 3
- vyvrátenia: 0
- dátum: 2026-11-09
- partie: 20261027-131033-3, 20261031-004030-2, 20261109-115955-2
- prečo: PRAVIDLA §9.4 (remíza: Absťáky, potom Dlhy), §15 Jednota. 131033-3 K1: tuhé 1 : 1, Dlhy 1 : 1 → sekera (log „Sekera: remíza v tuhom, v Absťákoch aj v Dlhoch“); bez Vilovho Dlhu z Jednoty by rozhodol 0 : 1 v jeho prospech. 004030-2 K1: remíza 4 : 4 by prešla na Dlhy (0 : 4 pre Evu), Vilo ju Pohoršením k sebe na Bitkára zmenil na 5 : 4. 20261109-115955-2 K1: remíza 8 : 8, log „remíza v tuhom aj v Absťákoch, menej priznaných Dlhov“ — rozhodol jediný Hazard Manželky (Dlhy 2 : 0); Vilo v partii 3 K5 Dlhy oboch (9 : 5) spočítal, ale remíza nenastala.
- oprava: 2026-10-30 20261030-115654-1: pôvodné znenie stálo na Kšefte Jednoty (1 Dlh → 2 cigarety), ktorý §15 v7 nemá (Jednota: kto má viac Dlhov, nesmie fajčiť ani dolievať) — Vilo to v partii overil a skúsenosť nepoužil; jadro (Dlh rozhoduje remízu) platí: 20261030-115654-2 K1 Hela prehrala 7 : 7 na Dlhy 1 : 0 po vlastnom Dlhovom NA EX (−8 špakov); prepísané bez Jednoty.

### vilo-2 · Keď mám priznané Dlhy, počítam s Exekútorom v každej bitke (polovica Dlhov nahor a rovnako špakov, aj pri jedinom Dlhu; Advokát špaky ušetrí, Záhradkár exekúciu obíde), preto Dlhy nenarábam (NA EX zdvojujúci moje neaktívne Dlhy, Silná vedľa Dlhu), držím Záhradkára a pri tesnej remíze si Dlhy spočítam, lebo menej Dlhov vyhráva.
- stav: overená
- pravidlá: v11
- potvrdenia: 4
- vyvrátenia: 0
- dátum: 2026-11-09
- partie: 20261028-090549-1, 20261030-115654-1, 20261031-004030-2, 20261109-115955-3
- prečo: PRAVIDLA §11 v8 (Exekútor bez prahu, pred poškodením), §9.4. P1 K2 Exekútor spálil Vilov jediný Dlh a 1 špak pred poškodením a Ferove 2 Povery nič neurobili; finále Ferov Exekútor sily 2 (Hrobár) zhorel Vilovi 1 Dlh a 1 špak; Vilo sa kvôli tomu vyhýbal Silnej, Snúbenici a Kulturistovi. 115654-1 K1: Exekútor spálil presne ceil(2/2) + 1 (Ferova Povera na Hrobára) = 2 Dlhy a 2 špaky hneď v prvom kole; Vilo potom Dlhy celé kolo odmietal a Ferov trik s Poradkyňou (4 zadĺženia) zrazil odpoveďou Vdovou na 1. 004030-2 K2 Exekútor Vilovi zjedol 6 špakov (12 Dlhov po Evinom NA EX), K3 3 Dlhy + 1 špak (Advokát ušetril 2); K5 Eva s Dlhmi si prisadla Robotu. 20261109-115955-3: Exekútor Vilovi s Advokátom 2–3 zobral 1–3 špaky za kolo (log „Exekútor: hráčovi 2 zhorí 2 priznané Dlhy a 0 špakov (Advokát ušetril 2 špaky)“).
- oprava: 2026-10-28 20261028-090549-1: pôvodné znenie (prah Exekútora 7 − priazeň, Poštárka tesne pod prahom) odporovalo §11 v8 — prah zrušený (Michal 2026-10-28), Exekútor príde ku každému s priznaným Dlhom; prepísané.
- oprava: 2026-11-09 20261109-115955-3: vypustená „súperova priazeň Exekútora“ (zanikla, dnes je to Advokát, §10, §11) a veta o Poverách proti jedinému Dlhu (Povery nepôsobia proti Dlhom od v10, §9.1).

### vilo-5 · Keď má súper v línii Bzdochu, nedávam NA EX na jeho kartu (ani zadarmo s Alkoholikom), lebo hrá Pitku až po mne, vidí môj cieľ a zrážkou na vlastnej karte z nej spraví Výtržníka — všetky jej akcie sú Rany pre neho.
- stav: neoverená
- pravidlá: v9
- potvrdenia: 2
- vyvrátenia: 0
- dátum: 2026-10-31
- partie: 20261030-115654-1, 20261031-004030-3
- prečo: PRAVIDLA §7 Bzdocha, Výtržník. 115654-1 K5 P2: Vilov NA EX na Ferovho Záhradkára (Poldeci ×2 + Pečeň ×2 = Cirhóza/Pitku) → Fero s Bzdochou videl cieľ a dal NA EX na tú istú kartu → „Výtržník, všetky jej akcie sú Rany pre hráča 1“ = 6 Rán, 5 : 3 → 5 : 10 (−13 špakov). 004030-3 K2: Janov NA EX na Pijana proti Hele s Bzdochou → zrážka, Výtržník, 5 : 15 (z 7 : 10), −20 špakov podľa Jana.

### vilo-7 · Keď dávam NA EX (aj zadarmo s Alkoholikom), najprv skontrolujem, či nemám v línii Šoféra (bez NA EX dá Pecku navyše, s ním nič) a či pečeň NA EX 1 + zdvojené Poldeci/Pečeň cieľa nedosiahne prah 3, lebo Cirhóza z vlastného NA EX stojí −3 alebo +1 tuhé súperovi v každej bitke.
- stav: neoverená
- pravidlá: v9
- potvrdenia: 2
- vyvrátenia: 0
- dátum: 2026-10-31
- partie: 20261030-115654-1, 20261031-004030-2
- prečo: PRAVIDLA §7 (pečeň NA EX pri odkrytí), §8 prah 3, §16 Šofér. 115654-1 K5: Vilov NA EX zrušil Šoférov bonus +2 (a Fero zrážkou získal 6 Rán); K3 NA EX na vlastnú Vychovávateľku: pečeň 1 + Poldeci ×2 = 3 → log „Hráč 2 dosahuje prah pečene (3) — Cirhóza“, zahodená až Víziou. 004030-2 K5: Vypiť 1 + NA EX 1 + Živnostník ✓ 1 = prah pečene 3 → Cirhóza (rátané, nie z vlastného NA EX náhľadu).

### vilo-9 · Keď má súper silnú kartu s Odporom na hrane (Recidivista, Vdova) alebo mám kartu s Odporom, ktorú môžem priložiť, podstrčím ju na ten istý index (Odpor + Odpor = Vzbura: spojené akcie oboch kariet sa vypnú, nespojené zapnú) a kladiem ju až v poslednom Zhromaždení pred Pitkou, lebo súper Vzburu zhasne priložením karty k jej vonkajšej hrane.
- stav: overená
- pravidlá: v11
- potvrdenia: 2
- vyvrátenia: 0
- dátum: 2026-11-09
- partie: 20261109-115955-2, 20261109-115955-3
- prečo: §6 Vzbura (Odpor + Odpor, Posilnenie + Odpor), §12 Vidly. 20261109-115955-3 K5: Fero priložil Policajtku k Vilovmu Recidivistovi — jeho Rana + Petelica (5 tuhých) klesli na 1, Ferova Petelica z „Nepriateľ: Kriminál“ ostala; K2 to isté Vilo proti Ferovi (Recidivista k Dvojčatám, +4 a imunita voči NA EX), o ťah neskôr ju Ferova Svokra zhasla. 20261109-115955-2: Helin Krokodíl pri Evinom Hasičovi (Vzbura, Pecka ×2) a Hrable (Posilnenie → Odpor, Odpor → Posilnenie) pod Hasiča a pod Manželku dvakrát prevrátili bitku a hádku (9 : 5, 6 : 7 → 6 : 3). Navrhli Vilo a Fero nezávisle.
