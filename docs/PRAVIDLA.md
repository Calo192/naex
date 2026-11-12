# NA EX! — pravidlá (špecifikácia)

**Pravidlá v12.4 (platné od 2026-11-12)** — Výpalné z banky (v12.4), Cigarety za pas (v12.3), Vykladanie za poldeci (v12.2), Odpor aktívny len bez spoja, podmienka NA EX a Hrable (v12.1), Akcie navyše mení celý Nástroj, Traktorista, Pasca, Výherný automat, Kapybara a Predavačka (v12), Dobratie 2 karty po bitke a posilnenie Nástrojom po NA EX (v11.21), Hodnota stupňa 1 / 2 / 3 a reťaz premien (v11.20), Dohadzovačka len z konca kraja (v11.19), Vedúcko Podporou, Snúbenica, Traktorista a Miňištrant (v11.18), NA EX × Odpor a Posilnenie, Kapybara, Telefón, Krokodíl a hrany Náradia (v11.17), Vypiť, pas, Degustátorka, odpoveď na NA EX za poldeci, Nástroj len pod vlastné karty, Školiteľ aj Zviera (v11.16), Benzínka o cigaretu lacnejšie (v11.15), Frakcie, Občania v troch kategóriách, Náradie a karta z ponuky (v11.14), Lokality (v11.13), Reči na súperovom teplomere (v11.12), Hádka platí (v11.11), Ohováračka namiesto Alkoholika (v11.10), Dobratie do troch a výpalné (v11.9), Každý Hazard je Dlh (v11.8), Kostol a koniec línie (v11.7), Zajatie od minulého kola (v11.6), Identita kariet (v11.5), Zajatie Nakladačkou a presvedčenie (v11.4), Konflikt oboma smermi a Podpora (v11.3), Schopnosť väzňa (v11.2), Vzbura obráti kartu (v11.1) a Strach a reči (Michal 2026-11-02, docs/napady/strach-reci.html,
verzia 2) na v10.4
(Hádka v10 — Michal 2026-11-01, docs/napady/hadka.html, verzia 4; v9 zmrazené 2026-10-30, krok 2
revízie starších, docs/napady/starsi-krok2-zadanie.html; dávky v9.1 Chuť, v9.2 ponuka a NA EX naraz,
v9.3 Výtržník prebíja Úplatok; v10.1 zajatie pred ponukou; v10.2 Nástroj nie vedľa lokality; v10.3
Forsáž, Úplatok zrušený; v10.4 pojem Spáliť, Autority). Sada kariet: Vypálená hrá zverejnenú sadu v51 (v11.18), Zrejúca rozpracovaný stav tvorcu nad ňou (`cards.json` v master). Pravidlá sa
menia len v dávkach; celá dávka dostane ďalšiu verziu (značka partií `v11`; presnú verziu ukazuje
stránka Pravidlá — `VERZIA_PRAVIDIEL_PRESNA`).

**Zmeny v12.4 oproti v12.3** (Michal 2026-11-12: „aby bolo výpalné vyplatené z banky, nie od hráča“; playtest
20261111-221937, návrh `vypalne-z-vrecka-porazeneho`, možnosť A):

- **Výpalné z banky** (§9 krok 6c, §10): za každého staršieho s tvojím červeným strachom (aj väzňa) ti po bitke dá
  1 cigaretu **banka**, súper nič neplatí. Predtým (v11.9–v12.3) platil súper zo svojich cigariet, koľko mal — porazený
  tak odovzdal víťazovi aj cigaretu za prehru a cigarety z pasov a na ponuku mu neostalo nič. Platí sa ako doteraz po
  každej bitke okrem finále, aj porazenému a pri sekere, so strachom po Nakladačke tejto bitky.

**Zmeny v12.3 oproti v12.2** (Michal 2026-11-11: „Treba nejakým spôsobom vrátiť cigarety za pas. Keď hráč pasne, dostane toľko cigariet, koľko má nevypitých poldeci.“ K poldeci: ostanú plné — cigarety sú odmena za šetrenie, poldeci ostávajú na NA EX a ďalšie Zhromaždenie; kto pasuje aj v ďalšom Zhromaždení toho kola, dostane cigarety znova; staré znenie v `docs/pravidla-historia.md`, sekcia v12.3):

- **Cigarety za pas** (§6): kto pasuje, dostane **1 cigaretu za každý plný poldeci** (`KONSTANTY.CIGARETY_ZA_PAS_NA_POLDECI`). Poldeci sa tým **nevypijú** — ostanú plné na NA EX v Pitke a na ďalšie Zhromaždenie kola; kto pasuje aj v ňom, dostane cigarety znova. V 2 na 2 dostane tím cigarety za svoje plné poldeci, až keď pasuje aj druhý člen (ako do v12.1, §18).
- **Vychovávateľka** (väzeň, §10): „Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety.“ — vynútený pas je bez cigariet, plné poldeci súperovi ostanú.
- **Achievement Pas za groš** (cigarety za pasy v jednej partii) sa znova dá získať — legacy bol len vo v12.2; jeho hviezdy sa znova rátajú do prahov rankov (podiel 35 % / 50 % sa nemení).
- **Platí všade** (§18, §19): Kalamita, 2 na 2 aj Päta, Lakeť, Otočka.
- **Výklady Leadera, Michal zatiaľ nepotvrdil:** (1) Cigarety za pas = počet **plných poldeci v okamihu pasu**; maximum +1 z Vínka sa ráta len cez skutočný plný poldeci, ktorý pridá. (2) Pas, ktorý za hráča urobí hra (nemá čo vyložiť, nemá plný poldeci), dáva cigarety tiež — bez plného poldeci je to 0 (ako do v12.1). (3) **Záverečná** ukončí vykladanie ako pas, ale cigarety za zvyšné poldeci nedá (ako do v12.1). (4) **Obecný úrad** cigarety za pas nezdvojuje — nie sú z Pitky. (5) **Izolačka** sa nemení (uberá z doliatia po Pitke, v12.2); cigarety za pas neuberá.

**Zmeny v12.2 oproti v12.1** (Michal 2026-11-11, schválené rovno na vypálenie: „Hráči začnú hru s troma poldeci. Na konci každej bitky sa im poldeci resetnú na max. Limit vykladania bude rovný presne počtu poldeci, ktoré majú na ruke. Za každú kartu, ktorú vyložia, sa im otočí jeden poldeci z plného na vypitý. Za pasovanie nebudú dostávať cigarety. Ak chcú dať 2, 3, 4 karty naraz… musia na to mať poldeci, ale každá ďalšia takto zahraná karta stojí toľko cigariet, koľko kariet navyše dávajú, čiže ak chcú dať dve karty, musia vypiť 2 poldeci a zaplatiť 1 cigaretu, ak chcú dať 3 karty, musia vypiť 3 poldeci a zaplatiť 2 cigarety a tak ďalej. Náradie, či už priznané alebo umiestnené pod postavu, nemíňa poldeci. Každú Pitku sa im resetne 1 poldeci z prázdneho na plný + aktívne akcie Poldeci.“; staré znenia v `docs/pravidla-historia.md`, sekcia v12.2):

- **Štart s 3 poldeci** (§3): každý hráč začína s **3 plnými poldeci** (predtým 2); v 2 na 2 prináša každý člen svoje 3 (§18).
- **Limit = plné poldeci** (§6): limit vykladania je presne počet plných poldeci (predtým plné + 1). **Každá karta do línie** (aj Záverečná a podstrčená) otočí jeden plný poldeci na vypitý. Bez plného poldeci sa nevykladá a hra za hráča pasuje; „limit je vždy aspoň 1“ zaniká (Michal: „to by sa nemalo stať, pretože na začiatku kola majú poldeci resetnuté a po Pitke by sa im mal automaticky doliať 1 poldeci“).
- **Viac kariet v jednom ťahu** (§13): **n kariet = n plných poldeci a n − 1 cigariet** (`KONSTANTY.CENA_KARTY_NAVYSE`). Pečeň a nerest len za **karty navyše** (Michal): prvá karta nie, každá ďalšia +1 poškodenie pečene a 1 nerest, ako Vypiť doteraz.
- **Nástroj a priznanie poldeci nemíňajú** (§6, §11, §12): Dedičstvo, podloženie aj priznanie kliatby sú zadarmo v poldeci a **nezvyšujú cenu ťahu** — s kartou do línie sa zahrajú v jednom ťahu bez Vypiť.
- **Pas bez cigariet** (§6): za pas hráč nedostane nič; nevyložené plné poldeci mu ostávajú.
- **Obnova po bitke** (§9.5): na konci každej bitky (po vypití poldeci z NA EX) sa všetky poldeci otočia na plné — na **maximum**. **Po finále nie** — výkupné ráta plné poldeci po finálovej bitke ako doteraz. Otočenie 1 vypitého na začiatku kola zaniká.
- **Doliatie po Pitke** (§7): na konci každej Pitky sa otočí **1 vypitý poldeci zadarmo** a 1 za každú aktívnu akciu Poldeci v línii (Michal: akcie Poldeci dolievajú na konci každej Pitky, v bitke už nie).
- **Doliatie za 2 cigarety zaniká** (§7). **Stokársky barter ostáva**: 5 cigariet → nový plný poldeci, maximum +1 natrvalo (po bitke sa obnoví aj ten).
- **NA EX** stojí plný poldeci z toho istého zásobníka ako doteraz — leží na karte do bitky, takže v ďalšom Zhromaždení kola chýba; **odpoveď na NA EX** za plný poldeci ako doteraz.
- **Karty a lokality** (§10, §15, §16; znenia v tvorcovi, Michal 2026-11-11): **Jogurt** „Dedičstvo: Po každej Pitke sa ti doleje o 1 poldeci viac.“ · **Vínko** „Dedičstvo: Tvoje maximum poldeci je o 1 vyššie.“ (veta o dolievaní zaniká) · **Izolačka** „Dedičstvo: Za každé tvoje aktívne Obmedzenie sa súperovi po Pitke doleje o 1 poldeci menej.“ · **Družstvo** „Zhromaždenie: Karty s akciou Robota nestoja poldeci.“ · **Kostol** „Zhromaždenie: V ťahu sa smie vyložiť len 1 karta. Pitka: NA EX sa smie dať len na kartu na konci línie (na ktoromkoľvek z dvoch koncov).“ · **Jednota** „Pitka: Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani barterovať.“ · väzeň **Vychovávateľka** „Súper v tomto Zhromaždení hneď pasuje.“ · väzeň **Krčmárka** „Nový plný poldeci.“ (maximum +1 natrvalo). Hrany Nástrojov sa nemenia, **Degustátorka** tiež nie (súperovi zníži aj limit — zámer).
- **Platí všade** (§18, §19): Kalamita, 2 na 2 aj Päta, Lakeť, Otočka.
- **Výklady Leadera a programátora, Michal zatiaľ nepotvrdil:** (1) n kariet v jednom ťahu = n plných poldeci + (n − 1) cigariet spolu; platí sa pred ťahom — server vykoná celý ťah, alebo nič. (2) Kostol: v ťahu jedna karta ako doteraz, ani Nástroj spolu s kartou (Nástroj sám je ťah). (3) Maximum = 3 + barter + Krčmárka + Vínko; poldeci nezmiznú (vypité ostávajú, NA EX sa v bitke vypije), takže maximum = plné + vypité + ležiace na kartách. (4) Vínko pri vyložení pridá hneď plný poldeci (v Zhromaždení je to hneď o kartu viac, ako doteraz); druhé Vínko nič nepridá; poldeci z Vínka je skutočný, po finále sa vykúpi. (5) Izolačka uberá z celého doliatia po Pitke — najprv z poldeci zadarmo, potom z Jogurtu a akcií Poldeci —, najmenej 0; tvoje vlastné doliatie nemení. (6) Nástroj v ťahu: ťah po ňom pokračuje zadarmo, aj po karte, za ktorou idú už len Nástroje; samotný Nástroj je celý ťah ako doteraz. Na Družstve to isté pre karty s Robotou. (7) Degustátorka porovnáva plné poldeci až po tom, čo jej majiteľ za ňu zaplatil (Nástup je po vyložení) — Michal potvrdil 2026-11-12. (8) Chuť a Absťák sa nemenia: nerest je karta navyše v ťahu (1), odpoveď na NA EX (1), NA EX (2), vyfajčená cigareta (1); poldeci za prvú kartu ťahu nerest nie je. (9) 2 na 2: poldeci ostávajú tímové (§18.2) — tím má 6 (3 za člena) a po Pitke 2 zadarmo (1 za člena). (10) Päta, Lakeť, Otočka: Dať vyžrať je po bitke, teda po obnove — vyžratý poldeci chýba v ďalšom kole; Má dosť Krčmárky („Už ti nenalejem“) = súperovi sa po Pitke nedoleje nič zadarmo (ani z Jogurtu), akcie Poldeci áno. (11) Achievement „Pas za groš“ (cigarety za pasy) sa už nedá získať — kto ho má, má ho ako LEGACY; „Do dna“ ráta len karty navyše.

**Zmeny v12.1 oproti v12** (Michal 2026-11-11, z partie na Vypálenej: „Protihráčovi nešlo dať NA EX na väčšinu postáv v Pitke. Prečo? Podľa pravidiel sú to platné ciele na NA EX.“ Potom: „Spravíme zmenu pre Odpor. Odpor bude aktívny LEN vtedy, keď nie je spojený s inou akciou, a bude dávať ‚NA EX‘ štít ako dáva teraz. Bude aj naďalej rušiť akciu, s ktorou sa spojí, a zároveň sa deaktivuje aj Odpor. Keď sa Odpor stretne s Odporom, vznikne Vzbura ako teraz.“ — „Spolu s týmto chcem zmeniť aj náradie Hrable — s Hrabľami aktívny Odpor dáva poškodenie ako Pecka.“; staré znenie v `docs/pravidla-historia.md`, sekcia v12.1):

- **Odpor je aktívny len bez spoja** (§2, §6): nespárovaný Odpor je aktívny a dáva karte **štít proti NA EX**. Na spoji zruší akciu, s ktorou sa spojí, a **sám sa deaktivuje** — na karte zhasne ako zrušený. Odpor proti Odporu = Vzbura ako doteraz.
- **Na kartu s aktívnym (nespárovaným) Odporom NA EX dať nemožno** (§7) — Odpor ju chráni; hráč pri karte vidí dôvod. Na súperovu skrytú Záverečnú a NA EX z Vínka sa štít uplatní ako doteraz: NA EX zahasí.
- **NA EX nechá Odpor tak** (§7): neaktivuje ho, nezdvojí, ani nezruší — Odpor na spoji ďalej ruší partnera (oživenie partnera z v11.17 zaniká). Ostatné akcie karty NA EX obráti ako zvyčajne; štít sa po NA EX neobjaví.
- **Podmienka NA EX** (§7): do „aspoň 1 aktívna a aspoň 1 neaktívna akcia“ sa **Odpor neráta vôbec**; **neaktívny Pakt aj neaktívne Posilnenie sa rátajú** (Michal: „Áno, aj Posilnenie“). Na kartu, ktorej jedinou neaktívnou akciou je Pakt či Posilnenie, NA EX smie: Pakt nezdvojí, Posilnenie ho podrží (aktívne akcie nezruší) — vtedy sa na karte nezmení nič.
- **Hrable** (Dedičstvo, §12): „Dedičstvo: Tvoj aktívny Odpor dáva v bitke poškodenie ako Pecka.“ Hrany ostávajú. Predtým: „Akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená.“
- **Výklady Leadera, Michal zatiaľ nepotvrdil:** (1) Hrable: každý aktívny Odpor tvojej karty v línii sa ráta ako **Pecka ×1** (2 tuhé) — aj pre efekty, ktoré rátajú tvoje Pecky (Valaška +1); Forsáž, NA EX ani viac Hrablí ho nezdvoja. (2) Aktívny Odpor dáva štít aj na karte so Vzburou (predtým nespojený Odpor karty so Vzburou štítom nebol). (3) Odpor **hrany lokality** sa ukazuje a do počtu Pitiek ráta ako doteraz (aktívny je na spoji s kartou). (4) Aktívny Odpor je aktívna akcia aj pre efekty, ktoré rátajú aktívne akcie karty (Dievčina na vydaj, Záverečná). (5) Odpor proti Posilneniu ostáva Vzburou karty s Odporom (posilnenou) — Michal sa k nemu ešte vyjadrí.

**Zmeny v12 oproti v11.21** (Michal 2026-11-11, Zrejúca: „Treba upraviť Traktoristu. Jeho efekt dáva len Dlhy, chcem, aby dával Pecku, keď má prevahu v kraji, žiadne Dlhy v efekte. Pascu chcem upraviť — za KAŽDÚ priloženú kartu od súpera k mojej karte mu dám Ranu navyše v bitke. Výherný automat — prah o 1 vyšší, ale každú Pitku 1 Dlh. … Kapybara bude premieňať Vieru na Cigarety, bez ohľadu na to, či je to súperova alebo moja karta, proste Preškolenie Viera → Cigarety. Predavačka — vezmi si jednu kartu z ponuky do dobieracieho balíčka. Chcem, aby aj akcia v efekte, ako napríklad pri Opatrovateľke, sa dala zmeniť preškolením alebo Nástrojom. V prípade, ak postava dostane Forsáž, akcia v efekte sa posilní tiež.“ K Nástroju: „Áno, celý Nástroj.“; staré znenia v `docs/pravidla-historia.md`, sekcia v12):

- **Akcie navyše mení celý Nástroj aj Forsáž** (§6, §12): akcie navyše v pečati karty (Opatrovateľka, Šofér, Traktorista…) mení podložený Nástroj rovnako ako akcie na hranách — **preškolenie** X → Y (v reťazi premien za Školiteľmi, v11.20) aj **hrana posilnenia** „Posilnená {X}“ (Puška, Pasca, Fúrik, Horoskop, Izolačka; ×2) — a **Forsáž** karty ich zdvojí (×2). Pečať ukáže zmenenú akciu a násobok. Puška dole pod Šoférom, ktorý v kole nedal NA EX: jeho Pecka navyše ×2; Energeťák hore pod Opatrovateľkou s Pamätníkom: Robota navyše ×2. Akcie navyše nie sú na spoji, preto ich NA EX nemení — posilnenie platí ×2. Posilnenie suseda, Odpor a Silná žena ich nemenia ako doteraz. Predtým (do v11.21) ich menili len Školitelia; „akcie navyše Nástroj nemení“ zaniká. **Výklad Leadera (2026-11-11), Michal zatiaľ nepotvrdil:** Michal napísal všeobecne „ak postava dostane Forsáž“ — preto akcie navyše zdvojí **každá Forsáž karty**, aj **zo spoja** (Posilnenie + Posilnenie, aj Pakt proti Posilneniu), kým ju NA EX na jednom z Posilnení nezruší; Forsáž zo spoja a z Energeťáka sa násobia (×4) ako na hranách.
- **Traktorista** (§16): „Bitka: S prevahou v jeho kraji {Pecka}.“ — **Pecka navyše**, keď máš v bitke prevahu v jeho kraji (aj vo finále — pinnacle lokalita má kraje). Dlh bez prevahy v poslednej Pitke kola zaniká; Traktorista Dlhy nedáva.
- **Pasca** (Dedičstvo, §16): „Bitka: Za každú kartu, ktorú súper v tomto kole priložil k tvojej karte {Rana}.“ — **1 Rana navyše za každú súperovu kartu**, ktorú v tomto kole priložil k tvojej karte (aj lícom dole — Záverečná, odpoveď na NA EX; každá karta raz, keď ju priložil). Presun Dohadzovačkou, spálenie Poľovníkom ani podloženie Nástroja priloženie nie sú. Predtým 1 Rana, ak priložil aspoň jednu.
- **Výherný automat** (Dedičstvo, §8, §16): „Tvoj prah Dlhu je o 1 vyšší. Pitka: {Dlh}.“ — **1 Dlh v každej Pitke** (rovno Dlh, nie zadĺženie cez prah; Obecný úrad ho zdvojí ako iné Dlhy z Pitky). Predtým 1 Dlh len v poslednej Pitke kola.
- **Kapybara** (Zviera, Školiteľ, §6, §16): „Furt: Preškolenie {Viera}→{Cigareta}.“ — **obaja priami susedia** v línii (karty oboch hráčov) majú Viery ako Cigarety, kým s Kapybarou susedia. Podpora, Konflikt a Furt {Cigareta} zanikajú. Mäsiar ju umlčí ako doteraz.
- **Predavačka** (§16): „Podpora: Vezmi si z ponuky 1 kartu navrch svojho doberacieho balíčka.“ — pri každom stretnutí s vlastnou kartou si vyberieš **hocijakú kartu z ponuky** a položíš ju **navrch svojho doberacieho balíčka** (súper vidí, ktorú). Ponuka sa nedopĺňa; bez kariet v ponuke nič. Predtým Občan z ponuky do ruky.

**Zmeny v11.21 oproti v11.20** (Michal 2026-11-10, Zrejúca; staré znenie v `docs/pravidla-historia.md`, sekcia v11.21):

- **Dobratie 2 karty po bitke** (§4; Michal: „Chcem zrušiť doberanie do troch kariet. Hráč si na konci každého kola doberie 2 karty — nie DO 2, ale 2 karty.“): od druhého kola si na začiatku kola každý hráč dobere **presne 2 karty** (`KONSTANTY.DOBRATIE_PO_BITKE`), bez ohľadu na to, koľko ich má v ruke. Limit ruky nie je a nič sa neodhadzuje; prázdny doberací balíček sa doplní zamiešaním odhadzovacieho ako pri každom ťahaní. Predtým (v11.9–v11.20) sa doberalo do 3 kariet v ruke a kto ich mal 3 a viac, nedostal nič. Výpalné, fajčenie, Vízia a efekty kariet sa nemenia.
- **Výklad Leadera, Michal zatiaľ nepotvrdil:** v 2 na 2 (§18) si 2 karty dobere **každý člen** do svojej ruky z balíčka tímu, v doterajšom poradí U1, O1, U2, O2; v Päte, Lakti, Otočke (§19) platí dobratie rovnako ako v 1 na 1.
- **Posilnenie Nástrojom až po NA EX** (§6, §12; Michal: „Mám v línii Sypača, Šoféra a pod Šoféra zasuniem Pušku s posilnenou Peckou. … budú mať 4× efekt alebo len 2×? Podľa mojich predstáv by mali mať 4×.“ — „Áno, ×4 — aj Energeťák.“ — „No lenže keď sa dá NA EX, tak tie neaktívne zrazu aktívne budú.“): **hrana posilnenia** podloženého Nástroja („Posilnená {X}“, Puška…) a **Forsáž Energeťáka** sa uplatnia na akcie, ktoré sú aktívne **po NA EX** (aj NA EX z Vínka). NA EX obráti stav akcií karty — aktívne zruší, neaktívne aktivuje ×2 — a až potom Puška posilní X a Energeťák všetky aktívne akcie: bývalé neaktívne X majú **×4**, bývalé aktívne sú zrušené ako doteraz. Sypač Podporou zmení Šoférovi Rany na Pecky (preškolenie ide pred všetkým), Puška dole pod Šoférom, NA EX na Šoféra: neaktívne Pecky ×4, aktívne zrušené. Predtým sa Nástroj uplatnil pred NA EX a neaktívne X zdvojilo NA EX len ×2. Forsáž zo spoja, posilnenie Vzbury, Posilnenie suseda, Dedičstvo Pušky a Výtržník sa nemenia; akcie navyše Nástroj naďalej nemení (od v12 mení, vyššie).

**Zmeny v11.20 oproti v11.19** (Michal 2026-11-10, Zrejúca, interview; staré znenia v `docs/pravidla-historia.md`, sekcia v11.20):

- **Hodnota stupňa 1 / 2 / 3** (§10, krok 4b; Michal: „Zmeniť na 1 / 2 / 3“): stupne strachu aj rečí majú hodnotu **žltá 1, oranžová 2, červená 3** (`KONSTANTY.HODNOTA_STUPNA`), plný teplomer **6** (strach 1 / 3 / 6). Predtým žltá 1, oranžová 2, červená 2 (plný 5). Súper má červený strach, ty reči na červenej a oranžovej: on 1, ty 5. Ceny stupňov (1 / 2 / 3, o 1 viac za obsadený) sa nemenia, krádež pri zajatí tiež nie (ráta cenu).
- **Premeny sa reťazia** (§6, §12; Michal: „Reťazia sa“, „Áno, reťazí sa všetko.“): všetky premeny na tej istej karte platia — **najprv Školitelia** (Podpora a Konflikt v poradí spustenia, potom Furt, skôr sused bližšie k lokalite), **potom Nástroje** v poradí podloženia; každá pracuje na výsledku predošlej. Dvaja Školitelia: Podpora {Rana}→{Pecka} a po nej Konflikt {Pecka}→{Petelica} — Petelica. Dva Nástroje pod Zámočníkom: {Pečeň}→{Rana} a po ňom {Rana}→{Pecka} — z Pečene Pecka. Sypač {Rana}→{Pecka} a pod kartou Valaška {Pecka}→{Petelica}: z Rany je Petelica. Nástroj s opačnou premenou ({Pecka}→{Rana}) Ranu vráti. Nástroj, ktorého X Školiteľ už zmenil, ho nenájde (Sypač {Rana}→{Pecka} a Valaška dole {Rana}→{Petelica}: Pecka). Predtým platila len jedna premena a Nástroj mal prednosť; dvaja Školitelia ani dva Nástroje sa nereťazili (prvá podoba v11.20, Michal 2026-11-10 doplnil: „Áno, reťazí sa všetko.“).
- **Potvrdené výklady** (Michal 2026-11-10: „Potvrdzujem všetko“): NA EX × Odpor a Posilnenie v miernejšej podobe P2, Kapybara, Telefón, Krokodíl a hrany Náradia (v11.17), výklady lokalít v11.13 (Kultúrny dom, Benzínka, Obecný úrad, Sklad), Predsedova vila pri rečiach (v11.12) a Preškolenie (§6). Pravidlá sa obsahom nemenia; výklad ku Kapybare z v11.12 zanikol s jej Nástupom vo v11.17. Michal 2026-11-10 („Potvrdiť aj tieto.“) potvrdil aj zvyšné výklady: balíček, ktorý pri stavbe ponuky nestačí (§5), viac NA EX naraz (§7), výpalné (§10), Nezničiteľný a výklady Developera k zajatiu a presvedčeniu (§10), skrytá Záverečná ako cieľ NA EX pri Kostole (§15) a výklady v11.5 (§16).
- **Pojem šenok sa volá Ponuka** (Michal 2026-11-10: „Šenok nahradiť za ponuku.“): ponuka kariet, z ktorej sa kupuje (§5), má meno Ponuka — z ponuky, do ponuky, v ponuke; fáza na stole je **Ponuka** (predtým „Draft — šenok“), „Voľba cieľa“ je na stole **O čo sa bijeme** a „Zhromaždenie“ **Zhromaždenie — kladenie kariet**. Len premenovanie, pravidlá sa nemenia; identifikátory v kóde (`senok`) ostávajú.

**Zmeny v11.19 oproti v11.18** (Michal 2026-11-09, Zrejúca, z vlastnej partie; staré znenie v `docs/pravidla-historia.md`, sekcia v11.19):

- **Dohadzovačka** (§16): „Nástup: Ak susedíš s Občanom alebo Starešinom, za teba sa presunie karta z konca druhého kraja, ak je to Občan alebo Starešina opačného pohlavia ako tvoj sused.“ — presúva sa **len karta na konci druhého kraja** (najďalej od lokality); keď to nie je Občan či Starešina opačného pohlavia ako sused, je to skrytá Záverečná alebo je kraj prázdny, nič sa nestane. Predtým sa hľadal najvzdialenejší vhodný Občan či Starešina a mohol prísť aj zo stredu kraja.

**Zmeny v11.18 oproti v11.17** (Michal 2026-11-09, Zrejúca; staré znenie v `docs/pravidla-historia.md`, sekcia v11.18):

- **Vedúcko** (Školiteľ, §6, §16): „**Podpora:** Preškolenie {Robota}→{Pecka}.“ — Roboty ako Pecky má len **tvoja karta, s ktorou sa Vedúcko stretne priložením** (oboma smermi), do konca kola, ako pri Sypačovi. Predtým Furt: obaja susedia v línii vrátane súperových kariet, kým susedia. Furt Preškolenie dnes nemá žiadna karta; pravidlo v §6 ostáva.
- **Snúbenica** (§16): „**Podpora: Chlap** {Cigareta}.“ — za každé stretnutie priložením s **tvojím Chlapom** 1 Cigareta navyše (akcia navyše, §6), do konca kola. Prvá Podpora s tagom v sade. Predtým Nepriateľ: Autorita {Pohoršenie}.
- **Traktorista** (§16): „Posledná Pitka kola: Bez prevahy v jeho kraji {Dlh}.“ — **Pecka navyše s prevahou zaniká** a Pecka na ľavej strane karty je **Rana**. Dlh bez prevahy na konci poslednej Pitky ostáva.
- **Miňištrant** (§16): „**Nepriateľ: Starešina** {Pecka}.“ — 1 Pecka navyše, kým má súper v partii odkrytého Starešinu. Predtým Spoločník: Zahraničný {Pecka}.
- **Vandal** a **Degustátorka** majú kratší text, efekt sa nemení: „Nástup: Otoč lokalitu o 180°.“ a „Nástup: Ak má súper viac plných poldeci ako ty, jeden mu vyžerie.“

**Zmeny v11.17 oproti v11.16** (Michal 2026-11-09, Zrejúca: „Teraz sú to čisto mŕtve akcie pri NA EX.“; návrh `docs/napady/naex-odpor-posilnenie.html`, P2 „Poldeci ako partner“ v miernejšej podobe, Michal potvrdil 2026-11-10; staré znenia v `docs/pravidla-historia.md`, sekcia v11.17). Odpor a Posilnenie pri NA EX už nie sú mŕtve (§6, §7):

- **Odpor zrušený cez NA EX pustí partnera**: akcia, ktorú Odpor rušil, ožije ×1 — ako keď NA EX zruší Posilnenie a partner príde o ×2. Rozpor v §7 („akcia, ktorú karta zrušila Odporom, ostáva zrušená“ proti „partner zrušenej akcie ostáva aktívny ×1“) je rozhodnutý v prospech oživenia.
- **Neaktívny Odpor pod NA EX je štít**: spáruje sa s poldecom a NA EX zahasí — karta je ako bez neho, poldeci sa aj tak vypije. Na kartu s neaktívnym Odporom sa NA EX nedá (nič by nezmenilo); štít platí pre súperovu skrytú Záverečnú a NA EX z Vínka, kým sa Odpor nespáruje.
- **Neaktívne Posilnenie pod NA EX podrží aktívne akcie**: NA EX ich nezruší (ani Posilnenie na spoji), neaktívne zdvojí ×2 ako vždy. Do podmienky „aspoň 1 neaktívna akcia“ sa neaktívne Posilnenie neráta (ako Pakt).

**Kapybara, Telefón, Krokodíl a hrany Náradia** (Michal 2026-11-09, potvrdil 2026-11-10, Zrejúca, docs/napady/kapybara-telefon.html a docs/napady/naradie-len-svoje.html; texty kariet zapíše admin v tvorcovi, staré znenia v `docs/pravidla-historia.md`, sekcia v11.17):

- **Kapybara** (Zviera) je **Školiteľ**: „Podpora: Preškolenie {Viera}→{Cigareta}. Konflikt: Preškolenie {Viera}→{Cigareta}. Furt: {Cigareta}.“ — karta, s ktorou sa priložením stretne (tvoja aj súperova), má do konca kola Viery ako Cigarety; sama má 1 Cigaretu navyše, kým leží, a na jednej strane akciu Posilnenie. Nástup (súperove reči o stupeň nižšie) zaniká. Mäsiar ju umlčí (§16).
- **Akcie navyše bez podmienky** (§6): „Furt: {A}“ — platia raz, kým karta leží odkrytá v línii.
- **Telefón** (Dedičstvo): „Hádka: Remíza v hádke je tvoja, ak nie je 0 : 0. Bitka: Za každú tvoju akciu zrušenú súperovým Odporom {Povera}.“ (§9.1, §16). Imunita Pohoršení voči Odporu a NA EX zaniká. Hrany ostávajú.
- **Krokodíl**: „Konflikt: Občan {Spálenie}.“ — súperov Občan, s ktorým sa priložením stretne (oboma smermi), sa **na konci bitky spáli** (§6, §16). Spálenie všetkých Občanov a Zvierat v okolí zaniká.
- **Hrany Náradia pod vlastné karty** (§12): 13 hrán, ktoré pod vlastnou kartou len škodili, má nové znenie, Nealko obe hrany a Vidly dolnú (kolízia so Sypačom) — tabuľka v §12. Pasca, Fúrik, Horoskop a Izolačka majú dolnú hranu posilnenia.

**Zmeny v11.16 oproti v11.15** (Michal 2026-11-09, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.16). Deväť zmien:

- **Vypiť len so zostávajúcim limitom** (§6, §13): Vypiť smie hráč, len kým mu zostáva limit vykladania aspoň 1. Pri limite 0 by vypitie limit neznížilo a bola by to len kúpa neresti mimo Pitky — hra ho neponúkne a server ho odmietne.
- **Cigarety za pas bez ohľadu na karty v ruke** (§6, §18): za pas dostane hráč 1 cigaretu za každú kartu, ktorú ešte smel vyložiť (zostávajúci limit), aj keď v ruke nič nemá — „ak hráč mohol zahrať 3 karty, 1 zahral, na ruke má 0 kariet, pasne — stále dostane cigarety“ (Michal). Predtým najviac toľko, koľko mal kariet v ruke (v6.1). V 2 na 2 rovnako pre tím.
- **Degustátorka zníži súperov limit hneď** (§6, §16): keď v Zhromaždení vyžerie súperovi plný poldeci, súperov zostávajúci limit vykladania hneď klesne o 1 — ako pri Vypiť a (opačne) pri Vínku v Dedičstve. Predtým sa to prejavilo až v ďalšom Zhromaždení.
- **Podloženie naprázdno hra ponúka** (§12): podložiť Nástroj pod vlastnú kartu, na ktorej hrana nič nezmení, pravidlá dovoľovali aj predtým; hra ho teraz ponúka (tlmene, s upozornením „hrana tu nič nezmení“) a robí ho aj server.
- **Nástroj sa podkladá len pod vlastné karty** (§12): „hráč nesmie podkladať náradie pod súperove karty, len pod svoje“ (Michal). Predtým aj pod súperove (sabotáž). Texty Nástrojov sa zatiaľ nemenia — hrana, ktorá vlastnej karte škodí, ostáva hrateľná, len nevýhodná.
- **Školiteľom môže byť aj Zviera** (§6, §16): Preškolenie má Občan aj Zviera, Starešina nie. **Mäsiar** umlčí aj Zviera-Školiteľa — kým s ním susedí, jeho Preškolenie neplatí (Furt ani zapísané z Podpory či Konfliktu).
- **Pakt je akciou, ktorú kopíruje, pre všetky efekty** (§2): spresnenie, jadro to už hralo — „tvoje Pecky“, Vidly, Horoskop, Zapaľovač, Boxer… rátajú aj Pakt, ktorý akciu kopíruje.
- **Odpoveď na NA EX stojí plný poldeci** (§7, §8): „Reakcia na NA EX bude fungovať ako dnes, ale bude stáť 1 poldeci — vypiť plný na vypitý.“ (Michal). Odpoveď ostáva, ako bola (jedna karta lícom dole za každé súperovo NA EX, mimo limitu, kraje podľa poradia); hráč pri nej otočí 1 plný poldeci na vypitý — ako pri Vypiť: **+1 poškodenie pečene** (v Pitke, prah Cirhózy sa skontroluje hneď) a **1 nerest**. Kto nemá plný poldeci, neodpovedá.

