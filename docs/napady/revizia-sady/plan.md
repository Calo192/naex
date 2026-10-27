# Revízia sady — fáza 1: plán

Vymyselník · 27. 10. 2026 · pre Michala cez session Brainstorming · len plán, karty ani pravidlá sa nemenia.

> Michal: „Chcem aby hráč mal pocit, že sa rozhoduje medzi zlou a horšou možnosťou (veľa hazardu a poškodenia pečene), ale chcem aby bolo možné vytvoriť kombinácie, kedy si hráč povie WAU. Priemerné poškodenie treba zvýšiť, čiže viac Peciek a Petelíc… connectory… silný efekt a málo akcií… slabý efekt a veľa akcií… málo a silných akcií… všetko v rámci témy a satiry.“

Podklady: sada v21 (`packages/core/data/cards.json`, 63 kariet) + 13 schválených noviniek (Degustátorka, Klebetnica, Dohadzovačka, Vandal, Strýko, Opatrovateľka v2, Smetiarka, Vidly, Lievik, Krokodíl, Kapybara, Kôň, Kohút), NA EX trojica, Autobusár A, Hasič s voľbou; `docs/PRAVIDLA.md` v6; `docs/napady/analyza-sady.html`; `docs/napady/spaky.html`. **Nič som nesimuloval.** Čísla sú výpočet zo sady (skript nad cards.json, náhodné varianty a natočenia), nie partie. Strojová tabuľka: `plan.json` vedľa tohto súboru.

## V skratke

- **Útok ×1,5.** Petelica 4 → 14 kópií, Pecka 14 → 24. Aktívne tuhé na spoj (model) 0,39 → 0,61. Odhad priemerného tuhého v bitke **4,2 → asi 6** na hráča.
- **Pečeň +70 %.** Akcia Poškodenie pečene 34 → 58 kópií, aktívna pečeň na spoj ×1,39. Dlh 48 → 60, ale každý Dlh navyše dostane zuby (Jednota, Herňa, Podvodník, otázka prahu Exekútora).
- **Štyri archetypy s kvótou:** spojka 10, robotník 15, úderník 10, eso 21 (z toho 8 Nástrojov). Dnes je spojka 1 (Záhradkár) a úderníci 4.
- **Čísla tabuľky:** 89 riadkov — 42 nechať, 27 prerobiť (16 kariet + 11 lokalít; Lesná cesta pribudla rozhodnutím 27. 10.), 13 noviniek (8 kariet, 2 rezerva, 3 pinnacle lokality), 4 štartové po ULTRA, 3 kliatby mimo revízie. Šesť mŕtvych efektov má riešenie.
- **Lokality podľa úrovní (časť 7, rozhodnuté Michalom 27. 10.):** 5 × úroveň 1 (spodok), 5 × úroveň 2, 5 × úroveň 3 (sídla šľachty) a 3 nové pinnacle s korupciou pre finále (Poľovnícka chata, Predsedova vila, Herňa), spolu 18. Stredná hra má rozpis 1 · 2 · 2 · 3 · 3 · P, obranca vyberá zo všetkých neodohraných lokalít úrovne, pravidlo „prvá karta = stred finále“ zaniká a Pitky vo finále určí pinnacle (1–5).
- **Ručné karty (časť 10, rozhodnuté kompletne Michalom 27. 10.):** 22 × Áno v plánovej verzii (Záhradkár: tvoj prah Exekútora +2, Traktoristka: Na leasing, Oslávenec 2 pečene), 5 × Nie (Vybavovač, Hromotĺk, Kuchárka, Šúľač, Bufetárka), prah Exekútora v7 = **7**, Kapybara 2 cigarety, Brigádnik ide do sady, kombá bez stropu. Cieľ Petelíc a Peciek nesedí: 12/14 a 20/24 (10.5).
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

**Po rozhodnutí 27. 10. (karty, 10.5):** Petelica **12** (cieľ 14, −2), Pecka **20** (cieľ 24, −4), Pečeň 50, Dlh 56, Poldeci 26, Povera 34, Viera 32, Cigareta 50, Robota 22, Obmedzenie 18, Odpor 18, Rana 36, Posilnenie 8, Vízia 10. Druhov v balíčku 51, kariet v hre 110.

Lokality (hrany, 15 + 3 pinnacle) po úrovniach z časti 7 (rozhodnuté): Pecka 6 → 13, Petelica 2 → 6, Dlh 3 → 8, Pečeň 1 → 4, Posilnenie 0 → 3, Rana 6 → 8. Starší sa nemenia.

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

**Prečo takto.** Šenok má 8 kariet (§5). Pri pláne v ňom bude aspoň jedna spojka so šancou 79 %, úderník 79 %, robotník 92 % a eso 98 %. WAU potrebuje spojku, úderníka a zosilňovač (eso), teda cieľ na 2–3 drafty, nie dar z jedného šenku. Robotník je chlieb, ruka z neho sa dá zahrať vždy. Esá sú početné, lebo Nástroje a Kšefty sa kupujú do Dedičstva a na Pitku, nie do línie. Kšeft je v balíčku na 4 kartách (Smetiarka, Strýko, Kapybara, Oslávenec; Šúľač odpadol 27. 10.), pod stropom 5, ktorý navrhol Vymyselník. Starší a lokality (Starosta, Poštárka, Zberný dvor, Jednota) sa do neho nerátajú.

## 3. Tabuľka kariet

Akcie: ľavá / pravá strana; tučne plán, ak sa mení. „Pečeň“ = Poškodenie pečene. Typ: S spojka, R robotník, U úderník, E eso, L lokalita, St starší, K kliatba, Š štart.

**Mŕtve efekty z analýzy, riešenie:**
- **Záhradkár:** Exekúcia → *Bitka: Tvoj prah Exekútora je o 2 vyšší.* (rozhodnuté 27. 10., 10.1).
- **Obecný úrad:** prah Exekútora −4 zaniká, ostáva *Bitka: Každá aktívna Robota spáli 2 priznané Dlhy* (rozhodnuté Michalom 27. 10.).
- **Exekútorova priazeň:** prah Exekútora v7 = **7**, so súperovou priazňou 6 / 5 / 4 (rozhodnuté Michalom 27. 10., 10.4); k tomu Dlhov pribudne +17 % (48 → 56).
- **Kar:** *doliatie zadarmo, ale každé +1 Pečeň*.
- **Jednota:** *Kšeft: Za 1 Dlh dostaneš 2 cigarety* (na sekeru; rozhodnuté 27. 10.).
- **Prestávka:** spúšťač bez karty, zmazať z ALL_TRIGGERS (malé zadanie pre vývoj, v7).

### Nástroje

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Noviny | Pohorš / Povera; Dedičstvo: +1 špak, keď sa ťa bojí viac starších. | E | nechať | Bez zmeny (efekt z v6). |
| Krabička cigariet | Cig / Cig; Dedičstvo: +1 cigareta v každej Pitke. | E | nechať | Bez zmeny — palivo pre Kšefty. |
| Vínko | Poldeci×2 / Pečeň×4; Dedičstvo: plný poldeci navyše, bez doliatia. | E | nechať | Bez zmeny; Pečeň×4 v línii je zbraň — podstrčené k súperovmu Občanovi ho opije (§12). |
| Pasca | Obmedz / Odpor; Dedičstvo: každé súperovo Zviera −1 tuhé. | E | nechať | Bez zmeny, ožije so 6 zvieratami. |
| Puška | Rana / Pecka → **Pecka / Petelica**; Dedičstvo: prebytok proti tebe −2. | U | prerobiť (rozhodnuté, 10.1) | Rana → Pecka, Pecka → Petelica (brokovnica po dedovi); efekt ostáva. |
| Svätý text | Viera / Viera; Dedičstvo: Viera +1. | E | nechať | Bez zmeny; pri vyššom tuhom má Viera väčšiu cenu. |
| Nealko | Pohorš / Pohorš; Dedičstvo: prah Cirhózy +2. | E | nechať | Bez zmeny — pri +70 % akcií Pečeň je to hlavná poistka (D6 sa vyrieši sama). |
| Výherný automat | Robota / Dlh×4; Dedičstvo: Výhra 2 cigarety, Prehra 1 Dlh. | E | prerobiť (rozhodnuté, 10.1) | Väčší hazard: Výhra 3 cigarety, Prehra 2 Dlhy; akcie (Dlh×4) ostávajú. |
| Vidly | Pecka / Pohorš; Dedičstvo: +1 tuhé, kým máš menej špakov (schválené). | U | nechať | Bez zmeny. |
| Lievik | Poldeci / Pečeň×2; Dedičstvo: NA EX aj na Zviera (schválené). | E | nechať | Bez zmeny; Pečeň×2 v línii = podstrčiteľný hazard. |

### Zvieratá

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Čierna mačka | Pohorš, Povera / Povera; Furt: Povery bijú aj bez súperových Dlhov. | E | nechať | Bez zmeny. |
| Pes | Rana / Rana×2; Furt: +1 tuhé za pár na spoji so súperovou kartou. | U | nechať | Bez zmeny. |
| Krokodíl | Odpor / Pecka; Furt: zožerie súperovu kartu vyloženú vedľa (schválené). | E | nechať | Bez zmeny. |
| Kapybara | Viera / Cig; Kšeft: za cigaretu zožerie súperovi špak (schválené). | E | nechať, zdražiť (rozhodnuté: 2 cigarety) | Cena 2 cigarety (odporúčanie Admina, H1); inak nič. |
| Kôň | Posil / Rana; Furt: Nástroj s ním tvorí spoj (schválené). | E | nechať (strop nie, rozhodnuté) | Bez zmeny; strop komba so Zámočníkom pozri WAU 3. |
| Kohút | Pohorš / Odpor; Furt: kolo má aspoň 2 Pitky (schválené). | E | nechať | Bez zmeny — 2 Pitky = 2× pečeň zo všetkých kariet. |

