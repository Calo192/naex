# Kontrola PL — 2026-11-11b (vlna 3e)

Spätný preklad vzorky: 10 odsekov Pravidiel (`i18n/pravidla/pl.json`) a 10 krokov výučby (`i18n/vyucba/pl.json`). Overenie: `npx vitest run i18n` (32/32), `npm run typecheck` OK; skript pri zlučovaní porovnal s originálom parametre `{…}`, značky (`<p k="…">`, `<a href>`, `<odkaz href>`, `<strong>`) a piktogramy `[Pecka]` — 0 rozdielov vo všetkých 1 104 poliach dlhých textov aj 781 kľúčoch rozhrania.

## Pravidlá

| Id | PL (skrátene) | Spätný preklad | Verdikt |
|---|---|---|---|
| co-je-naex.p2 | Karty zagrywacie do wspólnej linii, kupujecie je za papierosy i pijecie przy tym kieliszki. Od jednego ruchu gra wzięła nazwę: NA EX — wylewasz kieliszek na kartę przeciwnika, na ex. | Karty hráte do spoločnej línie, kupujete ich za cigarety a pijete pri tom poldeci. Od jedného ťahu dostala hra meno: NA EX — vyleješ poldeci na súperovu kartu, na ex. | OK; „na ex“ Poliak chápe z „do dna“, glosár |
| ako-sa-vyhrava.p2 | Pety za strach. O ile ciosów wygrałeś bójkę, tyle strachu rozdzielasz między starszych. Kto się ciebie boi, płaci ci po każdej kolejnej wygranej bójce… | Špaky za strach. O koľko úderov si vyhral bitku, toľko strachu rozdelíš medzi starších. Kto sa ťa bojí, platí ti po každej ďalšej vyhratej bitke… | OK |
| ciel-a-senok.p15 | Bierzecie na zmianę, zaczyna obrońca — w swoim pierwszym ruchu tylko 1 kartę, żeby nie ogołocił oferty… Za ofertę nie płaci się kieliszkiem… | Beriete striedavo, začína obranca — v prvom ťahu len 1 kartu, aby neolúpil ponuku… Za ponuku sa neplatí poldecom… | OK; „nevykradol“ → „ogołocił“ (vyplienil) nesie ten istý obraz |
| zhromazdenie.p5 | Akcje krawędzi lokacji dostaje gracz z przewagą na tym skrzydle… Przy remisie gracz, którego karta leży na skrzydle tuż przy lokacji… w Knajpie „przy barze” i „przy drzwiach”. | Akcie hrany lokality dostane hráč s prevahou v tom kraji… Pri rovnosti hráč, ktorého karta leží v kraji hneď pri lokalite… v Krčme „pri bare“ a „pri dverách“. | OK; mená krajov podľa glosára |
| pitka.p12 | NA EX znosi karcie aktywne akcje i podwaja nieaktywne… na swojej podwoisz sobie Sierpowego albo zniesiesz własny Hazard… NA EX obok Silnej kobiety daje ×4… | NA EX karte zruší aktívne akcie a zdvojí neaktívne… na svojej si zdvojíš Petelicu alebo zrušíš vlastný Hazard… NA EX vedľa Silnej ženy dá ×4… | OK |
| pitka.p20 | Kieliszek jako partner: niesparowany Opór albo Wzmocnienie karty z NA EX łączy się w parę z kieliszkiem. Opór NA EX gasi… Wzmocnienie NA EX utrzymuje… Kiedy karta ma jedno i drugie, wygrywa Opór. | Poldeci ako partner: nespárovaný Odpor alebo Posilnenie karty s NA EX sa spáruje s poldecom. Odpor NA EX zahasí… Posilnenie NA EX podrží… Keď má karta oboje, vyhrá Odpor. | OK |
| cena-pitia.p8 | …Każdy Głód w twojej talii odbiera ci w bójce 1 twarde — trzęsą ci się ręce — a przy remisie w twardych przegrywa ten, kto ma ich więcej. Spalić go może tylko Wizja… | …Každý Absťák v tvojom balíčku ti v bitke uberie 1 tuhé — trasú sa ti ruky — a pri remíze v tuhom prehráva, kto ich má viac. Spáliť ho smie len Vízia… | OK; „Głód“ (hlad po alkohole) nesie absťák, glosár |
| bitka.p7 | …pety rundy czekają na krechę i dodatkowo bierze je zwycięzca najbliższej bójki; w finale przepadają. Przy kresze atakujący zostaje atakującym… | …špaky kola čakajú na sekere a navyše si ich vezme víťaz najbližšej bitky; vo finále prepadnú. Pri sekere útočník ostáva útočníkom… | OK; „na krechę“ = na sekeru (glosár) |
| starsi.p4 | Przychylność ma ten, kogo starszy boi się mniej: siła = strach przeciwnika − twój strach… Kiedy podnosisz sobie strach, zarabiasz pety, ale przeciwnikowi dajesz przychylność… | Priazeň má ten, koho sa starší bojí menej: sila = strach súpera − tvoj strach… Keď si dvíhaš strach, zarábaš špaky, ale súperovi dávaš priazeň… | OK |
| bodovanie.p30 | Pety tracisz przy egzekucji (…spala się połowa twoich Długów w górę i tyle samo petów) i za każdą nieprzyznaną Marskość… Natychmiastowej przegranej nie ma… | O špaky prídeš pri exekúcii (…zhorí polovica tvojich Dlhov nahor a rovnako veľa špakov) a za každú nepriznanú Cirhózu… Okamžitá prehra nie je… | OK |

