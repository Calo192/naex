# Revízia sady — fáza 1: plán

Vymyselník · 27. 10. 2026 · pre Michala cez session Brainstorming · len plán, karty ani pravidlá sa nemenia.

> Michal: „Chcem aby hráč mal pocit, že sa rozhoduje medzi zlou a horšou možnosťou (veľa hazardu a poškodenia pečene), ale chcem aby bolo možné vytvoriť kombinácie, kedy si hráč povie WAU. Priemerné poškodenie treba zvýšiť, čiže viac Peciek a Petelíc… connectory… silný efekt a málo akcií… slabý efekt a veľa akcií… málo a silných akcií… všetko v rámci témy a satiry.“

Podklady: sada v21 (`packages/core/data/cards.json`, 63 kariet) + 13 schválených noviniek (Degustátorka, Klebetnica, Dohadzovačka, Vandal, Strýko, Opatrovateľka v2, Smetiarka, Vidly, Lievik, Krokodíl, Kapybara, Kôň, Kohút), NA EX trojica, Autobusár A, Hasič s voľbou; `docs/PRAVIDLA.md` v6; `docs/napady/analyza-sady.html`; `docs/napady/spaky.html`. **Nič som nesimuloval.** Čísla sú výpočet zo sady (skript nad cards.json, náhodné varianty a natočenia), nie partie. Strojová tabuľka: `plan.json` vedľa tohto súboru.

## V skratke

- **Útok ×1,5.** Petelica 4 → 14 kópií, Pecka 14 → 24. Aktívne tuhé na spoj (model) 0,39 → 0,61. Odhad priemerného tuhého v bitke **4,2 → asi 6** na hráča.
- **Pečeň +70 %.** Akcia Poškodenie pečene 34 → 58 kópií, aktívna pečeň na spoj ×1,39. Dlh 48 → 60, ale každý Dlh navyše dostane zuby (Obecný úrad, Jednota, Podvodník, otázka prahu Exekútora).
- **Štyri archetypy s kvótou:** spojka 10, robotník 15, úderník 10, eso 21 (z toho 8 Nástrojov). Dnes je spojka 1 (Záhradkár) a úderníci 4.
- **Čísla tabuľky:** 89 riadkov — 43 nechať, 26 prerobiť (16 kariet + 10 lokalít), 13 noviniek (8 kariet, 2 rezerva, 3 pinnacle lokality), 4 štartové po ULTRA, 3 kliatby mimo revízie. Šesť mŕtvych efektov má riešenie.
- **Lokality podľa úrovní (časť 7):** 5 × úroveň 1 (spodok), 5 × úroveň 2, 5 × úroveň 3 (sídla šľachty) a 3 nové pinnacle s korupciou pre finále. Stredná hra má rozpis 1 · 2 · 2 · 3 · 3 · P, obranca vyberá zo všetkých lokalít úrovne a pravidlo „prvá karta = stred finále“ zaniká.
- **Zásada ceny:** úderník platí za útok aspoň polovicou v Pečeni alebo Dlhu, spojka nesie aspoň jednu zlú akciu, silný efekt stojí menu (Kšeft) alebo nerest. WAU vzniká až z 3 kariet a viacerých ťahov (6 kôb v časti 5, 8–16 tuhého).

## 1. Rozpočet akcií

### 1.1 Kópie v hre (spoločný balíček 2× + štart oboch hráčov)

| Akcia | Dnes | Plán | Zmena | Kde |
|---|---|---|---|---|
| **Petelica** | 4 | **14** | ×3,5 | Puška, Veterán, Recidivista (ostáva), Hromotĺk, Kulturista, Traktoristka; Hasič ostáva |
| **Pecka** | 14 | **24** | +71 % | Kočovník, Dvojčatá, Puška, Mäsiar (2), Kuchárka (2); Veterán Pecku mení na Petelicu |
| Rana | 38 | 36 | −5 % | Rany sa menia na Pecky (Puška, Kočovník, Dvojčatá) |
| **Poškodenie pečene** | 34 | **58** | +71 % | ceny úderníkov a spojok (Hromotĺk 2, Mäsiar 2, Traktoristka, spojky po 1) |
| Poldeci (aj pečeň v Pitke, §2 :101) | 24 | 30 | +25 % | Bufetárka, Oslávenec, Kuchárka |
| Dlh | 48 | 60 | +25 % | Kulturista 2, Recidivista 2, Traktoristka, Bufetárka, Kuchárka, Fin. poradkyňa |
| Povera | 32 | 40 | +25 % | spojky; má do čoho biť, keď Dlhov pribudne |
| Viera | 28 | 36 | +29 % | spojky, Liberál; obrana rastie s útokom |
| Cigareta | 48 | 56 | +17 % | výplň spojok; míňajú ju Kšefty |
| Robota | 16 | 24 | +50 % | spojky (Záhradkár, Vybavovač, Brigádnik, Živnostník) |
| Obmedzenie | 14 | 18 | +29 % | Fin. poradkyňa, Brigádnik |
| Vízia | 10 | 14 | +40 % | Vybavovač, Šúľač (analýza chcela viac) |
| Posilnenie | 8 | 10 | +25 % | Vybavovač — zdvojí aj zlú akciu |
| Odpor | 20 | 18 | −10 % | Recidivista ho stráca (Odporov pribudlo +57 %) |
| Pohoršenie | 30 | 30 | 0 | **zámerne nie** — vo v6 najsilnejšia akcia bez brzdy (analýza H3) |

Lokality (hrany, 15 + 3 pinnacle) po úrovniach z časti 7: Pecka 6 → 13, Petelica 2 → 6, Dlh 3 → 7, Pečeň 1 → 4, Posilnenie 0 → 3, Rana 6 → 6. Starší sa nemenia.

Akcií na kartu 3,68 → 3,90. Druhy v balíčku 46 → 56 (bez rezervy 54), kariet v hre 100 → 120. Konkrétnu kartu uvidíš v šenku zriedkavejšie (2/92 → 2/112), preto rátam s archetypmi, nie s jednotlivými kartami.

Rozloženie počtu akcií na druh (balíček): dnes 2:12 · 3:7 · 4:15 · 5:10 · 6:2 → plán 2:11 · 3:12 · 4:18 · 5:4 · **6:10 · 7:1**. Stred sa vyprázdni a vzniknú dva póly: tenké karty (eso, úderník) a hrubé (spojka).

### 1.2 Krivka poškodenia (výpočet, nie simulácia)

- Model: náhodná karta, náhodný variant, náhodné natočenie suseda; akcia je aktívna, keď sused má na tom istom indexe akciu (§6 :247–256). Obsadenosť slotu 0–3: dnes 35/62/60/28 %, plán 34/68/66/28 %.
- **Aktívne tuhé na spoj (obe karty): 0,393 → 0,605 (×1,54).** Vytlačené tuhé na kartu rastie len o 35 % (0,78 → 1,05). Zvyšok robí poloha: nový útok sedí v strede (sloty 1–2, partner 62–68 %), nie na okraji (28–35 %).
- Ukotvenie: posledné meranie priemerného tuhého v bitke je **4,2** na hráča (boti, `docs/napady/priazne-v5.html`). Karty robia asi 90 % tuhého, hrany lokalít trochu pridajú (podľa úrovne, časť 7) a Viera navyše uberie asi 0,2. **Odhad: asi 6 (5,5–6,5).**
- Cieľová krivka: medián 5–6, bežná bitka 3–9 tuhého. Chvost **WAU 10–16 tuhého** má byť vzácny (cieľ okolo 1 bitky z 8–10), lebo potrebuje 3 konkrétne karty a správne varianty. Pečeň na spoj ×1,39: Cirhóz za partiu dnes 5,2 (boti v6), plán asi 7. Nealko, Niekoho stryná, Veterinár a Vízia tým ožijú.
- Posilnenie a ×2 efekty model nezarátava, takže skutočný útok bude vyšší, hlavne s cielenými spojkami.

