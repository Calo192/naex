# Návrh § Formát 2 na 2 (roadmapa #22) — na pravidlách v11.10

Návrh kapitoly do `docs/PRAVIDLA.md` (Zrejúca). Prepísaný 2026-11-02 na pravidlá
v11.1 (Michal: „Pravidlá v8 sú veľmi staré, treba pozrieť na nové pravidlá a 2v2 postaviť
na nich.“) a 2026-11-06 na **v11.10**: pokus o zajatie a karta zadarmo zanikli (v11.4),
Kšeft väzňa nahradila schopnosť väzňa (v11.2), dobratie do troch (v11.9), každý Hazard je
Dlh (v11.8).

Zdroje rozhodnutí: interview 2026-10-28 (vlna 1 a 2, `2na2-otazky.html`),
zladenie 2026-10-31 a odpovede 2026-11-02 (karta zadarmo, väzni, otázky Q1–Q9 — všetky
rozhodnuté, tabuľka na konci). PRAVIDLA.md sa zatiaľ nemení.

Jadro sa stavia súbežne (vetva `2na2/v11`): miesto pri stole 0–3, tím = miesto % 2,
člen = miesto ÷ 2; v 1 na 1 sú miesta 0 a 1 hráči, takže 1 na 1 sa nemení.

---

## 18. Formát 2 na 2

Dva **tímy** po dvoch hráčoch, štyri zariadenia, jedna partia (Michal 2026-10-28).
Platí všetko z §1–§17 s rozdielmi nižšie. Zásada: **tím je hráč z 1 na 1 s dvoma
rukami.** Všetko, čo pravidlá hovoria o hráčovi — strana línie, partia, zdroje,
balíčky, kliatby, Chuť, strach a reči, väzni, špaky, útočník a obranca —, v 2 na 2
platí pre tím. Osobná je len **ruka** a **ťah**.

### 18.1 Tím, miesto, kapitán

- Tímy sedia striedavo. Útočný tím je **U**, obranný **O**; členovia U1, U2, O1, O2.
- Každý tím má v každom kole **kapitána**; strieda sa **každé kolo**. Kapitán prvého
  kola sa určí zo semienka hry. Kapitán je **U1**, resp. **O1** — prvý v poradí
  ťahov. V tíme človek + bot je kapitánom **vždy človek**.
- **Kapitán robí tímové voľby:** voľba a natočenie cieľa (O1), koniec Pitky a NA EX tímu,
  kto odpovie na NA EX, rozdelenie Nakladačky (na strach tímu, so zajímaním) a hádky
  (na reči tímu, s presviedčaním), Vízia.
- **Partner vidí všetko, čo vidí tím:** ruku partnera, kartu zadarmo, karty zo stavby
  šenku, Záverečnú, skryté NA EX a odpovede tímu, vrch balíčka z Vízie. Súperský tím
  z toho nevidí nič (`viewFor` filtruje podľa tímu).
- Karty sa medzi rukami **nepodávajú** (Michal 2026-10-28).

### 18.2 Čo je tímové a čo osobné

| Tímu | Hráčovi |
|---|---|
| strana línie, prevaha v kraji, partia (karty natočené k tímu) | ruka |
| doberací a odhadzovací balíček | ťah v poradí |
| poldeci (plné, vypité, na NA EX) a limit vykladania | karta zo stavby šenku |
| cigarety, cena fajčenia v Pitke | — |
| zadĺženie a Dlhy, pečeň a Cirhózy | — |
| neresti, Chuť a Absťáky | — |
| Dedičstvo | — |
| strach a reči pri každom staršom, priazeň, väzni | — |
| špaky, krčmová nástenka | — |

### 18.3 Príprava (k §3)

- **Liga:** predvolená **Tretia** (3 lokality + finále); ostatné sa dajú zvoliť.
- **Počiatočná ruka:** každý hráč má 4 štartovacie karty. Tím má prázdny doberací
  a odhadzovací balíček.
- **Tím** začína so **4 cigaretami** a **3 plnými poldeci** (ostatné na 0).
- **Prah Dlhu 2, prah Cirhózy 4** (o 1 vyšší ako v 1 na 1, kde je od v11.8 každý Hazard Dlh;
  Michal 2026-11-06: v tíme Dlh za 2 Hazardy); úpravy z kariet a lokalít (Nealko, Krčma,
  Výherný automat) sa pripočítajú.
- Útočný tím prvého kola sa určí zo semienka.

### 18.4 Priebeh kola (k §4)

