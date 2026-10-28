# Návrh § Formát 2 na 2 (roadmapa #22)

Návrh paragrafu do `docs/PRAVIDLA.md` podľa pravidiel v8 (master 691bc00). Vychádza
z rozhodnutí Michala z 2026-10-28 (vlna 1 a 2 v `docs/napady/2na2-otazky.html`).
Body, ktoré Michal ešte nepotvrdil, sú označené **[na potvrdenie]**. Zoznam je na konci.
PRAVIDLA.md sa zatiaľ nemení. Paragraf má byť samostatná kapitola za §16.
Číslo (napr. §18) a zmenu §1 („presne dvoch hráčov“) treba pridať až pri zápise.

---

## 18. Formát 2 na 2

Dva **tímy** po dvoch hráčoch, štyri zariadenia, jedna partia (Michal 2026-10-28).
Platí všetko z §1–§17 s rozdielmi nižšie. Zásada: **tím je hráč z 1 na 1 s dvoma
rukami.** Všetko, čo pravidlá hovoria o hráčovi — strana, partia, zdroje, kliatby,
špaky, útočník a obranca —, v 2 na 2 platí pre tím. Osobná je len **ruka**
a **ťah** v poradí miest. Hra 1 na 1 je osobitný prípad: dva tímy po jednom hráčovi.

### 18.1 Tím, miesto, kapitán

- Tímy sedia **striedavo**. Poradie ťahov je vždy **U1 → O1 → U2 → O2**
  (U = útočný tím, O = obranný). Platí pre branie zo šenku, Zhromaždenie
  a všetko, čo sa v 1 na 1 strieda.
- Každý tím má v každom kole **kapitána**. Kapitán sa v tíme **strieda každé
  kolo**. V tíme človek + bot je kapitánom **vždy človek**. Kapitán prvého kola
  sa určí zo semienka hry. Kapitán útočného tímu je **U1**, kapitán obranného
  **O1**. **[na potvrdenie]**
- **Kapitán robí tímové voľby:** volí a natáča cieľ (obranný tím), patronát,
  NA EX a koniec Pitky, kto odpovedá na NA EX, rozdelenie prebytku, Pohoršenia,
  Víziu (do ktorej ruky) a karty za Absťák a Manželku. **[na potvrdenie: Pohoršenia,
  Vízia, Absťák]**
- **Partner vidí všetko, čo vidí jeho tím:** ruku partnera, karty dané pri
  stavbe šenku naspodok, náhradu pri patronáte, Záverečnú, skryté NA EX tímu
  a vrch balíčka z Vízie. Súperský tím z toho nevidí nič (`viewFor` filtruje podľa tímu).

### 18.2 Čo je tímové a čo osobné

| Tímu | Hráčovi |
|---|---|
| strana línie, kraje a prevaha, partia (karty natočené k tímu) | ruka |
| doberací a odhadzovací balíček | ťah v poradí U1 → O1 → U2 → O2 |
| poldeci (plné aj vypité) a limit vykladania | — |
| cigarety | — |
| zadĺženie a Dlhy, pečeň a Cirhózy | — |
| neresti a Absťáky | — |
| Dedičstvo **[na potvrdenie]** | — |
| markery starších (polovica stupnice), priazeň, strach, vyplatené zóny | — |
| špaky, krčmová nástenka, vydesenie | — |
| útočník a obranca | — |

Karty sa medzi rukami **nepodávajú**. Karta ostáva v ruke, do ktorej prišla
(Michal 2026-10-28).

### 18.3 Príprava (k §3)

- **Liga:** predvolená je **Tretia liga** (3 bitky + finále), ostatné ligy sa dajú zvoliť.
- **Počiatočná ruka:** **každý hráč** má v ruke 4 štartovacie karty. Tím má
  spoločný prázdny doberací balíček a spoločný odhadzovací balíček.