**Zmeny v11.15 oproti v11.14** (Michal 2026-11-09, Zrejúca; staré znenie v `docs/pravidla-historia.md`, sekcia v11.15):

- **Benzínka** (Pitka, §7, §15): **každé fajčenie stojí o 1 cigaretu menej** — prvé fajčenie hráča v Pitke zadarmo, druhé 1, tretie 2 atď. (inde 1, 2, 3). Predtým odpadla len prvá platba (0, 2, 3). Každá zaplatená cigareta je nerest (§8) a ráta sa do Krabičky cigariet ako inde; fajčenie zadarmo nie.

**Zmeny v11.14 oproti v11.13** (vo Vypálenej od 2026-11-09, sada v48; v Zrejúcej od 2026-11-08; staré znenia v `docs/pravidla-historia.md`, sekcia v11.14). Štyri časti:

**Frakcie** (Michal 2026-11-08; špecifikácia `docs/napady/frakcie-final.json`):

- **Kšeft zaniká** — spúšťač, ťah aj Kšefty kariet a lokalít (§7).
- **Akcie navyše podmienené tagom** (§6, §16): spúšťače **Spoločník: tag** a **Nepriateľ: tag** a **Podpora / Konflikt s tagom**. Na karte je podmienka v poli efektu a akcie navyše v pečati dole v ilustrácii. **Konflikt bez tagu** (Michal 2026-11-08): Praudovravec, Stryná, Podvodník a Vdova majú „Konflikt: …“ bez tagu — platí pri stretnutí s ktoroukoľvek súperovou kartou.
- **Skryté akcie** (§6, §16, Michal 2026-11-08): Pasca, Pijan, Svokra, Vymáhač, Šofér, Traktorista a Výherný automat majú akciu navyše v pečati s podmienkou slovami („Bitka: … {Rana}“); Vidly a Valaška ich zosilnia. Školitelia (Preškolenie, nižšie) menia aj akcie navyše. Vdova odhadzuje náhodnú kartu.
- Nové efekty 17 kariet (§16) a lokalít Zberný dvor, Sklad a Predsedova vila (§15).

**Občania v troch kategóriách** (Michal 2026-11-08; docs/napady/obcania-kategorie.json):

- Občan má jeden z troch druhov efektu (§16): **Školiteľ** — „Spúšťač: **Preškolenie** {X}→{Y}.“ (Vedúcko, Sypač, Anonymný alkoholik, Profesionálny tipér), **efekt s vedľajšou akciou** — akcie navyše v pečati (§6), **textový efekt** — všetko ostatné slovami.
- **Preškolenie** (§6, §16): akcia X dotknutej karty sa ráta ako Y, **pred spojmi**, na oboch hranách aj v akciách navyše. **Furt** — obaja susedia v línii (karty oboch hráčov), kým susedia; **Podpora** — tvoja karta, s ktorou sa Školiteľ stretne priložením, do konca kola; **Konflikt** — súperova karta, s ktorou sa stretne, do konca kola. Akcia sa preškolí raz — Nástroj pod kartou → Podpora a Konflikt v poradí spustenia → Furt; nereťazí sa (od v11.20 najprv Školiteľ, potom Nástroj na jeho výstupe).
- **Podpora a Konflikt bez tagu** — tag z podmienky Podpory pri Sypačovi (Chlap) a Dievčine (Zahraničný) padol.
- Zmenené karty: Anonymný alkoholik Podpora {Pečeň}→{Viera}; Profesionálny tipér Konflikt {Cigareta}→{Hazard}; Sypač Podpora {Rana}→{Pecka} (bez Chlapa); Vedúcko Furt {Robota}→{Pecka}; Dievčina Podpora: {Povera}; Opatrovateľka Spoločník: Pamätník {Robota}; Šofér {Pecka} {Rana} bez cigarety; Traktorista Dlh v **poslednej Pitke kola** (pečať Hazard), nie na začiatku bitky (§16).

**Náradie — podloženie** (Michal 2026-11-08; docs/napady/naradie-hrany-zoznam.html v5, voľby P1–P6):

- **Nástroj sa do línie nevykladá** (§6, §12). Má hornú a dolnú hranu: **preškolenie X → Y** alebo kartový účinok — Energeťák **Forsáž**, Vínko **NA EX**, Injekcia **Výtržník**, Vidly **Vzbura**.
- **Podloženie** pod Občana či Starešinu v línii, svojho aj súperovho (od v11.16 len pod svoje), je ťah za **1 cigaretu**, limit nemíňa; platí pretŕčajúca hrana. Leží do bitky, potom ide do odhadzovacieho balíčka toho, kto ho podložil (§12).
- Preškolenie platí **pred spojmi** a mení všetky výskyty akcie; kartové účinky sú presne dnešné stavy bez nákladov (§6, §7). Vyhodiť sa nedá.
- **Zámočník** — pod neho ľubovoľne veľa Nástrojov; **Kôň** — kým leží, aj pod Zviera (§16). Zaniká: Nástroj vedľa lokality, Náradie je spoločné, Vzbura a Forsáž s Nástrojom.
- Dedičstvo ostáva bez zmeny.

**Predavačka a Živnostník — karta z ponuky** (Michal 2026-11-09):

- **Predavačka** „Podpora: Vezmi si z ponuky 1 Občana.“ (predtým dober si 1 kartu) a **Živnostník** „Podpora: Vezmi si z ponuky 1 Nástroj.“ (predtým Spoločník: Autorita {Robota} a s Nástupom Nástroj z ruky hneď pod neho — zaniká). Podpora bez tagu: pri každom stretnutí s vlastnou kartou si majiteľ vyberie z ponuky kartu s tagom Občan, resp. Nástroj, a vezme si ju **zadarmo do ruky**; bez takej karty v ponuke nič, ponuka sa nedopĺňa (§16).

**Puška posilňuje — pripravené pre ďalšiu dávku** (Michal 2026-11-09, Zrejúca):

- **Puška** má namiesto dvoch preškolení dve **hrany posilnenia** (§12): „Hore: Posilnená {Petelica}. Dole: Posilnená {Pecka}.“ — aktívne Petelice, resp. Pecky karty, pod ktorou trčí, sú posilnené (×2) ako pri Posilnení. Dedičstvo ostáva.

**Bez „tvojej a súperovej strany“** (Michal 2026-11-08; pravidlá sa nemenia, len pomenovania, docs/napady/bez-strany.html): línia má dva **konce** a dva **kraje** a žiaden nepatrí hráčovi (§6). **Podstrčiť** = priložiť svoju kartu k súperovej (§13). **Most:** každý vykladá len na koniec línie po svojej ľavici (§15). **Kostol:** NA EX len na kartu na konci línie, na ktoromkoľvek z dvoch koncov (§15).

**Zmeny v11.13 oproti v11.12** (Michal 2026-11-06, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.13):

Sedem lokalít má nový efekt a sada aj nové hrany (§15). Režimy 2 na 2 (§18) a Päta, Lakeť, Otočka (§19) sú **len v Zrejúcej**; hráči Vypálenej dostanú len Kalamitu 1 na 1.

- **Lesná cesta** (Bitka): za každé svoje Zviera v línii, na ktorejkoľvek strane, **2 tuhé** navyše.
- **Cintorín** (Prehra): porazený si smie vziať do ruky **1 kartu zo svojho odhadzovacieho balíčka**, a to až po návrate kariet (§9 krok 7a), takže **aj kartu z práve odohranej línie** (Michal 2026-11-07). Nástroj do Dedičstva zanikol.
- **Obecný úrad** (Pitka): platí pre oboch — **všetky cigarety a Dlhy získané počas fázy Pitka**, z akcií aj z efektov kariet, **sa rátajú dvakrát**. Obmedzenie sa odráta pred zdvojnásobením: (akcie − Obmedzenie) × 2. Platby, cigarety za pas a Dlhy mimo Pitky sa nezdvojujú. S Výherným automatom sa zdvojnásobí zadĺženie a prah ostáva. Kšeft (presun Dlhu) zanikol.
- **Sklad** (Zhromaždenie; od frakcií bez Kšeftu): Nástroj z ponuky smieš vyložiť rovno do Dedičstva **za cenu Dedičstva** (§12, §15), nie za cenu ponuky; je to ťah a spoločná cena potom stúpne. Z vrchu Náradia príde do ponuky nový Nástroj, verejne; z prázdneho nič. Starý Kšeft (vrchná karta súperovho odhadzovacieho balíčka) zanikol.
- **Kultúrny dom** (Bitka): **každý hráč dostane špaky len za svoje karty v línii, aj víťaz**. Špaky za výhru hádky (v11.11) sa tu nepripočítavajú druhýkrát. Pri sekere sa nemení nič (§9.4).
- **Družstvo** (Zhromaždenie): limit vykladania nemíňa **karta s akciou Robota** na ktorejkoľvek strane, nie tag Pracujúci.
- **Benzínka** (Pitka): **prvé fajčenie každého hráča v každej Pitke je zadarmo**, ďalšie stojí 2, potom 3 (od v11.15 každé o 1 lacnejšie). Zákaz fajčenia podľa najvzdialenejšej karty zanikol.
- **Výklady (Michal potvrdil 2026-11-10):** (1) Kultúrny dom pri sekere: špaky kola čakajú ako inde a víťaz hádky dostane za svoje karty hneď, raz. (2) Víťaz na Kultúrnom dome dostane aspoň 1 špak (§9.4), aj bez vlastnej karty v línii. (3) Fajčenie zadarmo nie je nerest a do Krabičky cigariet sa neráta: žiadna cigareta sa neminula. (4) Obecný úrad: Dlh Výherného automatu v poslednej Pitke sa ráta dvakrát (je to Dlh z Pitky), rovnako schopnosť Poštárky použitá v Pitke (8 cigariet) a Konflikt v Pitke (odpoveď na NA EX). (5) Sklad: spoločná cena Dedičstva stúpne ako pri bežnom vložení.
- **Výučba Prvá hra** hrá rovnaké pravidlá ako bežná partia; jej scenár sa prerába pri vypálení.

**Zmeny v11.12 oproti v11.11** (Michal 2026-11-06, Zrejúca, po playteste Klebetníka; staré znenia v `docs/pravidla-historia.md`, sekcia v11.12):

- **Reči idú na súperov teplomer** (§9.1, §10): obsadzujú ho ako súvislý blok, od vrchu jeho strachu nadol, potom nad neho, zo sivej zdola nahor. Cena 1 / 2 / 3 za stupeň ostáva.
- **Bodovanie** (§10, krok 4b): stupne majú hodnotu žltá 1, oranžová 2, červená 2 a dostane ich ten, kto ich drží. Súper má červený strach, ty reči na červenej a oranžovej: on 1, ty 4. Reči bodujú pri každej bitke, vyhratej aj prehratej. Nahrádza krátenie z v11.11. (Od v11.20 hodnota 1 / 2 / 3: on 1, ty 5.)
- **Klesanie** (§10): reči klesajú **zospodu** a len tomu, kto **prehral hádku**; pri remíze nikomu.
- **Spomalenie a posun** (§9.4, §10): súper platí za strach na obsadený stupeň o 1 viac. Keď reči prekoná, blok sa posunie s jeho strachom a počet stupňov ostáva.
- **Presvedčenie** (§10): ktorýkoľvek starší, pri ktorom máš reči na celom teplomere, za **3 body**. Podmienka vyššieho súperovho strachu zanikla a reči po presvedčení ostávajú.
- **Krádež pri zajatí** (§10): zlodej dostane a okradnutý stratí toľko špakov, koľko bodov hádky má okradnutý v rečiach pri staršom, najviac koľko má. Bez rečí 0.
- **Čo sa nemení:** obsadená červená sa ráta do výhry strachom, zajatia aj výpalného a priazeň sa ráta z celého strachu. Špaky za karty víťaza hádky a natáčanie lokality z v11.11 ostávajú.
- **Predsedova vila** (Michal potvrdil 2026-11-10): vila pridá ďalší stupeň rečí v bežnom poradí. Výklad ku Kapybare (zhodí súperovým rečiam spodný stupeň) zanikol s jej Nástupom vo v11.17.
- **Reči po klesnutí** (rozhodnutie session Ideas, Michal ho nechal na nej): každý obsadený stupeň má vždy hodnotu 1 / 2 / 2, takže aj reči nad súperovým strachom po klesnutí bodujú menej (plné 5, oranžová a červená 4, samotná červená 2; od v11.20 1 / 2 / 3: plné 6, oranžová a červená 5, samotná červená 3).
- **Výučba Prvá hra** hrá tieto zmeny ako bežná partia (od vypálenia; dovtedy hrala reči do v11.11).

**Zmeny v11.11 oproti v11.10** (Michal 2026-11-06, Zrejúca, po playteste štýlov docs/playtesty/styly-20261106-123023.html, kde Klebetník vyhral 13 zo 17 hádok a ani jednu bitku; staré znenia v `docs/pravidla-historia.md`, sekcia v11.11):

- **Víťaz hádky dostane špaky za svoje karty** (§9.4, §14): kto vyhrá hádku a prehrá bitku, dostane **1 špak za každú svoju kartu v línii**. Víťaz bitky dostane za všetky karty ako doteraz, aj keď hádku tiež vyhral — navyše nič. Pri **sekere** dostane víťaz hádky za svoje karty hneď a všetky karty línie ďalej čakajú na sekere. Na Kultúrnom dome sa to s jeho efektom **sčíta** (porazený, ktorý vyhral hádku, má svoje karty 2×). Platí aj vo finále, navyše k 1 špaku za bod hádky.
- **Lokalitu natáča víťaz minulej hádky** (§4, §5, §14b): obranca lokalitu naďalej vyberá, natočí ju víťaz hádky z minulého kola. V prvom kole a po remíze v hádke natáča ten, kto vyberá. Platí aj pre pinnacle vo finále.
- **Reči uberajú zo strachu** (§10, krok 4b): špaky, ktoré dostane porazený za reči pri staršom, sa odpočítajú zo špakov víťaza za strach pri tom istom staršom, **najviac na 0**. Príklad: víťaz má červený strach (5), porazený oranžové reči (3) — víťaz dostane 2, porazený 3. Víťazove reči sa nekrátia. Výhra strachom, zajatie a krádež sa nemenia.
- **Výučba Prvá hra** hrá tieto zmeny ako bežná partia (od vypálenia; dovtedy hrala bez nich).

**Zmeny v11.10 oproti v11.9** (Michal 2026-11-06, Zrejúca, docs/napady/priazne-nove.html, návrh 1; staré znenia v `docs/pravidla-historia.md`, sekcia v11.10):

- **Ohováračka namiesto Alkoholika** (§9.1, §10): priazeň dáva Povery navyše **+1 / +2 / +3** do hádky.
  Michal: „viera a povery sa navzájom rušia, ako by boli normálne na akcii karty.“ Ruší ich teda súperova Viera
  z kariet aj z Veriaceho, jedna za jednu. Rovnako ako na Povery z kariet na ne platí Horoskop (po 2 mäkké)
  a Čierna mačka (Vierou sa nerušia). Na zdravie „do dna“ zaniká: poldeci z NA EX sa vždy vráti vypitý.

**Zmeny v11.9** (Michal 2026-11-06, Zrejúca, docs/napady/agresivna-hra.html; staré znenia v `docs/pravidla-historia.md`, sekcia v11.9):

- **Dobratie do troch** (§4): od druhého kola si hráč na začiatku kola doberá, kým nemá v ruke 3 karty. Kto ich má
  3 a viac, nedoberá nič a nič neodhadzuje. Do v11.8 1 karta za kolo.
- **Výpalné** (§9 krok 6c, §10): súper ti hneď po bitke dá 1 cigaretu za každého staršieho s tvojím červeným strachom
  (väzeň sa ráta), koľko má. Cigarety sú tak pripravené na ponuku. Po finále sa neplatí.

**Zmeny v11.8 oproti v11.7** (Michal 2026-11-06, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.8):

- **Každý Hazard je Dlh** (§2, §7, §8): „Defaultne nebude mať dlh prah, čiže každá akcia Dlh automaticky dá
  hráčovi Dlh.“ Každá aktívna akcia Hazard dá v Pitke 1 Dlh. Efekt „získa 1 zadĺženie“ (Policajtka, Podvodník)
  dá rovno 1 Dlh. **Výherný automat** ostáva: jeho majiteľ dostane Dlh za každé 2 zadĺženia a zvyšok mu ostáva na účte.

**Zmeny v11.7 oproti v11.6** (Michal 2026-11-06, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.7):

- **Kostol: NA EX len na koniec línie** (§15, §7): „V kostole sa nesmie piť — piť môžu len karty najďalej
  od kostola — posledné v línii na jednej alebo druhej strane.“ Vypiť nesmie nikto, ako doteraz (v ťahu 1
  karta). NA EX sa smie dať len na poslednú kartu línie, na výber sú oba konce. Oltár a otočenie Kostola
  pre NA EX zanikli.
- **Výtržník vedľa Silnej nezávislej ženy** (§7): Rany Výtržníka sa nezdvojujú. Hra to tak robila, teraz je
  to zapísané.

**Zmeny v11.6 oproti v11.5** (Michal 2026-11-03, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.6):

- **Zajatie len staršieho na červenej od minulého kola** (§9.4, §10): zajať smieš len staršieho, pri ktorom
  je tvoj strach na červenej **už pred touto Nakladačkou**. Dotiahnuť strach na červenú a v tom istom
  rozdelení zajať (zo strachu 2 za 3 + 5) už nejde. Presvedčenie sa nemení — reči sa smú dotiahnuť na
  červenú v tom istom rozdelení hádky.
- **Pečiatka namiesto tlačidiel** (hra): pri tvojom rozdelení sa na staršom, pri ktorom sa akcia na tvoje
  body dá, ukáže pečiatka **ZAJAŤ** (Nakladačka) či **PRESVEDČIŤ** (hádka) s cenou; klik ju potvrdí
  (ZAJATÝ / PRESVEDČENÝ), ďalší klik ju vráti.

**Zmeny v11.5 oproti v11.4** (Michal 2026-11-03, Zrejúca, „Identita kariet“, docs/napady/identita-kariet;
staré znenia v `docs/pravidla-historia.md`, sekcia v11.5):

- **Nové akcie všetkých kariet** (sada v `cards.json`): každá karta má identitu (2 z 6 rolí); Starší majú
  1 variant, Občania 4–8, Nástroje a Zvieratá 2–4.
- **Nové efekty siedmich kariet** (§16): Noviny (Dedičstvo: Hádka — porazený v hádke odhodí náhodnú kartu
  z ruky), Opatrovateľka (Furt — posilnení Pamätníci v okolí), Podvodník (Konflikt — cigareta, inak
  zadĺženie), Anonymný alkoholik (Furt — pečeň susedov ako Viera), Šofér (bez NA EX aj 1 cigareta),
  Sypač (Podpora — tvoj Chlap má Rany ako Pecky), Kôň (jeho Roboty pália o 1 Dlh viac).
- Zanikli: Noviny ako špaky za Dlhy víťaza, Opatrovateľka a Chuť, Podvodník pri prehre, Nástup Anonymného
  alkoholika (priznanie Cirhóz), Sypačove Pecky ako Výtržník.

**Zmeny v11.4 oproti v11.3** (Michal 2026-11-03, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.4):

- **Pokus o zajatie zanikol** (§5, §9, §10): voľba v drafte, cigareta, karta staršieho v ruke, ohrozenie
  (nedvíhať na staršieho), karta zadarmo pri stavbe ponuky, pád strachu na 0 aj krok 6d. Stavba ponuky je
  hneď po voľbe cieľa, každý dá 4 do ponuky a 4 naspodok.
- **Zajatie pri rozdelení Nakladačky** (§9.4, §10): kto rozdeľuje Nakladačku, smie zajať staršieho, pri
  ktorom má **strach 3**, za **5 bodov** (na červenú sa smie dotiahnuť v tom istom rozdelení). Dobrovoľné,
  viac naraz smie byť; väzeň, krádež špakov a výhra väzňami hneď. Vo finále nie.
- **Presvedčenie** (nové, §9.1, §10): kto rozdeľuje hádku, smie presvedčiť staršieho, pri ktorom má
  **súper vyšší strach**, keď má reči na červenej, za **5 bodov**. Jeho reči zaniknú, strach a priazeň
  ostávajú; **karta staršieho ide do ruky presvedčovateľa a natrvalo patrí do jeho balíčka**. Kto prvý
  presvedčí, toho je; zajať presvedčeného smú obaja. Vo finále nie.

**Zmeny v11.3 oproti v11.2** (Michal 2026-11-03, Vypálená aj Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.3):

- **Konflikt oboma smermi** (§6, §16): Konflikt karty sa spustí, keď sa **priložením** ocitne vedľa
  **súperovej** karty — či ju prikladáš ty k súperovej, alebo súper svoju k nej. Predtým len druhé.
- **Podpora** (nový spúšťač, §6, §16): zrkadlo Konfliktu — spustí sa, keď sa priložením stretnú **dve
  karty toho istého hráča**.
- **Veľmi smútiaca vdova:** súper odhodí **1 kartu** (predtým 2) z doberacieho balíčka za každého
  svojho Chlapa, ktorý s ňou susedí.
- **Snúbenica** má Podporu: keď sa stretne s tvojím Chlapom, na ktorom leží súperovo NA EX, NA EX
  zíde a súperov poldeci sa mu vráti vypitý. Predtým Konflikt (priložený Chlap prešiel k nej).

**Zmeny v11.2 oproti v11.1** (Michal 2026-11-02, Zrejúca; podklad docs/napady/bonus-zajatia.html, sada B
prestavená na „raz za hru, kedy chceš“; staré znenia v `docs/pravidla-historia.md`, sekcia v11.2):

- **Schopnosť väzňa namiesto Kšeftu väzňa** (§7, §10, §16): Kšeft väzňa za vypitý poldeci zanikol.
  Každý zajatý starší má **schopnosť**, ktorú hráč, ktorý ho má v pivnici, smie použiť **raz za hru,
  kedy chce** — vo svojom ťahu pri braní z ponuky, v Zhromaždení alebo v Pitke, aj vo finále.
  Nič nestojí, nie je to ťah. Po použití je **minutá**; starší **ostáva v pivnici** a ráta sa ďalej
  ako vydesený (červená). **Krádež špakov pri zajatí ostáva.**
- Poštárka: 4 cigarety. Krčmárka: nový plný poldeci (natrvalo). Farár: odstráni jedno súperovo NA EX
  z karty. Starosta: do konca kola všetky aktívne akcie lokality posilnené, aj akcie Pitky (spresnené
  2026-11-02). Veterinár: odhodí Cirhózy na ruke a priznané. Vychovávateľka: súper v tomto
  Zhromaždení hneď pasuje (vynútený pas, už nevyloží nič) a za pas nedostane cigarety. Autobusár: z ponuky koľko
  chceš, po cigarete. Hrobár: karta zo súperovho odhadzovacieho balíčka (znenia v §10).
- Kšeft väzňa už nie je nerest (§8).

**Zmeny v11.1 oproti v11** (Michal 2026-11-02, Zrejúca: „Majú sa aktivovať akcie naopak, nie
aktivovať všetky.“; staré znenia v `docs/pravidla-historia.md`, sekcia v11.1):

- **Vzbura obráti aktivitu karty** (§6): na karte so Vzburou sú aktívne **nespojené** akcie
  (bez partnera na spoji, na oboch jej stranách) a **spojené sú neaktívne** — aj tie, ktoré by
  zdvojilo Posilnenie suseda. Predtým boli aktívne všetky. Zrušené Odporom ostávajú zrušené.
- **Odpor proti Posilneniu = Vzbura len karty s Odporom** (§6): obráti sa a **všetky jej aktívne
  akcie sú posilnené (×2)**; karta s Posilnením nič nedostane (jej Posilnenie je zrušené).
  Predtým to Vzbura nebola a zdvojenie nebolo.
- **NA EX nemožno dať na kartu so Vzburou** (§7) — ani z Odporu proti Odporu, ani proti Posilneniu.
- Modifikátory karty so Vzburou na jej spojoch pôsobia ďalej (Odpor ruší, Posilnenie zdvojí,
  Forsáž); Forsáž sa uplatní až na obrátenú kartu.

**Zmeny v11 oproti v10.4** (Michal 2026-11-02, docs/napady/strach-reci.html; staré znenia
v `docs/pravidla-historia.md`, sekcia v11):

- **Strach a reči** (§10): pri každom staršom má **každý hráč vlastný strach** (0–3, neklesá)
  a **reči** (stupeň nad vlastným strachom). **Priazeň pre teba = strach súpera − tvoj strach.**
  Jeden marker so 7 poľami, udržaný strach a klebety zanikli.
- **Nakladačku rozdelí víťaz bitky na svoj strach, hádku víťaz hádky na svoje reči** (§9.1, §9.4) —
  voľne medzi starších, stupeň za 1 / 2 / 3; čo sa nedá, prepadne. Hádka priazne nemení.
- **Bodovanie starších po bitke** (§9, krok 4b; §14): víťaz za najvyšší marker, porazený a pri
  sekere obaja za reči — žltá 1, oranžová 3, červená 5; reči potom klesnú o stupeň.
- **Výhra strachom** (§1): kto vyhrá bitku a má červený strach u 4 starších (väzni sa rátajú),
  vyhráva hneď. **Väzni na výhru podľa ligy** (Tretia 2, Druhá 3, Prvá 4).
- **Zajatie** (§10): podmienka je tvoj strach 3; úspech = väzeň a **krádež špakov**, neúspech =
  tvoj strach pri ňom 0. Špaky za väzňov 8 / 6 / 4 / 2 zanikli.
- **Porazený dostane 1 cigaretu** (§9, krok 6c) — namiesto cigarety za posunutého staršieho;
  po finále nie.
- **Finále** (§14b): markery sa nedvíhajú — Nakladačka aj hádka idú 1 : 1 na špaky.
- **Kapybara** (Nástup): súperove reči pri jednom staršom klesnú o stupeň. **Predsedova vila**
  (Kšeft): za 2 cigarety zdvihni svoje reči pri jednom staršom o stupeň; staršieho v ohrození nie.

**Zmeny v10.4 oproti v10.3** (Michal 2026-11-02, docs/napady/autority.html kolo 2
a docs/napady/odpor-vzbura-poc.html; staré znenia v `docs/pravidla-historia.md`, sekcia v10.4):

- **Spáliť** (§17): karta ide **navždy z hry** (nevracia sa do žiadneho balíčka); **odhodiť** =
  do odhadzovacieho balíčka. Pojem „zahodiť“ zanikol — Vízia, Veterinár, Krištáľová guľa,
  Krokodíl, Dievčina na vydaj a Absťák odteraz „pália“ (správanie sa nemení).
- **Poľovník** (§16, nová Autorita): „Nástup: Spáľ súperovo Zviera na druhej strane lokality, ktoré
  je od nej najďalej.“
- **Predavačka** (§7, §16, nová Autorita): „Kšeft: Za 1 cigaretu si dober 1 kartu.“
- **Vedúcko** (§16, nová Autorita): „Furt: Roboty kariet, ktoré s ním susedia, sa rátajú ako Pecky.“
- **Policajtka** (§16): „Pitka: Za každú súperovu akciu, ktorú v tejto Pitke zruší tvoj Odpor, získa
  súper 1 zadĺženie.“ (predtým Konflikt: Dlh, za Kriminála 2 cigarety).
- **Profesionálny tipér** (§16): ráta za „posilnené“ aj akcie posilnené Forsážou.

**Zmeny v10.3 oproti v10.2** (Michal 2026-11-02; staré znenia v `docs/pravidla-historia.md`,
sekcia v10.3):

- **Forsáž** (§6, §7): Posilnenie + Posilnenie na spoji už nie je „nič“. Obe karty spoja majú
  **všetky svoje aktívne akcie posilnené (×2)**; akcia posilnená navyše Posilnením suseda má ×4.
  Lokalita len hranu pri tom kraji, **Nástroj Forsáž nedostane**. Odpor Praudovravca (ráta sa ako
  Posilnenie) Forsáž vytvára. NA EX, ktorý zruší jedno z dvoch Posilnení, zruší aj Forsáž.
- **Vzbura s Nástrojom** (§6): Odpor Nástroja proti Odporu Občana či Starešinu — Vzburu dostane
  len Občan / Starešina, Nástroj nie.
- **Úplatok zrušený** (§7, §16): Kulturista je **Sypač** — „Pitka: Ak sa stane Výtržníkom, jeho
  akcie sú Pecky, nie Rany.“
- **Veľmi smútiaca vdova** (§16): Konflikt — súper odhodí 2 karty z doberacieho balíčka za každého
  svojho Chlapa, ktorý s ňou susedí (predtým: priložený Chlap po bitke z hry).
- **Liberál** (§16): Furt — s rovnako ženami a chlapmi v tvojej partii sú jeho aktívne akcie
  posilnené (predtým: súper bez rovnováhy 1 zadĺženie v Pitke).

**Zmeny v10.2 oproti v10.1** (Michal 2026-11-01: „Vedľa lokality sa nedá umiestniť náradie.“;
staré znenia v `docs/pravidla-historia.md`, sekcia v10.2):

- **Nástroj nie vedľa lokality** (§6, §12): Nástroj sa do línie nevyloží na prázdnu stranu —
  ani na svoju, ani na súperovu, ani vo finále (pinnacle je lokalita). Platí pre každé vyloženie
  do línie (aj ťah s viacerými kartami, Záverečná, odpoveď na NA EX); za Živnostníka ho priložiť
  smieš. Do Dedičstva ako doteraz. Nástroj, ktorý sa k lokalite dostane neskôr (karta medzi
  nimi odíde), ostáva ležať.

**Zmeny v10.1 oproti v10** (Michal 2026-11-01; staré znenia v `docs/pravidla-historia.md`,
sekcia v10.1):

- **Pokus o zajatie pred stavbou ponuky** (§4, §5, §10): po voľbe cieľa, ešte pred stavbou
  ponuky (predtým po braní). Karta staršieho (boss) ide **pokúšajúcemu do ruky** (predtým
  súperovi) — smie ju v kole vyložiť, len s akciami. O výsledku ďalej rozhoduje bitka (krok 6d).
- **Karta zadarmo** (§5): súper pokúšajúceho si pri stavbe zo svojich 8 kariet **tajne nechá
  1 do ruky**, 4 dá do ponuky a 3 naspodok — aj keď pokus potom zlyhá. Keď skúšajú obaja,
  karta zadarmo nie je nikomu.

**Zmeny v10 oproti v9.3** (Michal 2026-11-01, docs/napady/hadka.html; staré znenia v
`docs/pravidla-historia.md`, sekcia v10):

- **Hádka** (§2, §9.1): kroky Povery a Pohoršenie sa zlúčili do jedného. Povera a Pohoršenie sú
  **mäkké poškodenie** (Pohoršenie 2, Povera 1, po vyrušení Povier s Vierou 1 : 1). Kto má viac
  mäkkého, vyhral hádku o rozdiel a rozdelí ho na **sily priazní starších len k sebe** — cena
  podľa zóny ako pri Nakladačke, strop sila 3, platí do konca kola. **Marker sa nehýbe**; markery
  hýbe už len Nakladačka. Remíza = nikto nerozdeľuje.
- **Abstinent** (§9.3, §9.4, §10): v bitke sa ti neráta 1 / 2 / 3 Absťákov (tuhé za ne neklesne,
  nerátajú sa ani pri remíze v tuhom); Pohoršenia navyše už nedáva.
- **Veriaci** (§9.1, §9.3): proti Poverám so silou pred hádkou, rozdiel po hádke tlmí tuhé.
- **Náradie** (§12): Telefón — tvoje Pohoršenia nemožno zrušiť Odporom a NA EX; Horoskop — tvoje
  Povery majú silu 2 (prenášanie klebiet do ďalšieho kola zaniklo). Svätý text ostáva „hodnota
  tvojej Viery je o 1 vyššia“ len v tlmení tuhého — Povery ruší jedna Viera po jednej (Michal 2026-11-01).
- **Starší v ohrození** (§10): hádka smie meniť silu jeho priazne; zákaz O8 ostáva pre Nakladačku.

**Zmeny v9.3 oproti v9.2** (Michal 2026-10-31, interview po audite pravidiel `docs/napady/audit-pravidiel-v92.html`;
staré znenia v `docs/pravidla-historia.md`, sekcia v9.3):

- **Výtržník prebíja Úplatok** (§7, §16 Kulturista): kým je karta Výtržníkom, úplatky na nej
  sa na jej akcie neuplatnia — ani tie, ktoré dostala pred zrážkou. Na Výtržníka sa Úplatok
  dať nedá (hra ho neponúkne, cigareta by prepadla naprázdno). Úplatok zanikol vo v10.3.

**Zmeny v9.2 oproti v9.1** (Michal 2026-10-30; staré znenia v `docs/pravidla-historia.md`, sekcia v9.2):

- **Ponuka začína obranca** (§4, §5): útočník berie druhý. Kto berie prvý, na **svojom
  prvom ťahu vezme len 1 kartu** (za 1 cigaretu) — nevykradne ponuku; ďalej 1 alebo 2 ako doteraz.
- **NA EX sa odkrývajú naraz** (§7): jedna udalosť, oba poldeci ľahnú súčasne.
- **Odpovede na NA EX lícom dole** (§7): štýlom Záverečnej, ale zadarmo — najprv
  **útočník**, potom **obranca na druhý kraj línie**; obe sa **otočia naraz** a Pitka sa
  vyhodnotí. Posledné slovo nemá nikto. **Kohút** je dočasne vyradený (§16).

**Zmeny v9.1 oproti v9** (staré znenia v `docs/pravidla-historia.md`, sekcia v9.1):

- **Chuť a Absťák v3** (§4, §8, §9, §11, §14, §16, §17; docs/napady/abstak-3.html):
  verejné počítadlo **Chuť** (štart 0). Nerest je len konzumácia — Vypiť 1, **NA EX 2**,
  vyfajčená cigareta 1. Na konci kola: menej nerestí než Chuť → **karta Absťák** do
  odhadzovacieho balíčka; potom Chuť = väčšie z (Chuť, neresti) − 1. Absťák je Kliatba,
  nedá sa priznať, −1 tuhé za každú kartu kdekoľvek v balíčku; spáli ju Vízia. Súper
  latku neurčuje, **Nervák zaniká**. Výučba Prvá hra je bez Chuti.