## Výučba (Melichar)

| Id | PL | Spätný preklad | Verdikt |
|---|---|---|---|
| i-vitaj | CO TAM TAK SIEDZISZ – CHODŹ TU! Jestem Meliš… EE! Mistrz Melichar. Daj mi papierosa, jak chcesz, żebym cię nauczył grać! | ČO TAM TAK SEDÍŠ – POĎ SEM! Som Meliš… EH! Majster Melichar. Daj mi cigaretu, ak chceš, aby som ťa naučil hrať! | OK; prerieknutie mena ostáva |
| k-ciel.zle.3 | Na Cmentarzu nie ma żadnego ciosu. Tam się chodzi płakać, nie bić. | Na Cintoríne nie je žiadny úder. Tam sa chodí plakať, nie biť. | OK, vtip sedí |
| i-pitka | Wyłożone, teraz się pije – Popijawa… Bez picia to byłoby zebranie sołeckie. | Vyložené, teraz sa pije – Pitka… Bez pitia by to bola schôdza obecnej rady. | Miestny ekvivalent: „schôdza“ → *zebranie sołeckie* (dedinská schôdza v PL); zároveň narážka na Zebranie (= Zhromaždenie) |
| q-zhromazdenie.vysvetlenie.1 | Tak. To jest cała gra, reszta to wymówki. | Áno. Toto je celá hra, zvyšok sú výhovorky. | OK |
| k-zh2-bot2 | Uwaga, podłość: Stały bywalec położył Bliźniaki na koniec linii po lewej, przy twoich kartach… Do przewagi Bliźniaki liczą się za dwóch: na murawie 2 : 2. | Pozor, podlosť: Štamgast položil Dvojčatá na koniec línie vľavo, k tvojim kartám… Do prevahy sa Dvojčatá rátajú za dvoch: na trávniku 2 : 2. | OK; kraj Ihriska podľa glosára (*na murawie*) |
| i-zadlzenie | Hazard daje ci w każdej Popijawie Dług – ten kosztuje cię w bójce pety… dostajesz Marskość — wiejską klątwę!… | Hazard ti v každej Pitke dá Dlh – ten ťa v bitke stojí špaky… dostaneš Cirhózu — dedinskú kliatbu!… | OK |
| q-naex.vysvetlenie.2 | Na odwrót. Samotne podwaja, połączone znosi. Spróbuj to zapamiętać, ja już nie daję rady. | Naopak. Osamotené zdvojí, spojené zruší. Skús si to zapamätať, ja to už nezvládam. | OK, sebairónia zachovaná |
| k-nakladacka2 | Wygrana o 4. Różnica nazywa się Łomot i wydajesz ją na strach… Pozostały 1 daj Wychowawczyni na żółty – rozdzielić trzeba wszystko, co się da – i potwierdź. | Výhra o 4. Rozdiel sa volá Nakladačka a minieš ho na strach… Zvyšný 1 daj Vychovávateľke na žltú – rozdeliť treba všetko, čo sa dá – a potvrď. | OK; Łomot (výprask) nesie nakladačku |
| i-stupne | …Ja się z nimi chwilowo nie widuję, ale to nie ma tu nic do rzeczy. | …Ja sa s nimi momentálne nestretávam, ale to sem nepatrí. | OK, narážka zachovaná |
| i-dovidenia3 | To wszystko. Już mnie nie potrzebujesz, a ja ciebie nigdy, tylko twoich papierosów… z czystej złośliwości. Na zdrowie! | To je všetko. Už ma nepotrebuješ a ja teba nikdy, len tvoje cigarety… z čistej zlomyseľnosti. Na zdravie! | OK |

