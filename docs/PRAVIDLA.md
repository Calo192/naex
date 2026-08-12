# NA EX! — destilované pravidlá pre implementáciu

Referenčný výťah z `naex_pravidla_v11_tlac.docx` (Michal Calík), prepísaný do
podoby, ktorá sa dá priamo implementovať a otestovať. Toto **nie sú** pravidlá
pre hráčov — je to špecifikácia.

Originál: `C:\Users\Michal\Documents\Claude\naex_pravidla_v11_tlac.docx`
Karty: `data/cards.json` (vygenerované z `kartyai_cards_20260713_rozsirene.txt`)

> Miesta označené **[?]** sú nejednoznačné alebo v pravidlách chýbajú.
> Neimplementuj ich potichu — pozri `docs/BRIEF.md`, sekcia „Otvorené otázky".

---

## 1. Základ

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality, desia starších.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč vydesí aspoň polovicu starších v hre | okamžite **vyhráva** |
| Hráč nedokáže čeliť exekúcii | okamžite **prehráva** |
| Veľkosť balíčka hráča klesne pod 5 | okamžite **prehráva** |
| Odohrá sa posledná bitka o lokalitu | spočítajú sa body |

Veľkosť balíčka = doberací + odhadzovací + ruka. **Priznané karty sa nerátajú.**

---

## 2. Skladba karty

Každá karta má názov, ilustráciu, tagy, **akcie po stranách** a **efekt**.

Akcie sedia v slotoch: 4 vľavo, 4 vpravo, index **0 hore až 3 dole**.
Slot môže byť *blokovaný* (nikdy nedrží akciu) alebo *prázdny*.

### Varianty — dôležité

`data/cards.json` popisuje pri každej strane len **multimnožinu akcií** plus
blokované pozície, nie konkrétne rozloženie. Z toho vzniká N rôznych rozložení
a každé je v tlači samostatná karta („Štartovacie karty existujú v rôznych
variáciách"). Pole `permutations` udáva očakávaný počet — je to kontrolný súčet
generátora.

```
rozloženia strany = počet rôznych permutácií multimnožiny
                    (akcie + prázdne miesta) po voľných slotoch
variantov karty   = rozloženia_vľavo × rozloženia_vpravo
```

Príklady na overenie: `autobusar` ľavá 6 × pravá 1 = 6 · `ihrisko` pravá strana
má Poldeci ×3 v 3 slotoch → **1** rozloženie (nie 6 — sú to zhodné prvky).

### Tagy

Lokalita, Kliatba, Občan, Nástroj, Zviera, Chlap, Žena, Pracujúci, Kriminál,
Závislý, Zahraničný, Autorita, Influencer, Pamätník, Starešina.

Tagy nemajú vlastné pravidlá, pokiaľ sa na ne neodkazuje efekt.

---

## 3. Akcie

| Akcia | Kľúč v cards.json | Účinok |
|---|---|---|
| Rana | `Rana` | 1 tuhé poškodenie |
| Pecka | `Pecka` | 2 tuhé poškodenie |
| Petelica | `Petelica` | 3 tuhé poškodenie |
| Povera | `Povera` | mäkké poškodenie do výšky súperovho **priznaného** dlhu; ruší sa s Vierou 1:1 |
| Pohoršenie | `Pohoršenie` | posunie marker ľubovoľného staršieho o 1 k súperovi |
| Viera | `Viera` | znižuje súperovo tuhé poškodenie; základ 1 + priazeň; ruší sa s Poverou 1:1 |
| Hazard | `Dlh` | vytvorí kartu Dlhu |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene |
| Obmedzenie | `Obmedzenie` | zníži počet kariet, ktoré si súper potiahne |
| Cigaretka | `Cigaretka` | +1 potiahnutie počas Pitky, **len toto kolo** |
| Vízia | `Vízia` | z práve dobraných kariet zahoď Zopár kliatieb a dober si toľko istý počet |
| Poldecko | `Poldeci` | otočí jeden vypitý poldeci späť na plný (**až pri bitke**) |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú) |
| Odpor | `Odpor` | zruší prepojenú akciu; Odpor + Odpor = Vzbura |

Pozor na tri názvy, ktoré sa v pravidlách a v exporte líšia:
`Dlh`→Hazard, `PoškodeniePečene`→Pečeň, `Poldeci`→Poldecko.

---

## 4. Aktivácia akcií — jadro hry

