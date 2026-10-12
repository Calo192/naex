# NA EX! — destilované pravidlá pre implementáciu

Referenčný výťah z `naex_pravidla_v11_tlac.docx` (Michal Calík), prepísaný do
podoby, ktorá sa dá priamo implementovať a otestovať. Toto **nie sú** pravidlá
pre hráčov — je to špecifikácia.

Originál: `C:\Users\Michal\Documents\Claude\naex_pravidla_v11_tlac.docx`
Karty: `data/cards.json` (vygenerované nástrojom `tools/import_print_pdf.py` z tlačového
súboru `docs/KartyAI_PrintFile_20260716_131925.pdf`)

Aktualizované podľa `docs/naex_pravidla_v2_celostranova_robota.pdf` (pravidlá v2):
akcia **Robota**, spúšťač **Exekúcia**, Absťák sa rovno priznáva, Poldecko pridáva
poškodenie pečene.

**Pravidlá v3 (rozhodnutie Michala 2026-10-11):**

- **Názvoslovie:** **línia** = celý rad kariet; lokalita ju delí na dve
  **strany** (tvoja a súperova). **Partia** hráča = všetky karty natočené
  k nemu, nech ležia na ktorejkoľvek strane (§4, §13).
- **Dĺžka hry** sa volí pred začiatkom hry počtom lokalít: krátka **5**,
  stredná **7** (predvolená), dlhá **11**.
- Každú kartu možno vyložiť na **tvoju aj súperovu stranu**. Karta je vždy
  natočená k hráčovi, ktorý ju zahral, a **patrí jemu** — je v jeho partii,
  jej akcie aj efekty sa rátajú jemu (§4). Akciu lokality na spoji dostane
  **majiteľ susednej karty**.
- **NA EX** smie hráč dať **len na vlastnú kartu** (§5). **Vypiť** — v
  Zhromaždení otočí plný poldeci na vypitý a zahrá dve karty za sebou (§5).
- **Ruka 5 kariet:** štartovacie karty sa zamiešajú do doberacieho balíčka,
  hráč si dobere 5 a na začiatku každého kola si ruku **doplní na 5**
  (väčšiu nezahadzuje). Nové kliatby (Dlh, Cirhóza) idú do **odhadzovacieho
  balíčka**, nie do ruky (§11, §12).

**Zmeny po playteste 20261012-055944 (rozhodnutia Michala 2026-10-12,
skúšobné — `docs/playtesty/zmeny-pravidiel.html`):**

- **Odpoveď na NA EX:** po súperovom NA EX smie hráč hneď vyložiť jednu kartu
  z ruky mimo limitu, striedavo (§5).
- **Nahradený starší ostáva v hre** — marker, priazeň, prebudenie, body aj
  vydesenie; bojovať o neho sa už nedá (§7, §9).
- **Bitka o staršieho:** jeho karta leží v strede línie ako lokalita, útočník
  ju natočí; víťaz dá marker do sivej ako doteraz (§7).
- **Limit ruky** na konci kola: 6 + priazeň **Zberateľa** (nová priazeň,
  nahradila Očumovateľa) (§7, §9).
- **Útočník draftuje prvý**; **pitiek** je |rozdiel kariet z draftu|, aspoň 1 (§7).
- **Body za kus:** ovládnutá lokalita a získaný starší 2 (predtým 3) (§10).
- **Všetky efekty tlačovej sady** sa vyhodnocujú automaticky; výklad
  nejednoznačných textov je v §14.

> Miesta označené **[?]** sú nejednoznačné alebo v pravidlách chýbajú.
> Neimplementuj ich potichu — pozri `docs/BRIEF.md`, sekcia „Otvorené otázky".

---