- **Tím** začína so **4 cigaretami**, **3 plnými poldeci**, 0 špakmi, 0 Dlhmi,
  0 zadĺžením, 0 pečeňou, 0 Absťákmi a počítadlom nerestí na 0.
- **Prah Dlhu je 3** a **prah Cirhózy 4** (v 1 na 1 je to 2 a 3, v 2 na 2 o jedna
  viac). Úpravy z kariet a lokalít sa k nim pripočítajú: Nealko +2, Krčma +2,
  Výherný automat +1.
- Útočný tím prvého kola sa určí zo semienka.

### 18.4 Priebeh kola (k §4)

- **Začiatok kola:** tímu sa otočí **jeden** vypitý poldeci na plný **[na
  potvrdenie]**. Od druhého kola si **každý hráč** dobere 1 kartu zo spoločného
  doberacieho balíčka (najprv U1, O1, U2, O2).
- Karta, ktorú dáva fajčenie, priznanie alebo efekt „dober / vezmi si do ruky“,
  ide do ruky **hráča, ktorý to spustil**. Pri Hasičovi, Starostovi,
  Recidivistovi a Živnostníkovi je to ten, kto kartu zahral. **[na potvrdenie]**

### 18.5 Cieľ a draft (k §5)

- Cieľ volí a natáča **kapitán obranného tímu**.
- **Stavba šenku:** každý hráč si zo spoločného balíčka vezme **N/2** kariet
  a tajne dá **polovicu nahor** do šenku a zvyšok naspodok spoločného balíčka.
  N = počet nenahradených starších, zaokrúhlený nadol na párne. Pri N = 8 dá
  každý 2 do šenku a šenok má 8 kariet; pri N = 6 vezme každý 3 a do šenku dá 2.
  **[na potvrdenie: čísla]**
- **Branie zo šenku:** dookola U1 → O1 → U2 → O2. Platí sa z tímovej kasy
  (1 karta za 1 cigaretu, 2 karty za 3), karty idú do ruky hráča, ktorý berie.
  Kto prestane, už neberie. Keď prestanú obaja z jedného tímu, každý ešte
  neprestavší člen druhého tímu má posledný ťah. **[na potvrdenie: posledná šanca]**
- Priazeň **Fajčiara** dáva cigarety tímu.
- **Patronát:** tím smie vziať najviac **jedného** staršieho za kolo a vyberá
  ho kapitán. Karta staršieho ide do ruky člena podľa voľby kapitána a náhradu
  lícom dole dá ten istý člen zo svojej ruky. Cigarety a bolestné poldeci platí
  tím. Pohoršenia navyše dostane súperský tím.

### 18.6 Zhromaždenie (k §6, §11, §12, §13)

- Na ťahu hráč vyloží kartu **zo svojej ruky** na koniec strany svojho tímu
  alebo súperského tímu. Karta je natočená k jeho **tímu** a patrí do **partie
  tímu**. Prevahu v kraji má tím s viac Občanmi, Zvieratami a Starešinami;
  akcie hrany lokality dostane tento tím.
- **Limit vykladania** je **tímový**: plné poldeci tímu + 1. Míňa ho každé
  vyloženie ktoréhokoľvek člena a členovia sa oň delia. „Limit vždy aspoň 1“
  platí pre tím. **Vypiť:** každá ďalšia karta v ťahu člena stojí plný poldeci
  tímu.
- **Pas hráča** (Michal: „cigarety hneď každému za seba“). Presné pravidlo je
  **[na potvrdenie]**:
  - Člen, ktorý pasuje, si vyberie počet *k*, najviac
    min(zostávajúci limit tímu, karty v jeho ruke).
  - Dostane *k* cigariet do tímovej kasy a zostávajúci limit tímu **klesne o *k***.
  - Partner hrá ďalej zo zvyšku. Keď pasuje aj on, ráta sa rovnako.
  - Každá jednotka limitu sa teda buď vyloží, alebo vyplatí — nikdy oboje.
  - Keď limit tímu klesne na 0, tím skončil (bez cigariet).
  - Pas ruší nevyužité ťahy z Vypiť ako dnes.
  - Zhromaždenie končí, keď skončili obaja členovia oboch tímov.
