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
| 8 | **Nepriznaná Cirhóza po bitke do odhadzovacieho balíčka:** Cirhóza, ktorú hráč má po bitke v ruke a nepriznal ju, ide do jeho odhadzovacieho balíčka. Hráč sa musí rozhodnúť, či ju prizná hneď (súper +1 tuhé v každej bitke), alebo riskuje, že sa mu v poslednom kole nevráti do ruky a na konci hry ho bude stáť body. Na konci hry sa ráta aj v balíčkoch ako dnes. | schválené, meria stratég | Michal 2026-10-25 |

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
- Návrhy vymyselníka Výpalné za každé súperovo NA EX a Na zdravie „do dna“ (poldeci z tvojho NA EX sa vráti plný) zatiaľ nerozhodnuté — čakajú na meranie.

## Interview 3 (Michal 2026-10-25): otvorené otázky

- **NA EX naraz + Výtržník: áno, do v5** (napriek tomu, že zrážka je zriedkavá).
- **Variant (a)** „1 b aj za aspoň jednu vyhratú podmienku“: rozhodne po finálnom meraní stratéga.
- **Podmienka Cigarety:** zatiaľ nechať (bez náhrady).
- **Absťák v scorecardoch:** Absťáky **získané za hru** (nedá sa ho zbaviť).
- **Zónové podmienky:** 10, Znepokojenie 3× — áno.
- **Vydesenie v scorecardoch:** nechať 2× (Bitkár, Exekútor).
- **Bitkárov scorecard:** zámerne najťažší — áno.
- **Rezerva:** Vínko sa ráta ako plný poldeci.
- **Dve rovnaké aktívne podmienky:** dva súboje.
- **Nepriznaná Cirhóza** na scorecardoch ostáva (nenahrádza ju Pečeň).
- **Charakter staršieho** nesie scorecard (podľa priazne), nie karta staršieho.
- **Znak** (9. vždy aktívna podmienka): nie.
- **Výpalné:** platí sa za **každé** súperovo NA EX (1/2/3 cigarety, dostaneš ich ty).
- **Na zdravie → „do dna“:** poldeci z tvojho NA EX sa vráti plný (1/2/3 za kolo).

## Interview 4 (Michal 2026-10-25, po finálnom rozbore docs/playtesty/strategia-v5.html)

- **Variant (a): nezaviesť.** Body za staršieho len víťazovi (pri rovnosti obom).
- **Podmienka Cigarety:** nechať, sledovať pasovanie v playteste (náhrada „minuté cigarety“ pripravená).
- **NA EX naraz:** **útočník položí reakčnú kartu druhý** (po odkrytí NA EX odpovedá najprv obranca, útočník má posledné slovo).
- **Pohoršenie k sebe smie každý.**
- **Výtržník** (Michal 2026-10-25): karta sa najprv spáruje so susedmi s pôvodnými akciami, potom sa jej akcie zmenia na Rany pre majiteľa. **Po bitke výtržník vytriezvie** — akcie sú znova pôvodné; Výtržníkom je len počas jednej bitky.
- **Pri zrážke NA EX** sa Výpalné aj Svokra platia za každé z oboch NA EX.
- Potvrdené podľa kódu (Michal 2026-10-25): Pohoršenie k sebe s Novinami smie až na krajnú pozíciu; Policajtka ruší súperove Pohoršenia v oboch smeroch; Výpalné zoberie len toľko cigariet, koľko súper má; pri „do dna“ sa nerest ráta ďalej. Starší bez aktívnej podmienky prakticky nenastane (každá karta staršieho má akcie); rovnosť vo všetkých podmienkach = body obom.
- **Neprajník → Výpalník** (priazeň Výpalné). Benzínka v5: len „Pitka: Nikto nesmie fajčiť.“ Cirhóza: „Nepriznaná ide po bitke do tvojho odhadzovacieho balíčka; na konci hry prehráva súboje o Cirhózu.“ Popis akcie Dlh s konkrétnymi číslami (prah zadĺženia, prah Exekúcie). (Michal 2026-10-25)

## Čo v5 prerobí (Michal 2026-10-25: „bude treba prerobiť takmer všetko“)

Zmrazenie pravidiel trvá najviac týždeň; v5 má výnimku a nasadí sa na Michalov pokyn.

| Oblasť | Čo | Kto | Stav |
|---|---|---|---|
| Jadro | etapy 1–9 z tabuľky vyššie, VERZIA_PRAVIDIEL v5 | programátor (v5/pravidla) | beží |
| Bot | hrať v5: Pohoršenie k sebe, fajčiť v Pitke, Cirhóza priznať/riskovať, súperovi najslabšia priazeň | bot-tréner (max 2 procesy) | po jadre |
| Stôl (UI) | bodovanie po starších (kto by ho teraz bodoval), Pohoršenie oboma smermi, nové priazne, NA EX naraz (ak áno), scorecardy Absťák/Rezerva, jednotný bar (mocky ui/jednotny-bar) | programátor UI | po jadre a výbere baru |
| Pravidlá | docs/PRAVIDLA.md, stránka /pravidla (poradie hry), tlač, ťahák AI hráčov tools/playtest/tahak.md, mapa rozhodcu | vymyselník + rozhodca | po rozhodnutiach |
| Výučba | nová výuková hra proti Majstrovi Melicharovi (Ladislav Melisko, ktorý narobil v dedine dlhy, preto vystupuje pod tajným menom); začne tým, že si od hráča požičia cigaretu a za to ho naučí hrať; bublina nie na celej ľavej strane (súperove zdroje alebo jednotný bar). Dnešná výučba sa Michalovi nepáčila. | Michal premýšľa → vymyselník scenár | čaká na Michala |
| Nápovedy | packages/core/src/napovedy.ts — texty a spúšťače podľa v5 | programátor | po pravidlách |
| Scorecardy, priazne | dáta, texty na kartách starších, ilustrácie nových mien (Abstinent, Kmotor…) | admin, ilustrátor | po rozhodnutiach |
| Štatistiky, achievementy, Vývoj | partie v5 oddelene od v4, známky | programátor | pred nasadením |
| Hráči | Novinka „Pravidlá v5“, oznam v lobby | admin | po nasadení |