**Riziká čísiel.** (a) Vyššie tuhé zväčší aj prebytok, ten posúva markery, a teda zrýchli strach a vydesenie (strach dáva 75–80 % špakov). Brzdy: Puška −2, Viera +29 %, Vidly. Merať. (b) Absťák (−1 tuhé) pri tuhom 6 váži menej ako pri 4. (c) Pri pečeni +70 % nesmie byť Cirhóza istota, inak −5 špakov rozhodne partiu namiesto bitky.

## 2. Archetypy a kvóty

| Archetyp | Pravidlo tvorby | Kvóta (druhy) | Dnes | Plán |
|---|---|---|---|---|
| **S · Spojka** | 6–7 slabých akcií, aspoň 3 na každej strane, najviac 1 blokovaný slot na strane. Aspoň 1 zlá akcia (Dlh, Pečeň, Poldeci). Tuhé ≤ 1, efekt slabý alebo s cenou. Akcia suseda na nej nájde partnera v 75–100 % (priemer je 46 %). | 10 (18 %) | 1 | 10 |
| **R · Robotník** (slabý efekt, veľa akcií) | 4–5 akcií, 1–2 užitočné (Rana, Pecka, Pohoršenie, Posilnenie), efekt malý alebo podmienený. | 15 (27 %) | ~20 | 15 |
| **U · Úderník** (málo silných akcií) | 2–4 akcie: Petelica alebo 2 Pecky v strede (sloty 1–2), k tomu cena aspoň polovica tuhého (Pečeň, Dlh). Bez efektu: tvorca prázdny efekt prijme (`packages/tvorba/src/texty.ts:59`) a kód netreba. | 10 (18 %) | 4 | 10 |
| **E · Eso** (silný efekt, málo akcií) | 1–3 slabé akcie (Nástroj 2), silný efekt: Kšeft, Furt, Nástup alebo Dedičstvo. | 20–21 (36 %) | ~21 | 21 (8 Nástrojov, 5 Zvierat) |

**Prečo takto.** Šenok má 8 kariet (§5). Pri pláne v ňom bude aspoň jedna spojka so šancou 79 %, úderník 79 %, robotník 92 % a eso 98 %. WAU potrebuje spojku, úderníka a zosilňovač (eso), teda cieľ na 2–3 drafty, nie dar z jedného šenku. Robotník je chlieb, ruka z neho sa dá zahrať vždy. Esá sú početné, lebo Nástroje a Kšefty sa kupujú do Dedičstva a na Pitku, nie do línie. Kšeft je v balíčku presne na 5 kartách (Smetiarka, Strýko, Kapybara, Oslávenec, Šúľač), teda na strope, ktorý navrhol Vymyselník. Starší a lokality (Starosta, Poštárka, Zberný dvor, Jednota) sa do neho nerátajú.

## 3. Tabuľka kariet

Akcie: ľavá / pravá strana; tučne plán, ak sa mení. „Pečeň“ = Poškodenie pečene. Typ: S spojka, R robotník, U úderník, E eso, L lokalita, St starší, K kliatba, Š štart.

**Mŕtve efekty z analýzy, riešenie:**
- **Záhradkár:** Exekúcia → *Výhra: otoč vypitý poldeci na plný*, ako spojka.
- **Obecný úrad:** prah Exekútora −4 → *za každé 2 priznané Dlhy −1 tuhé*. Robota páli 2 Dlhy ostáva, teda Dlh bolí a Robota lieči.
- **Exekútorova priazeň:** sama sa neoživí. V7 navrhujem prah Exekútora 10 → 7 (otázka 1), k tomu Dlhov pribudne +25 %.
- **Kar:** *doliatie zadarmo, ale každé +1 Pečeň*.
- **Jednota:** *Kšeft lokality: za 1 Dlh 2 cigarety (na sekeru)*.
- **Prestávka:** spúšťač bez karty, zmazať z ALL_TRIGGERS (malé zadanie pre vývoj, v7).

### Nástroje

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Noviny | Pohorš / Povera; Dedičstvo: +1 špak, keď sa ťa bojí viac starších. | E | nechať | Bez zmeny (efekt z v6). |
| Krabička cigariet | Cig / Cig; Dedičstvo: +1 cigareta v každej Pitke. | E | nechať | Bez zmeny — palivo pre Kšefty. |
| Vínko | Poldeci×2 / Pečeň×4; Dedičstvo: plný poldeci navyše, bez doliatia. | E | nechať | Bez zmeny; Pečeň×4 v línii je zbraň — podstrčené k súperovmu Občanovi ho opije (§12). |
| Pasca | Obmedz / Odpor; Dedičstvo: každé súperovo Zviera −1 tuhé. | E | nechať | Bez zmeny, ožije so 6 zvieratami. |
| Puška | Rana / Pecka → **Pecka / Petelica**; Dedičstvo: prebytok proti tebe −2. | U | prerobiť | Rana → Pecka, Pecka → Petelica (brokovnica po dedovi); efekt ostáva. |
| Svätý text | Viera / Viera; Dedičstvo: Viera +1. | E | nechať | Bez zmeny; pri vyššom tuhom má Viera väčšiu cenu. |
| Nealko | Pohorš / Pohorš; Dedičstvo: prah Cirhózy +2. | E | nechať | Bez zmeny — pri +70 % akcií Pečeň je to hlavná poistka (D6 sa vyrieši sama). |
| Výherný automat | Robota / Dlh×4; Dedičstvo: Výhra 2 cigarety, Prehra 1 Dlh. | E | prerobiť | Väčší hazard: Výhra 3 cigarety, Prehra 2 Dlhy; akcie (Dlh×4) ostávajú. |
| Vidly | Pecka / Pohorš; Dedičstvo: +1 tuhé, kým máš menej špakov (schválené). | U | nechať | Bez zmeny. |
| Lievik | Poldeci / Pečeň×2; Dedičstvo: NA EX aj na Zviera (schválené). | E | nechať | Bez zmeny; Pečeň×2 v línii = podstrčiteľný hazard. |

### Zvieratá

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Čierna mačka | Pohorš, Povera / Povera; Furt: Povery bijú aj bez súperových Dlhov. | E | nechať | Bez zmeny. |
| Pes | Rana / Rana×2; Furt: +1 tuhé za pár na spoji so súperovou kartou. | U | nechať | Bez zmeny. |
| Krokodíl | Odpor / Pecka; Furt: zožerie súperovu kartu vyloženú vedľa (schválené). | E | nechať | Bez zmeny. |
| Kapybara | Viera / Cig; Kšeft: za cigaretu zožerie súperovi špak (schválené). | E | nechať, zdražiť | Cena 2 cigarety (odporúčanie Admina, H1); inak nič. |
| Kôň | Posil / Rana; Furt: Nástroj s ním tvorí spoj (schválené). | E | nechať | Bez zmeny; strop komba so Zámočníkom pozri WAU 3. |
| Kohút | Pohorš / Odpor; Furt: kolo má aspoň 2 Pitky (schválené). | E | nechať | Bez zmeny — 2 Pitky = 2× pečeň zo všetkých kariet. |

