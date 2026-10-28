# NA EX! — pravidlá (špecifikácia)

**Pravidlá v8 (zmrazené 2026-10-28)** — dávka návrhov #28, #29, #32, #33 a #34
z playtestu 20261027-161907 (Michal 2026-10-28). Pravidlá sa menia len
v dávkach; celá dávka dostane ďalšiu verziu.

**Zmeny v8 oproti v7** (staré znenia v `docs/pravidla-historia.md`, sekcia v8;
zmeny v7 oproti v6 tamže, sekcia v7):

- **Špaky za bitku = karty v línii** (§9.4, §14, návrh #28): víťaz dostane
  1 špak za každú kartu, ktorá v čase bitky leží v línii na oboch stranách —
  nie za odohrané Pitky.
- **Strach za novú zónu** (§10, §14, návrh #28 B): starší zaplatí víťazovi len
  zóny, ktoré mu ešte nezaplatil (žltá 1, oranžová 2, červená 3); ústup markera
  k stredu vyplatené zóny zmaže.
- **Prebytok rozdeľuje porazený** (§9.4): ten, proti komu sa prebytok ráta, si
  vyberá, ktorých starších posunie; vo finále rozdeľuje držiteľ a strach za nové
  zóny sa vyplatí hneď. Prebytok sa nikde nemení na špaky 1 : 1.
- **Kultúrny dom „Obaja získajú špaky“** (§15, návrh #29): porazený dostane 1 špak za
  každú svoju kartu v línii.
- **Finále** (§14b, návrh #32): posledná bitka je o pinnacle lokalitu a hrá sa
  ako o každú inú; finále bez lokality (sada do v6) z pravidiel aj z hry vypadlo.
  **Ihrisko:** Dvojčatá sa rátajú za dve (§15, §16).
- **Nepriznaná Cirhóza −3** špaky na konci hry (§11, §14, návrh #33).
- **Exekútor bez prahu** (§11, Michal 2026-10-28; nahrádza prah 6 z návrhu #34):
  v každej bitke ku každému s priznaným Dlhom — zhorí polovica Dlhov nahor
  a rovnako špakov, súperova priazeň Exekútora navyše 1 / 2 / 3; **až po
  poškodení a špakoch za bitku** (§9, krok 4c), takže Povery, remíza, Herňa
  a Noviny vidia Dlhy pred exekúciou. **Záhradkár** v tvojej partii ťa exekúcia
  v tomto kole obíde. **Kmotor presúva Dlhy súperovi** (§10, návrh #34).

Špecifikácia pravidiel kartovej hry NA EX! (Michal Calík) pre implementáciu
a testy. Text pre hráčov je na stránke Pravidlá; toto je presné znenie, podľa
ktorého sa hra programuje a overuje.

Poradie kapitol sleduje priebeh partie: **Rýchly štart** (§1–§4), **Kolo krok
za krokom** (§5–§10), **Podrobnosti** (§11–§16) a slovník (§17).

- Karty: `packages/core/data/cards.json` (východisková sada; hra beží na sade
  zverejnenej v tvorcovi). Starší: `data/elders.json`, scorecardy (od v6 len
  priazeň): `data/scorecards.json`. Číselné konštanty: `KONSTANTY` v jadre.
- Platí to, čo robí jadro (`packages/core`). Rozpor textu a hry je chyba na
  rozhodnutie (agent rozhodca, mapa `tools/rozhodca/mapa.json`), nie potichu
  oprava.
- Čo pravidlá nehovoria, nedopĺňaj potichu — spýtaj sa a zapíš to sem.
- Ako sa pravidlá menili a čo platilo predtým: `docs/pravidla-historia.md`
  (zmeny oproti v7: sekcia v8). Partie v archíve nesú `VERZIA_PRAVIDIEL`
  („v4“ … „v8“, staršie dátumové značky).

---

## 1. Cieľ a koniec hry

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality a desia starších. Každé kolo je jedna bitka; hra má toľko
bitiek o lokality, koľko určí dĺžka hry (§3), a po nich **finále** — poslednú
bitku na vrcholovej (pinnacle) lokalite (§14b). Víťazné body sú **špaky** (§14): za vyhratú bitku
(karty v línii) a k nej za nové zóny strachu starších, ktorí sa víťaza boja. Na konci vyhrá, kto má viac
špakov — ak hra neskončí skôr. Pri rovnosti špakov je remíza.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč vydesí aspoň polovicu starších (aj nahradených) a **udrží ich do konca nasledujúceho kola** — ohlásené vydesenie; súper má kolo na odpoveď, napr. patronát nad vydeseným starším vráti marker do stredu (§10) | **vyhráva** |
| Odohrá sa finále (po 3 / 5 / 7 bitkách o lokality podľa dĺžky hry) | vykúpia sa zvyšné plné poldeci a cigarety, odpočíta sa nepriznaná Cirhóza a vyhrá viac špakov (§14) |

Exekúcia prehru nespôsobí — stojí Dlhy a špaky (§11).

Vydesenie sa kontroluje na konci kola (§4) a po každom posune markera:
keď hráčovi klesne počet vydesených starších pod polovicu (patronát, Pohoršenie,
prebytok), ohlásenie **padá hneď** — ak ich v tom istom kole znova doplní,
ohlasuje odznova a musí ich udržať do konca nasledujúceho kola (Michal 2026-10-26).
Malý balíček prehru nespôsobí:
keď sa doberací aj odhadzovací balíček minú, hráč len nemá čo ťahať (a fajčiť
sa vtedy nedá, §7).

---

## 2. Karta, akcie, tagy, varianty

Každá karta má názov, ilustráciu, tagy, **akcie po stranách** a **efekt**.

Akcie sedia v slotoch: 4 vľavo, 4 vpravo, index **0 hore až 3 dole**.
Slot môže byť *blokovaný* (nikdy nedrží akciu) alebo *prázdny*.

### Varianty

`cards.json` popisuje pri každej strane len **multimnožinu akcií** plus
blokované pozície, nie konkrétne rozloženie. Z toho vzniká N rôznych rozložení
a každé je v tlači samostatná karta („Štartovacie karty existujú v rôznych
variáciách“). Pole `permutations` udáva očakávaný počet — je to kontrolný súčet
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

Tagy nemajú vlastné pravidlá, pokiaľ sa na ne neodvoláva pravidlo (napr. NA EX
len na Občana či Starešinu, priznanie len Kliatby) alebo efekt karty.

### Akcie

| Akcia | Kľúč v cards.json | Účinok |
|---|---|---|
| Rana | `Rana` | 1 tuhé poškodenie |
| Pecka | `Pecka` | 2 tuhé poškodenie |
| Petelica | `Petelica` | 3 tuhé poškodenie |
| Povera | `Povera` | mäkké poškodenie do výšky súperových **priznaných** Dlhov; ruší sa s Vierou 1:1 (§9.3) |
| Pohoršenie | `Pohoršenie` | v bitke posunie marker ľubovoľného staršieho o 1 k súperovi alebo k sebe (§9.2) |
| Viera | `Viera` | znižuje súperovo tuhé poškodenie o hodnotu Viery (1; Svätý text v Dedičstve +1) za kus; priazeň Veriaceho pridá Vieru navyše rovnú sile (+1 / +2 / +3); ruší sa s Poverou 1:1 |
| Dlh | `Dlh` | zvýši **zadĺženie** o 1; každé 2 zadĺženia = 1 karta Dlh, hneď priznaná (§8; v7 zvyšok neprepadá); za priznané Dlhy príde v každej bitke Exekútor (§11) |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene (§8) |
| Obmedzenie | `Obmedzenie` | súper dostane v Pitke o 1 cigaretu menej |
| Cigareta | `Cigareta` | +1 **cigareta** v Pitke — cigarety sa prenášajú z kola na kolo; platí sa nimi šenok, Dedičstvo, doliatie, barter a Starosta, fajčením (len v Pitke, §7) dávajú karty |
| Vízia | `Vízia` | na konci Pitky: za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho doberacieho balíčka a vezme si ju do ruky, alebo ju **zahodí** (z hry) |
| Poldeci | `Poldeci` | otočí jeden vypitý poldeci späť na plný — **až pri bitke** (§9.5); v Pitke pridá poškodenie pečene |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú) (§6) |
| Odpor | `Odpor` | zruší prepojenú akciu; Odpor + Odpor = Vzbura (§6) |
| Robota | `Robota` | v kroku exekúcie (po poškodení), **pred** Exekútorom, spáli 1 priznaný Dlh (z hry, §11) |
| Pakt | `Pakt` | **v7:** na spoji sa správa ako akcia, s ktorou je v páre (aj zlá — Dlh, Pečeň). Premení sa ešte pred násobkami: Pakt + Posilnenie = dve Posilnenia, nič sa nezdvojí. Pakt + Pakt nerobí nič. **Odpor** Pakt zruší ako každú akciu (Vzbura nevznikne). Neaktívny Pakt nemá čo kopírovať: do súčtov nejde, NA EX ho nezdvojí a do podmienky „aspoň 1 neaktívna akcia“ (§7) sa neráta. Na hranách lokalít Pakt nie je; pri lokalite kopíruje akciu hrany. Pri Výtržníkovi (§7) je Rana ako každá jeho akcia. |

Akcia sa volá ako karta či zdroj, ktorý dáva: `Dlh` → Dlh, `PoškodeniePečene` →
Poškodenie pečene, `Poldeci` → Poldeci, `Cigareta` → Cigareta (starý kľúč
`Cigaretka` sa pri načítaní sady preloží). Slovo „fyzická cigareta“ sa
nepoužíva — cigareta je cigareta.

---

## 3. Príprava hry

- **Dĺžka hry (liga)** sa volí pred začiatkom počtom lokalít: Tretia liga **3**,
  Druhá liga **5** (predvolená), Prvá liga **7**, potom finále. Ktoré ligy hráč
  smie hrať, určuje admin (odomykanie výhrami proti človeku; web, nie pravidlá).
- **Lokality (v7):** v hre sú **všetky lokality sady** (`cards.json` ich má 19)
  a nežrebujú sa. Každé kolo má **úroveň** podľa rozpisu, ktorý obaja vidia od
  začiatku: Tretia liga **1 · 2 · 3 · P**, Druhá **1 · 2 · 2 · 3 · 3 · P**, Prvá
  **1 · 1 · 2 · 2 · 3 · 3 · 3 · P** (P = pinnacle vo finále). Úroveň lokality je
  počet akcií na jej hrane (obe hrany majú rovnako): 1 spodok, 2 dedina,
  3 sídla dedinskej šľachty, 4 pinnacle s korupciou.
- **8 starších**, každý na **scorecarde** rozdanom náhodne (scorecard určuje
  len priazeň staršieho, §10; bodovacie podmienky od v6 nie sú). Marker
  každého staršieho začína **v strede stupnice** (index 3, jediné sivé pole).
- **Počiatočná ruka:** každý hráč má na začiatku v ruke **4 karty** —
  Miňištrant, Milujúca manželka, Pijan a Dievčina na vydaj (variácie podľa
  sady). **Doberací balíček je prázdny** — naplní ho až odhadzovací (§4).
  Tieto štyri druhy nie sú v spoločnom balíčku ani v šenku.
- Každý hráč začína s **3 cigaretami**, **2 plnými poldeci**, **0 špakmi**,
  0 dlhmi, 0 poškodením pečene, 0 absťákmi a počítadlom nerestí na 0.
- Šenok je na začiatku prázdny — hráči ho postavia v prvom drafte (§5).
- Útočník prvého kola sa určí náhodne (zo semienka hry).

---

## 4. Priebeh kola

```
začiatok kola → voľba cieľa → draft (stavba šenku, branie, patronát)
  → (Zhromaždenie → Pitka) × 1–4 (pinnacle 1–5) → bitka → koniec kola
finále: voľba pinnacle → draft → (Zhromaždenie → Pitka) × 1–5 → bitka → koniec hry   (§14b)
```

**Útočník** = hráč, ktorý **prehral poslednú bitku** (v prvom kole náhodne;
pri sekere ostáva útočníkom; vo finále útočí, kto má menej špakov, §14b). **Berie zo šenku prvý, vykladá prvý a v Pitke má
posledné slovo** (na odkryté NA EX odpovedá druhý, §7) — jeho výhody slúžia
na dobiehanie. **Obranca** je víťaz
poslednej bitky: **vyberá a natáča cieľ** kola a na odkryté NA EX
**odpovedá prvý**. Pitku hrajú obaja naraz (§7).

**Začiatok kola:**

- Každému hráčovi sa otočí **jeden vypitý poldeci na plný** (§6, limit).
- Od druhého kola si každý hráč dobere zo svojho doberacieho balíčka
  **1 kartu** (dobratie po bitke; do 2026-10-27 dve — ďalšie karty sa
  kupujú cigaretami v šenku a fajčením). **Keď sa doberací balíček minie,
  odhadzovací sa zamieša a stane sa z neho nový doberací balíček** — pri
  každom ťahaní, aj uprostred neho. Na začiatku hry je doberací balíček
  prázdny (§3): kým hráč nemá ani odhadzovací, ťahanie nedá nič, fajčiť sa
  nedá a Poštárka sa nepoužije. **Limit ruky nie je** — hráč smie mať kariet, koľko chce. Karty
  navyše dáva šenok, fajčenie v Pitke (§7), priznanie kliatby (§11), Vízia
  a efekty.

**Koniec kola** (po bitke a návrate kariet, §9.7): porovnajú sa neresti
(Absťák, §8), potom sa skontroluje vydesenie (§1).

**Nevyhnutné ťahy:** keď hráč nemá inú možnosť než pasovať (v Zhromaždení)
alebo preskočiť NA EX (v Pitke), hra ten ťah urobí za neho.

---

## 5. Cieľ a draft

### Voľba cieľa

Obranca vyberie lokalitu, o ktorú sa v kole bije, a **natočí ju**. Natočenie
určuje, ktorá hrana lokality leží pri ktorom kraji línie (§6). **v7:** vyberá
zo **všetkých ešte neodohraných lokalít úrovne tohto kola** (§3) — vždy aspoň
z troch; vo finále z troch pinnacle (§14b).

### Stavba šenku

Karty, ktoré zo starého šenku nikto nevzal, idú lícom dole naspodok
spoločného balíčka. Každý hráč si potom zo spoločného balíčka vezme
**N kariet** — N = počet nenahradených starších, zaokrúhlený nadol na párne
číslo; pri nedostatku kariet menej. Obaja naraz a tajne dajú zo svojho balíčka
**polovicu do šenku** a **polovicu naspodok spoločného balíčka** (lícom dole —
súper nevidí, čo hráč odhodil). Keď vyberú obaja, karty do šenku sa odhalia.
Balíčky si hráči nepodávajú. Pri N = 8 je to 4 + 4 a šenok má 8 kariet,
polovicu od každého.

### Branie zo šenku

Hráči berú zo šenku **striedavo, začína útočník**, kým obaja neprestanú. Na
svojom ťahu hráč vezme:

- **1 kartu za 1 cigaretu**, alebo
- **2 karty za 3 cigarety**.

Poldeci sa v šenku neplatí a nič nie je zadarmo. Kto nemá cigaretu, brať
nemôže (hra za neho branie ukončí). Keď jeden prestane, druhý má už len **jednu
poslednú šancu** (jeden ťah), potom branie končí. Prázdny šenok branie ukončí
obom.

Nevzaté karty ostávajú v šenku len do ďalšej stavby — vtedy idú naspodok
spoločného balíčka (Stavba šenku, vyššie); medzitým z neho berú Starosta a Cintorín. Po braní sa šenok **doplní z vrchu spoločného
balíčka na 8 kariet**. Keď sa spoločný balíček minie, šenok sa už nedopĺňa
a stavba sa zmenšuje až na nulu — hra beží ďalej bez trestu.

Hneď po braní dostane hráč s priazňou **Fajčiara** cigarety navyše rovné jej
sile (§10). Nie sú z Pitky, preto ich súperovo Obmedzenie neuberá.

Potom nasleduje **patronát** (§10).

---

## 6. Zhromaždenie

Hráči striedavo vykladajú karty do línie, **začína útočník**. Na svojom ťahu
hráč vyloží kartu na svoju alebo súperovu stranu (v jednom ťahu aj viac kariet,
§13), prizná kliatby (§11) alebo vyloží Nástroj do Dedičstva (§12). Vyloženie
Nástroja sa v striedaní počíta ako ťah, priznanie nie.

### Línia, strany a kraje

- Karty tvoria **jednu súvislú líniu**, vetvenie nie je povolené. **Lokalita**
  leží v jej strede a delí ju na dve **strany** — tvoju (vľavo z tvojho
  pohľadu) a súperovu. Aj vo finále leží v strede lokalita — pinnacle
  (§14b).
- Kartu vykladáš vždy na **vonkajší koniec** jednej zo strán — **tvojej aj
  súperovej**. Strana určuje len to, kde karta leží a s čím susedí.
- **Vnútorná hrana** karty je tá, ktorá je obrátená k lokalite — ňou sa karta
  páruje so susedom bližšie k stredu (prvá karta strany s lokalitou).
  **Vonkajšia hrana** ostáva voľná pre ďalšiu kartu. Z pohľadu hráča, ktorý
  kartu zahral: na jeho strane je vnútorná jeho pravá hrana, na súperovej jeho
  ľavá. Web aj klient agentov ukazujú náhľad spoja pred vyložením a ktorá hrana
  lokality je obrátená ku ktorej strane.
- Karta je vždy **natočená k hráčovi, ktorý ju zahral** (na súperovu stranu
  teda ide „nohami hore“). Ten je jej **majiteľ** a karta je v **jeho partii**:
  **partia hráča = všetky karty natočené k nemu**, nech ležia na ktorejkoľvek
  strane. Text karty „v tvojej partii“ = medzi tvojimi kartami.
- **Akcie** karty sa rátajú jej majiteľovi (výnimky: akcie Nástroja, §12,
  a Kočovníka, §16). Na spoji sa karta páruje so susedmi bežne: susedova akcia
  sa aktivuje a pripíše sa majiteľovi susednej karty. **Efekty** karty (Nástup, Furt, Bitka, Výhra…) patria majiteľovi.
- **Kraje:** polovice línie sa volajú podľa hrán lokality — každá lokalita má
  vlastné (Krčma: *pri výčape* / *pri dverách*; zoznam v §15). „Tvoja/súperova
  strana“ ostáva len ako pomenovanie, ku komu kraj prilieha.
- Nástroj tvorí spoj len s Občanom alebo Starešinom a nesmie susediť
  s Nástrojom na konci strany, kam sa vykladá (§12). Kliatba do línie nepatrí.
  Za kartu, ktorú Hrobár urobil poslednou (Konflikt, §16), sa na tej strane už
  nič nepriloží.
- **Konflikt (v7):** keď súper priloží kartu k tvojej ležiacej karte so
  spúšťačom Konflikt, spustí sa jej efekt — po Nástupe priloženej karty. Vlastné
  priloženie, priložený Nástroj, NA EX ani zrážka Konflikt nespúšťajú (§16).
- Po bitke sa karta vracia do odhadzovacieho balíčka svojho majiteľa (§9.7).

### Spoj a aktivácia akcií

```
PRAVÁ strana karty N  ↔  ĽAVÁ strana karty N+1
```

Akcia je **aktívna**, ak sa na spoji stretnú **dve neprázdne akcie na rovnakom
indexe**. Každá aktívna akcia sa počíta samostatne. **Akcia bez partnera
nerobí nič.** Karta smie ležať aj bez spoja — žiadne pravidlo nevyžaduje, aby
vyloženie spoj vytvorilo.

Otočením o 180°:

- ľavá a pravá strana sa **vymenia**,
- poradie indexov sa **obráti** (0↔3, 1↔2).

```
efektívna_ľavá(otočená)  = pravá čítaná odzadu
efektívna_pravá(otočená) = ľavá čítaná odzadu
```

### Modifikátory na spoji

| Dvojica | Výsledok |
|---|---|
| X + Y (bežné akcie) | obe sa aktivujú, každá ×1 |
| Posilnenie + X | X sa aktivuje ×2 |
| Odpor + X | X je zrušená |
| Odpor + Odpor | **Vzbura**: obe karty vyhodnotia všetky svoje inak neaktívne akcie ako aktívne; lokalita len hranu pri tom kraji, nie obe |
| Posilnenie + Odpor | neprepojené akcie aktivuje **iba karta s Odporom** |
| Posilnenie + Posilnenie | nič sa nedeje — niet čo zdvojnásobiť |

Keď NA EX zruší Posilnenie, zruší aj ×2, ktoré dávalo partnerovi na spoji (§7).

### Prevaha a akcie lokality

Hranu lokality aktivuje karta, ktorá s ňou tvorí spoj, no jej akcie dostane
hráč s **prevahou** v tom kraji: kto tam má **viac svojich Občanov, Zvierat
a Starešinov** (Nástroje, Cirhóza ani iné karty sa nerátajú; Dvojčatá za
dvoch, §16). Pri rovnosti má prevahu hráč, ktorého karta v tom kraji leží
**hneď pri lokalite** (vyložená ako prvá). Jedna podstrčená karta teda
**neukradne akcie hrany**, ale tvorí s nimi spoj: ako prvá karta pri lokalite
určuje, ktoré akcie hrany sa aktivujú, a tie potom dostane hráč s prevahou —
o akcie treba v kraji prevládnuť. Natočenie lokality (volí obranca) určuje,
ktorá hrana leží pri ktorom kraji.

### Limit vykladania

```
limit vykladania = plné poldeci + 1
```

- Vypité (otočené nadol) poldeci sa **nerátajú**.
- **NA EX je mimo limitu vykladania**: dáva sa v Pitke, nie v Zhromaždení, a limit
  nemíňa (ani odpoveď naň, §7). Plný poldeci však z NA EX odíde zo zásoby na
  kartu a do limitu sa už **neráta** — ďalšie Zhromaždenie toho istého kola má
  limit o 1 nižší (súperov sa nemení). Pri bitke sa poldeci vypije (§9.5) a ďalej
  je vypitý, kým sa neotočí na plný (začiatok kola, doliatie, Na zdravie).
- Samotná akcia Poldeci sa do limitu nezapočítava — otáča poldeci až pri
  bitke, takže sa prejaví o kolo neskôr.
- Priznanie (§11) ani Nástroj (do línie aj do Dedičstva, §12) limit nemíňajú.
- Vyloženie na súperovu stranu sa počíta do limitu **hráča, ktorý kartu
  zahral** — bez výnimky (aj Kočovník).
- Každá ďalšia karta v tom istom ťahu stojí plný poldeci (Vypiť, §13), takže
  zostávajúci limit hneď klesne.
- Limit sa počíta **nanovo na začiatku každého Zhromaždenia**.
- **Na začiatku každého kola** (pred voľbou cieľa a stavbou šenku) sa každému
  hráčovi otočí **jeden vypitý poldeci na plný**. Viac vypitých si treba doliať
  (cigarety, barter, akcia Poldeci, Krčmárka — §7, §9.5, §16).
- Limit je vždy aspoň 1 — aj bez plných poldeci hráč v Zhromaždení vyloží
  jednu kartu.
- Už vyložené karty sa nikdy nevracajú.

### Pas a koniec Zhromaždenia

Zhromaždenie končí, keď obaja odohrajú svoj limit alebo obaja pasujú.

**Pas:** kto pasuje, do najbližšej Pitky už nevykladá (súper vykladá sám)
a dostane **1 cigaretu za každú kartu, ktorú ešte smel vyložiť** (zostávajúci
limit), **najviac toľko, koľko má kariet v ruke** — teda min(zostávajúci limit,
karty v ruke); s prázdnou rukou nedostane nič (v6.1). Platí to, aj keď pasuje
hra za neho. Pasovanie ruší aj nevyužité ťahy navyše
z Vypiť. Kto v Zhromaždení nemá čo vyložiť, za toho hra pasuje (fajčiť sa
v Zhromaždení nedá, §7). **Záverečná** (§13) ukončí vykladanie ako pas, ale bez
cigariet.

---

## 7. Pitka

Pred každou Pitkou je Zhromaždenie (§6); počet Pitiek v kole určuje lokalita
(nižšie).

### Poradie: Pitka naraz, útočník má posledné slovo

Pitku hrajú **obaja hráči naraz** (Michal 2026-10-27): každý fajčí, dolieva,
barteruje, použije Kšefty a Úplatky a **skryto vyberie NA EX** (nižšie), kedy
chce, a skončí sám „hotovo“. Súperove kroky (fajčenie, nákupy, Kšefty) vidno
hneď, jeho NA EX nie. „Hotovo“ je **nevratné** a zapíše sa do logu („Hráč X
končí svoju časť Pitky“); kto skončil, v tejto Pitke už nič nerobí. Keď sú
hotoví obaja, **NA EX sa odkryjú** (najprv obrancove, potom útočníkove),
nasledujú odpovede — najprv obranca, potom útočník, ktorý má **posledné
slovo** — a Pitka sa vyhodnotí. **Kohút** (v7) dá posledné slovo svojmu
majiteľovi aj ako obrancovi; **Krčmárka** zakáže súperovi odpovedať kartou na
NA EX jej majiteľa.

**Bzdocha je jediná výnimka:** jej majiteľ **čaká**, kým súper skončí svoju
časť Pitky, a až potom hrá — a vidí súperovo skryté NA EX. Keď má Bzdochu
v partii každý hráč, nečaká nikto (kto skončí neskôr, vidí NA EX toho druhého).

### NA EX

NA EX smie hráč dať **iba v Pitke**, kým ju neskončil, v základe **najviac raz
za Pitku** (Vínna pivnica dvakrát; na Kostole len na kartu v kraji pri
oltári, §15). Vyberie jednu kartu
v línii s tagom **Občan alebo Starešina** — **svoju aj súperovu**, na
ktorejkoľvek strane — a položí na ňu jeden plný poldeci. NA EX vyberá
**skryto**: súper nevidí, či NA EX dal, ani kam (`viewFor` mu to nepošle),
kým sa NA EX neodkryjú.

> NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty, na
> ktorej sa uplatňuje.

- NA EX sa dá len na kartu, ktorá má **aspoň jednu aktívnu a aspoň jednu
  neaktívnu akciu** — nie na kartu bez aktívnej akcie ani na kartu, ktorej sú
  aktívne všetky. Aktívna = spárovaná a nezrušená Odporom; rozhoduje stav
  v okamihu výberu (odpoveď na NA EX už nič nemení). Platí aj pre Veterána.
- **Akcia zrušená Odporom nie je ani aktívna, ani neaktívna** (v6.1): NA EX ju
  nezruší (už zrušená je) ani nezdvojí, a pri výbere karty sa nepočíta ani do
  aktívnych, ani do neaktívnych.
- Na kartu, na ktorej **už poldeci leží** (z predošlej Pitky kola alebo z tvojho
  skrytého NA EX), sa ďalšie NA EX dať nedá. Súperovo skryté NA EX nevidíš —
  obaja tak môžete vybrať tú istú kartu (zrážka, nižšie).
- Na súperovu skrytú **Záverečnú** sa NA EX dá vždy a skryté Záverečné sa do
  posúdenia susedov nerátajú — nič sa nesmie prezradiť (§13).
- Akcie karty po NA EX sa rátajú jej majiteľovi: na súperovej karte mu zrušíš
  aktívne akcie, ale zdvojíš mu neaktívne. Kliatby, ktoré karta po NA EX
  vyprodukuje (zdvojený Dlh či pečeň), patria majiteľovi karty — NA EX zruší
  aktívne akcie (aj vlastný Dlh či pečeň) a zdvojí neaktívne.
- **NA EX na kartu pri lokalite** ruší a zdvojuje len akcie tej karty — akcie
  **hrany lokality** v páre s ňou ostávajú aktívne (dostane ich hráč
  s prevahou v kraji); jediná zmena je ×2 od Posilnenia karty (nasledujúci bod).
- **NA EX na kartu s Posilnením** zruší Posilnenie aj **×2, ktoré dávalo
  partnerovi** na spoji: partnerova akcia (aj akcia hrany lokality) ostáva
  aktívna, ale už len ×1. Akcia, ktorú karta zrušila Odporom, ostáva zrušená.
  Veteránovi NA EX Posilnenie nezruší, takže partner má ×2 ďalej.
- NA EX leží na karte až do bitky — jej akcie sa vyhodnotia v **každej** Pitke
  kola.
- Poldeci **ostáva hráča, ktorý NA EX dal**: do limitu sa neráta (§6) a pri
  bitke sa vypije (§9.5). Poškodenie pečene z NA EX sa počíta **pri odkrytí**,
  ešte v tej Pitke, a pripíše sa tomu, kto NA EX dal (poldeci pije on). NA EX
  je nerest (§8).
- Na **Krčme** hráč s plným poldeci (a kartou, kam ho dať) musí NA EX dať,
  inak Pitku neskončí; prah Cirhózy je tam zato obom o 2 vyšší (§15). Povinnosť
  splní **jedno** NA EX v Pitke; ďalšie je potom dobrovoľné.
- Efekty okolo NA EX: Výpalné (priazeň Výpalníka, §10) a Kar (pečeň súperovi)
  sa uplatnia pri odkrytí; Stryná pri vyhodnotení; Svokra, Pijan a Šofér
  v bitke; Veterán (§16).

### Odkrytie NA EX a Výtržník

Keď skončia obaja, NA EX sa **odkryjú** — najprv obrancove, potom útočníkove.
Až teraz poldeci ľahne na kartu, pripíše sa pečeň a uplatnia sa efekty okolo
NA EX.

**Zrážka:** ak obaja vybrali **tú istú kartu**, ležia na nej poldeci oboch
a z karty je **Výtržník**. Karta sa najprv spáruje so susedmi s pôvodnými
akciami (susedom aktivuje akcie ako bez zrážky), potom sa **všetky akcie na
jej hranách** zmenia na aktívnu **Ranu** pre jej majiteľa — aj akcie bez
partnera na spoji. NA EX jej nič neruší ani nezdvojuje. **Posilnenie aj Odpor
Výtržníka sú už len Rany** (v6.1, Michal 2026-10-27): suseda nezdvojujú ani
nerušia (ani pri Veteránovi) — sused má spárovanú akciu aktívnu ×1 a Odpor
Výtržníka nevyvolá Vzburu. Každý platí za svoje
NA EX ako vždy: pečeň +1 tomu, kto NA EX dal, Výpalné za každé z oboch NA EX
a v bitke sa vypijú oba poldeci (§9.5); Svokra majiteľa
karty ju ráta ako kartu so súperovým NA EX. **Po bitke Výtržník
vytriezvie** — karta má znova pôvodné akcie; Výtržníkom je len počas jednej
bitky.

Príklad (v6.1): karta má na hrane pri susedovi Posilnenie proti jeho Pecke a vedľa
neho Ranu bez partnera. Bez zrážky dá sused Pecku ×2. Keď je z karty Výtržník, jej
Posilnenie aj Rana sú dve aktívne Rany pre jej majiteľa a susedova Pecka platí
len ×1 — Posilnenie, ktoré sa zmenilo na Ranu, už nič nezdvojuje. Rovnako Odpor:
bez zrážky by susedovi Pecku zrušil, Výtržníkov Odpor je Rana pre jeho majiteľa
a susedova Pecka platí ×1.

### Odpoveď na NA EX

Po odkrytí smie hráč za **každé súperovo NA EX** vyložiť **jednu kartu
z ruky** na koniec svojej alebo súperovej strany. Najprv odpovedá **obranca**
(na NA EX útočníka), potom **útočník** (na NA EX obrancu) — útočník má
posledné slovo. Keď NA EX dali obaja (aj pri zrážke), odpovedajú obaja.
Odpoveď limit vykladania nemíňa; kto nemá kartu, ktorú smie vyložiť,
neodpovedá. Cieľ: spárovať neaktívne akcie karty s NA EX — tie sa tým stanú
aktívnymi a NA EX ich zruší. Počas odpovede sa nefajčí ani nedáva NA EX.
Odpoveď je bežné vyloženie: smie zmeniť **prevahu v kraji** aj **počet
Pitiek**. Po odpovediach sa Pitka vyhodnotí.

### Fajčenie, doliatie a barter

- **Fajčenie (len v Pitke):** kým hráč svoju časť Pitky neskončil, smie fajčiť — hneď
  si dobere kartu, ťah mu neskončí. **Cena rastie** (Michal 2026-10-27): prvé
  fajčenie hráča v Pitke stojí **1 cigaretu**, druhé **2**, tretie **3** atď.;
  každá Pitka začína znova od 1 a každý hráč má počítadlo zvlášť (je verejné).
  Nie je to strop — fajčiť sa dá stále, len drahšie. Každá vyfajčená cigareta
  je nerest (§8), teda druhé fajčenie 2 neresti. **V Zhromaždení sa nefajčí.** Keď sú doberací aj odhadzovací balíček
  prázdne, **fajčiť sa nedá** — cigareta by nedala kartu. Na Benzínke sa
  nefajčí (§15).
- **Doliatie, 2 cigarety** (počas Pitky) → otoč jeden vypitý poldeci späť na
  plný. S Vínkom v Dedičstve nie (§16).
- **Stokársky barter, 5 cigariet** (na Jednote o 1 menej) → nový plný poldeci
  navyše.
- Zadarmo sa jeden vypitý poldeci otočí na začiatku kola (§4).
- Čo po finále ostane, sa vykúpi: plný poldeci 1 špak, každých celých
  5 cigariet 1 špak (výkupné, §14).

### Vyhodnotenie Pitky

Po „hotovo“ oboch hráčov:

1. **NA EX** — odkrytie a odpovede (vyššie).
2. **Dlh** — za **každý celý prah** zadĺženia hráč získa kartu Dlh (§8).
3. **Poškodenie pečene a Cirhóza** — za **každý celý prah** pečene hráč získa
   Cirhózu do odhadzovacieho balíčka (§8).
4. **Obmedzenie**
5. **Cigarety** — hráč dostane cigarety za akcie Cigareta:
   ```
   nové cigarety = Cigarety − súperove Obmedzenia (najmenej 0)
   ```
   Priazeň Fajčiara dáva cigarety po braní zo šenku (§5), nie v Pitke.
6. **Ťahanie kariet** — Pitka sama karty nedáva; doberajú sa fajčením,
   priznaním kliatby, Kšeftmi a Víziou.
7. **Vízia** — za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho
   doberacieho balíčka (keď sa doberací balíček minie, odhadzovací sa
   zamieša a stane sa z neho nový doberací balíček)
   a rozhodne: **do ruky**, alebo **zahodiť** (z hry). Rozhoduje obranca,
   potom útočník; vrchnú kartu vidí len
   on.
8. **Otočenie Záverečných** — karty lícom dole sa otočia; ich Nástup
   a Konflikt, ktorý priložením vyvolali, sa vyhodnotia teraz (§13).

Násobky akcií sa **násobia**: NA EX zdvojí neaktívnu akciu, Silná žena ju
zdvojí tiež, spolu ×4 (aj pri Dlhu a Poškodení pečene). Klient aj konzolový
klient ukazujú výhľad „po Pitke“ (`nahladPitky` — ten istý výpočet ako
vyhodnotenie, `prirastkyPitky`).

Po vyhodnotení Pitky sa **pečeň oboch hráčov vynuluje** — zvyšok pod prahom
sa do ďalšej Pitky neprenáša. **Zadĺženie sa nenuluje (v7, D6, Michal
2026-10-27):** zvyšok pod prahom ostáva na účte do ďalšej Pitky aj kola.

### Kšeft (v7)

**Kšeft** je spúšťač aktívneho efektu: „Kšeft: Za <cena> <účinok>.“ Hráč ho
spustí sám **v Pitke, kým ju neskončil** (nie počas odpovede na NA EX, nie po
„končím“), **každú kartu raz za Pitku**. Platí karta odkrytá v hráčovej
partii (aj podstrčená k súperovi, nie skrytá Záverečná), prebudený starší
a Kšeft lokality — ten smie použiť **každý hráč**, každý raz za Pitku. Kšeft
nie je ťah; platba je verejná. Účinok „v tejto bitke“ sa pripočíta v bitke
kola. Kšeft majú Strýko z Ameriky, starší Poštárka a Vychovávateľka (v línii
aj prebudení) a lokality Zberný dvor, Sklad, Obecný úrad a Predsedova vila
(§15, §16). Cigarety za Kšeft karty nie sú nerest; za Kšeft lokality (Zberný
dvor, Sklad, Obecný úrad) áno, ako pri barteri.

### Úplatok (v7)

**Úplatok** je opak Kšeftu: platí **súper**. Na súperovu odkrytú kartu
s Úplatkom (Kulturista) smie hráč v Pitke, kým ju neskončil, dať 1 cigaretu, raz
za Pitku na kartu; účinok je na karte (§16), cigareta prepadne.

### Počet Pitiek

Pitiek v kole = **1 + menší z počtov aktivovaných akcií lokality** na jej
dvoch stranách. Akciu lokality aktivuje karta, ktorá s ňou tvorí spoj; ráta sa
každá aktívna akcia hrany (aj Odpor či Posilnenie v páre). **Odpor na hrane
lokality** sa ráta ako jej aktívna akcia; akcia hrany, ktorú zrušil **Odpor
karty** v páre, sa neráta.

Príklad: hráč A aktivuje 3 akcie lokality, hráč B 1 → **2 Pitky**; kto pri
lokalite nič neaktivuje, kolo má 1 Pitku. Pred každou Pitkou je Zhromaždenie
(limit sa ráta nanovo, začína útočník). Počet sa prepočítava s líniou počas
kola (vykladanie, odpoveď, NA EX); už začatá Pitka sa vždy dopije. Lokality
majú na každej strane 1–4 akcie (úroveň), teda 1–5 Pitiek; aj finále na
pinnacle.

---

## 8. Pečeň, zadĺženie, nerest a Absťák

Pečeň **žije len v Pitke**: ráta sa počas Pitky, vyhodnotí sa v jej krokoch
2–3 (§7) a po Pitke sa vynuluje. **Zadĺženie (v7, D6)** sa po Pitke nevynuluje:
za každé 2 zadĺženia dostaneš Dlh ako doteraz, zvyšok ostáva na účte do ďalšej
Pitky aj kola. **Milujúca manželka** v línii: tvoje poškodenie pečene v Pitke
je o 1 menšie (za každú).

### Zadĺženie a Dlh

Akcia Dlh zvýši zadĺženie o 1. Za **každý celý prah** zadĺženia hráč získa
kartu Dlh:

```
prah Dlhu = 2        (každé 2 zadĺženia = 1 Dlh; zadĺženie 8 = 4 Dlhy)
```

Nový Dlh sa hneď prizná (§11).

### Pečeň a Cirhóza

Poškodenie pečene pridávajú akcie Poškodenie pečene a Poldeci, NA EX (tomu,
kto ho dal, pri odkrytí) a poldeci vypité v predošlom Zhromaždení (Vypiť, §13 — pripíšu sa
do najbližšej Pitky). Za **každý celý prah** pečene hráč získa Cirhózu:

```
prah Cirhózy = 3   (+2 Nealko v Dedičstve, +2 obom v kole o Krčmu)
```

Nová Cirhóza ide do **odhadzovacieho balíčka** hráča (§11).

### Nerest a Absťák

**Nerest** je každý poldeci vypitý v Zhromaždení (ďalšia karta v ťahu), NA EX
(poldeci sa vypije v bitke), každá vyfajčená cigareta (aj tie, o ktoré je
ďalšie fajčenie v Pitke drahšie), doliatie poldeci (2)
a stokársky barter (za každú cigaretu); aj cigareta na Zbernom dvore. Platba za
šenok, Dedičstvo a Starostu sa nepočíta, akcie Cigareta a Poldeci tiež nie.

**Absťák:** na konci kola (po bitke) sa porovnajú neresti hráča s predošlým
kolom:

- **menej nerestí** (s Milujúcou manželkou aj rovnako, §16) → hráč dostane
  **Absťák rovno priznaný** a dobere si zaň kartu,
- **viac nerestí** → jeden priznaný Absťák sa vráti do zásoby,
- prvé kolo len nastaví základ.

Hra si pamätá, koľko Absťákov hráč **získal za hru** (štatistika); keď sa
Absťáku zbaví, toto číslo neklesne.

Každý Absťák hráča znižuje **jeho** tuhé poškodenie v bitke o 1 (§9.3).
Absťáky, ktoré hráč **práve má** (priznané, jeho karty v línii aj v ruke),
navyše rozhodujú remízu v bitke a víťazovi s viac Absťákmi uberajú špaky za
bitku (§9.4). Klient
ukazuje neresti oboch hráčov a výhľad (`stavZavislosti`).

---

## 9. Bitka

Bitka sa vyhodnotí po poslednej Pitke kola, v tomto poradí:

| Krok | Čo sa deje | Kde |
|---|---|---|
| 0 | Efekty na začiatku bitky (Traktoristka; v starej sade Kar) | §9.0 |
| 2 | Pohoršenie (aj z patronátu a z priazne Abstinenta) | §9.2 |
| 3 | Poškodenie — Povery proti priznaným Dlhom pred exekúciou | §9.3 |
| 4 | Výsledok (pri remíze Absťáky, potom Dlhy — pred exekúciou —, inak sekera) | §9.4 |
| 4a | Špaky za bitku (karty v línii) víťazovi, na Kultúrnom dome aj porazenému; Herňa a Noviny podľa Dlhov pred exekúciou; lokalita ide na krčmovú nástenku | §9.4, §14 |
| 4b | Špaky za starších — nové zóny — víťazovi, pri sekere obom (Noviny presunú špaky za bitku, §16) | §10, §14 |
| 4c | Exekúcia (Michal 2026-10-28): Robota, potom Exekútor každému s priznaným Dlhom — Dlhy a špaky; Záhradkár ju obíde | §11 |
| 4d | Prebytok — rozdeľuje ho ten, proti komu sa ráta; posunie markery pre ďalšiu bitku, vo finále sa nové zóny vyplatia hneď | §9.4 |
| 5 | Poldeci (aj Na zdravie „do dna“) | §9.5 |
| 5b | Veštica | §9.5b |
| 6 | Cintorín (Nástroj do Dedičstva porazenému) | §15 |
| 6c | Cigarety za prebytok, priazeň Kmotra (Dlhy súperovi), efekty Výhra a Prehra (Recidivista, Dievčina, Farár, Podvodník), Krokodíl | §9.4, §10, §16 |
| 6d | Patronát | §10 |
| 7 | Návrat kariet; nepriznaná Cirhóza z ruky do odhadzovacieho balíčka | §9.7 |

### 9.0 Efekty na začiatku bitky

Traktoristka bez prevahy (Dlh) (§16). V starej sade (do v6) Kar: každý hráč s nepriznanou
Cirhózou v ruke sa rozhodne (obranca, potom útočník), či jednu zahodí.

### 9.2 Pohoršenie

Každé aktivované Pohoršenie posunie marker jedného staršieho o 1 — **k súperovi,
alebo k sebe** — **bez ohľadu na výsledok bitky**. Staršieho aj smer vyberá
hráč, ktorého akcia sa aktivovala; oba smery smie každý hráč.

- **K súperovi:** súper dostane (alebo posilní) priazeň toho staršieho a starší
  sa začne báť teba (§10).
- **K sebe:** priazeň toho staršieho získaš ty, alebo ju súperovi uberieš.
- Pohoršenie mení priazeň **hneď**, v oboch smeroch: nová priazeň platí už
  v ďalších krokoch tej istej bitky (napr. Bitkár či Veriaci v poškodení,
  krok 3), takže bitku môže rozhodnúť.
- Pohoršenie funguje ako prebytok: **každé posunie marker o jedno pole**, ten
  istý marker smie ísť aj viackrát, **bez limitu** a **aj na krajnú pozíciu**
  (zo stredu na červenú tri Pohoršenia). Ďalej von ako na kraj sa nedá.
- Pohoršenie mení aj **strach hneď** — nová zóna sa ráta už do špakov za
  starších tejto bitky (krok 4b).
- K aktívnym Pohoršeniam pribudnú **Pohoršenia z patronátu** súpera (§10; nie na patróna)
  a Pohoršenia z priazne **Abstinenta** (§10).
- **Poradie:** Pohoršenia rozdeľuje najprv **obranca** (všetky svoje), potom
  **útočník** — každý vidí posuny toho pred ním.

### 9.3 Poškodenie

```
1. Viera a Povera sa vyrušia 1:1
     moja Viera ruší súperove Povery
     moje Povery rušia súperovu Vieru
     cancel = min(viera[ja], povera[súper]);  obom sa odpočíta

2. tuhé[ja] = (Rana×1 + Pecka×2 + Petelica×3 + súperove priznané Cirhózy + sila Bitkára)
             − zvyšná_viera[súper] × hodnota_viery(súper)
             − počet_mojich_absťákov      (Autobusár jeden ignoruje)
     minimum 0

3. mäkké[ja] = min(zvyšná_povera[ja], priznané_dlhy[súper])

4. celkové[ja] = tuhé[ja] + mäkké[ja]
```

**Priznaná Cirhóza škodí tomu, kto ju priznal:** za každú priznanú Cirhózu
hráča dostane súper v každej bitke +1 tuhé (Veterinár to znižuje). Ráta sa ako
tuhé, takže ju zvyšná Viera tiež znižuje. Priazeň Bitkára pridá tuhé rovné
sile (+1 / +2 / +3), priazeň Veriaceho Vieru navyše (§10). Strop mäkkého
poškodenia ruší len Čierna mačka (§16). Tuhé ďalej menia efekty
kariet a lokalít (Pes, Pijan, Svokra, Pasca, Lesná cesta, Ihrisko…, §15, §16).

### 9.4 Výsledok

```
víťaz          = vyššie TUHÉ poškodenie
  remíza v tuhom: vyhrá, kto má MENEJ ABSŤÁKOV (práve teraz: priznané,
                  jeho karty v línii aj v ruke; Autobusár jeden ignoruje)
  aj tu rovnosť:  vyhrá, kto má MENEJ PRIZNANÝCH DLHOV
  aj tu rovnosť:  nevyhrá nikto — SEKERA
prebytok drží  = vyššie CELKOVÉ poškodenie (aj pri remíze v tuhom)
prebytok       = |rozdiel celkových|      (pri rovnakom celkovom ho nikto nezíska)
```

**Špaky za bitku (krok 4a, v8, Michal 2026-10-28):** víťaz dostane **1 špak za
každú kartu, ktorá v čase bitky leží v línii** pri lokalite — na oboch stranách,
jeho aj súperove, aj odkrytá Záverečná, aj vo finále. Nerátajú sa priznané karty
(kliatby), Dedičstvo, lokalita ani karty, ktoré z línie počas kola zmizli
(zahodené, odstránené efektom, Benzínka v bitke). Počet Pitiek špaky neurčuje.
Ak má víťaz **viac Absťákov** ako porazený, dostane o rozdiel menej, ale **vždy
aspoň 1 špak**. Absťáky sa rátajú ako pri remíze. Na Kultúrnom dome dostane aj
porazený 1 špak za každú svoju kartu v línii (§15). Víťaz si **lokalitu neberie** —
karta lokality ide na **krčmovú nástenku** s jeho menom a počtom špakov.

**Sekera:** keď nerozhodne ani tuhé, ani Absťáky, ani Dlhy, bitku nevyhrá nikto
a špaky kola (karty v línii) **čakajú na sekere** — vezme ich víťaz najbližšej
bitky navyše k svojim (bez zrážky za Absťák); viac sekier po sebe sa kopí.
**Vo finále** špaky zo sekery **prepadnú**. Sekera nemení roly (útočník ostáva
útočníkom), patronát sa vyrieši ako prehra (starší späť, bolestné, §10).

**Prebytok (krok 4c)** drží hráč s vyšším celkovým poškodením (spravidla víťaz,
no aj porazený či pri remíze v tuhom). Prebytok sa rozdelí medzi starších až
**po špakoch za bitku a za starších** — prejaví sa teda až v ďalšej bitke. Každý
bod posunie marker o **jedno pole** smerom k súperovi držiteľa (aj na červenú
a aj z červenej von, zamknutie sa ruší, §10): starší sa začnú báť držiteľa
a súper držiteľa dostane ich priazeň. Ten istý starší smie dostať aj viac bodov.

**Kto prebytok rozdeľuje (v8, Michal 2026-10-28):** vyberá **hráč, proti ktorému
sa prebytok ráta** (súper držiteľa) — spravidla porazený si sám vyberie, ktorých
starších posunie, teda ktoré priazne dostane. Pri **sekere** je to ten s nižším
celkovým poškodením; keď drží prebytok porazený (nižšie tuhé, vyššie celkové),
rozdeľuje víťaz. Rozdeliť treba **celý prebytok** — kým sa niektorý marker dá
posunúť, nedá sa prestať; keď sa už nedá žiadny, zvyšok prepadne.

**Prebytok vo finále:** rozdelí ho **jeho držiteľ** (porazenému by priazne už
nepomohli) a strach za nové zóny, ktoré tým vzniknú, sa vyplatí ešte po finále
rovnako ako po bitke — víťazovi finále, pri sekere obom (§14b). Na špaky 1 : 1 sa
prebytok nemení nikde (do v7 po finále a na Kultúrnom dome).

**Cigarety za prebytok:** hráč, proti ktorému sa prebytok rozdeľoval
(spravidla porazený), dostane po bitke **1 cigaretu za každého staršieho,
ktorého marker sa prebytkom posunul**. Viac posunov toho istého staršieho =
1 cigareta; posuny viacerých starších = viac cigariet. Pohoršenie sa neráta.

> Napätie hry: vystrašený starší ti za každú novú zónu raz dá špaky (§10, §14), ale
> súperovi medzitým dáva svoju priazeň — a ktorú, vyberá pri prebytku súper. Kto má
> veľké mäkké poškodenie, môže aj po prehre posunúť markery a v ďalšom kole získať viac špakov.

### 9.5 Poldeci

Poldeci ležiace na kartách cez NA EX sa teraz **vypijú** — každý tomu, kto NA EX
dal (na Výtržníkovi oba, každému jeho). Za každú aktívnu akciu Poldeci sa
jeden vypitý poldeci otočí späť na plný. Ak hráč nemá žiadny vypitý poldeci,
akcia vyjde naprázdno. Týka sa **majiteľa karty**, nech leží na ktorejkoľvek
strane.

**Na zdravie „do dna“** (priazeň Alkoholika, §10): z poldeci, ktoré hráč
v kole položil cez NA EX, sa mu toľko, aká je sila priazne, vráti **plných**
namiesto vypitých. Nerest sa ráta ako vždy.

### 9.5b Veštica

Porazený s Vešticou vo svojej partii si prezrie oba doberacie balíčky,
vymení jednu svoju kartu za súperovu a oba balíčky sa zamiešajú (§16).
Ak je doberací balíček niektorého hráča prázdny, najprv sa doň zamieša jeho
odhadzovací, ako pri ťahaní (§4). Keď niektorý hráč nemá ani doberací, ani
odhadzovací balíček, Veštica sa nespustí.

### 9.7 Návrat kariet

Všetky karty z oboch partií sa vrátia do odhadzovacieho balíčka **hráča, ktorý
ich zahral** (pri otočených kartách to určuje orientácia). Karty zahodené
v bitke (Dievčina na vydaj) sa nevracajú. Lokalita ostáva na nástenke.

**Nepriznaná Cirhóza**, ktorú má hráč po bitke v ruke, ide do jeho
odhadzovacieho balíčka (§11). Cirhóza, ktorú si dobere až na začiatku
ďalšieho kola, mu ostáva v ruke do konca toho kola.

---

## 10. Starší

8 starších, karta s tagom `Starešina` leží lícom nahor na svojom scorecarde.
Pod ňou je ukazovateľ (stupnica s markerom). Scorecard určuje **len priazeň**
staršieho (v6); hráč ju vidí pri staršom aj bez scorecardu.

**Nahradený starší ostáva v hre celý:** marker sa hýbe Pohoršením aj
prebytkom, dáva priazeň aj špaky za strach (nové zóny), karta náhrady môže byť prebudená
a ráta sa do vydesenia. Jediný rozdiel: náhradu si nikto nevezme do ruky
(patronát).

### Stupnica strachu

**7 polí** (v6), sila priazne `3-2-1-0-1-2-3`, marker začína v strede
(index 3). Sivé je jediné pole.

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Sila priazne / špaky za strach | 3 | 2 | 1 | 0 | 1 | 2 | 3 |
| Zóna | červená | oranžová | žltá | sivá | žltá | oranžová | červená |
| Názov | Vydesenie | Strach | Znepokojenie | Neutralita | Znepokojenie | Strach | Vydesenie |

**Konvencia strán:** indexy 0–2 = polovica hráča 0, 4–6 = polovica hráča 1,
3 = neutrálny stred. Každý posun (prebytok, Pohoršenie, §9) je **jedno pole**:
zo stredu do žltej 1, do oranžovej 2, na červenú 3 — a rovnako späť.

### Dvojaká úloha markera

- **Priazeň (počas hry)** — marker leží na polovici jedného hráča → **ten**
  hráč sa teší priazni. Sila = zóna pozície (1 / 2 / 3).
- **Strach** — starší sa bojí hráča, **od ktorého je marker odtlačený**,
  teda hráča na **opačnej** strane, na **úrovni** zóny markera (1 žltá,
  2 oranžová, 3 červená).

**Priazeň a strach nikdy nepatria tomu istému hráčovi.** Posunúť marker
k súperovi (Pohoršením, prebytkom) znamená dať mu priazeň **teraz** a mať
staršieho, ktorý sa bojí **teba**. Posunúť ho Pohoršením k sebe (§9.2)
znamená vziať si priazeň a strach z teba zmenšiť. Marker v sivej zóne: nikto
nemá priazeň a nikoho sa nebojí.

**Strach dáva špaky — len víťazovi, za každú zónu raz** (v6.1, Michal 2026-10-27;
v8, Michal 2026-10-28, návrh #28 B): po bitke (aj po finále) dostane **víťaz
bitky** od každého staršieho, ktorý sa ho bojí, špaky len za **zóny, ktoré mu
tento starší ešte nezaplatil** — žltá 1, oranžová 2, červená 3 (§14). Marker,
ktorý prišiel zo stredu na červenú, zaplatí pri najbližšej výhre 1 + 2 + 3 = 6;
ďalšie výhry už nič, kým sa nepohne. **Porazený za starších nedostane nič** a nič
sa mu ani nezapíše ako vyplatené. Pri **sekere** (§9.4) dostanú špaky za starších
**obaja** (každý od tých, ktorí sa boja jeho). Okrem toho sa strach ráta do
vydesenia (§1) — vydesenie ráta polohu markera, nie vyplatené zóny.

**Vyplatené zóny:** starší si pamätá, po ktorú zónu už zaplatil hráčovi, ktorého
sa bojí. Keď marker **ustúpi k stredu** — akýkoľvek posun k stredu: Pohoršenie,
prebytok, patronát, Kšeft Predsedovej vily, Kapybara —, zóny, z ktorých ustúpil,
sa zmažú a pri ďalšom postupe sa platia znova. Keď marker prejde cez stred na
druhú polovicu, platí nanovo druhému hráčovi. Postup ďalej od stredu nič nemaže.

Príklad: marker Farára na indexe 5 (polovica hráča 1, oranžová zóna), nič
vyplatené — priazeň sily 2 má hráč 1; Farár sa bojí hráča 0. Keď hráč 0 vyhrá
bitku, dostane od Farára 1 + 2 = 3 špaky; ďalšie jeho výhry nič. Keď Farára
Pohoršenie vráti na index 4 (žltá) a ďalšie znova na 5, oranžová sa pri ďalšej
výhre hráča 0 zaplatí znova (2). Bitku, ktorú vyhrá hráč 1, mu Farár nedá nič.

Web počas hry ukazuje pri každom staršom priazeň (komu a s akým účinkom),
koho sa starší bojí a koľko špakov mu dá po najbližšej bitke, ak ju vyhrá
(len nevyplatené zóny).

### Krajná pozícia

**Zamknutie sa v6 ruší:** na krajnú (červenú) pozíciu smie marker aj viacerými
posunmi v jednom kole, prebytkom aj Pohoršením, a z nej ho smie súper odtlačiť
späť. Ďalej von ako na kraj sa nedá.

### Prebudenie

Keď hráč vytlačí marker na krajnú červenú pozíciu, **prebudí staršieho**: od
tej chvíle sa efekt karty staršieho uplatňuje **pre vydesujúceho hráča**, hoci
karta leží na ukazovateli. Priazeň pritom ostáva súperovi.

Spúšťač pri prebudení: **Nástup sa neuplatní** (karta nie je v línii). Furt,
Bitka, Pitka, Prehra, Výhra a Zhromaždenie fungujú normálne a vzťahujú sa na
vydesujúceho hráča.

### Priazne

**Priazeň** pôsobí **silou** 1 / 2 / 3 podľa zóny markera (žltá, oranžová,
červená). Priazeň staršieho určuje scorecard, na ktorom leží (rozdáva sa
náhodne, §3; názov scorecardu = priazeň).

<!-- Stupnice síl sa ešte dolaďujú (docs/pravidla-v5/davka.md) — mení sa len stĺpec „sila 1 / 2 / 3“. -->

| Priazeň | Uplatňuje sa pri | Účinok | sila 1 / 2 / 3 |
|---|---|---|---|
| Bitkár | Poškodenie v bitke (§9.3) | tuhé poškodenie navyše | +1 / +2 / +3 |
| Kmotor | Po bitke (§9, krok 6c) | tvoje priznané Dlhy prejdú medzi súperove priznané (v8); ak ich máš menej, presunie, koľko máš; bez priznaného Dlhu nerobí nič | 1 / 2 / 3 Dlhy |
| Abstinent | Pohoršenie v bitke (§9.2) | Pohoršenia navyše, hrá ich ako svoje | +1 / +2 / +3 |
| Exekútor | Exekútor v bitke (§11) | exekúcia **súperovi** zhorí navyše toľko priznaných Dlhov a špakov (najviac všetky jeho Dlhy) | +1 / +2 / +3 |
| Výpalník — Výpalné | Súperovo NA EX (§7) | za **každé** súperovo NA EX ti súper dá cigarety (koľko má) | 1 / 2 / 3 cigarety |
| Fajčiar | Po braní zo šenku (§5) | cigarety navyše; súperovo Obmedzenie ich neuberá | +1 / +2 / +3 |
| Alkoholik — Na zdravie „do dna“ | Poldeci v bitke (§9.5) | poldeci z tvojho NA EX sa vráti plný | 1 / 2 / 3 za kolo |
| Veriaci | Viera v bitke (§9.3) | Viera navyše; hodnota Viery ostáva 1 | +1 / +2 / +3 |

Kľúče priazní v dátach ostávajú: Kmotor je `UZERNIK` (predtým Úžerník),
Abstinent `LAKOMEC` (predtým Lakomec), Výpalník `NEPRAJNIK` (predtým
Neprajník). Staré sady so Zberateľom či
Očumovateľom sa načítajú ako Kmotor. Preskúmanie (Policajtka, Veštica) je
pevne 5 kariet.

Efekty kariet uvádzajú pevné čísla (Farár „ignoruj 2 súperove Povery“,
Autobusár „ignoruj 1 Absťák“, Poštárka „až 2 karty a s nimi 1 Dlh“…) — číslo
nezávisí od iného staršieho. Čísla sú v kóde v `KONSTANTY.EFEKT`.

### Patronát

Po braní zo šenku (§5) sa rozhoduje **útočník, potom obranca** (druhý už vidí
voľbu prvého); každý smie vziať najviac jedného staršieho za kolo. Hráč,
ktorému starší **prejavuje priazeň** — marker aspoň v **žltej** zóne na jeho
polovici, na ukazovateli ešte pôvodný starší (nie náhrada) — smie:

1. vziať **kartu staršieho do ruky** — v tomto kole ju smie vyložiť ako
   ktorúkoľvek kartu (Starešina: ráta sa do prevahy, smie naň dať NA EX),
2. na jeho scorecard dať **lícom dole** jedného **Občana alebo Zviera** z ruky
   (nie Nástroj, nie Kliatbu) — súper nevie, ktorého (`viewFor` mu ho
   nepošle),
3. posunúť **marker do stredu** (index 3).

Náhradu volí hráč z kariet s viditeľným variantom akcií. Patronát platí aj
vo finále.

Cena:

- **cigarety** podľa zóny markera (v6.1, Michal 2026-10-27): červená **1**,
  oranžová **2**, žltá **3**,
- súper dostane v tejto bitke toľko **Pohoršení navyše**, o koľko polí sa
  marker vrátil do stredu (podľa vzdialenosti od stredu): žltá **1**, oranžová
  **2**, červená **3**. Hrá ich
  ako svoje (§9.2), ale **nie na staršieho, ktorého si patrón vzal** (v6,
  Michal 2026-10-26) — inak by mu marker hneď vrátil a patronát by nezastavil
  vydesenie. Ostatné súperove Pohoršenia (zo stola, z priazne) na patróna smú;
  hra minie najprv tie z patronátu,
- hráč musí mať aspoň **jeden poldeci** (plný či vypitý) — na bolestné.

Po bitke (krok 6d, pred návratom kariet):

- **patrón vyhral** → nechá si staršieho (karta je jeho — z línie sa vráti do
  jeho odhadzovacieho balíčka, v ruke ostáva), karta lícom dole sa otočí
  a ostáva na ukazovateli ako **náhrada**, marker ostáva, kde je,
- **patrón prehral** (aj pri sekere, §9.4) → karta staršieho sa vráti na
  scorecard (z ruky aj z línie), náhrada mu ide späť do ruky a ako
  **bolestné odhodí jeden poldeci** natrvalo — vypitý, ak ho má, inak plný
  (nový stojí barter). Smie klesnúť aj na 0 poldeci. Marker ostáva, kde je.

Kartu staršieho z patronátu nemožno vymeniť Starostom.
Patronát vráti marker z krajnej pozície naraz do stredu — preto je odpoveďou
na ohlásené vydesenie (§1). Bot ho vyhodnocuje z odhadu špakov (`bot.ts`,
`patronat`).

---

## 11. Kliatby, priznanie, Exekútor

### Kliatby

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | za každý celý prah zadĺženia (§8) a priamo z efektov kariet — **hneď priznaný** | bez akcií; za priznané Dlhy príde v každej bitke Exekútor (zhorí polovica nahor a rovnako špakov, §11) a súperove Povery proti nim udelia mäkké poškodenie; pri remíze v bitke prehráva, kto má viac priznaných Dlhov (§9.4) |
| **Cirhóza** | za každý celý prah poškodenia pečene (§8) — ide do **odhadzovacieho balíčka** | nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí **3 špaky** za kus (v8, §14); priznaná dá súperovi v každej bitke +1 tuhé (§9.3) |
| **Absťák** | keď hráč v kole skonzumuje **menej nerestí** než v predošlom (§8) — **rovno priznaný** | znižuje **tvoje** tuhé poškodenie o 1 za kus; víťazovi s viac Absťákmi uberie špaky za bitku a remízu v bitke prehráva, kto má viac Absťákov (§9.4) |

**Verejný dlh:** nový **Dlh sa hneď prizná** — ide medzi priznané karty
a kartu zaň hráč nedobere. Dlh, ktorý sa do balíčka dostane inak, sa pri
dobratí prizná sám (nižšie). Nová **Cirhóza** ide
do **odhadzovacieho balíčka** — do ruky príde, až keď sa doberací balíček
minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Potom
ju hráč prizná, keď chce, alebo ju podrží (Vízia ju môže zahodiť; Anonymný
alkoholik prizná všetky z odhadzovacieho balíčka).

**Nepriznaná Cirhóza po bitke do odhadzovacieho balíčka:** Cirhóza, ktorú má
hráč po bitke v ruke a nepriznal ju, ide do jeho odhadzovacieho balíčka
(§9.7). Hráč sa teda rozhoduje: prizná ju hneď (súper dostane +1 tuhé v každej
bitke), alebo riskuje, že sa mu do konca hry nevráti do ruky a na konci ho
bude stáť 3 špaky (§14). Kým ju nepriznal, súper za ňu tuhé nedostáva.

Na konci hry sa nepriznané Cirhózy rátajú v ruke aj v oboch balíčkoch.

**Verejný počet kliatob:** hráč vidí, koľko nepriznaných Dlhov a Cirhóz má
súper (každý vznik, priznanie aj zahodenie je vo verejnom logu); súperove
špaky na konci hry sú teda presné. Ktoré karty a kde ležia, sa neposiela.

### Priznanie

Kartu s tagom Kliatba možno **priznať** — vyložiť mimo línie do vlastnej
hracej oblasti. **Kliatba do línie nepatrí**, dá sa len priznať; výnimka je
Milujúca manželka, ktorá je aj Občan a má akcie.

- **Priznaná kliatba je natrvalo mimo balíčka** — nevracia sa po bitke ani pri
  zamiešaní odhadzovacieho balíčka. Priznanie je jediný bežný spôsob, ako si
  balíček od kliatob **vyčistiť**; nepriznaná kliatba sa vracia a dobiera
  znova.
- Priznanie **nemíňa limit vykladania** a **neodovzdá ťah**: hráč prizná
  ľubovoľne veľa kliatob za sebou a potom ešte vykladá alebo pasuje. Smie
  priznávať aj pri vyčerpanom limite — kým nepasuje.
- **Dlh sa prizná sám:** keď si ho hráč dobere (ťahanie, fajčenie, Vízia,
  Zberný dvor…), hneď ide do priznaných a hráč ťahá **ďalšiu kartu** — aj tá
  môže byť Dlh a prizná sa tiež.

**Kedy priznanie dá kartu:**

| Kliatba | Karta navyše |
|---|---|
| Dlh dobratý z balíčka | áno — hráč ťahá náhradu (sám sa priznal) |
| Dlh nový (prah zadĺženia, efekt karty) | **nie** — ide rovno medzi priznané |
| Absťák | áno — prichádza rovno priznaný a hráč si zaň dobere kartu |
| Milujúca manželka | áno — pri priznaní si hráč hneď dobere kartu |
| Cirhóza | **nie** |

| | Nepriznaná | Priznaná |
|---|---|---|
| Dlh | — (nový Dlh sa hneď prizná) | **v každej bitke ho páli Exekútor** (aj špaky), ráta sa do remízy v bitke; Povery proti nemu udelia mäkké poškodenie |
| Cirhóza | ide po bitke do tvojho odhadzovacieho balíčka; na konci hry **−3 špaky** | na konci nestojí nič; **súper za ňu v bitke +1 tuhé**; kartu za priznanie **nedostaneš** |
| Milujúca manželka | — | naďalej posúva latku Absťáku (§16) |

Kliatby a špaky (v6): nepriznaná Cirhóza stojí na konci 3 špaky (v8), Dlh berie
špaky cez Exekútora, Absťák víťazovi uberá špaky za bitku (§9.4, §14).

### Exekútor

Krok 4c bitky (§9), aj vo finále — **po poškodení, výsledku a špakoch za bitku
a za starších, pred prebytkom** (Michal 2026-10-28); obranca, potom útočník.
Povery v poškodení, remíza na Dlhy, Herňa a Noviny teda rátajú priznané Dlhy
**pred** exekúciou. Najprv **Robota**: za každú aktívnu Robotu hráč **spáli**
1 priznaný Dlh — v tomto kroku, nie pred poškodením, aby Povere nezobrala cieľ;
zmenší, čo zhorí Exekútorovi. Potom príde **Exekútor — bez prahu, vždy**, ku
každému hráčovi s aspoň 1 **priznaným** Dlhom (nepriznané sa nerátajú):

```
zhorí = polovica priznaných Dlhov, zaokrúhlene NAHOR
        + sila súperovej priazne Exekútora (1 / 2 / 3)
        najviac všetky priznané Dlhy
```

Zhorí toľko priznaných Dlhov a **rovnaký počet špakov** — zhoria, súper ich
nedostane, a hráč smie ísť do mínusu. Exekúcia prehru nespôsobí. Príklad: 5 Dlhov
a súperov Exekútor sily 1 → zhoria 3 + 1 = 4 Dlhy a 4 špaky. Jediný Dlh zhorí
celý (aj s 1 špakom) — až po poškodení, takže Povera ho v tej bitke ešte spočíta.
Priazeň Exekútora sa ráta v čase exekúcie (aj po Pohoršeniach tejto bitky).

**Záhradkár (Exekúcia, Michal 2026-10-28):** keď leží odkrytý v línii v partii
hráča (jeho karta, v tejto bitke), Exekútor ho v kroku 4c obíde — nezhorí mu ani
jeden Dlh a neodpočíta žiadne špaky (ani navyše za súperovu priazeň Exekútora).
Nezahadzuje sa, po bitke sa vráti ako každá karta (§16).

Zvyšné priznané Dlhy na konci hry nestoja nič. Priznané Dlhy pália len Robota
a Exekútor; Obecný úrad, Podvodník a priazeň Kmotra (v8) ich presúvajú
k súperovi.

---

## 12. Nástroje a Dedičstvo

### Nástroj v línii

- **Nástroj potrebuje podporu:** v línii vytvorí spoj len s kartou s tagom
  **Občan alebo Starešina**. Pri lokalite, karte staršieho v strede či karte
  bez týchto tagov (napr. Zviera bez tagu Občan) **spoj nevznikne** —
  neaktivuje sa nič, ani akcia Nástroja, ani akcia suseda. Náradie musí mať kto
  používať.
- **Náradie je spoločné:** akcie Nástroja na spoji dostane **majiteľ karty,
  s ktorou Nástroj tvorí spoj**, nie majiteľ Nástroja. Nástroj medzi kartami
  dvoch hráčov dá každému akcie jeho spoja; podstrčený Nástroj tak pracuje pre
  súpera a súperov Nástroj vedľa tvojho Občana pre teba.
- **Efekt Nástroja v línii neplatí** — len v Dedičstve.
- Nástroj nesmie susediť s Nástrojom na konci strany, kam sa vykladá
  (susedstvo je fyzické).
- Nástroj sa do limitu vykladania **nezapočítava vôbec**, ale jeho vyloženie
  (do línie aj do Dedičstva) sa v striedaní počíta ako ťah (§6).

### Dedičstvo

Nástroj možno namiesto do línie vyložiť do hracej oblasti ako **Dedičstvo**;
tam sa uplatňuje jeho pasívny efekt `Dedičstvo`. Poldeci sa na Nástroje
neuplatňujú, NA EX sa na ne dať nedá.

**Dedičstvo stojí cigarety a cena rastie spoločne pre oboch:** prvý Nástroj
vyložený do Dedičstva v hre stojí **1** cigaretu, druhý (hocktorého hráča)
**2**, tretí **3** atď. Bez cigariet Nástroj do Dedičstva nevyložíš, do línie
áno. Z Dedičstva sa Nástroj do línie nevracia.

Efekt v Dedičstve funguje ako malá priazeň: Nealko prah Cirhózy +2, Svätý
text Viera +1, Puška a Vidly (Petelice a Rany o 1 viac), Krabička cigariet,
Noviny, Pasca, Výherný automat, Vínko, Lievik (§16).

---

## 13. Pokročilé ťahy

### Vypiť — viac kariet v jednom ťahu

V **Zhromaždení**, keď je na ťahu, smie hráč **vypiť**: otočí jeden **plný
poldeci na vypitý**. Samostatné tlačidlo na to nie je — hráč v ťahu
jednoducho vyloží viac kariet a **každá ďalšia karta po prvej stojí plný
poldeci** (pred ňou sa vypije). Klient posiela celý ťah naraz (príkaz `tah`:
priznania, potom karty a pred každou okrem poslednej Vypiť); server ho vykoná
celý, alebo vôbec.

**Poradie:** Vypiť ide pred kartu, po ktorej chce hráč pokračovať — pri dvoch
kartách **Vypiť, karta, karta**; „karta, Vypiť, karta“ nejde, prvá karta ťah
ukončí. Za každé vypitie:

- jeho **ďalšie vyloženie neukončí ťah** — zahrá dve karty (priznania,
  Nástroje) za sebou, súper medzitým nereaguje,
- jeho **zostávajúci limit vykladania hneď klesne o 1** (poldeci už nie je
  plný; v ďalších Zhromaždeniach sa limit počíta z plných poldeci ako vždy),
- dostane **+1 poškodenie pečene** a pitie sa ráta ako **nerest** (§8). Pečeň
  sa vyhodnocuje len v Pitke: +1 sa pripíše dopredu a prah Cirhózy sa
  skontroluje v najbližšej Pitke.

Piť smie **opakovane**, kým má plné poldeci — každé vypitie pridá ďalšie
vyloženie bez odovzdania ťahu. Pasovanie nevyužité ťahy navyše ruší. Vypitý
poldeci sa dá doliať (§7) a jeden sa doleje sám na začiatku kola. Keďže každé
Vypiť zníži limit o 1, dve karty v jednom ťahu treba limit aspoň 3, tri karty
limit 5 — **pri limite 3 sú v jednom ťahu najviac dve karty**. Na Zastávke
(spoločný limit oboch) vypitie znižuje spoločný limit. V kole o Kostol sa
nepije (v ťahu teda len jedna karta).

### Záverečná

Na svojom ťahu v Zhromaždení smie hráč za **1 cigaretu** zahrať kartu z ruky
ako **Záverečnú** — lícom dole na koniec svojej alebo súperovej strany. Je to
voliteľné a hráč tým v tomto Zhromaždení **končí s vykladaním** (ako pas, ale
**bez cigariet za pas**); v jednom Zhromaždení teda najviac jedna.

- Je to bežné vyloženie: **míňa limit** (Nástroj nie), smie byť aj ďalšou
  kartou ťahu po Vypiť a platia pre ňu všetky pravidlá vykladania.
- Kým leží lícom dole, **ráta sa normálne** — akcie, spoje, prevaha, tuhé.
  Súper z nej nevidí nič (ani meno v logu); jej príspevok mu ostáva neznámy.
- **Za ňu sa nedá priložiť** žiadna karta (ani odpoveď na NA EX), kým sa
  neotočí — tá strana je dovtedy zablokovaná.
- **NA EX** na ňu smie v Pitke dať len **súper** a prejde vždy (nekontroluje
  sa tag ani aktívne a neaktívne akcie — odmietnutie by kartu prezradilo);
  vyhodnotí sa ako na každej karte. Majiteľ na ňu NA EX dať nesmie.
- **Otočí sa na konci Pitky**, ktorá nasleduje po jej Zhromaždení (pred
  ďalším Zhromaždením alebo bitkou, krok 8 v §7). Až vtedy sa vyhodnotí jej
  **Nástup** a **Konflikt**, ktorý priložením vyvolala (§16); Kšeft ani
  Úplatok karty lícom dole použiť nemožno. Živnostník smie Nástroj priložiť
  aj pri otočení.

### Podstrčenie (sabotér)

Súperovi môžeš na jeho stranu podstrčiť kartu — jej Odpor mu zruší akciu na
spoji, jej akcie bodujú pre teba a zaberie mu koniec strany. Karta ostáva
v tvojej partii a míňa tvoj limit (§6). Jedna podstrčená karta neukradne akcie
hrany lokality, ale tvorí s nimi spoj: ak leží pri lokalite, určuje, ktoré
akcie hrany sa aktivujú, a dostane ich hráč s prevahou v kraji (§6).
Podstrčený Kočovník je výnimka z „akcie bodujú pre teba“ — jeho akcie dostane
hráč s prevahou v jeho kraji (§16). Podstrčený Pes nedá nič (§16) a na Moste
sa na súperovu stranu nevykladá (§15).

---

## 14. Špaky

**Špaky** (v6, Michal 2026-10-26) zbiera hráč počas celej
hry a klient ich ukazuje ako ohorky v popolníku pri mene hráča. Špaky sú
verejné. Vyhrá, kto má na konci hry (po finále) viac špakov; rovnosť je remíza.

| Odkiaľ | Koľko | Kedy |
|---|---|---|
| Vyhratá bitka | 1 za každú kartu v línii na oboch stranách (v8; aj finále), mínus o koľko má víťaz viac Absťákov než porazený, **aspoň 1**; plus špaky zo sekery | krok 4a (§9.4) |
| Prehratá bitka o Kultúrny dom (v8) | 1 za každú svoju kartu v línii | krok 4a (§15) |
| Starší, ktorí sa ťa boja | za každú **novú** zónu (v8): žltá **1**, oranžová **2**, červená **3** — čo starší už zaplatil, neplatí znova, kým marker neustúpi (§10); sivý nikomu; aj nahradený | len **víťazovi** bitky, aj finále (aj po prebytku vo finále); pri **sekere obom**; porazený nič (v6.1; krok 4b) |
| Noviny v Dedičstve (v7) | špaky za bitku dostane porazený, keď má víťaz viac priznaných Dlhov | krok 4a |
| Exekútor | **−** polovica priznaných Dlhov nahor, + sila súperovej priazne Exekútora — v každej bitke, kým má hráč priznané Dlhy (Záhradkár v partii ju v tom kole obíde); na konci hry Dlhy nič | krok 4c (§11) |
| Výkupné zdrojov | **+1** za každý plný poldeci, **+1** za každých celých 5 cigariet (nadol); **bez stropu** | na konci hry, po finále |
| Nepriznaná Cirhóza | **−3** za kus (v8; ruka aj oba balíčky) | na konci hry, po finále |

**Výkupné** (Michal 2026-10-27): zdroje, ktoré hráčovi po finále ostanú, sa
vykúpia za špaky — prebytok sa tak dá zúžitkovať aj na konci, nič neprepadá
a hra ho neobmedzuje stropom. Ráta sa **plný poldeci** v zásobe hráča (§6,
limit vykladania): vypitý poldeci nie, poldeci ležiaci cez NA EX sa v bitke
vypije (§9.5) a tiež nie; Vínko je len limit, nie poldeci. Cigarety sa delia
piatimi a zvyšok prepadne (14 cigariet = 2 špaky). Zdroje oboch hráčov sú
verejné, preto aj výkupné — klient ho ukazuje v riadku „Koniec“ krčmovej
nástenky a v „keby skončila teraz“.

Špaky smú klesnúť do mínusu. **Krčmová nástenka** ukazuje odohrané bitky:
lokalitu (aj pinnacle finále, s príznakom finále), počet kariet v línii, víťaza a špaky za
bitku; klient z nej skladá aj rozpis popolníka.

Scorecard nesie len **priazeň** staršieho (§10). Bodovacie podmienky (Lokality,
Starší, Cigarety, Rezerva, Cirhóza, Dlhy, Absťák, zóny strachu) sa v6 rušia —
ovládnuté lokality už nie sú, preto padá aj všetko, čo sa na ne odvolávalo.

## 14b. Finále

Po poslednej bitke o lokalitu (3 / 5 / 7) sa hrá **finále** — posledná bitka
na **pinnacle lokalite** (Poľovnícka chata, Predsedova vila, Herňa). Hrá sa
**ako každé kolo**: lokalita leží v strede línie, karty sa kladú k nej a platia
jej hrany, efekt, kraje aj prevaha (Kočovník, Dvojčatá ako inde).
- **Útočí zaostávajúci** — hráč s **menej špakmi** (Michal 2026-10-27, mení
  rozhodnutie z 26. 10.). Pri rovnosti útočí ten, kto **prehral poslednú
  bitku**; keď posledná bitka skončila sekerou, útočník ostáva útočníkom.
  Útočník vykladá prvý a v Pitke má posledné slovo.
- **Obranca — hráč, ktorý vedie** (viac špakov) — vyberie a natočí pinnacle
  lokalitu (z troch, §5). Potom šenok, branie a **patronát** ako v každom kole.
- Pitiek je ako na každej lokalite **1 + menší počet aktivovaných akcií hrán**
  (1–5) — teda podľa spojov s lokalitou. Víťaz dostane **1 špak za každú kartu
  v línii** (v8; mínus rozdiel Absťákov, aspoň 1); na Herni navyše toľko, koľko má
  porazený priznaných Dlhov (§15). Sekera vo finále špaky kola aj zo sekery
  **prepadnú**.
- Po finále sa ešte rozdajú **špaky za starších** (nové zóny) — ako po každej
  bitke len víťazovi finále, pri sekere obom (§14). Potom **prebytok** rozdelí jeho
  držiteľ medzi starších (§9.4) a strach za nové zóny, ktoré tým vzniknú, sa
  vyplatí hneď rovnako — víťazovi finále, pri sekere obom.
- Potom sa vykúpia zvyšné zdroje (plný poldeci 1 špak, každých celých
  5 cigariet 1 špak, §14), odpočíta sa nepriznaná Cirhóza (−3 za kus) a vyhrá
  hráč s viac špakmi.

Bez lokality sa nehrá nikdy. Sada, ktorá nemá lokality každej úrovne vrátane pinnacle, finále nemá — hra
skončí po poslednej lokalite (len testovacie sady).

## 15. Lokality

**v7: 19 lokalít po úrovniach** (§3) — 1: Zastávka, Most, Lesná cesta,
Cintorín, Jednota; 2: Ihrisko, Benzínka, Kar, Zberný dvor, Krčma, Sklad;
3: Obecný úrad, Kultúrny dom, Vínna pivnica, Družstvo, Kostol; pinnacle (len
finále): Poľovnícka chata, Predsedova vila, Herňa. Hrany sú v `cards.json`
(plan.md 7.4). Zmenené a nové efekty v7 a v8 (majú prednosť pred tabuľkou v6 nižšie):

| Lokalita | Kedy | Efekt v7 a v8 |
|---|---|---|
| Lesná cesta | Bitka | +1 tuhé za každé **svoje Zviera** v súperovom kraji, bez stropu. |
| Cintorín | Prehra | Porazený smie vyložiť jeden Nástroj z ruky alebo zo šenku do Dedičstva bez platenia; spoločná cena Dedičstva sa zvýši ako vždy (§12). Pri sekere nikto. |
| Jednota | Pitka | Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani dolievať (doliatie = 2 cigarety za vypitý poldeci; barter smie). Pri rovnosti smú obaja. |
| Benzínka | Pitka | Fajčiť smie len hráč, ktorého Občan alebo Starešina leží **najďalej od lokality** (index na strane, na ktorejkoľvek strane, skrytá Záverečná sa neráta). Pri rovnakej vzdialenosti nefajčí nikto (Michal 2026-10-27). |
| Kar | Pitka | Poškodenie pečene za NA EX dostane **súper** hráča, ktorý ho dal (poldeci a nerest ostávajú dávajúcemu). |
| Kostol | Zhromaždenie, Pitka | Nikto nesmie vypiť (v ťahu teda len jedna karta). NA EX sa smie dať len na kartu v kraji **pri oltári** (pri vytlačenej ľavej hrane; s otočeným Kostolom pri strane hráča 1). |
| Zberný dvor | Kšeft | Za 1 cigaretu (nerest) ľubovoľná karta zo svojho odhadzovacieho balíčka do ruky, raz za Pitku. |
| Sklad | Kšeft | Za 1 cigaretu (nerest) vrchná karta **súperovho** odhadzovacieho balíčka do tvojej ruky — odteraz je tvoja; pri prázdnom sa nedá. Kraje pri vreciach / pri strážnici. |
| Obecný úrad | Kšeft | Za 3 cigarety (nerest) presuň 1 svoj priznaný Dlh medzi súperove priznané. Robota tu páli 1 Dlh ako inde. |
| Poľovnícka chata | Furt | Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát (Dlh, Pečeň, Posilnenie, Pohoršenie nie). Kraje pri trofejach / na posede. |
| Predsedova vila | Kšeft | Za 2 cigarety posuň marker ľubovoľného staršieho o 1 k súperovi alebo k sebe; nie staršieho, ktorého si súper v tomto kole vzal do patronátu. Kraje pri bazéne / v pracovni. |
| Herňa | Bitka | Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov (pri bitke, pred Robotou a Exekútorom; bez stropu); pri sekere nič. Kraje pri automatoch / v zadnej miestnosti. |
| Kultúrny dom | Bitka | **Obaja získajú špaky** (v8, Michal 2026-10-28, návrh #29): víťaz dostane špaky za všetky karty v línii ako inde, porazený 1 špak za každú svoju kartu v línii (svoju partiu, na ktorejkoľvek strane). Pri sekere nikto nie je porazený — špaky kola idú na sekeru ako inde. Prebytok sa rozdeľuje ako inde (§9.4). |
| Ihrisko | Bitka | V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (pri rovnosti nikto) — rátajú sa ako do prevahy, **Dvojčatá za dve** (v8, návrh #32); z oboch krajov teda až +4. |

Tabuľka v6 — platí len pre lokality, ktoré v tabuľke vyššie nie sú (Krčma, Zastávka, Most, Vínna pivnica, Družstvo). Akcie na hranách určujú počet Pitiek (§7); efekt platí v kole,
keď je lokalita cieľom. Po bitke ide lokalita na krčmovú nástenku (§14) —
nikto ju neovláda.

| Lokalita | Kedy | Efekt |
|---|---|---|
| Krčma | Pitka | Kto má plný poldeci a Občana či Starešinu v línii (vlastného či súperovho), musí dať NA EX (skryto ako vždy, §7) — bez neho Pitku neskončí. Prah Cirhózy je v kole o Krčmu obom o 2 vyšší (sčíta sa s Alkoholikom a Nealkom). |
| Kostol | Zhromaždenie, Pitka | Nikto nesmie vypiť (v ťahu teda len jedna karta) ani dať NA EX. |
| Benzínka | Pitka | Nikto nesmie fajčiť. |
| Zastávka | Zhromaždenie | Spoločný limit vykladania pre oboch = súčet limitov oboch hráčov; každé vyloženie a Vypiť ho míňa obom. **Pas** dá cigarety najviac za **vlastný** limit hráča mínus to, čo v tomto Zhromaždení sám vyložil a vypil — nie za spoločnú zásobu. |
| Lesná cesta | Bitka | +1 tuhé za každého svojho Občana, Zviera či Starešinu v súperovom kraji, najviac +2. |
| Zberný dvor | Pitka | Raz za Pitku: za 1 cigaretu karta z vlastného odhadzovacieho balíčka do ruky (cigareta je nerest ako pri barteri). |
| Most | Zhromaždenie, Pitka | Karty sa smú vykladať len na vlastnú stranu — aj odpoveď na NA EX. |
| Kar | Bitka | Na začiatku bitky smie každý hráč (obranca, potom útočník) zahodiť jednu **nepriznanú** Cirhózu z ruky — navždy z hry (§9.0). |
| Obecný úrad | Bitka | Prah Exekútora je o 4 nižší; každá Robota spáli 2 priznané Dlhy namiesto 1. |
| Jednota | Pitka | Stokársky barter (nový poldeci) je o 1 cigaretu lacnejší. |
| Vínna pivnica | Pitka | NA EX smie hráč dať v Pitke až dvakrát (obe skryto, na dve rôzne karty). |
| Družstvo | Zhromaždenie | Karty s tagom Pracujúci nemíňajú limit vykladania. |

**Kraje lokalít** (vytlačená ľavá / pravá hrana): Krčma pri výčape / pri
dverách · Kostol pri oltári / pri vchode · Benzínka pri pokladni / za budovou ·
Zastávka pod strieškou / pri ceste · Lesná cesta v húštine / pri kríži ·
Ihrisko na trávniku / na tribúne · Zberný dvor pri váhe / za plotom · Most pri
kaplnke / pod mostom · Cintorín pri hroboch / pri márnici · Kar pri vdove / pri
koláčoch · Obecný úrad v kancelárii / na chodbe · Jednota pri pulte / pred
obchodom · Kultúrny dom na parkete / pred vchodom · Vínna pivnica pri sudoch /
na schodoch · Družstvo na poli / na schôdzi. Akcie hrany dostane hráč
s prevahou v kraji (§6).

---

## 16. Výklad kariet

Všetky efekty sady engine vyhodnocuje automaticky. Nejednoznačné texty sa
vykladajú takto. „Okolie“ karty = jej susedia v línii na oboch stranách, bez
ohľadu na majiteľa (aj lokalita či starší v strede). Texty kariet sú od v7
(Michal 2026-10-27, plan.md 14.0) „len spúšťač a efekt“ — výklad patrí sem.

**Konflikt (v7, plan.md 13):** efekt **ležiacej** karty, keď k nej **súper**
priloží svoju kartu (na koniec strany, v Zhromaždení aj odpoveďou na NA EX).
Keď kartu prikladáš ty k svojej, Konflikt nevyvoláš; priložený **Nástroj**
Konflikt nevyvolá; **NA EX** ani zrážka ho nespúšťajú. Najprv sa vyhodnotí
Nástup priloženej karty, potom Konflikt. Záverečná priložená ku karte
s Konfliktom ho vyvolá až pri otočení na konci Pitky (§13). Lokalita Konflikt
neprepožičiava. **Vyvolať Konflikt** = priložiť kartu k súperovej ležiacej
karte s Konfliktom (§17). Stav „na spoji so súperovou kartou“ (Pes) je Furt,
nie Konflikt.

**Úplatok (v7, Kulturista):** opak Kšeftu — platí súper. V Pitke na svojom
ťahu (nie pri odpovedi na NA EX) smie dať na súperovu kartu s Úplatkom
1 cigaretu, raz za Pitku na kartu. Každá zníži do konca kola útoky karty
o stupeň: Petelica → Pecka → Rana → nič (akcia ostáva spárovaná, len sa
neráta). Cigareta prepadne (nikto ju nedostane).

| Karta | Výklad |
|---|---|
| Veľmi smútiaca vdova | Konflikt: ak je priložená karta Chlap, po bitke ide z hry (nevráti sa do balíčka). Jej akcie v bitke platia. |
| Policajtka | Konflikt: súper, ktorý k nej priložil kartu, získa 1 Dlh (hneď priznaný, §11). Ak je priložená karta Kriminál, namiesto toho dá majiteľovi Policajtky 2 cigarety (koľko má). Autorita — súperov Praudovravec ju umlčí (len stará sada). |
| Stryná | Pitka: každý hráč, ktorý v tejto Pitke nedal NA EX (pri odkrytí), dostane pri vyhodnotení 1 poškodenie pečene — za každú Strynú v línii, bez ohľadu na majiteľa. |
| Recidivista | Prehra: keď jeho majiteľ prehrá bitku, Recidivista sa po bitke vráti do jeho ruky (nie do balíčka). Pri sekere nie. |
| Liberál | Pitka: ak v súperovej partii nie je rovnako žien a chlapov (karty s tagom Žena / Chlap, skrytá Záverečná sa neráta), súper získa pri vyhodnotení 1 zadĺženie za každého Liberála. |
| Živnostník | Nástup: hneď za neho smie majiteľ priložiť 1 Nástroj z ruky na tú istú stranu — mimo limitu vykladania; Nástroj s ním tvorí spoj (§12). Hra počká na voľbu ako pri Hasičovi; v ťahu s viacerými kartami sa voľba robí hneď po Živnostníkovi (ďalšia karta na tú stranu ju zruší). Ako Záverečná: pri otočení. |
| Šarlatán | Konflikt: do konca kola sa jeho akcie Dlh rátajú ako Viera a Povera ako Rana (mení sa druh, nie aktivita); po bitke ide do balíčka s pôvodnými akciami. |
| Pes | Furt: jeho aktívne akcie na spoji so súperovou kartou (strana Psa k tej karte) sa rátajú dvakrát; násobky sa násobia (§7). Platí aj podstrčený či podstrčením vzniknutý spoj. |
| Mäsiar | Furt (Michal 2026-10-28): **efekty Zvierat** v jeho okolí (oboch hráčov) neplatia, kým s ním susedia; ich **akcie sa rátajú normálne**. Týka sa Psa, Koňa a Čiernej mačky (Furt), Krokodíla (Bitka, aj jeho koniec bitky), Kohúta (Pitka) a Recidivistu (Prehra — rozhoduje okolie v chvíli, keď sa efekt spúšťa). Kapybara priložená k Mäsiarovi sa nespustí; Nástup, ktorý už prebehol, sa nevracia. Mäsiar lícom dole (Záverečná) ešte nič neumlčí. Do 2026-10-28 Mäsiar rušil akcie Zvierat. |
| Krokodíl | Bitka: na konci bitky idú z hry všetci Občania a Zvieratá v jeho okolí (oboch hráčov); Starešinovia a Nástroje nie. Ich akcie v bitke ešte platia. |
| Kapybara | Nástup: marker jedného staršieho (podľa voľby majiteľa) sa posunie o 1 pole k stredu. |
| Kohút | Pitka: posledné slovo pri odpovediach na NA EX (§7) má jeho majiteľ aj ako obranca — súper odpovedá prvý. Keď ho majú obaja, platí bežné poradie. |
| Pijan | Bitka: za každé NA EX, ktoré majiteľ v tomto kole dal (poldeci ešte leží na karte), udelí súperovi Ranu navyše — za každého Pijana. |
| Milujúca manželka | Pitka: tvoje poškodenie pečene v Pitke je o 1 menšie (najprv z akcií Poškodenie pečene, potom z Poldeci); latku Absťáku nemení, nie je Kliatba. |
| Miňištrant | Nástup: ak ho majiteľ priložil k súperovej karte s Konfliktom (vyvolal Konflikt), do konca kola sa jeho Viera ráta ako Pecka. |
| Dievčina na vydaj | Prehra: keď jej majiteľ prehrá, zahodí sa (z hry) a víťaz získa toľko Dlhov, koľko mala aktívnych akcií (s násobkami). |
| Snúbenica | Konflikt: ak je priložená karta Chlap, po bitke ide do odhadzovacieho balíčka majiteľa Snúbenice a odteraz je jeho. |
| Bzdocha | Pitka: Súper hrá Pitku pred tebou; vidíš jeho NA EX. Majiteľ čaká, kým súper skončí svoju časť Pitky, potom hrá a vidí súperove skryté NA EX; majú ju obaja → nečaká nikto (§7, Michal 2026-10-27). |
| Záhradkár | Exekúcia (Michal 2026-10-28): „Exekúcia v tomto kole pre teba neplatí.“ Keď leží odkrytý v línii v partii majiteľa (jeho karta, aj na súperovej strane), Exekútor ho v kroku exekúcie (§9, 4c) obíde — nezhorí mu žiadny Dlh ani špak (ani navyše za priazeň Exekútora). Nezahadzuje sa; v ruke či v balíčkoch nerobí nič. Súperov Záhradkár ťa nechráni. |
| Anonymný alkoholik | Nástup: majiteľ prizná všetky nepriznané Cirhózy zo svojho odhadzovacieho balíčka (§11). |
| Dohadzovačka | Nástup (Michal 2026-10-28): keď ju hráč priloží k Občanovi alebo Starešinovi O2 (jej vnútorný sused, karta ktoréhokoľvek hráča), z **druhej strany lokality** sa **najvzdialenejší** (od lokality) Občan alebo Starešina opačného pohlavia ako O2 (Žena ↔ Chlap; karta ktoréhokoľvek hráča) presunie za Dohadzovačku — na vonkajší koniec jej strany. Príklad: „O1 … … O2“, Dohadzovačka za O2 → „… … O2 · Dohadzovačka · O1“. Presun je **povinný**, bez voľby. Karta ostáva svojho majiteľa a natočená k nemu, medzera na druhej strane sa uzavrie a spoje sa prepočítajú. Karta s oboma tagmi (Liberál) sa ráta ako oboje — ako O2 hľadá Ženu aj Chlapa, ako O1 sa hodí k obom. Presun **nie je priloženie**: Konflikt presunutej ani susednej karty sa nespustí a Pasca ho neráta. Skrytá Záverečná sa nepresúva (a ako O2 nerozhoduje); ako Záverečná sa Dohadzovačka vyhodnotí pri otočení. Ak O2 nemá Ženu ani Chlapa, nie je Občan ani Starešina, alebo na druhej strane nie je vhodný O1, nič sa nestane. Do 2026-10-28 Bitka: karta zo šenku za zmiešané spoje. |
| Kulturista | Úplatok (vyššie). |
| Vymáhač | Bitka: za každé 2 tvoje priznané Dlhy Rana navyše (za každého Vymáhača). |
| Finančná poradkyňa | Pitka: Dlhy z jej akcií dostáva súper, nie majiteľ. |
| Svokra | Bitka: za každú kartu majiteľa (na ktorejkoľvek strane, aj Svokru samu), na ktorej leží súperov poldeci z NA EX, udelí súperovi Ranu; ráta sa aj zrážka (Výtržník), vlastné NA EX nie. Každá Svokra zvlášť. |
| Hasič | Nástup: z majiteľovho odhadzovacieho balíčka sa vytiahne náhodná karta (aj kliatba); majiteľ si ju nechá v ruke (Dlh sa sám prizná), alebo ju vráti. Kým nerozhodne, hra čaká. Prázdny balíček = nič. |
| Šofér | Bitka: ak si v tomto kole nedal NA EX, udelíš súperovi Pecku navyše (+2 tuhé), za každého Šoféra. |
| Traktoristka | Bitka: s prevahou v kraji, kde leží, Pecka navyše; bez nej dostaneš na začiatku bitky Dlh. |
| Podvodník | Prehra: jeden tvoj priznaný Dlh prejde medzi súperove priznané (za každého Podvodníka). |
| Praudovravec | Furt: Odpor na jeho spojoch neruší, ale ráta sa ako Posilnenie. |
| Kočovník | Furt: všetky jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (§6). |
| Dvojčatá | Furt: do prevahy sa rátajú za dvoch — aj pre bonus Ihriska (v8). Lesná cesta ráta len Zvieratá. |
| Silná nezávislá žena | Aktívne akcie tvojich kariet, ktoré s ňou susedia, sa rátajú dvakrát. |
| Zámočník | Aktívne akcie Nástrojov v jeho okolí sa rátajú dvakrát. |
| Veterán | Furt: NA EX na Veterána jeho aktívne akcie nezruší, ale zdvojí; neaktívne ostanú neaktívne. |
| Veštica | Prehra: porazený vymení jednu svoju kartu doberacieho balíčka za súperovu (§9.5b). |
| Degustátorka | Nástup: ak má súper viac plných poldeci ako ty, jeden sa mu otočí na vypitý (nie nerest ani pečeň). |
| Vandal | Nástup: lokalita sa otočí o 180° (hrany si vymenia kraje). |
| Kôň | Furt: Nástroj vedľa neho s ním tvorí spoj ako s Občanom. |
| Čierna mačka | Majiteľove Povery spôsobujú mäkké poškodenie aj bez súperových priznaných Dlhov. |
| Strýko z Ameriky | Kšeft: za 2 cigarety Rana navyše v bitke kola. |
| **Starší** | Efekt staršieho platí, keď jeho kartu majiteľ vyloží do línie (patronát, §10), alebo keď je prebudený (§10) — vtedy vydesujúcemu hráčovi (Konflikt a okolie len v línii). |
| Veterinár | Pitka: karty v jeho okolí (aj lokalita) nepridávajú poškodenie pečene — ani akciou Poškodenie pečene, ani Poldeci. NA EX na ne pečeň dáva. |
| Autobusár | Zhromaždenie: súper, ktorý pasuje (alebo hrá Záverečnú) až po majiteľovi, cigarety za pas nedostane. |
| Starosta | Nástup: majiteľ si vezme 1 kartu zo šenku (podľa voľby). |
| Farár | Prehra: keď jeho majiteľ prehrá, víťaz získa 1 zadĺženie za každú svoju aktívnu Poveru v bitke (D6 — zvyšok ostáva na účte). |
| Poštárka | Kšeft: za 1 Dlh (hneď priznaný) si dober 1 kartu; Dlh len za naozaj dobratú kartu, s prázdnym doberacím aj odhadzovacím balíčkom sa nepoužije. |
| Hrobár | Konflikt: za priloženú kartu sa na jej strane už nič nepriloží (ani odpoveď na NA EX) a po bitke ide z hry. |
| Vychovávateľka | Kšeft: za 2 cigarety máš v bitke tohto kola 1 Poveru navyše (ráta sa ako aktívna Povera, §9.3). |
| Krčmárka | Pitka: na NA EX jej majiteľa súper kartou neodpovedá (§7). |
| **Nástroje** | Efekt Nástroja platí len v Dedičstve (§12). |
| Noviny | Dedičstvo: Prehra: keď prehráš a víťaz má viac priznaných Dlhov ako ty, špaky za túto bitku (aj zo sekery a z Herne) dostaneš ty. Špaky za starších nie. |
| Krabička cigariet | Dedičstvo: Pitka: za každé 2 cigarety, ktoré súper v Pitke vyfajčí (rátajú sa zaplatené cigarety), si hneď doberieš 1 kartu. Nie je to nerest. |
| Pasca | Dedičstvo: Bitka: ak súper v tomto kole priložil kartu (akúkoľvek, aj lícom dole) k tvojej, udelíš mu Pecku navyše. |
| Puška | Dedičstvo: každá tvoja aktívna Petelica udelí o 1 poškodenie viac. |
| Vidly | Dedičstvo: každá tvoja aktívna akcia Rana z vyložených kariet (aj hrany lokality) udelí o 1 poškodenie viac. Rany navyše z efektov kariet (Svokra, Pijan, Vymáhač, Strýko z Ameriky) Vidly nezosilnia (Michal 2026-10-27). |
| Výherný automat | Dedičstvo: tvoj prah Dlhu je o 1 vyšší (§8); v poslednej Pitke kola (pred bitkou) získaš 1 Dlh. |
| Svätý text | Dedičstvo: hodnota tvojej Viery je o 1 vyššia. |
| Vínko | Dedičstvo: ráta sa ako plný poldeci navyše (limit +1); poldeci za cigarety dolievať nesmieš. |
| Nealko | Dedičstvo: tvoj prah Cirhózy je o 2 vyšší (sčíta sa s Krčmou). Poldeci, NA EX ani akciu Poldeci nemení. |
| Lievik | Dedičstvo: NA EX smieš dať aj na Zviera. |

---

## 17. Slovník

| Pojem | Význam |
|---|---|
| Absťák | kliatba za menej nerestí než v predošlom kole; rovno priznaná, −1 tvoje tuhé za kus; víťazovi s viac Absťákmi uberie špaky za bitku a rozhoduje remízu (§8, §9.4) |
| Finále | posledná bitka o pinnacle lokalitu, hrá sa ako o každú inú; útočí zaostávajúci (menej špakov) (§14b) |
| Dedičstvo | Nástroj vyložený mimo línie za rastúcu cenu v cigaretách; platí jeho efekt Dedičstvo (§12) |
| Dobratie po bitke | 1 karta na začiatku každého ďalšieho kola; limit ruky nie je (§4) |
| Konflikt | spúšťač (v7): efekt ležiacej karty, keď k nej súper priloží svoju; vlastné priloženie, Nástroj, NA EX ani zrážka ho nespúšťajú (§6, §16) |
| Vyvolať Konflikt | priložiť kartu k súperovej ležiacej karte so spúšťačom Konflikt (§16) |
| Kšeft | spúšťač (v7): aktívny efekt za cenu, spustíš ho sám v Pitke, kým ju neskončíš, každú kartu raz za Pitku (§7) |
| Úplatok | spúšťač (v7): súper platí cigaretou za oslabenie tvojej karty, raz za Pitku; cigareta prepadne (§7, §16) |
| Pakt | akcia (v7): na spoji sa správa ako akcia, s ktorou je v páre (§2) |
| Čiarky na účte | zadĺženie pod prahom Dlhu; od v7 neprepadá ani po Pitke, ani po kole (D6, §8) |
| Kraj | polovica línie od lokality, pomenovaná podľa hrany lokality (Krčma: pri výčape / pri dverách) (§6) |
| Línia | celý rad kariet v kole; lokalita v strede (§6) |
| Náhrada | hráč nahradí kartu z množiny určenej efektom; náhrada staršieho je karta na jeho scorecarde po patronáte (§10) |
| NA EX | plný poldeci na Občana či Starešinu v línii, vybraný v Pitke skryto: zruší jeho aktívne akcie a zdvojí neaktívne (§7) |
| Nástup | vyhodnotenie pri zahraní karty |
| Nerest | vypitý poldeci, NA EX, vyfajčená cigareta, doliatie a barter — počítajú sa pre Absťák (§8) |
| Furt | platí, kým je karta odhalená kdekoľvek v hracom priestore |
| Odhodenie | do odhadzovacieho balíčka hráča, ktorý kartu zahral |
| Odpoveď na NA EX | po odkrytí za každé súperovo NA EX jedna karta z ruky do línie mimo limitu; najprv obranca, potom útočník (§7) |
| Pohoršenie | akcia: v bitke posunie marker staršieho o 1 k súperovi alebo k sebe; priazeň sa mení hneď (§9.2) |
| Partia | všetky karty natočené k hráčovi (jeho karty), na ktorejkoľvek strane (§6) |
| Patronát | vziatie karty staršieho, ktorý ti prejavuje priazeň, do ruky za náhradu na scorecarde (§10) |
| Nástenka | krčmová nástenka: odohrané bitky s víťazom a špakmi (§14) |
| Prebytok | rozdiel celkového poškodenia v bitke; posúva markery starších k súperovi držiteľa o pole za bod — vyberá ten, proti komu sa ráta, vo finále držiteľ (§9.4) |
| Preskúmanie | zober a prezri si 5 kariet, potom ich vráť |
| Prevaha | v kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov (Nástroje, Cirhóza nie); pri rovnosti hráč, ktorého karta v tom kraji leží hneď pri lokalite; dostane akcie hrany lokality v tom kraji (§6) |
| Priznanie | vyloženie kliatby mimo línie natrvalo; nemíňa limit ani neodovzdá ťah (§11) |
| Sekera | bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch); jej špaky (karty v línii) berie víťaz najbližšej bitky, vo finále prepadnú (§9.4) |
| Špak | za bitku (karty v línii), za nové zóny strachu starších, výkupné zvyšných poldeci a cigariet; mínus Exekútor a nepriznaná Cirhóza; po finále vyhrá, kto má viac (§14) |
| Vyplatená zóna | zóna strachu, ktorú starší už zaplatil hráčovi, ktorého sa bojí; znova platí až po ústupe markera (§10) |
| Strana | polovica línie od lokality — tvoja a súperova (§6) |
| Šenok | ponuka kariet lícom nahor; obaja vidia, čo berú (§5) |
| Útočník / obranca | útočník je **porazený z minulej bitky** (v prvom kole náhodne, pri sekere ostáva; vo finále menej špakov, §14b) — berie zo šenku prvý, vykladá prvý a v Pitke má posledné slovo (na NA EX odpovedá druhý); obranca je víťaz minulej bitky — volí a natáča cieľ, na NA EX odpovedá prvý; Pitku hrajú obaja naraz (§4, §7) |
| Výtržník | karta, na ktorú obaja dali NA EX v tej istej Pitke (zrážka): všetky jej akcie sú aktívne Rany pre majiteľa, len počas jednej bitky (§7) |
| Vypiť | otočiť plný poldeci na vypitý: limit −1, pečeň +1, ďalšia karta v tom istom ťahu (§13) |
| Výkupné | po finále 1 špak za každý plný poldeci a 1 špak za každých celých 5 cigariet, bez stropu (§14) |
| Záverečná | karta lícom dole za cigaretu, ukončí vykladanie v Zhromaždení; otočí sa na konci Pitky (§13) |
| Zahodenie | odstrániť kartu z hry (spáliť) |