## Posuny, opravy, dĺžky

- **Opravené pri kontrole:** „Atakujący przy krechu“ → *Przy kresze atakujący* (lokál od *krecha*), „albo krechu“ → *albo kresze* (`bodovanie.p8`); `pata.jed` *Trucizna* → **Jad** (štítok o 167 % dlhší než „Jed“), s ním `pata.ciarkaJed`, `pata.rozdel`, `pata.rozdelText`, `pata.maDost.farar`; `vyucba.botTaha` „wykonuje ruch“ → **„{meno} ma ruch…“**; `vyvoj.zaTyzden` „w tydzień“ → *tygodniowo*; `k-pas2-bot` „Pas się opłaca“ → *Za pas się płaci* (originál: pas sa platí cigaretami).
- **Zámerné posuny:** `kliatby.p6` (Robota namiesto Dlhu, otázka 1 v `otazky-pl-3.md`); mená achievementov s poľskou slovnou hračkou (otázka 9); popisy achievementov so `{prah}` prestavané na „X: co najmniej {prah}“, aby sedel pád pri každom čísle (otázka 13).
- **Mŕtve vtipy:** žiadne. Nahradené miestnymi: *zebranie sołeckie* (schôdza), *Szczekaczka gminna* (Hlásnik obce), *Darina wypiła, co nawarzyła*, *Do szeregu!*.
- **Nezhody s glosárom:** žiadne (akcie, fázy, starší, lokality a kraje, karty z `docs/preklady/karty/pl.json`, ranky Zerówka/Pięćdziesiątka). Nové pojmy (talia mieszkańców, Dobieranie, Jad/Tarcza, Szczekaczka) sú v otázke 4–7.
- **Tvary pojmov jadra** (`pojmy/pl.json`, pole `tvary`) pokrývajú pády, ktoré používa poľský Melichar (napr. *bójkę, bójce, petów, kieliszka, Popijawie, styku, starszego*); vyskúšané v texte `i-toto-vies` — všetkých 15 pojmov sa nájde.
- **Dĺžky (> 40 % pri krátkych textoch):** *Spis treści* (Obsah), *Zamknij spis treści*, *Stacja paliw*, *Wycofaj propozycję*, *Oszczędzaj kieliszki*, *Szczekaczka gminna*, *(nieobowiązkowe)* — nadpisy a štítky so slobodnou šírkou, nie tlačidlá v páse karty; ak sa niektorý nezmestí, skrátiť (*Spis*, *Cofnij*, *Oszczędzaj kiel.*).