Karty tvoria **jednu súvislú líniu**, vetvenie nie je povolené.

```
PRAVÁ strana karty N  ↔  ĽAVÁ strana karty N+1
```

Akcia je **aktívna**, ak sa na spoji stretnú **dve neprázdne akcie na rovnakom
indexe**. Každá aktívna akcia sa počíta samostatne.

Prvá karta hráča sa pripája k **lokalite**. Lokalita leží medzi partiami; jej
natočenie určuje, ktorá jej strana pripadne ktorému hráčovi. Akcie lokality sa
s prvou kartou aktivujú ako pri bežnom susedstve.

### Otočenie o 180°

Kartu možno vyložiť do **súperovej** partie (ak to efekt dovoľuje). Vykladá sa
„nohami hore". Otočením:

- ľavá a pravá strana sa **vymenia**,
- poradie indexov sa **obráti** (0↔3, 1↔2).

```
efektívna_ľavá(otočená)  = pravá čítaná odzadu
efektívna_pravá(otočená) = ľavá čítaná odzadu
```

Akcie a efekty takejto karty pôsobia **v partii, kde karta leží**. Vlastník
(ten, kto ju zahral) rozhoduje len o tom, do koho odhadzovacieho balíčka sa
karta po bitke vráti. Vyloženie do súperovej partie sa počíta do limitu
vykladania **hráča, ktorý ju zahral**.

### Modifikátory na spoji

| Dvojica | Výsledok |
|---|---|
| X + Y (bežné akcie) | obe sa aktivujú, každá ×1 |
| Posilnenie + X | X sa aktivuje ×2 |
| Odpor + X | X je zrušená |
| Odpor + Odpor | **Vzbura**: obe karty vyhodnotia všetky svoje inak neaktívne akcie ako aktívne |
| Posilnenie + Odpor | neprepojené akcie aktivuje **iba karta s Odporom** |
| Posilnenie + Posilnenie | **[?]** pravidlá nehovoria |

### Podpora

Karta je *podporená*, ak sa v jej okolí nachádzajú **presne 2 karty**
(t. j. má susedov z oboch strán). **[?]** Počíta sa lokalita ako karta?

---

## 5. Poldeci a limit vykladania

```
limit vykladania = plné poldeci + poldeci ležiace na kartách cez NA EX + 1
```

- Vypité (otočené nadol) poldeci sa **nerátajú**.
- Poldeci položený cez NA EX sa ráta **až do bitky**, kde sa vypije.
- Samotná akcia Poldecko sa do limitu nezapočítava — otáča poldeci až pri
  bitke, takže sa prejaví o kolo neskôr.
- Priznané karty a Nástroje v Dedičstve sa do limitu nerátajú.
- Nástroj sa do limitu vykladania **nezapočítava vôbec**.
- Limit sa počíta **nanovo na začiatku každého Zhromaždenia**.
- **Limit 0 → hráč okamžite prehráva bitku.**
- Už vyložené karty sa nikdy nevracajú.

### NA EX

Smie sa dať **iba počas fázy NA EX v Pitke**, v základe **najviac raz za Pitku**.
Hráč vyberie jednu kartu s tagom **Občan alebo Starešina** — vlastnú (posilní)
alebo súperovu (zneguje) — a položí na ňu jeden plný poldeci.

Poldeci **ostáva jeho**: do bitky sa ráta do JEHO limitu, pri bitke sa vypije.

> „NA EX posilňuje (zdvojnásobuje) neaktívne akcie a zároveň ruší aktívne
> akcie karty, na ktorej sa uplatňuje."

Poškodenie pečene z NA EX sa počíta **hneď počas Pitky** a pripíše sa
**vlastníkovi cieľovej karty**; poldeci sa fyzicky vypije až pri bitke.

### Doplnenie poldeci (počas Pitky)

- **2 fyzické cigarety** → otoč jeden vypitý poldeci späť na plný.
- **Stokársky barter: 5** (ľubovoľne Cigaretky aj fyzické cigarety) → nový
  plný poldeci navyše.

---

## 6. Priznanie a Dedičstvo

**Priznanie** — kartu s tagom Kliatba možno vyložiť mimo partie do vlastnej
hracej oblasti.

| | Nepriznaná | Priznaná |
|---|---|---|
| Dlh | −1 bod na konci hry | body neuberá; **ráta sa k prahu Exekútora**; povery proti nej udelia mäkké poškodenie; pri priznaní si hráč **okamžite doberie kartu** |
| Cirhóza | záporné body **[?]** koľko | body neuberá; dá sa liečiť / použiť pri Pohrebe; pri priznaní sa karta nedoberá |