- **Nakladačka vo finále → špaky 1 : 1** (§9.4, §14b): víťaz finále dostane za každý
  bod Nakladačky 1 špak (predtým prepadla).
- **Zastávka** (§15): po prvej Pitke kola si každý vezme zadarmo kartu z ponuky,
  najprv útočník (spoločný limit vykladania zaniká).
- **Pasca** (§16): Rana navyše (text karty od sady v36), nie Pecka.
- **Opatrovateľka** (§16): Furt — Chuť sa na konci kola porovnáva o 2 nižšia.
- Znenie: Nakladačka spresnená (§9.4), Valaška (predtým Boxer), Šarlatán a NA EX (§16).

**Zmeny v9 oproti v8** (staré znenia §1, §10 Patronát a Prebudenie a tabuľka
priazní v8 sú v `docs/pravidla-historia.md`, sekcia v9):

- **Väzeň namiesto patronátu a vydesenia** (§1, §5, §9, §10): po ponuke smie hráč za
  **1 cigaretu** skúsiť zajať staršieho, ktorý sa ho **bojí na stupni 3**. Karta
  staršieho (boss) ide súperovi do ruky, starší je **v ohrození** (v kole sa jeho
  markerom nehýbe). Vyhrá bitku → **väzeň** v priznaných kartách; prehrá alebo
  sekera → starší späť, marker o stupeň k stredu. **Tretí väzeň jedného hráča =
  výhra hneď.** Po finále väzni dajú špaky podľa poradia zajatia v partii
  **8 / 6 / 4 / 2**. Ohlásené vydesenie, patronát, náhrada a prebudenie zanikajú.
- **Kšeft väzňa** (§7, §16): efekty ôsmich starších nahradil výhradný Kšeft, ktorý
  má len držiteľ väzňa, za **vypitý plný poldeci**, raz za Pitku na väzňa. Karta
  staršieho v línii má len akcie.
- **Bossovia** (§10, §16): karty starších majú 6 akcií, 2 blokované sloty a presne
  1 neresť (Hazard alebo Pečeň), dve siluety 4 + 4 — zadáva Admin v tvorcovi.
- **Priazne** (§10, §11): **Advokát** (exekúcia −1 / −2 / −3 špaky) a **Robota**
  (1 / 2 / 3 akcie Robota navyše) namiesto Exekútora a Výpalníka; **Fajčiar** po
  bitke; **Kmotor** presúva 2 / 3 / 4 Dlhy.
- **Ponuka** (§5): N = 8 vždy (v8.5), väzni ju nezmenšujú.

**Zmeny v8 oproti v7** (staré znenia v `docs/pravidla-historia.md`, sekcia v8;
zmeny v7 oproti v6 tamže, sekcia v7):