### Občania (dnešní a schválení)

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Finančná poradkyňa | Dlh×2, Povera / Cig, Dlh → **Dlh×2, Povera / Cig, Dlh, Obmedz**; Pitka: Dlh z jej akcií dostáva súper. | S | prerobiť (rozhodnuté, 10.1) | Spojka: vpravo + Obmedzenie (6 akcií); jej Dlhy zadlžia súpera, kto ju podstrčí, kŕmi Povery. |
| Veľmi smútiaca vdova | Dlh, Obmedz, Rana / Pohorš×2; Nástup: muž navrchu súperovho balíčka ide z hry, ty zahodíš 2 Dlhy. | R | nechať | Bez zmeny (tematická). |
| Veštica | Cig, Vízia / Povera×2, Viera → **Cig, Vízia, Pečeň / Povera×2, Viera**; Prehra: vymeň kartu medzi doberacími balíčkami. | S | prerobiť (rozhodnuté, 10.1) | Spojka: vľavo + Pečeň (bylinkový likér), 6 akcií. |
| Silná, nezávislá žena | Cig, Pohorš / Dlh×2; Furt: aktívne akcie susedných vlastných kariet ×2. | E | nechať | Bez zmeny — hlavný zosilňovač WAU kôl. |
| Policajtka | Obmedz, Rana / Robota; Pitka: kto dal viac NA EX, dostane Dlh (schválené P1). | E | nechať | Bez zmeny. |
| Hasič | Posil / Petelica, Rana; Nástup: náhodná karta z odhadzovacieho, nechaj/vráť (schválené). | U | nechať | Bez zmeny; Petelica už má. |
| Praudovravec | Odpor, Povera / Pohorš, Povera, Vízia → **Odpor, Povera, Viera / Pohorš, Povera, Vízia**; Furt: Odpor na jeho spojoch posilní (Dezinformátor, schválené). | S | prerobiť (rozhodnuté, 10.1) | Spojka-zosilňovač: vľavo + Viera (6 akcií), efekt ostáva. |
| Zámočník | Cig, Poldeci / Pecka, Robota; Furt: akcie Nástrojov v okolí ×2. | R | nechať | Bez zmeny; s prerobenou Puškou dá WAU 3. |
| Niekoho stryná | Poldeci, Viera / Povera, Viera, Vízia → **Poldeci, Viera, Pečeň / Povera, Viera, Vízia**; Nástup: zahoď 1 Cirhózu alebo Dlh. | S | prerobiť (rozhodnuté, 10.1) | Spojka: vľavo odblokovať slot 2 a + Pečeň („na zdravie“), 6 akcií. |
| Veterán | Poldeci, Pečeň / Odpor, Pecka → **Poldeci, Pečeň / Odpor, Petelica**; Furt: NA EX zdvojí jeho aktívne akcie. | R | prerobiť (rozhodnuté, 10.1) | Pecka → Petelica; s NA EX 6 tuhé, ale zdvojí aj jeho Pečeň a Poldeci. |
| Recidivista | Dlh, Odpor / Petelica, Rana → **Dlh×2 / Petelica, Rana**; Bitka: Rana navyše za každého Zahraničného súpera. | U | prerobiť (rozhodnuté, 10.1) | Úderník: vľavo Odpor → Dlh (súdne trovy), Petelica s cenou 2 Dlhov; Odporov je priveľa (+57 %). |
| Liberál | Pohorš / Cig → **Pohorš, Viera / Cig, Povera**; Furt: ×2 pri rovnosti žien a chlapov (bez zákazu NA EX). | R | prerobiť (rozhodnuté, 10.1) | Akcie 2 → 4 (Pohoršenie, Viera / Cig, Povera), aby ×2 malo čo zdvojiť. |
| Živnostník | Dlh, Odpor / Cig×2, Pečeň → **Dlh, Odpor, Robota / Cig×2, Pečeň**; Výhra: zahoď súperovo Dedičstvo. | S | prerobiť (rozhodnuté, 10.1) | Spojka: vľavo + Robota (6 akcií); Odpor na spojke je pasca pre suseda, efekt ostáva. |
| Kočovník | Dlh, Pečeň / Cig, Pečeň, Rana → **Dlh, Pečeň / Cig, Pečeň, Pecka**; Furt: jeho akcie berie hráč s prevahou v kraji. | R | prerobiť (rozhodnuté, 10.1) | Rana → Pecka: kto ho vyhrá, dostane Pecku aj 2 Pečene a Dlh. |
| Svokra | Poldeci / Obmedz, Pecka, Viera; Bitka: Rana za každú tvoju kartu so súperovým NA EX (schválené S1). | R | nechať | Bez zmeny. |
| Šarlatán | Dlh, Povera×2 / Cig, Pohorš → **Dlh, Povera×2 / Cig, Pohorš, Pečeň**; Furt: Viera v okolí platí ako Vízia (slabé, D10). | S | prerobiť (rozhodnuté, 10.1) | Spojka: vpravo + Pečeň (6 akcií); nový Furt: aktívna Pečeň v jeho okolí sa ráta aj ako Viera (zázračná tinktúra) — vzor ako dnes vieraAkoVizia (partia.ts:529). |
| Podvodník | Cig×2, Dlh / Obmedz, Rana; Prehra: ukradni 2 cigarety (slabé, D11). | R | prerobiť (rozhodnuté, 10.1) | Prehra: jeden tvoj priznaný Dlh prepíšeš na súpera — Dlh dostane zuby. |
| Záhradkár | Cig×2, Pečeň / Poldeci, Rana, Robota; Exekúcia: zahoď ho namiesto špakov (mŕtve). | S | prerobiť (rozhodnuté, 10.1) | Spojka (6 akcií ostáva); nový efekt Výhra: otoč vypitý poldeci na plný (pálenka z vlastnej úrody). |
| Anonymný alkoholik | Odpor, Robota / Dlh, Viera; Furt: tvoje NA EX naňho mimo limitu (Placatka, schválené). | R | nechať | Bez zmeny. |
| Presbiter | Pohorš, Povera / Rana, Viera; Bitka: sám v kraji uberie súperovi Vieru. | R | nechať | Bez zmeny. |
| Dvojčatá | Dlh, Rana / Cig, Rana → **Dlh, Pecka / Pečeň, Rana**; Furt: do prevahy za dvoch. | R | prerobiť (rozhodnuté, 10.1) | Rana → Pecka vľavo, Cigareta → Pečeň vpravo (bijú a pijú za dvoch). |
| Šofér | Poldeci, Rana / Cig, Pečeň; Furt: NA EX na suseda nezdvojí neaktívne (slabé, dvojsečné). | R | prerobiť (rozhodnuté, 10.1) | Nový efekt Bitka: ak si v tomto kole nedal NA EX, udelíš Pecku navyše (triezvy šofér; menej nerestí = riziko Absťáku). Jadro má naexVKole (engine.ts:333). |
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
| Poľovnícka chata | — → **Posil, Petelica, Dlh, Pecka / Rana, Petelica, Pečeň, Pohorš**; **Furt: Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát.** | LP | nová (pinnacle, rozhodnuté) | Premenovaná z Poľovníckeho zámočka; strop ×2 len na tuhé (otázka 8). `[Posil Petelica Dlh Pecka] / [Rana Petelica Pečeň Pohorš]`. Korupcia: obálka za trofejou, autá s modrými majákmi, ulovený chránený medveď. |
| Predsedova vila | — → **Cig, Pecka×2, Dlh / Posil, Petelica, Dlh, Viera**; **Kšeft: Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole k súperovi alebo k sebe (nie staršieho v súperovom patronáte tohto kola).** | LP | nová (pinnacle, rozhodnuté) | `[Cig Pecka Pecka Dlh] / [Posil Petelica Dlh Viera]` (Obmedzenie → Dlh). Korupcia: sprivatizovaná vila predsedu JRD, traktor s krokodílom na kapote, bonboniéra s bankovkami. |
| Herňa | — → **Pecka, Petelica, Pečeň, Dlh / Rana, Pecka, Robota, Dlh**; **Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov.** | LP | nová (pinnacle, rozhodnuté) | Premenovaná z Agroareálu z eurofondov; bez stropu (Michal), kraje pri automatoch / v zadnej miestnosti na potvrdenie (7.5). `[Pecka Petelica Pečeň Dlh] / [Rana Pecka Robota Dlh]`. Korupcia: starosta a policajt nad kopou bankoviek v zadnej miestnosti, „licencia“ v zlatom ráme, SUV s majákom. |
| Vybavovač | — → **Cig, Povera, Robota, Posil / Viera, Vízia, Pečeň**; Pitka: za každú kartu, s ktorou tvorí spoj, +1 zadĺženie. | S | nie (rozhodnuté 27. 10.) | Spojka 7 akcií (Cig, Povera, Robota, Posilnenie / Viera, Vízia, Pečeň): všetko vybaví, ale na dlh. |
| Bufetárka | — → **Cig, Poldeci, Pečeň / Viera, Povera, Dlh**; Pitka: každý, koho karta s ňou tvorí spoj, dostane cigaretu. | S | nie (rozhodnuté 27. 10.) | Spojka 6 akcií (Cig, Poldeci, Pečeň / Viera, Povera, Dlh), obslúži aj súpera. |
| Brigádnik | — → **Robota, Cig, Rana / Robota, Pečeň, Obmedz**; Furt: do prevahy sa neráta. | S | nová (rozhodnuté, rezerva ide do sady) | Spojka 6 akcií (Robota, Cig, Rana / Robota, Pečeň, Obmedzenie), Pracujúci pre Družstvo. |
| Hromotĺk | — → **Petelica / Pečeň×2**; Bez efektu. | U | nie (rozhodnuté 27. 10.) | Petelica (len slot 1) / Pečeň×2: bije za troch, pije za dvoch. |
| Mäsiar | — → **Pecka, Pečeň / Pecka, Pečeň**; Bez efektu. | U | nová (rozhodnuté, 10.1) | Pecka, Pečeň / Pecka, Pečeň: zabíjačka so slivovicou od rána. |
| Kulturista | — → **Petelica / Dlh×2**; Bez efektu. | U | nová (rozhodnuté, 10.1) | Petelica / Dlh×2: anaboliká na splátky. |
| Traktoristka | — → **Petelica, Pečeň / Dlh**; Bez efektu. | U | nová (rozhodnuté, efekt Na leasing, 10.1) | Petelica, Pečeň / Dlh: úderníčka z plagátu JRD. |
| Kuchárka | — → **Pecka, Dlh / Pecka, Poldeci**; Bez efektu. | U | nie (rozhodnuté 27. 10.) | Pecka, Dlh / Pecka, Poldeci: naberačka zo školskej jedálne, obedy na dlh. |
| Oslávenec | — → **Poldeci, Cig / Rana**; Kšeft: za plný poldeci naleješ súperovi — v tejto Pitke dostane 2 Pečene. | E | nová (rozhodnuté, 10.1) | Kšeft na plný poldeci (bez neresti a pečene platiteľa); akcie Poldeci, Cig / Rana. |
| Šúľač | — → **Cig, Povera / Vízia**; Kšeft: za 1 špak si dober 2 karty. | E | nie (rozhodnuté 27. 10.) | „Zbav sa špaku“: z tvojich ohorkov ušúľa cigaru; akcie Cig, Povera / Vízia. |

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
| Zastávka | Cig / Pecka; Zhromaždenie: spoločný limit. | L1 | nechať (rozhodnuté) | Úroveň 1, bez zmeny. Hrany `[– Cig – –] / [Pecka – – –]`. |
| Most | Obmedz, Viera / Dlh, Petelica → **Pecka / Cig**; Len na vlastnú stranu. | L1 | prerobiť (rozhodnuté) | Úroveň 1: hrany 2/2 → 1/1 `[– Pecka – –] / [– – Cig –]` (Michal: „Pecka na jednej strane, cigareta na druhej“); efekt ostáva. Obrázok ostáva. |
| Lesná cesta | Pecka / Povera; Bitka: +1 tuhé za telo v súperovom kraji (max 2) → **Bitka: Za každé svoje Zviera v súperovom kraji máš 1 tuhé poškodenie navyše.** | L1 | nový efekt (rozhodnuté) | Úroveň 1, hrany bez zmeny; efekt podľa Michala, „svoje“ a bez stropu na potvrdenie (7.5). |
| Cintorín | Viera / Robota; Prehra: Nástroj do Dedičstva zadarmo. | L1 | nechať (rozhodnuté) | Úroveň 1, bez zmeny. |
| Jednota | Cig / Pohorš; Pitka: barter o 1 lacnejší (mŕtve) → **Kšeft: Za 1 Dlh dostaneš 2 cigarety.** | L1 | nový efekt (rozhodnuté) | Úroveň 1, hrany 1/1 ostávajú; Kšeft smie použiť každý hráč raz za Pitku. Obrázok ostáva. |
| Ihrisko | Rana×2 / Cig, Poldeci → **Rana, Pecka / Cig, Poldeci**; Bitka: +2 tuhé za prevahu v kraji. | L2 | prerobiť (rozhodnuté) | Úroveň 2; `[Pecka – – Rana] / [– Poldeci Cig –]`. |
| Benzínka | Cig×2 / Obmedz, Pecka; Pitka: nikto nefajčí. | L2 | nechať (rozhodnuté) | Úroveň 2, bez zmeny. |
| Kar | Povera, Viera / Poldeci, Rana; Bitka: zahoď nepriznanú Cirhózu (takmer mŕtve, D4) → **Pitka: Doliatie nestojí cigarety, ale každé ti pridá 1 poškodenie pečene.** | L2 | nový efekt (rozhodnuté) | Úroveň 2, hrany ostávajú; nerest za doliatie na potvrdenie (7.5). |
| Zberný dvor | Cig, Petelica, Robota / Dlh, Obmedz, Pohorš → **Petelica, Robota / Dlh, Obmedz**; → **Kšeft: Za 1 cigaretu si vezmi do ruky ľubovoľnú kartu zo svojho odhadzovacieho balíčka.** | L2 | prerobiť (rozhodnuté) | Úroveň 2: hrany 3/3 → 2/2 `[– Robota – Petelica] / [– Dlh – Obmedz]`; spúšťač Pitka → Kšeft (Michal). |
| Krčma | Pecka, Poldeci, Rana / Cig, Dlh, Povera → **Petelica, Dlh / Rana×2**; Pitka: povinné NA EX, prah Cirhózy +2. | L2 | prerobiť (rozhodnuté) | Úroveň 2: hrany 3/3 → 2/2 `[Petelica – Dlh –] / [Rana Rana – –]` (Michal: „Petelica, Dlh / Rana, Rana“); efekt ostáva. |
| Obecný úrad | Robota, Viera / Pecka, Povera → **Robota, Viera, Obmedz / Pecka, Povera, Dlh**; Bitka: prah Exekútora −4, Robota páli 2 Dlhy → **Bitka: Každá aktívna Robota spáli 2 priznané Dlhy.** | L3 | prerobiť (rozhodnuté) | Úroveň 3: hrany 2/2 → 3/3 `[– Robota Viera Obmedz] / [Pecka Dlh Povera –]`; prah −4 zaniká (Michal). Nový obrázok (7.4). |
| Kultúrny dom | Pohorš×2, Pečeň / Cig, Rana, Viera → **Pohorš×2, Pečeň / Cig, Pecka, Viera**; Bitka: prebytok do špakov. | L3 | prerobiť (rozhodnuté) | Úroveň 3; `[Pohorš – Pohorš Pečeň] / [Pecka Cig Viera –]`, efekt ostáva. Nový obrázok (7.4). |
| Vínna pivnica | Poldeci / Pecka → **Poldeci, Pečeň, Posil / Pecka, Rana, Cig**; Pitka: NA EX až 2×. | L3 | prerobiť (rozhodnuté) | Úroveň 3: hrany 1/1 → 3/3 `[Pečeň Poldeci Posil –] / [Rana Pecka Cig –]`; efekt ostáva. Nový obrázok (7.4). |
| Družstvo | Poldeci, Rana, Robota / Obmedz, Odpor, Pohorš; Zhromaždenie: Pracujúci nemíňajú limit. | L3 | nechať (rozhodnuté) | Úroveň 3, hrany aj efekt ostávajú. Nový obrázok (7.4). |
| Kostol | Viera, Vízia / Pohorš, Povera → **Viera, Vízia, Robota / Pohorš, Povera, Viera**; Nikto nepije ani nedá NA EX. | L3 | prerobiť (rozhodnuté) | Úroveň 3: hrany 2/2 → 3/3 `[Robota Viera Vízia –] / [– Pohorš Povera Viera]`; efekt ostáva. Nový obrázok (7.4). |
| Poľovnícka chata | — → **Posil, Petelica, Dlh, Pecka / Rana, Petelica, Pečeň, Pohorš**; **Furt: Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát.** | LP | nová (pinnacle, rozhodnuté) | Premenovaná z Poľovníckeho zámočka; strop ×2 len na tuhé (otázka 8). `[Posil Petelica Dlh Pecka] / [Rana Petelica Pečeň Pohorš]`. Korupcia: obálka za trofejou, autá s modrými majákmi, ulovený chránený medveď. |
| Predsedova vila | — → **Cig, Pecka×2, Dlh / Posil, Petelica, Dlh, Viera**; **Kšeft: Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole k súperovi alebo k sebe (nie staršieho v súperovom patronáte tohto kola).** | LP | nová (pinnacle, rozhodnuté) | `[Cig Pecka Pecka Dlh] / [Posil Petelica Dlh Viera]` (Obmedzenie → Dlh). Korupcia: sprivatizovaná vila predsedu JRD, traktor s krokodílom na kapote, bonboniéra s bankovkami. |
| Herňa | — → **Pecka, Petelica, Pečeň, Dlh / Rana, Pecka, Robota, Dlh**; **Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov.** | LP | nová (pinnacle, rozhodnuté) | Premenovaná z Agroareálu z eurofondov; bez stropu (Michal), kraje pri automatoch / v zadnej miestnosti na potvrdenie (7.5). `[Pecka Petelica Pečeň Dlh] / [Rana Pecka Robota Dlh]`. Korupcia: starosta a policajt nad kopou bankoviek v zadnej miestnosti, „licencia“ v zlatom ráme, SUV s majákom. |