**Dedičstvo** — Nástroje sa namiesto priznania vykladajú do hracej oblasti ako
Dedičstvo a uplatňuje sa ich pasívny efekt `Dedičstvo`. Poldeci sa na Nástroje
neuplatňujú vôbec, nedajú sa posilniť cez NA EX a **Nástroj nesmie susediť
s Nástrojom**. Vyloženie Nástroja (do partie aj do Dedičstva) sa počíta ako ťah.

---

## 7. Priebeh kola

**Útočník** = hráč, ktorý prehral poslednú bitku (v prvom kole náhodne).
Vyberá cieľ kola. **Obranca** vykladá aj draftuje ako prvý.

```
Voľba cieľa → [Draft] → (Zhromaždenie → Pitka) × N → Bitka
```

### Bitka o lokalitu — cigaretový draft

Útočník vyberie lokalitu a **natočí ju**. Potom každý hráč (obranca prvý)
zoberie **0–3 cigarety**; za zvyšok (`3 − cigarety`) si dobral karty **zo šenku**.

```
počet pitiek = 1 + |rozdiel nových kariet oboch hráčov|     (1 až 4)
```

### Bitka o staršieho

Ako bitka o lokalitu, s rozdielmi:

- prebieha **vždy práve na jednu pitku**,
- **žiadny draft** — hrá sa len s tým, čo hráč má,
- dá sa vyvolať, **len ak je marker aspoň v oranžovej zóne** (Strach).

Keď hráč bitku o staršieho vyhrá: rozdelí prebytočné poškodenie medzi
*ostatných* starších, vezme si kartu staršieho **do svojho balíčka**, na jeho
miesto položí zo svojho balíčka ľubovoľného **Občana alebo Zviera** (nie Nástroj,
nie Kliatbu) a nastaví marker na ľubovoľnú pozíciu v **sivej** zóne.

### Zhromaždenie

Hráči striedavo vykladajú karty do svojej alebo súperovej partie, prípadne
priznávajú karty alebo vykladajú Nástroje do Dedičstva. **Vykladať začína
obranca.** Priznanie aj vyloženie Nástroja sa v striedaní počíta ako ťah.

Končí, keď obaja odohrajú svoj limit alebo obaja pasujú.

### Pitka — poradie vyhodnotenia

1. **NA EX** — jediná príležitosť
2. **Hazard**
3. **Poškodenie pečene a Cirhóza** — akcie Pečeň, Poldecko a NA EX; pri dosiahnutí prahu hráč hneď získa Cirhózu
4. **Obmedzenie**
5. **Cigaretky** (a prípadne použité fyzické cigarety)
6. **Ťahanie kariet**
7. **Vízia**

```
ťahanie = Cigaretky + použité fyzické cigarety − súperove Obmedzenia
```

---

## 8. Vyhodnotenie bitky — presné poradie

### 1. Exekútor

Spočítajú sa **priznané** Dlhy (nepriznané sa nerátajú).

```
prah = 10 + 2 × priazeň Exekútora
```

Ak `priznané_dlhy ≥ prah`, hráč **musí** odovzdať kartu s tagom Nástroj
(z ruky, balíčka alebo Dedičstva) — inak **okamžite prehráva a hra sa končí**.
Ak Nástroj odovzdá, **polovica priznaných dlhov zhorí** (nadol).

Hráč, ktorý exekúcii **nečelí**, spáli 1 priznaný Dlh.

### 2. Pohoršenie

Každé aktivované Pohoršenie posunie marker jedného staršieho o 1 smerom
k súperovi, **bez ohľadu na výsledok bitky**. Staršieho vyberá hráč, ktorého
akcia sa aktivovala.

- ten istý marker sa **nesmie posunúť dvakrát**,
- Pohoršením sa **nedá dostať na krajnú pozíciu**.

### 3. Poškodenie

```
1. Viera a Povera sa vyrušia 1:1
     moja Viera ruší súperove Povery
     moje Povery rušia súperovu Vieru
     cancel = min(viera[ja], povera[súper]);  obom sa odpočíta

2. tuhé[ja] = (Rana×1 + Pecka×2 + Petelica×3 + Cirhóza + priazeň Bitkára)
             − zvyšná_viera[súper] × hodnota_viery(súper)
             − počet_mojich_absťákov
     minimum 0

3. mäkké[ja] = min(zvyšná_povera[ja], priznané_dlhy[súper])

4. celkové[ja] = tuhé[ja] + mäkké[ja]
```