### Občania (dnešní a schválení)

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Finančná poradkyňa | Dlh×2, Povera / Cig, Dlh → **Dlh×2, Povera / Cig, Dlh, Obmedz**; Pitka: Dlh z jej akcií dostáva súper. | S | prerobiť | Spojka: vpravo + Obmedzenie (6 akcií); jej Dlhy zadlžia súpera, kto ju podstrčí, kŕmi Povery. |
| Veľmi smútiaca vdova | Dlh, Obmedz, Rana / Pohorš×2; Nástup: muž navrchu súperovho balíčka ide z hry, ty zahodíš 2 Dlhy. | R | nechať | Bez zmeny (tematická). |
| Veštica | Cig, Vízia / Povera×2, Viera → **Cig, Vízia, Pečeň / Povera×2, Viera**; Prehra: vymeň kartu medzi doberacími balíčkami. | S | prerobiť | Spojka: vľavo + Pečeň (bylinkový likér), 6 akcií. |
| Silná, nezávislá žena | Cig, Pohorš / Dlh×2; Furt: aktívne akcie susedných vlastných kariet ×2. | E | nechať | Bez zmeny — hlavný zosilňovač WAU kôl. |
| Policajtka | Obmedz, Rana / Robota; Pitka: kto dal viac NA EX, dostane Dlh (schválené P1). | E | nechať | Bez zmeny. |
| Hasič | Posil / Petelica, Rana; Nástup: náhodná karta z odhadzovacieho, nechaj/vráť (schválené). | U | nechať | Bez zmeny; Petelica už má. |
| Praudovravec | Odpor, Povera / Pohorš, Povera, Vízia → **Odpor, Povera, Viera / Pohorš, Povera, Vízia**; Furt: Odpor na jeho spojoch posilní (Dezinformátor, schválené). | S | prerobiť | Spojka-zosilňovač: vľavo + Viera (6 akcií), efekt ostáva. |
| Zámočník | Cig, Poldeci / Pecka, Robota; Furt: akcie Nástrojov v okolí ×2. | R | nechať | Bez zmeny; s prerobenou Puškou dá WAU 3. |
| Niekoho stryná | Poldeci, Viera / Povera, Viera, Vízia → **Poldeci, Viera, Pečeň / Povera, Viera, Vízia**; Nástup: zahoď 1 Cirhózu alebo Dlh. | S | prerobiť | Spojka: vľavo odblokovať slot 2 a + Pečeň („na zdravie“), 6 akcií. |
| Veterán | Poldeci, Pečeň / Odpor, Pecka → **Poldeci, Pečeň / Odpor, Petelica**; Furt: NA EX zdvojí jeho aktívne akcie. | R | prerobiť | Pecka → Petelica; s NA EX 6 tuhé, ale zdvojí aj jeho Pečeň a Poldeci. |
| Recidivista | Dlh, Odpor / Petelica, Rana → **Dlh×2 / Petelica, Rana**; Bitka: Rana navyše za každého Zahraničného súpera. | U | prerobiť | Úderník: vľavo Odpor → Dlh (súdne trovy), Petelica s cenou 2 Dlhov; Odporov je priveľa (+57 %). |
| Liberál | Pohorš / Cig → **Pohorš, Viera / Cig, Povera**; Furt: ×2 pri rovnosti žien a chlapov (bez zákazu NA EX). | R | prerobiť | Akcie 2 → 4 (Pohoršenie, Viera / Cig, Povera), aby ×2 malo čo zdvojiť. |
| Živnostník | Dlh, Odpor / Cig×2, Pečeň → **Dlh, Odpor, Robota / Cig×2, Pečeň**; Výhra: zahoď súperovo Dedičstvo. | S | prerobiť | Spojka: vľavo + Robota (6 akcií); Odpor na spojke je pasca pre suseda, efekt ostáva. |
| Kočovník | Dlh, Pečeň / Cig, Pečeň, Rana → **Dlh, Pečeň / Cig, Pečeň, Pecka**; Furt: jeho akcie berie hráč s prevahou v kraji. | R | prerobiť | Rana → Pecka: kto ho vyhrá, dostane Pecku aj 2 Pečene a Dlh. |
| Svokra | Poldeci / Obmedz, Pecka, Viera; Bitka: Rana za každú tvoju kartu so súperovým NA EX (schválené S1). | R | nechať | Bez zmeny. |
| Šarlatán | Dlh, Povera×2 / Cig, Pohorš → **Dlh, Povera×2 / Cig, Pohorš, Pečeň**; Furt: Viera v okolí platí ako Vízia (slabé, D10). | S | prerobiť | Spojka: vpravo + Pečeň (6 akcií); nový Furt: aktívna Pečeň v jeho okolí sa ráta aj ako Viera (zázračná tinktúra) — vzor ako dnes vieraAkoVizia (partia.ts:529). |
| Podvodník | Cig×2, Dlh / Obmedz, Rana; Prehra: ukradni 2 cigarety (slabé, D11). | R | prerobiť | Prehra: jeden tvoj priznaný Dlh prepíšeš na súpera — Dlh dostane zuby. |
| Záhradkár | Cig×2, Pečeň / Poldeci, Rana, Robota; Exekúcia: zahoď ho namiesto špakov (mŕtve). | S | prerobiť | Spojka (6 akcií ostáva); nový efekt Výhra: otoč vypitý poldeci na plný (pálenka z vlastnej úrody). |
| Anonymný alkoholik | Odpor, Robota / Dlh, Viera; Furt: tvoje NA EX naňho mimo limitu (Placatka, schválené). | R | nechať | Bez zmeny. |
| Presbiter | Pohorš, Povera / Rana, Viera; Bitka: sám v kraji uberie súperovi Vieru. | R | nechať | Bez zmeny. |
| Dvojčatá | Dlh, Rana / Cig, Rana → **Dlh, Pecka / Pečeň, Rana**; Furt: do prevahy za dvoch. | R | prerobiť | Rana → Pecka vľavo, Cigareta → Pečeň vpravo (bijú a pijú za dvoch). |
| Šofér | Poldeci, Rana / Cig, Pečeň; Furt: NA EX na suseda nezdvojí neaktívne (slabé, dvojsečné). | R | prerobiť | Nový efekt Bitka: ak si v tomto kole nedal NA EX, udelíš Pecku navyše (triezvy šofér; menej nerestí = riziko Absťáku). Jadro má naexVKole (engine.ts:333). |
| Snúbenica | Robota / Dlh, Viera; Nástup: vráti kartu s NA EX majiteľovi a zaujme jej miesto. | E | nechať | Bez zmeny. |
| Degustátorka | Pečeň, Poldeci / Rana, Obmedz; Nástup: súperovi otočí plný poldeci (schválené). | R | nechať | Bez zmeny. |
| Klebetnica | Povera, Vízia / Pohorš, Dlh; Nástup: pozri súperovu ruku, kartu naspodok (schválené). | R | nechať | Bez zmeny. |
| Dohadzovačka | Viera, Cig / Posil, Dlh; Nástup: vymeň dvom starším priazne (schválené). | E | nechať | Bez zmeny. |
| Vandal | Pecka, Pečeň / Odpor, Rana; Nástup: otoč lokalitu (schválené). | R | nechať | Bez zmeny — Pecka s Pečeňou je vzor ceny. |
| Strýko z Ameriky | Cig×2 / Vízia, Poldeci; Kšeft: za 2 cigarety Rana navyše (schválené). | E | nechať | Bez zmeny. |
| Opatrovateľka | Robota, Cig / Viera, Posil; Nástup: latka Absťáku −2 (schválené). | R | nechať | Bez zmeny. |
| Smetiarka | Robota, Cig / Obmedz; Kšeft: za odhodenú kartu cigareta (schválené, variant). | E | nechať | Bez zmeny. |