### Štartové a kliatby

| Karta | Dnes (akcie; efekt) | Typ | Verdikt | Smer |
|---|---|---|---|---|
| Pijan | Dlh, Pečeň / Poldeci, Pečeň, Rana; Bitka: Žena s aktívnym Poldeci pri ňom → súper ti dá Ranu. | Š | po ULTRA | Poznámka: jediný štartový úderník s pečeňou, vzor dilemy; rozhodne sa s rodinou. |
| Milujúca manželka | Dlh, Viera / Odpor, Povera; Furt: Absťák aj pri rovnakom počte nerestí. | Š | po ULTRA | Poznámka: návrh „odvedie ťa domov“ čaká na ULTRA. |
| Miňištrant | Pečeň, Viera / Cig, Povera; Výhra: posun prebytkom o 1 drahší. | Š | po ULTRA | Poznámka: návrh „rozhrešenie“ čaká na ULTRA. |
| Dievčina na vydaj | Dlh×2 / Pohorš, Povera; Bitka: zahodí sa a spáli Dlhy podľa akcií. | Š | po ULTRA | Poznámka: návrh „veno“ čaká na ULTRA. |
| Dlh | — / —; Priznaný: Exekútor, Povery, remíza. | K | pravidlo | Mimo revízie kariet; zuby mu dajú Jednota, Herňa, Podvodník, Policajtka a otázka prahu Exekútora (v7). |
| Cirhóza | — / —; Priznaná +1 tuhé súperovi, nepriznaná −5 špakov. | K | pravidlo | Mimo revízie — je to cena celej pečeňovej osi. |
| Absťák | — / —; −1 tuhé, remíza, špaky víťaza. | K | pravidlo | Mimo revízie. |

## 4. Novinky

| Karta | Typ | Jedna veta |
|---|---|---|
| ~~Vybavovač~~ (odpadá 27. 10.) (Občan · Chlap) | S | Každého pozná, všetko vybaví, ale na dlh. 7 akcií (Cig, Povera, Robota, Posilnenie / Viera, Vízia, Pečeň). *Pitka: Za každú kartu, s ktorou tvorí spoj, ti pribudne 1 zadĺženie.* |
| ~~Bufetárka~~ (odpadá 27. 10.) (Občan · Pracujúci · Žena) | S | Obslúži každého, aj súpera. 6 akcií (Cig, Poldeci, Pečeň / Viera, Povera, Dlh). *Pitka: Každý hráč, ktorého karta s ňou tvorí spoj, dostane 1 cigaretu.* |
| **Brigádnik** (Občan · Pracujúci · Chlap) — rezerva, ide do sady | S | Prišiel na sezónu, v dedine ho nikto nepočíta. 6 akcií (Robota, Cig, Rana / Robota, Pečeň, Obmedzenie). *Furt: Do prevahy sa neráta.* |
| ~~Hromotĺk~~ (odpadá 27. 10.) (Občan · Chlap) | U | Bije za troch, pije za dvoch: Petelica (len slot 1) / Pečeň ×2, bez efektu. |
| **Mäsiar** (Občan · Pracujúci · Chlap) | U | Zabíjačka so slivovicou od rána: Pecka, Pečeň / Pecka, Pečeň, bez efektu. |
| **Kulturista** (Občan · Influencer · Chlap) | U | Anaboliká na splátky: Petelica / Dlh ×2, bez efektu. |
| **Traktoristka** (Občan · Pracujúci · Žena) — efekt Na leasing (10.1) | U | Úderníčka z plagátu JRD, čo prežila aj družstvo: Petelica, Pečeň / Dlh, bez efektu. |
| ~~Kuchárka~~ (odpadá 27. 10.) (Občan · Pracujúci · Žena) — rezerva | U | Naberačka zo školskej jedálne, obedy na dlh: Pecka, Dlh / Pecka, Poldeci, bez efektu. |
| **Oslávenec** (Občan · Závislý · Chlap) — **Kšeft na plný poldeci** | E | Má päťdesiat a odmietnuť sa nedá. *Kšeft: Za plný poldeci naleješ súperovi — v tejto Pitke dostane 2 poškodenia pečene.* Platí sa bez neresti a bez pečene platiteľa (Michal). Akcie Poldeci, Cig / Rana. |
| ~~Šúľač~~ (odpadá 27. 10.) (Občan · Závislý · Chlap) | E | Z tvojich ohorkov ušúľa cigaru a prezradí, čo príde. *Kšeft: Za 1 špak si dober 2 karty.* Akcie Cig, Povera / Vízia. |

Kódom treba Brigádnika, Oslávenca (Kšeft v7) a Traktoristku (10.1). Úderníci sú bez efektu, stačia im dáta.

## 5. WAU komba (všetky potrebujú 3 karty a viac ťahov)

Strany: na tvojej strane je vnútorná hrana karty jej pravá (§6 :225–229). Násobky sa násobia (§7 :459–462).

1. **Kulturista na NA EX pri Silnej žene — 12 tuhé.** Hromotĺk odpadol 27. 10., rovnaký tvar má Kulturista (Petelica sama na slote 1, Dlh ×2 vnútri). Silná žena pri lokalite, Kulturista za ňou, tvoje NA EX zruší jeho aktívne Dlhy a zdvojí Petelicu, Silná žena znova: **3 × 2 × 2 = 12**. Cena len 1 pečeň za NA EX — to je NA EX automat z playtestu, merať. Protihra: súperova odpoveď spáruje Petelicu a NA EX ju zruší; na Moste nie.
2. **Dezinformátor — 14 tuhé.** Praudovravec pri lokalite, Hasič za ním (Petelica proti Odporu Praudovravca: Odpor sa ráta ako Posilnenie, ×2), Silná žena za Hasičom (jeho aktívne ×2). Petelica **3 × 2 × 2 = 12**, Rana ×2 = 2. Cena: Posilnenie Hasiča trafí Dlh Silnej ženy, dostaneš 2 zadĺženia za Pitku, teda Dlh. Treba správne varianty, preto zriedka.
3. **Kôň, Puška, Zámočník — 12 tuhé** (oprava zo 16). Kôň pri lokalite, Puška (Pecka / Petelica na slotoch 2–3), Zámočník za ňou. Petelica na Posilnení Koňa (slot 2) ×2, Zámočník ×2: **12**, +1 Rana Koňa z hrany. Pecka Pušky sa s vlastným Zámočníkom (sloty 0–1) nespáruje; „otočený“ Zámočník by bol súperova karta. So Silnou ženou namiesto Zámočníka **16** (Pecka na jej Dlhu ×2 = 4, 1 zadĺženie). Bez stropu (otázka 5, rozhodnuté), merať.
4. **Povinná runda na Krčme — 12 a viac.** V kraji pri výčape máš prevahu (Dvojčatá sa rátajú za dvoch) a hrana dá Petelicu (3, Krčma úrovne 2). V línii Veterán (Petelica) a Svokra. Súper musí dať NA EX (§15). Zlá možnosť: na svoju kartu, ktorej zruší akcie. Horšia: na tvojho Veterána, ten zdvojí aktívne (Petelica 6, aj tvoju Pečeň), a Varecha ti pridá Ranu. Spolu **3 + 6 + 1 = 10**, s Peckou Svokry 12.
5. **Oslava u Kohúta — súper pije, ty platíš.** Kohút (aspoň 2 Pitky), podstrčený Lievik pri súperovom Občanovi (jeho Pečeň ×2 pripadne súperovi, §12 :947–950) a Oslávenec. Za Pitku dostane súper 2 + 2 = 4 Pečene, za 2 Pitky 8, teda **2 Cirhózy** (prah 3). Každú buď prizná (ty +1 tuhé v každej ďalšej bitke), alebo riskuje −5 špakov. Stojí ťa to 2 plné poldeci (limit −2). Úplná protihra: Nealko (prah 5).
6. **Tichá spojka — 6 tuhého bez NA EX** (Vybavovač odpadol). Traktoristka pri lokalite, Veštica, Puška. Pravá strana Veštice má sloty 0–2 plné, takže Petelica Traktoristky (slot 1–2) sa zapne vždy: 3. Ľavá strana Veštice má sloty 2–3 plné, takže Petelica Pušky sa zapne vždy: 3. Cena: 1–2 pečene a Dlh Traktoristky z hrany. S Peckou z leasingu Traktoristky 8.
7. **Praudovravec · Recidivista · Silná žena — 6 až 14 tuhého** (+1 Rana za každého Zahraničného u súpera). Petelica Recidivistu na ľavej strane Praudovravca vždy, na Odpore ×2, Silná žena ×2. Cena: Dlhy Recidivistu a Silnej ženy sa spárujú a ona zdvojí jeho, 6 zadĺžení = 3 Dlhy za Pitku.
8. **Brigáda na Družstve — 7 tuhého bez limitu.** Traktoristka · Mäsiar · Brigádnik (všetci Pracujúci, na Družstve limit nemíňajú). Cena 3–4 pečene (Cirhóza) a Dlh. S Peckou z leasingu 9.
9. **Exekútor na objednávku** (prah 7 rozhodnutý). Finančná poradkyňa posiela súperovi Dlhy, Výherný automat za jeho podstrčeným Občanom 2 za Pitku, Podvodník po prehre ďalší. Súper je na 7 do 2–3 kôl: zhorí mu polovica Dlhov a rovnako špakov a Povery (Veštica ×2, Šarlatán) bijú do zvyšku. Záhradkár chráni len svojho majiteľa.

