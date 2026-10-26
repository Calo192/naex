# NA EX! — pravidlá (špecifikácia)

**Pravidlá v6 (zmrazené 2026-10-26)**, platné od 26. 10. 2026. Pravidlá sa
menia len v dávkach; celá dávka dostane ďalšiu verziu (v7).

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
  (zmeny oproti v5: sekcia v6). Partie v archíve nesú `VERZIA_PRAVIDIEL`
  („v4“, „v5“, „v6“, staršie dátumové značky).

---

## 1. Cieľ a koniec hry

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality a desia starších. Každé kolo je jedna bitka; hra má toľko
bitiek o lokality, koľko určí dĺžka hry (§3), a po nich **finále** — poslednú
bitku bez lokality (§14b). Víťazné body sú **špaky** (§14): za vyhratú bitku
a po každej bitke za starších, ktorí sa hráča boja. Na konci vyhrá, kto má viac
špakov — ak hra neskončí skôr. Pri rovnosti špakov je remíza.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč vydesí aspoň polovicu starších (aj nahradených) a **udrží ich do konca nasledujúceho kola** — ohlásené vydesenie; súper má kolo na odpoveď, napr. patronát nad vydeseným starším vráti marker do stredu (§10) | **vyhráva** |
| Odohrá sa finále (po 3 / 5 / 7 bitkách o lokality podľa dĺžky hry) | odpočíta sa nepriznaná Cirhóza a vyhrá viac špakov (§14) |

Exekúcia prehru nespôsobí — stojí Dlhy a špaky (§11).

Vydesenie sa kontroluje na konci kola (§4). Malý balíček prehru nespôsobí:
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
| Dlh | `Dlh` | zvýši **zadĺženie** o 1; každé 2 zadĺženia v Pitke = 1 karta Dlh, hneď priznaná (§8); priznané Dlhy na prahu Exekúcie 10 (so súperovou priazňou Exekútora 9 / 8 / 7) privolajú Exekútora (§11) |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene (§8) |
| Obmedzenie | `Obmedzenie` | súper dostane v Pitke o 1 cigaretu menej |
| Cigareta | `Cigareta` | +1 **cigareta** v Pitke — cigarety sa prenášajú z kola na kolo; platí sa nimi šenok, Dedičstvo, doliatie, barter a Starosta, fajčením (len v Pitke, §7) dávajú karty |
| Vízia | `Vízia` | na konci Pitky: za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho doberacieho balíčka a vezme si ju do ruky, alebo ju **zahodí** (z hry) |
| Poldeci | `Poldeci` | otočí jeden vypitý poldeci späť na plný — **až pri bitke** (§9.5); v Pitke pridá poškodenie pečene |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú) (§6) |
| Odpor | `Odpor` | zruší prepojenú akciu; Odpor + Odpor = Vzbura (§6) |
| Robota | `Robota` | v kroku Exekútora, **pred** kontrolou prahu, spáli 1 priznaný Dlh (z hry, §11); funguje aj bez exekúcie |

Akcia sa volá ako karta či zdroj, ktorý dáva: `Dlh` → Dlh, `PoškodeniePečene` →
Poškodenie pečene, `Poldeci` → Poldeci, `Cigareta` → Cigareta (starý kľúč
`Cigaretka` sa pri načítaní sady preloží). Slovo „fyzická cigareta“ sa
nepoužíva — cigareta je cigareta.

---

## 3. Príprava hry

- **Dĺžka hry** sa volí pred začiatkom počtom lokalít: krátka **3**, stredná
  **5** (predvolená), dlhá **7**. Dĺžku možno zvoliť, len keď má zverejnená
  sada aspoň toľko lokalít — `cards.json` ich má 15.
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
  → (Zhromaždenie → Pitka) × 1–4 → bitka → koniec kola