### Novinky

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Poľovnícky zámoček | — → **Petelica, Pecka, Posil, Dlh / Petelica, Rana, Pohorš, Pečeň**; Furt: Aktívne akcie hrán lokality sa rátajú dvakrát. | LP | nová (pinnacle) | Pinnacle 4/4 (Petelica, Pecka, Posilnenie, Dlh / Petelica, Rana, Pohoršenie, Pečeň). Korupcia: poľovačka pre papalášov z okresu, obálka pri trofeji, terénne autá so štátnymi značkami. |
| Predsedova vila | — → **Pecka×2, Cig, Obmedz / Petelica, Posil, Viera, Dlh**; Kšeft (obaja): Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole. | LP | nová (pinnacle) | Pinnacle 4/4 (Pecka×2, Cig, Obmedzenie / Petelica, Posilnenie, Viera, Dlh). Korupcia: sprivatizovaná vila bývalého predsedu JRD, traktor s krokodílom na kapote, úplatky v bonboniérach. |
| Agroareál z eurofondov | — → **Petelica, Pecka, Pečeň, Poldeci / Pecka, Rana, Robota, Dlh**; Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov, najviac 5. | LP | nová (pinnacle) | Pinnacle 4/4 (Petelica, Pecka, Pečeň, Poldeci / Pecka, Rana, Robota, Dlh). Korupcia: eurofondový agroturistický areál, ktorý nikdy nefungoval, požiarna nádrž s krokodílom, lesklá tabuľa projektu. |
| Vybavovač | — → **Cig, Povera, Robota, Posil / Viera, Vízia, Pečeň**; Pitka: za každú kartu, s ktorou tvorí spoj, +1 zadĺženie. | S | nová | Spojka 7 akcií (Cig, Povera, Robota, Posilnenie / Viera, Vízia, Pečeň): všetko vybaví, ale na dlh. |
| Bufetárka | — → **Cig, Poldeci, Pečeň / Viera, Povera, Dlh**; Pitka: každý, koho karta s ňou tvorí spoj, dostane cigaretu. | S | nová | Spojka 6 akcií (Cig, Poldeci, Pečeň / Viera, Povera, Dlh), obslúži aj súpera. |
| Brigádnik | — → **Robota, Cig, Rana / Robota, Pečeň, Obmedz**; Furt: do prevahy sa neráta. | S | nová (rezerva) | Spojka 6 akcií (Robota, Cig, Rana / Robota, Pečeň, Obmedzenie), Pracujúci pre Družstvo. |
| Hromotĺk | — → **Petelica / Pečeň×2**; Bez efektu. | U | nová | Petelica (len slot 1) / Pečeň×2: bije za troch, pije za dvoch. |
| Mäsiar | — → **Pecka, Pečeň / Pecka, Pečeň**; Bez efektu. | U | nová | Pecka, Pečeň / Pecka, Pečeň: zabíjačka so slivovicou od rána. |
| Kulturista | — → **Petelica / Dlh×2**; Bez efektu. | U | nová | Petelica / Dlh×2: anaboliká na splátky. |
| Traktoristka | — → **Petelica, Pečeň / Dlh**; Bez efektu. | U | nová | Petelica, Pečeň / Dlh: úderníčka z plagátu JRD. |
| Kuchárka | — → **Pecka, Dlh / Pecka, Poldeci**; Bez efektu. | U | nová (rezerva) | Pecka, Dlh / Pecka, Poldeci: naberačka zo školskej jedálne, obedy na dlh. |
| Oslávenec | — → **Poldeci, Cig / Rana**; Kšeft: za plný poldeci naleješ súperovi — v tejto Pitke dostane 2 Pečene. | E | nová | Kšeft na plný poldeci (bez neresti a pečene platiteľa); akcie Poldeci, Cig / Rana. |
| Šúľač | — → **Cig, Povera / Vízia**; Kšeft: za 1 špak si dober 2 karty. | E | nová | „Zbav sa špaku“: z tvojich ohorkov ušúľa cigaru; akcie Cig, Povera / Vízia. |

### Starší

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Veterinár | Posil×2 / Cig, Poldeci; Bitka: Cirhózy ti pridávajú o 2 tuhé menej. | St | nechať | Bez zmeny — ožije s viac Cirhózami. |
| Autobusár | Cig, Pecka, Poldeci / Robota; Bitka: 1 Absťák sa nepočíta nikde (schválené A). | St | nechať | Bez zmeny. |
| Starosta | Pecka, Poldeci / Cig, Pecka; Kšeft: za cigaretu výmena ruka ↔ šenok, nie Cirhóza (schválené). | St | nechať | Bez zmeny. |
| Farár | Posil×2 / Viera×2; Bitka: ignoruj 2 súperove Povery. | St | nechať | Bez zmeny — Povier pribudne (32 → 40). |
| Poštárka | Vízia / Cig, Povera, Vízia; Kšeft: za 1 Dlh až 2 karty (schválené). | St | nechať | Bez zmeny. |
| Hrobár | Viera, Vízia / Pohorš, Robota; Furt: cigareta, keď súper zahodí kartu. | St | nechať | Bez zmeny — zahadzovania pribudlo (Krokodíl, Smetiarka). |
| Vychovávateľka | Cig, Obmedz / Poldeci, Povera; Pitka: pri tvojom NA EX súper berie tvoj Dlh do balíčka. | St | nechať | Bez zmeny. |
| Krčmárka | Obmedz, Poldeci / Cig, Povera; Bitka: bez Absťáku a NA EX otoč vypitý poldeci. | St | nechať | Bez zmeny (úzka, starší má byť vzácny); sledovať. |