- **Poradie ťahov** je vždy **U1 → O1 → U2 → O2** (vykladanie) a **O1 → U1 → O2 → U2**
  (branie zo šenku, Michal 2026-10-31).
- **Začiatok kola:** tímu sa otočí **jeden** vypitý poldeci na plný.
  Od druhého kola si **každý hráč** dobere do 3 kariet vo svojej ruke z balíčka tímu, v poradí
  U1, O1, U2, O2 (Michal 2026-11-06, k v11.9).
- Karta z fajčenia, Vízie, Zastávky, Kšeftu či efektu „dober / vezmi do ruky“ ide do
  ruky **hráča, ktorý to spustil** (zahral kartu, fajčil, použil Kšeft).
- **Koniec kola:** neresti oboch členov sa sčítajú a porovnajú s **Chuťou tímu**;
  Absťák dostane tím (Michal 2026-10-31).

### 18.5 Cieľ a draft (k §5)

- Cieľ vyberá a natáča **O1**.
- **Stavba šenku:** každý hráč dostane **1 kartu z Náradia a 3 z Občanov** a tajne
  dá **2 do šenku** a 2 naspodok (Michal 2026-10-31). Šenok má 8 kariet, dve od
  každého hráča.
- **Branie zo šenku:** O1 → U1 → O2 → U2 dookola; platí sa z tímových cigariet
  (1 karta za 1, 2 za 3), karty idú do ruky toho, kto berie. Len **O1 na svojom prvom
  ťahu** vezme 1 kartu (Michal 2026-10-31). Kto prestane, už neberie; keď prestanú
  obaja členovia tímu, každý ešte neprestavší člen druhého tímu má **jednu poslednú
  šancu**.

### 18.6 Zhromaždenie (k §6, §13)

- Hráč na ťahu vykladá **zo svojej ruky** na koniec strany svojho alebo súperovho
  tímu. Karta je natočená k jeho tímu a patrí do partie tímu.
- **Limit vykladania je tímový:** plné poldeci tímu + 1 (Michal 2026-10-28). Míňa ho
  každé vyloženie ktoréhokoľvek člena. **Vypiť** platí plným poldeci tímu.
- **Pas hráča** (Michal 2026-11-02, Q1 — nahrádza „cigarety hneď každému za seba“
  z 2026-10-28): pas člena len ukončí jeho vykladanie, **bez cigariet**. Keď pasuje aj
  druhý člen, tím dostane **1 cigaretu za každú kartu, ktorú ešte smel vyložiť**
  (zvyšok limitu tímu), **najviac toľko, koľko majú obaja v rukách** spolu. Keď tím
  limit vyčerpá, cigarety nedostane. Zhromaždenie končí, keď skončili všetci štyria.
- **Záverečná:** najviac **jedna za tím**, za 1 cigaretu tímu; ukončí vykladanie
  **celého tímu** bez cigariet (Michal 2026-10-28).
- **Priznanie:** Cirhózu z ruky smie priznať jej držiteľ; ide medzi priznané karty tímu.

### 18.7 Pitka (k §7)

- Pitku hrajú všetci štyria **naraz**. **Obaja členovia** smú fajčiť, dolievať
  a barterovať z tímových zdrojov; cena fajčenia rastie **za tím** (prvé fajčenie
  tímu v Pitke 1, druhé 2…) (Michal 2026-10-28).
- **NA EX:** tím dá najviac **jedno** (Vínna pivnica dve), z tímového poldeci; vyberá
  ho kapitán, ktorý aj skončí Pitku za tím („hotovo“). NA EX sa odkryjú naraz.
- **Odpoveď na NA EX:** za tím odpovie **jeden člen**, ktorého určí kapitán, jednou
  kartou zo svojej ruky lícom dole — najprv útočný tím, potom obranný na druhý kraj;
  otočia sa naraz (Michal 2026-10-28, poradie podľa v9.2).
- **Kšeft lokality** smie tím použiť raz za Pitku. Kšeft karty ako v 1 na 1 (každá karta raz
  za Pitku). **Schopnosť väzňa** smie každý člen použiť vo svojom ťahu, na väzňa raz za hru;
  väzne má tím spoločných.
- Zrážka vzniká len medzi tímami. Bzdocha: čaká celý tím majiteľa.
- Vyhodnotenie (zadĺženie, pečeň, Cirhóza, Vízia) je tímové s prahmi z 18.3.

### 18.8 Bitka (k §9, §10)

