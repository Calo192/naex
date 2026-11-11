# Kontrola EN — 2026-11-11 (vlna 3d)

Rozsah: 1544 prázdnych kľúčov v `apps/web/src/i18n/en.json` (profil, starší, tabuľa, rekapitulácie, panely,
herná plocha, medziobrazovky, Domov, vzory `motor.*` / `server.*`). Overené skriptom: každý kľúč vyplnený,
parametre `{…}` a značky `<b>/<strong>/<i>` sedia so slovenčinou, tvary len `1` a `5`; `npx vitest run i18n`
a `npm run typecheck` prechádzajú. Otázky: `docs/preklady/otazky-en-2.md`.

## Spätný preklad vzorky stola (40 kľúčov)

| Kľúč | Spätný preklad EN → SK | Verdikt |
|---|---|---|
| plocha.naexAktivna | NA EX ide len na kartu s aspoň jednou aktívnou a jednou neaktívnou akciou. | OK |
| plocha.uzOdpovedal | Súper tu už odpovedal lícom dole — tvoja odpoveď smie ísť len na druhý kraj línie. | OK |
| plocha.odporTitul | Nespárovaný Odpor sa postavil poldecu a uhasil NA EX — karta sa ráta, akoby tam nebolo. Keď sa Odpor spáruje, NA EX začne platiť. | OK; „zahasil“ = *snuffed out* drží krčmový obraz |
| plocha.vytrznikTitul | Zrážka NA EX: obaja ste dali poldeci na túto kartu. Do konca bitky je to Výtržník — každá jeho akcia je Rana pre {koho}. Po bitke vytriezvie. | OK (*sobers up*) |
| plocha.zaverecnaTlacidlo | Záverečná: posledná karta návrhu ide lícom dole za {cig}. Súper ju do konca Pitky nevidí a nemôže za ňu prikladať; ty v tomto Zhromaždení už nevykladáš (a za pas nedostaneš cigarety). | OK; Last Orders = posledná objednávka pred zatváračkou |
| plocha.odkazTip | Odkážeš kartu {karta} do Dedičstva za {cig} (máš {mas}): jej efekt Dedičstvo platí do konca hry a do línie sa už nevráti. | OK; *leave … to the Heirloom* nesie „odkázať“ |
| plocha.podlozenieTip2 | Je to tvoj ťah, ale limit nemíňa. Nástroj tam leží do bitky, potom ide späť do tvojho odhadzovacieho balíčka. | OK |
| plocha.odpovedStoji | Odpoveď stojí plný poldeci: vypiješ ho — pečeň +1 a ráta sa ako nerest. Karta ide lícom dole a limit nemíňa. | OK |
| plocha.navrhRozdeli | Návrh: rozdelí body tak, aby si mal po bitke čo najviac a súper čo najmenej — dá sa upraviť klikaním. | OK |
| plocha.tvojTahBranie | Tvoj ťah — klikni na {co} v Ponuke (alebo potiahni do ruky) a daj „hotovo“ (1 karta = …, 2 karty = …), alebo prestaň brať. Limit vykladania: {limit}. | OK |
| plocha.naexOdkryte | NA EX sú odkryté — {meno} {dal} NA EX{na}. Môžeš vyložiť jednu kartu lícom dole (za plný poldeci, ktorý vypiješ — pečeň +1; limit nemíňa), napr. aby si spároval jeho neaktívne akcie a NA EX ich zrušilo. | OK |
| plocha.benzinkaTip | Benzínka: každé fajčenie o 1 cigaretu lacnejšie, prvé v Pitke zadarmo — hneď si doberieš kartu. … Nerest je len naozaj vyfajčená cigareta, zadarmo nie. | OK |
| plocha.barterTip | Stokársky barter: za {cena} dostaneš nový plný poldeci navyše — o poldeci viac natrvalo. | OK (glosár *Gutter barter*) |
| plocha.krcmaMusis | Krčma: kým máš plný poldeci, musíš dať NA EX — klikni na kartu so značkou. | OK |
| plocha.fajcitTip | Fajčiť za {cena}…: hneď si doberieš kartu. Ďalšie fajčenie v tejto Pitke stojí {dalsie}, nová Pitka začína na {nova}. Každá vyfajčená cigareta je nerest. | OK |
| plocha.naexNaRub | NA EX na súperovu Záverečnú · nevieš, čo to je — prejde vždy, aktívne zruší, neaktívne zdvojí ako pri každej karte (nespárovaný Odpor ho zahasí, nespárované Posilnenie aktívne podrží) · pečeň +1 | OK |
| plocha.bezNaexTitul | V každej ďalšej Pitke tejto bitky hra za teba ťukne „končím“ — bez NA EX, bez fajčenia. Na súperovo NA EX odpovedáš sám. | OK |
| plocha.naexDetail | ďalšie kolo limit … · skryté do konca Pitky; ak {meno} dá NA EX na tú istú kartu, stane sa Výtržníkom (všetky akcie Rany pre majiteľa) · platí, ak {meno} neodpovie (v ruke má {ruka}) | OK |
| plocha.cintorinText | jednu kartu zo svojho odhadzovacieho balíčka (už aj s kartami z tejto línie) si smieš vziať do ruky. Klikni na ňu, alebo nič. | OK |
| plocha.zajatNahlad | Zajať {meno} za {cena}: väzeň v tvojej pivnici (…), {super} ti odovzdá {spaky}. | OK |
| plocha.presvedcitNahlad | Presvedčiť {meno} za {cena}…: jeho karta ide do tvojej ruky a ostane v tvojom balíčku; tvoje reči aj priazeň ostávajú. | OK |
| plocha.naSekereText | Na sekere: {spaky} — vezme ich víťaz tejto bitky. Vo finále pri remíze prepadnú. | OK; „pri sekere“ vo finále = remíza, spresnené |
| plocha.vazniNaVyhru | Väzni na výhru: {n} (vo vyhratej bitke) – zajať môžeš staršieho, pri ktorom máš strach na červenej. | OK |
| plocha.schopnostRaz | Schopnosť väzňa použiješ raz za hru, kedy chceš — vo svojom ťahu pri braní z Ponuky, v Zhromaždení alebo v Pitke. | OK |
| plocha.hraPasovala | Nemal si čo vyložiť, tak hra pasovala za teba. | OK |
| panel.chutPravidlo | Nerest je len to, čo vypiješ a vyfajčíš: … Na konci kola: menej nerestí než Chuť = Absťák do odhadzovacieho balíčka; potom Chuť = väčšie z (Chuť, neresti) − {ubytok}. Absťák sa nedá priznať… Spáliť ho smie Vízia. Po finále sa nič nerieši. | OK, pravidlo presné |
| panel.obrancaText | Vyhral poslednú bitku: vyberá cieľ kola, z Ponuky berie prvý (na prvom ťahu 1 kartu), na NA EX odpovedá druhý, na druhom kraji. Remízu v tuhom vyhrá, kto má menej Absťákov, potom menej Dlhov; inak idú špaky na sekeru. | OK |
| panel.utocnikText | Prehral poslednú bitku: vykladá prvý, z Ponuky berie druhý. Na NA EX odpovedá prvý — lícom dole. | OK |
| panel.rozdielTuheho | Rozdiel tuhého je Nakladačka a drží ju víťaz (Pohoršenia a Povery sú mäkké — rozhodujú len hádku, v10). Pri rovnakom tuhom vyhrá, kto má menej Absťákov, potom menej priznaných Dlhov; inak idú špaky na sekeru. | OK |
| panel.dlhyExekutor | Za priznané Dlhy príde v každej bitke Exekútor: zhorí polovica Dlhov (nahor) a toľko špakov; priazeň Advokáta z toho uberie 1 / 2 / 3. Záhradkár v tvojej partii zariadi, že ťa v tom kole obíde. | OK |
| panel.poldeciPravidlo | Limit vykladania = plné + 1; na začiatku kola sa {dolieva} vypitý doleje zadarmo. Plný poldeci platí ďalšiu kartu v ťahu Zhromaždenia alebo NA EX v Pitke. Na konci hry je každý plný {spaky} špak (výkupné). | „sám“ → *for free*: význam rovnaký (bez platby). OK |
| os.pitkaText | Hráte obaja naraz; „hotovo“ sa nedá vrátiť a NA EX sa odkryjú naraz. NA EX! — plný poldeci na Občana či Starešinu v línii: zruší aktívne, zdvojí neaktívne (násobky sa násobia: NA EX × Silná, nezávislá žena = ×4); … Fajčiť, doliať, nový poldeci (barter). | OK; meno karty podľa karty/en.json |
| os.bitkaText | Rozhoduje tuhé poškodenie (Rana 1, Pecka 2, Petelica 3; mínus súperova Viera a vlastné Absťáky). … Rozdiel tuhého je Nakladačka: víťaz ju minie na svoj strach (vo finále za ňu dostane špaky 1 : 1). | OK |
| os.zhromazdenieText2 | Kedykoľvek na ťahu: priznať Cirhózu…, Nástroj do Dedičstva…; fajčí sa až v Pitke. Kto pasuje, do Pitky nevykladá a dostane cigaretu za každú kartu, ktorú ešte smel vyložiť, aj keď už nemá čo. | OK |
| tabula.chutText | Nerest je len to, čo vypiješ a vyfajčíš: Vypiť 1, odpoveď na NA EX 1, NA EX {naex}, cigareta 1. Na konci kola: menej nerestí než Chuť = Absťák do balíčka (každý ti v bitke zoberie 1 tuhé)… | OK |
| starsi.pravidloStrachu | Každý hráč má pri každom staršom svoj teplomer: plná časť je jeho strach, šrafa súperove reči. … Stupeň stojí {cena}. Priazeň dá starší tomu, koho sa bojí menej — sila je rozdiel strachov, reči sa nerátajú. … Kto prehral hádku, tomu reči klesnú zospodu. | OK; „stupeň staršieho“ (stav) = *state*, jednotka = *notch* |
| prechod.rozdelNakladacku | Vyhral si bitku. Miň Nakladačku na svoj strach — klikni na stupeň teplomera pri staršom; staršieho na tvojom červenom strachu môžeš za {zajatie} zajať. Čo už na nič nestačí, prepadne. | OK |
| prechod.bitka | Najprv hádka: Pohoršenia a Povery sú mäkké — kto má viac, vyhral hádku a po bitke ju minie na reči. Potom poškodenie: viac tuhého vyhrá bitku a špaky; rozdiel tuhého je Nakladačka na strach víťaza. | OK |
| motor.ziskavaDlh | {meno} dostáva Dlh — hneď priznaný (v bitke ho páli Exekútor). | OK; vzor sedí len na slovenskú vetu, EN je výstup |
| domov.hero | Postav nezastaviteľnú partiu odhodlaných dedinských kreatúr. Vypi si, pohádaj sa, a ak máš chuť, aj sa pobi… len nech ten druhý vidí, že tebe nikto, ale nikto, neohne blatníky na mopede. | Pionier stratil značku, obraz ostal (otázka 8) |