### Lokality (úrovne 1 / 2 / 3 / pinnacle)

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Zastávka | Cig / Pecka; Zhromaždenie: spoločný limit. | L1 | nechať | Úroveň 1 (dnes 1/1). Spodok ako dnes: plechová búdka, cestovný poriadok, ktorý neplatí. |
| Most | Obmedz, Viera / Dlh, Petelica → **Dlh / Pecka**; Len na vlastnú stranu. | L1 | prerobiť | Úroveň 1: hrany 2/2 → 1/1 (Dlh / Pecka), Obmedzenie, Viera a Petelica odchádzajú; efekt ostáva. Ilustrácia: pod mostom matrac, fľaše a dlžný úpis pribitý na pilier. |
| Lesná cesta | Pecka / Povera; Bitka: +1 tuhé za telo v súperovom kraji (max 2). | L1 | nechať | Úroveň 1 (dnes 1/1), bez zmeny. |
| Cintorín | Viera / Robota; Prehra: Nástroj do Dedičstva zadarmo. | L1 | nechať | Úroveň 1 (dnes 1/1), bez zmeny. |
| Jednota | Cig / Pohorš; Pitka: barter o 1 lacnejší (mŕtve). | L1 | prerobiť | Úroveň 1 (hrany 1/1 ostávajú); efekt Kšeft lokality: za 1 Dlh 2 cigarety (na sekeru). Ilustrácia: polozatvorená predajňa, zošit „na sekeru“ na pulte, pivo na schodoch. |
| Ihrisko | Rana×2 / Cig, Poldeci → **Rana, Pecka / Cig, Poldeci**; Bitka: +2 tuhé za prevahu v kraji. | L2 | prerobiť | Úroveň 2 (dnes 2/2); hrana na trávniku Rana×2 → Rana + Pecka. |
| Benzínka | Cig×2 / Obmedz, Pecka; Pitka: nikto nefajčí. | L2 | nechať | Úroveň 2 (dnes 2/2), bez zmeny. |
| Kar | Povera, Viera / Poldeci, Rana; Bitka: zahoď nepriznanú Cirhózu z ruky (takmer mŕtve, D4). | L2 | prerobiť | Úroveň 2 (hrany 2/2 ostávajú); Pitka: doliatie nestojí cigarety, ale každé pridá 1 Pečeň. |
| Zberný dvor | Cig, Petelica, Robota / Dlh, Obmedz, Pohorš → **Petelica, Robota / Dlh, Obmedz**; Kšeft: za cigaretu karta z odhadzovacieho (schválené). | L2 | prerobiť | Úroveň 2: hrany 3/3 → 2/2 (Petelica, Robota / Dlh, Obmedzenie), Cigareta a Pohoršenie odchádzajú; Kšeft ostáva. |
| Krčma | Pecka, Poldeci, Rana / Cig, Dlh, Povera → **Petelica, Poldeci / Dlh, Povera**; Pitka: povinné NA EX, prah Cirhózy +2. | L2 | prerobiť | Úroveň 2: hrany 3/3 → 2/2 (Petelica, Poldeci / Dlh, Povera): Rana → Petelica, Pecka a Cigareta odchádzajú; efekt ostáva. Stred dediny, kam chodia všetci. |
| Obecný úrad | Robota, Viera / Pecka, Povera → **Robota, Viera, Obmedz / Pecka, Povera, Dlh**; Bitka: prah Exekútora −4, Robota páli 2 Dlhy (polovica mŕtva). | L3 | prerobiť | Úroveň 3: hrany 2/2 → 3/3 (+ Obmedzenie / + Dlh); Bitka: za každé 2 priznané Dlhy −1 tuhé, Robota páli 2 Dlhy. Ilustrácia: zrekonštruovaná budova, zlaté kľučky, nové auto pred vchodom, ľudia v rade na chodbe. |
| Kultúrny dom | Pohorš×2, Pečeň / Cig, Rana, Viera → **Pohorš×2, Pečeň / Cig, Pecka, Viera**; Bitka: prebytok do špakov. | L3 | prerobiť | Úroveň 3 (dnes 3/3); hrana pred vchodom Rana → Pecka, efekt ostáva. Ilustrácia: kultúrak po rekonštrukcii s tabuľou o dotácii, VIP stôl s obrusom, zvyšok dediny na lavičkách. |
| Vínna pivnica | Poldeci / Pecka → **Poldeci, Pečeň, Posil / Pecka, Rana, Cig**; Pitka: NA EX až 2×. | L3 | prerobiť | Úroveň 3: hrany 1/1 → 3/3 (Poldeci, Pečeň, Posilnenie / Pecka, Rana, Cig); efekt ostáva, pozor na NA EX v 4 Pitkách. Ilustrácia: súkromná pivnica papalášov, mramor, sudy s menovkami, degustácia pre hostí z okresu. |
| Družstvo | Poldeci, Rana, Robota / Obmedz, Odpor, Pohorš; Zhromaždenie: Pracujúci nemíňajú limit. | L3 | nechať | Úroveň 3 (dnes 3/3), efekt ostáva. Ilustrácia: kancelária predsedu s koženým kreslom, pod oknom ľudia na poli. |
| Kostol | Viera, Vízia / Pohorš, Povera → **Viera, Vízia, Robota / Pohorš, Povera, Viera**; Nikto nepije ani nedá NA EX. | L3 | prerobiť | Úroveň 3: hrany 2/2 → 3/3 (+ Robota / + Viera), efekt ostáva — jediná triezva veľká bitka. Ilustrácia: pozlátený oltár, nové auto na fare, zbierka na opravu strechy. |
| Poľovnícky zámoček | — → **Petelica, Pecka, Posil, Dlh / Petelica, Rana, Pohorš, Pečeň**; Furt: Aktívne akcie hrán lokality sa rátajú dvakrát. | LP | nová (pinnacle) | Pinnacle 4/4 (Petelica, Pecka, Posilnenie, Dlh / Petelica, Rana, Pohoršenie, Pečeň). Korupcia: poľovačka pre papalášov z okresu, obálka pri trofeji, terénne autá so štátnymi značkami. |
| Predsedova vila | — → **Pecka×2, Cig, Obmedz / Petelica, Posil, Viera, Dlh**; Kšeft (obaja): Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole. | LP | nová (pinnacle) | Pinnacle 4/4 (Pecka×2, Cig, Obmedzenie / Petelica, Posilnenie, Viera, Dlh). Korupcia: sprivatizovaná vila bývalého predsedu JRD, traktor s krokodílom na kapote, úplatky v bonboniérach. |
| Agroareál z eurofondov | — → **Petelica, Pecka, Pečeň, Poldeci / Pecka, Rana, Robota, Dlh**; Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov, najviac 5. | LP | nová (pinnacle) | Pinnacle 4/4 (Petelica, Pecka, Pečeň, Poldeci / Pecka, Rana, Robota, Dlh). Korupcia: eurofondový agroturistický areál, ktorý nikdy nefungoval, požiarna nádrž s krokodílom, lesklá tabuľa projektu. |

### Štartové a kliatby

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Pijan | Dlh, Pečeň / Poldeci, Pečeň, Rana; Bitka: Žena s aktívnym Poldeci pri ňom → súper ti dá Ranu. | Š | po ULTRA | Poznámka: jediný štartový úderník s pečeňou, vzor dilemy; rozhodne sa s rodinou. |
| Milujúca manželka | Dlh, Viera / Odpor, Povera; Furt: Absťák aj pri rovnakom počte nerestí. | Š | po ULTRA | Poznámka: návrh „odvedie ťa domov“ čaká na ULTRA. |
| Miňištrant | Pečeň, Viera / Cig, Povera; Výhra: posun prebytkom o 1 drahší. | Š | po ULTRA | Poznámka: návrh „rozhrešenie“ čaká na ULTRA. |
| Dievčina na vydaj | Dlh×2 / Pohorš, Povera; Bitka: zahodí sa a spáli Dlhy podľa akcií. | Š | po ULTRA | Poznámka: návrh „veno“ čaká na ULTRA. |
| Dlh | — / —; Priznaný: Exekútor, Povery, remíza. | K | pravidlo | Mimo revízie kariet; zuby mu dajú Obecný úrad, Jednota, Podvodník, Policajtka a otázka prahu Exekútora (v7). |
| Cirhóza | — / —; Priznaná +1 tuhé súperovi, nepriznaná −5 špakov. | K | pravidlo | Mimo revízie — je to cena celej pečeňovej osi. |
| Absťák | — / —; −1 tuhé, remíza, špaky víťaza. | K | pravidlo | Mimo revízie. |

## 4. Novinky

| Karta | Typ | Jedna veta |
|---|---|---|
| **Vybavovač** (Občan · Chlap) | S | Každého pozná, všetko vybaví, ale na dlh. 7 akcií (Cig, Povera, Robota, Posilnenie / Viera, Vízia, Pečeň). *Pitka: Za každú kartu, s ktorou tvorí spoj, ti pribudne 1 zadĺženie.* |
| **Bufetárka** (Občan · Pracujúci · Žena) | S | Obslúži každého, aj súpera. 6 akcií (Cig, Poldeci, Pečeň / Viera, Povera, Dlh). *Pitka: Každý hráč, ktorého karta s ňou tvorí spoj, dostane 1 cigaretu.* |
| Brigádnik (Občan · Pracujúci · Chlap) — rezerva | S | Prišiel na sezónu, v dedine ho nikto nepočíta. 6 akcií (Robota, Cig, Rana / Robota, Pečeň, Obmedzenie). *Furt: Do prevahy sa neráta.* |
| **Hromotĺk** (Občan · Chlap) | U | Bije za troch, pije za dvoch: Petelica (len slot 1) / Pečeň ×2, bez efektu. |
| **Mäsiar** (Občan · Pracujúci · Chlap) | U | Zabíjačka so slivovicou od rána: Pecka, Pečeň / Pecka, Pečeň, bez efektu. |
| **Kulturista** (Občan · Influencer · Chlap) | U | Anaboliká na splátky: Petelica / Dlh ×2, bez efektu. |
| **Traktoristka** (Občan · Pracujúci · Žena) | U | Úderníčka z plagátu JRD, čo prežila aj družstvo: Petelica, Pečeň / Dlh, bez efektu. |
| Kuchárka (Občan · Pracujúci · Žena) — rezerva | U | Naberačka zo školskej jedálne, obedy na dlh: Pecka, Dlh / Pecka, Poldeci, bez efektu. |
| **Oslávenec** (Občan · Závislý · Chlap) — **Kšeft na plný poldeci** | E | Má päťdesiat a odmietnuť sa nedá. *Kšeft: Za plný poldeci naleješ súperovi — v tejto Pitke dostane 2 poškodenia pečene.* Platí sa bez neresti a bez pečene platiteľa (Michal). Akcie Poldeci, Cig / Rana. |
| **Šúľač** (Občan · Závislý · Chlap) — **„zbav sa špaku“** | E | Z tvojich ohorkov ušúľa cigaru a prezradí, čo príde. *Kšeft: Za 1 špak si dober 2 karty.* Akcie Cig, Povera / Vízia. |

