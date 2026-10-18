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
- **NA EX** smie hráč dať na Občana alebo Starešinu v línii — **vlastného aj
  súperovho** (§5, Michal 2026-10-18). **Vypiť** — v
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
- **Útočník draftuje prvý**; **Pitiek** je toľko, koľko akcií karty lokality je aktivovaných, aspoň 1 (§7, Michal 2026-10-18; predtým |rozdiel kariet z draftu|).
- **Body za kus:** ovládnutá lokalita a získaný starší 2 (predtým 3) (§10).
- **Všetky efekty tlačovej sady** sa vyhodnocujú automaticky; výklad
  nejednoznačných textov je v §14.

**Zmeny po playteste proti človeku (rozhodnutia Michala 2026-10-16):**

- **Bodovanie bez strán:** každá aktívna podmienka scorecardu boduje **obom
  hráčom**, bez ohľadu na to, koho sa ten starší bojí. Zónové podmienky
  (Znepokojenie, Strach, Vydesenie) sa pozerajú na strach **všetkých**
  starších v hre. Marker určuje len priazeň a koho sa starší bojí (§9, §10).
- **Pečeň a zadĺženie len v Pitke:** vyhodnotia sa v Pitke a po každej Pitke
  sa vynulujú; pečeň z pitia do dna sa vyhodnotí v najbližšej Pitke (§5, §7).

**Dobiehanie porazeného (rozhodnutia Michala 2026-10-16, po playteste
20261016-134912 — víťaz bitky sa nabaľoval až do okamžitého vydesenia):**

- **Priazeň silnejšia:** sila 1 / 2 / 3 podľa zóny (predtým 1 / 2 / 2)
  a účinok **dvojnásobný** — každá priazeň pridáva 2 × sila (§9).
- **Útočník berie zo šenku prvý**; karta zadarmo zrušená (Michal 2026-10-18) — 1 karta za cigaretu alebo 2 karty za plný poldeci, bez limitu (§7).
- **Karta zo šenku stojí plný poldeci** (otočí sa na vypitý, limit
  vykladania v kole klesne). Cigarety za nevzaté karty sú zrušené (§7).
- **Cigaretka dáva fyzické cigarety** (mínus súperove Obmedzenia) a karty
  sa doberajú **fajčením** — cigareta = karta hneď, na svojom ťahu
  v Zhromaždení aj v Pitke (§3, §7).
- **Zvyšné cigarety bodujú po trojiciach** (1 kus = 3 cigarety) (§10).
- **Ohlásené vydesenie:** kto vydesí polovicu starších, vyhrá, až keď ich
  udrží do konca nasledujúceho kola (§1).
- Oprava: posun prebytkom, ktorý stojí viac (Miňištrant), sa nedá zaplatiť
  neúplným prebytkom (§8).

**Poldeci špirála (rozhodnutie Michala 2026-10-16, po playteste
20261016-155120 — Eva hrala 4 zo 7 kôl s limitom 1 a v prehratých bitkách
mala 0 tuhého):**

- **Nové kolo, jeden poldeci späť:** na začiatku každého kola sa každému
  hráčovi otočí jeden vypitý poldeci na plný (§5).
- **Limit pred a po ťahu:** rozhranie ukazuje limit vykladania oboch hráčov,
  pri karte zo šenku a pri Vypiť „limit X → Y“ a pri NA EX limit v ďalšom kole.

> Miesta označené **[?]** sú nejednoznačné alebo v pravidlách chýbajú.
> Neimplementuj ich potichu — pozri `docs/BRIEF.md`, sekcia „Otvorené otázky".

---