- **Špaky za bitku = karty v línii** (§9.4, §14, návrh #28): víťaz dostane
  1 špak za každú kartu, ktorá v čase bitky leží v línii na oboch stranách —
  nie za odohrané Pitky.
- **Strach za novú zónu** (§10, §14, návrh #28 B): starší zaplatí víťazovi len
  zóny, ktoré mu ešte nezaplatil (žltá 1, oranžová 2, červená 3); ústup markera
  k stredu vyplatené zóny zmaže.
- **Nakladačku rozdeľuje porazený** (§9.4): ten, proti komu sa Nakladačka ráta, si
  vyberá, ktorých starších posunie; vo finále rozdeľuje držiteľ a strach za nové
  zóny sa vyplatí hneď. Nakladačka sa nikde nemení na špaky 1 : 1.
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

**v8.1 — Absťák „Nervák“** (Michal 2026-10-28, roadmapa #113; návrhy 1 + 4
z docs/napady/abstak-2.html):

- **Krok so stolom** (§8): na konci kola sa porovnajú neresti **oboch hráčov
  v tomto kole** — kto mal menej, dostane Absťák rovno priznaný (+1 karta), kto
  viac, zbaví sa jedného priznaného; rovnosť nič. Porovnanie s minulým kolom
  a „prvé kolo nastaví základ“ zanikli.
- **Nervák** (§9.2, §9.3, §9.4, §14): každý Absťák v bitke o ranu menej a navyše
  **+1 Pohoršenie**; remízu v tuhom ďalej rozhodujú Absťáky. **Zrážka špakov
  víťazovi za Absťáky zaniká.**

**v8.2 — Hazard, počítadlá a cena posunu** (Michal 2026-10-30, z jeho partie
a výučby; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Akcia Dlh sa volá Hazard** (§2, §8): Hazard zvyšuje zadĺženie, zadĺženie
  dáva Dlhy. Kľúč v dátach ostáva `Dlh`.
- **Dlh a Absťák nie sú karty, ale počítadlá** (§8, §11): sú hneď priznané,
  neťahajú sa, nedá sa s nimi manipulovať. Za nový Absťák si hráč kartu
  **nedoberá**. Všetko, čo rátalo Absťáky „priznané, v línii a v ruke“, ráta
  počítadlo — je verejné. Cirhóza ostáva kartou.
- **Cena posunu markera** (§9.2, §9.4, §10): Pohoršenie aj Nakladačka platia za
  pole podľa cieľovej zóny — von zo stredu žltá **1**, oranžová **2**, červená
  **3** (zo stredu na červenú 6), k stredu o 1 viac — z červenej **4**,
  z oranžovej **3**, zo žltej **2**. Hráč vyberá len staršieho (pri Pohoršení aj
  smer), marker ide, kým body stačia; zvyšok ide na ďalších starších. Čo už na
  žiadny posun nestačí, prepadne.
- **Povera poškodzuje** (§2, §9.3): mäkké poškodenie proti priznaným Dlhom
  súpera (len znenie).

**v8.3 — Strach až po udržaní a pojmy stupnice** (Michal 2026-10-30, revízia
starších krok 1, docs/napady/starsi-revizia.html R2 variant 6A a R14; značka
`VERZIA_PRAVIDIEL` ostáva „v8“):

- **Strach až po udržaní** (§10, §14): stupeň, kam sa marker dostal, zaplatí
  hráčovi, ktorého sa starší bojí (žltá 1, oranžová 2, červená 3), až **na konci
  nasledujúceho kola, ak sa na ňom marker udrží** — kontrola na konci kola po
  bitke, Pohoršeniach aj Nakladačke. Platí **aj porazenému**, nezáleží, kto bitku
  vyhral. Odtlačený stupeň nič. Krok 4b „špaky za starších víťazovi“ zaniká.
- **Finále** (§14b): stupne, kam sa marker dostal až vo finále, nič; stupne udržané
  z posledného kola sa vyplatia po finále. **Vo finále sa rozdeľuje len Pohoršenie,
  Nakladačka už nie.**
- **Pojmy** (§10, §17): zóny sa volajú farbou a **stupňom 0–3** (stred 0, žltá 1,
  oranžová 2, červená 3); starší je podľa stupňa **pokojný / znepokojený /
  vystrašený / vydesený**; smer posunu je **„od seba / k sebe“** (predtým „k súperovi /
  k sebe“), posun od seba staršieho **desí**, k sebe ho **upokojuje**. Názvy zón
  Neutralita / Znepokojenie / Strach / Vydesenie zanikli; „vydesenie“ ostáva
  pre výhru (§1). Patronát a výhra vydesením zatiaľ ostávajú (zaniknú s väzňom,
  revízia krok 2).
- **Povery „Výpožička priazne“** (§9.1, §9.3, §9.4, Michal 2026-10-30,
  docs/napady/povery.html): nový krok bitky **Povery** pred Pohoršením. Viera
  a Povery sa vyrušia 1 : 1 ako doteraz; každá **zvyšná Povera posunie silu
  priazne jedného staršieho o stupeň k svojmu majiteľovi** (marker sa nehýbe,
  strach ani udržanie sa nemenia), strop 3, **len na toto kolo**. **Mäkké
  a celkové poškodenie aj strop podľa Dlhov zanikajú**; Nakladačka = rozdiel
  tuhého a drží ju víťaz. **Otvorené** (P5, P6): Čierna mačka podľa návrhu „Furt:
  Tvoje Povery sa Vierou nerušia.“ (text karty zmení Admin); pojem ostáva Povera.
- **Nakladačka** (Michal 2026-10-30): **prebytok** — rozdiel tuhého poškodenia,
  ktorým sa po bitke posúvajú starší — sa volá **Nakladačka** všade, kde ho číta
  človek. Kľúče v dátach a príkaz `prebytok` ostávajú.

**v8.4 — Náradie** (Michal 2026-10-30, docs/napady/naradie-akcie.html, sekcia
Rozhodnuté; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Robota** (§2, §11): spáli 1 priznaný Dlh; **za každý Dlh, ktorý nemá čo spáliť,
  dá 1 špak** (s Fúrikom 2 Dlhy, bez Dlhov 2 špaky).
- **12 nových Nástrojov do Dedičstva** (§12, §16): Zapaľovač, Výherné žreby, Izolačka,
  Hrable, Zrkadlo, Valaška, Telefón, Jogurt, Energeťák, Horoskop, Fúrik, Krištáľová guľa.
- **Puška** (§16): už nepridáva +1 k Petelici — prepojenú Petelicu, ktorú by zrušil
  Odpor či NA EX, namiesto zrušenia ráta o 1 poškodenie menej (3 → 2).
- **Profesionálny tipér** (§16): posilnené akcie na jeho spojoch — súperove ako
  posilnený Hazard, tvoje ako posilnená Robota.
- Karty pridá Admin do sady; kým nie sú zverejnené, jadro ich pozná podľa id.

**v8.5 — Náradie a Občania** (Michal 2026-10-30; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Spoločný balíček sa delí na dva** (§3, §5): **Náradie** (karty s tagom Nástroj)
  a **Občania** (všetky ostatné karty, ktoré boli v spoločnom balíčku).
- **Stavba ponuky** (§5): každý hráč dostane **vždy 2 karty z Náradia a 6 z Občanov**;
  počet nezávisí od nenahradených starších. Do ponuky dá **4 v ľubovoľnom mixe**, zvyšok
  naspodok svojho balíčka (Nástroj k Náradiu, ostatné k Občanom). Nevzaté karty zo
  starého ponuky idú naspodok svojho balíčka.
- **Doplnenie ponuky** (§5): na 8 v rovnakom pomere — najprv z Náradia, kým v ponuke nie sú
  aspoň 2 Nástroje, zvyšok z Občanov.
- **Výklad Leadera (2026-10-30, Michal potvrdil 2026-11-10):** keď jeden balíček nestačí, chýbajúce
  karty dá druhý; keď sa minú oba, stavba sa zmenšuje ako doteraz, bez trestu.

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
  („v4“ … „v9“, staršie dátumové značky).

---

## 1. Cieľ a koniec hry

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality a desia starších. Každé kolo je jedna bitka; hra má toľko
bitiek o lokality, koľko určí dĺžka hry (§3), a po nich **finále** — poslednú
bitku na vrcholovej (pinnacle) lokalite (§14b). Víťazné body sú **špaky** (§14): za vyhratú bitku
(karty v línii) a za starších po každej bitke (strach a reči, §10). Hra končí okamžitou
výhrou strachom alebo väzňami, alebo po finále väčším počtom špakov. Pri rovnosti
špakov je remíza.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč **vyhrá bitku** a po bodovaní má **červený strach u aspoň 4 starších** — jeho väzni sa rátajú ako jeho červené (v11, krok 4c) | **vyhráva hneď** (výhra strachom) |
| Hráč **vyhrá bitku** a po zajatí má **väzňov aspoň (lokality + finále) / 2**: Tretia liga **2**, Druhá **3**, Prvá **4** (v11; v11.4 hneď po rozdelení Nakladačky, krok 4e) | **vyhráva hneď** (výhra väzňami) |
| Odohrá sa finále (po 3 / 5 / 7 bitkách o lokality podľa dĺžky hry) | vykúpia sa zvyšné plné poldeci a cigarety, odpočíta sa nepriznaná Cirhóza a vyhrá viac špakov (§14); väzni od v11 špaky nedávajú |

Obe okamžité výhry platia len v bitke, ktorú hráč vyhral — štyri červené porazeného hru
neukončia. Exekúcia prehru nespôsobí — stojí Dlhy a špaky (§11). „Vydesený“ je stupeň staršieho
pre hráča, ktorého strach je na červenej; do výhry strachom a zajatia sa ráta celý strach, aj keď naň súper
dal reči (§10).
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
| Povera | `Povera` | **1 mäkké poškodenie** (v10; s Horoskopom 2) do hádky (§9.1); ruší sa so súperovou Vierou 1 : 1 na kusy |
| Pohoršenie | `Pohoršenie` | **2 mäkké poškodenie** (v10) do hádky (§9.1); Viera ho nezruší |
| Viera | `Viera` | najprv zruší súperove Povery 1 : 1 na kusy (jedna Viera jednu Poveru, aj vylepšenú Horoskopom), zvyšná znižuje súperovo tuhé poškodenie o hodnotu Viery (1; Svätý text v Dedičstve +1) za kus; priazeň Veriaceho pridá Vieru navyše rovnú sile (+1 / +2 / +3; ruší Povery aj tlmí tuhé tou istou silou, §9.1) |
| Hazard | `Dlh` | v Pitke dá **1 Dlh**, hneď priznaný (počítadlo, §8); za priznané Dlhy príde v každej bitke Exekútor (§11) |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene (§8) |
| Obmedzenie | `Obmedzenie` | súper dostane v Pitke o 1 cigaretu menej |
| Cigareta | `Cigareta` | +1 **cigareta** v Pitke — cigarety sa prenášajú z kola na kolo; platia sa nimi karty z ponuky, Dedičstvo, ďalšie karty v ťahu (§13), barter a Záverečná, fajčením (len v Pitke, §7) dávajú karty |
| Vízia | `Vízia` | na konci Pitky: za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho doberacieho balíčka a vezme si ju do ruky, alebo ju **spáli** (navždy z hry) |
| Poldeci | `Poldeci` | otočí jeden vypitý poldeci späť na plný — **na konci každej Pitky** (v12.2, §7); v Pitke pridá aj poškodenie pečene |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú); Posilnenie + Posilnenie = Forsáž (§6) |
| Odpor | `Odpor` | **v12.1:** aktívny len **bez spoja** — dáva karte štít proti NA EX (§7); na spoji zruší prepojenú akciu aj seba (zhasne); Odpor + Odpor = Vzbura (§6) |
| Robota | `Robota` | v kroku exekúcie (po poškodení), **pred** Exekútorom, spáli 1 priznaný Dlh (z hry, §11); **za každý Dlh, ktorý nemá čo spáliť, dá 1 špak** (v8.4) |
| Pakt | `Pakt` | **v7:** na spoji sa správa ako akcia, s ktorou je v páre (aj zlá — Hazard, Pečeň). Premení sa ešte pred násobkami: Pakt + Posilnenie = dve Posilnenia, teda Forsáž (v10.3). Pakt + Pakt nerobí nič. **Odpor** Pakt zruší ako každú akciu (Vzbura nevznikne). Neaktívny Pakt nemá čo kopírovať: do súčtov nejde a NA EX ho nezdvojí; do podmienky „aspoň 1 neaktívna akcia“ (§7) sa od v12.1 ráta (predtým nie). Na hranách lokalít Pakt nie je; pri lokalite kopíruje akciu hrany. Pri Výtržníkovi (§7) je Rana ako každá jeho akcia. **Pakt, ktorý kopíruje akciu, je tou akciou pre všetky efekty** (v11.16, Michal 2026-11-09): „tvoje Pecky“ (Boxer), Rany (Vidly), Povery (Horoskop), Cigarety (Zapaľovač) a iné efekty, ktoré sa viažu na akciu, rátajú aj Pakt, ktorý ju kopíruje. |

Akcia sa volá ako karta či zdroj, ktorý dáva: `PoškodeniePečene` → Poškodenie
pečene, `Poldeci` → Poldeci, `Cigareta` → Cigareta (starý kľúč `Cigaretka` sa
pri načítaní sady preloží). Výnimka: akcia s kľúčom `Dlh` sa od v8.2 volá
**Hazard** (Michal 2026-10-30) — Hazard dáva Dlhy.
Kľúč ostáva `Dlh` (sady, karty a partie v archíve ho nesú). Slovo „fyzická
cigareta“ sa nepoužíva — cigareta je cigareta.

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
  len priazeň staršieho, §10; bodovacie podmienky od v6 nie sú). Strach
  aj reči oboch hráčov pri každom staršom začínajú **na nule** (§10).
- **Počiatočná ruka:** každý hráč má na začiatku v ruke **4 karty** —
  Miňištrant, Milujúca manželka, Pijan a Dievčina na vydaj (variácie podľa
  sady). **Doberací balíček je prázdny** — naplní ho až odhadzovací (§4).
  Tieto štyri druhy nie sú v Náradí, Občanoch ani v ponuke.
- **Náradie a Občania (v8.5):** karty ponuky ležia v dvoch balíčkoch lícom dole,
  každý zamiešaný — **Náradie** (2 kópie každej karty s tagom Nástroj)
  a **Občania** (2 kópie každej ďalšej karty okrem lokalít, starešinov, kliatob
  a štartoviek). Počet kariet v oboch je verejný, poradie nie.
- Každý hráč začína s **3 cigaretami**, **3 plnými poldeci** (v12.2; maximum, na ktoré sa po bitke obnovia, §9.5), **0 špakmi**,
  0 dlhmi, 0 poškodením pečene, Chuťou 0 (bez kariet Absťák) a počítadlom nerestí na 0.
- Ponuka je na začiatku prázdna — hráči ju postavia v prvom drafte (§5).
- Útočník prvého kola sa určí náhodne (zo semienka hry).

---

## 4. Priebeh kola

```
začiatok kola → voľba cieľa → draft (stavba ponuky, branie)
  → (Zhromaždenie → Pitka) × 1–4 (pinnacle 1–5) → bitka → koniec kola
finále: voľba pinnacle → draft → (Zhromaždenie → Pitka) × 1–5 → bitka → koniec hry   (§14b)
```

**Útočník** = hráč, ktorý **prehral poslednú bitku** (v prvom kole náhodne;
pri sekere ostáva útočníkom; vo finále útočí, kto má menej špakov, §14b). **Vykladá prvý
a na odkryté NA EX odpovedá prvý** (lícom dole, §7) — jeho výhody slúžia na dobiehanie.
**Obranca** je víťaz poslednej bitky: **vyberá cieľ** kola (natáča ho víťaz minulej hádky, v11.11, §5), **berie z ponuky
prvý** (v9.2, na prvom ťahu len 1 kartu, §5) a na odkryté NA EX odpovedá druhý — na
druhý kraj línie. Pitku hrajú obaja naraz (§7).

**Začiatok kola:**

- Poldeci sú plné už od konca bitky (§9.5, v12.2) — na začiatku kola sa nič neotáča.
- Od druhého kola si každý hráč dobere zo svojho doberacieho balíčka **2 karty**
  (dobratie po bitke, v11.21, `KONSTANTY.DOBRATIE_PO_BITKE`), bez ohľadu na to, koľko ich
  má v ruke; nič sa neodhadzuje. Ďalšie karty sa kupujú cigaretami v ponuke a
  fajčením. **Keď sa doberací balíček minie,
  odhadzovací sa zamieša a stane sa z neho nový doberací balíček** — pri
  každom ťahaní, aj uprostred neho. Na začiatku hry je doberací balíček
  prázdny (§3): kým hráč nemá ani odhadzovací, ťahanie nedá nič, fajčiť sa
  nedá a Poštárka sa nepoužije. **Limit ruky nie je** — hráč smie mať kariet, koľko chce. Karty
  navyše dáva ponuka, fajčenie v Pitke (§7), Vízia a efekty (z ponuky Zastávka, Predavačka
  a Živnostník; Hasič…). Priznanie Cirhózy kartu nedá (§11).

**Koniec kola** (po bitke a návrate kariet, §9.7): neresti kola sa porovnajú
s **Chuťou** každého hráča (Absťák, §8; po finále nie). Starší bodujú ešte v bitke (krok 4b)
a zajíma sa v nej tiež (rozdelenie Nakladačky, krok 4e, §9); udržaný strach zanikol v11.

**Nevyhnutné ťahy:** keď hráč nemá inú možnosť než pasovať (v Zhromaždení)
alebo preskočiť NA EX (v Pitke), hra ten ťah urobí za neho.

---

## 5. Cieľ a draft

### Voľba cieľa

Obranca vyberie lokalitu, o ktorú sa v kole bije. **Natočí ju víťaz hádky z minulého
kola** (v11.11); v prvom kole a po remíze v hádke ten, kto vyberá. Natočenie
určuje, ktorá hrana lokality leží pri ktorom kraji línie (§6). **v7:** vyberá
zo **všetkých ešte neodohraných lokalít úrovne tohto kola** (§3) — vždy aspoň
z troch; vo finále z troch pinnacle (§14b).

Pokus o zajatie pred stavbou ponuky (v10.1–v11.3) zanikol v11.4 — zajíma sa pri rozdelení
Nakladačky (§10). Ponuka sa stavia hneď po voľbe cieľa.

### Stavba ponuky

Karty, ktoré zo starej ponuky nikto nevzal, idú lícom dole naspodok svojho
balíčka — Nástroj naspodok **Náradia**, ostatné naspodok **Občanov** (v8.5).
Každý hráč si potom vezme **2 karty z vrchu Náradia a 6 z vrchu Občanov**
(8 kariet; počet od v8.5 nezávisí od starších). Obaja naraz a tajne dajú zo
svojich 8 kariet **4 do ponuky v ľubovoľnom mixe** (0–2 Nástroje) a **4 naspodok**
— každú naspodok jej balíčka, lícom dole (súper nevidí, čo hráč odhodil). Keď
vyberú obaja, karty do ponuky sa odhalia. Balíčky si hráči nepodávajú. Ponuka má
8 kariet, polovicu od každého.


**Keď balíček nestačí** (výklad Leadera 2026-10-30, Michal potvrdil 2026-11-10): chýbajúce
karty sa vezmú z druhého balíčka (obranca berie prvý). Keď nestačia ani oba
spolu, každý dostane najviac polovicu toho, čo v nich ostalo, zaokrúhlené nadol
na párne číslo — stavba sa zmenšuje až na nulu a hra beží ďalej bez trestu.

### Branie z ponuky

Hráči berú z ponuky **striedavo, začína obranca** (v9.2, Michal 2026-10-30; útočník
berie druhý), kým obaja neprestanú. Na svojom ťahu hráč vezme:

- **1 kartu za 1 cigaretu**, alebo
- **2 karty za 3 cigarety**.

Kto berie prvý, na **svojom prvom ťahu vezme len 1 kartu** — aby nevykradol ponuku;
všetky ďalšie ťahy oboch hráčov ako vyššie (pri dosť cigaretách teda 1 – 2 – 2 – 2…).

Poldeci sa v ponuke neplatí a nič z ponuky nie je zadarmo. Kto nemá cigaretu, brať
nemôže (hra za neho branie ukončí). Keď jeden prestane, druhý má už len **jednu
poslednú šancu** (jeden ťah), potom branie končí. Prázdna ponuka branie ukončí
obom.

Nevzaté karty ostávajú v ponuke len do ďalšej stavby — vtedy idú naspodok
svojho balíčka (Stavba ponuky, vyššie); medzitým z neho berú Zastávka a Sklad (§15) a Podpora
Predavačky a Živnostníka (§16). Schopnosť väzňa Autobusára (§10) mení samotné branie.
Po braní sa ponuka **doplní na 8 kariet v pomere stavby** (2 : 6): najprv z vrchu
**Náradia**, kým v ponuke nie sú aspoň **2 Nástroje**, zvyšok z vrchu **Občanov**
(v8.5). Čo jeden balíček nemá, doplní druhý; keď sa minú oba, ponuka sa už
nedopĺňa — hra beží ďalej bez trestu.

Počet kariet stavby je **vždy 2 + 6** (N = 8, v8.5); väzni ju nezmenšujú (v9).
Priazeň Fajčiara dáva cigarety od v9 po bitke (§10), nie po braní.

Po braní začína Zhromaždenie (§6).

---

## 6. Zhromaždenie

Hráči striedavo vykladajú karty do línie, **začína útočník**. Na svojom ťahu
hráč vyloží kartu na jeden z dvoch koncov línie (v jednom ťahu aj viac kariet,
§13), prizná kliatby (§11), podloží Nástroj pod kartu v línii alebo ho vyloží
do Dedičstva (§12). Podloženie aj vyloženie Nástroja do Dedičstva sa v striedaní
počíta ako ťah, priznanie nie.

### Línia, konce a kraje

- Karty tvoria **jednu súvislú líniu**, vetvenie nie je povolené. **Lokalita**
  leží v jej strede a delí ju na dva **kraje**, pomenované podľa hrán
  lokality (§15). Línia má dva **konce** a žiaden nepatrí hráčovi. Aj vo finále leží v strede lokalita — pinnacle
  (§14b).
- Kartu vykladáš vždy na **koniec línie** — na ktorýkoľvek z dvoch. Koniec
  určuje len to, kde karta leží a s čím susedí.
- **Vnútorná hrana** karty je tá, ktorá je obrátená k lokalite — ňou sa karta
  páruje so susedom bližšie k stredu (prvá karta kraja s lokalitou).
  **Vonkajšia hrana** ostáva voľná pre ďalšiu kartu. Z pohľadu hráča, ktorý
  kartu zahral: v kraji vľavo od lokality je vnútorná jeho pravá hrana,
  v kraji vpravo jeho ľavá. Web aj klient agentov ukazujú náhľad spoja pred vyložením a ktorá hrana
  lokality je obrátená ku ktorému kraju.
- Karta je vždy **natočená k hráčovi, ktorý ju zahral** (pre súpera je teda
  „nohami hore“, nech leží na ktoromkoľvek konci línie). Ten je jej **majiteľ** a karta je v **jeho partii**:
  **partia hráča = všetky karty natočené k nemu**, nech ležia kdekoľvek
  v línii. Text karty „v tvojej partii“ = medzi tvojimi kartami.
- **Akcie** karty sa rátajú jej majiteľovi. Na spoji sa karta páruje so susedmi bežne: susedova akcia
  sa aktivuje a pripíše sa majiteľovi susednej karty. **Efekty** karty (Nástup, Furt, Bitka, Výhra…) patria majiteľovi.
- **Kraje:** polovice línie sa volajú podľa hrán lokality — každá lokalita má
  vlastné (Krčma: *pri výčape* / *pri dverách*; zoznam v §15). Kraj ani koniec
  línie nepatria nikomu.
- Nástroj sa do línie nevykladá — podkladá sa pod kartu v línii (Náradie, Michal 2026-11-08, §12).
  Kliatba do línie nepatrí.
  Za skrytú Záverečnú ani odpoveď lícom dole sa nepriloží, kým sa neotočí (§7, §13).
- **Konflikt (v11.3):** keď sa karta so spúšťačom Konflikt **priložením** ocitne
  vedľa **súperovej** karty, spustí sa jej efekt — či ju prikladáš ty k súperovej
  karte, alebo súper svoju k nej. **Podpora** je zrkadlo: spustí sa, keď sa
  priložením stretnú **dve tvoje** karty. Oba po Nástupe priloženej karty; podloženie
  Nástroja, NA EX, zrážka ani presun karty ich nespúšťajú (§16).
  **S tagom** („Podpora: Pamätník“, frakcie) sa spustia len pri karte s tým tagom;
  bez tagu („Konflikt: {Pohoršenie}“) pri ktorejkoľvek.
- **Spoločník: tag** platí, kým máš v partii inú odkrytú kartu s tým tagom;
  **Nepriateľ: tag**, kým ju má v partii súper. Raz, aj pri viacerých takých kartách.
- **Akcia navyše** (piktogram v pečati karty) je aktívna akcia majiteľa karty mimo
  jej hrán: do súčtov ide ako tá istá akcia a vyhodnotí sa v jej kroku (pitkové
  v každej Pitke, v ktorej podmienka platí). Pri Spoločníkovi a Nepriateľovi raz,
  kým platí podmienka; pri Podpore a Konflikte za každé spustenie, do konca kola
  (pečať ukáže ×N a šípku k susedovi, s ktorým sa spustila); pri spúšťači **Bitka**
  s podmienkou slovami (Pijan, Svokra, Vymáhač, Šofér, Traktorista, Pasca v Dedičstve)
  toľkokrát, koľkokrát podmienka v bitke platí; pri spúšťači **Pitka** (Výherný automat v Dedičstve,
  v12) Hazard navyše dá v každej Pitke rovno 1 Dlh (nie zadĺženie cez prah); pri spúšťači
  **Furt** bez podmienky („Furt: {A}“, v11.17) raz, kým karta leží odkrytá v línii. Mení ju Náradie
  v Dedičstve a čo mení všetky tvoje akcie toho druhu (Vidly, Valaška, Svätý text, Horoskop,
  Obecný úrad…), **Preškolenie Školiteľa** (nižšie) a **celý podložený Nástroj** (v12, Michal
  2026-11-11: „Chcem, aby aj akcia v efekte, ako napríklad pri Opatrovateľke, sa dala zmeniť
  preškolením alebo Nástrojom. V prípade, ak postava dostane Forsáž, akcia v efekte sa posilní
  tiež.“ — „Áno, celý Nástroj“): akciová hrana ju preškolí v reťazi premien ako akcie hrán, hrana
  posilnenia „Posilnená {X}“ a **Forsáž** karty — zo spoja aj z Energeťáka (zo spoja výklad Leadera
  2026-11-11, Michal nepotvrdil; zrušená NA EX neplatí) — ju zdvoja (×2, každá zvlášť — Puška aj
  Energeťák ×4). Na spoji nie je, preto ju Posilnenie suseda, Odpor, NA EX či Silná žena
  nemenia (do v11.21 ju nemenil ani podložený Nástroj). Keď Preškolenie či Nástroj mení akciu, karta,
  ktorej sa týka, ukáže zmenenú akciu na hrane aj v pečati (Michal 2026-11-08), posilnenú s ×N.
  Skrytá Záverečná podmienku nesplní ani akcie navyše nedostane.
- **Spálenie v pečati** (Krokodíl, v11.17, Michal 2026-11-09): „Konflikt: Občan {Spálenie}“ — piktogram
  Spálenie nie je akcia. Karta, s ktorou sa nositeľ priložením stretne (pri Konflikte súperova, pri
  Podpore tvoja; s tagom za dvojbodkou len karta s tým tagom), sa **na konci bitky spáli** (krok 6c, §9): navždy z hry, do balíčka sa nevráti.
  Jej akcie v bitke ešte platia. Nástroj pod ňou ide tomu, kto ho podložil (§12); presvedčený starší je
  nezničiteľný (§10). Nositeľ lícom dole ani umlčaný Mäsiarom (stav na konci bitky) nespáli nič.
- **Preškolenie Školiteľa** (Michal 2026-11-08, docs/napady/obcania-kategorie.json): Občan
  alebo **Zviera** (v11.16; Starešina nie) s efektom „Spúšťač: Preškolenie {X}→{Y}.“ preškolí akciu X **inej** karty na Y — tá sa ráta
  ako Y pre majiteľa tej akcie (komu by patrila X), ešte **pred spojmi**: páruje sa, posilňuje,
  ruší a dostáva NA EX na mieste X, do súčtov ide ako Y. Platí pre obe hrany dotknutej karty
  aj jej akcie navyše; počet akcií sa nemení. Dosah podľa spúšťača:
  **Furt** — obaja susedia Školiteľa v línii (karty oboch hráčov), kým s ním susedia; karta sama
  ani hrana lokality nie; lícom dole ako ostatné Furt efekty akcií (Kapybara od v12; Vedúcko do
  v11.17). **Podpora** — tvoja karta, s ktorou sa Školiteľ stretne priložením (oboma
  smermi), do konca kola, aj keď sa potom rozídu (Vedúcko, Sypač, Anonymný alkoholik).
  **Konflikt** — súperova karta, s ktorou sa stretne priložením, do konca kola (Profesionálny tipér). Pri každom spustení
  ďalšia karta; tá istá karta druhý raz nič nové. **Premeny sa reťazia** (v11.20, Michal 2026-11-10:
  „Reťazia sa“, „Áno, reťazí sa všetko.“): na tej istej karte platia všetky, v poradí **najprv Školitelia**
  — Podpora a Konflikt v poradí spustenia, potom Furt (z dvoch susedov skôr ten bližšie k lokalite:
  karty sa prikladajú na koniec línie, takže ležal skôr) — **potom Nástroje pod kartou** (len hrany,
  §12) v poradí podloženia. Každá premena pracuje na výsledku predošlej: Podpora {Rana}→{Pecka}
  a po nej Konflikt {Pecka}→{Petelica} dajú z Rany Petelicu, v opačnom poradí ostane Pecka; Sypač
  {Rana}→{Pecka} a pod kartou Valaška {Pecka}→{Petelica} dajú z Rany Petelicu, Nástroj {Pecka}→{Rana}
  Ranu vráti. Premena, ktorej X predošlé už zmenili, ho nenájde; reťaz, ktorá sa vráti na pôvodnú
  akciu, nič nemení. X ani Y nie je Posilnenie, Odpor ani Pakt. Pravidlá Preškolenia Michal potvrdil
  2026-11-10.
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
| Odpor + X | X je zrušená a Odpor sa deaktivuje (v12.1) |
| Odpor + Odpor | **Vzbura** (v11.1): obe karty sa **obrátia** — nespojené akcie sú aktívne, spojené neaktívne; lokalita len hranu pri tom kraji, nie obe |
| Posilnenie + Odpor | **Vzbura iba karty s Odporom** (v11.1): obráti sa a jej aktívne akcie sú posilnené (×2); Posilnenie je zrušené, karta s ním nič nedostane |
| Posilnenie + Posilnenie | **Forsáž** (v10.3): obe karty majú **všetky svoje aktívne akcie posilnené (×2)**; lokalita len hranu pri tom kraji |

Podložený Nástroj (§12) a Školiteľ (Preškolenie, vyššie) preškolia akcie karty **ešte pred
spojmi** — na spoji sa páruje už preškolená akcia — a Vidly, Energeťák, Vínko a Injekcia dávajú
karte Vzburu, Forsáž, NA EX a Výtržníka v poradí nižšie.

**Odpor** (v12.1, Michal 2026-11-11: „Odpor bude aktívny LEN vtedy, keď nie je spojený s inou
akciou, a bude dávať ‚NA EX‘ štít ako dáva teraz. Bude aj naďalej rušiť akciu, s ktorou sa spojí, a
zároveň sa deaktivuje aj Odpor.“): nespárovaný Odpor je **aktívny** a kartu chráni pred NA EX (§7);
na spoji zruší partnera a **zhasne** (neaktívny). NA EX ho nechá tak.

Keď NA EX zruší Posilnenie, zruší aj ×2, ktoré dávalo partnerovi na spoji. Odpor NA EX nemení —
akcia, ktorú Odpor ruší, ostáva zrušená (v12.1; v11.17–v12 ožila). Nespárovaný Odpor či neaktívne
Posilnenie karty s NA EX sa spáruje s poldecom — Odpor NA EX zahasí, Posilnenie mu nedá zrušiť
aktívne akcie (§7).

**Vzbura** (v11.1, Michal 2026-11-02: „Majú sa aktivovať akcie naopak, nie aktivovať všetky.“) —
podrobne:

- Karta so Vzburou má **aktívne práve nespojené akcie** (×1) — na oboch svojich stranách, aj na
  vonkajšej hrane bez suseda. **Spojené akcie sú neaktívne**, aj tie, ktoré by zdvojilo
  Posilnenie suseda či Zrkadlo. Pakt spojený s akciou je tou akciou, teda neaktívny; nespojený
  Pakt nič nedá.
- Spoj Odpor–Odpor sám nič nedá: oba Odpory sa vyrušia (do súčtov sa nerátajú; pri lokalite sa
  Odpor hrany do Pitiek ráta ako doteraz).
- **Modifikátory karty na jej ďalších spojoch pôsobia ďalej**: jej Odpor ruší partnerovu akciu,
  jej Posilnenie zdvojí partnera, jej Posilnenie proti Posilneniu dá Forsáž. Vzbura mení len to,
  čo karta dáva svojmu majiteľovi, nie susedov.
- Akcia **zrušená Odporom** ostáva zrušená. Spojená akcia pod Vzburou nie je zrušená, len
  neaktívna — Policajtka za ňu zadĺženie nedá. Puška sa pod Vzburou neuplatní (prepojená Petelica by bola neaktívna).
- **Odpor proti Posilneniu** (Michal 2026-11-02: „Ak je Odpor spojený s Posilnením, vznikne Vzbura, ale len pre kartu, na ktorej je Odpor, jej
  akcie sa aktivujú naopak, ale sú posilnené. Ďalšie pravidlo – na karty so Vzburou – či už
  Odpor/Odpor alebo Odpor/Posilnenie – sa nedá dať NA EX.“) je Vzbura
  **len karty s Odporom**: obráti sa ako pri Vzbure a **všetky jej aktívne akcie sú posilnené (×2)**.
  Karta s Posilnením sa neobráti a jej Posilnenie je zrušené. Zdvojenie je raz, aj keď má karta
  takéto spoje dva; s Forsážou na druhom spoji sa násobí (×4). Posilnenie suseda na spojenú akciu
  nič nepridá — spojená je neaktívna. NA EX, ktorý zruší Posilnenie partnera, zruší aj toto
  zdvojenie (ako ×2 partnerovi, §7); obrátenie ostáva.
- **NA EX nemožno dať na kartu so Vzburou** (oboch druhov, §7).
- **Poradie:** preškolenie (podložený Nástroj, Školiteľ) → spoje → Vzbura (obrátenie, aj z Vidiel) →
  Výherné žreby → **Forsáž zo spoja** a posilnenie Vzbury (zdvojí akcie aktívne po
  obrátení, teda nespojené) → NA EX (aj z Vínka) → **Forsáž Energeťáka a hrana posilnenia
  Nástroja** (na akcie aktívne po NA EX, v11.21) → Dedičstvo Pušky → efekty kariet (Silná žena, Liberál, Pes…)
  → Výtržník (zrážka aj Injekcia). NA EX na karte so Vzburou leží len vtedy, keď Vzbura vznikla až po výbere
  (rozhoduje stav v okamihu výberu, §7) — potom pôsobí ako vždy: aktívne po obrátení zruší,
  neaktívne zdvojí.
- Pri lokalite sa obráti len hrana pri tom kraji. Odpor
  Praudovravca ako Posilnenie (Dezinformátor, v7) má len stará sada. Posilnenie a Odpor **Výtržníka** sú Rany — Vzburu nevyvolajú (§7).
- **Vzbura z Vidiel** (podložený Nástroj, §12) je tá istá Vzbura: karta sa obráti ako pri Odpore
  proti Odporu; keď má Vzburu aj zo spoja, obráti sa raz.

**Forsáž** (v10.3, Michal 2026-11-02) — podrobne:

- Karta s Forsážou má posilnené **všetky** svoje aktívne akcie, nielen tie na spoji — aj zlé
  (Hazard, Poškodenie pečene), ako Posilnenie — a od v12 aj **akcie navyše** v pečati (×2;
  výklad Leadera 2026-11-11, Michal nepotvrdil). Akcia, ktorú navyše posilňuje Posilnenie suseda
  z druhého spoja, má **×4**. Násobky sa násobia ďalej (Silná žena, Liberál, Pes…).
- Akcie aktívne po **Vzbure** (nespojené, v11.1; aj aktivované Výhernými žrebmi) Forsáž zdvojí
  tiež; spojené akcie karty so Vzburou sú neaktívne, tie nezdvojí. Vzbura z Odporu proti
  Posilneniu a Forsáž na tej istej karte sa násobia (×4).
- **Pakt** proti Posilneniu je Posilnenie, teda tiež Forsáž.
- **NA EX** na jednu z kariet spoja zruší jej Posilnenie, a tým aj Forsáž — obom kartám
  (rovnaký princíp ako „NA EX zruší aj ×2 partnerovi“, §7). Energeťák a Veterán to zastavia
  ako dnes, rovnako neaktívne Posilnenie či nespárovaný Odpor tej karty (v11.17, §7). Ostatné akcie karty
  NA EX ruší a zdvojuje ako vždy.
- Posilnenie a Odpor **Výtržníka** sú Rany (§7), Forsáž teda nevytvoria.
- **Forsáž z Energeťáka** (podložený Nástroj, §12) sa neviaže na Posilnenie: NA EX ju nezruší.
  Uplatní sa **až po NA EX** (v11.21) na akcie, ktoré sú aktívne potom: aktívne NA EX zruší,
  neaktívne aktivuje ×2 a Forsáž ich zdvojí na ×4. So spojovou Forsážou či Vzburou z Odporu
  proti Posilneniu sa násobí (×4).

### Prevaha a akcie lokality

Hranu lokality aktivuje karta, ktorá s ňou tvorí spoj, no jej akcie dostane
hráč s **prevahou** v tom kraji: kto tam má **viac svojich Občanov, Zvierat
a Starešinov** (Nástroje, Cirhóza ani iné karty sa nerátajú; Dvojčatá za
dvoch, §16). Pri rovnosti má prevahu hráč, ktorého karta v tom kraji leží
**hneď pri lokalite** (vyložená ako prvá). Jedna súperova karta v kraji teda
**neukradne akcie hrany**, ale tvorí s nimi spoj: ako prvá karta pri lokalite
určuje, ktoré akcie hrany sa aktivujú, a tie potom dostane hráč s prevahou —
o akcie treba v kraji prevládnuť. Natočenie lokality (volí obranca) určuje,
ktorá hrana leží pri ktorom kraji.

### Limit vykladania

```
limit vykladania = plné poldeci        (v12.2)
```

- **Každá karta do línie otočí jeden plný poldeci na vypitý** (v12.2, Michal 2026-11-11: „Za každú kartu,
  ktorú vyložia, sa im otočí jeden poldeci z plného na vypitý.“) — aj Záverečná (§13), podstrčená karta
  a karta na súperovej strane (míňa poldeci **hráča, ktorý ju zahral**, aj Kočovník). Bez plného poldeci sa
  nevykladá; kto nemá čo vyložiť, za toho hra pasuje.
- Vypité (otočené nadol) poldeci sa **nerátajú**.
- **NA EX je mimo vykladania**: dáva sa v Pitke, nie v Zhromaždení. Jeho plný poldeci však odíde
  zo zásoby na kartu a do limitu sa už **neráta** — ďalšie Zhromaždenie toho istého kola má limit o 1 nižší
  (súperov sa nemení). Pri bitke sa poldeci vypije a potom obnoví s ostatnými (§9.5).
- **Priznanie** (§11) ani **Nástroj** (podloženie aj Dedičstvo, §12) poldeci nemíňajú (Michal: „Náradie, či
  už priznané alebo umiestnené pod postavu, nemíňa poldeci.“) a cenu ťahu nezvyšujú (§13).
- **Družstvo** (§15): karty s akciou Robota nestoja poldeci.
- Každá ďalšia karta v tom istom ťahu stojí okrem poldeci aj **cigaretu** (Vypiť, §13).
- Zmena plných poldeci sa v limite prejaví hneď: **Degustátorka** (§16), ktorá súperovi vyžerie plný
  poldeci, mu limit hneď zníži; **Vínko** do Dedičstva (§16), Krčmárka (§10) a barter limit hneď zvýšia.
- **Po bitke sa všetky poldeci obnovia na plné** (§9.5), **po každej Pitke sa doleje 1 vypitý zadarmo**
  a ďalšie za aktívne akcie Poldeci (§7). Iné doliatie nie je — doliatie za cigarety zaniklo (v12.2).
- **Maximum poldeci** = 3 + nové poldeci z barteru, Krčmárky a Vínka (výklad v12.2: plné + vypité + ležiace
  na kartách cez NA EX).
- Už vyložené karty sa nikdy nevracajú.

### Pas a koniec Zhromaždenia

Zhromaždenie končí, keď obaja pasujú (alebo za nich pasuje hra).

**Pas:** kto pasuje, do najbližšej Pitky už nevykladá (súper vykladá sám) a dostane **1 cigaretu za každý
plný poldeci** (v12.3, Michal 2026-11-11: „Keď hráč pasne, dostane toľko cigariet, koľko má nevypitých
poldeci.“). Poldeci sa tým nevypijú — ostanú plné na NA EX a ďalšie Zhromaždenie kola; kto pasuje aj v ňom,
dostane cigarety znova. Ráta sa počet plných poldeci v okamihu pasu (Vínko len cez poldeci, ktorý pridá).
Cigarety za pas nie sú z Pitky — Obecný úrad ich nezdvojuje (§15). Pasovanie ruší aj nevyužité ťahy
navyše z Vypiť. Kto v Zhromaždení nemá čo vyložiť (nemá plný poldeci ani kartu, ktorú smie dať, kliatbu na
priznanie ani Nástroj, na ktorý má cigarety), za toho hra pasuje a cigarety za plné poldeci dostane tiež
(fajčiť sa v Zhromaždení nedá, §7). **Záverečná** (§13) ukončí vykladanie ako pas, ale cigarety za ňu nedá;
vynútený pas **Vychovávateľky** (§10) tiež nie.

---

## 7. Pitka

Pred každou Pitkou je Zhromaždenie (§6); počet Pitiek v kole určuje lokalita
(nižšie).

### Poradie: Pitka naraz, odpovede lícom dole

Pitku hrajú **obaja hráči naraz** (Michal 2026-10-27): každý fajčí, dolieva,
barteruje a **skryto vyberie NA EX** (nižšie), kedy
chce, a skončí sám „hotovo“. Súperove kroky (fajčenie, nákupy) vidno
hneď, jeho NA EX nie. „Hotovo“ je **nevratné** a zapíše sa do logu („Hráč X
končí svoju časť Pitky“); kto skončil, v tejto Pitke už nič nerobí. Keď sú
hotoví obaja, **NA EX sa odkryjú naraz** (v9.2), nasledujú odpovede **lícom dole** —
najprv útočník, potom obranca na druhý kraj línie; obe sa otočia naraz a Pitka sa
vyhodnotí (nižšie). Posledné slovo od v9.2 nemá nikto; **Kohút** je dočasne vyradený
(§16).

**Bzdocha je jediná výnimka:** jej majiteľ **čaká**, kým súper skončí svoju
časť Pitky, a až potom hrá — a vidí súperovo skryté NA EX. Keď má Bzdochu
v partii každý hráč, nečaká nikto (kto skončí neskôr, vidí NA EX toho druhého).

### NA EX

NA EX smie hráč dať **iba v Pitke**, kým ju neskončil, v základe **najviac raz
za Pitku** (Vínna pivnica dvakrát; na Kostole len na kartu na konci línie,
§15). Vyberie jednu kartu
v línii s tagom **Občan alebo Starešina** — **svoju aj súperovu**, kdekoľvek
v línii — a položí na ňu jeden plný poldeci. NA EX vyberá
**skryto**: súper nevidí, či NA EX dal, ani kam (`viewFor` mu to nepošle),
kým sa NA EX neodkryjú.

> NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty, na
> ktorej sa uplatňuje.

- NA EX sa dá len na kartu, ktorá má **aspoň jednu aktívnu a aspoň jednu
  neaktívnu akciu** — nie na kartu bez aktívnej akcie ani na kartu, ktorej sú
  aktívne všetky. Aktívna = spárovaná a nezrušená Odporom; rozhoduje stav
  v okamihu výberu (odpoveď na NA EX už nič nemení). Platí aj pre Veterána.
  **Odpor sa do podmienky neráta vôbec** (v12.1). **Neaktívny Pakt aj neaktívne Posilnenie** sa
  do neaktívnych rátajú (v12.1, Michal 2026-11-11: „Áno, aj Posilnenie“), hoci ich NA EX nezdvojí
  (§2; Posilnenie NA EX podrží, nižšie).
- **Na kartu s aktívnym (nespárovaným) Odporom NA EX nemožno dať** (v12.1, Michal 2026-11-11) —
  Odpor ju chráni (štít, nižšie Poldeci ako partner). Rozhoduje stav v okamihu výberu; na súperovu
  skrytú Záverečnú sa NA EX dá aj tak (bod nižšie).
- **Na kartu so Vzburou NA EX nemožno dať** (v11.1, Michal 2026-11-02) — ani pri Odpore proti
  Odporu, ani proti Posilneniu (§6). Rozhoduje stav v okamihu výberu ako pri podmienke vyššie:
  Vzbura, ktorá vznikne až potom (odpoveď na NA EX, ďalšia karta pred odkrytím), NA EX nezruší.
  Skrytá Záverečná sa neráta — Vzburu s ňou hra zistí až po otočení a súperova skrytá Záverečná
  ostáva cieľom vždy (nič sa nesmie prezradiť); NA EX na nej po otočení ostáva.
- **Akcia zrušená Odporom nie je ani aktívna, ani neaktívna** (v6.1): NA EX na jej
  karte ju nezruší (už zrušená je) ani nezdvojí, a pri výbere karty sa nepočíta ani do
  aktívnych, ani do neaktívnych. NA EX na karte s Odporom ju neoživí (v12.1).
- Na kartu, na ktorej **už poldeci leží** (z predošlej Pitky kola alebo z tvojho
  skrytého NA EX), sa ďalšie NA EX dať nedá. Súperovo skryté NA EX nevidíš —
  obaja tak môžete vybrať tú istú kartu (zrážka, nižšie).
- **Podložený Nástroj** (§12): na kartu s Vínkom (NA EX bez poldeca) ani na kartu s Injekciou
  (Výtržník) sa NA EX dať nedá; karta s Vidlami má Vzburu (bod vyššie).
- Na súperovu skrytú **Záverečnú** sa NA EX dá vždy a skryté Záverečné sa do
  posúdenia susedov nerátajú — nič sa nesmie prezradiť (§13).
- Akcie karty po NA EX sa rátajú jej majiteľovi: na súperovej karte mu zrušíš
  aktívne akcie, ale zdvojíš mu neaktívne. Kliatby, ktoré karta po NA EX
  vyprodukuje (zdvojený Hazard či pečeň), patria majiteľovi karty — NA EX zruší
  aktívne akcie (aj vlastný Hazard či pečeň) a zdvojí neaktívne.
- **NA EX na kartu pri lokalite** ruší a zdvojuje len akcie tej karty — akcie
  **hrany lokality** v páre s ňou ostávajú aktívne (dostane ich hráč
  s prevahou v kraji); jediná zmena je ×2 od Posilnenia karty (nasledujúci bod).
- **NA EX na kartu s Posilnením** zruší Posilnenie aj **×2, ktoré dávalo
  partnerovi** na spoji: partnerova akcia (aj akcia hrany lokality) ostáva
  aktívna, ale už len ×1. Veteránovi NA EX Posilnenie nezruší, takže partner má
  ×2 ďalej. Ak Posilnenie tvorilo **Forsáž** (§6), zanikne aj tá — obom kartám spoja.
- **NA EX na kartu s Odporom na spoji** (v12.1, Michal 2026-11-11) Odpor **nechá tak** —
  neaktivuje ho, nezdvojí ani nezruší: akcia, ktorú Odpor ruší, ostáva zrušená, spoj Odpor
  proti Odporu ostáva Vzburou. Ostatné akcie karty NA EX obráti ako zvyčajne a štít sa po NA EX
  neobjaví. (v11.17–v12 NA EX Odpor zrušil a partner ožil ×1.)
- **Partner zrušenej akcie** na spoji (akcie, ktorú NA EX zrušil) ostáva **aktívny ×1**
  — spoj zaniká len pre zrušenú akciu. Pri Posilnení prichádza o ×2 (bod vyššie).
- **Poldeci ako partner** (v11.17, Michal 2026-11-09; docs/napady/naex-odpor-posilnenie.html,
  P2 v miernejšej podobe): nespárovaný Odpor či neaktívne Posilnenie karty s NA EX nemá partnera
  na spoji — dostane ho v podobe poldeca:
  - **Aktívny (nespárovaný) Odpor NA EX zahasí** — Odpor ruší, čo má oproti sebe. Karta sa ráta ako
    bez NA EX; poldeci sa aj tak vypije a NA EX sa ráta ako dané (pečeň, nerest, Pijan,
    Svokra, Šofér). Takto môže NA EX ležať len na súperovej skrytej Záverečnej alebo z Vínka
    (na kartu so štítom NA EX dať nemožno, vyššie). Keď sa Odpor neskôr spáruje (odpoveď,
    karta k vonkajšej hrane), štít padne a NA EX platí od najbližšieho vyhodnotenia.
  - **Neaktívne Posilnenie NA EX podrží**: NA EX **nezruší aktívne akcie** karty (ani jej
    Posilnenie na spoji, takže partner má ×2 a Forsáž ostáva), neaktívne zdvojí ako vždy
    (×2, nie ×4). Dve neaktívne Posilnenia platia raz.
  - Keď má karta oboje, **vyhrá Odpor**. Nespojené Posilnenie karty so Vzburou je aktívne (§6) —
    štítom nie je; nespojený Odpor je aktívny vždy a štít dáva aj pod Vzburou (v12.1, výklad Leadera). Veterán: Odpor NA EX zahasí aj jemu (aktívne mu nezdvojí);
    Posilnenie na ňom nič nemení. Rovnako pre NA EX z Vínka (§12). Výtržník (zrážka, Injekcia)
    štít nemá — jeho Odpor a Posilnenie sú Rany.
- NA EX leží na karte až do bitky — jej akcie sa vyhodnotia v **každej** Pitke
  kola.
- Poldeci **ostáva hráča, ktorý NA EX dal**: do limitu sa neráta (§6) a pri
  bitke sa vypije (§9.5). Poškodenie pečene z NA EX sa počíta **pri odkrytí**,
  ešte v tej Pitke, a pripíše sa tomu, kto NA EX dal (poldeci pije on). NA EX
  je nerest (§8).
- Na **Krčme** hráč s plným poldeci (a kartou, kam ho dať) musí NA EX dať,
  inak Pitku neskončí; prah Cirhózy je tam zato obom o 2 vyšší (§15). Povinnosť
  splní **jedno** NA EX v Pitke; ďalšie je potom dobrovoľné.
- Efekty okolo NA EX: Kar (pečeň súperovi) sa uplatní pri odkrytí; Stryná pri vyhodnotení; Svokra, Pijan a Šofér
  v bitke; Veterán (§16).

### Odkrytie NA EX a Výtržník

Keď skončia obaja, NA EX sa **odkryjú naraz** (v9.2, Michal 2026-10-30) — oba
poldeci ľahnú na karty súčasne. Až teraz sa pripíše pečeň a uplatnia sa efekty okolo
NA EX. Výsledok od poradia nezávisí (zrážka je súmerná, pečeň sa ráta po hráčoch).

**Zrážka:** ak obaja vybrali **tú istú kartu**, ležia na nej poldeci oboch
a z karty je **Výtržník**. Karta sa najprv spáruje so susedmi s pôvodnými
akciami (susedom aktivuje akcie ako bez zrážky), potom sa **všetky akcie na
jej hranách** zmenia na aktívnu **Ranu** pre jej majiteľa — aj akcie bez
partnera na spoji. NA EX jej nič neruší ani nezdvojuje. **Posilnenie aj Odpor
Výtržníka sú už len Rany** (v6.1, Michal 2026-10-27): suseda nezdvojujú ani
nerušia (ani pri Veteránovi) — sused má spárovanú akciu aktívnu ×1 a Odpor
Výtržníka nevyvolá Vzburu. **Rany Výtržníka platia vždy ×1** (Michal 2026-11-06):
nezdvojuje ich Furt efekt Silnej nezávislej ženy, keď s ňou susedí, ani iný násobok
karty. Každý platí za svoje
NA EX ako vždy: pečeň +1 tomu, kto NA EX dal,
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
z ruky** na ktorýkoľvek koniec línie — **lícom dole, štýlom Záverečnej** (v9.2, Michal
2026-10-30). **Odpoveď stojí plný poldeci** (v11.16, Michal 2026-11-09: „vypiť plný na
vypitý“): hráč ho pri odpovedi otočí na vypitý ako pri Vypiť (§13) — dostane **+1
poškodenie pečene** (prah Cirhózy sa skontroluje hneď, sme v Pitke; na Kare ju nedostáva
súper, Kar presúva len pečeň z NA EX) a ráta sa mu **1 nerest** (§8). Vypitý poldeci
sa doleje po Pitke či obnoví po bitke ako každý iný (§7, §9.5).

1. Najprv **útočník** (na NA EX obrancu) vyloží odpoveď lícom dole na jeden kraj línie.
2. Potom **obranca** (na NA EX útočníka) lícom dole — **len na druhý kraj línie**, než
   kam vyložil útočník. Keď útočník neodpovedal, obranca smie na ktorýkoľvek kraj.
3. Obe odpovede sa **otočia naraz** — až vtedy sa vyhodnotí ich Nástup, Konflikt a Podpora,
   ktoré vyvolali priložením — a Pitka sa vyhodnotí.

Odpoveďou hráč v tejto Pitke končí s vykladaním. Kým odpoveď leží lícom dole, súper
z nej nevidí nič a odhad bitky ju nezarátava (ako Záverečnú, §13). Keď NA EX dali obaja
(aj pri zrážke), odpovedajú obaja. Odpoveď limit vykladania nemíňa; kto nemá kartu,
ktorú smie vyložiť, **alebo nemá plný poldeci**, neodpovedá.

**Výklad (Developer 2026-10-30, Michal potvrdil 2026-11-10):** viac súperových NA EX v Pitke
(Vínna pivnica) = viac **kôl odpovedí** — v každom kole najviac jedna odpoveď každého
v poradí útočník, obranca na druhý kraj; kolo sa otočí, potom ďalšie (za kartou lícom dole
sa priložiť nedá). Kto odpoveď vynechá, v tejto Pitke už neodpovedá. Bzdocha skrytú
odpoveď nevidí (týka sa len NA EX). Cieľ: spárovať neaktívne akcie karty s NA EX — tie sa tým stanú
aktívnymi a NA EX ich zruší. Počas odpovede sa nefajčí ani nedáva NA EX.
Odpoveď je bežné vyloženie: smie zmeniť **prevahu v kraji** aj **počet
Pitiek**. Po odpovediach sa Pitka vyhodnotí.

### Fajčenie, barter a doliatie po Pitke

- **Fajčenie (len v Pitke):** kým hráč svoju časť Pitky neskončil, smie fajčiť — hneď
  si dobere kartu, ťah mu neskončí. **Cena rastie** (Michal 2026-10-27): prvé
  fajčenie hráča v Pitke stojí **1 cigaretu**, druhé **2**, tretie **3** atď.;
  každá Pitka začína znova od 1 a každý hráč má počítadlo zvlášť (je verejné).
  Nie je to strop — fajčiť sa dá stále, len drahšie. Každá vyfajčená cigareta
  je nerest (§8), teda druhé fajčenie 2 neresti. **V Zhromaždení sa nefajčí.** Keď sú doberací aj odhadzovací balíček
  prázdne, **fajčiť sa nedá** — cigareta by nedala kartu. Na Benzínke je každé
  fajčenie o 1 cigaretu lacnejšie — prvé v Pitke zadarmo, druhé 1, tretie 2 (v11.15, §15).
- **Stokársky barter, 5 cigariet** (počas Pitky) → nový plný poldeci navyše — **maximum +1 natrvalo**,
  po každej bitke sa obnoví aj ten (v12.2).
- **Doliatie po Pitke** (v12.2, Michal 2026-11-11: „Každú Pitku sa im resetne 1 poldeci z prázdneho na plný
  + aktívne akcie Poldeci.“): na konci každej Pitky (krok 9 nižšie) sa hráčovi otočí **1 vypitý poldeci
  zadarmo** a 1 za každú jeho aktívnu akciu Poldeci v línii — najviac toľko, koľko má vypitých.
  Jogurt v Dedičstve doleje o 1 viac, súperova Izolačka o 1 menej za každé jej majiteľove aktívne Obmedzenie
  (§16). Doliatie za 2 cigarety zaniklo (v12.2).
- Po bitke sa obnovia všetky poldeci (§9.5); čo po finále ostane, sa vykúpi: plný poldeci 1 špak,
  každých celých 5 cigariet 1 špak (výkupné, §14).

### Vyhodnotenie Pitky

Po „hotovo“ oboch hráčov:

1. **NA EX** — odkrytie a odpovede (vyššie).
2. **Dlh** — za **každú aktívnu akciu Hazard** hráč získa Dlh (počítadlo, §8).
3. **Poškodenie pečene a Cirhóza** — za **každý celý prah** pečene hráč získa
   Cirhózu do odhadzovacieho balíčka (§8).
4. **Obmedzenie**
5. **Cigarety** — hráč dostane cigarety za akcie Cigareta:
   ```
   nové cigarety = Cigarety − súperove Obmedzenia (najmenej 0)
   ```
   Na Obecnom úrade sa nové cigarety aj Dlhy z Pitky rátajú dvakrát (§15).
   Priazeň Fajčiara dáva cigarety po bitke (§10, v9), nie v Pitke.
6. **Ťahanie kariet** — Pitka sama karty nedáva; doberajú sa fajčením,
   Víziou a efektmi (Zastávka po prvej Pitke).
7. **Vízia** — za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho
   doberacieho balíčka (keď sa doberací balíček minie, odhadzovací sa
   zamieša a stane sa z neho nový doberací balíček)
   a rozhodne: **do ruky**, alebo **spáliť** (navždy z hry). Rozhoduje obranca,
   potom útočník; vrchnú kartu vidí len
   on.
7b. **Zberný dvor** — každý hráč smie spáliť 1 kartu z ruky, nie kliatbu; rozhoduje
   obranca, potom útočník (§15).
8. **Otočenie Záverečných** — karty lícom dole sa otočia; ich Nástup
   a Konflikt či Podpora, ktoré priložením vyvolali, sa vyhodnotia teraz (§13).
9. **Doliatie** (v12.2) — každému sa otočí 1 vypitý poldeci zadarmo a 1 za každú jeho aktívnu akciu
   Poldeci v línii (aj z otočených Záverečných); Jogurt +1, súperova Izolačka −1 za každé aktívne Obmedzenie.

Násobky akcií sa **násobia**: NA EX zdvojí neaktívnu akciu, Silná žena ju
zdvojí tiež, spolu ×4 (aj pri Dlhu a Poškodení pečene). Klient aj konzolový
klient ukazujú výhľad „po Pitke“ (`nahladPitky` — ten istý výpočet ako
vyhodnotenie, `prirastkyPitky`).

Po vyhodnotení Pitky sa **pečeň oboch hráčov vynuluje** — zvyšok pod prahom
sa do ďalšej Pitky neprenáša.

### Počet Pitiek

Pitiek v kole = **1 + menší z počtov aktivovaných akcií lokality** v jej
dvoch krajoch. Akciu lokality aktivuje karta, ktorá s ňou tvorí spoj; ráta sa
každá aktívna akcia hrany (aj Odpor či Posilnenie v páre). **Odpor na hrane
lokality** sa ráta ako jej aktívna akcia; akcia hrany, ktorú zrušil **Odpor
karty** v páre, sa neráta.

Príklad: v jednom kraji sú aktivované 3 akcie lokality, v druhom 1 →
**2 Pitky**; keď je v niektorom kraji 0, kolo má 1 Pitku. Ráta sa **podľa
krajov, nie podľa hráčov**: nezáleží na tom, kto kartu zahral (aj súperova
karta aktivuje hranu kraja, kde leží), ani kto má v kraji prevahu. Akcia
hrany zdvojená Posilnením (×2) je stále **jedna** aktivovaná akcia. Pred každou Pitkou je Zhromaždenie
(limit sa ráta nanovo, začína útočník). Počet sa prepočítava s líniou počas
kola (vykladanie, odpoveď, NA EX); už začatá Pitka sa vždy dopije. Lokality
majú na každej strane 1–4 akcie (úroveň), teda 1–5 Pitiek; aj finále na
pinnacle.

---

## 8. Pečeň, Dlh, nerest, Chuť a Absťák

Pečeň **žije len v Pitke**: ráta sa počas Pitky, vyhodnotí sa v jej krokoch
2–3 (§7) a po Pitke sa vynuluje. **Milujúca manželka** v línii: tvoje poškodenie
pečene v Pitke je o 1 menšie (za každú).

### Hazard a Dlh

Každá aktívna akcia **Hazard** (kľúč `Dlh`) dá v Pitke **1 Dlh**. Efekt „získa
1 zadĺženie“ (Policajtka, Podvodník) dá rovnako 1 Dlh.

**Výherný automat** v Dedičstve je jediná výnimka: tvoj prah Dlhu je 2, takže Hazard
a efekty kariet plnia **zadĺženie** a Dlh dostaneš za každé 2. Zvyšok ostáva na účte
do ďalšej Pitky aj kola (v7, D6). Sám automat ti v **každej Pitke** dá rovno **1 Dlh**
(„Pitka: {Dlh}“, v12; Obecný úrad ho zdvojí):

```
bez Výherného automatu   8 Hazardov = 8 Dlhov
s Výherným automatom     5 Hazardov = 2 Dlhy, 1 zadĺženie ostáva na účte; + 1 Dlh z automatu
```

Dlh je od v8.2 (Michal 2026-10-30) **počítadlo priznaných Dlhov**, nie karta:
nový Dlh je hneď priznaný, neťahá sa a nedá sa s ním inak manipulovať — len
ho presúvajú a pália efekty (§11).

### Pečeň a Cirhóza

Poškodenie pečene pridávajú akcie Poškodenie pečene a Poldeci, NA EX (tomu,
kto ho dal, pri odkrytí), poldeci vypité v predošlom Zhromaždení (Vypiť, §13 — pripíšu sa
do najbližšej Pitky) a poldeci vypitý za odpoveď na NA EX (v11.16, §7 — hneď). Za **každý celý prah** pečene hráč získa Cirhózu:

```
prah Cirhózy = 3   (+2 Nealko v Dedičstve, +2 obom v kole o Krčmu)
```

Nová Cirhóza ide do **odhadzovacieho balíčka** hráča (§11).

### Nerest, Chuť a Absťák (v9.1)

Michal 2026-10-30 (docs/napady/abstak-3.html, § Rozhodnutia): Absťák je závislosť
vlastného tela — kto si zvykne, musí pokračovať.

**Nerest je len konzumácia:**

| Čo | Neresti |
|---|---|
| každá karta navyše v ťahu Zhromaždenia (Vypiť, §13; prvá karta nie) | 1 |
| odpoveď na NA EX (plný poldeci sa vypije, v11.16, §7) | 1 |
| **NA EX** (poldeci sa vypije v bitke; každé NA EX hráča, pri zrážke Výtržníka každý za svoje) | **2** |
| vyfajčená cigareta (za každú zaplatenú — druhé fajčenie v Pitke 2, na Benzínke 1 atď.; fajčenie zadarmo na Benzínke nič) | 1 |

**Nie sú nerest:** poldeci za prvú kartu ťahu, doliatie po Pitke, obnova po bitke, barter, ponuka,
Záverečná, Dedičstvo, akcie Cigareta a Poldeci.

**Chuť** je verejné počítadlo hráča, na začiatku hry **0**. **Na konci kola**
(po bitke a návrate kariet; po poslednej bitke hry nie),
pre každého hráča:

1. ak mal v kole **menej nerestí, než je jeho Chuť** → dostane **kartu Absťák**
   do svojho **odhadzovacieho balíčka** (rovnosť nič),
2. potom **Chuť = väčšie z (Chuť, neresti kola) − 1**, nie pod 0.

Príklad (Michal): 9 nerestí pri Chuti 0 → Chuť 8; ďalšie kolo 7 nerestí → Absťák
(7 < 8) a Chuť 7. Kto prestane, odvyká postupne — každé kolo Chuť klesne o 1, kým
nie je 0. Súper latku neurčuje (do v9 sa neresti porovnávali so súperom).

**Karta Absťák** (tag Kliatba, všetky sloty blokované, bez akcií):

- **nedá sa priznať** ani vyložiť do línie; po bitke ide **z ruky do odhadzovacieho
  balíčka** (ako nepriznaná Cirhóza, §9.7) — hráč si ju ťahá znova namiesto
  užitočnej karty;
- v bitke **−1 tuhé** hráčovi za každú kartu Absťák **kdekoľvek v jeho balíčku**
  (ruka, doberací, odhadzovací, §9.3); remízu v tuhom prehráva, kto ich má viac (§9.4);
- spáliť ju smie len **Vízia** alebo efekt, ktorý to výslovne povie; Hasič ju
  vytiahne ako každú kartu a hráč ju vráti alebo si ju nechá;
- na konci hry nestojí nič (§14) a Pohoršenie nedáva (Nervák zanikol).

Počet Absťákov oboch hráčov je verejný (karta pribúda pred očami oboch), poloha
karty v ruke a doberacom balíčku nie. Hra si pamätá, koľko Absťákov hráč **získal
za hru** (štatistika); spálením karty toto číslo neklesne. Klient ukazuje Chuť,
neresti kola a výhľad (`stavZavislosti`: „Chuť 3 · dnes 1 · chýba 2“).

**Výučba Prvá hra** je bez Chuti a Absťáku (prepínač partie `bezChuti`) — učí sa
až v 2. časti výučby.

---

## 9. Bitka

Bitka sa vyhodnotí po poslednej Pitke kola, v tomto poradí (v11 Strach a reči):

| Krok | Čo sa deje | Kde |
|---|---|---|
| 0 | Efekty na začiatku bitky (od 2026-11-08 žiadne) | §9.0 |
| 1 | Hádka — Viera a Povery sa vyrušia, mäkké (Pohoršenie × 2 + Povery) rozhodne víťaza hádky a jej veľkosť; priazne sa **nemenia** (rozdelí sa až v kroku 4e); Noviny víťaza hádky (v11.5) | §9.1 |
| 3 | Poškodenie — tuhé; zvyšná Viera, Bitkár, Veriaci a Abstinent podľa priazní z rozdielu strachov | §9.3 |
| 4 | Výsledok (pri remíze Absťáky, potom Dlhy — pred exekúciou —, inak sekera) | §9.4 |
| 4a | Špaky za bitku (karty v línii) víťazovi, vo finále aj Nakladačka a hádka 1 : 1, na Kultúrnom dome každému len za svoje karty; víťaz hádky, ktorý bitku prehral alebo je sekera, za svoje karty (v11.11); Herňa podľa Dlhov pred exekúciou; lokalita ide na krčmovú nástenku | §9.4, §14 |
| 4b | **Starší bodujú** (stav pred zdvihnutím): stupne 1 / 2 / 3 dostane, kto ich drží — víťaz za svoj strach bez stupňov, ktoré obsadil súper, obaja pri každej bitke za svoje reči; kto prehral hádku, tomu reči potom klesnú zospodu o stupeň | §10, §14 |
| 4c | **Výhra strachom:** víťaz s červeným strachom u aspoň 4 starších (väzni sa rátajú) vyhráva — hra končí | §1, §10 |
| 4d | Exekúcia (Michal 2026-10-28): Robota (aj z priazne Robota, v9), potom Exekútor každému s priznaným Dlhom — Dlhy a špaky (Advokát ich uberie); Záhradkár ju obíde | §11 |
| 4e | **Nakladačka** — víťaz bitky ju rozdelí na svoj strach a smie **zajímať** (5 bodov za staršieho na červenom strachu už pred touto Nakladačkou, v11.6; väzeň, krádež, výhra väzňami hneď); potom **hádka** — víťaz hádky ju rozdelí na svoje reči na teplomeroch súpera a smie **presviedčať** (3 body pri rečiach na celom teplomere, v11.12) — voľne medzi starších, 1 / 2 / 3 za stupeň, zvyšok prepadne; vo finále sa nerozdeľujú — špaky 1 : 1 dostali v kroku 4a | §9.1, §9.4, §10 |
| 5 | Poldeci | §9.5 |
| 5b | Veštica: výmena kariet balíčkov — len stará sada (dnes má Veštica Spoločník: Pamätník, §16) | §9.5b |
| 6c | **Porazený dostane 1 cigaretu** (pri sekere a po finále nikto), priazne Kmotra (Dlhy súperovi) a Fajčiara (cigarety, v9), **výpalné** z banky (v11.9, v12.4, §10; po finále nie), efekty Výhra a Prehra (Recidivista, Dievčina), Krokodíl | §9.4, §10, §16 |
| 7 | Návrat kariet | §9.7 |
| 7a | Cintorín (porazený si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka, už aj s kartami z tejto línie; v11.13) | §15 |
| 7b | Nepriznaná Cirhóza a Absťák z ruky do odhadzovacieho balíčka | §9.7 |
| 8 | Koniec kola: Chuť a Absťák (v9.1) | §4, §8 |

### 9.0 Efekty na začiatku bitky

Od Občanov v troch kategóriách (Michal 2026-11-08) žiadne: Traktorista dáva od v12 Pecku navyše
s prevahou v jeho kraji (§16; v11.18–v11.21 Dlh bez prevahy na konci poslednej Pitky kola), Šoférova
cigareta zanikla — Šofér dáva Pecku a Ranu navyše (§6). Do 2026-11-08: Traktorista bez prevahy Dlh a
Šofér bez NA EX 1 cigaretu tu.

### 9.1 Hádka (v10, v11)

Michal 2026-11-01 (docs/napady/hadka.html, verzia 4) a 2026-11-02 (v11 Strach a reči,
docs/napady/strach-reci.html). Poškodenie je **tuhé** (Rana, Pecka, Petelica) a **mäkké**
(Pohoršenie, Povera). Popri bitke sa hrá **hádka** len na mäkké. Od v11 **priazne nemení** —
víťaz hádky ju po výsledku bitky rozdelí na **svoje reči** na teplomeroch súpera (§10).

```
1. Viera a Povery sa vyrušia 1 : 1 na kusy
     zrušené_Povery[súper] = min(Povery[súper], Viera[ja])
       Viera[ja] = moje aktívne Viery + Viera navyše z Veriaceho
       Povery[ja] = moje aktívne Povery + Povery navyše z Ohováračky
       jedna akcia Viera zruší jednu akciu Povera — aj vylepšenú Horoskopom (sila 2);
       Svätý text rušenie nemení, hodnota Viery platí len v tlmení tuhého (Michal 2026-11-01)
     Viera, ktorá rušila Povery, sa na tuhé nepoužije
     Čierna mačka: majiteľove Povery sa s Vierou nerušia

2. mäkké[ja] = Pohoršenie × 2 + zvyšné_Povery × sila_Povery
     sila_Povery = 1, s Horoskopom v Dedičstve 2
     Viera proti Pohoršeniu nepomáha; mäkké pridáva z priazní len Ohováračka (cez Povery)

3. víťaz hádky = vyššie mäkké; rovnosť = nikto (remíza, reči nikto nedvíha)
   hádka = |rozdiel mäkkého|          „Ana vyhrala hádku o 3.“
   Telefón v Dedičstve: remízu (nie 0 : 0) vyhráva jeho majiteľ, hádka o 0

4. (krok 4e, po bodovaní starších) víťaz hádky rozdelí hádku na svoje reči
```

**Noviny** (Dedičstvo: Hádka, v11.5): hneď ako sa hádka rozhodne (krok 1), porazený v hádke odhodí za
každé Noviny v Dedičstve víťaza hádky 1 náhodnú kartu z ruky (§16).

**Telefón** (Dedičstvo: Hádka, v11.17, Michal 2026-11-09): remízu v hádke vyhráva hráč s Telefónom
v Dedičstve, **o 0** — reči nedvíha, ale ostatné účinky výhry v hádke platia: porazenému v hádke klesnú
reči (§10), víťaz hádky, ktorý prehral bitku, dostane špaky za svoje karty (§9.4) a spustia sa Noviny.
Remíza **0 : 0** (nikto nemá mäkké) sa neráta — hádka nebola. Majú ho obaja → remíza ostáva.

**Mäkké 2 a 1** (H3, pravidlo Michala): akcia, ktorej je v sade menej, dáva 2 mäkké, tá, ktorej
je viac, 1. V sade je Povier viac ako Pohoršení (v sade v53 25 : 20 na bežných kartách, so staršími
28 : 23; dnes 20 : 14, so Starešinami 21 : 19), preto **Pohoršenie = 2, Povera = 1** (`KONSTANTY.HADKA`). Ak sa pomer akcií
v sade zmení, treba to prepočítať.

**Rozdelenie hádky na reči (krok 4e)** — rovnako ako Nakladačka na strach (§9.4), len na reči na
teplomere súpera (v11.12): víťaz hádky rozdelí jej body **ľubovoľne medzi starších**; stupeň stojí
**do žltej 1, do oranžovej 2, do červenej 3**. Obsadzuje sa v poradí z §10: od vrchu súperovho strachu
nadol, potom nad neho. Rozdelí sa, čo sa dá; **zvyšok prepadne**, aj keď hráč nemá kam dvíhať vôbec
(rozhodnuté 2026-11-02). Pri rozdelení smie víťaz hádky za 3 body **presvedčiť** staršieho, pri ktorom
má reči na celom teplomere (§10 Presvedčenie). Porazený v hádke nerozdeľuje nič. **Vo finále** sa reči nedvíhajú ani nepresviedča:
víťaz hádky dostane za každý jej bod **1 špak** (krok 4a). Rozdelenie je verejné; potvrdí sa jedným
ťahom.

**Veriaci:** Viera navyše z jeho priazne ruší Povery aj tlmí tuhé — tou istou silou (do v10
sa delila na silu pred hádkou a po nej).

**Ohováračka** (v11.10): Michal 2026-11-06: „viera a povery sa navzájom rušia, ako by boli normálne
na akcii karty.“ Povery navyše z jej priazne sa správajú ako Povery z akcií kariet: ruší ich súperova
Viera (z kariet aj z Veriaceho) 1 : 1, Horoskop im dá silu 2 a s Čiernou mačkou sa Vierou nerušia.
Neležia však na karte, preto ich nemení Posilnenie, Odpor, NA EX ani efekty, ktoré menia akcie na kartách.

**Príklad (Ana a Boris):** Ana aktivovala 2 Pohoršenia a 2 Povery, Boris 1 Pohoršenie, 1 Poveru
a 1 Vieru. Borisova Viera zruší jednu Aninu Poveru. Ana: 2 × 2 + 1 = **5 mäkké**, Boris
(Ana Vieru nemá): 1 × 2 + 1 = **3 mäkké**. Ana vyhrala hádku o 2 — po bitke dá napríklad reči
na žltú dvom starším, pri ktorých má Boris strach 0 alebo žltý (1 + 1), alebo na oranžovú pri
staršom s Borisovým oranžovým strachom (2).

### 9.3 Poškodenie

```
1. zvyšná_viera[ja] = moja Viera (s Veriacim) − Viera minutá na Povery (§9.1),  minimum 0

2. tuhé[ja] = (Rana×1 + Pecka×2 + Petelica×3 + súperove priznané Cirhózy + sila Bitkára)
             − zvyšná_viera[súper] × hodnota_viery(súper)
             − max(0, počet_mojich_absťákov − sila_Abstinenta)   (Absťáky v ruke, doberacom aj odhadzovacom balíčku, v9.1; Abstinent v10)
     minimum 0

Bitkár, Veriaci a Abstinent pôsobia silou z rozdielu strachov (§10; hádka ju od v11 nemení). Mäkké do tuhého nevstupuje —
rozhoduje len hádku; celkové poškodenie = tuhé (archív).
```

**Priznaná Cirhóza škodí tomu, kto ju priznal:** za každú priznanú Cirhózu
hráča dostane súper v každej bitke +1 tuhé (Veterinár to znižuje). Ráta sa ako
tuhé, takže ju zvyšná Viera tiež znižuje. Priazeň Bitkára pridá tuhé rovné
sile (+1 / +2 / +3), priazeň Veriaceho Vieru navyše
(§10). **Viera proti Pohoršeniu nepomáha** (v10). Tuhé ďalej menia efekty
kariet a lokalít (Pes, Lesná cesta, Ihrisko…, §15, §16); Rany a Pecky Pijana, Svokry, Vymáhača,
Šoféra, Traktoristu a Pascy sú akcie navyše (§6).

### 9.4 Výsledok

```
víťaz          = vyššie TUHÉ poškodenie
  remíza v tuhom: vyhrá, kto má MENEJ ABSŤÁKOV (kariet v balíčku, práve teraz; znížené o silu Abstinenta, min 0 — v10)
  aj tu rovnosť:  vyhrá, kto má MENEJ PRIZNANÝCH DLHOV
  aj tu rovnosť:  nevyhrá nikto — SEKERA
Nakladačku drží  = víťaz (vyššie TUHÉ; v8.3)
Nakladačka       = |rozdiel tuhého|        (pri remíze v tuhom ju nikto nezíska, aj keď rozhodnú Absťáky či Dlhy)
```

**Špaky za bitku (krok 4a, v8, Michal 2026-10-28):** víťaz dostane **1 špak za
každú kartu, ktorá v čase bitky leží v línii** pri lokalite — v oboch krajoch,
jeho aj súperove, aj odkrytá Záverečná, aj vo finále. Nerátajú sa priznané karty
(kliatby), Dedičstvo, lokalita ani karty, ktoré z línie počas kola zmizli
(spálené efektom — Poľovník, Krokodíl, Dievčina). Počet Pitiek špaky neurčuje.
Víťaz dostane **vždy aspoň 1 špak**. Absťáky špaky **neuberajú** (trestajú ranou
menej, §8). **Víťaz hádky, ktorý prehral bitku** (v11.11), dostane 1 špak za každú svoju kartu
v línii (svoju partiu, nech leží kdekoľvek); víťaz bitky za všetky karty ako vždy, aj keď hádku
tiež vyhral, navyše nič. Vo finále víťaz dostane navyše **1 špak za každý bod Nakladačky** (v9.1,
nižšie). Na Kultúrnom dome (v11.13) dostane každý hráč, aj víťaz, len 1 špak za každú svoju
kartu v línii; víťazovi ostáva aspoň 1 a špaky zo sekery navyše (§15). Víťaz si **lokalitu neberie** —
karta lokality ide na **krčmovú nástenku** s jeho menom a počtom špakov.

**Sekera:** keď nerozhodne ani tuhé, ani Absťáky, ani Dlhy, bitku nevyhrá nikto
a špaky kola (karty v línii) **čakajú na sekere** — vezme ich víťaz najbližšej
bitky navyše k svojim; viac sekier po sebe sa kopí.
**Vo finále** špaky zo sekery **prepadnú**. Pri sekere starší bodujú obom len za reči (krok 4b; hodnota stupňov, ktoré držia),
Nakladačka nie je a **cigaretu nedostane nikto** (nikto neprehral; rozhodnuté 2026-11-02). Víťaz hádky
dostane za svoje karty špaky hneď (v11.11), karty línie sa kvôli tomu z nazbieraného nekrátia; rovnako na Kultúrnom dome. Sekera
nemení roly (útočník ostáva útočníkom); bez Nakladačky sa nezajíma (§10).

**Nakladačka (krok 4e, v11 Strach a reči, Michal 2026-11-02):**

1. **Kto ju drží a rozdeľuje:** víťaz — hráč s vyšším tuhým poškodením. Nakladačka =
   rozdiel tuhého. Pri remíze v tuhom Nakladačka nie je, aj keď bitku rozhodnú
   Absťáky či Dlhy. Do v10 ju rozdeľoval porazený.
2. **Na čo:** na **svoj strach** — ľubovoľne medzi starších; stupeň stojí **do žltej 1,
   do oranžovej 2, do červenej 3** (zo sivej na červenú 6, zo žltej na červenú 2 + 3 = 5); stupeň so súperovými
   rečami **o 1 viac** (v11.12). Vyšší strach ti dáva body v ďalších vyhratých bitkách a cestu k výhre strachom, ale
   **súperovi priazeň** (§10). Keď strach súperove reči prekoná, posunú sa s ním (§10).
3. **Rozdelí sa, čo sa dá:** rozdelenie musí byť úplné — nesmie ostať zvyšok, ktorý by ešte
   stačil na ďalší stupeň niektorého staršieho. **Zvyšok prepadne**, aj keď hráč nemá kam
   dvíhať vôbec (všetky jeho strachy na červenej; rozhodnuté 2026-11-02 — nejde na špaky).
   Nie je to strop zdroja — Nakladačka sa neprenáša.
4. **Kedy:** až **po bodovaní starších, výhre strachom a exekúcii** (kroky 4b–4d) — nový strach
   boduje až v ďalšej bitke.
5. Rozdelenie (Nakladačka aj hádka) je **jeden ťah**: pri ktorom staršom na ktorý stupeň a koho
   zajímaš (Nakladačka) či presviedčaš (hádka).
6. **Zajatie** (v11.4, v11.6, §10): za **5 bodov** Nakladačky smie víťaz zajať staršieho, pri ktorom má
   strach na červenej **už pred touto Nakladačkou** (od minulého kola) — strach dotiahnutý na červenú
   v tom istom rozdelení nestačí. Dobrovoľné, viac naraz smie byť; do „rozdelí sa, čo sa dá“ sa nerátajú. Keď Nakladačka inak nemá kam, ale zajať sa dá, bitka na rozhodnutie počká.

**Nakladačka vo finále → špaky 1 : 1** (v9.1): markery sa vo finále nedvíhajú — **víťaz finále
dostane za každý bod Nakladačky 1 špak** spolu so špakmi za bitku (krok 4a). Pri sekere vo finále
Nakladačka nie je.

**Cigareta porazenému** (v11, krok 6c): porazený dostane po bitke **1 cigaretu**; pri sekere
nikto a **po finále nikto** (Michal 2026-11-02). Do v10 dostal cigaretu za každého staršieho, ktorého mu posunula Nakladačka.

> Napätie hry: každý stupeň tvojho strachu ti v každej vyhratej bitke boduje, ale súperovi dáva
> priazeň (rozdiel strachov) a miesto na reči. Reči bodujú pri každej bitke, priazeň nedávajú a slabnú po prehratej hádke.

### 9.5 Poldeci

Poldeci ležiace na kartách cez NA EX sa teraz **vypijú** — každý tomu, kto NA EX
dal (na Výtržníkovi oba, každému jeho). Potom sa **všetky poldeci oboch hráčov obnovia na plné** —
na maximum (v12.2, Michal 2026-11-11: „Na konci každej bitky sa im poldeci resetnú na max.“). **Po finále
nie**: výkupné (§14) ráta plné poldeci po finálovej bitke. Akcie Poldeci v bitke už neotáčajú — dolievajú
na konci každej Pitky (§7).

### 9.5b Veštica

**Len stará sada** — Veštica má dnes Spoločník: Pamätník (§16) a tento krok sa preskočí.
Porazený s Vešticou vo svojej partii si prezrie oba doberacie balíčky,
vymení jednu svoju kartu za súperovu a oba balíčky sa zamiešajú (§16).
Ak je doberací balíček niektorého hráča prázdny, najprv sa doň zamieša jeho
odhadzovací, ako pri ťahaní (§4). Keď niektorý hráč nemá ani doberací, ani
odhadzovací balíček, Veštica sa nespustí.

### 9.7 Návrat kariet

Všetky karty z oboch partií sa vrátia do odhadzovacieho balíčka **hráča, ktorý
ich zahral** (pri otočených kartách to určuje orientácia). Karty spálené
v bitke (Dievčina na vydaj, Krokodíl) sa nevracajú. Lokalita ostáva na nástenke.

**Nepriznaná Cirhóza** a **Absťák** (v9.1), ktoré má hráč po bitke v ruke, idú
do jeho odhadzovacieho balíčka (§8, §11). Karta, ktorú si dobere až na začiatku
ďalšieho kola, mu ostáva v ruke do konca toho kola.

---

## 10. Starší

**Starší** sedia v rade pri stole — 8 ukazovateľov s kartou staršieho na scorecarde. Od v11
(Strach a reči, Michal 2026-11-02, docs/napady/strach-reci.html) má **každý hráč pri každom
staršom dva vlastné markery** na stupnici **0–3**: sivá (0), žltá (1), oranžová (2), červená (3).
Markery sú verejné.

### Strach a reči

- **Strach** (0–3) — ako veľmi sa starší bojí teba. **Neklesá** (v11.4 bez výnimky — neúspešný pokus
  o zajatie zanikol). Dvíha ho **Nakladačka** víťaza bitky (§9.4).
- **Reči** (v11.12, Michal 2026-11-06) — súvislý **blok stupňov na teplomere súpera**, nie na tvojom. Dvíha ich **hádka**
  víťaza hádky (§9.1) a Predsedova vila (fajčenie v Pitke). Reči nedávajú priazeň ani strach a súperovu priazeň, výhru strachom
  ani zajatie nemenia.
- **Poradie obsadzovania:** od vrchu súperovho strachu nadol, potom nad neho; zo sivej zdola nahor. Pri červenom strachu
  najprv červená (3), s oranžovou 5, plný teplomer 6. Pri oranžovom strachu oranžová (2), so žltou 3, s červenou 6.
  Pri prázdnom teplomere žltá (1), s oranžovou 3, plný 6. Keď už reči po klesnutí nezačínajú zospodu, dopĺňajú sa pod nimi.
- **Cena stupňa** (Nakladačka aj hádka): vstup do žltej **1**, do oranžovej **2**, do červenej **3**
  (`KONSTANTY.CENA_STUPNA`). Rozdeľuje sa voľne medzi starších; zvyšok, ktorý na žiadny stupeň
  nestačí, prepadne.
- **Spomalenie** (`KONSTANTY.REC_PRIRAZKA`): súper platí za strach na stupeň s tvojimi rečami **o 1 viac** (2 / 3 / 4).
- **Posun:** keď strach súpera reči prekoná, blok ide s ním a **počet stupňov ostáva**: spodný stupeň zanikne.
  Reči žltá a oranžová, strach z oranžovej na červenú: reči oranžová a červená. Reči žltá, strach zo žltej na oranžovú:
  reči oranžová. Na stole je súperov strach plný a tvoje reči šrafa v tvojej farbe na jeho páse (mock A).
- **Klesanie:** kto **prehral hádku**, tomu po bodovaní klesnú reči pri každom staršom **zospodu o stupeň**; posledný
  stupeň zanikne. Pri remíze v hádke nikomu (remízu vyhranú Telefónom prehral súper, §9.1).
- **Stupeň staršieho pre hráča** — **pokojný (0), znepokojený (1), vystrašený (2), vydesený (3)** — je jeho
  **strach**. Do **priazne**, **výhry strachom**, **zajatia** a **výpalného** sa ráta celý, aj keď naň súper dal reči
  (Michal 2026-11-06: „Aj zajatý starší sa stále jeho väzniteľa bojí a počíta sa do vydesených.“).


### Priazeň

**Priazeň pre teba = max(0, strach súpera − tvoj strach)** — starší, ktorý sa súpera bojí viac
než teba, ti pomáha. Reči sa nerátajú; plná priazeň platí aj pri súperovom strachu, na ktorom máš všetky reči. Pri rovnakom strachu (aj obaja na červenej) priazeň nedáva
nikto (antipriazeň zatiaľ nie, Michal 2026-11-02). Priazeň pôsobí **silou** 1 / 2 / 3. Priazeň
staršieho určuje scorecard, na ktorom leží (rozdáva sa náhodne, §3; názov scorecardu = priazeň).
Väzeň priazeň nedáva — jeho scorecard je otočený.

| Priazeň | Uplatňuje sa pri | Účinok | sila 1 / 2 / 3 | Kľúč v dátach |
|---|---|---|---|---|
| Bitkár | Poškodenie v bitke (§9.3) | tuhé poškodenie navyše | +1 / +2 / +3 | `BITKAR` |
| Veriaci | Viera v bitke (§9.1, §9.3) | Viera navyše (hodnota 1); ruší Povery aj tlmí tuhé | +1 / +2 / +3 | `VERIACI` |
| Abstinent (v10) | Poškodenie a remíza v bitke (§9.3, §9.4) | v bitke sa ti neráta toľko Absťákov — tuhé za ne neklesne, nerátajú sa pri remíze v tuhom; karty ostávajú, Chuť a koniec kola bez zmeny | 1 / 2 / 3 Absťáky | `LAKOMEC` |
| Advokát (v9) | Exekúcia (§11, krok 4d) | exekúcia ti odpočíta o toľko špakov menej (najmenej 0); Dlhy zhoria ako doteraz (polovica nahor) | −1 / −2 / −3 špaky | `ADVOKAT` |
| Robota (v9) | Exekúcia, pred Exekútorom (§11) | akcie Robota navyše: každá spáli 1 tvoj priznaný Dlh; za Dlh, ktorý nemá čo spáliť, 1 špak (O5) | 1 / 2 / 3 Roboty | `ROBOTA` |
| Fajčiar (v9) | Po bitke (§9, krok 6c), aj po finále | cigarety navyše; Obmedzenie ich neuberá | +1 / +2 / +3 | `FAJCIAR` |
| Kmotor (v9) | Po bitke (§9, krok 6c), aj po finále | tvoje priznané Dlhy prejdú medzi súperove; ak ich máš menej, presunie, koľko máš; bez Dlhu nič | 2 / 3 / 4 Dlhy | `UZERNIK` |
| Ohováračka (v11.10) | Povery v hádke (§9.1) | Povery navyše; súperova Viera ich ruší ako Povery z kariet | +1 / +2 / +3 | `OHOVARACKA` |

Priazne Fajčiara a Kmotra po bitke (krok 6c) sa rátajú zo strachu **po Nakladačke tejto bitky** — čerstvo
naložený strach zaberie hneď, ako pri výpalnom. Vyplácajú sa po každej bitke **aj po finále** (Fajčiarove cigarety
sa potom vykúpia). Michal potvrdil 2026-11-12 (playtest 20261111-221937).

Exekútor a Výpalník ako priazne zanikli (v9; akcia exekúcie v §11 ostáva). Staré
sady a databázy ich ešte nesú — pri načítaní je Exekútor (`EXEKUTOR`) Advokát
a Výpalník (`VYPALNIK`, `NEPRAJNIK`) Robota, Alkoholik (`ALKOHOLIK`, v11.10) Ohováračka; Kmotor je `UZERNIK` (aj Zberateľ,
Očumovateľ), Abstinent `LAKOMEC`.

Efekty kariet uvádzajú pevné čísla — číslo nezávisí od iného staršieho. Čísla sú
v kóde v `KONSTANTY` (`KONSTANTY.EFEKT`).

### Výpalné (v11.9, krok 6c; z banky od v12.4)

Michal 2026-11-06: **hneď po vyhodnotení bitky** ti **banka** dá **1 cigaretu** (`KONSTANTY.VYPALNE_ZA_CERVENU`) za
každého staršieho, pri ktorom máš **červený strach**. Väzeň sa ráta ako červená držiteľa, reči nie. Platí sa po každej
bitke okrem finále, aj keď si ju prehral a aj pri sekere, a počíta sa so strachom po Nakladačke tejto bitky. Súper nič
neplatí a nič nestráca (v12.4, Michal 2026-11-12; do v12.3 platil súper zo svojich cigariet, koľko mal, a porazený tak
ostával bez cigariet na ponuku). Červené majú obaja, každý dostane za svoje. Obmedzenie výpalné neuberá a nie je to nerest.

### Bodovanie po bitke (krok 4b)

Po každej bitke (aj vo finále) dá každý starší špaky — **podľa stavu pred zdvihnutím** Nakladačkou a hádkou
(v11.12, Michal 2026-11-06). Stupne strachu majú hodnotu **žltá 1, oranžová 2, červená 3** (`KONSTANTY.HODNOTA_STUPNA`,
spolu 1 / 3 / 6; v11.20, Michal 2026-11-10, do v11.19 červená 2) a špaky za stupeň dostane **ten, kto ho drží**, reči majú prednosť:

- **Víťaz bitky** dostane za svoj strach bez stupňov, ktoré obsadil súper rečami. Červený strach 6, súperove reči na
  červenej a oranžovej: víťaz 1, súper 5.
- **Každý hráč pri každej bitke** (vyhratej, prehratej aj pri sekere) dostane hodnotu stupňov, ktoré obsadil rečami,
  aj nad súperovým strachom: plný teplomer 6, žltá a oranžová 3, žltá 1; po klesnutí oranžová a červená 5, samotná červená 3.

Potom klesnú reči zospodu tomu, kto prehral hádku (pri remíze nikomu). Väzeň nebojuje — na stupnici nie je.

### Výhra strachom (krok 4c)

Kto **vyhrá bitku** a po bodovaní má **červený strach aspoň u 4 starších**
(`KONSTANTY.CERVENYCH_NA_VYHRU`), vyhráva hneď — ešte pred exekúciou. **Väzeň sa ráta ako
červená svojho držiteľa.** Porazený so štyrmi červenými nevyhráva.

### Zajatie a väzeň (v9, v11, v11.4)

Nahradilo patronát a vydesenie ako výhru (Michal 2026-10-30); v11 podmienka, krádež
a väzni podľa ligy (Michal 2026-11-02); v11.4 zajatie pri rozdelení Nakladačky (Michal 2026-11-03).
Pokus o zajatie v drafte (v9–v11.3) zanikol aj s cigaretou, kartou zadarmo a ohrozením.

Michal 2026-11-03: „Zajímanie bude prebiehať pri prerozdeľovaní nakladačky/rečí z hádky - Hráč okamžite
zajme staršieho, ak sa počas nakladačky nachádzal na najvyššej hodnote strachu u toho hráča a udelí mu
nakladačku aspoň za 5, zvyšok udeľuje ostatným starším ... Starší je u neho v pivnici, počíta sa ako
vydesený a funguje jeho jednorazový efekt raz za hru.“ „Cena zajímania v cigaretách zaniká.“

**Kedy a kto.** Pri rozdelení Nakladačky (krok 4e, §9.4) — teda len víťaz bitky, ktorý ju drží.
Vo finále nie (Nakladačka ide na špaky 1 : 1, §14b); pri sekere Nakladačka nie je.

**Podmienka a cena.** **Tvoj strach** pri staršom je **3** (červená) **už pred touto Nakladačkou** —
teda od minulého kola, lebo strach dvíha len Nakladačka a tá je raz za kolo (v11.6). Strach dotiahnutý
na červenú v tom istom rozdelení nestačí; zajať ho smieš až pri ďalšej Nakladačke, ak tam vydrží.
Súperov strach nerozhoduje. Zajatie stojí **5 bodov** Nakladačky (`KONSTANTY.CENA_ZAJATIA`).

**V hre** (v11.6): pri tvojom rozdelení Nakladačky sa na staršom, ktorého zajať smieš a na ktorého ti
body stačia, ukáže pečiatka **ZAJAŤ −5**; klik ju potvrdí (**ZAJATÝ**), ďalší klik ju vráti. Inak
pečiatka na stole nie je.

Michal 2026-11-03 (v11.6): „Tieto buttony zajatia sú na hovno. Chcem, aby zajatie bolo zobrazené až keď má
starší na sebe strach v červenej hodnote teplomera. Potom sa cez neho zobrazí pečiatka ZAJAŤ. Na ňu môže
hráč kliknúť a to bude fungovať ako tieto tlačidlá, ktoré sú v hre teraz ... Zajať sa však NEDÁ v kole,
kedy starší ešte nemal červený teplomer na stupnici u hráča, ktorý staršieho chce zajať. Na zajatie
treba, aby starší bol na červenej predchádzajúce kolo A NÁSLEDNE ďalšie kolo ho môže hráč zajať. Nie je
možný scenár, že napríklad starší je na žltej a hráč ho hneď vytlačí hore a hneď aj zajme v tom istom
kole.“

**Dobrovoľné, aj viac naraz.** Zajať nemusíš; „rozdelí sa, čo sa dá“ (§9.4) sa na zajatie nevzťahuje.
Za každých 5 bodov smieš zajať ďalšieho staršieho na červenej. Zvyšok Nakladačky sa rozdelí ďalej podľa
§9.4; čo nikam nestačí, prepadne. Zajatie je súčasť jedného ťahu rozdelenia. Keď Nakladačka inak nemá
kam (všetky tvoje strachy na červenej), ale zajať sa dá, bitka na tvoje rozhodnutie počká.

**Následky (hneď).** Starší ide do priznaných kariet zajímajúceho ako **väzeň**, scorecard sa otočí,
zo stupnice zmiznú **markery oboch**; **krádež (v11.12):** súper ti odovzdá toľko špakov, koľko bodov hádky má v rečiach pri tom
staršom **v čase zajatia** (po bodovaní a klesnutí) — koľko jeho stupne rečí stáli (žltá 1, oranžová 2,
červená 3; od v11.20 rovnako ako ich hodnota pri bodovaní): oranžová a červená 5, plný teplomer 6, najviac koľko má; bez rečí nič. Obsadeného staršieho sa dá zajať. Väzni na výhru podľa ligy sa
overí hneď po rozdelení. Presvedčeného staršieho (nižšie) smú zajať obaja.

**Väzeň.** Leží v priznaných kartách držiteľa („v pivnici“). Nedáva priazeň, nie je cieľom
Nakladačky ani hádky, nikto ho nevyslobodí. **Ráta sa ako červená** držiteľa (výhra strachom).
Držiteľ má jeho **schopnosť** (nižšie). Nie je karta v línii (špaky za bitku nie), nie je kliatba
(Exekútor nie), do výkupného sa neráta a po finále špaky nedáva (8 / 6 / 4 / 2 zaniklo v11).

**Výhra väzňami.** Kto po zajatí (krok 4e) má **väzňov aspoň (lokality + finále) / 2** —
**Tretia liga 2, Druhá 3, Prvá 4** (`vazniNaVyhru`) —, vyhráva hneď. Vo finále sa nezajíma.

**Schopnosť väzňa (v11.2, Michal 2026-11-02).** Každý zajatý starší má schopnosť (znenie doslova,
`elders.json`). Hráč, ktorý ho má v pivnici, ju smie použiť **raz za hru, kedy chce**:

- **Kedy:** vo **svojom ťahu** — pri braní z ponuky (je na rade), v Zhromaždení (je na ťahu
  a nepasoval) alebo v Pitke (kým ju neskončil; nie pri odpovedi na NA EX ani pri Vízii) —, aj
  vo finále. Nie je to ťah a nič nestojí; ťah ostáva hráčovi.
- **Nie naprázdno:** schopnosť, ktorá by teraz nemala účinok, sa neponúkne (dôvod v tabuľke).
- **Po použití** je schopnosť **minutá** (verejná značka „použitá“). Starší **ostáva v pivnici**,
  ráta sa ďalej ako červená držiteľa a do väzňov na výhru.
- Každé použitie oznámi stôl obom pečiatkou (moment „schopnosť väzňa“, mimo stropu pečiatok).

| Starší | Schopnosť (doslova) | Kedy má účinok, spresnenie |
|---|---|---|
| Poštárka | Dostaneš 4 cigarety. | vždy |
| Krčmárka | Nový plný poldeci. | vždy; poldeci navyše **natrvalo** (ako Stokársky barter) — maximum +1, po každej bitke sa obnoví aj tento (v12.2) |
| Farár | Odstráň jedno súperovo NA EX z karty. Jeho poldeci ostáva vypitý. | keď na niektorej karte leží súperovo (odkryté) NA EX — v Pitke aj v Zhromaždení ďalšej Pitky; súperovi sa poldeci odpíše ako vypitý (nerest NA EX ostáva, ako pri spálenej karte). Pri zrážke (Výtržník) ostane NA EX držiteľa a karta prestane byť Výtržníkom. |
| Starosta | Do konca kola sú všetky aktívne akcie lokality posilnené. | keď je cieľom lokalita a v tomto kole ešte neplatí; **od použitia do konca kola** ×2 podľa Posilnenia (§6) na obe hrany (aj súperovu), násobí sa s ostatnými násobkami (Forsáž, NA EX). Platí pre **všetky** aktívne akcie hrán — v bitke aj v každej ďalšej Pitke kola (Hazard, Poškodenie pečene, Poldeci, Cigareta, Vízia, Obmedzenie); Pitky vyhodnotené pred použitím sa nemenia. Počet Pitiek nemení (posilnená akcia je stále jedna). |
| Veterinár | Odhoď všetky priznané Cirhózy a Cirhózy na ruke. | keď má Cirhózu na ruke či priznanú; odhodiť = do odhadzovacieho balíčka (§17) |
| Vychovávateľka | Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety. | len v Zhromaždení, vo svojom ťahu, keď súper ešte nepasoval: pas súpera je **vynútený** — v tomto Zhromaždení už nevyloží žiadnu kartu, aj keď ju držiteľ použije hneď prvým ťahom, a za tento pas **nedostane cigarety** (v12.3; plné poldeci mu ostanú); držiteľ vykladá ďalej. Ďalšie Zhromaždenie (ďalšia Pitka) je bežné — pas v ňom cigarety dáva. |
| Autobusár | Z ponuky berieš kariet, koľko chceš, každú za jednu cigaretu; keď skončíš, môže pokračovať súper. | len pri braní z ponuky, keď ponuka nie je prázdna a hráč má cigaretu; jedným rozhodnutím vyberie karty (každá 1 cigareta, bez stropu 1–2 kariet a bez obmedzenia prvého ťahu obrancu), potom s braním končí a súper berie ďalej podľa §5 |
| Hrobár | Vezmi si do ruky 1 kartu zo súperovho odhadzovacieho balíčka. | keď súperov odhadzovací balíček nie je prázdny (je verejný); karta odteraz patrí novému majiteľovi |

Hra, ktorá za hráča urobí jediný možný ťah (pas, koniec Pitky, koniec brania), naňho pre
nepoužitú schopnosť nečaká.

**Ponuka.** N = 8 vždy (§5), väzni ju nezmenšujú.

**2 na 2.** Zajíma a presviedča ten, kto Nakladačku či hádku rozdeľuje (paragraf 2 na 2 doplní, ktorý
hráč tímu a do čej ruky ide karta presvedčeného).

### Presvedčenie (v11.4)

Michal 2026-11-03: „Nová mechanika - presvedčenie - Funguje podobne ako zajatie akurát pri rozdelení
nadbytočných rečí. Hráč môže presvedčiť staršieho, aby sa pridal na jeho stranu ... nepôjde do pivnice ale
do hráčovej ruky. Nebude platiť jeho jednorazový efekt, keďže nie je zajatý. … na presvedčenie treba 5 rečí
… Presvedčeného staršieho je stále možné zajať, jeho priazeň stále funguje.“ „Staršieho možno presvedčiť
LEN ak má súper vyššiu hodnotu strachu ako ja. … markery strachu ostanú na staršom.“

- **Kedy a kto:** pri rozdelení hádky (krok 4e, §9.1) — len víťaz hádky. Vo finále nie.
- **Podmienka (v11.12, Michal 2026-11-06: „Nech sa presvedčí ktorýkoľvek starší, ktorý má dostatok rečí.“):** tvoje
  **reči sú na celom teplomere** súpera. Smieš ich tam dotiahnuť v tom istom rozdelení za bežnú cenu.
- **Cena:** **3 body** hádky (`KONSTANTY.CENA_PRESVEDCENIA`). Dobrovoľné, viac naraz smie byť; do „rozdelí
  sa, čo sa dá“ sa nerátajú.
- **V hre** (v11.6): pri tvojom rozdelení hádky sa na staršom, ktorého presvedčiť smieš a na ktorého ti body
  stačia, ukáže pečiatka **PRESVEDČIŤ** s celou cenou (s dotiahnutím rečí, napr. −8); klik ju potvrdí
  (**PRESVEDČENÝ**) a reči dotiahne, ďalší klik ju vráti.
- **Príklad:** hádka 10 pri prázdnom teplomere → reči 1 + 2 + 3 a presvedčenie 3, 1 bod inam.
- **Následky:** tvoje **reči aj strach oboch ostávajú** (v11.12, „uvidíme, čo to počas hry spraví“). Starší ostáva na
  ukazovateli: **priazeň funguje ďalej**, boduje ďalej (krok 4b), dvíha sa naň strach aj reči.
- **Karta staršieho** (boss) ide **presvedčovateľovi do ruky** a **natrvalo patrí do jeho balíčka**: hrá sa ako
  ktorákoľvek karta — len akcie, bez efektu, tag Starešina (ráta sa do prevahy, dá sa naň NA EX); po bitke
  ide do jeho odhadzovacieho balíčka a ťahá sa znova. **Schopnosť väzňa** pri presvedčenom neplatí.
- **Kto prvý presvedčí, toho je** — presvedčeného už nikto nepresvedčí (ani znova ten istý hráč).
- **Zajatie presvedčeného:** zajať ho smú **obaja**, každý za podmienok zajatia. Jeho karta zmizne odkiaľkoľvek
  (ruka, doberací či odhadzovací balíček; z línie sa po bitke nevráti) a ide do pivnice zajímajúceho;
  presvedčenie zanikne.
- **Nezničiteľný** (výklad Leadera, Michal potvrdil 2026-11-10): efekt, ktorý by kartu presvedčeného spálil (Vízia,
  Krištáľová guľa, Spálenie Krokodíla; Dievčina ani Poľovník ju podľa tagov nezasiahnu), ju pošle do odhadzovacieho
  balíčka majiteľa; efekty, ktoré menia majiteľa karty — Hrobár, Veštica,
  Snúbenica zo starých sád —, ju preskočia.
- **Skryté informácie:** kto koho presvedčil, je verejné (značka pri staršom). Kde karta práve je (ruka,
  doberací balíček), je skryté ako pri každej karte; odhadzovací balíček je verejný ako vždy.

**Výklady Developera (2026-10-30, 2026-11-02 a 2026-11-03, zadanie ich neurčilo — Michal potvrdil 2026-11-10):**

- Priazeň **Robota** sú akcie Robota, takže na ne platí aj Fúrik (o 1 Dlh viac za kus).
- **Zajatie a presvedčenie v jednom rozdelení:** najprv sa vyhodnotia zdvihy, potom akcie. Starší, ktorého
  hráč zajíma či presviedča, je na červenej (zajímaný už pred rozdelením, v11.6) — „rozdelí sa, čo sa dá“
  ho pri zvyšku nevyžaduje.

---

## 11. Kliatby, priznanie, Exekútor

### Kliatby

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | za každú akciu Hazard (§8) a priamo z efektov kariet — **hneď priznaný**; od v8.2 **počítadlo**, nie karta | za priznané Dlhy príde v každej bitke Exekútor (zhorí polovica nahor a rovnako špakov, §11); pri remíze v bitke prehráva, kto má viac priznaných Dlhov (§9.4) |
| **Cirhóza** | za každý celý prah poškodenia pečene (§8) — ide do **odhadzovacieho balíčka** | nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí **3 špaky** za kus (v8, §14); priznaná dá súperovi v každej bitke +1 tuhé (§9.3) |
| **Absťák** | na konci kola, keď hráč v kole skonzumuje **menej nerestí, než je jeho Chuť** (§8, v9.1) — **karta** do odhadzovacieho balíčka | **nedá sa priznať**; po bitke ide z ruky do odhadzovacieho balíčka; v bitke **−1 tvoje tuhé** za každú kartu kdekoľvek v balíčku (§9.3); remízu v bitke prehráva, kto má viac Absťákov (§9.4); spáli ju Vízia; na konci hry nestojí nič |

**Verejný dlh:** nový **Dlh je hneď priznaný** — od v8.2 je to len počítadlo
priznaných Dlhov (Michal 2026-10-30), do balíčka ani do ruky sa nedostane
a kartu zaň hráč nedobere. Nový **Absťák** (v9.1) je karta, ktorá ide do
**odhadzovacieho balíčka** a ostáva v balíčku, kým ju nespáli Vízia. Nová **Cirhóza** ide
do **odhadzovacieho balíčka** — do ruky príde, až keď sa doberací balíček
minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Potom
ju hráč prizná, keď chce, alebo ju podrží (Vízia ju môže spáliť, rovnako Absťák).

**Nepriznaná Cirhóza po bitke do odhadzovacieho balíčka:** Cirhóza, ktorú má
hráč po bitke v ruke a nepriznal ju, ide do jeho odhadzovacieho balíčka
(§9.7). Hráč sa teda rozhoduje: prizná ju hneď (súper dostane +1 tuhé v každej
bitke), alebo riskuje, že sa mu do konca hry nevráti do ruky a na konci ho
bude stáť 3 špaky (§14). Kým ju nepriznal, súper za ňu tuhé nedostáva.

Na konci hry sa nepriznané Cirhózy rátajú v ruke aj v oboch balíčkoch.

**Verejný počet kliatob:** hráč vidí, koľko nepriznaných Cirhóz má súper
(každý vznik, priznanie aj spálenie je vo verejnom logu), počítadlá Dlhov
a počet kariet Absťák oboch (v9.1); súperove špaky na konci hry sú teda presné.
Ktoré karty a kde ležia, sa neposiela.

### Priznanie

Kartu s tagom Kliatba možno **priznať** — vyložiť mimo línie do vlastnej
hracej oblasti. **Kliatba do línie nepatrí**, dá sa len priznať. V sade sa dá
priznať len **Cirhóza** (Dlh vzniká priznaný, Absťák sa priznať nedá); Milujúca
manželka od v7 Kliatba nie je — je to Občan a kladie sa do línie (§16).

- **Priznaná kliatba je natrvalo mimo balíčka** — nevracia sa po bitke ani pri
  zamiešaní odhadzovacieho balíčka. Priznanie je jediný bežný spôsob, ako si
  balíček od kliatob **vyčistiť**; nepriznaná kliatba sa vracia a dobiera
  znova.
- Priznanie **nemíňa limit vykladania** a **neodovzdá ťah**: hráč prizná
  ľubovoľne veľa kliatob za sebou a potom ešte vykladá alebo pasuje. Smie
  priznávať aj pri vyčerpanom limite — kým nepasuje.
- **Dlh sa nepriznáva** — od v8.2 je to počítadlo, ktoré vzniká rovno priznané (§8).
- **Absťák sa priznať nedá** (v9.1) — je to Kliatba, ktorá ostáva v balíčku; spáliť
  ho smie len Vízia alebo efekt, ktorý to výslovne povie (§8).

**Kedy priznanie dá kartu:**

| Kliatba | Karta navyše |
|---|---|
| Dlh (počítadlo) | **nie** — vzniká rovno priznaný |
| Absťák (karta, v9.1) | — nedá sa priznať |
| Cirhóza | **nie** |

Jadro dá pri priznaní kartu za každú inú kartu s tagom Kliatba (rozhodnutie 2026-10-19,
Cirhóza výnimka od 2026-10-20) — v sade taká karta nie je.

| | Nepriznaná | Priznaná |
|---|---|---|
| Dlh | — (vzniká priznaný) | **v každej bitke ho páli Exekútor** (aj špaky), ráta sa do remízy v bitke |
| Cirhóza | ide po bitke do tvojho odhadzovacieho balíčka; na konci hry **−3 špaky** | na konci nestojí nič; **súper za ňu v bitke +1 tuhé**; kartu za priznanie **nedostaneš** |

Kliatby a špaky (v6): nepriznaná Cirhóza stojí na konci 3 špaky (v8), Dlh berie
špaky cez Exekútora; Absťák špaky neuberá — berie tuhé v každej bitke (§8, §9.3).

### Exekútor

Krok 4d bitky (§9), aj vo finále — **po poškodení, výsledku a špakoch za bitku,
pred Nakladačkou** (Michal 2026-10-28); **vždy po hráčoch: obranca
Robota a Exekútor, potom útočník Robota a Exekútor**.
Remíza na Dlhy a Herňa teda rátajú priznané Dlhy
**pred** exekúciou. Najprv **Robota**: za každú aktívnu Robotu hráč **spáli**
1 priznaný Dlh (s Fúrikom v Dedičstve o 1 viac za každý Fúrik); **za každý Dlh,
ktorý Robota nemá čo spáliť, dostane 1 špak** (v8.4, Náradie 2026-10-30 — Robota
bez Dlhov 1 špak, posilnená Robota bez Dlhov 2, s Fúrikom bez Dlhov 2, pri 1 Dlhu
a Fúriku 1 spálený + 1 špak). Robota zmenší, čo zhorí Exekútorovi. Špaky za Robotu
sú na nástenke pri bitke (`robota`). Potom príde **Exekútor — bez prahu, vždy**, ku
každému hráčovi s aspoň 1 **priznaným** Dlhom (nepriznané sa nerátajú):

```
zhorí = polovica priznaných Dlhov, zaokrúhlene NAHOR
špaky = zhorí − sila tvojej priazne Advokáta (v9), najmenej 0
```

Zhorí toľko priznaných Dlhov a **rovnaký počet špakov** (Advokát ich uberie) — zhoria,
súper ich nedostane, a hráč smie ísť do mínusu. Exekúcia prehru nespôsobí. Príklad:
5 Dlhov → zhoria 3 Dlhy a 3 špaky; s Advokátom sily 2 len 1 špak. Jediný Dlh zhorí
celý (aj s 1 špakom) — až po poškodení, takže remíza a Herňa ho v tej bitke ešte spočítajú.
Priazne Robota a Advokát sa rátajú v čase exekúcie (sila z rozdielu strachov, §10). Priazeň Exekútora zanikla v9.

**Záhradkár (Exekúcia, Michal 2026-10-28):** keď leží odkrytý v línii v partii
hráča (jeho karta, v tejto bitke), Exekútor ho v kroku 4d obíde — nezhorí mu ani
jeden Dlh a neodpočíta žiadne špaky.
Nespáli sa, po bitke sa vráti ako každá karta (§16).

Zvyšné priznané Dlhy na konci hry nestoja nič. Priznané Dlhy pália len Robota
a Exekútor; priazeň Kmotra ich presúva
k súperovi.

---

## 12. Nástroje a Dedičstvo

**Náradie — podloženie** (Michal 2026-11-08, docs/napady/naradie-hrany-zoznam.html v5,
voľby P1–P6): Nástroj sa do línie **nevykladá** ako samostatná karta. Hráč ho buď
**podloží** pod kartu v línii, alebo vyloží do **Dedičstva** (ako doteraz).

### Nástroj: dve hrany

Nástroj nemá sloty. Má **hornú a dolnú hranu** a v strede ilustráciu a text Dedičstva.
Hrana je **akciová** — preškolenie **X → Y** —, **hrana posilnenia** — posilnená akcia **X**
(Michal 2026-11-09) — alebo **kartová** — účinok na celú kartu, pod ktorou leží. Kartovú
hranu majú štyri Nástroje: **Energeťák** (Forsáž), **Vínko** (NA EX), **Injekcia**
(Výtržník) a **Vidly** (Vzbura); každý z nich má na druhej hrane jedno preškolenie.
**Puška** má dve hrany posilnenia (Petelica, Pecka); **Pasca, Fúrik, Horoskop a Izolačka** jednu
hranu posilnenia a jedno preškolenie. Ostatných 13 Nástrojov má dve preškolenia. Nástroj sa podkladá
**len pod vlastné karty** (v11.16, Michal 2026-11-09), preto hrany od v11.17 vlastnej karte
pomáhajú, alebo pomôžu podľa suseda (Hrable, Zrkadlo, Jogurt dole, Telefón dole, Svätý text a
Zapaľovač hore); 13 sabotáží zaniklo (docs/napady/naradie-len-svoje.html). Hrany stoja v texte
karty za Dedičstvom („Hore: … Dole: …“):

| Nástroj | Hore | Dole |
|---|---|---|
| Energeťák | Forsáž | {Poldeci}→{Posilnenie} (v11.17; predtým {Posilnenie}→{Pečeň}) |
| Vínko | NA EX | {Pečeň}→{Poldeci} |
| Injekcia | Výtržník | {Pečeň}→{Robota} (v11.17; predtým {Poldeci}→{Pečeň}) |
| Vidly | Vzbura | {Robota}→{Petelica} (v11.17; predtým {Rana}→{Pecka} ako Sypač) |
| Puška | Posilnená {Petelica} | Posilnená {Pecka} |
| Valaška | {Pecka}→{Petelica} | {Rana}→{Petelica} (v11.17; predtým {Petelica}→{Pecka}) |
| Pasca | {Pečeň}→{Rana} | Posilnená {Rana} (v11.17; predtým {Pecka}→{Rana}) |
| Zapaľovač | {Cigareta}→{Rana} | {Poldeci}→{Petelica} (v11.17; predtým {Cigareta}→{Pečeň}) |
| Noviny | {Viera}→{Pohoršenie} | {Pečeň}→{Pohoršenie} (v11.17; predtým {Pohoršenie}→{Povera}) |
| Svätý text | {Povera}→{Viera} | {Odpor}→{Viera} (v11.17; predtým {Viera}→{Povera}) |
| Telefón | {Povera}→{Pohoršenie} | {Odpor}→{Povera} |
| Nealko | {Pečeň}→{Povera} (v11.17; predtým {Pečeň}→{Viera} ako Anonymný alkoholik) | {Poldeci}→{Pohoršenie} (v11.17; predtým {Poldeci}→{Viera}) |
| Krištáľová guľa | {Povera}→{Vízia} | {Pečeň}→{Vízia} (v11.17; predtým {Vízia}→{Povera}) |
| Krabička cigariet | {Pečeň}→{Cigareta} | {Hazard}→{Cigareta} |
| Výherný automat | {Hazard}→{Poldeci} | {Hazard}→{Pecka} (v11.17; predtým {Cigareta}→{Hazard}) |
| Výherné žreby | {Hazard}→{Vízia} | {Cigareta}→{Vízia} (v11.17; predtým {Vízia}→{Hazard}) |
| Fúrik | {Hazard}→{Robota} | Posilnená {Robota} (v11.17; predtým {Robota}→{Hazard}) |
| Horoskop | {Hazard}→{Povera} | Posilnená {Povera} (v11.17; predtým {Povera}→{Hazard}) |
| Hrable | {Odpor}→{Posilnenie} | {Posilnenie}→{Odpor} |
| Zrkadlo | {Odpor}→{Pakt} | {Pakt}→{Odpor} |
| Izolačka | {Pečeň}→{Obmedzenie} | Posilnené {Obmedzenie} (v11.17; predtým {Pecka}→{Obmedzenie}) |
| Jogurt | {Pečeň}→{Posilnenie} | {Pečeň}→{Hazard} |

Každá dvojica X → Y je v sade jediná — aj so Školiteľmi (Anonymný alkoholik, Sypač, Tipér,
Vedúcko, Kapybara).

### Podloženie

- **Podloženie je ťah v Zhromaždení a stojí 1 cigaretu** (P4). Nástroj z ruky zasunieš
  pod **svoju** kartu s tagom **Občan alebo Starešina** v línii — **pod súperovu nie** (v11.16,
  Michal 2026-11-09: „hráč nesmie podkladať náradie pod súperove karty, len pod svoje“), natočený
  tak, aby zvolená hrana pretŕčala. Do limitu vykladania sa neráta, v striedaní je to ťah
  (aj ďalší krok ťahu po Vypiť, §13).
- **Platí len pretŕčajúca hrana.** Druhá je skrytá a nerobí nič. Natočenie sa po
  podložení nemení.
- Pod jednou kartou leží **najviac jeden Nástroj** (Zámočník výnimka, §16). Pod **Zviera**
  len kým v línii leží Kôň (§16). Pod kartu lícom dole (Záverečná, odpoveď na NA EX) sa
  nepodkladá.
- **Akciová hrana X → Y** preškolí **všetky výskyty** akcie X na oboch hranách karty aj v jej
  akciách navyše (pečať, v12) na Y (Rana ×2 → Pecka ×2). Preškolenie prebehne **ešte pred spojmi**: susedia sa párujú už
  s preškolenou akciou. Ak karta X nemá, Nástroj pod ňou nerobí nič (podložiť ho smieš,
  je to tvoj ťah; hra také podloženie ponúka tlmene s upozornením „hrana tu nič nezmení“,
  v11.16). To isté platí pre hranu posilnenia bez X a pre kartovú hranu, ktorej stav
  karta už má. **Premeny sa reťazia** (v11.20, Michal 2026-11-10: „Áno, reťazí sa všetko.“):
  pod Zámočníkom pracuje každý Nástroj v poradí podloženia na výsledku predošlého — {Pečeň}→{Rana}
  a po ňom {Rana}→{Pecka} dajú z Pečene Pecku, v opačnom poradí z Pečene Ranu. Nástroje idú
  **po Školiteľoch** (§6): X je akcia po nich — Sypač {Rana}→{Pecka} a Valaška hore
  {Pecka}→{Petelica} dajú z Rany Petelicu; Valaška dole {Rana}→{Petelica} pod kartou, ktorej
  Sypač Rany zmenil na Pecky, nerobí nič. Ponuka podloženia ukáže celú reťaz („Rana → Pecka → Petelica“).
- **Hrana posilnenia X** (zápis „Posilnená {X}“, tvar podľa rodu: Posilnený {Hazard},
  Posilnené {Obmedzenie}) posilní **všetky X aktívne po NA EX** na oboch hranách karty (×2) ako
  Posilnenie (§6). Platí na akciu, ktorá je X **po preškolení** (Nástroj, Školiteľ): Rana
  preškolená na Petelicu sa posilní, Petelica preškolená na Pecku pod „Posilnená
  {Petelica}“ nie. Uplatní sa **po NA EX** (v11.21, poradie nižšie) a násobí sa s ostatnými
  násobkami (Forsáž ×4, Posilnenie suseda, Silná žena…). NA EX (aj z Vínka) najprv obráti
  stav akcií karty: aktívne X zruší, neaktívne X aktivuje ×2 — a tie potom hrana posilní na
  **×4** (Michal 2026-11-10: „No lenže keď sa dá NA EX, tak tie neaktívne zrazu aktívne
  budú.“). Sypač Podporou zmení Šoférovi Rany na Pecky, Puška dole pod Šoférom a NA EX na
  Šoféra: neaktívne Pecky ×4, aktívne zrušené. Výtržník z nich urobí Rany ×1. **Akcie navyše**
  karty (pečať) posilní tiež, ×2 (v12, Michal 2026-11-11: „Áno, celý Nástroj“) — NA EX na ne
  nepôsobí. Pod Zámočníkom dva Nástroje s tou istou akciou posilnia raz. Ak karta X nemá na hranách
  ani v pečati, Nástroj pod ňou nerobí nič.
- **Kartová hrana** dá karte účinok z §6 alebo §7 a uplatní sa tam, kde ten účinok stojí
  dnes: preškolenie → spoje → **Vzbura** → Výherné žreby → Forsáž zo spoja → **NA EX** →
  **Forsáž Energeťáka** a hrana posilnenia (v11.21) → Dedičstvo Pušky → efekty kariet →
  **Výtržník**. Karta sa správa presne tak, ako keby jej ten stav vznikol
  dnešnou cestou, bez vedľajších nákladov tej cesty (poldeci, nerest, pečeň):
  - **Energeťák — Forsáž:** všetky akcie karty aktívne po NA EX ×2 (§6), aj akcie navyše v pečati (v12). Neviaže sa na
    Posilnenie, NA EX ju preto nezruší; neaktívne akcie, ktoré NA EX aktivovalo, majú ×4
    (v11.21, Michal: „Áno, ×4 — aj Energeťák.“). So spojovou Forsážou či Vzburou z Odporu proti
    Posilneniu sa násobí (×4).
  - **Vínko — NA EX:** aktívne akcie karty zrušené, neaktívne ×2 (§7). Bez poldeca: nie je
    to nerest, nepridá pečeň, nikto nič nepije; podloženie je viditeľné. Skutočné NA EX
    na kartu už nejde. Vínko nemožno podložiť pod kartu, na ktorej leží poldeci, so
    Vzburou ani pod Výtržníka. Podmienka „aspoň jedna aktívna a jedna neaktívna“ sa
    neposudzuje. Farár ani Snúbenica ho nezložia (nie je to NA EX), Svokra ani Pijan ho
    nerátajú.
  - **Injekcia — Výtržník:** ako po zrážke (§7) — karta sa najprv spáruje so susedmi
    (jej Posilnenie a Odpor už ako Rany), potom sú všetky jej akcie aktívne Rany pre
    majiteľa karty. NA EX sa na ňu nedá; vytriezvie, keď sa Injekcia po bitke vráti.
  - **Vidly — Vzbura:** nespojené akcie aktívne, spojené neaktívne (§6). So Vzburou zo
    spoja sa karta obráti raz. NA EX sa na ňu nedá (§7).
- **Podložený Nástroj leží do bitky** (P4): vyhodiť sa nedá. Zbaviť sa ho dá len
  s kartou, pod ktorou leží.
- **Po bitke** sa každý podložený Nástroj vráti do **odhadzovacieho balíčka svojho
  majiteľa** — toho, kto ho podložil, nie majiteľa karty. Keď karta odíde z línie skôr
  (Poľovník), Nástroj ide tam hneď.
- Podloženie **nie je priloženie**: Konflikt, Podporu ani Pascu nespúšťa (§6). Nástroj pod
  kartou sa do prevahy v kraji neráta a špaky za karty v línii nedostane.
- Podložený Nástroj a jeho hrana sú **verejné**.

### Dedičstvo

Nástroj možno namiesto podloženia vyložiť do hracej oblasti ako **Dedičstvo**;
tam sa uplatňuje jeho pasívny efekt `Dedičstvo` (text v strede karty). Poldeci sa na
Nástroje neuplatňujú, NA EX sa na ne dať nedá.

**Dedičstvo stojí cigarety a cena rastie spoločne pre oboch:** prvý Nástroj
vyložený do Dedičstva v hre stojí **1** cigaretu, druhý (hocktorého hráča)
**2**, tretí **3** atď. Bez cigariet Nástroj do Dedičstva nevyložíš. Z Dedičstva
sa Nástroj nepodkladá. Vyloženie do Dedičstva je ťah a limit nemíňa.

Efekt v Dedičstve funguje ako malá priazeň: Nealko prah Cirhózy +2, Svätý
text Viera +1, Vidly (Rany o 1 viac), Puška (prepojená Petelica sa nedá zrušiť, len oslabiť), Krabička cigariet,
Noviny, Pasca, Výherný automat, Vínko, Injekcia a **Náradie** (v8.4, nižšie) (§16).

**Náradie (v8.4, Michal 2026-10-30)** — Nástroj ku každej akcii, efekt len v Dedičstve
majiteľa; menia sa len **tvoje** akcie (karty, ktoré si zahral):

| Nástroj | Dedičstvo | Presne v hre |
|---|---|---|
| Zapaľovač | Tvoje aktívne Cigarety nemožno zrušiť NA EX. | NA EX na kartu zruší ostatné aktívne akcie; aktívne Cigarety ostanú ×1 (nezdvoja sa). |
| Výherné žreby | Tvoje Hazardy sú aktívne, keď nie sú spojené, a neaktívne, keď sú spojené. | Rozhoduje, či slot má na spoji partnera; zrušené Odporom ostávajú zrušené. NA EX potom ako vždy: spojené (neaktívne) zdvojí, nespojené (aktívne) zruší (O1). |
| Izolačka | Za každé tvoje aktívne Obmedzenie sa súperovi po Pitke doleje o 1 poldeci menej. | (v12.2) Pri doliatí po Pitke (§7, krok 9) uberie súperovi za každé tvoje aktívne Obmedzenie v línii 1 z celého doliatia — najprv z poldeci zadarmo, potom z Jogurtu a akcií Poldeci — najmenej 0 (výklad Leadera). V Pitke Obmedzenia uberajú cigarety ako vždy. |
| Hrable | Tvoj aktívny Odpor dáva v bitke poškodenie ako Pecka. | (v12.1) Každý aktívny (nespárovaný) Odpor tvojej karty v línii sa ráta ako Pecka ×1 — 2 tuhé; Odpor na spoji nie. Výklad Leadera: Pecka aj pre Valašku a iné efekty tvojich Pecky; Forsáž ani NA EX ju nezdvoja. Predtým (do v12): zrušená akcia sa pripísala majiteľovi Odporu ×2. |
| Zrkadlo | Tvoj Pakt kopíruje prepojenú akciu dvakrát. | Pakt sa premení na akciu partnera ×2; proti Posilneniu ostáva nič. |
| Valaška | Tvoje Pecky udeľujú o 1 poškodenie viac. | Každá tvoja aktívna Pecka +1 tuhé — z vyložených akcií aj akcia navyše (Šofér, frakcie), aj preškolená (Vedúcko, Sypač). |
| Telefón | Hádka: Remíza v hádke je tvoja, ak nie je 0 : 0. Bitka: Za každú tvoju akciu zrušenú súperovým Odporom {Povera}. | (v11.17, Michal 2026-11-09) Remízu v hádke s mäkkým vyhráš o 0 (§9.1); majú ho obaja = remíza. V bitke 1 Povera navyše (akcia navyše, §6) za každú tvoju akciu — aj Pakt či Posilnenie — ktorú na spoji zrušil Odpor súperovej karty (Odpor hrany lokality nie); za každý Telefón zvlášť. Do v11.16: tvoje Pohoršenia nemožno zrušiť Odporom a NA EX. |
| Jogurt | Po každej Pitke sa ti doleje o 1 poldeci viac. | (v12.2) Pri doliatí po Pitke (§7, krok 9) o 1 vypitý poldeci viac, ak nejaký vypitý máš. |
| Energeťák | Tvoje Posilnenie nemožno zrušiť NA EX. | NA EX na kartu s tvojím Posilnením partnerovi ×2 nezruší. |
| Horoskop | Tvoje Povery majú silu 2. | (v10) Každá tvoja zvyšná Povera dá 2 mäkké namiesto 1. S Vierou sa ruší stále 1 : 1 na kusy: jedna súperova Viera zruší jednu tvoju Poveru, teda 2 mäkké. Prenášanie klebiet do ďalšieho kola zaniklo. |
| Fúrik | Tvoje Roboty pália o 1 Dlh viac (teda 2). | Každý Fúrik +1 Dlh za Robotu; čo nemá čo spáliť, dá špak (§11). |
| Krištáľová guľa | Tvoje Vízie ukážu 2 vrchné karty — jednu si vezmi alebo spáľ, druhú vráť navrch. | Ukážu sa dve vrchné karty doberacieho balíčka (len tebe); rozhodneš o jednej, druhá ostane navrchu. Pri jedinej karte ako bežná Vízia. |

Kto má viac kusov toho istého Nástroja: Valaška a Fúrik sa sčítajú, ostatné nie.

---

## 13. Pokročilé ťahy

### Vypiť — viac kariet v jednom ťahu

V **Zhromaždení**, keď je na ťahu, smie hráč vyložiť viac kariet naraz. Od v12.2 (Michal 2026-11-11:
„Ak chcú dať 2, 3, 4 karty naraz… musia na to mať poldeci, ale každá ďalšia takto zahraná karta stojí toľko
cigariet, koľko kariet navyše dávajú, čiže ak chcú dať dve karty, musia vypiť 2 poldeci a zaplatiť 1 cigaretu,
ak chcú dať 3 karty, musia vypiť 3 poldeci a zaplatiť 2 cigarety a tak ďalej.“):

```
n kariet v jednom ťahu = n plných poldeci + (n − 1) cigariet     (KONSTANTY.CENA_KARTY_NAVYSE)
```

Každá karta otočí svoj plný poldeci (§6) a každá karta po prvej je **Vypiť**: 1 cigareta, **+1 poškodenie
pečene** a **1 nerest** (§8; Michal: len karty navyše — prvá karta pečeň ani nerest nedá). Pečeň sa
vyhodnocuje len v Pitke: +1 sa pripíše dopredu a prah Cirhózy sa skontroluje v najbližšej Pitke.
Samostatné tlačidlo na to nie je — hráč v ťahu jednoducho vyloží viac kariet. Klient posiela celý ťah
naraz (príkaz `tah`: priznania, potom Nástroje a karty a pred každou kartou do línie okrem poslednej Vypiť);
server ho vykoná celý, alebo vôbec — platí sa pred ťahom (výklad Leadera).

**Poradie:** Vypiť ide pred kartu, po ktorej chce hráč pokračovať — pri dvoch kartách **Vypiť, karta,
karta**; „karta, Vypiť, karta“ nejde, prvá karta ťah ukončí. Vypiť smie len pred ďalšou kartou do línie,
na ktorú má hráč plný poldeci — na konci ťahu ani navyše nie (nerest by sa kupoval za cigaretu).

**Nástroj a priznanie** (Dedičstvo, podloženie, priznanie kliatby) cenu ťahu nezvyšujú: s kartou do línie
sa zahrajú v jednom ťahu bez Vypiť a bez cigarety (Nástroj ako celý ťah ostáva ťahom). Na **Družstve** to
isté pre karty s akciou Robota. V kole o **Kostol** sa v ťahu smie vyložiť len 1 karta — bez Vypiť a ani
Nástroj s kartou (výklad Leadera). Pasovanie nevyužité ťahy navyše ruší.

### Záverečná

Na svojom ťahu v Zhromaždení smie hráč za **1 cigaretu** zahrať kartu z ruky
ako **Záverečnú** — lícom dole na ktorýkoľvek koniec línie. Je to
voliteľné a hráč tým v tomto Zhromaždení **končí s vykladaním** (ako pas, ale **bez cigariet za pas**,
v12.3); v jednom Zhromaždení teda najviac jedna.

- Je to bežné vyloženie: **stojí plný poldeci** ako každá karta (v12.2; Nástroj Záverečnou byť nemôže, do línie nejde), smie byť aj ďalšou
  kartou ťahu po Vypiť a platia pre ňu všetky pravidlá vykladania.
- Kým leží lícom dole, **ráta sa normálne** — akcie, spoje, prevaha, tuhé.
  Súper z nej nevidí nič (ani meno v logu); jej príspevok mu ostáva neznámy.
  Ani cez jeho vlastné karty: akciu jeho karty, ktorú Záverečná spáruje
  (aktivuje, zdvojí či zruší), mu hra neukáže a odhad bitky ju nezarátava —
  uvidí ju až po otočení.
- **Za ňu sa nedá priložiť** žiadna karta (ani odpoveď na NA EX), kým sa
  neotočí — ten koniec línie je dovtedy zavretý pre oboch.
- **NA EX** na ňu smie v Pitke dať len **súper** a prejde vždy (nekontroluje
  sa tag ani aktívne a neaktívne akcie — odmietnutie by kartu prezradilo);
  vyhodnotí sa ako na každej karte. Majiteľ na ňu NA EX dať nesmie.
- **Otočí sa na konci Pitky**, ktorá nasleduje po jej Zhromaždení (pred
  ďalším Zhromaždením alebo bitkou, krok 8 v §7). Až vtedy sa vyhodnotí jej
  **Nástup** a **Konflikt** či **Podpora**, ktoré priložením vyvolala (§16). Kým leží lícom dole, podmienku
  Spoločníka ani Nepriateľa nesplní a akcie navyše nedostane.

### Podstrčenie (sabotér)

**Podstrčiť** = priložiť svoju kartu k súperovej (Michal 2026-11-08). Jej Odpor
súperovi zruší akciu na spoji, jej akcie bodujú pre teba a zaberie koniec línie,
kde súper stavia. Karta ostáva v tvojej partii a míňa tvoj limit (§6).
**Podstrčený Pes platí** — jeho aktívne akcie na spoji so súperovou kartou sa
zdvoja (§16). Na Moste každý vykladá len na koniec línie po svojej ľavici (§15).

---

## 14. Špaky

**Špaky** (v6, Michal 2026-10-26) zbiera hráč počas celej
hry a klient ich ukazuje ako ohorky v popolníku pri mene hráča. Špaky sú
verejné. Vyhrá, kto má na konci hry (po finále) viac špakov; rovnosť je remíza.

| Odkiaľ | Koľko | Kedy |
|---|---|---|
| Vyhratá bitka | 1 za každú kartu v celej línii (v8; aj finále), **aspoň 1** (od v8.1 bez zrážky za Absťáky); plus špaky zo sekery | krok 4a (§9.4) |
| Bitka o Kultúrny dom (v11.13) | víťaz aj porazený 1 za každú svoju kartu v línii (víťaz aspoň 1, plus sekera) | krok 4a (§15) |
| Vyhraná hádka pri prehratej bitke alebo sekere (v11.11) | 1 za každú svoju kartu v línii; na Kultúrnom dome pri prehratej bitke nie druhýkrát | krok 4a (§9.4) |
| Starší po bitke (v11.12, v11.20) | stupne žltá **1**, oranžová **2**, červená **3** dostane, kto ich drží: víťaz za svoj strach bez stupňov, ktoré obsadil súper, obaja pri každej bitke za svoje reči | krok 4b (§10) |
| Finále: Nakladačka a hádka (v9.1, v11) | víťaz bitky 1 za bod Nakladačky, víťaz hádky 1 za bod hádky | krok 4a (§14b) |
| Krádež pri zajatí (v11, v11.4) | zlodej dostane, okradnutý stratí toľko špakov, koľko bodov hádky má okradnutý v rečiach pri zajatom staršom v čase zajatia (v11.12), najviac koľko má | krok 4e (§10) |
| Exekútor | **−** polovica priznaných Dlhov nahor, mínus sila tvojej priazne Advokáta (najmenej 0) — v každej bitke, kým má hráč priznané Dlhy (Záhradkár v partii ju v tom kole obíde) | krok 4d (§11) |
| Výkupné zdrojov | **+1** za každý plný poldeci, **+1** za každých celých 5 cigariet (nadol); **bez stropu** | na konci hry, po finále |
| Nepriznaná Cirhóza | **−3** za kus (v8; ruka aj oba balíčky) | na konci hry, po finále |

Väzni od v11 po finále špaky nedávajú (do v10 8 / 6 / 4 / 2 podľa poradia zajatia).

**Výkupné** (Michal 2026-10-27): zdroje, ktoré hráčovi po finále ostanú, sa
vykúpia za špaky — nič neprepadá a hra ho neobmedzuje stropom. Ráta sa **plný
poldeci** v zásobe hráča (§6, limit vykladania): vypitý poldeci nie, poldeci ležiaci
cez NA EX sa v bitke vypije (§9.5) a tiež nie. Po finálovej bitke sa poldeci **neobnovujú** (v12.2) a
poldeci z Vínka je plný poldeci ako každý.
Cigarety sa delia piatimi a zvyšok prepadne (14 cigariet = 2 špaky). Zdroje oboch hráčov
sú verejné, preto aj výkupné — klient ho ukazuje v riadku „Koniec“ krčmovej nástenky
a v „keby skončila teraz“.

Špaky smú klesnúť do mínusu. **Krčmová nástenka** ukazuje odohrané bitky:
lokalitu (aj pinnacle finále, s príznakom finále), počet kariet v línii, víťaza a špaky za
bitku; klient z nej skladá aj rozpis popolníka. Pod lokalitou je, koľko špakov za ňu víťaz
v kole získal spolu — za bitku, Robotu, starších po bitke (rozpis po staršom a markeri),
Nakladačku a hádku vo finále, krádež, mínus Exekútor; porazený vedľa, ak niečo získal. Rozpis
po hráčoch ukáže myš (aj fokus klávesnicou), klik otvorí súhrn lokality: Pitky kola (kto čo
získal a stratil) a rekapituláciu bitky. Súhrn je len evidencia z verejných udalostí — server
ho skladá z toho, čo videli obaja.

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
  Útočník vykladá prvý a na NA EX odpovedá prvý (lícom dole); obranca berie z ponuky prvý.
- **Obranca — hráč, ktorý vedie** (viac špakov) — vyberie pinnacle
  lokalitu (z troch, §5), natočí ju víťaz poslednej hádky (v11.11; po remíze obranca). Potom ponuka a branie ako v každom kole.
- Pitiek je ako na každej lokalite **1 + menší počet aktivovaných akcií hrán**
  (1–5) — teda podľa spojov s lokalitou. Víťaz dostane **1 špak za každú kartu
  v línii** (v8; aspoň 1); na Herni navyše toľko, koľko má
  porazený priznaných Dlhov (§15). Sekera vo finále špaky kola aj zo sekery
  **prepadnú**.
- **Vo finále sa markery nedvíhajú** (v11): víťaz finále dostane za každý bod Nakladačky
  **1 špak** (v9.1) a víťaz hádky za každý bod hádky **1 špak**; víťaz hádky, ktorý prehral bitku,
  navyše 1 špak za každú svoju kartu v línii (v11.11); starší bodujú po finálovej
  bitke ako po každej (krok 4b).
- **Výhra strachom** (4 červené, krok 4c) platí aj vo finále — ešte pred konečnými špakmi (§1, §10).
  Vo finále sa nezajíma ani nepresviedča (v11.4), výhra väzňami tu teda nepríde. Po finále sa Chuť
  ani **Absťák** nerieši (§8).
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
| Lesná cesta | Bitka | Za každé **svoje Zviera v línii** (natočené k tebe, v ktoromkoľvek kraji) **2 tuhé** navyše (v11.13), bez stropu; skrytá Záverečná sa neráta. |
| Cintorín | Prehra | Porazený si smie vziať do ruky **1 kartu zo svojho odhadzovacieho balíčka** (v11.13); smie aj nič. Berie sa až po návrate kariet (§9 krok 7a), takže v balíčku sú už aj jeho karty z práve odohranej línie (Michal 2026-11-07); spálené karty nie. Cirhóza vzatá do ruky sa hneď vráti do balíčka ako každá nepriznaná (krok 7b). Pri prázdnom balíčku a pri sekere sa nič nedeje. |
| Jednota | Pitka | Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani barterovať (v12.2 — doliatie za cigarety zaniklo). Pri rovnosti smú obaja. |
| Benzínka | Pitka | **Každé fajčenie stojí o 1 cigaretu menej** (v11.15): prvé fajčenie hráča v Pitke zadarmo, druhé 1, tretie 2 atď. (inde 1, 2, 3; každá Pitka a každý hráč zvlášť). Zaplatená cigareta je nerest a ráta sa do Krabičky cigariet ako inde; fajčenie zadarmo nie. |
| Kar | Pitka | Poškodenie pečene za NA EX dostane **súper** hráča, ktorý ho dal (poldeci a nerest ostávajú dávajúcemu). |
| Kostol | Zhromaždenie, Pitka | V ťahu sa smie vyložiť len 1 karta (v12.2; predtým „Nikto nesmie vypiť“ s tým istým účinkom — ani Nástroj s kartou). **NA EX sa smie dať len na kartu na konci línie** (na ktoromkoľvek z dvoch koncov) — najďalej od Kostola; na výber sú oba konce (v11.7, Michal 2026-11-06). |
| Zberný dvor | Pitka | Na konci Pitky (krok 7b, po Vízii, pred otočením Záverečných) smie každý hráč spáliť 1 kartu z ruky, nie kliatbu (Cirhózu ani Absťák); rozhoduje obranca, potom útočník. Súper vidí len to, že hráč kartu spálil. |
| Sklad | Zhromaždenie | Nástroj z ponuky smieš vyložiť rovno do Dedičstva za cenu Dedičstva (§12), nie za cenu ponuky; je to ťah a spoločná cena potom stúpne. Z vrchu Náradia príde do ponuky nový Nástroj, verejne; z prázdneho nič. Smie každý hráč, koľkokrát chce. Kraje pri vreciach / pri sklade. |
| Obecný úrad | Pitka | Platí pre oboch: **všetky cigarety a Dlhy získané počas fázy Pitka**, z akcií aj z efektov kariet, **sa rátajú dvakrát** (v11.13). Obmedzenie sa odráta pred zdvojnásobením: (akcie − Obmedzenie) × 2. Platby, cigarety za pas zo Zhromaždenia a Dlhy mimo Pitky sa nezdvojujú. Výherný automat: zdvojnásobí sa zadĺženie, prah ostáva 2; aj jeho Dlh v každej Pitke (v12) sa ráta dvakrát. Robota tu páli 1 Dlh ako inde. |
| Poľovnícka chata | Furt | Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát (Hazard, Pečeň, Posilnenie, Pohoršenie nie). Kraje pri trofejach / na posede. |
| Predsedova vila | Pitka | Za každé 2 cigarety, ktoré v tejto Pitke vyfajčíš (zaplatené, ako pri Krabičke cigariet), zdvihni svoje reči pri jednom staršom o stupeň v bežnom poradí (v11.12), kým je kam; staršieho vyberáš ty. Kraje pri bazéne / v pracovni. |
| Herňa | Bitka | Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov (pri bitke, pred Robotou a Exekútorom; bez stropu); pri sekere nič. Kraje pri automatoch / v zadnej miestnosti. |
| Kultúrny dom | Bitka | **Každý hráč dostane špaky len za svoje karty v línii, aj víťaz** (v11.13): 1 špak za každú svoju kartu (svoju partiu, kdekoľvek v línii). Víťazovi ostáva aspoň 1 špak a špaky zo sekery navyše; špaky za výhru hádky (v11.11) sa porazenému nepripočítavajú druhýkrát. Pri sekere nikto nie je víťaz ani porazený — špaky kola idú na sekeru ako inde a víťaz hádky dostane za svoje karty hneď (§9.4). Nakladačka sa rozdeľuje ako inde (§9.4). |
| Ihrisko | Bitka | V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (pri rovnosti nikto) — rátajú sa ako do prevahy, **Dvojčatá za dve** (v8, návrh #32); z oboch krajov teda až +4. |

Ďalšie lokality — tie, ktoré v tabuľke vyššie nie sú (Krčma, Zastávka, Most, Vínna pivnica, Družstvo); staré znenia v6 lokalít z tabuľky vyššie sú v `docs/pravidla-historia.md` (audit 2026-10-31 ich odtiaľto vyradil). Akcie na hranách určujú počet Pitiek (§7); efekt platí v kole,
keď je lokalita cieľom. Po bitke ide lokalita na krčmovú nástenku (§14) —
nikto ju neovláda.

| Lokalita | Kedy | Efekt |
|---|---|---|
| Krčma | Pitka | Kto má plný poldeci a Občana či Starešinu v línii (vlastného či súperovho), musí dať NA EX (skryto ako vždy, §7) — bez neho Pitku neskončí. Prah Cirhózy je v kole o Krčmu obom o 2 vyšší (sčíta sa s Nealkom). |
| Zastávka | Pitka | (v9.1) Po **prvej Pitke kola** si každý hráč vezme **zadarmo 1 kartu z ponuky** — najprv útočník, potom obranca. Ponuka sa medzi nimi nedopĺňa; jediná karta pripadne útočníkovi, z prázdnej ponuky sa neberie nič. Do v9 spoločný limit vykladania. |
| Most | Zhromaždenie, Pitka | Každý vykladá len na koniec línie po svojej ľavici — aj odpoveď na NA EX. |
| Vínna pivnica | Pitka | NA EX smie hráč dať v Pitke až dvakrát (obe skryto, na dve rôzne karty). |
| Družstvo | Zhromaždenie | Karty s akciou Robota na ktorejkoľvek hrane **nestoja poldeci** (v12.2; v11.13 nemíňali limit) — neotočia poldeci a do ceny ťahu v cigaretách sa nerátajú, ako Nástroj (§13). |

**Kostol a NA EX — ako to hra robí (v11.7):**

- **Karta na konci línie** (posledná karta) je karta na jednom z dvoch koncov línie v okamihu výberu NA EX.
  Otočenie Kostola na NA EX nemá vplyv (mení len, ktorá hrana prilieha ku ktorému kraju). Keď posledná karta z línie zmizne, je
  poslednou karta pred ňou.
- **Prázdny kraj** cieľ nemá — ostáva druhý koniec línie. V prázdnej línii sa NA EX dať nedá.
- **Ostatné podmienky NA EX platia ďalej** (§7). Koniec, ktorý ich nespĺňa (Zviera bez Injekcie v Dedičstve, už na ňom leží poldeci,
  Vzbura, pod ním Vínko či Injekcia, nemá aktívnu aj neaktívnu akciu), nie je cieľ a NA EX sa **neposúva** na kartu pred ním — ten koniec
  v tej chvíli cieľ nemá.
- **Skrytá Záverečná** je posledná karta na svojom konci línie, kým sa neotočí (za ňu sa nedá priložiť, §13). Súper na
  ňu NA EX smie a prejde vždy; majiteľ na ňu nesmie, takže na tom konci cieľ nemá. **Karta pred ňou cieľom
  nie je pre nikoho.** Po otočení je to bežná posledná karta. Výklad Developera 2026-11-06, Michal potvrdil
  2026-11-10.
- **Zrážka:** obaja môžu vybrať ten istý koniec — je z neho Výtržník ako vždy. Súperovo skryté NA EX koniec
  neobsadí. Kto hrá po súperovi s **Bzdochou** a vidí jeho NA EX, má na výber ten istý aj druhý koniec.
- **NA EX dané legálne ostáva:** odpoveď na NA EX alebo iná karta, ktorá potom koniec línie zmení, NA EX nezruší —
  leží a platí ďalej (§7). V ďalšej Pitke kola je koncom už nová karta, keď ju odpoveď na NA EX pridala.

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

**Konflikt (v11.3, Michal 2026-11-03):** efekt karty, ktorá sa **priložením**
ocitne vedľa **súperovej** karty — je jedno, či ju prikladáš ty k súperovej
karte, alebo súper svoju k nej (na koniec línie, v Zhromaždení aj odpoveďou na
NA EX). Do v11.2 len druhé. **Podpora (v11.3)** je zrkadlo Konfliktu: efekt karty,
ktorá sa priložením stretne s **vlastnou** kartou (s kartou toho istého hráča,
kdekoľvek v línii). Ráta sa len priloženie: **NA EX**, zrážka ani presun či
uzavretie medzery (Dohadzovačka, Poľovník) ich nespúšťajú. **Podloženie Nástroja** ich
nespúšťa (§12). Poradie: Nástup priloženej karty, potom
jej Konflikt a Podpora, potom Konflikt a Podpora ležiacej. Záverečná ich vyvolá
až pri otočení na konci Pitky (§13). Lokalita ani starší ich neprepožičiavajú.
**Vyvolať Konflikt** = priložiť kartu k súperovej ležiacej karte s Konfliktom
(§17). **S tagom** (frakcie, Michal 2026-11-08): „Podpora: Pamätník“ sa spustí len
pri vlastnom Pamätníkovi, „Podpora: Chlap“ (Snúbenica, v11.18) len pri vlastnom Chlapovi; Konflikt
s tagom by sa rovnako spustil len pri súperovej karte s tým tagom. **Bez tagu** pri
ktorejkoľvek — tak má Konflikt každá karta v sade (Michal 2026-11-08: Praudovravec,
Stryná, Podvodník, Vdova). Pri každom spustení zvlášť, bez stropu (po Poľovníkovi či
Dohadzovačke môže prísť tretí sused).

**Spoločník a Nepriateľ (frakcie):** „Spoločník: Pamätník“ platí, kým máš v partii
(karty natočené k tebe, ktorýkoľvek kraj) **inú** odkrytú kartu s tagom Pamätník;
„Nepriateľ: Kriminál“, kým má súper v partii odkrytú kartu s tagom Kriminál. Raz,
aj pri viacerých takých kartách. Ráta sa stav pri vyhodnotení. Skrytá Záverečná
podmienku nesplní ani nedostane (§13); Mäsiar ruší aj tieto efekty Zvierat. Akcie
navyše sú v pečati dole v ilustrácii karty; ×N, keď platia viackrát (§6). Stav „na spoji so súperovou kartou“ (Pes) je Furt, nie Konflikt.

**Občania v troch kategóriách** (Michal 2026-11-08, docs/napady/obcania-kategorie.json): efekt
Občana je jedného z troch druhov. **Školiteľ** — „Spúšťač: Preškolenie {X}→{Y}.“ (od v11.16 môže byť aj Zviera) so spúšťačom Furt,
Podpora alebo Konflikt (§6 Preškolenie Školiteľa): Vedúcko, Sypač, Anonymný alkoholik, Profesionálny
tipér. **Efekt s vedľajšou akciou** — akcie navyše v pečati (§6): „Spoločník: tag {A}“, „Nepriateľ: tag
{A}“, „Podpora: {A}“, „Konflikt: {A}“, „Bitka: podmienka {A}“, „Posledná Pitka kola: podmienka {A}“,
„Furt: {A}“ bez podmienky (v11.17) a „Konflikt: Občan {Spálenie}“ (Krokodíl, v11.17).
**Textový efekt** — všetko ostatné slovami. Podpora a Konflikt sú bez tagu okrem Snúbenice („Podpora: Chlap“, v11.18); tag inak ostáva pri
Spoločníkovi a Nepriateľovi.

**Úplatok** (v7) zanikol vo v10.3 (Michal 2026-11-02) — mal ho len Kulturista, ten je teraz Sypač.

**Výklad (v11.5, identita kariet; Michal potvrdil 2026-11-10):** kde znenie nových efektov nechalo otázku, platí
najjednoduchší výklad — každá karta (aj každé Noviny v Dedičstve) platí zvlášť; „tvoji“ = karty natočené
k tebe; „okolie“ = susedia v línii (§16 vyššie); posilnené = ×2. Noviny hneď po rozhodnutí hádky,
Kôň v kroku Exekútora. Michal ich potvrdí.

| Karta | Výklad |
|---|---|
| Veľmi smútiaca vdova | Konflikt (frakcie; Michal 2026-11-08, bez tagu — pri ktorejkoľvek súperovej karte, predtým len pri Chlapovi): súper odhodí **1 náhodnú kartu z ruky** do svojho odhadzovacieho balíčka — vyberie ju náhoda, nie súper; ktorú, vie len on. Prázdna ruka = nič |
| Policajtka | Nepriateľ: Kriminál (frakcie): 1 Petelica navyše |
| Stryná | Konflikt (frakcie; bez tagu od 2026-11-08, predtým Závislý): 1 Pohoršenie navyše za každé stretnutie so súperovou kartou, do konca kola |
| Recidivista | Nepriateľ: Zahraničný (frakcie): 1 Pecka navyše. Je aj Zviera — vedľa Mäsiara neplatí |
| Liberál | Furt (v10.3, Michal 2026-11-02): ak máš v partii (tvoje karty v línii, v ktoromkoľvek kraji) rovnako žien a chlapov, všetky jeho aktívne akcie sú posilnené (×2; násobí sa s ostatnými násobkami). Rátajú sa karty s tagom Žena / Chlap; Liberál má oba, ráta sa za oboch; skrytá Záverečná sa neráta. Do v10.2: súper bez rovnováhy získal v Pitke 1 zadĺženie. |
| Živnostník | Podpora (bez tagu, Michal 2026-11-09): pri každom stretnutí s vlastnou kartou si majiteľ vyberie z ponuky 1 kartu s tagom **Nástroj** a vezme si ju zadarmo do ruky (v 2 na 2 člen, ktorý Živnostníka vyložil). Kým nevyberie, hra čaká ako pri Zastávke; ponuka sa nedopĺňa; bez Nástroja v ponuke nič. Do 2026-11-09 Spoločník: Autorita (1 Robota navyše) a s Nástupom Nástroj z ruky hneď pod neho. |
| Šarlatán | Spoločník: Autorita (frakcie): 2 Povery navyše |
| Pes | Furt: jeho aktívne akcie na spoji so súperovou kartou (strana Psa k tej karte) sa rátajú dvakrát; násobky sa násobia (§7). Platí aj podstrčený či podstrčením vzniknutý spoj. |
| Mäsiar | Furt (Michal 2026-10-28): **efekty Zvierat** v jeho okolí (oboch hráčov) neplatia, kým s ním susedia; ich **akcie sa rátajú normálne**. Týka sa Psa, Koňa a Čiernej mačky (Furt), Krokodíla (Spálenie na konci bitky — rozhoduje okolie na konci bitky), Kapybary (Preškolenie susedov, kým susedia) a Recidivistu (Zviera aj Občan; Prehra — rozhoduje okolie v chvíli, keď sa efekt spúšťa). **Zviera-Školiteľ** (v11.16): jeho Preškolenie vedľa Mäsiara neplatí — Furt ani preškolenie, ktoré zapísal Podporou či Konfliktom, kým s Mäsiarom susedí. Mäsiar lícom dole (Záverečná) ešte nič neumlčí. Do 2026-10-28 Mäsiar rušil akcie Zvierat. |
| Krokodíl | Konflikt: Občan {Spálenie} (v11.17, Michal 2026-11-09): súperov **Občan**, s ktorým sa Krokodíl priložením stretne (oboma smermi), sa **na konci bitky spáli** — Starešinu ani Zviera bez tagu Občan nie, Recidivistu (Občan aj Zviera) áno (§6 Spálenie v pečati, krok 6c) — za každé stretnutie ďalšia karta. Jej akcie v bitke ešte platia; Nástroj pod ňou ide tomu, kto ho podložil; presvedčený starší je nezničiteľný (§10). Vedľa Mäsiara na konci bitky nespáli nič. Do v11.16 Bitka: spálili sa všetci Občania a Zvieratá v jeho okolí (oboch hráčov). |
| Kapybara | Školiteľ (v12, Michal 2026-11-11: „Kapybara bude premieňať Vieru na Cigarety, bez ohľadu na to, či je to súperova alebo moja karta, proste Preškolenie Viera → Cigarety“): **Furt** — Preškolenie {Viera}→{Cigareta}: **obaja priami susedia** v línii (karty oboch hráčov, aj lícom dole) majú **Viery ako Cigarety**, kým s Kapybarou susedia (§6); karta sama ani hrana lokality nie. Strany: Viera, Cigareta + Posilnenie (v11.17). Je Zviera: vedľa Mäsiara Preškolenie neplatí. v11.17–v11.21 Podpora aj Konflikt Preškolenie (karta, s ktorou sa stretla) a Furt {Cigareta}; do v11.16 Nástup: súperove reči pri jednom staršom klesli zospodu o stupeň. |
| Kohút | **Dočasne vyradený (v9.2, Michal 2026-10-30)** — posledné slovo pri odpovediach na NA EX zaniklo (odpovede lícom dole, §7); v sade karta nie je (vyradená v sade v51), prerobí sa. V jadre nemá účinok (TODO). Predtým: posledné slovo mal jeho majiteľ aj ako obranca. |
| Pijan | Bitka: za každé NA EX, ktoré majiteľ v tomto kole dal (poldeci ešte leží na karte), **Rana navyše** (akcia navyše, §6; Vidly ju zosilnia) — za každého Pijana. |
| Milujúca manželka | Pitka: tvoje poškodenie pečene v Pitke je o 1 menšie (najprv z akcií Poškodenie pečene, potom z Poldeci); latku Absťáku (Chuť) nemení, nie je Kliatba. |
| Opatrovateľka | Spoločník: Pamätník (Michal 2026-11-08): 1 Robota navyše, kým máš v partii iného odkrytého Pamätníka. Do 2026-11-08 Podpora: Pamätník — Robota za každé stretnutie. |
| Absťák | Kliatba bez akcií (v9.1, §8): Bitka — každý Absťák v tvojom balíčku (ruka, doberací, odhadzovací) ti uberie 1 tuhé; remízu v tuhom prehráva, kto ich má viac. Nedá sa priznať ani vyložiť; po bitke ide z ruky do odhadzovacieho balíčka. Spáliť ju smie len Vízia alebo efekt, ktorý to výslovne povie. |
| Miňištrant | Nepriateľ: Starešina (v11.18, Michal 2026-11-09): 1 Pecka navyše, kým má súper v partii odkrytého Starešinu. Do v11.17 Spoločník: Zahraničný — Pecka. |
| Dievčina na vydaj | Podpora (bez tagu, Michal 2026-11-08): 1 Povera navyše za každé stretnutie s tvojou kartou, do konca kola. Do 2026-11-08 Podpora: Zahraničný — Pohoršenie. |
| Snúbenica | Podpora: Chlap (v11.18, Michal 2026-11-09): 1 Cigareta navyše za každé stretnutie priložením s tvojím Chlapom (oboma smermi), do konca kola; pri inej karte nič. Do v11.17 Nepriateľ: Autorita — Pohoršenie; do 2026-11-08 Podpora vracala súperovo NA EX z tvojho Chlapa. |
| Bzdocha | Pitka: Súper hrá Pitku pred tebou; vidíš jeho NA EX. Majiteľ čaká, kým súper skončí svoju časť Pitky, potom hrá a vidí súperove skryté NA EX; majú ju obaja → nečaká nikto (§7, Michal 2026-10-27). |
| Záhradkár | Exekúcia (Michal 2026-10-28): „Exekúcia v tomto kole pre teba neplatí.“ Keď leží odkrytý v línii v partii majiteľa (jeho karta, kdekoľvek v línii), Exekútor ho v kroku exekúcie (§9, 4d) obíde — nezhorí mu žiadny Dlh ani špak. Nespáli sa; v ruke či v balíčkoch nerobí nič. Súperov Záhradkár ťa nechráni. |
| Anonymný alkoholik | Školiteľ — Podpora: Preškolenie {Pečeň}→{Viera} (Michal 2026-11-08, §6): tvoja karta, s ktorou sa priložením stretne, má do konca kola **Poškodenie pečene ako Vieru** — na oboch hranách aj v akciách navyše; v Pitke nedá pečeň, v bitke ako každá Viera ruší Povery a tlmí tuhé. Súperova karta nie (to by bol Konflikt); jeho vlastné akcie tiež nie. Do 2026-11-08 Furt na tvojich susedov; do v11.4 Nástup: priznal nepriznané Cirhózy z odhadzovacieho balíčka. |
| Poľovník | Nástup (v10.4, Michal 2026-11-02): v **druhom kraji** (oproti kraju, kde Poľovník leží, nech ho zahral ktokoľvek) sa **spáli súperovo Zviera, ktoré je od lokality najďalej**. Súperovo = karta s tagom Zviera natočená k súperovi toho, kto Poľovníka zahral (aj Recidivista — Zviera aj Občan); vlastné Zvieratá nestrieľa. Povinné, bez voľby, hneď pri Nástupe (ako Dohadzovačka). Spálená karta ide navždy z hry, medzera sa uzavrie a spoje aj prevaha sa prepočítajú; na špaky sa už neráta (§14). Spálenie **nie je priloženie** — Konflikt ani Pasca sa nespustia. **Skrytú Záverečnú** nestrieľa (vyberie najvzdialenejšie z odkrytých); ako Záverečná či odpoveď na NA EX sa Poľovník vyhodnotí pri otočení a karty, ktoré sa otáčajú v tej istej chvíli, nestrieľa (keď prišiel, ležali lícom dole). Poldeci z NA EX na spálenej karte sa hneď vypije tomu, kto NA EX dal (ako v bitke, §9.5, s nerestou). Dvojčatá nie sú Zviera. Nástroj podložený pod spálenú kartu ide hneď do odhadzovacieho balíčka toho, kto ho podložil (§12); keď sa spáli Kôň, Nástroje už podložené pod Zvieratá ostávajú. Vo finále rovnako. Ak v druhom kraji súperovo Zviera nie je, nič sa nestane. |
| Predavačka | Podpora (bez tagu, v12, Michal 2026-11-11: „vezmi si jednu kartu z ponuky do dobieracieho balíčka“): pri každom stretnutí s vlastnou kartou si majiteľ vyberie z ponuky **1 hocijakú kartu** a položí ju **navrch svojho doberacieho balíčka** (v 2 na 2 balíček tímu; vyberá člen, ktorý Predavačku vyložil). Karta z ponuky je verejná — súper vie, čo leží navrchu. Kým nevyberie, hra čaká ako pri Zastávke; ponuka sa nedopĺňa; bez kariet v ponuke nič. 2026-11-09 až v11.21 Občan z ponuky do ruky; predtým dober si 1 kartu. |
| Vedúcko | Školiteľ — Podpora: Preškolenie {Robota}→{Pecka} (v11.18, Michal 2026-11-09, §6): **tvoja karta, s ktorou sa priložením stretne** (oboma smermi), má do konca kola **Roboty ako Pecky** — pred spojmi, na oboch hranách aj Roboty navyše; Pecky patria majiteľovi tej akcie — Dlh nepália, dávajú 2 tuhé; Posilnenie aj Forsáž ich zdvoja ako Pecku, Fúrik ani špak za Robotu bez Dlhu sa na ne neuplatnia. Súperova karta nie (to by bol Konflikt); druhý sused, s ktorým sa nestretol, nie; Vedúcko sám seba nie; Robota hrany lokality nie; tá istá karta pri ďalšom stretnutí nič nové. Robotu, ktorú skôr preškolil Nástroj pod kartou či skoršia Podpora a Konflikt Školiteľa, nemení. Do v11.17 Furt: Roboty oboch susedov (aj súperových), kým susedia; do 2026-11-08 to isté slovami (v10.4). |
| Dohadzovačka | Nástup (Michal 2026-10-28; v11.19 len z konca kraja, Michal 2026-11-09): keď ju hráč priloží k Občanovi alebo Starešinovi O2 (jej vnútorný sused, karta ktoréhokoľvek hráča), presunie sa za Dohadzovačku — na koniec línie za ňou — **len karta O1 na konci druhého kraja** (najďalej od lokality), ak je to Občan alebo Starešina opačného pohlavia ako O2 (Žena ↔ Chlap; karta ktoréhokoľvek hráča). Hlbšie v druhom kraji sa nehľadá. Príklad: „O1 … … O2“, Dohadzovačka za O2 → „… … O2 · Dohadzovačka · O1“; „Silná nezávislá žena · Veterán“ v druhom kraji a Dohadzovačka za Dvojčatá (Chlap) → nič, na konci je Veterán (Chlap). Presun je **povinný**, bez voľby. Karta ostáva svojho majiteľa a natočená k nemu, medzera v druhom kraji sa uzavrie a spoje sa prepočítajú. Karta s oboma tagmi (Liberál) sa ráta ako oboje — ako O2 hľadá Ženu aj Chlapa, ako O1 sa hodí k obom. Presun **nie je priloženie**: Konflikt presunutej ani susednej karty sa nespustí a Pasca ho neráta. Skrytá Záverečná sa nepresúva (a ako O2 nerozhoduje) — keď leží na konci druhého kraja, nič sa nestane; ako Záverečná sa Dohadzovačka vyhodnotí pri otočení. Ak O2 nemá Ženu ani Chlapa alebo nie je Občan ani Starešina, ak na konci druhého kraja nie je Občan či Starešina opačného pohlavia, alebo je druhý kraj prázdny, nič sa nestane. Do 2026-10-28 Bitka: karta z ponuky za zmiešané spoje. |
| Sypač (id `kulturista`) | Školiteľ — Podpora: Preškolenie {Rana}→{Pecka} (Michal 2026-11-08, §6): tvoja karta, s ktorou sa priložením stretne (oboma smermi), má do konca kola **Rany ako Pecky** — pred spojmi, na oboch hranách aj Rany navyše (2 tuhé; Vidly ju nezosilnia, Valaška áno). Bez tagu — Chlap, Žena aj Zviera. Rany hrany lokality nie; Sypač sám seba nie; tá istá karta pri ďalšom stretnutí nič nové. Do 2026-11-08 len tvoj Chlap; do v11.4 Pitka: ako Výtržník mal Pecky namiesto Rán; do v10.2 Kulturista s Úplatkom. |
| Vymáhač | Bitka: za každé 2 tvoje priznané Dlhy **Rana navyše** (akcia navyše, §6) — za každého Vymáhača. |
| Finančná poradkyňa | Pitka: Dlhy z jej akcií dostáva súper, nie majiteľ. |
| Svokra | Bitka: za každú kartu majiteľa (kdekoľvek v línii, aj Svokru samu), na ktorej leží súperov poldeci z NA EX, udelí súperovi Ranu navyše (akcia navyše, §6); ráta sa aj zrážka (Výtržník), vlastné NA EX nie. Každá Svokra zvlášť. |
| Hasič | Podpora (frakcie, bez tagu; do v11.13 Nástup): z majiteľovho odhadzovacieho balíčka sa vytiahne náhodná karta (aj kliatba, aj Absťák); majiteľ si ju nechá v ruke, alebo ju vráti. Kým nerozhodne, hra čaká. Prázdny balíček = nič |
| Šofér | Bitka: Ak si v tomto kole nedal NA EX {Pecka} {Rana} (Michal 2026-11-08): **Pecka a Rana navyše** (akcie navyše, §6; Valaška a Vidly ich zosilnia) — za každého Šoféra. Od v11.5 do 2026-11-08 Pecka a 1 cigareta na začiatku bitky; do v11.4 len Pecka. |
| Traktorista | Bitka (id `traktoristka`, v12, Michal 2026-11-11: „chcem, aby dával Pecku, keď má prevahu v kraji, žiadne Dlhy v efekte“): s **prevahou v jeho kraji** máš v bitke **1 Pecku navyše** (akcia navyše, §6; Valaška ju zosilní, Nástroj pod ním ju mení). Prevaha sa ráta v bitke, aj vo finále (pinnacle lokalita má kraje, §14b). Dlhy nedáva. v11.18–v11.21 Posledná Pitka kola: bez prevahy Dlh; do v11.17 aj Pecka s prevahou; do 2026-11-08 Dlh na začiatku bitky. |
| Podvodník | Konflikt (frakcie; bez tagu od 2026-11-08, predtým Influencer): 1 Obmedzenie navyše za každé stretnutie so súperovou kartou — v každej Pitke od spustenia do konca kola |
| Praudovravec | Konflikt (frakcie; bez tagu od 2026-11-08, predtým Autorita): 1 Pohoršenie navyše za každé stretnutie so súperovou kartou, do konca kola |
| Kočovník | Spoločník: Pamätník (frakcie): 1 Pecka navyše. Jeho akcie patria majiteľovi ako pri každej karte |
| Dvojčatá | Furt: do prevahy sa rátajú za dvoch — aj pre bonus Ihriska (v8). Lesná cesta ráta len Zvieratá. |
| Silná nezávislá žena | Furt (Michal 2026-11-08): aktívne akcie tvojich **Občanov a Starešinov**, ktorí s ňou susedia, sa rátajú dvakrát. Zviera ani Nástroj nie, ani keď je zároveň Občan (Recidivista); lokalitu a súperove karty nie. Predtým zdvojovala všetky tvoje susedné karty. |
| Zámočník | Furt (Náradie, Michal 2026-11-08): pod neho smieš podložiť **ľubovoľne veľa Nástrojov** (§12) — každý ťahom za cigaretu; Nástroje pod ním sa reťazia v poradí podloženia (v11.20, §12). Predtým: aktívne akcie Nástrojov v jeho okolí ×2. |
| Veterán | Furt: NA EX na Veterána jeho aktívne akcie nezruší, ale zdvojí; neaktívne ostanú neaktívne. |
| Veštica | Spoločník: Pamätník (frakcie): 2 Povery navyše. Starý efekt (Prehra: výmena kariet balíčkov, §9.5b) má len stará sada. |
| Degustátorka | Nástup: ak má súper viac plných poldeci ako ty, jeden sa mu otočí na vypitý (nie nerest ani pečeň). V Zhromaždení mu tým **hneď klesne limit vykladania o 1** (v11.16; od v12.2 je limit = plné poldeci). Porovnáva sa po tom, čo majiteľ za Degustátorku zaplatil plný poldeci (výklad v12.2). |
| Vandal | Nástup: lokalita sa otočí o 180° (hrany si vymenia kraje). |
| Kôň | Furt (Náradie, Michal 2026-11-08): kým leží v línii (odkrytý, neumlčaný Mäsiarom), smie každý hráč podložiť Nástroj aj pod **Zviera** — pod Koňa aj pod ostatné Zvieratá (§12). **Roboty Koňa pália o 1 Dlh viac** (v11.5): každá jeho aktívna Robota (s násobkami) spáli v kroku Exekútora o 1 priznaný Dlh viac; čo nemá čo spáliť, dá špak ako každá Robota (§11). Sčíta sa s Fúrikom. Vedľa Mäsiara ani jedno neplatí; Robota, ktorú Vedúcko ráta ako Pecku, nepáli. |
| Čierna mačka | (v8.3, P5 rozhodol Michal 2026-10-30) Furt: majiteľove Povery sa Vierou nerušia — v hádke dajú vždy mäkké (v10), súperova Viera ostáva na tuhé. |
| Strýko z Ameriky | Nepriateľ: Autorita (frakcie): 2 Rany navyše; Vidly ich zosilnia (sú to tvoje Rany) |
| **Starší** | Karta staršieho (boss) má v línii **len akcie**; schopnosť (raz za hru) má výhradne držiteľ väzňa (§10, v11.2). Do balíčka hráča sa dostane presvedčením (v11.4, §10). Znenia a spresnenia schopností sú v §10 (tabuľka Schopnosť väzňa); na karte stojí „Väzeň — raz za hru: …“. |
| **Nástroje** | Efekt Nástroja (text v strede) platí len v Dedičstve; podložený pod kartou pôsobí len pretŕčajúcou hranou (§12). |
| Noviny | Dedičstvo: Hádka (v11.5, Michal 2026-11-03): keď vyhráš hádku (krok 1 bitky, §9.1; aj vo finále), súper **odhodí 1 náhodnú kartu z ruky** do svojho odhadzovacieho balíčka — za každé Noviny v Dedičstve. Remíza v hádke nič; súper s prázdnou rukou nič. Do v11.4 Dedičstvo: Prehra (Titulka): špaky za Dlhy víťaza navyše. |
| Krabička cigariet | Dedičstvo: Pitka: za každé 2 cigarety, ktoré súper v Pitke vyfajčí (rátajú sa zaplatené cigarety), si hneď doberieš 1 kartu. Nie je to nerest. |
| Pasca | Dedičstvo: Bitka (v12, Michal 2026-11-11: „za KAŽDÚ priloženú kartu od súpera k mojej karte mu dám Ranu navyše v bitke“): **1 Rana navyše za každú kartu**, ktorú súper v tomto kole priložil k tvojej karte — akúkoľvek, aj lícom dole (Záverečná, odpoveď na NA EX); každá karta sa ráta raz, keď ju priložil (akcia navyše, §6; Vidly ju zosilnia; za každú Pascu v Dedičstve). Presun Dohadzovačkou, spálenie Poľovníkom ani podloženie Nástroja priloženie nie sú. Do v11.21 1 Rana, ak priložil aspoň jednu (v9.1 podľa textu karty od sady v36; predtým Pecku). |
| Puška | **Hrany** (Michal 2026-11-09): Hore: Posilnená {Petelica}, Dole: Posilnená {Pecka} — aktívne Petelice, resp. Pecky hostiteľa ×2 (§12). Dedičstvo (Michal 2026-10-30, mení v7 „+1 k Petelici“): keď by tvoju **prepojenú** Petelicu zrušil iný efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej (3 → 2; v súčtoch sa ráta ako Pecka). Prepojená = má na spoji partnera (aktívna len zo Vzbury nie); na karte so Vzburou (v11.1) sa Puška neuplatní — prepojená Petelica je tam neaktívna. súperove Hrable nemajú čo ukradnúť (zrušenie nenastalo); Výtržník akcie nezrušuje (mení na Rany) — Puška sa neuplatní; NA EX ďalej zdvojí neaktívne akcie karty, prepojená Petelica ostane na 2. Text karty už znie podľa tohto pravidla. |
| Náradie (v8.4) | Zapaľovač, Výherné žreby, Izolačka, Hrable, Zrkadlo, Valaška, Telefón, Jogurt, Energeťák, Horoskop, Fúrik, Krištáľová guľa — §12, tabuľka Náradie; hrany všetkých Nástrojov §12 (v11.16). |
| Profesionálny tipér | Školiteľ — Konflikt: Preškolenie {Cigareta}→{Hazard} (Michal 2026-11-08, T1, §6): súperova karta, s ktorou sa priložením stretne (oboma smermi), má do konca kola **Cigarety ako Hazard** — namiesto cigarety Dlh súperovi, aj Cigarety navyše. Do 2026-11-08 Furt (v8.4): posilnené akcie na jeho spojoch — súperove ako posilnený Hazard, tvoje ako posilnená Robota. |
| Vidly | Dedičstvo: každá tvoja aktívna Rana — z vyložených kariet (aj hrany lokality) aj akcia navyše (§6: frakcie, Pijan, Svokra, Vymáhač, Pasca) — udelí o 1 poškodenie viac (Michal 2026-11-08; výnimka z 2026-10-27 zrušená). |
| Výherný automat | Dedičstvo (v12, Michal 2026-11-11: „prah o 1 vyšší, ale každú Pitku 1 Dlh“): tvoj prah Dlhu je o 1 vyšší (§8); Pitka: **Hazard** v pečati — v **každej Pitke** rovno 1 Dlh (nie zadĺženie cez prah), Obecný úrad ho zdvojí. Do v11.21 len v poslednej Pitke kola. |
| Svätý text | Dedičstvo: Hodnota tvojej Viery je o 1 vyššia. — Hodnota 2 platí len v tlmení tuhého (§9.3); Povery ruší Viera 1 : 1 ako každá — jedna Viera jednu Poveru, aj vylepšenú Horoskopom (Michal 2026-11-01, v10). |
| Vínko | „Dedičstvo: Tvoje maximum poldeci je o 1 vyššie.“ (v12.2) Pri vyložení pribudne **plný poldeci** — v Zhromaždení je to hneď o kartu viac; po každej bitke sa obnoví ako ostatné a po finále sa vykúpi. Druhé Vínko nepridá nič (výklad v12.2). |
| Nealko | Dedičstvo: tvoj prah Cirhózy je o 2 vyšší (sčíta sa s Krčmou). Poldeci, NA EX ani akciu Poldeci nemení. |
| Injekcia | Dedičstvo: NA EX smieš dať aj na Zviera. |

---

## 17. Slovník

| Pojem | Význam |
|---|---|
| Absťák | karta s tagom Kliatba (v9.1) za menej nerestí v kole, než je tvoja Chuť; ide do odhadzovacieho balíčka, nedá sa priznať, −1 tvoje tuhé za každú v balíčku; rozhoduje remízu; spáli ju Vízia (§8, §9.3, §9.4) |
| Chuť | verejné počítadlo hráča (v9.1), štart 0: latka nerestí na konci kola; potom väčšie z (Chuť, neresti) − 1 (§8) |
| Dlh | počítadlo priznaných Dlhov (v8.2, nie karta) — každá akcia Hazard = 1 Dlh; páli ho Exekútor, rozhoduje remízu v tuhom (§8, §11) |
| Hazard | akcia (kľúč `Dlh`, v8.2 premenovaná): v Pitke dá 1 Dlh (§2, §8) |
| Zadĺženie | čo dáva Hazard a efekty kariet: 1 zadĺženie = 1 Dlh; len s Výherným automatom je Dlh za každé 2 a zvyšok ostáva na účte (§8) |
| Finále | posledná bitka o pinnacle lokalitu, hrá sa ako o každú inú; útočí zaostávajúci (menej špakov) (§14b) |
| Dedičstvo | Nástroj vyložený mimo línie za rastúcu cenu v cigaretách; platí jeho efekt Dedičstvo (§12) |
| Podloženie | Nástroj z ruky pod svojho Občana či Starešinu v línii (len pod vlastné karty, v11.16) za 1 cigaretu; platí pretŕčajúca hrana, leží do bitky, potom ide tomu, kto ho podložil (§12) |
| Preškolenie | akcia X sa ráta ako Y — zápis {X}→{Y}; akciová hrana Nástroja preškolí všetky X karty pred spojmi (§12); Školiteľ „Furt/Podpora/Konflikt: Preškolenie {X}→{Y}.“ susedov či karty, s ktorými sa stretne (§6). Premeny sa reťazia: Školitelia, potom Nástroje, každá na výsledku predošlej (v11.20) |
| Školiteľ | Občan alebo Zviera (v11.16) s efektom Preškolenie (Vedúcko, Sypač, Anonymný alkoholik, Profesionálny tipér; §6, §16); Zviera-Školiteľa umlčí Mäsiar |
| Efekt s vedľajšou akciou | efekt Občana s akciami navyše v pečati (§6, §16) |
| Textový efekt | efekt Občana slovami — nepreškoľuje ani nepridáva akcie (§16) |
| Dobratie po bitke | na začiatku každého ďalšieho kola 2 karty bez ohľadu na ruku (v11.21); limit ruky nie je, nič sa neodhadzuje (§4) |
| Výpalné | hneď po bitke 1 cigareta z banky za každého staršieho s tvojím červeným strachom (v11.9, v12.4, §10) |
| Konflikt | spúšťač (v11.3): efekt karty, keď sa priložením ocitne vedľa súperovej karty — prikladáš ty alebo súper; podloženie Nástroja, NA EX, zrážka ani presun ho nespúšťajú (§6, §16) |
| Podpora | spúšťač (v11.3): zrkadlo Konfliktu — efekt karty, keď sa priložením stretne s inou kartou toho istého hráča (§6, §16) |
| Vyvolať Konflikt | priložiť kartu k súperovej ležiacej karte so spúšťačom Konflikt (§16) |
| Spoločník / Nepriateľ | spúšťač (frakcie): akcie navyše, kým je v tvojej / súperovej partii odkrytá karta s tagom (§6, §16) |
| Akcia navyše | aktívna akcia majiteľa karty mimo jej hrán, z pečate v ilustrácii; ráta sa ako tá istá akcia (§6). „Furt: {A}“ platí bez podmienky, kým karta leží (v11.17); {Spálenie} v pečati nie je akcia — karta, s ktorou sa nositeľ stretne, sa na konci bitky spáli (§6). Mení ju Školiteľ, celý podložený Nástroj — preškolenie, hrana posilnenia — a Forsáž karty, zo spoja aj z Energeťáka (v12) |
| Bitka (akcia navyše) | podmienka slovami pred piktogramom („Bitka: Ak si v tomto kole nedal NA EX {Pecka}“): akcia navyše toľkokrát, koľkokrát podmienka platí v bitke (§6, §16) |
| Forsáž | Posilnenie + Posilnenie na spoji (v10.3): obe karty majú všetky aktívne akcie posilnené (×2); lokalita len hranu; NA EX na jedno z Posilnení ju zruší (§6). Aj z Energeťáka pod kartou — tú NA EX nezruší a platí na akcie aktívne po NA EX, neaktívne aktivované NA EX ×4 (v11.21, §12) |
| Vzbura | Odpor + Odpor na spoji (v11.1): obe karty sa obrátia — nespojené akcie aktívne, spojené neaktívne; Odpor + Posilnenie: len karta s Odporom, navyše posilnená; NA EX na ňu nejde; lokalita len hranu (§6, §7). Aj z Vidiel pod kartou (§12) |
| Pakt | akcia (v7): na spoji sa správa ako akcia, s ktorou je v páre (§2) |
| Čiarky na účte | zadĺženie pod prahom Dlhu (len s Výherným automatom); neprepadá ani po Pitke, ani po kole (D6, §8) |
| Kraj | polovica línie od lokality, pomenovaná podľa hrany lokality (Krčma: pri výčape / pri dverách); nepatrí nikomu (§6) |
| Limit vykladania | plné poldeci (v12.2) — každá karta do línie jeden otočí na vypitý; po Pitke sa 1 doleje zadarmo, po bitke sa obnovia všetky (§6) |
| Línia | celý rad kariet v kole; lokalita v strede (§6) |
| Koniec línie | jeden z dvoch koncov línie, kam sa vykladá; nepatrí nikomu (§6) |
| NA EX | plný poldeci na Občana či Starešinu v línii, vybraný v Pitke skryto: zruší jeho aktívne akcie a zdvojí neaktívne (§7) |
| Nástup | vyhodnotenie pri zahraní karty |
| Nerest | len konzumácia (v9.1): Vypiť (karta navyše v ťahu) 1, odpoveď na NA EX 1, NA EX 2, vyfajčená cigareta 1 — porovnávajú sa s Chuťou (§8) |
| Furt | platí, kým je karta odhalená kdekoľvek v hracom priestore |
| Odhodenie (odhodiť) | do odhadzovacieho balíčka hráča, ktorý kartu zahral — vráti sa do hry, keď sa doberací minie a odhadzovací zamieša; opak spálenia |
| Odpoveď na NA EX | po odkrytí za každé súperovo NA EX jedna karta z ruky do línie lícom dole, za plný poldeci (vypije sa: pečeň +1, nerest; v11.16) a mimo limitu; najprv útočník, potom obranca na druhý kraj línie, obe sa otočia naraz (§7) |
| Pohoršenie | akcia: 2 mäkké poškodenie do hádky (v10); Viera ho nezruší (§2, §9.1) |
| Povera | akcia: 1 mäkké poškodenie do hádky (v10; s Horoskopom 2); ruší sa so súperovou Vierou 1 : 1 (§2, §9.1) |
| Mäkké poškodenie | Pohoršenie × 2 + zvyšné Povery × sila Povery; tuhé nerobí, rozhoduje len hádku (v10, §9.1) |
| Hádka | spúšťač (v11.5, Noviny): efekt, keď sa v bitke rozhodne hádka. Krok bitky (v10, v11): kto má viac mäkkého, vyhral hádku o rozdiel („Ana vyhrala hádku o 3“); po bodovaní ho rozdelí na svoje reči na teplomeroch súpera (1 / 2 / 3 za stupeň), vo finále 1 : 1 na špaky (§9.1) |
| Reči | blok stupňov hráča na teplomere súpera; dvíha ich hádka a Predsedova vila, stupne 1 / 2 / 3 bodujú pri každej bitke tomu, kto ich drží, klesajú zospodu po prehratej hádke, priazeň nedávajú (§10, v11.12) |
| Strach | marker hráča pri staršom 0–3 — ako veľmi sa ho starší bojí; neklesá; dvíha ho Nakladačka; priazeň = strach súpera − tvoj strach (§10, v11) |
| Partia | všetky karty natočené k hráčovi (jeho karty), kdekoľvek v línii (§6) |
| Zajatie | pri rozdelení Nakladačky za 5 bodov staršieho, pri ktorom je tvoj strach 3 už pred touto Nakladačkou (od minulého kola; dotiahnutý v tom istom rozdelení nestačí, v11.6): väzeň, krádež špakov; vo finále nie (§9.4, §10, v11.4; v9–v11.3 pokus o zajatie v drafte) |
| Presvedčenie | pri rozdelení hádky za 3 body ktoréhokoľvek staršieho, keď máš reči na celom teplomere: reči aj priazeň ostávajú, jeho karta natrvalo do tvojho balíčka; kto prvý, toho je (§9.1, §10, v11.4) |
| Väzeň | zajatý starší v priznaných kartách držiteľa („v pivnici“) — nedáva priazeň ani strach, držiteľ má jeho schopnosť (raz za hru); ráta sa ako jeho červená; väzni na výhru podľa ligy (2 / 3 / 4); pri zajatí krádež špakov (v11) |
| Boss | karta staršieho: 6 akcií, 2 blokované sloty, 1 neresť; v línii len akcie; do balíčka hráča ju dá presvedčenie (§10, §16) |
| Schopnosť väzňa | schopnosť zajatého staršieho; jeho držiteľ ju použije raz za hru vo svojom ťahu, potom je minutá a väzeň ostáva v pivnici (§10, v11.2; Kšeft väzňa v9–v11.1 zanikol) |
| Nástenka | krčmová nástenka: odohrané bitky s víťazom a špakmi (§14) |
| Náradie | balíček kariet s tagom Nástroj lícom dole; pri stavbe ponuky z neho každý dostane 2 karty (§3, §5) |
| Občania | balíček všetkých ostatných kariet ponuky lícom dole; pri stavbe ponuky z neho každý dostane 6 kariet (§3, §5) |
| Nakladačka | (predtým prebytok, v8.3) rozdiel tuhého poškodenia v bitke, drží a rozdeľuje ju víťaz na svoj strach (1 / 2 / 3 za stupeň, zvyšok prepadne); vo finále 1 : 1 na špaky (§9.4, v11) |
| Prevaha | v kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov (Nástroje, Cirhóza nie); pri rovnosti hráč, ktorého karta v tom kraji leží hneď pri lokalite; dostane akcie hrany lokality v tom kraji (§6) |
| Priznanie | vyloženie kliatby mimo línie natrvalo; nemíňa poldeci ani neodovzdá ťah (§11) |
| Sekera | bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch); jej špaky (karty v línii) berie víťaz najbližšej bitky, vo finále prepadnú (§9.4) |
| Špak | za bitku (karty v línii), za strach a reči pri starších v každej bitke (krok 4b), krádež pri zajatí, výkupné zvyšných poldeci a cigariet; mínus Exekútor a nepriznaná Cirhóza; po finále vyhrá, kto má viac (§14) |
| Stupeň | poloha markera (strachu či rečí) na stupnici staršieho: 0 sivá, 1 žltá, 2 oranžová, 3 červená; cena vstupu 1 / 2 / 3, špaky po bitke 1 / 3 / 6 (§10, v11; v11.20) |
| Stav staršieho | stupeň staršieho pre hráča: pokojný (0), znepokojený (1), vystrašený (2), vydesený (3) — jeho strach; do priazne, výhry strachom a zajatia sa ráta celý, aj obsadený rečami (§10, v11.12) |
| Od seba / k sebe | smer posunu markera na stupnici; od seba staršieho desí, k sebe upokojuje (§10) |
| Ponuka | ponuka kariet lícom nahor; obaja vidia, čo berú (§5) |
| Útočník / obranca | útočník je **porazený z minulej bitky** (v prvom kole náhodne, pri sekere ostáva; vo finále menej špakov, §14b) — vykladá prvý a na NA EX odpovedá prvý (lícom dole); obranca je víťaz minulej bitky — volí a natáča cieľ, berie z ponuky prvý (na prvom ťahu 1 kartu, v9.2), na NA EX odpovedá druhý na druhý kraj línie; Pitku hrajú obaja naraz (§4, §7) |
| Výtržník | karta, na ktorú obaja dali NA EX v tej istej Pitke (zrážka): všetky jej akcie sú aktívne Rany pre majiteľa, len počas jednej bitky (§7) |
| Vypiť | ďalšia karta v tom istom ťahu (v12.2): 1 cigareta, pečeň +1, nerest; poldeci otočí samotná karta — n kariet = n poldeci a n − 1 cigariet (§13) |
| Výkupné | po finále 1 špak za každý plný poldeci a 1 špak za každých celých 5 cigariet, bez stropu (§14) |
| Záverečná | karta lícom dole za cigaretu, ukončí vykladanie v Zhromaždení; otočí sa na konci Pitky (§13) |
| Spálenie (spáliť) | karta ide navždy z hry, nevracia sa do žiadneho balíčka (v10.4, Michal 2026-11-02; predtým „zahodenie“). Spálený Dlh zmizne z počítadla (Robota, Exekútor). Opak odhodenia |

---

## 18. Formát 2 na 2

**Len Zrejúca** (Michal 2026-11-06): vo Vypálenej sa 2 na 2 nedá založiť ani sa k nemu pripojiť.

Dva **tímy** po dvoch hráčoch, štyri zariadenia, jedna partia (Michal 2026-10-28).
Platí všetko z §1–§17 s rozdielmi nižšie. Zásada: **tím je hráč z 1 na 1 s dvoma
rukami.** Všetko, čo pravidlá hovoria o hráčovi — partia, zdroje,
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
  ponuky, Záverečnú, skryté NA EX a odpovede tímu, vrch balíčka z Vízie. Súperský tím
  z toho nevidí nič (`viewFor` filtruje podľa tímu).
- Karty sa medzi rukami **nepodávajú** (Michal 2026-10-28).

### 18.2 Čo je tímové a čo osobné

| Tímu | Hráčovi |
|---|---|
| prevaha v kraji, partia (karty natočené k tímu) | ruka |
| doberací a odhadzovací balíček | ťah v poradí |
| poldeci (plné, vypité, na NA EX) a limit vykladania | karta zo stavby ponuky |
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
- **Tím** začína so **4 cigaretami** a **6 plnými poldeci** — každý člen prináša svoje 3 (v12.2; ostatné na 0).
- **Prah Dlhu 2, prah Cirhózy 4** (o 1 vyšší ako v 1 na 1, kde je od v11.8 každý Hazard Dlh;
  Michal 2026-11-06: v tíme Dlh za 2 Hazardy); úpravy z kariet a lokalít (Nealko, Krčma,
  Výherný automat) sa pripočítajú.
- Útočný tím prvého kola sa určí zo semienka.

### 18.4 Priebeh kola (k §4)

- **Poradie ťahov** je vždy **U1 → O1 → U2 → O2** (vykladanie) a **O1 → U1 → O2 → U2**
  (branie z ponuky, Michal 2026-10-31).
- **Poldeci tímu** (v12.2): po bitke sa obnovia všetky, po každej Pitke sa tímu dolejú **2** vypité zadarmo
  (1 za každého člena) a akcie Poldeci; na začiatku kola sa nič neotáča.
  Od druhého kola si **každý hráč** dobere 2 karty do svojej ruky z balíčka tímu, v poradí
  U1, O1, U2, O2 (Michal 2026-11-06, k v11.9; počet 2 bez ohľadu na ruku od v11.21 — výklad Leadera, Michal nepotvrdil).
- Karta z fajčenia, Vízie, Zastávky či efektu „dober / vezmi do ruky“ ide do
  ruky **hráča, ktorý to spustil** (zahral kartu, fajčil).
- **Koniec kola:** neresti oboch členov sa sčítajú a porovnajú s **Chuťou tímu**;
  Absťák dostane tím (Michal 2026-10-31).

### 18.5 Cieľ a draft (k §5)

- Cieľ vyberá a natáča **O1**.
- **Stavba ponuky:** každý hráč dostane **1 kartu z Náradia a 3 z Občanov** a tajne
  dá **2 do ponuky** a 2 naspodok (Michal 2026-10-31). Ponuka má 8 kariet, dve od
  každého hráča.
- **Branie z ponuky:** O1 → U1 → O2 → U2 dookola; platí sa z tímových cigariet
  (1 karta za 1, 2 za 3), karty idú do ruky toho, kto berie. Len **O1 na svojom prvom
  ťahu** vezme 1 kartu (Michal 2026-10-31). Kto prestane, už neberie; keď prestanú
  obaja členovia tímu, každý ešte neprestavší člen druhého tímu má **jednu poslednú
  šancu**.

### 18.6 Zhromaždenie (k §6, §13)

- Hráč na ťahu vykladá **zo svojej ruky** na ktorýkoľvek koniec
  línie. Karta je natočená k jeho tímu a patrí do partie tímu.
- **Limit vykladania je tímový:** plné poldeci tímu (v12.2). Každá karta ktoréhokoľvek člena otočí
  plný poldeci tímu; karta navyše v ťahu (Vypiť) stojí cigaretu tímu.
- **Pas hráča** (Michal 2026-11-02, Q1): pas člena len ukončí jeho vykladanie a cigarety nedá. Keď pasuje
  aj druhý člen, dostane tím **cigaretu za každý plný poldeci tímu** (v12.3). Zhromaždenie končí, keď
  skončili všetci štyria.
- **Záverečná:** najviac **jedna za tím**, za 1 cigaretu tímu; ukončí vykladanie
  **celého tímu** bez cigariet (Michal 2026-10-28).
- **Priznanie:** Cirhózu z ruky smie priznať jej držiteľ; ide medzi priznané karty tímu.
- **Podloženie Nástroja** (§12, v11.16): „len pod vlastné karty“ = pod karty **svojho tímu**, aj pod
  kartu spoluhráča; pod kartu súperovho tímu nie.

### 18.7 Pitka (k §7)

- Pitku hrajú všetci štyria **naraz**. **Obaja členovia** smú fajčiť
  a barterovať z tímových zdrojov (doliatie za cigarety od v12.2 nie je); cena fajčenia rastie **za tím** (prvé fajčenie
  tímu v Pitke 1, druhé 2…) (Michal 2026-10-28).
- **NA EX:** tím dá najviac **jedno** (Vínna pivnica dve), z tímového poldeci; vyberá
  ho kapitán, ktorý aj skončí Pitku za tím („hotovo“). NA EX sa odkryjú naraz.
- **Odpoveď na NA EX:** za tím odpovie **jeden člen**, ktorého určí kapitán, jednou
  kartou zo svojej ruky lícom dole (za plný poldeci tímu, v11.16) — najprv útočný tím, potom obranný na druhý kraj;
  otočia sa naraz (Michal 2026-10-28, poradie podľa v9.2).
- **Spoločník** = karta tvojho tímu, **Nepriateľ** = karta druhého tímu. **Schopnosť väzňa** smie každý člen použiť vo svojom ťahu, na väzňa raz za hru;
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

Tím má jedny špaky. Výkupné z tímových poldeci a cigariet (po finále sa poldeci neobnovujú); nepriznaná Cirhóza −3
z oboch rúk a balíčkov tímu. Vo finále útočí tím s menej špakmi.

### 18.10 Výklad kariet a lokalít (k §15, §16)

- **„Súper“** = súperský tím ako celok (Michal 2026-10-28). Efekt na súpera ho zasiahne
  **raz** — zdroje, kliatby aj balíček má tím jedny.
- **„Ty“, „tvoj“, „tvoja partia“** = tvoj tím. Partner nie je súper: jeho priloženie
  nespúšťa Konflikt tvojich kariet.
- **„Do ruky“** = do ruky hráča, ktorý efekt spustil (18.4).
- Lokality a karty, ktoré rátajú hráčov (Zastávka, Autobusár, Krčma, Stryná, Jednota,
  Benzínka, Cintorín, Most, Ihrisko, Lesná cesta, Kultúrny dom, Herňa), rátajú
  **tímy**. Zastávka: zadarmo si kartu z ponuky vezme **kapitán** tímu.

---

## 19. Režim Päta, Lakeť, Otočka

**Len Zrejúca** (Michal 2026-11-06): vo Vypálenej sa tento režim nedá založiť ani sa k nemu pripojiť.

Druhý režim vedľa Kalamity (Michal 2026-10-31, 2026-11-01, 2026-11-06), len 1 na 1. Platí všetko z §1–§17 s rozdielmi nižšie.

### Cieľ

Podraziť všetkých štyroch starších súpera. Hra nemá ligu, finále, špaky, výkup ani remízu.
Nie sú ani strach, reči, hádka, priazeň, väzni, zajatie a schopnosti starších.
Kolo ostáva z Kalamity: lokalita, ponuka, Zhromaždenie, Pitky s NA EX, bitka.
Aj dobratie po bitke je ako v §4: 2 karty bez ohľadu na ruku (v11.21, výklad Leadera, Michal nepotvrdil).
Zdroje hráča ostávajú: poldeci, cigarety, Dlhy, Cirhózy, Absťáky, Chuť, Dedičstvo.

### Príprava

- **Draft:** kto vyberá prvý, určí semienko; 8 starších sa rozoberie hadovito A B B A A B B A.
- **Prvý obranca** je druhý v drafte.
- **Pečeň:** Farár 27, Krčmárka 36, Starosta 33, Poštárka 24, Hrobár 33, Autobusár 30,
  Veterinár 27, Vychovávateľka 27. Čísla sa doladia po prvej hre.
- **Sada bez:** Noviny, Horoskop, Čierna mačka, Kapybara, Kultúrny dom, Predsedova vila, Herňa.

### Lokality

Vždy 3 na výber, po jednej z úrovní 1, 2 a 3. Pinnacle sa nehrá. Vyberá a natáča obranca.
Odohraná lokalita ide naspodok svojej úrovne, takže lokality sa neminú.

### Rad starších

- Rad sú štyria starší mimo línie, spoje fungujú ako v línii.
- Hráči ho preskladajú **po braní z ponuky, naraz a skryto**. Starší sa neotáčajú.
- Aktívne akcie radu sa pripočítajú k línii **v každej Pitke aj v bitke**.
- NA EX, Odpor ani prevaha z línie do radu nezasahujú.
- **Podrazený starší** ostáva v rade ako spojka. Jeho akcie neplatia, sused na spoji s ním
  svoju akciu dostane. Jeho Odpor ani Posilnenie suseda nemenia.

### Bitka

Víťaz bitky: vyššie tuhé, pri zhode menej Absťákov, potom menej Dlhov, inak sekera.
Výhra dáva rolu obrancu v ďalšom kole, porazený dostane 1 cigaretu (pri sekere nikto).
Akcie línie a radu sa spočítajú na začiatku bitky, takže starší, ktorý padne pri
exekúcii, v tej bitke svoje akcie ešte dá.

### Krok 1: Robota, liečenie, exekúcia

Obaja naraz a skryto zvolia, čo spravia ich Roboty, potom sa odhalí:

- Každá aktívna **Robota** spáli 1 Dlh (s Fúrikom 2), alebo vylieči 2 pečene jednému vlastnému
  stojacemu staršiemu. Nad pôvodnú pečeň áno, oživenie nie.
- **Exekúcia** potom spáli polovicu Dlhov nahor a každý stojaci starší exekvovaného stratí
  1 pečeň za každý spálený Dlh. Štít ju netlmí. Záhradkár ju obíde.

Kto v tomto kroku príde o posledného staršieho, partia končí a druhý krok sa nerobí.

### Krok 2: Poškodenie, obaja naraz

Obaja naraz a skryto rozdelia celé svoje tuhé a jed na súperových stojacich starších.

- **Viera je štít na každom staršom zvlášť a prenáša sa medzi kolami.** Nová Viera pribudne
  každému stojacemu; 1 Viera teda zachytí viac poškodenia, ale len 1 na jedného staršieho.
  Hodnota Viery so Svätým textom platí.
- **Povery:** každá aktívna uberie 1 každému stojacemu súperovmu staršiemu, najprv zo štítu.
- **Tuhé** rozdelí každý hráč celé svoje (nie len rozdiel), po bodoch, aj nad zvyšok pečene.
  Najprv ide zo štítu daného staršieho.
- **Pohoršenie = jed** po kusoch na starších podľa výberu, verejne. Na konci bitky dostane starší
  poškodenie rovné svojmu jedu, potom jed klesne o 1; nový sa pripočíta. Nový jed
  pôsobí hneď v tej istej bitke. Štít jed netlmí. Na padnutom jed prepadne.

Príklad: štít 3, súper 2 Povery a 4 tuhé na Farára. Farár dá 3 do pečene a má štít 0, ostatní
štít 1. S novou Vierou 5 v ďalšej bitke: Farár 5, ostatní 6. Bez poškodenia: 3 + 5 = 8.

### Podrazenie a koniec partie

Starší s pečeňou 0 alebo menej padne. Tuhé ani jed sa naň už dávať nesmú.
Kto príde o všetkých, prehráva. Keď padnú poslední starší oboch v tej istej bitke, vyhrá menšie
**prečerpanie** = súčet záporných čísel pečene starších padnutých v tejto bitke (exekúcia, Povery,
tuhé, jed). Pri zhode: vyššie tuhé, menej Absťákov, menej Dlhov, nakoniec útočník.

### Koniec kola: Dať vyžrať

Hráč smie dať vlastnému stojacemu staršiemu **3 pečene za plný poldeci** (poldeci sa zmení na
vypitý), koľkokrát chce, aj nad pôvodnú pečeň. Je to po bitke, teda **po obnove poldeci** (v12.2) —
vyžratý poldeci chýba v ďalšom kole, kým sa po Pitke nedoleje. Za cigarety sa pečeň kúpiť nedá.

### Cirhóza

Cirhóza sa **prizná okamžite, keď sa dostane hráčovi na ruku**, bez náhradnej karty. Priznaná dáva
súperovi +1 tuhé v každej bitke. Na konci partie nestojí nič.

### Má dosť

Podrazený starší pomáha už len týmto efektom. Platí pri každom podrazení, aj vlastnou exekúciou.
Platí hneď od pádu, aj v zvyšku tej bitky.

| Starší | Názov | Efekt |
|---|---|---|
| Poštárka | Všetko vyklopím | Súperova ruka je pre teba odkrytá. |
| Veterinár | Liečim už len kravy | Hneď: zahoď všetky svoje Cirhózy. |
| Vychovávateľka | Do radu! | Po odhalení radov vymeníš v súperovom rade dvoch susedných starších. |
| Farár | Rozhrešenie | Jed na tvojich starších klesá o 2. |
| Autobusár | Ty nastupuješ prvý | Z ponuky berieš vždy prvý a hneď 2 karty. |
| Starosta | Kde sa pije, poviem ja | Lokalitu vyberáš a natáčaš ty. |
| Hrobár | Aspoň mám robotu | +1 tuhé za každého podrazeného staršieho na stole, aj súperovho. |
| Krčmárka | Už ti nenalejem | Súperovi sa po Pitke nedoleje poldeci zadarmo (v12.2, výklad: ani z Jogurtu; akcie Poldeci áno — predtým sa mu na začiatku kola neotočil vypitý poldeci). |

Poštárka: ruka ide len cez `viewFor` na serveri, s testom (nemenné pravidlo 2).