Kódom treba len Vybavovača, Bufetárku, Brigádnika, Oslávenca a Šúľača (Kšeft v7). Úderníci sú bez efektu, stačia im dáta.

## 5. WAU komba (všetky potrebujú 3 karty a viac ťahov)

Strany: na tvojej strane je vnútorná hrana karty jej pravá (§6 :225–229). Násobky sa násobia (§7 :459–462).

1. **Hromotĺk na NA EX pri Silnej žene — 12 tuhé.** Draft: Silná, nezávislá žena a Hromotĺk. Zhromaždenie 1: Silná žena pri lokalite. Zhromaždenie 2: Hromotĺk za ňu, jeho Pečene sa spoja s ňou (×2 = 4 pečeň za Pitku, zlá!) a Petelica ostane voľná. Pitka 2: tvoje NA EX na Hromotĺka zruší aktívne Pečene a zdvojí Petelicu, Silná žena ju zdvojí znova: **3 × 4 = 12**. Protihra: súper odpovie kartou k voľnej hrane, Petelica sa spáruje a NA EX ju zruší. Na Moste (len vlastná strana) je kombo bezpečné. Treba 2 Pitky (Kohút) alebo Vypiť.
2. **Dezinformátor — 14 tuhé.** Praudovravec pri lokalite, Hasič za ním (Petelica proti Odporu Praudovravca: Odpor sa ráta ako Posilnenie, ×2), Silná žena za Hasičom (jeho aktívne ×2). Petelica **3 × 2 × 2 = 12**, Rana ×2 = 2. Cena: Posilnenie Hasiča trafí Dlh Silnej ženy, dostaneš 2 zadĺženia za Pitku, teda Dlh. Treba správne varianty, preto zriedka.
3. **Kôň, Puška, Zámočník — 16 tuhé.** Kôň pri lokalite, prerobená Puška (Pecka / Petelica) a Zámočník (otočený). Petelica proti Posilneniu Koňa ×2, Zámočník ×2: **12**. Pecka proti Zámočníkovi ×2: **4**. Kôň je Zviera, NA EX naň nejde. Je to najhorší prípad z analýzy (D3), pozri otázku 5.
4. **Povinná runda na Krčme — 12 a viac.** V kraji pri výčape máš prevahu (Dvojčatá sa rátajú za dvoch) a hrana dá Petelicu (3, Krčma úrovne 2). V línii Veterán (Petelica) a Svokra. Súper musí dať NA EX (§15). Zlá možnosť: na svoju kartu, ktorej zruší akcie. Horšia: na tvojho Veterána, ten zdvojí aktívne (Petelica 6, aj tvoju Pečeň), a Varecha ti pridá Ranu. Spolu **3 + 6 + 1 = 10**, s Peckou Svokry 12.
5. **Oslava u Kohúta — súper pije, ty platíš.** Kohút (aspoň 2 Pitky), podstrčený Lievik pri súperovom Občanovi (jeho Pečeň ×2 pripadne súperovi, §12 :947–950) a Oslávenec. Za Pitku dostane súper 2 + 2 = 4 Pečene, za 2 Pitky 8, teda **2 Cirhózy** (prah 3). Každú buď prizná (ty +1 tuhé v každej ďalšej bitke), alebo riskuje −5 špakov. Stojí ťa to 2 plné poldeci (limit −2). Úplná protihra: Nealko (prah 5).
6. **Tichá spojka — 7 až 10 tuhého bez NA EX.** Mäsiar pri lokalite, Vybavovač, otočená Traktoristka. Vybavovač má vľavo všetky 4 sloty plné, takže Petelica Traktoristky sa zapne vždy: 3, a keď padne na jeho Posilnenie, 6. K tomu Pecka Mäsiara pri Vybavovačovi 2 a pri lokalite ďalšia 2. Cena: 2 až 3 Pečene, Dlh Traktoristky a od Vybavovača +2 zadĺženia za Pitku (Dlh). Najľahšie komba z celej šestice.

## 6. Zlá a horšia možnosť

**Zásada pre každú prerábku a novinku:**
1. **Sila sa platí na tej istej karte.** Úderník platí za tuhé aspoň polovicou v Pečeni alebo Dlhu (Petelica 3 → 2 zlé akcie). Cenu dávaj na tú istú stranu ako útok, nech ju spojka zapne spolu s ním.
2. **Spojka nesie aspoň 1 zlú akciu.** Kto spája, ten aj pije alebo dlží. Posilnenie na spojke zdvojí aj zlú akciu.
3. **Silný efekt stojí menu** (Kšeft: cigarety, poldeci, Dlh, špak) **alebo nerest**, alebo má protihru v sade. Samotné cigarety bolia málo, preto drahé veci platia poldeci, Dlhom či špakom.
4. **Druhá strana nesie riziko pre súpera.** Pečeň a Dlh na voľnej hrane súper zapne podstrčením alebo odpoveďou (Hromotĺk, Vínko, Lievik, Kočovník).

| Karta | Sila | Cena (zlá vs. horšia) |
|---|---|---|
| Hromotĺk, Traktoristka, Kulturista, Mäsiar, Kuchárka | Petelica alebo 2 Pecky | 2 Pečene alebo Dlhy za Pitku, pri 2 Pitkách dvojnásobok |
| Veterán + NA EX | Petelica 6 | NA EX zdvojí aj jeho Pečeň a Poldeci, takže Cirhóza je takmer istá |
| Kočovník | Pecka tomu, kto má prevahu v kraji | tomu istému aj 2 Pečene a Dlh. Vyhrať kraj = aj piť |
| Spojky (Vybavovač, Bufetárka, Šarlatán…) | zapnú susedov | zapnú aj vlastný Dlh a Pečeň. Vybavovač +1 zadĺženie za spoj, Bufetárka dá cigaretu aj súperovi |
| Šofér | Pecka navyše | len bez NA EX, teda menej nerestí a bližšie k Absťáku |
| Kar | doliatie zadarmo | každé doliatie +1 Pečeň |
| Jednota | 2 cigarety | Dlh |
| Obecný úrad | Robota páli 2 Dlhy | každé 2 Dlhy −1 tuhé |
| Oslávenec | súper +2 Pečene | tvoj plný poldeci (limit −1) |
| Šúľač | 2 karty | špak, teda víťazný bod |
| Kapybara (2 cigarety) | súper −1 špak | 2 cigarety za Pitku |
| Krčma (povinné NA EX) | prah Cirhózy +2 | NA EX na vlastnú kartu, alebo do súperovho Veterána či Svokry |
| Výherný automat | Výhra 3 cigarety | Prehra 2 Dlhy |


## 7. Lokality podľa úrovní

> Michal: „Budú lokality úrovne 1 — budú mať po stranách 1 akciu, úrovne 2 a 3 — budú mať 2 a 3 akcie, a potom budú pinnacle lokality, tie budú mať akcie 4, väčšinu z nich silné… dávkovať postupne… pre finále pôjde lokalita pinnacle, čiže hráč nemusí dávať prvý svoju kartu občana.“
> „Hráči si budú vyberať zo všetkých lokalít v hre danej úrovne… aspoň 3 lokality každej úrovne a 3 pinnacle… prvé lokality najspodnejší spodok ako zastávka, most… posledné honosné miesta, kde dedinská šľachta sídli — obecný úrad, autobus… Na pinnacle lokalitách chcem, aby bolo vidno známky korupcie. Efekty pinnacle silné.“