## 1. Základ

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality, desia starších.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč vydesí aspoň polovicu starších (aj nahradených) a **udrží ich do konca nasledujúceho kola** (Michal 2026-10-16 — ohlásené vydesenie; súper má kolo na odpoveď, napr. bitku o vydeseného staršieho) | **vyhráva** |
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
| Hazard | `Dlh` | zvýši **zadĺženie** o 1; pri prahu (**1**, Michal 2026-10-18) vznikne karta Dlhu — každý aktívny Hazard v Pitke je Dlh |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene |
| Obmedzenie | `Obmedzenie` | súper dostane v Pitke o fyzickú cigaretu z Cigaretiek menej (Michal 2026-10-16; predtým menej potiahnutí) |
| Cigaretka | `Cigaretka` | +1 **fyzická cigareta** v Pitke (Michal 2026-10-16; predtým +1 potiahnutie) — cigarety sa prenášajú a fajčením dávajú karty |
| Vízia | `Vízia` | z práve dobraných kariet zahoď až 2 kliatby za každú Víziu a dober si rovnaký počet nových |
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
- **Vnútorná hrana** karty je tá, ktorá je obrátená k lokalite — ňou sa karta
  páruje so susedom bližšie k stredu (prvá karta strany s lokalitou).
  **Vonkajšia hrana** ostáva voľná pre ďalšiu kartu. Z pohľadu hráča, ktorý
  kartu zahral: na jeho strane je vnútorná jeho pravá hrana, na súperovej jeho
  ľavá. Pojmy zaviedol playtest 20261017-164450 (Michal 2026-10-18) — pravidlo
  sa nemení, len pomenovanie; web aj klient agentov ukazujú náhľad spoja pred
  vyložením a ktorá hrana lokality je obrátená ku ktorej strane.
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
- Nástroj tvorí spoj len s Občanom alebo Starešinom (§6, Michal 2026-10-18).
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
- **Na začiatku každého kola** (pred voľbou cieľa a stavbou šenku) sa každému
  hráčovi otočí **jeden vypitý poldeci na plný** (Michal 2026-10-16, playtest
  20261016-155120). Viac vypitých si treba doliať (cigarety, barter,
  Poldecko, Krčmárka).
- **Limit 0 → hráč okamžite prehráva bitku.**
- Už vyložené karty sa nikdy nevracajú.

### NA EX