## 6. Zlá a horšia možnosť

**Zásada pre každú prerábku a novinku:**
1. **Sila sa platí na tej istej karte.** Úderník platí za tuhé aspoň polovicou v Pečeni alebo Dlhu (Petelica 3 → 2 zlé akcie). Cenu dávaj na tú istú stranu ako útok, nech ju spojka zapne spolu s ním.
2. **Spojka nesie aspoň 1 zlú akciu.** Kto spája, ten aj pije alebo dlží. Posilnenie na spojke zdvojí aj zlú akciu.
3. **Silný efekt stojí menu** (Kšeft: cigarety, poldeci, Dlh, špak) **alebo nerest**, alebo má protihru v sade. Samotné cigarety bolia málo, preto drahé veci platia poldeci, Dlhom či špakom.
4. **Druhá strana nesie riziko pre súpera.** Pečeň a Dlh na voľnej hrane súper zapne podstrčením alebo odpoveďou (Hromotĺk, Vínko, Lievik, Kočovník).

| Karta | Sila | Cena (zlá vs. horšia) |
|---|---|---|
| Traktoristka, Kulturista, Mäsiar | Petelica alebo 2 Pecky | 2 Pečene alebo Dlhy za Pitku, pri 2 Pitkách dvojnásobok |
| Veterán + NA EX | Petelica 6 | NA EX zdvojí aj jeho Pečeň a Poldeci, takže Cirhóza je takmer istá |
| Kočovník | Pecka tomu, kto má prevahu v kraji | tomu istému aj 2 Pečene a Dlh. Vyhrať kraj = aj piť |
| Spojky (Veštica, Šarlatán, Brigádnik…) | zapnú susedov | zapnú aj vlastný Dlh a Pečeň |
| Šofér | Pecka navyše | len bez NA EX, teda menej nerestí a bližšie k Absťáku |
| Kar | doliatie zadarmo | každé doliatie +1 Pečeň |
| Jednota | 2 cigarety | Dlh |
| Obecný úrad | Robota páli 2 Dlhy | Dlh na chodbe v každej zo 4 Pitiek |
| Oslávenec | súper +2 Pečene | tvoj plný poldeci (limit −1) |
| Záhradkár | tvoj prah Exekútora +2 | len v kole, keď leží v línii; sám pije a fajčí |
| Traktoristka (Na leasing) | Pecka navyše pri prevahe v jej kraji | inak Dlh |
| Kapybara (2 cigarety) | súper −1 špak | 2 cigarety za Pitku |
| Krčma (povinné NA EX) | prah Cirhózy +2 | NA EX na vlastnú kartu, alebo do súperovho Veterána či Svokry |
| Výherný automat | Výhra 3 cigarety | Prehra 2 Dlhy |


## 7. Lokality podľa úrovní — rozhodnuté znenie

> Michal: „Budú lokality úrovne 1 — budú mať po stranách 1 akciu, úrovne 2 a 3 — budú mať 2 a 3 akcie, a potom budú pinnacle lokality, tie budú mať akcie 4, väčšinu z nich silné… dávkovať postupne… pre finále pôjde lokalita pinnacle, čiže hráč nemusí dávať prvý svoju kartu občana.“
> „Hráči si budú vyberať zo všetkých lokalít v hre danej úrovne… aspoň 3 lokality každej úrovne a 3 pinnacle… prvé lokality najspodnejší spodok ako zastávka, most… posledné honosné miesta, kde dedinská šľachta sídli… Na pinnacle lokalitách chcem, aby bolo vidno známky korupcie. Efekty pinnacle silné.“

**Rozhodnuté Michalom 27. 10. 2026** nad dávkou `revizia-lokality.html`. Všetko je Áno okrem piatich variantov (Most, Lesná cesta, Zberný dvor, Krčma, Obecný úrad) a dvoch premenovaní (Poľovnícky zámoček → **Poľovnícka chata**, Agroareál z eurofondov → **Herňa**). Ďalej rozhodol: finále **bez** pevných 3 Pitiek (otázka 7), strop Poľovníckej chaty **áno** (otázka 8), **18 lokalít** (otázka 10). „Autobus“ (otázka 9) **padá**. Michalove vety sú uhladené do jazyka pravidiel, ich význam sa nemení. Detaily, ktoré dopovedal Vymyselník, sú v 7.5 označené **na potvrdenie** a pri každom je odporúčanie.

### 7.1 Úroveň = počet akcií na hrane

Úroveň nie je nové pole v dátach. Je to počet akcií na každej hrane (1 / 2 / 3 / 4) a tvorca len overí, že obe hrany majú rovnako. Pitiek je **1 + menší z počtov aktívnych akcií hrán** (§7 :469). Platí to pre všetky lokality vrátane pinnacle vo finále (otázka 7), takže úroveň určuje strop Pitiek a s ním aj strop špakov za bitku (§9.4).

| Úroveň | Akcií na hrane | Pitiek | Charakter | Lokality |
|---|---|---|---|---|
| **1** | 1 / 1 | 1–2 | spodok | Zastávka, Most, Lesná cesta, Cintorín, Jednota |
| **2** | 2 / 2 | 1–3 | dedina | Ihrisko, Benzínka, Kar, Zberný dvor, Krčma |
| **3** | 3 / 3 | 1–4 | sídla dedinskej šľachty | Obecný úrad, Kultúrny dom, Vínna pivnica, Družstvo, Kostol |
| **Pinnacle** | 4 / 4 | 1–5 | korupcia na očiach | Poľovnícka chata, Predsedova vila, Herňa (nové) |

Spolu **18 lokalít** (5 + 5 + 5 + 3). Všetky tri pinnacle majú hrany 4/4 bez blokovaného slotu, teda **1 až 5 Pitiek**. Presný počet určí, koľko akcií hrán prvé karty zapnú (najviac 5 Pitiek, keď sú na oboch stranách aktívne všetky štyri).

### 7.2 Výber cieľa a dávkovanie

**Dnes** (§5 :168–172, §3 :115–117): pri príprave sa náhodne vyžrebuje 3 / 5 / 7 lokalít (`engine.ts:1140–1150`). Obranca z nich vyberie cieľ a natočí ho. Vo finále sa cieľ nevyberá.

**Rozhodnuté:**
- **Žrebovanie zaniká.** Kolo *k* má úroveň podľa rozpisu a **obranca vyberá zo všetkých ešte neodohraných lokalít tej úrovne** v sade a natočí ju. Rozpis vidia obaja od začiatku.
- **Finále dostáva cieľ.** Pinnacle vyberá a natáča obranca, teda hráč s **menej** špakmi (útočí ten s viac, pri rovnosti ako dnes, §14b :1069). Je to dobiehanie.

| Dĺžka | Rozpis | Najviac Pitiek (= špakov víťazovi) | Kôl jednej úrovne |
|---|---|---|---|
| krátka (3) | 1 · 2 · 3 · P | 2 · 3 · 4 · 5 | 1 z 5 |
| **stredná (5)** | **1 · 2 · 2 · 3 · 3 · P** | 2 · 3 · 3 · 4 · 4 · 5 | 2 z 5 |
| dlhá (7) | 1 · 1 · 2 · 2 · 3 · 3 · 3 · P | 2 · 2 · 3 · 3 · 4 · 4 · 4 · 5 | 3 z 5 |

Obranca má vždy na výber aspoň z 3 lokalít, aj v poslednom kole úrovne 3 v dlhej hre (5 − 2 = 3), a vo finále z 3 pinnacle. Prečo stúpanie: balíček rastie, neskoršie bitky dávajú viac špakov (dobiehanie) a dilema s Pečeňou a Kšeftami, ktoré sa platia za Pitku, vrcholí na konci.

### 7.3 Finále s pinnacle

- **Pravidlo „prvá karta = stred“ zaniká.** V strede leží pinnacle a útočník len vykladá prvý ako v každom kole (`stredFinale`, `engine.ts:331`, :2094).
- **Kraje a prevaha platia aj vo finále.** Kočovník, Presbiter aj Dvojčatá fungujú ako v každom kole. Z textov Kočovníka („Vo finále majiteľovi.“) a Presbitera („Vo finále nepôsobí.“) sa veta o finále zmaže (dáta).
- **Pitky vo finále: rovnaké pravidlo ako na každej lokalite** (Michal, otázka 7). Platí 1 + menší z počtov aktívnych akcií hrán, pri pinnacle teda 1–5. `KONSTANTY.FINALE_PITKY` (`constants.ts:87`) a finálová vetva v `pocetPitiek` (`engine.ts:1441`) zanikajú. Víťaz finále dostane toľko špakov, koľko Pitiek sa odohralo (§9.4 ako v každom kole), mínus rozdiel Absťákov, aspoň 1. Sekera vo finále špaky prepadá ako dnes.
- Po finále sa prebytok dáva do špakov ako dnes (`engine.ts:3960`). Na nástenke má finále lokalitu (§14 :1055).

### 7.4 Rozhodnuté znenie lokalít

Hrany sú zapísané po slotoch 0–3 zhora nadol (§2 :58), „–“ je blokovaný slot. Pri natočení sa poradie obráti (0↔3, 1↔2, §6 :258). Ľavá / pravá hrana je vytlačená hrana; v zátvorke sú kraje. Spúšťač **Kšeft** (v7) je efekt, ktorý hráč spustí sám v Pitke na svojom ťahu, najviac raz za Pitku. **Kšeft lokality smie použiť každý z hráčov**, každý raz za Pitku (lokalita nemá majiteľa).

#### Úroveň 1 — spodok (1/1)

| Lokalita | Kraje | Hrany (ľavá / pravá) | Efekt | Zmena |
|---|---|---|---|---|
| Zastávka | pod strieškou / pri ceste | `[– Cig – –] / [Pecka – – –]` | **Zhromaždenie:** Obaja hráči majú spoločný limit vykladania — súčet ich limitov. | bez zmeny |
| **Most** | pri kaplnke / pod mostom | `[– Pecka – –] / [– – Cig –]` | **Zhromaždenie:** Karty sa smú vykladať len na vlastnú stranu (aj odpoveď na NA EX). | hrany 2/2 → 1/1 (Michal: „Pecka na jednej strane, cigareta na druhej“) |
| **Lesná cesta** | v húštine / pri kríži | `[Pecka – – –] / [– Povera – –]` | **Bitka:** Za každé svoje Zviera v súperovom kraji máš 1 tuhé poškodenie navyše. | nový efekt (Michal), detail 7.5 |
| Cintorín | pri hroboch / pri márnici | `[– Viera – –] / [– Robota – –]` | **Prehra:** Po Pohrebe smieš vyložiť jeden Nástroj z ruky do Dedičstva bez platenia. | bez zmeny |
| **Jednota** | pri pulte / pred obchodom | `[– Cig – –] / [– Pohorš – –]` | **Kšeft:** Za 1 Dlh dostaneš 2 cigarety. | nový efekt („na sekeru“) |

#### Úroveň 2 — dedina (2/2)

| Lokalita | Kraje | Hrany (ľavá / pravá) | Efekt | Zmena |
|---|---|---|---|---|
| **Ihrisko** | na trávniku / na tribúne | `[Pecka – – Rana] / [– Poldeci Cig –]` | **Bitka:** V každom kraji, kde máš viac svojich Občanov, Zvierat a Starešinov než súper, máš 2 tuhé poškodenia navyše. | Rana na slote 0 → Pecka |
| Benzínka | pri pokladni / za budovou | `[– Cig Cig –] / [Obmedz – – Pecka]` | **Pitka:** Nikto nesmie fajčiť. | bez zmeny |
| **Kar** | pri vdove / pri koláčoch | `[– Viera Povera –] / [– Poldeci Rana –]` | **Pitka:** Doliatie nestojí cigarety, ale každé ti pridá 1 poškodenie pečene. | nový efekt, detail 7.5 |
| **Zberný dvor** | pri váhe / za plotom | `[– Robota – Petelica] / [– Dlh – Obmedz]` | **Kšeft:** Za 1 cigaretu si vezmi do ruky ľubovoľnú kartu zo svojho odhadzovacieho balíčka. | hrany 3/3 → 2/2, spúšťač Pitka → Kšeft (Michal) |
| **Krčma** | pri výčape / pri dverách | `[Petelica – Dlh –] / [Rana Rana – –]` | **Pitka:** Ak máš plný poldeci a máš ho kam dať, musíš dať NA EX. Prah Cirhózy je tu o 2 vyšší. | hrany 3/3 → 2/2 (Michal: „Petelica, Dlh / Rana, Rana“) |