### 7.1 Úroveň = počet akcií na hrane

Úroveň netreba zapisovať ako nové pole. Je to počet akcií na každej hrane (1 / 2 / 3 / 4) a tvorca len overí, že obe hrany majú rovnako. Počet Pitiek je 1 + menší počet aktivovaných akcií hrán (§7 :467–479), takže úroveň dáva strop Pitiek **2 / 3 / 4 / 5** a tým aj strop špakov za bitku (§9.4).

Dnešná sada je k tomu blízko: 5 lokalít má hrany 1/1, 6 má 2/2, 4 má 3/3 a pinnacle nie je žiadna. Rozdelenie podľa témy (od spodku po šľachtu) a pravidla „aspoň 3 na úroveň“ vyjde **5 / 5 / 5 + 3 nové pinnacle** (spolu 18 lokalít):

| Úroveň | Charakter | Lokality | Zmena hrán |
|---|---|---|---|
| **1** (1/1) | spodok | Zastávka, **Most**, Lesná cesta, Cintorín, Jednota | Most 2/2 → 1/1 (Dlh / Pecka) |
| **2** (2/2) | dedina | Ihrisko, Benzínka, Kar, **Zberný dvor**, **Krčma** | Zberný dvor a Krčma 3/3 → 2/2 |
| **3** (3/3) | sídla dedinskej šľachty | **Obecný úrad**, Kultúrny dom, **Vínna pivnica**, Družstvo, **Kostol** | Obecný úrad a Kostol 2/2 → 3/3, Vínna pivnica 1/1 → 3/3 |
| **Pinnacle** (4/4) | korupcia na očiach | Poľovnícky zámoček, Predsedova vila, Agroareál z eurofondov (nové); rezerva Predvolebný guláš | 4 akcie na hrane, žiadny blokovaný slot |

- **Krčma klesá na 2**, lebo je stred dediny, kam chodia všetci, a má sa hrať často. Povinné NA EX v 3 Pitkách stačí.
- **Vínna pivnica stúpa na 3** ako súkromná pivnica papalášov. Jej NA EX 2× patrí do veľkého kola.
- **„Autobus“ (na potvrdenie):** čítam ho ako *Autobusovú stanicu z eurofondov* (nová čakáreň so sklom a kamerou, kam autobus nechodí). Mohla by byť 6. lokalitou úrovne 3, alebo nahradiť Kostol. Michal, čo si myslel?
- Variant „len 15 lokalít“: tri lokality úrovne 3 povýšiť na pinnacle. Potom však úrovni 3 ostanú 2 lokality, čo je pod minimom 3. Preto navrhujem nové.

Ilustrácie (námety pri lokalitách, ktorým sa mení charakter, sú v tabuľke 3): spodok je rozpadnutý, s fľašami a dlhmi. Úroveň 3 je čerstvo zrekonštruovaná z dotácií, s VIP stolom a autom pred vchodom. Pinnacle ukazuje korupciu priamo: obálky, štátne značky, krokodíl na kapote traktora (`tools/admin/styl.md`), tabuľa eurofondov. Dym len podľa pravidiel štýlu.

### 7.2 Výber cieľa a dávkovanie

**Dnes** (§5 :168–172, §3 :115–117): pri príprave sa náhodne vyžrebuje 3 / 5 / 7 lokalít (`engine.ts:1140–1150`). Obranca z nich vyberie cieľ a natočí ho. Vo finále sa cieľ nevyberá.

**Nové:** nič sa nežrebuje. Kolo *k* má úroveň podľa rozpisu a **obranca vyberá zo všetkých ešte neodohraných lokalít tej úrovne** v sade a natočí ju. Vo finále vyberá a natáča pinnacle obranca, teda hráč s menej špakmi (útočí ten s viac, §14b). Je to dobiehanie.

| Dĺžka | Rozpis | Max Pitiek (špakov víťazovi) | Najviac lokalít jednej úrovne |
|---|---|---|---|
| krátka (3) | 1 · 2 · 3 · P | 2 · 3 · 4 · 3 | 1 z 5 |
| **stredná (5)** | **1 · 2 · 2 · 3 · 3 · P** | 2 · 3 · 3 · 4 · 4 · 3 | 2 z 5 |
| dlhá (7) | 1 · 1 · 2 · 2 · 3 · 3 · 3 · P | 2 · 2 · 3 · 3 · 4 · 4 · 4 · 3 | 3 z 5 |

Obranca má vždy na výber aspoň z 3 lokalít, aj v poslednom kole dlhej hry (5 − 2 = 3).

**Prečo stúpanie:**
1. Balíček rastie. V 1. kole sa hrá so 4 štartovými kartami a 0–2 zo šenku, takže hrana 1/1 stačí. Na 3/3 už je čím spájať.
2. Neskoršie bitky dávajú viac špakov. To je dobiehanie proti zisteniu Stratéga, že kto vedie po 2. bitke, vyhrá asi 80 %. Strach však dáva špaky v každej bitke rovnako, takže stúpanie snehovú guľu len tlmí, nezastaví (merať).
3. Pečeň a Kšefty sa počítajú za Pitku, takže dilema „zlá vs. horšia“ vrcholí na konci hry.

V strednej hre je dlhá trojka na konci (3 · 3 · P) zámerná: dve veľké bitky pred finále dávajú zaostávajúcemu dve šance. Alternatíva 1 · 1 · 2 · 3 · 3 je pomalšia a v 2. kole by sa hralo s 1 akciou na hrane, keď už ruka unesie viac.

### 7.3 Prvá karta: čo dnes hovorí §5/§6 a čo sa zmení

- **Bežné kolo (§6 :223–229, :281–291):** žiadne pravidlo nevyžaduje, aby prvá karta bola Občan. Prvá karta pri lokalite určuje, ktoré akcie hrany sa zapnú, a dostane ich hráč s prevahou. Pri rovnosti rozhoduje karta hneď pri lokalite. Toto ostáva.
- **Finále dnes (§6 :221–222, §14b :1074–1078):** lokalita nie je. Prvá vyložená karta (ľubovoľná, `stredFinale`, `engine.ts:331`, :2094) leží v strede a vykladá ju útočník, teda vedúci. Odkryje tým kartu a obetuje ju ako stred. Kraje ani prevaha vo finále nie sú, Kočovník dáva akcie majiteľovi a Presbiter nepôsobí. Tomuto Michal hovorí „zlý nápad“.
- **Finále s pinnacle:** v strede je lokalita, takže **pravidlo „prvá karta = stred“ zaniká**. Útočník len vykladá prvý ako v každom kole. **Kraje a prevaha platia aj vo finále** (Kočovník, Presbiter, Dvojčatá, Lesná cesta a Ihrisko ako vzor). Na nástenke má aj finále lokalitu (§14 :1055).
- **Pitky vo finále:** navrhujem ostať pevne pri **3** (`KONSTANTY.FINALE_PITKY`, `engine.ts:1441`). Inak by sa finále dalo zrezať na 1 Pitku alebo nafúknuť na 5. Hrany 4/4 tak rozhodujú o akciách a prevahe, nie o počte Pitiek (otázka 7).
- **Text na zmenu:** §3, §5, §6 :221–222, §7 :479, §14 :1055, §14b, §15 (stĺpec Úroveň), §17 Finále. Jadro: výber lokalít podľa rozpisu (:1140–1150), odstrániť finálovú vetvu stredu (`stredFinale`, `susedNaKonci` :2083, :2169, :3674, finálový argument `cieleVykladania` :4423, :4450). Prebytok do špakov po finále (:3960) ostáva. Bot: výber lokality v rámci úrovne a finále s krajmi.