Smie sa dať **iba počas fázy NA EX v Pitke**, v základe **najviac raz za Pitku**.
Hráč vyberie jednu kartu v línii s tagom **Občan alebo Starešina** — **svoju
aj súperovu**, na ktorejkoľvek strane — a položí na ňu jeden plný poldeci
(Michal 2026-10-18 zrušil obmedzenie pravidiel v3 „len na vlastnú kartu“).
Akcie karty po NA EX sa rátajú jej majiteľovi: na súperovej karte mu zrušíš
aktívne akcie, ale zdvojíš mu neaktívne. Svokra: za každé tvoje NA EX ti
majiteľ Svokry ukradne cigaretu (Michal 2026-10-18).
Na **Liberála** NA EX dať nemožno, na **Anonymného alkoholika** ani na jeho
susedov tiež nie. Na **Krčme** hráč s plným poldeci (a kartou,
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
ktorý NA EX dal (poldeci pije on); poldeci sa fyzicky vypije až pri bitke.
Kliatby, ktoré karta po NA EX vyprodukuje (zdvojený Dlh či Pečeň), patria
majiteľovi karty — NA EX zruší aktívne akcie (aj vlastný Dlh či Pečeň)
a zdvojí neaktívne.

### Vypiť (do dna)

V **Zhromaždení**, keď je na ťahu, smie hráč **vypiť**: otočí jeden **plný
poldeci na vypitý**. Za to:

- jeho **ďalšie vyloženie neukončí ťah** — zahrá dve karty (priznania,
  Nástroje) za sebou, súper medzitým nereaguje,
- jeho **zostávajúci limit vykladania hneď klesne o 1** (poldeci už nie je
  plný; v ďalších Zhromaždeniach sa limit počíta z plných poldeci ako vždy),
- dostane **+1 poškodenie pečene** a pitie sa ráta ako **nerest** (Absťák).
  Pečeň sa vyhodnocuje len v Pitke (Michal 2026-10-16): +1 sa pripíše dopredu
  a prah Cirhózy sa skontroluje v najbližšej Pitke.

Piť smie **opakovane**, kým má plné poldeci — každé vypitie pridá ďalšie
vyloženie bez odovzdania ťahu. Pasovanie nevyužité ťahy navyše ruší. Vypitý
poldeci sa dá doliať (2 cigarety, barter, Poldecko) a jeden sa doleje sám na
začiatku kola. Na Zastávke (limit 2)
vypitie limit tiež znižuje.

### Doplnenie poldeci

- **Zadarmo na začiatku kola** → jeden vypitý poldeci sa otočí na plný (vyššie).
- **Počas Pitky, 2 fyzické cigarety** → otoč jeden vypitý poldeci späť na plný.
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

**Dedičstvo stojí 2 fyzické cigarety** (Michal 2026-10-18): bez nich Nástroj
do Dedičstva nevyložíš, do línie áno (limit nemíňa). Efekt v Dedičstve funguje
ako malá priazeň (Nealko prah Cirhózy +2, Svätý text Viera +1, Cigorky
cigareta v každej Pitke, Puška prebytok proti tebe −2, Noviny, Pasca, Výherný
automat, Vínko).

**Nástroj potrebuje podporu** (Michal 2026-10-18): Nástroj v línii vytvorí
spoj len s kartou s tagom **Občan alebo Starešina**. Pri lokalite, karte
staršieho v strede či karte bez týchto tagov (napr. Zviera bez tagu Občan)
**spoj nevznikne** — neaktivuje sa nič, ani akcia Nástroja, ani akcia suseda.
Náradie musí mať kto používať.

---

## 7. Priebeh kola

**Útočník** = hráč, ktorý prehral poslednú bitku (v prvom kole náhodne).
Vyberá cieľ kola a **berie zo šenku prvý** (karta zadarmo zrušená 2026-10-18).
**Obranca** vykladá ako prvý. (Michal 2026-10-12: predtým obranca aj
draftoval prvý a v playteste 20261012-055944 vyhral 7 z 8 bitiek. Stavba
šenku to potichu vrátila na obrancu a útočník vyhral 1 z 5 bitiek; Michal
2026-10-16 to opravil a pridal prvú kartu zadarmo.)

**Doplnenie ruky** (pravidlá v3): na začiatku každého kola (od 2. kola, po
návrate kariet z bitky) si každý hráč dobere zo svojho doberacieho balíčka
toľko kariet, aby mal v ruke **5**. Kto má viac, nič nezahadzuje. Keď sa
doberací balíček minie, zamieša sa odhadzovací. Karty navyše dáva fajčenie
(cigareta = karta hneď, na svojom ťahu v Zhromaždení aj v Pitke).

**Limit ruky** (Michal 2026-10-12): na konci kola, po Liečbe a Pohrebe, smie
mať hráč v ruke najviac **6 + priazeň Zberateľa** kariet. Nadbytok odhodí do
odhadzovacieho balíčka (vyberie si, ktoré karty — aj kliatby, tie sa tak
vrátia do balíčka). Obranca odhadzuje prvý.

```
Voľba cieľa → [Draft] → (Zhromaždenie → Pitka) × N → Bitka
```

### Bitka o lokalitu — draft

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

**2. Branie zo šenku** (Michal 2026-10-18). Hráči berú zo šenku **striedavo,
začína útočník**, a každý vezme, **koľko si môže dovoliť** (limit 3 karty
zrušený). Na svojom ťahu zaplatí:

- **1 cigaretu → 1 karta**, alebo
- **1 plný poldeci → 2 karty** — druhú si vezme hneď v tom istom ťahu;
  poldeci sa otočí na vypitý, takže hráčovi v tomto kole klesne limit
  vykladania. Ak prestane skôr alebo sa šenok minie, druhá karta prepadá.

Nič nie je zadarmo (útočníkova prvá karta zadarmo zrušená). Kto nemá
cigaretu ani plný poldeci, brať nemôže (hra za neho branie ukončí). Keď jeden
prestane, druhý berie ďalej sám. Prázdny šenok branie ukončí obom.

Nevzaté karty ostávajú v šenku do ďalšieho draftu (Starosta a Liečba z neho
berú aj medzitým); bitka o staršieho draft nemá, šenok sa vtedy nemení.

```
počet Pitiek = max(1, aktivované akcie na karte lokality)
```

(Michal 2026-10-18: počet sa ráta priebežne — keď sa pri lokalite aktivujú
ďalšie akcie, Pitiek pribudne; pod už odohrané neklesne. Bitka o staršieho
má vždy jednu Pitku. Predtým `max(1, |rozdiel kariet z draftu|)`.)

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
bodov** oboch hráčov pre výhru jedného či druhého — strach toho staršieho
prestane bodovať (marker ide do sivej), víťazovi pribudne získaný starší.

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
2. **Hazard** — zadĺženie; pri dosiahnutí prahu (1) hráč hneď získa Dlh
3. **Poškodenie pečene a Cirhóza** — akcie Pečeň, Poldecko a NA EX (a pečeň
   z pitia do dna v predošlom Zhromaždení); pri dosiahnutí prahu hráč hneď získa Cirhózu
4. **Obmedzenie**
5. **Cigaretky** — hráč dostane fyzické cigarety (Michal 2026-10-16)
6. **Ťahanie kariet** — len efekty kariet (Kostol); inak sa karty doberajú fajčením
7. **Vízia** — preosieje karty dobraté v tejto Pitke (fajčením aj efektmi)

```
nové cigarety = Cigaretky (+ priazeň Fajčiara v 1. Pitke) − súperove Obmedzenia − priznané Milujúce manželky   (najmenej 0)
```

**Fajčenie** (Michal 2026-10-16): na svojom ťahu v Zhromaždení aj v Pitke
smie hráč vyfajčiť cigaretu — hneď si dobere kartu, ťah mu neskončí, ráta
sa to ako nerest. Cigarety sa prenášajú z kola na kolo. V Zhromaždení sa za
hráča, ktorý nemá čo vyložiť, pasuje aj vtedy, keď má cigarety.

Po vyhodnotení Pitky sa **pečeň aj zadĺženie oboch hráčov vynulujú**
(Michal 2026-10-16) — zvyšok pod prahom sa do ďalšej Pitky neprenáša.

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
staršiemu. Miňištrant vo víťazovej partii zdraží každý posun o 1; na posun,
ktorý stojí viac, než zostáva prebytku, prebytok nestačí a prepadne
(oprava 2026-10-16 — predtým sa dal zaplatiť aj neúplným zvyškom).

**Cigarety za prebytok** (Michal 2026-10-18): hráč, proti ktorému sa
prebytok rozdeľoval (spravidla porazený), dostane po bitke **1 cigaretu za
každého staršieho, ktorého marker sa prebytkom posunul**. Viac posunov toho
istého staršieho = 1 cigareta; posuny viacerých starších = viac cigariet.
Pohoršenie sa neráta.

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

9 pozícií, sila priazne `3-2-1-0-0-0-1-2-3` (Michal 2026-10-16; predtým 2-2-1-0-0-0-1-2-2), marker začína v strede (index 4).

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Hodnota | 2 | 2 | 1 | 0 | 0 | 0 | 1 | 2 | 2 |
| Zóna | červená | oranžová | žltá | sivá | sivá | sivá | žltá | oranžová | červená |
| Názov | Vydesenie | Strach | Znepokojenie | Neutralita | | | Znepokojenie | Strach | Vydesenie |

**Konvencia strán** (návrh): indexy 0–2 = polovica hráča 0, 6–8 = polovica
hráča 1, 3–5 = neutrálny stred.

### Dvojaká úloha markera

- **Priazeň (počas hry)** — marker leží na polovici jedného hráča → **ten**
  hráč sa teší priazni. Sila = zóna pozície (1 / 2 / 3), účinok 2 × sila.
- **Strach** — starší sa bojí hráča, **od ktorého je marker odtlačený**,
  teda hráča na **opačnej** strane, na **úrovni** zóny markera (1 žltá,
  2 oranžová, 3 červená).

**Priazeň a strach nikdy nepatria tomu istému hráčovi.** Posunúť marker
k súperovi (Pohoršením, prebytkom) znamená dať mu priazeň **teraz** a mať
staršieho, ktorý sa bojí **teba**. Marker v sivej zóne: nikto nemá priazeň
a nikoho sa nebojí.

**Strach o bodoch tohto staršieho nerozhoduje** (Michal 2026-10-16) — jeho
scorecard boduje obom hráčom (§10). Strach sa ráta do zónových podmienok
(Znepokojenie, Strach, Vydesenie) **na všetkých scorecardoch**.

Príklad: marker Farára na indexe 7 (polovica hráča 1, oranžová zóna) —
priazeň +2 má hráč 1; Farár sa bojí hráča 0 na úrovni 2. Každý scorecard
s aktívnym Strachom (alebo Znepokojením) tak hráčovi 0 pridá body za Farára.

Web to počas hry ukazuje pri každom staršom: **♥** priazeň (komu a s akým
účinkom), **★** body tohto scorecardu pre teba aj súpera, keby hra skončila
teraz, a koho sa starší bojí; pri každej aktívnej podmienke je číslo s tvojimi
bodmi a tlačidlo „rozpis bodov" ukáže tabuľku všetkých podmienok.

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

**Priazeň** (bonus) = **2 × sila** (Michal 2026-10-16: účinok zdvojnásobený,
aby vyvážil prehrávanie — prebytok posúva markery k porazenému). Sila 1 / 2 / 3:

| Priazeň | Uplatňuje sa pri | Vplyv | sila 1 / 2 / 3 |
|---|---|---|---|
| Zberateľ | Limit ruky na konci kola | 6 + priazeň | 8 / 10 / 12 |
| Lakomec | Stokársky barter | 5 − sila cigariet | 4 / 3 / 2 |
| Neprajník | Mäkké poškodenie Povier | smie prekročiť súperove priznané Dlhy o priazeň | +2 / +4 / +6 |
| Bitkár | Vyhodnotenie bitky | tuhé poškodenie navyše rovné priazni | +2 / +4 / +6 |
| Veriaci | Hodnota Viery | 1 + priazeň | 3 / 5 / 7 |
| Fajčiar | Prvá Pitka bitky o lokalitu | Cigaretky (cigarety) navyše rovné priazni | +2 / +4 / +6 |
| Alkoholik | Prah Cirhózy | 3 + priazeň | 5 / 7 / 9 |
| Exekútor | Prah Exekútora | 10 + 2 × priazeň | 14 / 18 / 22 |

Priazeň staršieho určuje scorecard, na ktorom leží (rozdáva sa náhodne).
**Zberateľ** nahradil Očumovateľa (Michal 2026-10-12): Preskúmanie používali
len Policajtka a Veštica a jeho priazeň v hre nič nerobila. Preskúmanie je
teraz pevne 5. Staré sady s Očumovateľom sa načítajú ako Zberateľ.

**Trocha a Zopár zmizli** (Michal 2026-10-18, revízia kariet, variant A):
každý efekt uvádza pevné číslo (Farár „ignoruj 2 súperove Povery“,
Autobusár „ignoruj 1 Absťák“, Poštárka „až 2 karty a s nimi 1 Dlh“…), číslo
už nezávisí od iného staršieho. Lakomec zlacňuje barter (nepoužíva 2 × silu,
lebo barter za 1 cigaretu by bol poldeci zadarmo), Neprajník púšťa Povery nad
súperove priznané Dlhy. Čísla sú v kóde v `KONSTANTY.EFEKT`.

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
- **Starší nemá pri bodovaní strany** (Michal 2026-10-16): každá aktívna
  podmienka — ľavá aj pravá — boduje **obom hráčom**, každá zvlášť (dve
  aktívne Lokality = dvakrát), bez ohľadu na to, koho sa starší bojí.
  Strana len určuje, ktorá akcia karty podmienku aktivuje.

| Ikona | Podmienka | Body pre každého hráča |
|---|---|---|
| 1 / 2 / 3 šípky | Znepokojenie / Strach / Vydesenie | za každého staršieho v hre, ktorý sa hráča bojí aspoň na úrovni 1 / 2 / 3 |
| smerovník | ovládnuté lokality | za kus |
| väzeň | starší získaní náhradou | za kus |
| cigareta | zvyšné cigarety | za kus — **kus = 3 cigarety** (Michal 2026-10-16) |
| pečeň | nepriznaná cirhóza | za kus (záporné) |
| bankovky | nepriznaný dlh | za kus (−1) |

Za kus: ovládnutá lokalita **2**, získaný starší **2**, cigareta **1**
(Michal 2026-10-12 — predtým 3/3/1; Veterinár dal v playteste 20261012-055944
sám 24 bodov). Nepriznaná Cirhóza −2, nepriznaný Dlh −1. Znepokojenie **1**,
Strach **2**, Vydesenie **3**.

**Zónové podmienky** sa pozerajú na **všetkých 8 starších** vrátane toho,
na ktorého scorecarde ležia. Za každého staršieho, ktorý sa hráča bojí na
úrovni L, dá scorecard hodnotu svojej **najvyššej** aktívnej zónovej
podmienky s úrovňou ≤ L (nesčítajú sa). Príklad Michala: Farár má aktívne
Znepokojenie a Strach. Starší A sa ťa bojí na úrovni 1, B na 2, Farár je
v neutrále → z Farára máš 1 + 2. Keď Farára vydesíš (úroveň 3), ráta sa za
neho Strach (Vydesenie aktívne nemá) → 1 + 2 + 2.

(Predtým, 2026-10-11 až 2026-10-16: bodoval len obávaný hráč, len podmienky
na svojej strane a podľa zóny markera tohto staršieho; kladné za kus až od
oranžovej zóny. Playtest proti človeku ukázal, že je to neintuitívne.)

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
| Anonymný alkoholik | Na neho ani na karty vedľa neho na tej istej strane línie nedá NA EX nikto — ani jeho majiteľ, aj keď je podstrčený na súperovu stranu. Bráni len novému NA EX; poldeci, ktorý už na susedovi leží, ostáva. Prvé karty oboch strán susedia s lokalitou, nie navzájom. (Michal 2026-10-18) |
| Krčma | Kto má v Pitke plný poldeci a Občana/Starešinu v línii (vlastného či súperovho), musí dať NA EX. |
| Krčmárka | Pri bitke: ak hráč nemá Absťák a v tomto kole nedal NA EX, vypitý poldeci sa mu otočí na plný (automaticky). |
| Liberál | Ak je v partii majiteľa rovnako žien a chlapov (Liberál sa neráta), jeho aktívne akcie sa rátajú dvakrát. NA EX naň dať nemožno. |
| Milujúca manželka | Každá **priznaná** Manželka uberie 1 z cigariet, ktoré hráč v Pitke získa z Cigaretiek (najmenej 0; Michal 2026-10-16 — predtým z cigaretového draftu). |
| Kočovník | Smie na súperovu stranu bez limitu vykladania. Hazard a Poškodenie pečene z jeho akcií dostáva hráč, na ktorého strane leží (Pecku a Poldecko jeho majiteľ). |
| Pasca | Dedičstvo: akcie prvej karty, ktorú súper majiteľovi v kole podstrčí na stranu, neplatia (spoj s jej susedmi sa ráta, ona sama nič nedá). |
| Pes | Kým je Pes na konci strany svojho majiteľa, súper naň nesmie podstrčiť kartu. Nesmie byť v partii s iným zvieraťom. |
| Pijan | Ak má Žena v jeho okolí aktívnu akciu Poldeci, súper majiteľa Pijana dostane +1 Ranu. |
| Policajtka | Furt: súperove Pohoršenia proti majiteľovi neplatia (Michal 2026-10-18; Autorita — Praudovravec súpera ju umlčí). |
| Poštárka | V Pitke raz: majiteľ smie dobrať 1 až 2 karty; ak dobral, získa 1 Dlh. |
| Praudovravec | Autority v **súperovej** partii neuplatňujú efekt (Michal 2026-10-18; predtým v tvojej). |
| Silná nezávislá žena | Aktívne akcie tvojich kariet, ktoré s ňou susedia, sa rátajú dvakrát (lokalitu, kartu staršieho ani súperove karty nezdvojí). |
| Starosta | V Pitke raz: za 1 cigaretu vymeň kartu z ruky za kartu zo šenku. |
| Svätý text | Dedičstvo: hodnota majiteľovej Viery je o 1 vyššia. |
| Noviny | Dedičstvo: majiteľovo Pohoršenie smie posunúť marker aj na krajnú pozíciu, ak bol na predposlednej už na začiatku kola. |
| Finančná poradkyňa | Hazard z jej akcií dostáva súper, nie jej majiteľ. |
| Čierna mačka | Majiteľove Povery spôsobujú mäkké poškodenie aj bez súperových priznaných Dlhov (bez stropu). |
| Svokra | Kým leží v línii, každé NA EX súpera jej majiteľa — na hociktorú kartu, aj povinné na Krčme — mu zoberie 1 cigaretu a dá ju majiteľovi Svokry; každá Svokra jednu. Bez cigarety nič. Praudovravec súpera ju umlčí (Autorita). Nahradila zákaz NA EX z pravidiel v3 (Michal 2026-10-18). |
| Šarlatán | Viera kariet v jeho okolí sa ráta ako Vízia. |
| Veterán | Ak je v partii majiteľa Influencer, neplatia jeho pravé akcie. Ak má oboch susedov a vpravo (z pohľadu majiteľa) je Žena, neplatia jeho ľavé akcie. |
| Veštica | Pri prehre: porazený si prezrie oba doberacie balíčky, vymení jednu svoju kartu za súperovu, potom sa oba balíčky zamiešajú. |
| Vychovávateľka | Keď majiteľ dá NA EX, súper si vezme jeden jeho priznaný Dlh do ruky. |
| Zámočník | Aktívne akcie Nástrojov v jeho okolí sa rátajú dvakrát. |