#### Úroveň 3 — sídla dedinskej šľachty (3/3)

| Lokalita | Kraje | Hrany (ľavá / pravá) | Efekt | Zmena |
|---|---|---|---|---|
| **Obecný úrad** | v kancelárii / na chodbe | `[– Robota Viera Obmedz] / [Pecka Dlh Povera –]` | **Bitka:** Každá aktívna Robota spáli 2 priznané Dlhy. | hrany 2/2 → 3/3; prah Exekútora −4 zaniká (Michal) |
| **Kultúrny dom** | na parkete / pred vchodom | `[Pohorš – Pohorš Pečeň] / [Pecka Cig Viera –]` | **Bitka:** Prebytok sa nerozdeľuje medzi starších. Kto ho drží, dostane toľko špakov, aký je prebytok. | Rana na slote 0 → Pecka |
| **Vínna pivnica** | pri sudoch / na schodoch | `[Pečeň Poldeci Posil –] / [Rana Pecka Cig –]` | **Pitka:** Každý hráč smie dať NA EX až dvakrát. | hrany 1/1 → 3/3 |
| Družstvo | na poli / na schôdzi | `[Robota Poldeci – Rana] / [Obmedz Pohorš Odpor –]` | **Zhromaždenie:** Karty s tagom Pracujúci nemíňajú limit vykladania. | bez zmeny (len obrázok) |
| **Kostol** | pri oltári / pri vchode | `[Robota Viera Vízia –] / [– Pohorš Povera Viera]` | **Zhromaždenie:** Nikto nesmie vypiť. **Pitka:** Nikto nesmie dať NA EX. | hrany 2/2 → 3/3 |

#### Pinnacle — korupcia na očiach (4/4, len vo finále, 1–5 Pitiek)

| Lokalita | Kraje | Hrany (ľavá / pravá) | Efekt |
|---|---|---|---|
| **Poľovnícka chata** | pri trofejach / na posede | `[Posil Petelica Dlh Pecka] / [Rana Petelica Pečeň Pohorš]` | **Furt:** Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát. |
| **Predsedova vila** | pri bazéne / v pracovni | `[Cig Pecka Pecka Dlh] / [Posil Petelica Dlh Viera]` | **Kšeft:** Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole k súperovi alebo k sebe. Marker staršieho, ktorého si súper v tomto kole vzal do patronátu, takto posunúť nesmieš. |
| **Herňa** | pri automatoch / v zadnej miestnosti | `[Pecka Petelica Pečeň Dlh] / [Rana Pecka Robota Dlh]` | **Bitka:** Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov. |

- **Poľovnícka chata:** strop je rozhodnutý (otázka 8), ×2 platí len pre tuhé z hrán, nie pre Dlh, Pečeň, Posilnenie ani Pohoršenie. Tuhé z hrán: pri trofejach 5, na posede 4, po ×2 je to 10 a 8, teda **až 18**, ak má jeden hráč prevahu v oboch krajoch a prvé karty trafia všetky sloty. Bežne asi 5 na kraj. Ceny sa nezdvojujú. Kraj „v trofejovej sieni“ je po premenovaní na chatu **pri trofejach**.
- **Predsedova vila:** pri 1–5 Pitkách je to najviac 5 úplatkov na hráča (10 cigariet). Posun je ako pri Pohoršení (§9.2), len za cigarety, a zmení strach hneď, teda aj špaky po finále (krok 4b). Výnimka pre patronát chráni jedinú odpoveď na vydesenie (§10 :808–811, :826–828).
- **Herňa:** priznané Dlhy porazeného sa rátajú v kroku 4a, teda po Exekútorovi a Robote (krok 1). Pri sekere nedostane nikto nič. Robota v zadnej miestnosti je štít, držiteľovi kraja spáli Dlh ešte pred počítaním. Dlh je na oboch hranách, takže kto drží kraj a prehrá, platí dvakrát. Michalovo znenie je **bez stropu** (návrh mal „najviac 5“). Prirodzený strop dáva Exekútor: pri prahu 10 zhorí polovica Dlhov, takže porazenému ich po kroku 1 ostane najviac 9 (7.5).

**Ilustrácie** (gradácia spodok → šľachta → korupcia; bez textu; dym len z cigarety, popolníka alebo úst, `tools/admin/styl.md`):
- Bez nového obrázka: Zastávka, Most (už dnes spodok: starec na zábradlí, pneumatika, fľaše, tabuľka EÚ), Lesná cesta, Cintorín, Jednota, celá úroveň 2.
- **Nové, úroveň 3:** *Obecný úrad*: zrekonštruovaná budova, zlaté kľučky, čierne SUV na vyhradenom mieste, tučný úradník so zlatou reťazou v okne, rad ľudí na chodbe; nikto nefajčí. *Kultúrny dom*: po rekonštrukcii z dotácie, tabuľka s hviezdami EÚ, dnu VIP stôl s bielym obrusom, dedina vonku na rozheganých stoličkách. *Vínna pivnica*: súkromná pivnica papalášov, mramor, sudy s mosadznými štítkami, hostia z okresu so zlatými hodinkami, poháre stoja na stole. *Družstvo*: kancelária predsedu, kožené kreslo, koňak, za oknom rozpadnutý kravín a ľudia na poli; dym len z cigary v ústach predsedu. *Kostol*: pozlátená veža a oltár, nové čierne auto pred farou, nová kasička „na opravu strechy“.
- **Nové, pinnacle:** *Poľovnícka chata*: luxusná zrubová chata v lese, parožie na stenách, papaláši v lodenových kabátoch pri dlhom stole, obálka s bankovkami zastrčená za trofejou jeleňa, pred chatou terénne autá s modrými majákmi, na zemi ulovený medveď z chránenej oblasti; dym len z cigary v ústach. *Predsedova vila*: sprivatizovaná vila bývalého predsedu JRD, stĺpy a zlaté levy pri bráne, bazén v tvare obličky, predseda v župane so zlatou reťazou, nablýskaný traktor s krokodílom na kapote, bonboniéra plná bankoviek. *Herňa*: dedinská herňa v bývalej požiarnej zbrojnici, rady blikajúcich automatov a vyčerpaní hráči, v zadnej miestnosti pri kartovom stole starosta a policajt v uniforme nad kopou bankoviek, zarámovaná „licencia“ v zlatom ráme (bez čitateľného písma), pred vchodom čierne SUV s modrým majákom; dym len z cigary v ústach.

### 7.5 Na potvrdenie (detaily, ktoré Michal nepovedal)

1. **Lesná cesta, čie Zviera:** text „Za každé svoje Zviera v súperovom kraji“, platí pre oboch hráčov rovnako, ako každý efekt lokality. Rátajú sa len vlastné Zvieratá (vyložené tebou do súperovho kraja), inak by súperovi jeho vlastné Zvieratá v jeho kraji pridávali tuhé tebe. **Odporúčam: len vlastné, obom symetricky.**
2. **Lesná cesta, strop:** Michalovo znenie je bez stropu (dnes „najviac 2“) a Občania ani Starešinovia sa už nerátajú. **Odporúčam bez stropu.** Zvierat je v balíčku málo a na úrovni 1 (1. kolo) ich hráč má zriedka. Treba merať, či efekt na úrovni 1 nie je mŕtvy.
3. **Kar, nerest:** dnes sa nerest za doliatie ráta zo zaplatených cigariet (`engine.ts:2810`), takže doliatie zadarmo by nebolo nerest. **Odporúčam: doliatie na Kari je nerest ako bežné doliatie (2)**, inak bude Kar cesta k Absťáku. S Vínkom v Dedičstve sa nedolieva ani na Kari (§7 :428, `engine.ts:2806`).
4. **Zberný dvor:** Michal vynechal „raz za Pitku“, ale Kšeft je raz za Pitku z definície. Cigareta ostáva nerestou (§8 :515). **Odporúčam ponechať takto.**
5. **Herňa bez stropu:** Michal vynechal „najviac 5“. Beriem to ako zámer, prirodzený strop je 9 (Exekútor). **Odporúčam bez stropu a merať.** Ak bude finále rozhodovať priveľmi, strop 5.
6. **Kraje Herne** sú nové, lebo staré („pri tabuli projektu“, „v prázdnych stajniach“) patrili Agroareálu: **pri automatoch / v zadnej miestnosti**. Na potvrdenie.

### 7.6 Dopad na pravidlá a kód

- **Pravidlá:** §3 (žrebovanie zaniká, podmienka dĺžky = aspoň toľko lokalít každej úrovne, koľko kôl úrovne má rozpis, + 1 pinnacle), §4 :137 (finále: voľba cieľa a 1–5 Pitiek), §5 :168–172 (výber z úrovne, finále s cieľom), §6 :221–222 (finále s lokalitou), §7 :479 („1–4 akcie, 1–5 Pitiek“, veta „Finále má vždy 3 Pitky“ zaniká), §9.4 :626–627 a §14 :1047 („finále 3“ zaniká), §14 :1055, §14b (cieľ, kraje, Pitky), §15 (stĺpec Úroveň, 18 lokalít, nové kraje, nové efekty Lesnej cesty, Jednoty, Karu, Zberného dvora a Obecného úradu), §17 :1172 (Finále).
- **Jadro:** výber lokalít podľa rozpisu namiesto žrebu (`engine.ts:1140–1150`, `DLZKY_HRY`), `chooseLocation` z neodohraných lokalít úrovne (`engine.ts:4381`) aj vo finále, odstrániť `stredFinale` a finálové vetvy (`engine.ts:331`, :2083, :2094, :2169, :4240, :4423, :4450), `FINALE_PITKY` (`constants.ts:87`, `engine.ts:1441`). Efekty: Lesná cesta, Kar, Jednota a Vila (Kšeft v7), Zberný dvor (Pitka → Kšeft), Obecný úrad (bez prahu −4), Poľovnícka chata (×2 tuhého z hrán), Herňa (špaky za Dlhy porazeného).
- **Dáta:** 15 lokalít podľa 7.4, 3 nové pinnacle, texty Kočovníka a Presbitera bez vety o finále.
- **Bot:** výber lokality v rámci úrovne, výber a natočenie pinnacle, finále s krajmi.

### 7.7 Rozpočet akcií na hranách

Dnes 58 akcií na 15 lokalitách. Rozhodnuté: úroveň 1 10, úroveň 2 20, úroveň 3 30, pinnacle 24 (v hre vždy len jedna, 8 akcií).

| Akcia | dnes (15) | úrovne 1–3 (15) | pinnacle (3) | spolu (18) |
|---|---|---|---|---|
| Pecka | 6 | 8 | 5 | **13** |
| Petelica | 2 | 2 | 4 | **6** |
| Rana | 6 | 6 | 2 | 8 |
| Dlh | 3 | 3 | 5 | **8** |
| Poškodenie pečene | 1 | 2 | 2 | **4** |
| Poldeci | 5 | 4 | 0 | 4 |
| Posilnenie | 0 | 1 | 2 | 3 |
| Pohoršenie | 6 | 5 | 1 | 6 |
| Viera | 6 | 6 | 1 | 7 |
| Povera | 5 | 4 | 0 | 4 |
| Robota | 4 | 5 | 1 | 6 |
| Cigareta | 8 | 8 | 1 | 9 |
| Obmedzenie | 4 | 4 | 0 | 4 |
| Vízia | 1 | 1 | 0 | 1 |
| Odpor | 1 | 1 | 0 | 1 |

Úroveň 3 nebije cez hrany, ale cez 4 Pitky. Pinnacle je spojka v strede, každá prvá karta zapne všetky svoje vnútorné akcie, takže finále odmení úderníkov a Posilnenie. Kohút má najväčšiu cenu na úrovni 1 (z 1 Pitky urobí 2) a vo finále platí tiež.

### 7.8 Riziká