finále: draft → (Zhromaždenie → Pitka) × 3 → bitka → koniec hry   (§14b)
```

**Útočník** = hráč, ktorý **prehral poslednú bitku** (v prvom kole náhodne;
pri sekere ostáva útočníkom; vo finále útočí, kto má viac špakov, §14b). **Berie zo šenku prvý, vykladá prvý a v Pitke má
posledné slovo** (na odkryté NA EX odpovedá druhý, §7) — jeho výhody slúžia
na dobiehanie. **Obranca** je víťaz
poslednej bitky: **vyberá a natáča cieľ** kola a **Pitku začína**.

**Začiatok kola:**

- Každému hráčovi sa otočí **jeden vypitý poldeci na plný** (§6, limit).
- Od druhého kola si každý hráč dobere zo svojho doberacieho balíčka
  **2 karty** (dobratie po bitke). **Keď sa doberací balíček minie,
  odhadzovací sa zamieša a stane sa z neho nový doberací balíček** — pri
  každom ťahaní, aj uprostred neho. Na začiatku hry je doberací balíček
  prázdny (§3): kým hráč nemá ani odhadzovací, ťahanie nedá nič, fajčiť sa
  nedá a Poštárka sa nepoužije. **Limit ruky nie je** — hráč smie mať kariet, koľko chce. Karty
  navyše dáva šenok, fajčenie v Pitke (§7), priznanie kliatby (§11), Vízia
  a efekty.

**Koniec kola** (po bitke a návrate kariet, §9.7): porovnajú sa neresti
(Absťák, §8), potom sa skontroluje vydesenie (§1).

**Nevyhnutné ťahy:** keď hráč nemá inú možnosť než pasovať (v Zhromaždení),
preskočiť NA EX (v Pitke) alebo Pohreb, hra ten ťah urobí za neho.

---

## 5. Cieľ a draft

### Voľba cieľa

Obranca vyberie lokalitu, o ktorú sa v kole bije, a **natočí ju**. Natočenie
určuje, ktorá hrana lokality leží pri ktorom kraji línie (§6). Vo finále sa
cieľ nevyberá — kolo začína rovno stavbou šenku (§14b).

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

Nevzaté karty ostávajú v šenku do ďalšieho draftu (Starosta a Pohreb Závislého
z neho berú aj medzitým). Po braní sa šenok **doplní z vrchu spoločného
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
  pohľadu) a súperovu. Vo finále lokalita nie je: v strede leží prvá vyložená
  karta a kraje ani prevaha nie sú (§14b).
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
  s Nástrojom na konci strany, kam sa vykladá (§12). Pes sa nesmie stretnúť
  s iným Zvieraťom vo **svojej partii** (§16). Kliatba do línie nepatrí, okrem
  Milujúcej manželky (§11).
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
limit) — aj keď pasuje hra za neho. Pasovanie ruší aj nevyužité ťahy navyše
z Vypiť. Kto v Zhromaždení nemá čo vyložiť, za toho hra pasuje (fajčiť sa
v Zhromaždení nedá, §7). **Záverečná** (§13) ukončí vykladanie ako pas, ale bez
cigariet.

---

## 7. Pitka

Pred každou Pitkou je Zhromaždenie (§6); počet Pitiek v kole určuje lokalita
(nižšie).

### Poradie: obranca začína, útočník má posledné slovo

Pitku **začína obranca**. Na svojom ťahu fajčí, dolieva, barteruje, použije
Poštárku či Starostu a **skryto vyberie NA EX** (nižšie) — a skončí „hotovo“.
„Hotovo“ je **nevratné** a zapíše sa do logu („Hráč X končí svoju časť
Pitky“). Potom hrá rovnako útočník. Keď sú hotoví obaja, **NA EX sa odkryjú**,
nasledujú odpovede — najprv obranca, potom útočník, ktorý má **posledné
slovo** — a Pitka sa vyhodnotí.

### NA EX

NA EX smie hráč dať **iba v Pitke** na svojom ťahu, v základe **najviac raz
za Pitku** (Vínna pivnica dvakrát, Kostol vôbec, §15). Vyberie jednu kartu
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
- Na kartu, na ktorej **už poldeci leží** (z predošlej Pitky kola alebo z tvojho
  skrytého NA EX), sa ďalšie NA EX dať nedá. Súperovo skryté NA EX nevidíš —
  obaja tak môžete vybrať tú istú kartu (zrážka, nižšie).
- Na **Liberála** NA EX dať nemožno, na súperovho **Anonymného alkoholika**
  tiež nie (jeho susedov nechráni, §16).
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
  inak Pitku neskončí; prah Cirhózy je tam zato obom o 2 vyšší (§15).
- Efekty okolo NA EX: Svokra (súper za každé NA EX stratí 2 cigarety),
  Výpalné (priazeň Výpalníka, §10) a Vychovávateľka sa uplatnia pri odkrytí;
  ďalej Šofér, Snúbenica, Veterán (§16).

### Odkrytie NA EX a Výtržník

Keď skončia obaja, NA EX sa **odkryjú** — najprv obrancove, potom útočníkove.
Až teraz poldeci ľahne na kartu, pripíše sa pečeň a uplatnia sa efekty okolo
NA EX.

**Zrážka:** ak obaja vybrali **tú istú kartu**, ležia na nej poldeci oboch
a z karty je **Výtržník**. Karta sa najprv spáruje so susedmi s pôvodnými
akciami (susedom aktivuje akcie ako bez zrážky), potom sa **všetky akcie na
jej hranách** zmenia na aktívnu **Ranu** pre jej majiteľa — aj akcie bez
partnera na spoji. NA EX jej nič neruší ani nezdvojuje. Každý platí za svoje
NA EX ako vždy: pečeň +1 tomu, kto NA EX dal, Svokra aj Výpalné za každé
z oboch NA EX, a v bitke sa vypijú oba poldeci (§9.5). **Po bitke Výtržník
vytriezvie** — karta má znova pôvodné akcie; Výtržníkom je len počas jednej
bitky.

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

- **Fajčenie (len v Pitke):** na svojom ťahu v Pitke smie hráč vyfajčiť
  cigaretu — hneď si dobere kartu, ťah mu neskončí, ráta sa to ako nerest.
  **V Zhromaždení sa nefajčí.** Keď sú doberací aj odhadzovací balíček
  prázdne, **fajčiť sa nedá** — cigareta by nedala kartu. Na Benzínke sa
  nefajčí (§15).
- **Doliatie, 2 cigarety** (počas Pitky) → otoč jeden vypitý poldeci späť na
  plný. S Vínkom v Dedičstve nie (§16).
- **Stokársky barter, 5 cigariet** (na Jednote o 1 menej) → nový plný poldeci
  navyše.
- Zadarmo sa jeden vypitý poldeci otočí na začiatku kola (§4).

### Vyhodnotenie Pitky

Po „hotovo“ oboch hráčov:

1. **NA EX** — odkrytie a odpovede (vyššie).
2. **Dlh** — za **každý celý prah** zadĺženia hráč získa kartu Dlh (§8).
3. **Poškodenie pečene a Cirhóza** — za **každý celý prah** pečene hráč získa
   Cirhózu do odhadzovacieho balíčka (§8).
4. **Obmedzenie**
5. **Cigarety** — hráč dostane cigarety za akcie Cigareta:
   ```
   nové cigarety = Cigarety − súperove Obmedzenia (najmenej 0) + Cigorky v Dedičstve
   ```
   Priazeň Fajčiara dáva cigarety po braní zo šenku (§5), nie v Pitke.
6. **Ťahanie kariet** — Pitka sama karty nedáva; doberajú sa fajčením,
   priznaním kliatby, Poštárkou a Víziou.
7. **Vízia** — za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho
   doberacieho balíčka (keď sa doberací balíček minie, odhadzovací sa
   zamieša a stane sa z neho nový doberací balíček)
   a rozhodne: **do ruky**, alebo **zahodiť** (z hry; súperov Hrobár za to
   dostane cigaretu). Rozhoduje obranca, potom útočník; vrchnú kartu vidí len
   on.
8. **Otočenie Záverečných** — karty lícom dole sa otočia; ich Nástup
   a odložené efekty sa vyhodnotia teraz (§13).

Násobky akcií sa **násobia**: NA EX zdvojí neaktívnu akciu, Silná žena ju
zdvojí tiež, spolu ×4 (aj pri Dlhu a Poškodení pečene). Klient aj konzolový
klient ukazujú výhľad „po Pitke“ (`nahladPitky` — ten istý výpočet ako
vyhodnotenie, `prirastkyPitky`).

Po vyhodnotení Pitky sa **pečeň aj zadĺženie oboch hráčov vynulujú** —
zvyšok pod prahom sa do ďalšej Pitky neprenáša.

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
majú na každej strane 1–3 akcie, teda 1–4 Pitky. **Finále má vždy 3 Pitky.**

---

## 8. Pečeň, zadĺženie, nerest a Absťák

Pečeň a zadĺženie **žijú len v Pitke**: rátajú sa počas Pitky, vyhodnotia sa
v jej krokoch 2–3 (§7) a po Pitke sa vynulujú.

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
(poldeci sa vypije v bitke), každá vyfajčená cigareta, doliatie poldeci (2)
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

Každý Absťák hráča znižuje **jeho** tuhé poškodenie v bitke o 1 (§9.3;
Autobusár jeden ignoruje). Absťáky, ktoré hráč **práve má** (priznané, jeho
karty v línii aj v ruke), navyše rozhodujú remízu v bitke a víťazovi s viac
Absťákmi uberajú špaky za bitku (§9.4). Klient ukazuje neresti oboch hráčov
a výhľad (`stavZavislosti`).

---

## 9. Bitka

Bitka sa vyhodnotí po poslednej Pitke kola, v tomto poradí:

| Krok | Čo sa deje | Kde |
|---|---|---|
| 0 | Efekty na začiatku bitky (Krčmárka, Dievčina na vydaj, Kar) | §9.0 |
| 1 | Exekútor (Robota, prah, exekúcia — Dlhy a špaky) | §11 |
| 2 | Pohoršenie (aj z patronátu a z priazne Abstinenta) | §9.2 |
| 3 | Poškodenie | §9.3 |
| 4 | Výsledok (pri remíze Absťáky, potom Dlhy, inak sekera) | §9.4 |
| 4a | Špaky za bitku víťazovi; lokalita ide na krčmovú nástenku | §9.4, §14 |
| 4b | Špaky za starších obom hráčom (aj Noviny) | §14 |
| 4c | Prebytok — posunie markery pre ďalšiu bitku; po finále a na Kultúrnom dome dá špaky | §9.4 |
| 5 | Poldeci (aj Na zdravie „do dna“) | §9.5 |
| 5b | Veštica | §9.5b |
| 6 | Pohreb, potom Cintorín | §11 |
| 6c | Živnostník (víťaz vyberá), cigarety za prebytok, priazeň Kmotra, ostatné efekty Výhra a Prehra | §9.4, §10, §16 |
| 6d | Patronát | §10 |
| 7 | Návrat kariet; nepriznaná Cirhóza z ruky do odhadzovacieho balíčka | §9.7 |

### 9.0 Efekty na začiatku bitky

Krčmárka (otočí vypitý poldeci) a Dievčina na vydaj (spáli priznané Dlhy
a seba) (§16).

**Kar:** po Krčmárke a Dievčine na vydaj sa každý hráč s nepriznanou Cirhózou
v ruke rozhodne (obranca, potom útočník), či jednu zahodí — navždy z hry.

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
- Pohoršenie mení aj **strach hneď** — ráta sa už do špakov za starších tejto
  bitky (krok 4b).
- K aktívnym Pohoršeniam pribudnú **Pohoršenia z patronátu** súpera (§10)
  a Pohoršenia z priazne **Abstinenta** (§10).
- Súperova Policajtka ruší Pohoršenia proti svojmu majiteľovi — všetky, v oboch
  smeroch (§16).

### 9.3 Poškodenie

```
1. Viera a Povera sa vyrušia 1:1
     moja Viera ruší súperove Povery
     moje Povery rušia súperovu Vieru
     cancel = min(viera[ja], povera[súper]);  obom sa odpočíta