### 7.4 Pinnacle: silné efekty a hrany 4/4

| Pinnacle | Hrany (ľavá / pravá) | Efekt |
|---|---|---|
| **Poľovnícky zámoček** | Petelica, Pecka, Posilnenie, Dlh / Petelica, Rana, Pohoršenie, Pečeň | *Furt: Aktívne akcie hrán lokality sa rátajú dvakrát.* Prevaha v kraji je trofej. |
| **Predsedova vila** | Pecka ×2, Cig, Obmedzenie / Petelica, Posilnenie, Viera, Dlh | *Kšeft (obaja): Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole.* Úplatok, raz za Pitku, teda až 3× vo finále. |
| **Agroareál z eurofondov** | Petelica, Pecka, Pečeň, Poldeci / Pecka, Rana, Robota, Dlh | *Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov, najviac 5.* Dotácia prepadne, Dlh vo finále bolí. |
| Predvolebný guláš (rezerva) | návrh vo fáze 2 | *Bitka: Každé tvoje aktívne Pohoršenie ti dá navyše 1 špak* (sľuby). |

Hrany sú zámerne **asymetrické** (tuhé 2–6 na strane), takže natočenie, ktoré volí zaostávajúci, je skutočné rozhodnutie. Na každej strane je aspoň 1 cena (Dlh, Pečeň, Poldeci) a 1 Posilnenie alebo Pohoršenie.

### 7.5 Dopad na rozpočet a archetypy

- **Akcie hrán:** dnes 58 akcií na 15 lokalitách. Plán: úroveň 1 10, úroveň 2 20, úroveň 3 30, pinnacle 24 (v hre vždy len jedna). Na hranách sa mení Pecka 6 → 13, Petelica 2 → 6, Dlh 3 → 7, Pečeň 1 → 4, Posilnenie 0 → 3 (len pinnacle). Rana a Pohoršenie ostávajú (6 a 6). Priemer tuhého na lokalitu podľa úrovne: 1,2 / 2,4 / 1,6 / 8. Úroveň 3 nebije cez hrany, ale cez 4 Pitky.
- **Za strednú hru:** dnes v priemere asi 19 akcií hrán (5 náhodných lokalít), v pláne 22 a k tomu 8 vo finále (dnes 0).
- **Archetypy:** hrana úrovne 1 má jediný slot, takmer vždy slot 1 (Zastávka a Lesná cesta majú jednu hranu na slote 0). Prvá karta ho musí trafiť, čo odmení úderníkov so slotom 1 (Hromotĺk, Kulturista) a spojky. Pinnacle 4/4 je **spojka v strede**, každá prvá karta zapne všetky svoje vnútorné akcie. Finále tak odmení úderníkov a Posilnenie. Esá, ktoré platia za Pitku (Kšefty, Oslávenec, Kapybara), silnejú na úrovni 3. Kapybara pri 4 Pitkách vezme súperovi 4 špaky, ďalší dôvod na cenu 2 cigarety.
- **Kohút** má najväčšiu cenu na úrovni 1 (z 1 Pitky urobí 2). Na úrovni 3 je pre Pitky zbytočný, ostanú mu len akcie.

### 7.6 Riziká

1. **Pinnacle a bomba NA EX.** NA EX na kartu pri lokalite akcie hrany neruší (§7 :374–376), zruší len ×2 z Posilnenia karty. Hrany pinnacle sú teda voči NA EX imúnne a finále rozhodne prevaha v krajoch, nie NA EX. Zámoček ×2 dá pri plnom spárovaní až asi 18 tuhého z hrán, preto strop (otázka 8). Opačná bomba je Vínna pivnica na úrovni 3: 2 NA EX za Pitku v až 4 Pitkách, so Svokrou, Veteránom a Policajtkou.
2. **Vandal** (otoč lokalitu) na asymetrickom pinnacle prehodí 5–10 tuhého jednou kartou. Návrh: pinnacle sa otočiť nedá, alebo to nechať ako WAU.
3. **Finále váži viac:** 3 špaky za bitku + efekt (Agroareál až +5, vila až 3 posuny) + prebytok do špakov. Stratégov cieľ je, aby víťaz finále vyhral 60–75 % partií. Treba to zmerať, nech sa celá hra nezmení na „vyhraj finále“.
4. **Predsedova vila** je Pohoršenie za cigarety a Pohoršenie nemá brzdu (H3). Vo finále nehrozí vydesenie s kolom na odpoveď, ale strach po finále dáva špaky.
5. **Kolo 1 je tiché** (najviac 2 Pitky), strach z neho však už platí. Celý rozpis je známy od začiatku: hráči môžu plánovať, ale ubudne prekvapenie.

### 7.7 Čo zmerať (keď Michal povolí playtest alebo turnaj)

- Pitky podľa úrovne a podiel špakov za bitky a za strach podľa kola.
- Ako často víťaz finále vyhrá partiu a ako často sa vo finále zmení vedenie.
- Tuhé z hrán pinnacle a kto má prevahu vo finále.
- NA EX za Pitku na Vínnej pivnici a Krčme.
- Ktoré lokality obranca v rámci úrovne nevyberá nikdy (mŕtve lokality).
- Vandal a Kohút podľa úrovne.

## 8. Dopad na pravidlá a kód

- Nové pravidlá netreba okrem spúšťača **Kšeft (v7)**, na ktorý už čakajú schválené karty. Oslávenec, Šúľač a Jednota ho použijú.
- Jadro: efekty Šarlatána (vzor `vieraAkoVizia`, `packages/core/src/partia.ts:529`), Šoféra (`naexVKole`, `engine.ts:333`), Obecného úradu (`bitkaMody`, `effects.ts:359`), Karu, Podvodníka, Záhradkára, Výherného automatu, Vybavovača, Bufetárky a Brigádnika. Úderníci sú len dáta.
- Prestávka: zmazať zo zoznamu spúšťačov. Prah Exekútora (otázka 1) je zmena pravidiel v7.
- Bot: hodnota spojky (`bot.ts`, váhy kariet) a Kšefty. Inak bude karty podceňovať ako dnes Praudovravca.
- Štartové karty (Miňištrant, Manželka, Dievčina, aj Pijan) plán nemení. Rozhodnú sa po ULTRA a rozpočet ich ráta v dnešnej podobe.

## 9. Otázky pre Michala

1. **Exekútor:** v7 znížiť prah 10 → 7 (so súperovou priazňou 6/5/4), aby Dlh bolel a ožila priazeň Exekútor? Bez toho ostane Dlh len palivom pre Povery.
2. **Oslávenec:** 2 Pečene za poldeci (silné, merať), alebo 1?
3. **Kapybara:** potvrdiť cenu 2 cigarety (odporúčanie Admina)?
4. **Rezerva:** Brigádnik a Kuchárka áno (56 druhov), alebo nie (54)?
5. **Kombo Kôň + Puška + Zámočník (16 tuhé):** nechať ako vzácne WAU, alebo dať strop (Zámočník nezdvojí akciu, ktorú už zdvojilo Posilnenie)?
6. **Prebytok:** s tuhým asi 6 porastie aj prebytok a vydesenie príde skôr. Stačí to merať v playteste, alebo už do v7 dať brzdu?
7. **Finále:** Pitky pevne 3 aj s pinnacle (odporúčam), alebo 1 + menší počet akcií hrán (1–5)?
8. **Poľovnícky zámoček ×2:** nechať bez stropu, alebo zdvojiť len tuhé akcie hrán?
9. **„Autobus“:** Autobusová stanica z eurofondov ako 6. lokalita úrovne 3 (alebo namiesto Kostola), alebo si myslel niečo iné?
10. **Pinnacle navyše:** 3 nové lokality (spolu 18) sú v poriadku, alebo radšej len 15 s povýšením (úrovni 3 by potom chýbala lokalita)?