## 1. Základ

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality, desia starších.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč vydesí aspoň polovicu starších (aj nahradených) | okamžite **vyhráva** |
| Hráč nedokáže čeliť exekúcii | okamžite **prehráva** |
| Veľkosť balíčka hráča klesne pod 5 | okamžite **prehráva** |
| Odohrá sa posledná bitka o lokalitu (5 / 7 / 11 podľa dĺžky hry; aj tá, ktorú nikto nevyhral — Benzínka) | spočítajú sa body |

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
| Hazard | `Dlh` | zvýši **zadĺženie** o 1; pri prahu (2) vznikne karta Dlhu |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene |
| Obmedzenie | `Obmedzenie` | zníži počet kariet, ktoré si súper potiahne |
| Cigaretka | `Cigaretka` | +1 potiahnutie počas Pitky, **len toto kolo** |
| Vízia | `Vízia` | z práve dobraných kariet zahoď Zopár kliatieb a dober si toľko istý počet |
| Poldecko | `Poldeci` | otočí jeden vypitý poldeci späť na plný (**až pri bitke**) |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú) |
| Odpor | `Odpor` | zruší prepojenú akciu; Odpor + Odpor = Vzbura |
| Robota | `Robota` | v kroku Exekútora, **pred** kontrolou prahu, odhodí 1 priznaný Dlh (do odhadzovacieho balíčka); funguje aj bez exekúcie |

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

### Línia, strany a partia (pravidlá v3)

- **Línia** je jeden súvislý rad kariet. **Lokalita** leží v jej strede a delí
  ju na dve **strany** — tvoju (vľavo z tvojho pohľadu) a súperovu. V bitke
  o staršieho leží v strede **karta staršieho** a správa sa ako lokalita
  (jej akcie na spoji dostane majiteľ susednej karty; jej efekt sa
  neuplatní, ak starší nie je prebudený) — Michal 2026-10-12.
- Kartu vykladáš vždy na **vonkajší koniec** jednej zo strán — **tvojej aj
  súperovej**. Strana určuje len to, kde karta leží a s čím susedí.
