# Kontrola HU — 2026-11-10

Spätný preklad 15 kariet s najviac satirou (`docs/preklady/karty/hu.json`).

| Karta | HU | Spätný preklad | Posun / verdikt |
|---|---|---|---|
| Veľmi smútiaca vdova | Mélyen gyászoló özvegy | Hlboko smútiaca vdova | Smútočná fráza, irónia s tagom Bűnöző. OK |
| Silná, nezávislá žena | Erős, független nő | — | OK |
| Praudovravec | Igazmondó | Pravdovravný (z rozprávky o pravdovravnom pastierovi) | Ironický titul namiesto pravopisného vtipu. Otázka 3 |
| Liberál | Liberális — ugyanannyi nő, mint pasas | rovnako žien ako chlapov | OK |
| Dievčina na vydaj | Eladó lány | Dievča na vydaj (doslova „na predaj“) | Ustálený maďarský idióm, dvojzmysel je v jazyku, nie pridaný. OK |
| Degustátorka | Degusztátornő — egyet kivedel tőle | jeden mu vychľastá | OK |
| Bzdocha | Poloska | Ploštica (aj odpočúvadlo) | Pridaný vtip s odpočúvaním. Otázka 10 |
| Strýko z Ameriky | Amerikai nagybácsi | Americký strýko | Ustálený maďarský motív. OK |
| Finančná poradkyňa | ~~Pénzügyi tanácsadó~~ → **Pénzügyi tanácsadónő** | Finančná poradkyňa | Opravené: vrátený ženský rod |
| Anonymný alkoholik | Anonim alkoholista | — | OK |
| Záhradkár | Hobbikertész — a végrehajtás rád nem vonatkozik | exekúcia sa ťa netýka | OK |
| Svokra | Anyós | Svokra | OK |
| Milujúca manželka | Szerető feleség | — | OK |
| Vedúcko | Brigádvezető | Vedúci (socialistickej) brigády | **Mierny posun**: pridáva socialistický kolorit; posmech malého šéfa ostáva. Alternatíva *Főnök* je plochá |
| Opatrovateľka | Gondozónő — Cimbora: Régi motoros {Robota} | Opatrovateľka — Spoločník: Starý harcovník | OK |

## Opravy a dĺžky

- Dlhšie než originál o > 40 %: Alkoholmentes, Polgármester, Házasságközvetítő (17), Brigádvezető — v rámci najdlhších slovenských mien.
- Zložené pojmy s pomlčkou (Májzsugor-küszöb, Adósság-küszöb) a prípony pri NA EX (NA EX-et, NA EX-re) podľa pravopisu.
- Nezhody s glosárom: žiadne.

## Rozhranie a titulky Melichara (vlna 3b, `apps/web/src/i18n/hu.json`, `melichar/hu.json`)

Spätný preklad kľúčov herného stola:

| Kľúč | HU | Spätný preklad | Verdikt |
|---|---|---|---|
| stol.tipKraja | Fölény: ennek az élnek az akcióit az kapja, akinek ezen a szárnyon több saját Polgára, Állata és Elöljárója van… | Prevaha: akcie tejto hrany dostane, kto má v kraji viac svojich Občanov… | OK |
| stol.naPrebitieTy | az átvételhez neked {karty} kell | na prebratie ti treba N kariet | OK; `stol.kariet` v nominatíve (kell + nominatív) |
| stol.cigariet | {n} cigarettát | n cigaretu | OK; akuzatív pre „kapsz“ a „ára“ |
| zhrom.dalsiaKarta | A következő kártya ebben a lépésben egy teli felesbe kerül. | Ďalšia karta v ťahu stojí plný poldeci. | OK |
| faza.naSekere | · krétán {n} cs. | na sekere n š. | OK (krétára = na dlh) |
| stol.titulMojTah | ● Te lépsz — {faza} | Tvoj ťah | OK (glosár: ťah = lépés) |
| partia.kontumacna | Győzelem zöld asztalnál | Výhra od zeleného stola (úradne) | OK, nový pojem glosára `kontumacia` |

Opravené pri kontrole:
- `hlavicka.odistNa` „Ugrás {ciel}“ s príponou → „Ugrás ide: {ciel}“, ciele v nominatíve (meno stránky nejde skloňovať).
- `karta.preskolenieRata` „{na}-nak“ (prípona na premennej) → „úgy számít, mint {na}“.
- Skrátené tlačidlá a pásy nad 40 %: Asztal elhagyása, Játék elhagyása, Játék vége, Játszma vége, az ellenfél offline, Ellenállás törölte.
- Ponechané dlhšie: Vissza az asztalhoz (citované v iných textoch), Alkoholmentes a Verekedés (glosár).

Voľby: Päta, Lakeť, Otočka = **Térd, könyök, gáncs** (gáncsot vet = podraziť). Praudovravec = **Igasságharcos** (fonetické „igasság“). Rod: maďarčina ho nemá, .m/.z sú rovnaké. Po číslovke jednotné číslo všade.

Titulky: „marha“ = marha (slovo je z maďarčiny, nadávka sedí), „jebem ti boha“ = baszom az istenedet (presný miestny ekvivalent), „prejebať“ = elbaszni, „kurva“ ako citoslovce = A kurva életbe!. Nezhody s glosárom: žiadne (Bzdocha = Poloska).