- Poškodenie, hádka aj výsledok sa rátajú **súčtom tímu** (akcie oboch členov; Viera,
  Povery, Absťáky, Dlhy tímu) (Michal 2026-10-28).
- **Nakladačku** rozdelí kapitán víťazného tímu na **strach tímu**; **hádku** kapitán
  tímu, ktorý vyhral hádku, na **reči tímu**.
- Bodovanie starších, výhra strachom (červený strach tímu u 4 starších), výpalné a krádež
  pri zajatí sú tímové. Zajíma a presviedča kapitán; presvedčený starší ide do jeho ruky. **Väzni na výhru ako v 1 na 1** podľa ligy — Tretia 2, Druhá 3,
  Prvá 4 (Michal 2026-11-02).
- Porazený tím dostane 1 cigaretu. Exekútor páli polovicu Dlhov a špakov tímu.
- Karty z línie sa vrátia do odhadzovacieho balíčka tímu; nepriznaná Cirhóza a Absťák
  z oboch rúk tiež.

### 18.9 Špaky a finále (k §14, §14b)

Tím má jedny špaky. Výkupné z tímových poldeci a cigariet; nepriznaná Cirhóza −3
z oboch rúk a balíčkov tímu. Vo finále útočí tím s menej špakmi.

### 18.10 Výklad kariet a lokalít (k §15, §16)

- **„Súper“** = súperský tím ako celok (Michal 2026-10-28). Efekt na súpera ho zasiahne
  **raz** — zdroje, kliatby aj balíček má tím jedny.
- **„Ty“, „tvoj“, „tvoja partia“** = tvoj tím. Partner nie je súper: jeho priloženie
  nespúšťa Konflikt tvojich kariet.
- **„Do ruky“** = do ruky hráča, ktorý efekt spustil (18.4).
- Lokality a karty, ktoré rátajú hráčov (Zastávka, Autobusár, Krčma, Stryná, Jednota,
  Benzínka, Cintorín, Most, Ihrisko, Lesná cesta, Kultúrny dom, Herňa), rátajú
  **tímy**. Zastávka: zadarmo si kartu zo šenku vezme **kapitán** tímu.

---

## Rozhodnuté otázky (Michal 2026-11-02)

| # | Otázka | Rozhodnutie |
|---|---|---|
| Q1 | Pas hráča | **cigarety až za posledného** člena tímu (zvyšok limitu, najviac karty v oboch rukách) |
| Q2 | Začiatok kola: koľko poldeci sa tímu otočí | **1 za tím** |
| Q3 | Kapitán = U1/O1, prvý zo semienka, strieda sa každé kolo | áno |
| Q4 | Karta „do ruky“ ide tomu, kto efekt spustil | áno |
| Q5 | Dedičstvo tímové, cena (1, 2, 3…) spoločná pre oba tímy | áno |
| Q6 | Nakladačku, hádku a Víziu rozdeľuje kapitán | áno |
| Q7 | Posledná šanca v šenku pre neprestavších členov druhého tímu | áno |
| Q8 | Bzdocha: čaká celý tím majiteľa, jeho kapitán vidí NA EX súpera | áno |
| Q9 | Lokality a karty „rátajú tímy“; Zastávka — jednu kartu berie kapitán | áno |

| Q10 | Odpoveď na NA EX: kto za tím odpovie | **kapitán určí** — odpovie sám, alebo odpoveď odovzdá partnerovi |

## Platforma 2 na 2 (Michal 2026-11-02)

Nie sú to pravidlá hry (do PRAVIDLA.md nepatria), ale web a server:

| Téma | Rozhodnutie |
|---|---|
| Komunikácia partnerov | **pevné signály aj tímový chat** — súper nevidí ani jedno |
| Odpojenie hráča | **kontumácia tímu** (ako v 1 na 1) |
| Založenie partie | **pozvánka odkazom**, **voľné miesta v herni** a **náhodné párovanie** |
| Boti | **na každom mieste** (aj 1 človek + 3 boti); v tíme človek + bot je kapitánom vždy človek |
| Štatistiky | **samostatný rebríček 2 na 2** — ranky a ligy 1 na 1 nemení |
| Vzdanie | **musia obaja** — jeden navrhne, partner potvrdí |
| Kto hrá v Zrejúcej | **ako Zrejúca** — oprávnenie hrať Zrejúcu musí mať každý hráč, aj pozvaný |

Ešte otvorené (príde s #28 stôl a herňa): zoznam signálov, rozloženie stola pre štyroch.
