# Strategický denník — Bitkár Rudo (štýl agresor) — Zrejúca

Charakter štýlu: `../../styly.json` (kľúč `agresor`). Formát: `../README.md`.
Denník vedie hráč štýlu sám; sudca len pripisuje poznámky k chybám v pravidlách.

## Aktuálna stratégia (po partii 1, pravidlá v11.6, stredná partia 5+finále)
**Cieľ:** vyhrávať KAŽDÚ bitku v K1–K3 veľkým tuhým (6–11) a Nakladačku premieňať na červený strach u starších s neškodnou priazňou; špaky z bitiek + z červených starších (5 za kus pri každej ďalšej výhre) postavia náskok, ktorý finále nedobehne. Výhra strachom (4 červení) stojí ~24 bodov Nakladačky a overuje sa až v bitke po tom, čo je 4. červená hotová (4c je pred rozdelením) — v strednej partii to dá najskôr K5/finále, takže je to bonus, nie plán A. Plán A = **špakový náskok 40+ pred finále**.
1. **Stavba línie (hlavný zdroj tuhých):** karty, ktoré nesú Petelicu/Pecku/Ranu na vnútornej hrane, daj aj na SÚPEROVU stranu ako prvú kartu v jeho kraji (podstrčenie): prevaha v jeho kraji ti dá jeho hranu lokality a tvoje Petelice tam bijú (K1: Vymáhač + Poľovník na jeho strane = 9:0). Počítaj karty v kraji — kto má v kraji viac kariet, dostane hranu (a Ihrisko +2): druhá moja karta v kraji zvrátila 5:7 na 9:1 (K2).
2. **Násobiče:** Opatrovateľka (Pamätníci v okolí ×2) + Pamätník s Petelicou (Poľovník, Manželka) = Petelica ×2 = 6; Manželka + Viera ×2 po NA EX na ňu = „štít“ — Viera tlmí súperove tuhé na 0 (K1: 3:3 → 4:0).
3. **Draft:** cigarety sú mena šenku. Agresor ich míňa na NA EX/Dlhy a v K2, K4, K6 mal 0 → nemohol vziať nič (súper s 7–9 cigami bral po 2–3 karty). **Neminúť posledné 3 cigarety**; pas s plnou rukou nepasovať predčasne.
4. **Nakladačka:** rozdeľ na starších, ktorých priazeň súperovi NEUŠKODÍ — **Robota je pasca** (priazeň sily 3 = súper dostane +3 špaky v KAŽDEJ bitke, lebo Robota bez Dlhu = špak); Bitkár/Veriaci mu pridajú tuhé/Vieru; neškodné: Kmotor (Farár), Alkoholik (Krčmárka, mierne), Advokát, Abstinent. Prvú červenú daj na staršieho, ktorého zajmeš (ak by klient zajatie pustil, N1), inak na toho, kto dá najmenej súperovi.
5. **NA EX:** súper (ekonóm) dáva NA EX na moju NAJSILNEJŠIU kartu v 4 z 5 bitiek, ktoré mohol (Dvojčatá K2, Recidivista K3, Poľovník K5, Recidivista K6) → nespoliehať sa na jedinú kartu; stav tuhých nastaviť tak, aby po jeho NA EX stále vyhral (Viera ×N z Manželky/Opatrovateľky, druhý zdroj tuhých). Vlastné NA EX len keď hra ukáže vo „výhľade“ čistý zisk (K1: +4, K5: Dlh +1 za +3).