Cirhóza sa počíta ako tuhé poškodenie, takže ju zvyšná Viera tiež znižuje.
Karta Cirhóza má efekt „Bitka: Obdržíš od súpera dodatočnú ranu."
**[?]** Znamená to +1 tuhé pre súpera za každú Cirhózu v mojej línii?

### 4. Výsledok

```
víťaz          = vyššie TUHÉ poškodenie;  pri remíze víťazí ÚTOČNÍK
prebytok drží  = vyššie CELKOVÉ poškodenie
prebytok       = |rozdiel celkových|      (pri remíze prebytok nikto nezíska)
```

Víťaz rozdelí prebytočné poškodenie medzi starších. Každý pridelený bod posunie
marker o 1 **smerom k porazenému**. Smie prideliť aj viac bodov tomu istému
staršiemu.

> Napätie hry: desiť staršieho sa oplatí bodovo, ale zároveň tým prihrávaš
> súperovi jeho priazeň v ďalších kolách.

### 5. Poldeci

Poldeci ležiace na kartách cez NA EX sa teraz **vypijú**. Za každú aktívnu akciu
Poldecko sa jeden vypitý poldeci otočí späť na plný. Ak hráč nemá žiadny vypitý
poldeci, Poldecko vyjde naprázdno. Poldecko na karte v súperovej partii sa týka
**majiteľa tej partie**.

### 6. Liečba alebo Pohreb

Každý hráč s **priznanou** Cirhózou smie vykonať jeden z úkonov z kariet vo
svojej partii:

- **Liečba** — spáľ priznanú Cirhózu a kartu s tagom Závislý zo svojej partie,
  získaj 1 Dlh a po Preskúmaní si vyber jednu kartu zo šenku.
- **Pohreb** — spáľ priznanú Cirhózu a ľubovoľnú kartu zo svojej partie.

### 7. Návrat kariet

Všetky karty z oboch partií sa vrátia do odhadzovacieho balíčka **hráča, ktorý
ich zahral** (pri otočených kartách to určuje orientácia).

---

## 9. Starší

8 starších, karta s tagom `Starešina` leží lícom nahor. Pod ňou ukazovateľ.

### Stupnica strachu

9 pozícií, hodnoty `2-2-1-0-0-0-1-2-2`, marker začína v strede (index 4).

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Hodnota | 2 | 2 | 1 | 0 | 0 | 0 | 1 | 2 | 2 |
| Zóna | červená | oranžová | žltá | sivá | sivá | sivá | žltá | oranžová | červená |
| Názov | Vydesenie | Strach | Znepokojenie | Neutralita | | | Znepokojenie | Strach | Vydesenie |

**Konvencia strán** (návrh): indexy 0–2 = polovica hráča 0, 6–8 = polovica
hráča 1, 3–5 = neutrálny stred.

### Dvojaká úloha markera

- **Priazeň (počas hry)** — marker leží na polovici jedného hráča → **ten**
  hráč sa teší priazni. Sila = hodnota pozície (1/2/2).
- **Strach (na konci hry)** — starší sa bojí hráča, **od ktorého je marker
  odtlačený**, teda hráča na **opačnej** strane. Body získava **obávaný** hráč.

### Zamknutá pozícia

- Aby sa marker posunul na **krajnú** pozíciu, musel byť na predposlednej už
  **na začiatku kola** — nie viacerými posunmi v jednom kole.
- Pohoršením sa na krajnú pozíciu dostať **nedá nikdy**.
- Z krajnej pozície sa marker bežným posunom **nepohne**. Uvoľní ju len
  náhrada staršieho.

### Prebudenie

Keď hráč vytlačí marker na krajnú červenú pozíciu, **prebudí staršieho**: od
tej chvíle sa efekt karty staršieho uplatňuje **pre vydesujúceho hráča**, hoci
karta leží na ukazovateli. Priazeň pritom ostáva súperovi.

Spúšťače pri prebudení: **Nástup a Podpora sa NEuplatnia** (karta nie je
v línii). Furt, Bitka, Pitka, Prehra, Výhra a Zhromaždenie fungujú normálne
a vzťahujú sa na vydesujúceho hráča.