1. **Finále váži viac:** až 5 špakov za bitku, k tomu efekt (Herňa bez stropu, Vila až 5 úplatkov) a prebytok do špakov. Cieľ Stratéga: víťaz finále vyhrá 60–75 % partií, nie viac. Merať.
2. **Finále sa dá skrátiť:** keďže Pitky určí pinnacle, hráč, ktorý vedie, môže nespárovať hranu a zrezať finále na 1–2 Pitky. Dobiehanie tým slabne. Merať, koľko Pitiek má finále.
3. **Ceny vo finále:** Cirhóza z finále sa väčšinou nestihne priznať a stojí 5 špakov (§14 :1052). Pečeň na hranách pinnacle (chata na posede, Herňa pri automatoch) sa pri 5 Pitkách ráta až 5×.
4. **Bomba NA EX:** NA EX akcie hrán neruší (§7 :374–376), finále teda rozhodne prevaha v krajoch. Opačná bomba je Vínna pivnica: 2 NA EX za Pitku v až 4 Pitkách.
5. **Vandal** (schválený, v sade zatiaľ nie je) otočí asymetrickú pinnacle. Návrh: pinnacle sa otočiť nedá, alebo to nechať ako WAU (rozhodne sa pri Vandalovi).
6. **Kolo 1 je tiché** (najviac 2 Pitky) a Cintorín aj nová Lesná cesta môžu byť na úrovni 1 skoro mŕtve. Celý rozpis je známy od začiatku, takže ubudne prekvapenie.

### 7.9 Čo zmerať (keď Michal povolí playtest alebo turnaj)

- Pitky podľa úrovne a podiel špakov za bitky a za strach podľa kola.
- Koľko Pitiek má finále, ako často víťaz finále vyhrá partiu a ako často sa vo finále zmení vedenie.
- Tuhé z hrán pinnacle, kto má prevahu vo finále a ktorú pinnacle zaostávajúci volí.
- Bonus Herne (priemer a maximum), úplatky na Vile, Cirhózy vzniknuté vo finále.
- NA EX za Pitku na Vínnej pivnici a Krčme.
- Ktoré lokality obranca v rámci úrovne nevyberá nikdy (mŕtve lokality: Cintorín, Lesná cesta, Kostol, sudy vo Vínnej pivnici).
- Vandal a Kohút podľa úrovne.
- **Výhoda útočníka vo finále** (doplnené 27. 10., dávka 3): v playtestoch v6 vyhral finále vždy útočník, teda hráč s viac špakmi (3 : 0), a hráči to vnímajú ako výhodu, hoci §14b hovorí opak (report 20261027-062058, zistenie O3, `docs/playtesty/20261027-062058.html:639–643`). Pri pinnacle finále (cieľ vyberá a natáča obranca) zmerať, ako často vyhrá útočník a či rozhoduje poradie ťahov, alebo len to, že útočník už vedie.

## 8. Dopad na pravidlá a kód

- Nové pravidlá netreba okrem spúšťača **Kšeft (v7)**, na ktorý už čakajú schválené karty. Oslávenec, Kapybara, Jednota a Predsedova vila ho použijú (Šúľač odpadol).
- Jadro: efekty Šarlatána (vzor `vieraAkoVizia`, `packages/core/src/partia.ts:529`), Šoféra (`naexVKole`, `engine.ts:333`), Obecného úradu (`bitkaMody`, `effects.ts:359`), Karu, Podvodníka, Záhradkára (prah), Výherného automatu, Brigádnika a Traktoristky (10.6). Úderníci sú len dáta.
- Prestávka: zmazať zo zoznamu spúšťačov. Prah Exekútora 7 (rozhodnuté) je zmena pravidiel v7; s Prestávkou zmazať aj spúšťač Exekúcia.
- Bot: hodnota spojky (`bot.ts`, váhy kariet) a Kšefty. Inak bude karty podceňovať ako dnes Praudovravca.
- Štartové karty (Miňištrant, Manželka, Dievčina, aj Pijan) plán nemení. Rozhodnú sa po ULTRA a rozpočet ich ráta v dnešnej podobe.

## 9. Otázky pre Michala

1. **Exekútor:** v7 znížiť prah 10 → 7 (so súperovou priazňou 6/5/4), aby Dlh bolel a ožila priazeň Exekútor? Bez toho ostane Dlh len palivom pre Povery. — **Rozhodnuté 27. 10.:** prah 7, so súperovou priazňou 6 / 5 / 4 (10.4).
2. **Oslávenec:** 2 Pečene za poldeci (silné, merať), alebo 1? — **Rozhodnuté 27. 10.:** 2 pečene.
3. **Kapybara:** potvrdiť cenu 2 cigarety (odporúčanie Admina)? — **Rozhodnuté 27. 10.:** 2 cigarety.
4. **Rezerva:** Brigádnik a Kuchárka áno (56 druhov), alebo nie (54)? — **Rozhodnuté 27. 10.:** Brigádnik áno, Kuchárka nie.
5. **Kombo Kôň + Puška + Zámočník (16 tuhé):** nechať ako vzácne WAU, alebo dať strop (Zámočník nezdvojí akciu, ktorú už zdvojilo Posilnenie)? — **Rozhodnuté 27. 10.:** bez stropu, merať (kombo dá 12, so Silnou ženou 16, 5.3).
6. **Prebytok:** s tuhým asi 6 porastie aj prebytok a vydesenie príde skôr. Stačí to merať v playteste, alebo už do v7 dať brzdu? — Len merať (poznámka v dávke 2a, bez voľby).
7. **Finále:** Pitky pevne 3 aj s pinnacle, alebo 1 + menší počet akcií hrán (1–5)? — **Rozhodnuté 27. 10.:** bez pevných 3, platí pravidlo ako pri každej lokalite (pinnacle 1–5 Pitiek, 7.3).
8. **Poľovnícky zámoček ×2:** nechať bez stropu, alebo zdvojiť len tuhé akcie hrán? — **Rozhodnuté 27. 10.:** strop áno, zdvojujú sa len Rany, Pecky a Petelice z hrán; lokalita sa volá Poľovnícka chata (7.4).
9. **„Autobus“:** Autobusová stanica z eurofondov ako 6. lokalita úrovne 3 (alebo namiesto Kostola), alebo si myslel niečo iné? — **Rozhodnuté 27. 10.:** padá.
10. **Pinnacle navyše:** 3 nové lokality (spolu 18) sú v poriadku, alebo radšej len 15 s povýšením (úrovni 3 by potom chýbala lokalita)? — **Rozhodnuté 27. 10.:** 18 lokalít.

## 10. Ručné karty — rozhodnuté znenie (dávka 2a)

**Rozhodnuté kompletne Michalom 27. 10. 2026** nad dávkou `revizia-karty.html` (dve kolá). Áno: 22 kariet vrátane Kapybary (pri Áno platí plánová verzia, varianty Vymyselníka odpadli; Záhradkár variant A, Traktoristka efekt T1). Nie: Vybavovač, Hromotĺk, Kuchárka, Šúľač, Bufetárka. Otázky: 1 → prah Exekútora **7**, 2 → Oslávenec **2 pečene**, 3 → Kapybara **2 cigarety**, 4 → **Brigádnik áno, Kuchárka nie**, 5 → kombá **bez stropu**, merať, 6 → len merať.

### 10.1 Rozhodnuté znenie

Strany v tvare `cards.json`: akcie a počet, blokované sloty, povolené sloty (0 hore). ‖ oddeľuje ľavú a pravú stranu. „Var.“ je počet rozložení podľa `variants.ts`. Presné JSON je v `plan.json` (`strany`).

| Karta | Typ | Strany (ľavá ‖ pravá) | Var. | Efekt |
|---|---|---|---|---|
| **Puška** | U | Pecka 1 · blok. 0, 1 ‖ Petelica 1 · blok. 0, 1 | 4 | *Dedičstvo: Prebytočné poškodenie, ktoré proti tebe rozdeľuje súper, je o 2 menšie.* |
| **Výherný automat** | E | Robota 1 ‖ Dlh 4 | 4 | *Dedičstvo: Výhra: Dostaneš 3 cigarety. Prehra: Získaš 2 Dlhy.* |
| **Finančná poradkyňa** | S | Dlh 2, Povera 1 · povolené 0–1: Dlh; 2–3: Povera ‖ Cigareta 1, Dlh 1, Obmedzenie 1 · povolené 0–1: Cigareta/Obmedzenie; 2–3: Dlh | 8 | *Pitka: Dlh z jej akcií dostáva súper, nie ty.* |
| **Veštica** | S | Cigareta 1, Vízia 1, Pečeň 1 · povolené 0–1: Vízia; 2–3: Cigareta/Pečeň ‖ Povera 2, Viera 1 · blok. 3 | 12 | *Prehra: Preskúmaj súperov a svoj doberací balík. Vymeň jednu jeho kartu za tvoju a karty vráť.* |
| **Praudovravec** | S | Odpor 1, Povera 1, Viera 1 · blok. 3 ‖ Pohoršenie 1, Povera 1, Vízia 1 · blok. 2 · povolené 0–1: Povera/Vízia; 3: Pohoršenie | 12 | *Furt: Odpor na jeho spojoch neruší, ale posilní — ráta sa ako Posilnenie.* |
| **Niekoho stryná** | S | Poldeci 1, Viera 1, Pečeň 1 · blok. 3 · povolené 0–1: Poldeci/Viera; 2: Pečeň ‖ Povera 1, Viera 1, Vízia 1 · povolené 0: Viera; 1: Povera/Viera; 2–3: Povera/Vízia | 12 | *Nástup: Zahoď 1 Cirhózu alebo 1 Dlh z ruky či z odhadzovacieho balíčka, Dlh aj spomedzi priznaných.* |
| **Veterán** | R | Poldeci 1, Pečeň 1 · blok. 2, 3 ‖ Odpor 1, Petelica 1 · blok. 0 · povolené 1: Odpor; 2–3: Petelica | 4 | *Furt: NA EX na neho jeho aktívne akcie nezruší, ale zdvojí. Neaktívne nezdvojí.* |
| **Recidivista** | U | Dlh 2 · blok. 0, 3 ‖ Petelica 1, Rana 1 · povolené 0–1: Petelica; 2–3: Rana | 4 | *Bitka: Za každého zahraničného občana v súperovej partii udelí dodatočnú ranu.* |
| **Liberál** | R | Pohoršenie 1, Viera 1 · blok. 2, 3 ‖ Cigareta 1, Povera 1 · blok. 0, 1 | 4 | *Furt: Ak je v tvojej partii rovnako žien a chlapov, jeho akcie sa rátajú dvakrát.* |
| **Živnostník** | S | Dlh 1, Odpor 1, Robota 1 · povolené 0–1: Odpor/Robota; 2–3: Dlh ‖ Cigareta 2, Pečeň 1 · povolené 0–1: Cigareta; 2–3: Pečeň | 8 | *Výhra: Zahoď jedno súperovo dedičstvo.* |
| **Kočovník** | R | Dlh 1, Pečeň 1 · blok. 0, 3 ‖ Cigareta 1, Pečeň 1, Pecka 1 · blok. 3 · povolené 0: Cigareta; 1–2: Pecka/Pečeň | 4 | *Furt: Jeho akcie sa počítajú hráčovi, ktorý má v jeho kraji prevahu.* |
| **Šarlatán** | S | Dlh 1, Povera 2 · blok. 3 ‖ Cigareta 1, Pohoršenie 1, Pečeň 1 · blok. 3 · povolené 0–1: Cigareta/Pohoršenie; 2: Pečeň | 6 | *Furt: Každá aktívna akcia Poškodenie pečene na ňom a na kartách v jeho okolí sa ráta aj ako Viera.* |
| **Podvodník** | R | Cigareta 2, Dlh 1 · povolené 0–1: Cigareta; 2–3: Dlh ‖ Obmedzenie 1, Rana 1 · blok. 0 · povolené 1: Obmedzenie; 2–3: Rana | 4 | *Prehra: Jeden tvoj priznaný Dlh sa presunie medzi súperove priznané.* |
| **Záhradkár** | S | Cigareta 2, Pečeň 1 · povolené 0–1: Cigareta; 2–3: Pečeň ‖ Poldeci 1, Rana 1, Robota 1 · povolené 0–1: Poldeci/Rana; 2–3: Robota | 8 | *Bitka: Tvoj prah Exekútora je o 2 vyšší.* |
| **Dvojčatá** | R | Dlh 1, Pecka 1 · blok. 2, 3 ‖ Pečeň 1, Rana 1 · blok. 0, 1 | 4 | *Furt: Do prevahy sa rátajú za dvoch.* |
| **Šofér** | R | Poldeci 1, Rana 1 · blok. 0, 3 ‖ Cigareta 1, Pečeň 1 · blok. 0, 3 | 4 | *Bitka: Ak si v tomto kole nedal NA EX, udelíš súperovi 1 Pecku navyše.* |
| **Brigádnik** | S | Robota 1, Cigareta 1, Rana 1 · blok. 3 · povolené 0: Robota; 1–2: Cigareta/Rana ‖ Robota 1, Pečeň 1, Obmedzenie 1 · blok. 0 · povolené 1: Robota; 2–3: Pečeň/Obmedzenie | 4 | *Furt: Do prevahy sa neráta.* |
| **Mäsiar** | U | Pecka 1, Pečeň 1 · blok. 0, 3 ‖ Pecka 1, Pečeň 1 · blok. 0, 3 | 4 | bez efektu |
| **Kulturista** | U | Petelica 1 · blok. 0, 2, 3 ‖ Dlh 2 · blok. 0, 3 | 1 | bez efektu |
| **Traktoristka** | U | Petelica 1, Pečeň 1 · blok. 0, 3 ‖ Dlh 1 · blok. 0, 3 | 4 | *Bitka: Ak máš v jej kraji prevahu, udelíš súperovi 1 Pecku navyše. Inak získaš 1 Dlh.* |
| **Oslávenec** | E | Poldeci 1, Cigareta 1 · blok. 0, 3 ‖ Rana 1 · blok. 0, 3 | 4 | *Kšeft: Za 1 plný poldeci naleješ súperovi — v tejto Pitke dostane 2 poškodenia pečene.* |
| **Kapybara** | E | Viera 1 · blok. 0, 3 ‖ Cigareta 1 · blok. 0, 3 | 4 | *Kšeft: Za 2 cigarety zožerie súperovi 1 špak.* |