## Posuny a rozhodnutia

- **„rozdeliť“ Nakladačku / hádku** = *spend … on your fear / rumours*, nie *distribute*: hráč body míňa ako peniaze
  za stupne. „Nikto nerozdeľuje“ (remíza) = *nobody hands anything out*.
- **„otočí sa“** (karta lícom dole) = *flips*; **„natočiť“** lokalitu = *set its facing* (glosár *facing*).
- **Súper** = *they / their*; zámená pri staršom nahradené *the elder* (otázka 10).
- **Tvary rodu** `.m / .z` sú v EN rovnaké; `.n` (bez rodu) je neosobný tvar ako v slovenčine (*Brawl won*, *Choice made*).
- **Vzory motora** (`motor.exekutorDlh/Dlhy/Dlhov`): tri slovenské kľúče sa líšia len pádom pri {n2}; v EN sú
  `Debt` (1) a `Debts` (2+), tvar podľa {n} vyberá *butt / butts*.

## Glosár a dĺžky

- Nezhody s glosárom: žiadne (Booze-up, Assembly, Market, the Tab, Thrashing, rumours, fear, notch, favour,
  Shakes, Thirst, vice, refill, Gutter barter, cash-in, Last Orders, Hooligan, Bailiff, Heirloom, tuck, crew).
- Skrátené kvôli dĺžke: *stop taking* (už neťahám), *Protection* (Výpalné, ako glosár na stole), *bailiff in the
  brawl* / *burned by the bailiff* (exekúcia v štítkoch), *when the bailiff comes* (priazeň pri exekúcii).
- Dlhšie o > 40 % a ponechané (popisy a predložkové väzby, nie tlačidlá): *after the brawl* (po bitke), *in the
  Booze-up*, *Put the card back in your hand*, *Taking from the Market*. Pečiatka *IN THE CELLAR* (otázka 12).