- **Záverečná:** najviac **jedna za tím** v Zhromaždení, za 1 cigaretu
  z tímovej kasy. Ukončí vykladanie **celého tímu** (ako pas, ale bez cigariet —
  ani pre člena, ktorý ešte nepasoval).
- **Priznanie:** kliatbu z ruky smie priznať jej držiteľ; ide medzi priznané
  karty tímu. Karta za priznanie (Manželka, dobratý Dlh) ide do jeho ruky.
- **Dedičstvo:** Nástroj z ruky ktoréhokoľvek člena sa platí tímovými
  cigaretami. Cena rastie spoločne pre oba tímy (1, 2, 3…) a efekt platí tímu.
  **[na potvrdenie]**

### 18.7 Pitka (k §7)

- Pitku hrajú všetci štyria **naraz**. **Obaja členovia** smú fajčiť (karta ide
  do ruky toho, kto fajčil), dolievať, barterovať, platiť Kšefty a Úplatky.
  Všetko sa platí z **tímovej kasy**.
- Cena fajčenia rastie **za tím**: prvé fajčenie tímu v Pitke 1, druhé 2…
- Kšeft lokality a Úplatok na kartu smie tím použiť **raz** za Pitku. Kšeft
  karty je ako v 1 na 1: každá karta raz za Pitku.
- **NA EX:** tím dá v Pitke najviac **jedno** (Vínna pivnica dve), z tímového
  poldeci. Vyberá ho **kapitán**, ktorý aj ukončí Pitku za tím („hotovo“).
  NA EX a pečeň z neho sú tímu.
- **Zrážka** vzniká len medzi tímami. Výtržník je bez zmeny.
- **Odkrytie:** najprv NA EX obranného tímu, potom útočného.
- **Odpoveď na NA EX:** odpovie jeden člen, ktorého určí kapitán, jednou
  kartou zo svojej ruky. Najprv obranný tím, potom útočný (posledné slovo).
- Vyhodnotenie (zadĺženie, pečeň, Obmedzenie, cigarety, Vízia) je tímové
  a prahy sú podľa 18.3.

### 18.8 Pečeň, nerest, Absťák (k §8)

Neresti oboch členov sa sčítajú a porovnajú s tímovým súčtom predošlého kola.
Absťák je tímový a kartu zaň dobere ruka podľa kapitána. Milujúca manželka
znižuje pečeň tímu.

### 18.9 Bitka (k §9, §11)

- Poškodenie aj výsledok sa rátajú **súčtom tímu**: akcie oboch členov,
  priznané Cirhózy súperského tímu, Viera, Povery proti Dlhom súperského tímu,
  Absťáky tímu. Pri remíze rozhodujú Absťáky, potom Dlhy tímu.
- **Exekútor:** zhorí polovica tímových Dlhov nahor a rovnako špakov z tímového
  popolníka. Záhradkár v partii tímu exekúciu obíde.
- **Pohoršenia** tímu (aj z patronátu a priazne Abstinenta) rozdeľuje kapitán.
  Najprv obranný tím, potom útočný. **[na potvrdenie]**
- **Prebytok** rozdeľuje kapitán tímu, proti ktorému sa ráta (vo finále
  kapitán držiteľa). Cigarety za prebytok dostane tím.
- Karty z línie sa vrátia do **odhadzovacieho balíčka tímu**. Nepriznaná
  Cirhóza z oboch rúk ide tam tiež.
- **Veštica:** porazený tím si prezrie oba doberacie balíčky tímov a vymení
  jednu kartu.

### 18.10 Starší (k §10)

Polovice stupnice patria tímom. Priazeň aj strach sú tímové a priazeň platí
**raz za tím** (Výpalník, Fajčiar a Alkoholik dávajú tímu, Kmotor presúva
tímové Dlhy súperskému tímu) **[na potvrdenie]**. Prebudený starší patrí
tímu. Vydesenie = polovica starších pre tím.