Poznámky k zneniu: Praudovravec má Odpor voľne na slotoch 0–2 (Dezinformátor s Hasičom tým vzniká). Liberál má sloty ako dnes (4 varianty), efekt bez vety o NA EX. Oslávenec: 2 pečene (rozhodnuté); poldeci sa otočí na vypitý, nie je to nerest a platiteľovi nepridá pečeň; raz za Pitku; na Kostole sa Kšeft nedá (výklad Vymyselníka). Záhradkár: prah 7 → 9, so súperovou priazňou Exekútora 8 / 7 / 6; platí, keď leží v línii. Traktoristka: prevaha v kraji, kde leží, sa ráta v bitke ako pri Ihrisku. Kulturista a Puška platia v plánovej verzii, NA EX automat na Kulturistovi a kombá Pušky (12–16) sa merajú.

### 10.2 Odpadá

Vybavovač, Hromotĺk, Kuchárka, Šúľač a Bufetárka (do sady nejdú; v `plan.json` verdikt „nie“). S nimi odišli kombá Tichá spojka s Vybavovačom a Hromotĺk na NA EX; náhrady sú v časti 5. Odpadli aj alternatívy: Záhradkár B (súperov prah −2), Traktoristka T2 (Odvoz z krčmy) a T3 (Vlečka), Oslávenec s 1 pečeňou.

### 10.3 Uzavreté v druhom kole (27. 10.)

- **Záhradkár:** Michal „posúva prah exekúcie o 2“ → variant A *Bitka: Tvoj prah Exekútora je o 2 vyšší.* Riziko: dve kópie dajú +4 (prah 11), merať. Kód: `prahExekutora` (`engine.ts:1039`).
- **Traktoristka:** „treba vymyslieť efekt“ → T1 Na leasing *Bitka: Ak máš v jej kraji prevahu, udelíš súperovi 1 Pecku navyše. Inak získaš 1 Dlh.* Dilema: vlastný kraj istota, súperov hazard; súper zlomí prevahu podstrčením. Kód: prevaha (vzor Ihrisko), `bitkaMody` (`effects.ts:359`).
- **Bufetárka:** Nie.
- **Oslávenec:** 2 pečene.

### 10.4 Riešenie mŕtvej exekúcie (rozhodnuté)

- **Prah Exekútora v7 = 7**, so súperovou priazňou Exekútora **6 / 5 / 4** (dnes 10 / 9 / 8 / 7; `PRAVIDLA.md:96`, `:909`; jadro `PRAH_EXEKUTORA_ZAKLAD`, `constants.ts:79`, výpočet `engine.ts:1039`).
- Obecný úrad bez prahu −4, Robota za 2 Dlhy (7.4). Jednota: Kšeft Dlh za 2 cigarety (7.4). Dlhov v kartách 48 → 58.
- Záhradkár zvýši prah svojmu majiteľovi o 2 (9, so súperovou priazňou 8 / 7 / 6); spúšťač Exekúcia ostane bez karty a zmaže sa z `ALL_TRIGGERS` spolu s Prestávkou (`types.ts:94`).
- Dlh má zuby na Finančnej poradkyni, Podvodníkovi, Výhernom automate a Recidivistovi; kombo „Exekútor na objednávku“ je rozhodnuté.

### 10.5 Rozpočet po rozhodnutí (kópie v hre)

| Akcia | Dnes | Plán | Rozhodnuté |
|---|---|---|---|
| Cigareta | 48 | 56 | **50** |
| Dlh | 48 | 60 | **56** |
| Obmedzenie | 14 | 18 | **18** |
| Odpor | 20 | 18 | **18** |
| Pecka | 14 | 24 | **20** |
| Petelica | 4 | 14 | **12** |
| Pohoršenie | 30 | 30 | **30** |
| Poldeci | 24 | 30 | **26** |
| Posilnenie | 8 | 10 | **8** |
| Povera | 32 | 40 | **34** |
| Pečeň | 34 | 58 | **50** |
| Rana | 38 | 36 | **36** |
| Robota | 16 | 24 | **22** |
| Viera | 28 | 36 | **32** |
| Vízia | 10 | 14 | **10** |

Druhov v balíčku 51, kariet v hre 110. **Cieľ z časti 1 nesedí:** Petelica 12 namiesto 14 (−2, Hromotĺk), Pecka 20 namiesto 24 (−4, Kuchárka); Pečeň 50 namiesto 58, Dlh 56 namiesto 60. Traktoristka T1 dáva Pecku navyše len efektom pri prevahe, do kópií sa neráta. Nové karty som nerobil. Spojky 8 (kvóta 10), úderníci 8 (kvóta 10). Kšeft je na 4 kartách balíčka (Smetiarka, Strýko, Kapybara, Oslávenec).

### 10.6 Dopad na kód

- Dáta: 16 prerobených kariet a 5 noviniek podľa 10.1, Kapybara 2 cigarety.
- Efekty: Šarlatán (pečeň ako Viera, vzor `vieraAkoVizia`, `partia.ts:529`), Šofér (`naexVKole`, `engine.ts:333`), Podvodník (presun Dlhu, vzor `presunDlhVychovavatelky`, `engine.ts:2525`), Výherný automat (konštanty `constants.ts:122–123`), Brigádnik (prevaha), Oslávenec (Kšeft v7), Záhradkár (prah +2), Traktoristka (prevaha → Pecka alebo Dlh).
- Pravidlá v7: prah Exekútora 7, spúšťač Kšeft, zmazať spúšťače Exekúcia a Prestávka.

## 11. Dávka 3 — Dlhy v hre a Milujúca manželka (otvorené voľby)

Vymyselník · 27. 10. 2026 · dve témy z Michalovho interview nad playtestami. **Nič tu nie je rozhodnuté.** Časti 1–10 sa nemenia. Nič som nesimuloval, čísla sú z logov playtestov a z pravidiel. Voľby na klikanie sú v `revizia-karty.html` (sekcia Dávka 3), strojovo v `plan.json` (`davka3`).

### 11.1 Dlhy nevznikajú — doklad

> Michal: „Treba zariadiť, aby hráči tie Dlhy mali… možno prerábkou kariet a podobne.“

- Turnus 20261026-173610 (ULTRA krátka): „Kmotor (0 Dlhov) a Exekútor (ja 0 Dlhov) sú mŕtve“ (`naex/playtest/20261026-173610-2/hrac1/dennik.md:125`, podobne :199 a :202), „Kmotor 3 mne (bezcenné bez Dlhov)“ (`…-1/hrac1/dennik.md:91`).
- Podľa logov partií vznikli 0–3 Dlhy na hráča za celú partiu (P1 2 : 1, P2 0 : 3, P3 0 : 2). Dievčina na vydaj ich hneď v K1 pálila: „obe Dievčiny spálili po 1 Dlhu“ (`…-1/hrac1/dennik.md:84`), „Jej Dievčina spálila 1 Dlh“ (`…-2/hrac1/dennik.md:130`).
- Report 20261027-062058: najviac 5 Dlhov na hráča, Exekútor sa za 18 bitiek nespustil ani raz (`docs/playtesty/20261027-062058.html:397`, :936).

### 11.2 Čo z toho vyrieši rozhodnutá revízia

| Zdroj (rozhodnuté) | Ako vzniká Dlh | Komu | Dá sa mu vyhnúť? |
|---|---|---|---|
| Kulturista (Dlh ×2) | akcie, sám dosiahne prah 2 | majiteľ | áno: NA EX zruší jeho aktívne Dlhy, alebo nedať partnera na sloty 1–2 |
| Recidivista (Dlh ×2, vonkajšia strana) | akcie | majiteľ | čiastočne: zapne ho až ďalšia karta, aj súperova podstrčená |
| Traktoristka (Dlh + Na leasing) | osamelá akcia + priamy Dlh bez prevahy | majiteľ | priamy Dlh len prevahou v jej kraji |
| Finančná poradkyňa | akcie, Dlh ide súperovi | súper | nie, keď ju majiteľ spáruje vlastnou kartou |
| Policajtka | priamy Dlh | kto dal viac NA EX | áno, menej NA EX |
| Výherný automat | Prehra 2 Dlhy | majiteľ | len ak ho kúpi do Dedičstva |
| Podvodník, Vychovávateľka | presun, nie vznik | súper | — |
| Jednota, Poštárka | Kšeft za Dlh | dobrovoľne | áno; pri nadbytku cigariet (19–22 nevyužitých) Jednotu nik nepoužije |
| Herňa | špaky za Dlhy porazeného | finále | Dlhy nevyrába, trestá ich |
| Krčma, Obecný úrad, Zberný dvor (Dlh na hrane) | osamelá akcia | držiteľ kraja | sama v Pitke prepadne |
| Pinnacle hrany (Dlh) | akcie | držiteľ kraja | len finále |
| Prah Exekútora 7 (6 / 5 / 4) | — | — | dáva Dlhu zuby, nie je to zdroj |

Proti tomu rastú odtoky: Robota 16 → 22 kópií (každá aktívna spáli Dlh ešte pred Exekútorom, na Obecnom úrade 2), Dievčina na vydaj u oboch hráčov, Niekoho stryná, Vdova, priazeň Kmotor a Záhradkár (+2 k prahu).

**Moje hodnotenie (bez simulácie): revízia vyrieši asi polovicu.** Dôvody:
1. **Osamelý Dlh prepadne.** Dlh vzniká za každé 2 zadĺženia v jednej Pitke a zvyšok sa po Pitke vynuluje (§8 :490–495, §7 :464–465; `engine.ts:3021–3029`, rozhodnutie Michala 2026-10-16). Väčšina kariet s Dlhom má jediný (Traktoristka, Živnostník, Kočovník, Šarlatán, Dvojčatá, Podvodník, Snúbenica, štartový Pijan a Manželka, hrany lokalít). Sám v Pitke nedá nič, preto rozpočet 48 → 56 kópií neznamená +17 % Dlhov.
2. **Vyhnúť sa dá.** Akciu zapne sused a NA EX ruší vlastné aktívne Dlhy. Opatrný hráč dostane Dlhy len z Poradkyne, Policajtky a Na leasing, takže jemu ostane Kmotor aj súperov Exekútor mŕtvy.
3. **Odtoky rastú spolu so zdrojmi** (Robota +6 kópií) a Dievčina páli prvé Dlhy hneď v K1.

Odhad: z 0–5 Dlhov na hráča za partiu na zhruba 3–8. Exekútor pri prahu 7 príde, ale hlavne „na objednávku“ (kombo 9) a hráčovi, ktorý hrá Kulturistu či Recidivistu. Merať.

### 11.3 Voľby k Dlhom (D1–D5 karty, D6 pravidlo)

Zásada voľby: **Dlh musí kupovať to, čo cigarety nekúpia** (cigariet je nadbytok), alebo byť **nanútený**, alebo byť **priamy** (karta Dlh, nie zadĺženie), aby neprepadol.

#### D1 · Strýko z Ameriky: dolárová pôžička (Dlh ako cena za výhodu)