2. tuhé[ja] = (Rana×1 + Pecka×2 + Petelica×3 + súperove priznané Cirhózy + sila Bitkára)
             − zvyšná_viera[súper] × hodnota_viery(súper)
             − počet_mojich_absťákov
     minimum 0

3. mäkké[ja] = min(zvyšná_povera[ja], priznané_dlhy[súper])

4. celkové[ja] = tuhé[ja] + mäkké[ja]
```

**Priznaná Cirhóza škodí tomu, kto ju priznal:** za každú priznanú Cirhózu
hráča dostane súper v každej bitke +1 tuhé (Veterinár to znižuje). Ráta sa ako
tuhé, takže ju zvyšná Viera tiež znižuje. Priazeň Bitkára pridá tuhé rovné
sile (+1 / +2 / +3), priazeň Veriaceho Vieru navyše (§10). Strop mäkkého
poškodenia ruší len Čierna mačka (§16). Tuhé ďalej menia efekty
kariet a lokalít (Pes, Pijan, Pasca, Lesná cesta, Ihrisko…, §15, §16).

### 9.4 Výsledok

```
víťaz          = vyššie TUHÉ poškodenie
  remíza v tuhom: vyhrá, kto má MENEJ ABSŤÁKOV (práve teraz: priznané,
                  jeho karty v línii aj v ruke)
  aj tu rovnosť:  vyhrá, kto má MENEJ PRIZNANÝCH DLHOV
  aj tu rovnosť:  nevyhrá nikto — SEKERA