### Priazne

| Priazeň | Uplatňuje sa pri | Vplyv |
|---|---|---|
| Očumovateľ | Preskúmanie | 5 + priazeň |
| Lakomec | Trocha | 1 + priazeň |
| Neprajník | Zopár | 2 + priazeň |
| Bitkár | Vyhodnotenie bitky | tuhé poškodenie navyše rovné priazni |
| Veriaci | Hodnota Viery | 1 + priazeň |
| Fajčiar | Prvé zhromaždenie v lokalite | cigaretky navyše rovné priazni |
| Alkoholik | Prah Cirhózy | 2 + priazeň |
| Exekútor | Prah Exekútora | 10 + 2 × priazeň |

**[?]** Pravidlá **neuvádzajú**, ktorý z ôsmich starších dáva ktorú priazeň.
Provizórne priradenie je v `data/elders.json`.

---

## 10. Bodovanie na konci hry

### Bočné bodovacie pozície

Každý ukazovateľ má **8 bočných pozícií** (4 na stranu). Sú rozmiestnené tak, že
tvoria pár s **neprázdnymi akciami karty staršieho** — neprázdna akcia na danom
indexe aktivuje príslušnú bodovaciu podmienku.

Podmienka je splnená **prahovo**: marker musí ležať v určenej zóne **alebo
v ktorejkoľvek intenzívnejšej** (ďalej od obávaného hráča).

Náhrada staršieho zásadne mení bodovanie — nová karta má akcie na iných
indexoch, a tak aktivuje iné podmienky.

**[?]** Konkrétne zóny a body na bočných pozíciách sú vytlačené na
komponentoch, v pravidlách nie sú. Provizórne hodnoty v `data/elders.json`.

### Kategórie

| Kategória | Body |
|---|---|
| Vydesenie / Strach / Znepokojenie | podľa bočných pozícií, získava **obávaný** hráč |
| Ovládnuté lokality | **[?]** |
| Starší získaní náhradou | **[?]** |
| Zvyšné cigarety | **[?]** |
| Nepriznaná cirhóza | záporné, **[?]** koľko |
| Nepriznaný dlh | **−1 za každý** |

---

## 11. Príprava hry

- Lokality: **3** krátka / **6** stredná / **9** dlhá.
  *(V `data/cards.json` je 7 lokalít — na dlhú hru ich nestačí. **[?]**)*
- 8 starších, markery do stredu na 0.
- Každý hráč: **10 štartovacích kariet** do ruky — Pijan, Miňištrant,
  Milujúca manželka, Dievčina na vydaj (v rôznych variáciách).
  **[?]** Presné rozdelenie 10 kariet medzi tie 4 typy pravidlá neuvádzajú.
- Každý hráč začína s **1 fyzickou cigaretou**, **2 nevypitými poldeci**,
  0 dlhmi, 0 poškodením pečene, 0 absťákmi, počítadlom závislosti na 0.
- Zo spoločného doberacieho balíčka sa vyloží **šenok**; počet kariet v šenku
  = počet **nenahradených** starších.

---

## 12. Kliatby

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | akciou Hazard | bez akcií; ráta sa k prahu Exekútora (keď je priznaný); nepriznaný uberá body |
| **Cirhóza** | pri dosiahnutí prahu poškodenia pečene | v bitke pridáva tuhé poškodenie |
| **Absťák** | keď hráč v kole skonzumuje **menej nerestí** než v predošlom | znižuje **tvoje** tuhé poškodenie (o 1 za kus) |

**[?]** „Nerestí" — čo presne sa počíta? Poldeci? Cigarety? Oboje?

---

## 13. Kľúčové pojmy (skratky)

| Pojem | Význam |
|---|---|
| Partia | súvislá kombinácia kariet, ktorú hráč vytvorí počas kola |
| Šenok | ponuka kariet lícom nahor; obaja vidia, čo berú |
| Nástup | vyhodnotenie pri zahraní karty |
| Furt | platí, ak je karta odhalená kdekoľvek v hracom priestore |
| Preskúmanie | zober a prezri si N kariet, potom ich vráť (základ 5) |
| Trocha | základ 1 | 
| Zopár | základ 2 |
| Zahodenie | odstrániť kartu z hry (spáliť) |
| Odhodenie | do odhadzovacieho balíčka hráča, ktorý ju zahral |
| Náhrada | hráč nahradí kartu z množiny určenej efektom |