- **Dnes** (schválený, „nechať“): Kšeft: za 2 cigarety 1 Rana navyše.
- **Návrh:** *Kšeft: Za 2 cigarety udelíš súperovi 1 Ranu navyše, alebo za 1 Dlh 2 Rany navyše.*
- **Prečo:** cigarety sú lacné, Dlh je mena, ktorá bolí (Exekútor, Povery, Herňa, remíza). Dlh je priamy, neprepadne. Strýko pošle doláre, splácaš ty.
- **Riziko:** pri 3–4 Pitkách až +6 až +8 tuhého za 3–4 Dlhy bez troch kariet. Brzdou je prah 7: kto to preženie, príde o polovicu Dlhov a rovnako špakov. Ak je to priveľa, Dlh len raz za kolo.
- **Kód:** Kšeft (v7) s dvoma cenami. Rana navyše už jestvuje (Strýko).

#### D2 · Predajca hrncov — nová karta, nanútený Dlh

- **Karta:** Občan · Kriminál · Chlap, robotník. Akcie: *Povera, Cigareta / Rana, Dlh* (blok. 0 a 3 na oboch stranách, 4 varianty).
- **Efekt:** *Nástup: Súper získa 1 Dlh.*
- **Prečo:** jediný zdroj, ktorému sa súper nevyhne polohou ani NA EX. Šmejd z predvádzacej akcie predáva hrnce na splátky a zmluva je na meno suseda. Jeho Povera hneď bije do Dlhu, ktorý dal.
- **Riziko:** čistý trest bez voľby súpera. Lepšia dilema je variant *„Súper si vyberie: získa 1 Dlh, alebo príde o 1 špak.“* — v kóde ale potrebuje rozhodnutie súpera mimo jeho ťahu.
- **Kód:** Nástup + `pridajKliatbu` (vzor Výherný automat, `engine.ts:4150`). Dáta a ilustrácia: muž v saku s kufrom hrncov na dvore, babka podpisuje zmluvu, za plotom dodávka; bez dymu.

#### D3 · Svokra a Degustátorka: Obmedzenie → Dlh vedľa útoku

- **Svokra:** pravá strana *Obmedzenie, Pecka, Viera* → *Dlh, Pecka, Viera* (Dlh a Pecka ostávajú na slotoch 2–3, Viera na 0–1). Požičia si „do výplaty“ a vráti v rečiach. Efekt bez zmeny.
- **Degustátorka:** pravá strana *Rana, Obmedzenie* → *Rana, Dlh*. Degustuje na účet podniku. Efekt bez zmeny.
- **Prečo:** pri nadbytku cigariet je Obmedzenie najslabšia akcia. Dlh vedľa útoku na tej istej strane plní zásadu ceny (6.1). Rozpočet: Dlh 56 → **60** (cieľ z 1.1), Obmedzenie 18 → 14.
- **Riziko:** osamelý Dlh v Pitke prepadne, kým platí §8 (D6). Sám Dlhy neprinesie, len zvýši šancu na pár. Svokra je z rodiny, ak ju chceš nechať, stačí Degustátorka.
- **Kód:** len dáta.

#### D4 · Dievčina na vydaj: veno, až keď horí (štartová)

- **Dnes:** *Bitka: Zahoď túto kartu a spáľ toľko svojich priznaných Dlhov, koľko mala aktívnych akcií.*
- **Návrh:** *Bitka: Ak máš aspoň 4 priznané Dlhy, zahoď túto kartu a spáľ toľko svojich priznaných Dlhov, koľko mala aktívnych akcií.*
- **Prečo:** dnes páli prvé Dlhy u oboch hráčov hneď v K1 (doklad 11.1). S podmienkou ostane v balíčku, jej Dlh ×2 Dlhy vyrába a zachráni až pred Exekútorom (prah 7). Je to rodina ako záchranná sieť (koncept 26. 10.): veno príde, keď je doma najhoršie.
- **Riziko:** pod 4 Dlhmi je to štartovka s Dlh ×2 bez efektu (slabá, ako má štartovka byť). Prah 4 zmerať. Je to náhrada návrhu „veno“, ktorý čaká na ULTRA, takže rozhodnúť spolu s rodinou.
- **Kód:** jedna podmienka v efekte Dievčiny (`engine.ts:3074`, :3124–3127).

#### D5 · Vymáhač — nová karta, Dlh ako výhoda

- **Karta:** Občan · Kriminál · Chlap, úderník. Akcie: *Pecka, Dlh / Rana, Dlh* (blok. 0 a 3 na oboch stranách, 4 varianty).
- **Efekt:** *Bitka: Za každé 2 tvoje priznané Dlhy udelíš súperovi 1 Ranu navyše.*
- **Prečo:** prvá karta, pre ktorú Dlh chceš. Medzi ním a Exekútorom vzniká hra „drž sa tesne pod prahom“: pri 6 Dlhoch +3 Rany, pri 7 exekúcia (−3 Dlhy, −3 špaky). Súperova priazeň Exekútor tým ožije a Kmotor (maže Dlhy) sa stane voľbou: komu ho dať Pohoršením. Úderníci 8 → 9 (kvóta 10). Bije za teba, kým mu dlhuješ.
- **Riziko:** so Záhradkárom (prah 9) až +4 Rany. Vo finále na Herni platí porazený dlžník navyše. Merať.
- **Kód:** Bitka, tuhé v `bitkaMody` (`effects.ts:359`). Počet priznaných Dlhov jadro ráta (Exekútor, Herňa).

#### D6 · [PRAVIDLO, jadro] Čiarky na účte: zvyšok zadĺženia sa nemaže

- **Dnes:** pečeň aj zadĺženie sa po Pitke vynulujú (§7 :464–465, §8 :485–486; `engine.ts:3021–3029`; Michal 2026-10-16).
- **Návrh:** *Zadĺženie sa po Pitke nevynuluje. Za každé 2 zadĺženia dostaneš Dlh ako dnes, zvyšok ostáva na účte do ďalšej Pitky, aj do ďalšieho kola.* Pečeň sa nuluje ďalej.
- **Prečo:** rieši koreň problému. Každá aktívna akcia Dlh je polovica Dlhu a nič neprepadne. Osamelé Dlhy štartoviek, hrán a robotníkov sa začnú rátať. Krčmár píše čiarky.
- **Riziko:** mení rozhodnutie zo 16. 10. (len pre zadĺženie). Stôl musí ukázať čiarku na účte, náhľad Pitky (`nahlady.ts:59`) ju musí rátať a bot tiež. Spolu s D3 a D5 môže byť Dlhov priveľa, preto zaviesť samostatne a merať.
- **Kód:** nenulovať `zadlzenie` (`engine.ts:3029`), `pridajZadlzenie` (`engine.ts:798`) ostáva. Ďalej náhľad, UI a PRAVIDLA §7–§8.

**Odporúčanie:** len kartami **D4 + D3 + D5**: lacné (dáta, jedna podmienka, jeden efekt), rozpočet Dlhu sedí na 60, zmizne hlavný skorý odtok a Dlh dostane dôvod. K tomu **D2 alebo D1** podľa toho, či chceš Dlh nanútený, alebo kúpený (obe netreba). Ak chceš jediný zásah s najväčším účinkom, je to **D6**. Ostatné voľby ho len dopĺňajú, lebo bez neho väčšina nových akcií Dlh v Pitke prepadne.

### 11.4 Milujúca manželka — prerobiť

> Michal: „Kartu treba prerobiť.“

**Problém.** Furt *„Absťák dostaneš aj vtedy, keď máš v kole rovnako nerestí ako v predošlom“* sa dá vyložiť dvojako. Absťák sa ráta na konci kola, až po návrate kariet (§4, §8 :518). Furt platí, „kým je odhalená — v línii aj priznaná“ (§16 :1137). Jadro ju ale ráta ešte pred návratom kariet (`engine.ts:4162–4163`, :4212–4217). Hráč čakal opak dvakrát, v K3 s dopadom: druhý Absťák = −2 tuhé vo finále (`naex/playtest/20261026-173610-3/hrac2/nezrovnalosti.md:10–14` N2, :48–53 N9). Report 20261027-062058 navrhuje zmeniť Manželku „z pasce na voľbu“ (:850).

**Spoločné pre všetky voľby:**
- Akcie *Dlh, Viera / Odpor, Povera* ostávajú: Viera bráni, Odpor na vnútornej strane ruší akciu suseda (pasívna agresia) a Dlh je jeden z mála skorých zdrojov Dlhu (téma 1).
- **Tag Kliatba navrhujem zrušiť.** Priznanie Manželky (karta navyše, Furt aj priznaná) bolo druhým zdrojom nejasnosti a lotériou dobratia (report :468, :671). V §11 :868–870, :890 a :897 by zanikla výnimka.
- Popis nemenuje iné karty. Spúšťače sú okamžité, nič sa nevyhodnocuje na konci kola.

#### M1 · Odvedie ťa domov (opravený návrh z konceptu rodiny)

- **Efekt:** *Bitka: Smieš ju zahodiť z línie (z hry). Vtedy je súperovo tuhé poškodenie proti tebe v tejto bitke o 2 menšie a po bitke dostaneš 1 Absťák.*
- **Okamih:** rozhodnutie aj účinok v bitke. Absťák príde po bitke ako priamy zisk, nie z porovnania nerestí. Jej akcie v tejto bitke ešte platia (ako pri Dievčine, §16 :1130).
- **Prečo:** rodina ako záchranná sieť, raz sa dá obetovať. Odvedie ťa skôr, ako ťa zbijú, ale doma bez pálenky prídu absťáky.
- **Riziko:** −2 tuhé otočí tesnú bitku, takže je to nástroj porazeného proti snowballu. Absťák (−1 tuhé, kým nezvýšiš neresti) je skutočná cena a karta je preč natrvalo.
- **Kód:** voľba hráča v bitke (vzor Záhradkár, `engine.ts:440`, :3333), tuhé v `bitkaMody` (`effects.ts:359`), Absťák ako v `engine.ts:4218`.

#### M2 · Rozriedi ti pálenku

- **Efekt:** *Pitka: Tvoje poškodenie pečene v tejto Pitke je o 1 menšie.*
- **Okamih:** v každej Pitke, kým leží v tvojej línii. Vyhodnotí sa s pečeňou v kroku 3 (§7), konca kola sa netýka.
- **Prečo:** slabá, ale užitočná: pri pečeni +70 % (34 → 50 kópií) je −1 za Pitku poistka proti Cirhóze. Triezvi ťa potajme, do fľaše ti doleje vodu.
- **Riziko:** s Kohútom či 4 Pitkami je to −4 pečene za kolo, blízko Nealka. Oslávenec a Lievik proti nej slabnú.
- **Kód:** pečeň v `prirastkyPitky` (`engine.ts:822`, jeden výpočet pre náhľad aj vyhodnotenie).

#### M3 · Pošle mu účet (trafí aj tému 1)

- **Efekt:** *Prehra: Súper získa 1 Dlh.*
- **Okamih:** Prehra, krok 6c po bitke, keď leží v línii (rovnako ako Podvodník či Veštica).
- **Prečo:** pasívna agresia: zavolá víťazovej žene, koľko prepil, a účet za rozbitý pohár príde jemu. Je to útecha porazeného (dobiehanie proti rente strachu) a nanútený Dlh súperovi.
- **Riziko:** slabá (1 Dlh), čo je pri štartovke zámer. Spolu s „Exekútorom na objednávku“ zrýchli exekúciu vedúceho. Pri sekere nerobí nič.
- **Kód:** Prehra + `pridajKliatbu` víťazovi (vzor Výherný automat, `engine.ts:4150`).

**Odporúčanie:** **M3**. Má najjednoduchší okamih (Prehra), nemá Furt ani koniec kola a pomáha téme 1. **M1** zvoľ, ak chceš držať koncept rodiny ako záchrannej siete. Je silnejšia, ale potrebuje voľbu v bitke.

### 11.5 Otázky pre Michala

1. **Dlhy:** ktoré z D1–D6 (viac naraz sa dá)? Odporúčam D4 + D3 + D5 a k tomu D2 alebo D1. D6 ako jediný zásah s najväčším účinkom.
2. **Predajca hrncov (ak D2):** súper Dlh dostane bez voľby, alebo si vyberie medzi Dlhom a −1 špakom?
3. **Manželka:** M1, M2, alebo M3? Odporúčam M3.
4. **Manželka bez tagu Kliatba** (zanikne priznanie za kartu)? Odporúčam áno.