prebytok drží  = vyššie CELKOVÉ poškodenie (aj pri remíze v tuhom)
prebytok       = |rozdiel celkových|      (pri rovnakom celkovom ho nikto nezíska)
```

**Špaky za bitku (krok 4a):** víťaz dostane toľko špakov, koľko Pitiek sa
v kole **naozaj odohralo** (dopitá Pitka sa ráta, aj keď počet Pitiek medzitým
klesol; finále má vždy 3). Ak má víťaz **viac Absťákov** ako porazený, dostane
o rozdiel menej, ale **vždy aspoň 1 špak**. Víťaz si **lokalitu neberie** —
karta lokality ide na **krčmovú nástenku** s jeho menom a počtom špakov.

**Sekera:** keď nerozhodne ani tuhé, ani Absťáky, ani Dlhy, bitku nevyhrá nikto
a špaky kola (odohrané Pitky) **čakajú na sekere** — vezme ich víťaz najbližšej
bitky navyše k svojim (bez zrážky za Absťák); viac sekier po sebe sa kopí.
**Vo finále** špaky zo sekery **prepadnú**. Sekera nemení roly (útočník ostáva
útočníkom), patronát sa vyrieši ako prehra (starší späť, bolestné, §10).

**Prebytok (krok 4c)** rozdelí medzi starších hráč, ktorý ho drží (vyššie
celkové poškodenie — spravidla víťaz, no aj porazený či pri remíze v tuhom), až
**po špakoch za bitku a za starších** — prejaví sa teda až v ďalšej bitke. Každý
pridelený bod posunie marker o **jedno pole** smerom k jeho súperovi (aj na
červenú a aj z červenej von, zamknutie sa ruší, §10). Smie prideliť aj viac
bodov tomu istému staršiemu. Miňištrant vo víťazovej partii zdraží každý posun
víťaza o 1; na posun, ktorý stojí viac, než zostáva prebytku, prebytok nestačí
a prepadne. Puška v Dedičstve zmenší prebytok proti majiteľovi o 2.

**Prebytok do špakov:** **po finále** (§14b) a v bitke o **Kultúrny dom** (§15)
sa prebytok medzi starších nerozdeľuje — jeho držiteľ dostane toľko špakov,
aký je prebytok (po Puške).

**Cigarety za prebytok:** hráč, proti ktorému sa prebytok rozdeľoval
(spravidla porazený), dostane po bitke **1 cigaretu za každého staršieho,
ktorého marker sa prebytkom posunul**. Viac posunov toho istého staršieho =
1 cigareta; posuny viacerých starších = viac cigariet. Pohoršenie sa neráta.

> Napätie hry: vystrašený starší ti po každej bitke dá špaky (§14), ale súperovi
> medzitým dáva svoju priazeň. Kto má veľké mäkké poškodenie, môže aj po prehre
> posunúť markery a v ďalšom kole bodovať viac.

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
v bitke (Dievčina na vydaj, Pohreb) sa nevracajú. Lokalita ostáva na nástenke.

**Nepriznaná Cirhóza**, ktorú má hráč po bitke v ruke, ide do jeho
odhadzovacieho balíčka (§11). Cirhóza, ktorú si dobere až na začiatku
ďalšieho kola, mu ostáva v ruke do konca toho kola.

---

## 10. Starší

8 starších, karta s tagom `Starešina` leží lícom nahor na svojom scorecarde.
Pod ňou je ukazovateľ (stupnica s markerom). Scorecard určuje **len priazeň**
staršieho (v6); hráč ju vidí pri staršom aj bez scorecardu.

**Nahradený starší ostáva v hre celý:** marker sa hýbe Pohoršením aj
prebytkom, dáva priazeň aj špaky za strach, karta náhrady môže byť prebudená
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

**Strach dáva špaky:** po **každej** bitke (aj po finále) dostane hráč za
každého staršieho, ktorý sa ho bojí, toľko špakov, aká je zóna — žltá 1,
oranžová 2, červená 3 (§14). Okrem toho sa strach ráta do vydesenia (§1).

Príklad: marker Farára na indexe 5 (polovica hráča 1, oranžová zóna) —
priazeň sily 2 má hráč 1; Farár sa bojí hráča 0 a po každej bitke mu dá
2 špaky, kým sa marker nepohne.

Web počas hry ukazuje pri každom staršom priazeň (komu a s akým účinkom),
koho sa starší bojí a koľko špakov mu po bitke dá.

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
| Kmotor | Po bitke (§9, krok 6c) | priznané Dlhy zmiznú z hry; bez priznaného Dlhu nerobí nič | 1 / 2 / 3 Dlhy |
| Abstinent | Pohoršenie v bitke (§9.2) | Pohoršenia navyše, hrá ich ako svoje | +1 / +2 / +3 |
| Exekútor | Exekútor v bitke (§11) | **súperov** prah Exekúcie je nižší | −1 / −2 / −3 |
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

- **cigarety** = koľko markeru chýbalo do červenej: žltá **2**, oranžová **1**,
  červená **0**,
- súper dostane v tejto bitke toľko **Pohoršení navyše**, o koľko polí sa
  marker vrátil do stredu: **1 / 2 / 3** (spolu s cigaretami vždy 3). Hrá ich
  ako svoje (§9.2) — aj na toho istého staršieho; strach, ktorý spôsobil, mu
  tak neprepadne. Patrónova Policajtka ich zruší,
- hráč musí mať aspoň **jeden poldeci** (plný či vypitý) — na bolestné.

Po bitke (krok 6d, pred návratom kariet):

- **patrón vyhral** → nechá si staršieho (karta je jeho — z línie sa vráti do
  jeho odhadzovacieho balíčka, v ruke ostáva), karta lícom dole sa otočí
  a ostáva na ukazovateli ako **náhrada**, marker ostáva, kde je,
- **patrón prehral** (aj pri sekere, §9.4) → karta staršieho sa vráti na
  scorecard (z ruky aj z línie), náhrada mu ide späť do ruky a ako
  **bolestné odhodí jeden poldeci** natrvalo — vypitý, ak ho má, inak plný
  (nový stojí barter). Smie klesnúť aj na 0 poldeci. Marker ostáva, kde je.

Kartu staršieho z patronátu nemožno pochovať (Pohreb) ani vymeniť Starostom.
Patronát vráti marker z krajnej pozície naraz do stredu — preto je odpoveďou
na ohlásené vydesenie (§1). Bot ho vyhodnocuje z odhadu špakov (`bot.ts`,
`patronat`).

---

## 11. Kliatby, priznanie, Exekútor, Pohreb

### Kliatby

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | za každý celý prah zadĺženia (§8) a priamo z efektov kariet — **hneď priznaný** | bez akcií; priznaný sa ráta k prahu Exekútora (zhorí s ním aj toľko špakov) a súperove Povery proti nemu udelia mäkké poškodenie; pri remíze v bitke prehráva, kto má viac priznaných Dlhov (§9.4) |
| **Cirhóza** | za každý celý prah poškodenia pečene (§8) — ide do **odhadzovacieho balíčka** | nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí **5 špakov** za kus (§14); priznaná dá súperovi v každej bitke +1 tuhé (§9.3) a umožní Pohreb |
| **Absťák** | keď hráč v kole skonzumuje **menej nerestí** než v predošlom (§8) — **rovno priznaný** | znižuje **tvoje** tuhé poškodenie o 1 za kus; víťazovi s viac Absťákmi uberie špaky za bitku a remízu v bitke prehráva, kto má viac Absťákov (§9.4) |

**Verejný dlh:** nový **Dlh sa hneď prizná** — ide medzi priznané karty
a kartu zaň hráč nedobere. Dlh, ktorý sa do balíčka dostane inak
(Vychovávateľka), sa pri dobratí prizná sám (nižšie). Nová **Cirhóza** ide
do **odhadzovacieho balíčka** — do ruky príde, až keď sa doberací balíček
minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Potom
ju hráč prizná, keď chce, alebo ju podrží (Vízia ju môže zahodiť, Kar tiež;
kým leží v odhadzovacom balíčku, zahodí ju aj Niekoho stryná).

**Nepriznaná Cirhóza po bitke do odhadzovacieho balíčka:** Cirhóza, ktorú má
hráč po bitke v ruke a nepriznal ju, ide do jeho odhadzovacieho balíčka
(§9.7). Hráč sa teda rozhoduje: prizná ju hneď (súper dostane +1 tuhé v každej
bitke), alebo riskuje, že sa mu do konca hry nevráti do ruky a na konci ho
bude stáť 5 špakov (§14). Kým ju nepriznal, súper za ňu tuhé nedostáva a na
Pohreb ju hráč nemá.

Na konci hry sa nepriznané Cirhózy rátajú v ruke aj v oboch balíčkoch. Efekty, ktoré „zahadzujú“ Dlhy či Cirhózy (Niekoho stryná, Veľmi
smútiaca vdova), berú z ruky, z odhadzovacieho balíčka a Dlh aj spomedzi
priznaných.

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
| Dlh | — (nový Dlh sa hneď prizná) | **ráta sa k prahu Exekútora** a do remízy v bitke; Povery proti nemu udelia mäkké poškodenie |
| Cirhóza | ide po bitke do tvojho odhadzovacieho balíčka; na konci hry **−5 špakov** | na konci nestojí nič; **súper za ňu v bitke +1 tuhé**; umožní Pohreb; kartu za priznanie **nedostaneš** |
| Milujúca manželka | — | naďalej posúva latku Absťáku (§16) |

Kliatby a špaky (v6): nepriznaná Cirhóza stojí na konci 5 špakov, Dlh berie
špaky cez Exekútora, Absťák víťazovi uberá špaky za bitku (§9.4, §14).

### Exekútor

Krok 1 bitky (§9). Najprv **Robota**: za každú aktívnu Robotu hráč **spáli**
1 priznaný Dlh (na Obecnom úrade 2). Potom sa spočítajú **priznané** Dlhy
(nepriznané sa nerátajú).

```
prah = 10 − sila súperovej priazne Exekútora    (10 / 9 / 8 / 7; Obecný úrad −4)
```

Ak `priznané_dlhy ≥ prah`, hráč **čelí exekúcii**: zhorí mu **polovica
priznaných Dlhov** (nadol) a **rovnaký počet špakov** — zhoria, súper ich
nedostane, a hráč smie ísť do mínusu. Nástroj sa neodovzdáva a exekúcia
prehru nespôsobí (v6). **Záhradkár:** kto ho má (v ruke či v balíčkoch), smie
ho pri exekúcii zahodiť namiesto špakov — Dlhy zhoria aj tak (§16).

Kto exekúcii **nečelí**, Dlh **nepáli**. Priznané Dlhy pália len Robota,
Dievčina na vydaj, Niekoho stryná a Veľmi smútiaca vdova.

### Pohreb

Krok 6 bitky (§9). Každý hráč s **priznanou** Cirhózou smie urobiť
**Pohreb**: spáli priznanú Cirhózu a ľubovoľnú **svoju kartu z línie** (svojej
partie, na ktorejkoľvek strane; nie staršieho z patronátu). Keď je spálená
karta **Závislý**, smie si navyše vziať jednu kartu zo šenku do ruky.

Spálená karta z línie je **zahodenie** — súperov Hrobár za ňu dostane
cigaretu. Cirhóza spomedzi priznaných sa neráta.

### Cintorín

Len pri bitke o Cintorín: porazený smie po Pohrebe dať jeden Nástroj z ruky do
Dedičstva bez platenia; spoločná cena Dedičstva sa zvýši ako vždy (§12).

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
áno. Z Dedičstva sa Nástroj do línie nevracia. Výnimkou je Cintorín (§11) —
porazený tam jeden Nástroj vyloží zadarmo.

Efekt v Dedičstve funguje ako malá priazeň: Nealko prah Cirhózy +2, Svätý
text Viera +1, Cigorky cigareta v každej Pitke, Puška prebytok proti tebe −2,
Noviny, Pasca, Výherný automat, Vínko (§16).

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
poldeci sa dá doliať (§7) a jeden sa doleje sám na začiatku kola. Na Zastávke
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
  sa tag, Liberál ani Anonymný alkoholik — odmietnutie by kartu prezradilo);
  vyhodnotí sa ako na každej karte. Majiteľ na ňu NA EX dať nesmie.
- **Otočí sa na konci Pitky**, ktorá nasleduje po jej Zhromaždení (pred
  ďalším Zhromaždením alebo bitkou, krok 8 v §7). Až vtedy sa vyhodnotí jej
  **Nástup** a efekty mimo línie, ktoré by ju prezradili, napr. Svokra
  (cigarety za NA EX súpera, ktoré medzitým padli), Vychovávateľka, Hrobár;
  Starostu či Poštárku lícom dole použiť nemožno.

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

Víťazné body sú **špaky** (v6, Michal 2026-10-26). Hráč ich zbiera počas celej
hry a klient ich ukazuje ako ohorky v popolníku pri mene hráča. Špaky sú
verejné. Vyhrá, kto má na konci hry (po finále) viac špakov; rovnosť je remíza.

| Odkiaľ | Koľko | Kedy |
|---|---|---|
| Vyhratá bitka | odohrané Pitky kola (finále 3), mínus o koľko má víťaz viac Absťákov než porazený, **aspoň 1**; plus špaky zo sekery | krok 4a (§9.4) |
| Starší, ktorí sa ťa boja | za každého: žltá **1**, oranžová **2**, červená **3**; sivý nikomu; aj nahradený | po **každej** bitke, aj po finále (krok 4b) |
| Noviny v Dedičstve | **+1**, keď sa ťa bojí viac starších ako súpera (počet starších) | krok 4b |
| Prebytok vo finále a na Kultúrnom dome | toľko, aký je prebytok (po Puške) | krok 4c |
| Exekútor | **−** polovica priznaných Dlhov (Záhradkár ich zachráni) | krok 1 (§11) |
| Nepriznaná Cirhóza | **−5** za kus (ruka aj oba balíčky) | na konci hry, po finále |

Špaky smú klesnúť do mínusu. **Krčmová nástenka** ukazuje odohrané bitky:
lokalitu, víťaza a jeho špaky za bitku (finále bez lokality); klient z nej
skladá aj rozpis popolníka.

Scorecard nesie len **priazeň** staršieho (§10). Bodovacie podmienky (Lokality,
Starší, Cigarety, Rezerva, Cirhóza, Dlhy, Absťák, zóny strachu) sa v6 rušia —
ovládnuté lokality už nie sú, preto padá aj všetko, čo sa na ne odvolávalo.

## 14b. Finále

Po poslednej bitke o lokalitu (3 / 5 / 7) sa hrá **finále** — posledná bitka
**bez lokality**.

- Cieľ sa nevyberá: kolo začína rovno stavbou šenku, branie a **patronát
  platia** ako v každom kole (§5, §10).
- **Útočník** je hráč s **viac špakmi**. Pri rovnosti útočí ten, kto
  **prehral poslednú bitku**; keď posledná bitka skončila sekerou, útočník
  ostáva útočníkom (rozhodnutie Leadera 2026-10-26, „uvidíme po playtestoch“).
  Útočník vykladá prvý — ísť prvý je tu nevýhoda, súper vidí, čo vyložil;
  v Pitke má posledné slovo.
- **Prvá vyložená karta leží v strede** ako lokalita a susedí s oboma
  stranami: ďalšie karty sa kladú na jej dve strany a párujú sa s ňou bežne.
  Karta ostáva kartou svojho majiteľa (akcie aj efekty). **Kraje a prevaha
  v kraji vo finále nie sú** (Kočovník dáva akcie majiteľovi, Presbiter
  nepôsobí, lokality s efektom niet).
- Finále má **vždy 3 Pitky**; víťaz dostane 3 špaky (mínus rozdiel Absťákov,
  aspoň 1). Sekera vo finále špaky kola aj zo sekery **prepadnú**.
- Po finále sa ešte rozdajú **špaky za starších**. **Prebytok sa nerozdeľuje** —
  jeho držiteľ dostane toľko špakov, aký je prebytok.
- Potom sa odpočíta nepriznaná Cirhóza (−5 za kus) a vyhrá hráč s viac
  špakmi.

## 15. Lokality

15 lokalít. Akcie na hranách určujú počet Pitiek (§7); efekt platí v kole,
keď je lokalita cieľom. Po bitke ide lokalita na krčmovú nástenku (§14) —
nikto ju neovláda.

| Lokalita | Kedy | Efekt |
|---|---|---|
| Krčma | Pitka | Kto má plný poldeci a Občana či Starešinu v línii (vlastného či súperovho), musí dať NA EX (skryto ako vždy, §7) — bez neho Pitku neskončí. Prah Cirhózy je v kole o Krčmu obom o 2 vyšší (sčíta sa s Alkoholikom a Nealkom). |
| Kostol | Zhromaždenie, Pitka | Nikto nesmie vypiť (v ťahu teda len jedna karta) ani dať NA EX. |
| Benzínka | Pitka | Nikto nesmie fajčiť. |
| Zastávka | Zhromaždenie | Spoločný limit vykladania pre oboch = súčet limitov oboch hráčov; každé vyloženie a Vypiť ho míňa obom. **Pas** dá cigarety najviac za **vlastný** limit hráča mínus to, čo v tomto Zhromaždení sám vyložil a vypil — nie za spoločnú zásobu. |
| Lesná cesta | Bitka | +1 tuhé za každého svojho Občana, Zviera či Starešinu v súperovom kraji, najviac +2. |
| Ihrisko | Bitka | V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (pri rovnosti nikto) — z oboch krajov teda až +4. |
| Zberný dvor | Pitka | Raz za Pitku: za 1 cigaretu karta z vlastného odhadzovacieho balíčka do ruky (cigareta je nerest ako pri barteri). |
| Most | Zhromaždenie, Pitka | Karty sa smú vykladať len na vlastnú stranu — aj odpoveď na NA EX. |
| Cintorín | Prehra | Porazený smie po Pohrebe dať jeden Nástroj z ruky do Dedičstva bez platenia; spoločná cena Dedičstva sa zvýši ako vždy (§11). |
| Kar | Bitka | Na začiatku bitky smie každý hráč (obranca, potom útočník) zahodiť jednu **nepriznanú** Cirhózu z ruky — navždy z hry (§9.0). |
| Obecný úrad | Bitka | Prah Exekútora je o 4 nižší; každá Robota spáli 2 priznané Dlhy namiesto 1. |
| Jednota | Pitka | Stokársky barter (nový poldeci) je o 1 cigaretu lacnejší. |
| Kultúrny dom | Bitka | Prebytok sa nerozdeľuje medzi starších — kto ho drží, dostane toľko špakov, aký je prebytok (v6, Michal 2026-10-26). |
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
vykladajú takto. „Okolie“ karty = jej susedia v línii (aj lokalita či starší
v strede).

| Karta | Výklad |
|---|---|
| Dievčina na vydaj | Pri bitke sa zahodí (po bitke sa spáli, nevráti sa) a jej majiteľ spáli toľko **priznaných** Dlhov, koľko mala aktívnych akcií (s násobkami — aj s tými, ktoré zdvojilo NA EX, vlastné či súperovo). Jej akcie v bitke, v ktorej sa zahodí, ešte **platia**. |
| Hrobár | Keď súper zahodí kartu z ruky, z línie alebo z vrchu balíčka (efektom, Víziou, aj Pohrebom — §11; nie návratom po bitke ani vlastnou Veľmi smútiacou vdovou), majiteľ Hrobára dostane cigaretu za každú. |
| Anonymný alkoholik | Súper jeho majiteľa naňho nedá NA EX — ani keď je podstrčený na súperovu stranu. Majiteľ smie. Karty vedľa neho nechráni. Bráni len novému NA EX; poldeci, ktorý už na ňom leží, ostáva. |
| Šofér | Furt: NA EX na kartu, ktorá so Šoférom susedí (vlastnú aj súperovu, na ktorejkoľvek strane Šoféra), **nezdvojí** jej neaktívne akcie — ostanú neaktívne; aktívne zruší ako vždy. Lokalitu v strede sa to netýka. NA EX na samotného Šoféra platí normálne. |
| Snúbenica | Nástup: ak ju vyložíš (v Zhromaždení aj ako odpoveď na NA EX) vedľa karty s NA EX, táto karta sa vráti **svojmu majiteľovi** do ruky a Snúbenica sa posunie na jej miesto. Poldeci z nej sa vypije tomu, kto NA EX dal, ako v bitke (vypitý, nerest; pečeň už NA EX započítalo). |
| Krčmárka | Pri bitke: ak hráč nemá Absťák a v tomto kole nedal NA EX, vypitý poldeci sa mu otočí na plný (automaticky). |
| Liberál | Ak je v partii majiteľa rovnako žien a chlapov (Liberál sa neráta), jeho aktívne akcie sa rátajú dvakrát. NA EX naň dať nemožno. |
| Milujúca manželka | Furt (kým je odhalená — v línii aj priznaná): majiteľ dostane Absťák aj pri **rovnakom** počte nerestí ako v predošlom kole; Manželky sa sčítavajú (dve = aj pri o 1 viac nerestiach). Zbavenie Absťáku sa nemení. |
| Kočovník | Furt: **všetky** jeho akcie (Rana, Dlh, Poškodenie pečene, Cigareta…) sa počítajú hráčovi, ktorý má v jeho kraji prevahu (§6). Do prevahy sa Kočovník ráta normálne svojmu majiteľovi; pri rovnosti rozhoduje bežné pravidlo (karta hneď pri lokalite). Súper, ktorý v kraji prevládne, dostane aj jeho škodlivé akcie — podhodiť sa mu dajú, ale súper to vie ovplyvniť. Limit vykladania míňa ako každá karta. |
| Pasca | Dedičstvo: každé súperovo Zviera v línii (kdekoľvek, jeho karta) mu uberie 1 tuhé poškodenie. |
| Pes | Furt: za každý pár akcií na spoji Psa so súperovou kartou — z ktorejkoľvek strany Psa, rátajú sa aj páry zrušené Odporom či NA EX (karty sú spojené) — dá majiteľ Psa v bitke +1 tuhé poškodenie, ale len keď Pes leží na strane svojho majiteľa; podstrčený na súperovu stranu nedá nič. Na Psa sa smie podstrčiť. Nesmie byť v partii s iným zvieraťom. Akcie: vľavo 1 Rana, vpravo 2 Rany. |
| Pijan | Bitka: ak má Žena v jeho okolí aktívnu akciu Poldeci, súper ti udelí 1 Ranu — majiteľ Pijana dostane od súpera +1 Ranu za každého takého Pijana. |
| Policajtka | Furt: súperove Pohoršenia proti majiteľovi neplatia — všetky, v oboch smeroch (§9.2), aj Pohoršenia z patronátu a z priazne Abstinenta. Autorita — Praudovravec súpera ju umlčí. |
| Poštárka | V Pitke raz: majiteľ smie dobrať 1 až 2 karty; ak dobral aspoň jednu do ruky, získa 1 Dlh. S prázdnym doberacím aj odhadzovacím balíčkom sa použiť nedá. Dlhy dobraté z balíčka sa samy priznajú (§11) a do ruky sa nerátajú. |
| Presbiter | Bitka: ak v jeho kraji nemá majiteľ iného Občana, Zviera ani Starešinu a súper tam má prevahu, súper má o toľko Viery menej, koľko má Presbiter aktívnych akcií (s násobkami Posilnenia a NA EX). Ráta sa počet Vier pred rušením s Poverou, najviac na 0. Funguje aj podstrčený do súperovho kraja. Autorita — súperov Praudovravec ho umlčí. |
| Dvojčatá | Furt: do prevahy sa rátajú za dvoch. Na Ihrisko, Lesnú cestu a podmienku „sám“ Presbitera nie (tam sa rátajú karty). |
| Praudovravec | Autority v **súperovej** partii neuplatňujú efekt. |
| Silná nezávislá žena | Aktívne akcie tvojich kariet, ktoré s ňou susedia, sa rátajú dvakrát (lokalitu, kartu staršieho ani súperove karty nezdvojí). |
| Starosta | V Pitke raz: za 1 cigaretu vymeň kartu z ruky za kartu zo šenku. Kartu staršieho z patronátu ním vymeniť nemožno. |
| Svätý text | Dedičstvo: hodnota majiteľovej Viery je o 1 vyššia. |
| Noviny | Dedičstvo: po každej bitke pri špakoch za starších dostane majiteľ **1 špak navyše**, ak sa ho bojí **viac starších** ako súpera (počet starších, nie zón; v6, Michal 2026-10-26). |
| Záhradkár | Exekúcia: keď majiteľ čelí exekúcii (§11), smie Záhradkára zahodiť (z ruky, odhadzovacieho či doberacieho balíčka) namiesto špakov — Dlhy zhoria aj tak (v6, Michal 2026-10-26). |
| Finančná poradkyňa | Dlh z jej akcií dostáva súper, nie jej majiteľ. |
| Čierna mačka | Majiteľove Povery spôsobujú mäkké poškodenie aj bez súperových priznaných Dlhov (bez stropu). |
| Svokra | Kým leží v línii, každé NA EX súpera jej majiteľa — na hociktorú kartu, aj povinné na Krčme — mu pri odkrytí (§7) zoberie 2 cigarety a dá ich majiteľovi Svokry; každá Svokra dve. Bez cigarety nič. Praudovravec súpera ju umlčí (Autorita). |
| Šarlatán | Viera kariet v jeho okolí sa ráta ako Vízia. |
| Veterán | Furt: NA EX na Veterána jeho **aktívne** akcie nezruší, ale **zdvojí** (aj Poldeci a Poškodenie pečene); neaktívne nezdvojí — ostanú neaktívne. |
| Veštica | Pri prehre: porazený si prezrie oba doberacie balíčky, vymení jednu svoju kartu za súperovu, potom sa oba balíčky zamiešajú; prázdny doberací sa najprv doplní zamiešaním odhadzovacieho (§9.5b). |
| Vychovávateľka | Keď sa odkryje NA EX majiteľa (§7), jeden jeho priznaný Dlh sa zamieša do súperovho **doberacieho balíčka** (pri dobratí sa súperovi sám prizná, §11). |
| Veľmi smútiaca vdova | Nástup: odhalí sa vrchná karta súperovho doberacieho balíčka (keď je prázdny, súperov odhadzovací sa zamieša a stane sa z neho nový doberací balíček). Ak je to muž (tag Chlap), ide z hry a majiteľ Vdovy **zahodí** (z hry) 2 svoje Dlhy z ruky, odhadzovacieho balíčka alebo spomedzi priznaných. Log vždy oznámi odhalenú kartu. Hrobár sa za Dlhy nespúšťa. |
| Niekoho stryná | Nástup: zahodí (z hry) 1 Cirhózu alebo 1 Dlh z ruky či z odhadzovacieho balíčka, Dlh aj spomedzi priznaných. Hra vyberie za hráča: najprv z ruky, potom z odhadzovacieho, nakoniec priznaný Dlh; Cirhózu pred Dlhom. |
| Vínko | Dedičstvo: ráta sa ako plný poldeci navyše (limit +1); majiteľ nesmie dolievať poldeci za cigarety. Stokársky barter je povolený. |
| Zámočník | Aktívne akcie Nástrojov v jeho okolí sa rátajú dvakrát. |
| Živnostník | Výhra: keď jeho majiteľ vyhrá bitku a Živnostník leží v jeho partii v línii, majiteľ **vyberie** jedno súperovo Dedičstvo a to sa zahodí (z hry). Každý Živnostník jedno. Vyhodnotí sa na začiatku kroku 6c (§9), pred ostatnými efektmi Výhra a Prehra — zahodené Dedičstvo v tejto bitke už nič nedá. Bez súperovho Dedičstva, pri prehre či remíze nič; pri Nástupe nerobí nič. |

---

## 17. Slovník

| Pojem | Význam |
|---|---|
| Absťák | kliatba za menej nerestí než v predošlom kole; rovno priznaná, −1 tvoje tuhé za kus; víťazovi s viac Absťákmi uberie špaky za bitku a rozhoduje remízu (§8, §9.4) |
| Finále | posledná bitka bez lokality; prvá karta je stred, 3 Pitky, útočí viac špakov (§14b) |
| Dedičstvo | Nástroj vyložený mimo línie za rastúcu cenu v cigaretách; platí jeho efekt Dedičstvo (§12) |
| Dobratie po bitke | 2 karty na začiatku každého ďalšieho kola; limit ruky nie je (§4) |
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
| Prebytok | rozdiel celkového poškodenia v bitke; posúva markery starších k súperovi o pole za bod; po finále a na Kultúrnom dome dá špaky (§9.4) |
| Preskúmanie | zober a prezri si 5 kariet, potom ich vráť |
| Prevaha | v kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov (Nástroje, Cirhóza nie); pri rovnosti hráč, ktorého karta v tom kraji leží hneď pri lokalite; dostane akcie hrany lokality v tom kraji (§6) |
| Priznanie | vyloženie kliatby mimo línie natrvalo; nemíňa limit ani neodovzdá ťah (§11) |
| Sekera | bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch); jej špaky berie víťaz najbližšej bitky, vo finále prepadnú (§9.4) |
| Špak | víťazný bod — za bitku, za starších, prebytok vo finále; mínus Exekútor a nepriznaná Cirhóza (§14) |
| Strana | polovica línie od lokality — tvoja a súperova (§6) |
| Šenok | ponuka kariet lícom nahor; obaja vidia, čo berú (§5) |
| Útočník / obranca | útočník je **porazený z minulej bitky** (v prvom kole náhodne, pri sekere ostáva; vo finále viac špakov, §14b) — berie zo šenku prvý, vykladá prvý a v Pitke má posledné slovo (na NA EX odpovedá druhý); obranca je víťaz minulej bitky — volí a natáča cieľ, Pitku začína (§4) |
| Výtržník | karta, na ktorú obaja dali NA EX v tej istej Pitke (zrážka): všetky jej akcie sú aktívne Rany pre majiteľa, len počas jednej bitky (§7) |
| Vypiť | otočiť plný poldeci na vypitý: limit −1, pečeň +1, ďalšia karta v tom istom ťahu (§13) |
| Záverečná | karta lícom dole za cigaretu, ukončí vykladanie v Zhromaždení; otočí sa na konci Pitky (§13) |
| Zahodenie | odstrániť kartu z hry (spáliť) |