## Nástroje
- **NA EX na vlastnú obrannú kartu (Manželka: Viera ×2 + Dlh ×2)** — súperove tuhé spadne na 0 namiesto navyšovania svojich · stav: overený (1×) · dôkaz: K1 Pitka 1, 3:3 → 4:0, Nakladačka 9 po ďalších kartách; cena Dlh +2 (kompenzuje Robota ×2 na hrane) a nerest 2 · pravidlá: v11.6
- **Podstrčenie karty s Petelicou na súperovu stranu ako prvá karta jeho kraja** — beriem jeho hranu lokality, kým má on menej kariet v kraji · stav: overený · dôkaz: K1 (Vymáhač 3 Rana, Poľovník Petelica; 6:0 → 9:0), K3 (Zberný dvor 11:0), K5 (Poľovník superova) · pravidlá: v11.6
- **Pamätník s Petelicou + Opatrovateľka (alebo Manželka/Poľovník v jej okolí)** — Petelica ×2 = 6 tuhých za 2 karty · stav: sľubný (K5: 6:2, potom ho súper zrušil NA EX) · pravidlá: v11.5
- **Počet kariet v kraji (Ihrisko, hrana lokality)** — 2 moje karty v kraji proti 1 jeho vezmú prevahu: +2 Ihrisko, hrana, a Traktoristovo „Pecka navyše“ sa zmení na Dlh · stav: overený · dôkaz: K2 5:7 → 9:1 (Miňištrant + Dievčina) · pravidlá: v11.6
- **Praudovravec súpera ako prvá karta v mojom kraji** — jeho Odpor sa ráta ako Posilnenie a zdvojí MOJU Petelicu na spoji (K3: 6 tuhých z jednej karty) · stav: kandidát (náhoda; ale nezvyčajné: oplatí sa nechať súperovi hranu, kde moja Petelica ide do jeho Odporu) · pravidlá: v11.5
- **Nakladačka 9/7/6 rozdelená 6 + 3** — červená + oranžová hneď · stav: overený (K1, K2, K3) · 3 červení po K3 · pravidlá: v11.6
- **Robota priazeň (Vychovávateľka) súperovi** — stav: zavrhnutý (K1–K5: súper +3 špaky/bitka, spolu ≥ 12) — dávať iba keď ju zajmeš v nasledujúcom kole.
- **Zajatie** — stav: nevyskúšané; klient `hrac.ts` ho odmieta (N1: kontrola „rozdeľ čo sa dá“ ignoruje `zajatia`, ponúka a hneď odmietne ten istý ťah). Kým sa to neopraví, výhra väzňami je nehrateľná.
- **Kapybara, Strýko Kšeft, Valaška/Vidly do Dedičstva, Vynútené NA EX (Krčma), Vízia na spálenie Cirhózy** — kandidáti, nevyskúšané (pozri nápady).

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

## Nápady na vyskúšanie
1. Zachovať 3 cigarety do každého draftu (nevyfajčiť, nedoliať, pas len keď treba) a vziať 2 karty za 3 pri prvom ťahu — porovnať s partiou 1, kde som mal 0 v K2, K4, K6.
2. Valaška/Vidly do Dedičstva (1/2 cig, bez limitu vykladania): +1 k Pecke/Rane bez karty v línii — súper (K5) vložil Valašku hneď.
3. Kapybara (Nástup) na reči súpera + Predsedova vila: nezaujímavé pre agresora; skúsiť iba ak súper začne bodovať z rečí.
4. Krčma (vynútené NA EX, prah Cirhózy +2) s Pijanom (+Rana za každé NA EX) a Šoférom: súperove NA EX trik zostane drahý.
5. Cirhóza pri Hasiči/Veterinárovi: neskúšané.
6. Vychovávateľka ako PRVÁ ZAJATÁ (po oprave N1): súper pasuje v Zhromaždení, moje podstrčenia nikto nezruší.
7. Zrážka NA EX (obaja na tú istú kartu → Výtržník): zámerne dať NA EX tam, kde to dá súper; neskúšané.

## Čo štýlu chýba v hre
- Cesta „väzni“ (hlavný cieľ charakteru) cez klienta nehrateľná (N1). Mimo toho je v strednej partii drahá: 3 väzni = ~33 bodov Nakladačky (3 × (červená 6 + zajatie 5)), čo je viac než výhra strachom (4 červení ≈ 24 a väzeň sa ráta ako červená) — väzni sú lacnejší len v krátkej partii (2 väzni).
- Agresor nemá ako „kúpiť“ tuhé (cigarety → draft karty → tuhé), kým súper investuje; keď má 0 cigariet, draft vypadne, ruka ostane 1–2 slabé karty (K4: ruka Manželka + Vymáhač → 0:11).
- Obrana proti podstrčeniu: súper položí prvú kartu v mojom kraji a vezme moju hranu (K2, K4, K5, K6). Agresor tu nemá reakciu, len „viac kariet v kraji“ — ktoré mu chýbajú.
- Veľká Nakladačka (7–11) nemá kam ísť, keď sú všetci neškodní starší na červenej; bezpečná červená je drahá (6) a priazeň dáva súperovi výhody.

## Partie
- 2026-11-06 · 20261106-010635-1 · vs Ekonóm Ďuro · VÝHRA 59:38 špaky po finále (bitky K1,K2,K3,K5 moje, K4 a finále jeho; 4 červení po K5, výhra strachom sa nestihla) · skúšané: E1 (NA EX na obrannú kartu), E2 (červená → zajatie, zablokované N1), podstrčenie Petelíc, Opatrovateľka × Pamätník
