# Kontrola PL — 2026-11-10

Spätný preklad 15 kariet s najviac satirou (`docs/preklady/karty/pl.json`).

| Karta | PL | Spätný preklad | Posun / verdikt |
|---|---|---|---|
| Veľmi smútiaca vdova | Niepocieszona wdowa — Starcie: Przeciwnik odrzuca 1 losową kartę z ręki. | Neutešiteľná vdova — Konflikt: súper odhodí 1 náhodnú kartu. | Ustálené spojenie, irónia s tagom Kryminalista sedí. OK |
| Silná, nezávislá žena | Silna, niezależna kobieta | Silná, nezávislá žena | OK |
| Praudovravec | Foliarz | Alobalista (konšpirátor) | Posun od „samozvanej pravdy“ k „alobalovej čiapke“ — oba výsmech dezinformátora. Otázka 3 |
| Liberál | Liberał — tyle samo kobiet, co chłopów | rovnako žien ako chlapov | OK |
| Dievčina na vydaj | Panna na wydaniu | Dievča na vydaj (ustálené) | OK |
| Degustátorka | Degustatorka — jeden mu wychla | jeden mu vychľastá | Hrubosť ako v origináli. OK |
| Bzdocha | Pluskwa | Ploštica (aj odpočúvadlo) | Pridaný vtip s odpočúvaním k efektu. Otázka 10 |
| Strýko z Ameriky | Wujek z Ameryki | Strýko z Ameriky | Ten istý poľský motív. OK |
| Finančná poradkyňa | Doradczyni finansowa | Finančná poradkyňa | OK |
| Anonymný alkoholik | Anonimowy alkoholik | Anonymný alkoholik | OK |
| Záhradkár | Działkowiec — Egzekucja w tej rundzie cię nie dotyczy. | Záhradkár — exekúcia sa ťa v tomto kole netýka. | OK |
| Svokra | Teściowa (Autorytet) | Svokra (Autorita) | OK |
| Milujúca manželka | Kochająca żona | Milujúca manželka | OK |
| Vedúcko | Kierowniczek | Vedúcik | Zdrobnenina nesie posmech. OK |
| Opatrovateľka | Opiekunka — Kompan: Świadek epoki {Robota} | Opatrovateľka — Spoločník: Pamätník | Poľské opatrovateľky v Nemecku — rovnaký motív. OK |

## Opravy a dĺžky

- Opravené: Benzínka *Stacja benzynowa* (16 znakov) → **Stacja paliw** (12), aj v glosári.
- Dlhšie než originál o > 40 %: Spółdzielnia, Willa przewodniczącego (22 znakov), Kierowniczek — všetko v rámci najdlhších slovenských mien (21).
- Rod pri hranách posilnenia podľa poľských mien akcií: Wzmocniony {Rana}/{Petelica}/{Povera}, Wzmocniona {Pecka}/{Robota}, Wzmocnione {Obmedzenie}.
- Nezhody s glosárom: žiadne.

## Rozhranie a titulky Melichara (vlna 3b, `apps/web/src/i18n/pl.json`, `melichar/pl.json`)

Spätný preklad kľúčov herného stola:

| Kľúč | PL | Spätný preklad | Verdikt |
|---|---|---|---|
| stol.tipKraja | Przewaga: akcje tej krawędzi dostaje ten, kto ma na tym skrzydle więcej swoich Obywateli, Zwierząt i Starszych… | Prevaha: akcie tejto hrany dostane, kto má v kraji viac svojich Občanov, Zvierat a Starešinov… | OK |
| stol.naPrebitieTy | do przebicia potrzebujesz {karty} (kartę / karty / kart) | na prebitie potrebuješ N kariet | OK, akuzatív |
| stol.cigariet | {n} papierosa / papierosy / papierosów | n cigaretu / cigarety / cigariet | OK, akuzatív (dostaniesz papierosa) |
| zhrom.pasujesOdlozene | Pasujesz do Popijawy — dostaniesz {cigarety}, potem {meno} wykłada sam… | Pasuješ do Pitky — dostaneš…, súper potom vykladá sám | OK |
| zhrom.dalsiaKarta | Kolejna karta w tym ruchu kosztuje pełny kieliszek. | Ďalšia karta v ťahu stojí plný poldeci. | OK |
| faza.naSekere | · na krechę {n} p. | na sekeru n š. | OK (p. = petów) |
| koniec.cirhozy | Nieprzyznana Marskość na koniec… | Nepriznaná Cirhóza na konci… | OK |
| stol.titulTahSupera | Ruch: {meno} · NA EX! | Ťah: meno | OK (meno sa v šablóne nedá skloňovať) |

Opravené pri kontrole:
- `partia.hlaskyMelichara` „Teksty“ → **Odzywki Melichara** (odzywka = hláška s jedom); aj v `profil.jazykPomoc`.
- `bar.naTahu` „jego ruch“ (len mužský rod) → „teraz gra“.
- `partia.sSuperom` „z {meno}“ nesklonené → „przeciwnik: {meno}“.
- `hlavicka.odistNa` → „Przejdź do: {ciel}“ s menom stránky v nominatíve.

Voľby: Päta, Lakeť, Otočka = **Z bańki, z łokcia, z kopa** (glosár). Praudovravec = **Prafdomówca** (fonetická chyba w→f ako „prau“). Rod: kde slovenčina používa mužský rod (skončil, odpojený), poľština tiež (Wygrałeś/Wygrałaś majú vlastné kľúče .m/.z). Dlhšie > 40 %: Pięćdziesiątka, Dojrzewająca, Przeciwko komputerowi (nadpis), Pragnienie — pojmy z glosára, ponechané.

Titulky: „marha“ = bydlę, „špina“ = ścierwo, „prejebať“ = przejebać, „robiť si piču“ = robić sobie jaja (+ „kurwa“, aby sa nezjemnilo), „ale sa jebú“ = ale się pierdolą (zachová dvojzmysel sex / babranie). Nezhody s glosárom: žiadne (Bzdocha = Pluskwa).