### 18.11 Špaky a finále (k §14, §14b)

Tím má jeden popolník. Výkupné sa ráta z tímových poldeci a cigariet
(každých celých 5 cigariet tímu = 1 špak). Nepriznaná Cirhóza −3 sa ráta
z oboch rúk a tímových balíčkov. Vo finále útočí tím s menej špakmi.

### 18.12 Výklad kariet a lokalít (k §15, §16)

- **„Súper“** = súperský tím ako celok (Michal: „Pojem súper je druhý tím.“).
  Efekt, ktorý mieri na súpera, zasiahne tím **raz** — zdroje, kliatby aj
  balíček má tím jedny.
- **„Ty“, „tvoj“, „tvoja partia“, „tvoje karty“** = tvoj tím (Michal 2026-10-28).
  Partner nie je súper. Jeho priloženie nespúšťa Konflikt tvojich kariet,
  Úplatok na tvoju kartu dať nesmie a Pes s jeho kartou netvorí „spoj so
  súperovou kartou“.
- **Ruka** je jediná výnimka: „do ruky“ znamená do ruky hráča, ktorý efekt
  spustil (18.4). Krčmárka: na NA EX tímu neodpovie ani jeden súper. Kohút:
  posledné slovo má tím majiteľa. Bzdocha: súperský tím hrá Pitku pred tvojím
  tímom a tvoj kapitán vidí jeho NA EX.
- **Autobusár:** súperský tím nedostane cigarety za pas člena, ktorý pasuje
  po tom, čo pasoval niektorý člen tvojho tímu. **[na potvrdenie]**
- **Lokality:**
  - **Zastávka:** spoločný limit oboch tímov = súčet ich limitov.
  - **Vínna pivnica:** tím dá dve NA EX.
  - **Krčma:** NA EX musí dať tím, ktorý má plný poldeci.
  - **Stryná:** každý tím, ktorý nedal NA EX.
  - **Jednota, Benzínka, Cintorín, Most, Ihrisko, Lesná cesta, Kultúrny dom,
    Herňa:** rátajú sa tímy namiesto hráčov.

  **[na potvrdenie: celý odsek o lokalitách]**

---

## Body na potvrdenie (s odporúčaním)

1. **Pas hráča = predaj limitu** (18.6): kto pasuje, vyberie *k* ≤ min(zvyšok
   limitu tímu, jeho karty), dostane *k* cigariet a limit tímu klesne o *k*.
   Odporúčam. Hra predvolene ponúkne polovicu zvyšku nahor, a ak partner už
   pasoval, celý zvyšok.
2. **Jeden poldeci na začiatku kola za tím** (18.4). Odporúčam (tím = hráč;
   s 3 poldeci by dva za kolo zvýšili limit rýchlejšie ako v 1 na 1).
3. **Kapitán prvého kola zo semienka, U1 a O1 = kapitáni** (18.1). Odporúčam.
4. **Kapitán rozdeľuje všetky Pohoršenia tímu, Víziu a kartu za Absťák**
   (18.1, 18.9). Odporúčam.
5. **Šenok: každý N/2, do šenku polovicu nahor; posledná šanca pre neprestavších
   členov druhého tímu** (18.5). Odporúčam, overí turnaj (#30).
6. **Karta „do ruky“ ide tomu, kto efekt spustil** (18.4, 18.12). Odporúčam.
7. **Dedičstvo tímové, cena spoločná pre oba tímy** (18.2, 18.6). Odporúčam.
8. **Priazeň raz za tím** (18.10). Odporúčam (starší nezosilnejú).
9. **Autobusár** (18.12): pas súperského člena po pase člena tvojho tímu.
   Odporúčam.
10. **Lokality** (18.12): Zastávka pre oba tímy, Vínna pivnica dve NA EX tímu,
    porovnávacie lokality po tímoch. Odporúčam.