- Karta je vždy **natočená k hráčovi, ktorý ju zahral** (na súperovu stranu
  teda ide „nohami hore"). Ten je jej **majiteľ** a karta je v **jeho partii**:
  **partia hráča = všetky karty natočené k nemu**, nech ležia na ktorejkoľvek
  strane.
- **Akcie** karty sa rátajú jej majiteľovi. Na spoji sa karta páruje so
  susedmi bežne: susedova akcia sa aktivuje a pripíše sa majiteľovi susednej
  karty.
- **Akcie lokality** na spoji dostane **majiteľ susednej karty** (tej, ktorá
  s lokalitou tvorí spoj). Natočenie lokality (volí útočník) určuje, ktoré jej
  akcie sú obrátené ku ktorej strane; komu sa započítajú, rozhodne karta, ktorá
  ich aktivuje. Podstrčená karta pri lokalite ti tak „ukradne" súperovu stranu
  lokality.
- **Efekty** karty (Nástup, Furt, Bitka, Výhra…) patria majiteľovi. Text karty
  „v tvojej partii" = medzi tvojimi kartami.
- **Sabotér:** súperovi môžeš na jeho stranu podstrčiť kartu — jej Odpor mu
  zruší akciu na spoji, jej akcie bodujú pre teba a zaberie mu koniec strany.
- Vyloženie na súperovu stranu sa počíta do limitu vykladania **hráča, ktorý
  kartu zahral**. Výnimka: Kočovník na súperovu stranu limit nemíňa (návrh
  efektu 2026-10-11, text karty treba upraviť v tvorcovi).
- Nástroj nesmie susediť s Nástrojom na konci strany, kam sa vykladá (susedstvo
  je fyzické). Pes sa nesmie stretnúť s iným Zvieraťom vo **svojej partii**.

Otočením o 180°:

- ľavá a pravá strana sa **vymenia**,
- poradie indexov sa **obráti** (0↔3, 1↔2).

```
efektívna_ľavá(otočená)  = pravá čítaná odzadu
efektívna_pravá(otočená) = ľavá čítaná odzadu
```

Po bitke sa karta vracia do odhadzovacieho balíčka svojho majiteľa.

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
Hráč vyberie jednu **svoju** kartu s tagom **Občan alebo Starešina** (natočenú
k nemu — môže ležať aj na súperovej strane) a položí na ňu jeden plný poldeci.
**Na súperovu kartu NA EX dať nemožno** (pravidlá v3) — kontrolu má vždy
hráč, ktorému karta patrí. Svokra: súper v najbližšej Pitke nesmie dať NA EX.
Na **Liberála** NA EX dať nemožno. Na **Krčme** hráč s plným poldeci (a kartou,
kam ho dať) musí NA EX dať, inak Pitku neskončí.

**Odpoveď na NA EX** (Michal 2026-10-12, playtest 20261012-055944): hneď po
súperovom NA EX smie druhý hráč vyložiť **jednu kartu z ruky** na koniec
svojej alebo súperovej strany. Limit vykladania nemíňa; kto nemá kartu, ktorú
smie vyložiť, neodpovedá. Potom je na ťahu znova ten, kto NA EX dal.
Striedavo: keď neskôr NA EX dá aj druhý hráč, prvý má tiež jednu odpoveď.
Cieľ: spárovať neaktívne akcie karty s NA EX — tie sa tým stanú aktívnymi
a NA EX ich zruší. Počas odpovede sa nefajčí ani nedáva NA EX.

Poldeci **ostáva jeho**: do bitky sa ráta do JEHO limitu, pri bitke sa vypije.

> „NA EX posilňuje (zdvojnásobuje) neaktívne akcie a zároveň ruší aktívne
> akcie karty, na ktorej sa uplatňuje."

Poškodenie pečene z NA EX sa počíta **hneď počas Pitky** a pripíše sa hráčovi,
ktorý NA EX dal (karta je jeho); poldeci sa fyzicky vypije až pri bitke.
Kliatby, ktoré karta po NA EX vyprodukuje (zdvojený Dlh či Pečeň), patria
tiež jemu — NA EX je presný nástroj: zruší aktívne akcie (aj vlastný Dlh či
Pečeň) a zdvojí neaktívne.

### Vypiť (do dna)

V **Zhromaždení**, keď je na ťahu, smie hráč **vypiť**: otočí jeden **plný
poldeci na vypitý**. Za to:

- jeho **ďalšie vyloženie neukončí ťah** — zahrá dve karty (priznania,
  Nástroje) za sebou, súper medzitým nereaguje,
- jeho **zostávajúci limit vykladania hneď klesne o 1** (poldeci už nie je
  plný; v ďalších Zhromaždeniach sa limit počíta z plných poldeci ako vždy),
- dostane **+1 poškodenie pečene** a pitie sa ráta ako **nerest** (Absťák).

Piť smie **opakovane**, kým má plné poldeci — každé vypitie pridá ďalšie
vyloženie bez odovzdania ťahu. Pasovanie nevyužité ťahy navyše ruší. Vypitý
poldeci sa dá doliať (2 cigarety, barter, Poldecko). Na Zastávke (limit 2)
vypitie limit tiež znižuje.

### Doplnenie poldeci (počas Pitky)

- **2 fyzické cigarety** → otoč jeden vypitý poldeci späť na plný.
- **Stokársky barter: 5** (ľubovoľne Cigaretky aj fyzické cigarety) → nový
  plný poldeci navyše.

---

## 6. Priznanie a Dedičstvo

**Priznanie** — kartu s tagom Kliatba možno vyložiť mimo línie do vlastnej
hracej oblasti.

- **Priznaná kliatba je natrvalo mimo balíčka** — nevracia sa po bitke ani pri
  zamiešaní odhadzovacieho balíčka. Priznanie je jediný bežný spôsob, ako si
  balíček od kliatob **vyčistiť**; nepriznaná kliatba sa vracia a dobiera znova.
- Priznanie **nemíňa limit vykladania** a **neodovzdá ťah** (Michal
  2026-10-12): hráč prizná ľubovoľne veľa kliatob za sebou a potom ešte
  vykladá alebo pasuje. Smie priznávať aj pri vyčerpanom limite — kým nepasuje.
- Cena: priznaný **Dlh** sa ráta k prahu Exekútora a súperove Povery proti
  nemu udelia mäkké poškodenie (za to si hneď dobereš kartu). Priznaná
  **Cirhóza** nemá takmer žiadnu nevýhodu — body neuberá a umožní Liečbu
  či Pohreb; priznať ju sa oplatí takmer vždy.

| | Nepriznaná | Priznaná |
|---|---|---|
| Dlh | −1 bod na konci hry | body neuberá; **ráta sa k prahu Exekútora**; povery proti nej udelia mäkké poškodenie; pri priznaní si hráč **okamžite doberie kartu** |
| Cirhóza | záporné body **[?]** koľko | body neuberá; dá sa liečiť / použiť pri Pohrebe; pri priznaní sa karta nedoberá |

**Dedičstvo** — Nástroje sa namiesto priznania vykladajú do hracej oblasti ako
Dedičstvo a uplatňuje sa ich pasívny efekt `Dedičstvo`. Poldeci sa na Nástroje
neuplatňujú vôbec, nedajú sa posilniť cez NA EX a **Nástroj nesmie susediť
s Nástrojom**. Vyloženie Nástroja (do línie aj do Dedičstva) sa počíta ako ťah.

---

## 7. Priebeh kola

**Útočník** = hráč, ktorý prehral poslednú bitku (v prvom kole náhodne).
Vyberá cieľ kola a **draftuje prvý**. **Obranca** vykladá ako prvý.
(Michal 2026-10-12: predtým obranca aj draftoval prvý a v playteste
20261012-055944 vyhral 7 z 8 bitiek.)

**Doplnenie ruky** (pravidlá v3): na začiatku každého kola (od 2. kola, po
návrate kariet z bitky) si každý hráč dobere zo svojho doberacieho balíčka
toľko kariet, aby mal v ruke **5**. Kto má viac, nič nezahadzuje. Keď sa
doberací balíček minie, zamieša sa odhadzovací. Ťahanie v Pitke (Cigaretky,
fajčenie) dáva karty navyše.

**Limit ruky** (Michal 2026-10-12): na konci kola, po Liečbe a Pohrebe, smie
mať hráč v ruke najviac **6 + priazeň Zberateľa** kariet. Nadbytok odhodí do
odhadzovacieho balíčka (vyberie si, ktoré karty — aj kliatby, tie sa tak
vrátia do balíčka). Obranca odhadzuje prvý.

```
Voľba cieľa → [Draft] → (Zhromaždenie → Pitka) × N → Bitka
```

### Bitka o lokalitu — cigaretový draft

Útočník vyberie lokalitu a **natočí ju**. Nasleduje draft v dvoch krokoch
(Michal 2026-10-12 — predtým sa bralo z náhodne vyloženého šenku a útočník si
vybral všetky tri karty naraz ako prvý; playtest 20261012-101447 sa sťažoval
na „mŕtve“ karty v šenku a útočník vyhral 8 z 11 bitiek).

**1. Stavba šenku.** Karty, ktoré zo starého šenku nikto nevzal, idú lícom
dole naspodok spoločného balíčka. Každý hráč si potom zo spoločného balíčka
vezme **N kariet** (N = počet nenahradených starších, zaokrúhlený nadol na
párne číslo; pri nedostatku kariet menej). Obaja naraz a tajne vyberú zo
svojho balíčka **jednu kartu do šenku** a **jednu naspodok spoločného
balíčka** (lícom dole — súper nevidí, čo hráč odhodil). Keď vyberú obaja,
karty do šenku sa odhalia a hráči si zvyšné balíčky **vymenia**. Opakuje sa,
kým sa balíčky neminú — šenok má potom N kariet, polovicu od každého.

**2. Branie zo šenku.** Hráči berú zo šenku **striedavo po jednej karte,
začína obranca**. Každý vezme najviac 3; kto prestane skôr (alebo šenok
dôjde), dostane za každú nevzatú kartu **cigaretu** (`3 − karty`). Keď jeden
prestane, druhý berie ďalej sám. Každá priznaná Milujúca manželka uberie
z cigariet jednu.

Nevzaté karty ostávajú v šenku do ďalšieho draftu (Starosta a Liečba z neho
berú aj medzitým); bitka o staršieho draft nemá, šenok sa vtedy nemení.

```
počet pitiek = max(1, |rozdiel nových kariet oboch hráčov|)     (1 až 3)
```

(Michal 2026-10-12: predtým `1 + |rozdiel|`, kolá so 4 pitkami boli zdĺhavé.)

### Bitka o staršieho

Ako bitka o lokalitu, s rozdielmi:

- prebieha **vždy práve na jednu pitku**,
- **žiadny draft** — hrá sa len s tým, čo hráč má,
- dá sa vyvolať, **len ak je marker aspoň v oranžovej zóne** (Strach) a na
  ukazovateli leží ešte pôvodný starší — o náhradu sa nebojuje,
- **karta staršieho leží v strede línie** namiesto lokality a útočník ju
  natočí; strany sa spájajú cez ňu ako cez lokalitu (Michal 2026-10-12 —
  predtým sa prvé karty strán v strede nepárovali a hráči to tri playtesty
  nechápali).

Keď hráč bitku o staršieho vyhrá: rozdelí prebytočné poškodenie medzi
*ostatných* starších, vezme si kartu staršieho **do svojho balíčka**, na jeho
miesto položí zo svojho balíčka ľubovoľného **Občana alebo Zviera** (nie Nástroj,
nie Kliatbu) a nastaví marker na ľubovoľnú pozíciu v **sivej** zóne.
Nahradený starší potom hrá ďalej celý (§9). Web pred bitkou ukáže **náhľad
bodov** oboch hráčov pre výhru jedného či druhého — body z toho staršieho
zmiznú obom, víťazovi pribudne získaný starší.

### Zhromaždenie

Hráči striedavo vykladajú karty na svoju alebo súperovu stranu (každú kartu;
patrí tomu, kto ju zahral — §4), môžu **vypiť** (§5), prípadne
priznávajú karty alebo vykladajú Nástroje do Dedičstva. **Vykladať začína
obranca.** Vyloženie Nástroja sa v striedaní počíta ako ťah, priznanie nie (§6).

Končí, keď obaja odohrajú svoj limit alebo obaja pasujú.

**Nevyhnutné ťahy** (Michal 2026-10-12): keď hráč nemá inú možnosť než
pasovať (v Zhromaždení), preskočiť NA EX (v Pitke) alebo Pohreb, hra ten ťah
urobí za neho. Vypiť sa neponúka, keď hráč nemá čo vyložiť do línie.

### Pitka — poradie vyhodnotenia

1. **NA EX** — jediná príležitosť; súper smie hneď odpovedať jednou kartou (§5).
   Poštárka a Starosta sa používajú tiež v tejto časti Pitky.
2. **Hazard** — zadĺženie; pri dosiahnutí prahu (2) hráč hneď získa Dlh
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

### 0. Efekty na začiatku bitky

Krčmárka (otočí vypitý poldeci), Dievčina na vydaj (spáli priznané Dlhy
a seba) a Benzínka (pri viac ako 7 Cigaretkách oboch hráčov každý zahodí
3 svojich Občanov z línie a lokalita prepadne). Po Benzínke sa súčty akcií
línie prepočítajú (§14).

### 1. Exekútor

Najprv **Robota**: za každú aktívnu Robotu hráč odhodí 1 priznaný Dlh.
Potom sa spočítajú **priznané** Dlhy (nepriznané sa nerátajú).

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
*(Implementované: +1 tuhé súperovi za každú **moju** Cirhózu v línii — podľa
majiteľa — teda podľa partie —, nie podľa strany, na ktorej leží.)*

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
poldeci, Poldecko vyjde naprázdno. Poldecko sa týka **majiteľa karty**, nech
leží na ktorejkoľvek strane.

### 5b. Veštica

Porazený s Vešticou vo svojej partii si prezrie oba doberacie balíčky,
vymení jednu svoju kartu za súperovu a oba balíčky sa zamiešajú (§14).

### 6. Liečba alebo Pohreb

Každý hráč s **priznanou** Cirhózou smie vykonať jeden z úkonov so **svojimi
kartami v línii** (svojou partiou, na ktorejkoľvek strane):

- **Liečba** — spáľ priznanú Cirhózu a svoju kartu s tagom Závislý z línie,
  získaj 1 Dlh a po Preskúmaní si vyber jednu kartu zo šenku.
- **Pohreb** — spáľ priznanú Cirhózu a ľubovoľnú svoju kartu z línie.

### 6b. Limit ruky

Kto má v ruke viac ako 6 + priazeň Zberateľa, odhodí nadbytok (§7).

### 7. Návrat kariet

Všetky karty z oboch partií sa vrátia do odhadzovacieho balíčka **hráča, ktorý
ich zahral** (pri otočených kartách to určuje orientácia). Karty zahodené
v bitke (Dievčina na vydaj, Benzínka) sa nevracajú. Lokalitu získa víťaz —
po Benzínke ju nezíska nikto a prepadne.

---

## 9. Starší

8 starších, karta s tagom `Starešina` leží lícom nahor. Pod ňou ukazovateľ.

**Nahradený starší ostáva v hre celý** (Michal 2026-10-12, playtest
20261012-055944): marker sa hýbe Pohoršením aj prebytkom, scorecard dáva
priazeň, karta náhrady môže byť prebudená, na konci boduje a ráta sa do
vydesenia. Podmienky scorecardu aktivuje karta náhrady. Jediný rozdiel: o
náhradu sa nedá vyvolať bitka o staršieho. (Engine ho dovtedy vyraďoval,
web aj klient agentov pritom jeho posun ponúkali.)

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

**Priazeň a strach nikdy nepatria tomu istému hráčovi.** Kto má priazeň
staršieho, toho sa starší nebojí a na konci pri ňom **neboduje**; boduje ten
druhý. Posunúť marker k súperovi (Pohoršením, prebytkom) teda znamená dať mu
priazeň **teraz**, ale body **na konci** získaš **ty**. Marker v sivej zóne:
nikto nemá priazeň a nikoho sa nebojí.

Príklad: marker Farára na indexe 7 (polovica hráča 1, oranžová zóna) —
priazeň +2 má hráč 1; Farár sa bojí hráča 0 a na konci hry boduje hráč 0
podmienkami na svojej (ľavej) strane scorecardu, napr. Strach +2.

Web to počas hry ukazuje pri každom staršom dvoma riadkami: **♥** priazeň
(komu a s akým účinkom) a **★** koho sa bojí a koľko bodov by mu dal, keby
hra skončila teraz; súčet „body teraz" je pri hráčoch aj nad radom starších.

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
| Zberateľ | Limit ruky na konci kola | 6 + priazeň |
| Lakomec | Trocha | 1 + priazeň |
| Neprajník | Zopár | 2 + priazeň |
| Bitkár | Vyhodnotenie bitky | tuhé poškodenie navyše rovné priazni |
| Veriaci | Hodnota Viery | 1 + priazeň |
| Fajčiar | Prvé zhromaždenie v lokalite | cigaretky navyše rovné priazni |
| Alkoholik | Prah Cirhózy | 3 + priazeň |
| Exekútor | Prah Exekútora | 10 + 2 × priazeň |

Priazeň staršieho určuje scorecard, na ktorom leží (rozdáva sa náhodne).
**Zberateľ** nahradil Očumovateľa (Michal 2026-10-12): Preskúmanie používali
len Policajtka a Veštica a jeho priazeň v hre nič nerobila. Preskúmanie je
teraz pevne 5. Staré sady s Očumovateľom sa načítajú ako Zberateľ.

---

## 10. Bodovanie na konci hry

### Scorecardy (bočné bodovacie pozície)

Každý starší leží na **scorecarde** — podložke s rámčekom pre kartu, stupnicou
strachu a **8 bodovacími podmienkami** (4 na stranu, vo výške slotov karty).
Scorecardy sa starším **rozdajú náhodne** pri príprave hry a scorecard určuje
**priazeň** staršieho (názov scorecardu = priazeň). Rozhodnutie Michala
2026-10-11; rozloženie podmienok je z KartyAI (`data/scorecards.json`).

- Podmienku **aktivuje neprázdna akcia** karty na ukazovateli na tej istej
  strane a indexe. Náhrada staršieho tak zmení aktivované podmienky.
- **Ľavá strana patrí hráčovi 0, pravá hráčovi 1.**
- Na konci hry boduje pri každom staršom **len obávaný hráč** a **len
  aktivované podmienky na svojej strane**.

| Ikona | Podmienka | Body |
|---|---|---|
| 1 / 2 / 3 šípky | Znepokojenie / Strach / Vydesenie — marker aspoň v žltej / oranžovej / červenej zóne | pevné |
| smerovník | ovládnuté lokality | za kus, len od oranžovej zóny |
| väzeň | starší získaní náhradou | za kus, len od oranžovej zóny |
| cigareta | zvyšné cigarety | za kus, len od oranžovej zóny |
| pečeň | nepriznaná cirhóza | za kus (záporné) |
| bankovky | nepriznaný dlh | za kus (−1) |

Za kus: ovládnutá lokalita **2**, získaný starší **2**, cigareta **1**
(Michal 2026-10-12 — predtým 3/3/1; Veterinár dal v playteste 20261012-055944
sám 24 bodov). Nepriznaná Cirhóza −2, nepriznaný Dlh −1.

Kladné podmienky **za kus** (lokality, starší, cigarety) bodujú, len keď je
marker aspoň v **oranžovej** zóne (Strach); tresty za Dlhy a Cirhózy platia
od žltej. Rozhodnutie Michala 2026-10-12 po playteste 20261011-183315, kde
riadky za kus v žltej zóne dali 51:1 a strach starších prestal rozhodovať
(skúšobné, `docs/playtesty/zmeny-pravidiel.html`).

**[?]** Body za podmienky sú provizórne (`data/scorecards.json`, TODO).

### Kategórie

Všetky kategórie sa bodujú **len cez aktivované podmienky scorecardov** —
plošné body za lokality, cigarety, dlhy či cirhózu nie sú (rozhodnutie
Michala 2026-10-11).

---

## 11. Príprava hry

- Lokality podľa dĺžky hry: **5** krátka / **7** stredná / **11** dlhá
  (pravidlá v3). Dlhú hru možno zvoliť, až keď má zverejnená sada aspoň
  11 lokalít — `data/cards.json` ich má 7.
- 8 starších, markery do stredu na 0.
- Každý hráč: **10 štartovacích kariet** — Pijan, Miňištrant, Milujúca
  manželka, Dievčina na vydaj (v rôznych variáciách). Zamiešajú sa do jeho
  **doberacieho balíčka** a hráč si dobere **5 kariet do ruky** (pravidlá v3).
  **[?]** Presné rozdelenie 10 kariet medzi tie 4 typy pravidlá neuvádzajú.
- Každý hráč začína s **1 fyzickou cigaretou**, **2 nevypitými poldeci**,
  0 dlhmi, 0 poškodením pečene, 0 absťákmi, počítadlom závislosti na 0.
- Šenok je na začiatku prázdny — hráči ho postavia v prvom drafte (§7);
  jeho veľkosť je počet **nenahradených** starších (nadol na párne).

---

## 12. Kliatby

Nová kliatba (Dlh, Cirhóza) ide do **odhadzovacieho balíčka** hráča, nie do
ruky (pravidlá v3) — do ruky príde, až keď si ju hráč dobere; vtedy ju môže
priznať, alebo ju pri ťahaní preosieje Vízia. Na konci hry sa nepriznané
kliatby rátajú v ruke aj v oboch balíčkoch. Efekty, ktoré „zahadzujú" Dlhy či
Cirhózy z ruky (Niekoho stryná, Výherný automat), berú aj z odhadzovacieho
balíčka.

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | pri dosiahnutí prahu zadĺženia (akcie Hazard); priamo z efektov kariet | bez akcií; ráta sa k prahu Exekútora (keď je priznaný); nepriznaný uberá body |
| **Cirhóza** | pri dosiahnutí prahu poškodenia pečene | v bitke pridáva tuhé poškodenie |
| **Absťák** | keď hráč v kole skonzumuje **menej nerestí** než v predošlom; vykladá sa **rovno priznaný**. Viac nerestí → jeden Absťák späť do zásoby; prvé kolo len nastaví základ | znižuje **tvoje** tuhé poškodenie (o 1 za kus) |

**[?]** „Nerestí" — čo presne sa počíta? Poldeci? Cigarety? Oboje?

---

## 13. Kľúčové pojmy (skratky)

| Pojem | Význam |
|---|---|
| Línia | celý rad kariet v kole; lokalita v strede |
| Strana | polovica línie od lokality — tvoja a súperova; kam karta leží |
| Partia | všetky karty natočené k hráčovi (jeho karty), na ktorejkoľvek strane |
| Vypiť | otočiť plný poldeci na vypitý: limit −1, pečeň +1, ďalšia karta hneď |
| Šenok | ponuka kariet lícom nahor; obaja vidia, čo berú |
| Nástup | vyhodnotenie pri zahraní karty |
| Furt | platí, ak je karta odhalená kdekoľvek v hracom priestore |
| Preskúmanie | zober a prezri si 5 kariet, potom ich vráť |
| Odpoveď na NA EX | po súperovom NA EX jedna karta z ruky do línie mimo limitu |
| Limit ruky | na konci kola najviac 6 + priazeň Zberateľa kariet v ruke |
| Trocha | základ 1 | 
| Zopár | základ 2 |
| Zahodenie | odstrániť kartu z hry (spáliť) |
| Odhodenie | do odhadzovacieho balíčka hráča, ktorý ju zahral |
| Náhrada | hráč nahradí kartu z množiny určenej efektom |

---

## 14. Efekty kariet — výklad

Všetky efekty tlačovej sady engine vyhodnocuje automaticky (playtest
20261012-055944). Nejednoznačné texty vyložil Michal 2026-10-12 takto.
„Okolie" karty = jej susedia v línii (aj lokalita či starší v strede).

| Karta | Výklad |
|---|---|
| Benzínka | Pri bitke, ak súčet aktívnych Cigaretiek oboch hráčov presiahne 7: každý zahodí (spáli) 3 svojich Občanov z línie — kto ich má viac, vyberie; kto menej, zahodí všetkých. Súčty sa prepočítajú. Lokalitu nikto nevyhrá, prepadne (ráta sa medzi odohrané). |
| Dievčina na vydaj | Pri bitke sa zahodí (po bitke sa spáli, nevráti sa) a jej majiteľ spáli toľko **priznaných** Dlhov, koľko mala aktívnych akcií (s násobkami). |
| Hrobár | Keď súper zahodí kartu z ruky alebo z línie (efektom alebo limitom ruky; nie návratom po bitke), majiteľ Hrobára dostane cigaretu za každú. |
| Krčma | Kto má v Pitke plný poldeci a vlastného Občana/Starešinu v línii, musí dať NA EX. |
| Krčmárka | Pri bitke: ak hráč nemá Absťák a v tomto kole nedal NA EX, vypitý poldeci sa mu otočí na plný (automaticky). |
| Liberál | Ak je v partii majiteľa rovnako žien a chlapov (Liberál sa neráta), jeho aktívne akcie sa rátajú dvakrát. NA EX naň dať nemožno. |
| Milujúca manželka | Každá **priznaná** Manželka uberie z cigaretového draftu 1 cigaretu (najmenej 0). |
| Pasca | Majiteľ aktivuje najviac jedno Obmedzenie; to v bitke udelí súperovi Pecku (+2 tuhé). |
| Pijan | Ak má Žena v jeho okolí aktívnu akciu Poldeci, súper majiteľa Pijana dostane +1 Ranu. |
| Policajtka | Nástup: majiteľ si prezrie svoj doberací balíček, vybrané karty dá navrch (v poradí), ostatné naspodok. Ťah sa odovzdá až po výbere. |
| Poštárka | V Pitke raz: majiteľ smie dobrať 1 až Zopár kariet; ak dobral, získa Trocha Dlhov. |
| Silná nezávislá žena | Jej akcie platia, len ak sú oba jej susedia Chlap. |
| Starosta | V Pitke raz: za 1 cigaretu vymeň kartu z ruky za kartu zo šenku. |
| Svätý text | Zvyšná Viera majiteľa neznižuje súperovo tuhé poškodenie, ale jeho mäkké (1:1). Keďže Viera najprv ruší Povery, mäkké zníži len vtedy, keď Viera po vyrušení ostane (napr. pri súperových Novinách) — v praxi je to najmä nevýhoda. **[?]** |
| Šarlatán | Viera kariet v jeho okolí sa ráta ako Vízia. |
| Veterán | Ak je v partii majiteľa Influencer, neplatia jeho pravé akcie. Ak má oboch susedov a vpravo (z pohľadu majiteľa) je Žena, neplatia jeho ľavé akcie. |
| Veštica | Pri prehre: porazený si prezrie oba doberacie balíčky, vymení jednu svoju kartu za súperovu, potom sa oba balíčky zamiešajú. |
| Vychovávateľka | Keď majiteľ dá NA EX, súper si vezme jeden jeho priznaný Dlh do ruky. |
| Zámočník | Aktívne akcie Nástrojov v jeho okolí sa rátajú dvakrát. |
