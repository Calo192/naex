# Zošit lekcií ilustrátora

Agent `naex-ilustrator` sa učí z Michalových výberov (Michal 2026-10-30).
Ku každému rozhodnutiu tu je karta, dátum, verdikt, Michalov dôvod (doslova,
ak ho povedal), námet promptu, použité predlohy (referencie v Leonarde) a cesta
k obrázku. Z toho vyplýva jedna lekcia.

**Kolobeh:** pred každým generovaním si prečítaj súhrn a záznamy podobných
kariet. Po každom Michalovom výbere doplň záznam (schválené aj zamietnuté,
s predlohami) a podľa potreby uprav súhrn. Ak sa lekcia z praxe vyvráti,
neprepisuj ju potichu: pripíš „vyvrátené RRRR-MM-DD“ a dôvod.

Námety sú v `admin-agent/obrazky/<priečinok>/prompt.txt` (mimo gitu).
Chvost promptu je vždy `STYL` z `tools/admin/styl.ts`, tu sa neopakuje.

## Súhrn

### Vyhýbaj sa

- **Nafúknuté hlavy, veľké líca, tučné karikatúry s okrúhlou červenou tvárou.**
  Michal: tučný tipér s nafúknutou hlavou bol „hrozný“, takéto postavy sa do
  štýlu hry vôbec nehodia. Model ich rád kreslí, keď v námete je „fat“,
  „round red face“, „chubby“, „double chin“ alebo „big belly“.
- **Kužeľ alebo kruh svetla (spotlight, pódium) na predmete.** Highlight
  znamená, že predmet je stredový bod kompozície, nie že naň svieti lampa.
- **Pri predmetoch fotky, oltáriky, portréty, ruky a postavy.** Michal: „Na
  obrázku chcem hlavne tie vidly, nie nezmysly ako fotky neviem koho.“
- **Kočovník ako referencia pri bradatých a mužských postavách.** Ťahá k vlastnej
  tvári (brada, klobúk, náušnice): vznikajú klony Kočovníka. Pri predlohe
  Kočovník výslovne píš „clean-shaven, no beard, no hat“.
- **Slovo „fruit“ alebo jedlo na obaloch, lyžice pri alkohole.** Odvádzajú
  od pointy (Jogurt = alkohol, nie mliečny výrobok).
- **Polmesiac s hviezdou** (pôsobí ako náboženský symbol) a **okraje
  s mierkou** (model tam píše pseudočísla).
- **Námety s dlhým dejom** (otvorené dvere autobusu, cestujúci na schodoch,
  kolóna áut). Model si s tým neporadí a kompozícia sa rozpadne.

### Opakuj

- **Predmet (Nástroj) = jediný hlavný motív v strede**, veľký a detailný,
  jednoduché pozadie (stena stodoly, plot, stôl s dečkou), rovnomerné tlmené
  svetlo. Satira len jemne, cez drobnosť (dečka pod zbraňou, erb klubu).
- **Chudé, šľachovité, vráskavé postavy s ostrými črtami**, ako Podvodník,
  Kočovník alebo Krčmárka. Tetovania, strnisko, zlaté zuby, lacné lesklé
  oblečenie.
- **Pri Starešinoch je korupcia okatá a vidno ju na oblečení**: saténová
  košeľa, zlatý medailón, prstene, zväzok bankoviek (Autobusár 5).
- **Emócia priamo v tvári a v predmete v ruke**: nasratý chlap s pálenkou na
  traktore, triezvy šofér so sladenkou medzi opitými kamarátmi.
- **Pri postavách predlohy zo vzorov štýlu** (Krčmárka, Veterinár, Kočovník,
  Podvodník) so silou MID, **pri predmetoch Puška a Vinko**.
- **Rámik a podpis** sa dajú orezať. Nápis v strede obrazu orezať nejde, taký
  obrázok vygeneruj znova.

## Záznamy

Cesty k obrázkom: `H1` = `F:\Projects\handoff\ilustracie-2026-10-30-autobusar-a-dalsie\`,
`H2` = `F:\Projects\handoff\ilustracie-2026-10-30-naradie\`,
`H3` = `F:\Projects\handoff\ilustracie-2026-10-30-prerobit\`,
`H4` = `F:\Projects\handoff\ilustracie-2026-10-30-tiper\`.
Model Nano Banana, sila MID, ak nie je uvedené inak.

### Autobusár (Starešina) — 2026-10-30

- **Schválené (č. 5):** `H1\autobusar-hra-5.jpg` (`autobusar-h`, kolo 2-2).
  Námet: frajer okolo štyridsiatky s ulízaným mulletom, tenkými fúzikmi
  a zlatými zubami, v rozopnutej lesklej fialovej saténovej košeli, so zlatým
  medailónom, diamantovými prsteňmi a hodinkami. V noci sedí v prázdnom
  rozheganom autobuse, nohy má na palubovke a počíta zväzok bankoviek.
  Predlohy: Krčmárka, Veterinár, Kočovník.
  **Lekcia:** Starešina funguje ako jedna okatá póza s luxusom na tele, nie ako
  dej s ďalšími postavami.
- **Zamietnuté (č. 1–4):** tučný šofér s čiernymi fúzami, ktorý si strká
  „cestovné“ do vrecka (`autobusar-f`), a starý šofér s mulletom a mrožími
  fúzami, ktorý sa vykláňa z okna k cestujúcemu v daždi (`autobusar-g`).
  Rovnaké predlohy. Prvé kolo `autobusar-g` malo nápis na zastávke a ŠPZ.
  **Lekcia:** scéna s druhou postavou a dverami autobusu sa rozpadá. Tučný
  fúzač nezabral.

### Šofér (Občan) — 2026-10-30

- **Schválené (č. 11):** `H1\sofer-hra-2.jpg` (`sofer-a`, kolo 1-2). Námet:
  triezvy šofér pre partiu, chudý a šľachovitý, s ježkom, zrastenými obočiami
  a jazvami na tvári, kyslo žiarlivý, v lacnej lesklej čiernej teplákovke.
  Sedí sám na konci pultu, točí kľúčmi na prste, pred ním sladenka a za ním
  sa opití kamaráti smejú s poldecákmi.
  Predlohy: Krčmárka, Veterinár, Kočovník.
  **Lekcia:** satira z kontrastu (jediný triezvy medzi opitými) a chudá
  šľachovitá postava sedia so štýlom.
- **Zamietnuté:** č. 10 (ten istý námet, druhý obrázok) a č. 12–13 (`sofer-b`):
  zúrivý šofér pred zdrátovaným autom, k nemu sa tacká opilec. Č. 12 pripomínal
  Wolverina.
  **Lekcia:** pozor na tváre podobné známym postavám z komiksov a filmov.

### Vidly (Nástroj) — 2026-10-30

- **Zamietnuté (1. kolo, č. 6–9):** vidly ako relikvia nad oltárikom
  s fotkou deda (`vidly-a`) a vidly v hnoji na dvore v noci (`vidly-b`).
  Predlohy: Puška, Vinko, Kočovník.
  Michal: „Na obrázku chcem hlavne tie vidly, nie nezmysly ako fotky neviem
  koho. Vidly sú hlavný bod ilustrácie.“
  **Lekcia:** predmet bez sprievodných príbehov. Kočovník k predmetom nepatrí.
- **Schválené (2. kolo, č. 3):** `H1\vidly2-hra-3.jpg` (`vidly-c`, kolo 1-1).
  Námet: jedny veľké staré vidly v strede, opreté o drsnú drevenú stenu
  stodoly. Tri dlhé hrdzavé hroty, násada obviazaná drôtom, na hrote kúsok
  záplatovaných nohavíc, slama pri zemi. Bez ľudí, fotiek a oltára.
  Predlohy: Puška, Vinko.
  **Lekcia:** celý predmet pri stene, s jednou drobnosťou, ktorá nesie satiru.
- **Zamietnuté (2. kolo, č. 1, 2, 4):** detail hlavy vidiel zdola (`vidly-e`)
  a vidly v slame pred vrátami (`vidly-d`).
  **Lekcia:** extrémny detail nevyhral, Michal chce vidieť celý predmet.

### Traktorista (Občan, predtým Traktoristka) — 2026-10-30

- **Zamietnuté (1. kolo, č. 14–18):** fúzatý obor, ktorý vyťahuje auto
  z jarku (`traktorista-a`), tučniak s mafinou a chlebom, ktorý blokuje kolónu
  (`traktorista-c`), a mladík pri prevrátenom traktore v mláke
  (`traktorista-b`). Predlohy: Krčmárka, Veterinár, Kočovník.
  **Lekcia:** dej s autami a ďalšími ľuďmi nezabral. Tučniak s mafinou pôsobil
  žensky.
- **Schválené (2. kolo, č. 6):** `H1\traktorista2-hra-2.jpg` (`traktorista-d`,
  kolo 1-2). Michalovo zadanie: „nasraný nervózny chlap s fľašou pálenky
  v jednej ruke a cigaretou v ústach na traktore“. Námet: chudý šľachovitý chlap
  okolo päťdesiatky so spotenou červenou zúrivou tvárou, šedým strniskom,
  žilou na čele, zaťatými zubami a cigaretou v nich. Sedí na starom
  hrdzavom červenom traktore bez loga, jednou rukou drží volant, druhou fľašu
  číreho slivovice bez etikety. Predlohy: Krčmárka, Veterinár, Kočovník.
  **Lekcia:** jedna postava, jedna emócia, jeden predmet v ruke. Druhá ruka
  jednoducho na volante.

### Nástroje — 2026-10-30, prvá dávka

Predlohy všetkých: Puška, Vinko. Námet bol vždy „close-up of … as the only
main subject in the centre, big and detailed, … very simple plain background,
no people, no photos …“.

- **Schválené:**
  - Zapaľovač 2: `H2\zapalovac-hra-2.jpg`, lacný zapaľovač s erbom klubu bez
    písma pri popolníku.
  - Výherné žreby 4: `H2\zreby-hra-1.jpg`, vejár zotretých žrebov s mincou.
  - Píšťalka 8: `H2\pistalka-hra-2.jpg`, rozhodcovská píšťalka na šnúrke
    so steblom trávy.
  - Zrkadlo 13: `H2\zrkadlo-hra-1.jpg`, gýčové zlaté zrkadlo s prasklinou,
    rúž a hrebeň.
  - Energeťák 27: `H2\energetak-hra-3.jpg`, plechovka so zeleným bleskom
    medzi pokrčenými.
  - Fúrik 32: `H2\furik-hra-2.jpg`, hrdzavý fúrik so socialistickým znakom
    a tehlami.
  - Krištáľová guľa 34: `H2\gula-hra-1.jpg`, guľa s hmlou na fialovom
    zamate.

  **Lekcia:** malý predmet v strede na stole alebo pri stene, s 1–2
  súvisiacimi vecami, funguje.
- **Zamietnuté:**
  - **Hrable** (č. 10–12): kužeľ svetla na hrabliach. Michal: „Keď poviem
    highlight, nemyslím tým, že na to bude svietiť kruhové svetlo, ale to, že
    ten daný artikel je stredový bod, na ktorý je hlavné zameranie
    ilustrácie.“ Lekcia: žiadny spotlight, rovnomerné tlmené svetlo.
  - **Boxer** (č. 16–18, mosadzný boxer na dečke): karta sa mení na Valašku.
    Lekcia: nie chyba štýlu, zmenila sa karta.
  - **Telefón** (č. 19–21): do záberu vchádzala ruka, ktorá vytáča. Lekcia: pri
    predmete žiadne ruky.
  - **Jogurt** (č. 22–24): lyžica a ovocie na viečkach. Lekcia: symbol musí
    niesť pointu (alkohol), nie doslovný jogurt.
  - **Horoskop** (č. 28–30): výstrižok na chladničke s ovocnými magnetkami.
    Michal chcel úplne nový námet. Lekcia: magnetky prebili zverokruh.
  - **Profesionálny tipér** (č. 37–39): chudý „lasičkový“ chlap vo
    fialovo-tyrkysových teplákoch pred stávkovou kanceláriou. Michal chcel
    komplet prerobiť. Lekcia: celá postava zďaleka pred dverami je nevýrazná.

### Nástroje — 2026-10-30, prerobené

Predlohy: Puška, Vinko. Do námetu pribudlo: „even dim ambient lighting across
the whole scene, no spotlight, no circle or cone of light … no hands …“.

- **Schválené:**
  - Hrable 1: `H3\hrable-hra-1.jpg` (`hrable-b`, kolo 1-1). Jedny hrable
    súmerne v strede pri plote, na násade slamený klobúk.
  - Valaška 4: `H3\valaska-hra-1.jpg` (`valaska`, kolo 1-1). Zdobená
    valaška opretá o klát v drevárni.
  - Telefón 7: `H3\telefon-hra-1.jpg` (`telefon-b`, kolo 1-1, orezaný).
    Zelená linka na dečke, bez ruky.
  - Jogurt 11: `H3\jogurt-hra-2.jpg` (`jogurt-b`, kolo 1-2). Pyramída
    poldecákov, na viečkach ikonka fľaše, jedno viečko odklopené.
  - Horoskop 13: `H3\horoskop-hra-1.jpg` (`horoskop-c`, kolo 1-1).
    Maľovaný zverokruh so slniečkom na popraskanej stene nad kredencom.

  **Lekcia:** veta o rovnomernom svetle a „no hands“ zabrala. Pri Horoskope
  ostala slabá žiara okolo kruhu, Michalovi neprekážala.
- **Zamietnuté pred kolážou (moja kontrola):** horoskop s polmesiacom
  a hviezdou a pseudotextom na okraji (`horoskop-b`), hrable s dvoma hlavami
  a valaška so svetelným kruhom na stene.

### Profesionálny tipér (Občan, Závislý, Chlap) — 2026-10-30

- **Zamietnuté (č. 16–18):** `H3\tiper-hra-1..3.jpg` (`tiper-b`). Námet:
  „a fat balding … with a round sweaty red face, a thick grey moustache …
  stretched old navy-blue tracksuit … plastic slippers with socks“, sedí
  v krčme s tiketom. Predlohy: Krčmárka, Veterinár, Kočovník.
  Michal: tučný tipér s nafúknutou hlavou bol „hrozný“. Model sa podľa neho
  často snaží kresliť postavy s veľkými lícami, čo sa do štýlu hry vôbec nehodí.
  **Lekcia:** nepíš „fat“, „balding round face“ ani „round red face“ (červená zúrivá tvár
  chudého chlapa pri Traktoristovi prešla, problém je okrúhlosť a tučnota). Postavy
  majú byť chudé a ostré.
- **Schválené (č. 4):** `H4\tiper-hra-4.jpg` (`tiper-c`, kolo 2-1). Michalovo
  zadanie: „Musí to byť chudý mladý človek, potetovaný… ako predlohu použi
  Podvodníka a Kočovníka.“ Námet: chudý šľachovitý mladík okolo dvadsiatky
  s prepadnutými lícami a ježkom, potetovaným krkom a rukami, cigaretou
  v ústach a lacnou lesklou čiernou bundou s tenkou zlatou retiazkou. Opiera
  sa o pult krčmy, drží vejár tiketov a vedľa ruky má poldecák. V pozadí
  automat a futbal v telke. Predlohy: **Podvodník, Kočovník**.
  **Lekcia:** Podvodník s Kočovníkom dávajú správny typ postavy. Kočovník však
  v 2 z 3 kôl prebil námet (brada, klobúk, karty), preto pridaj „clean-shaven,
  no beard, no hat“.
- **Zamietnuté pred kolážou:** dva klony Kočovníka (`tiper-c` kolo 1-1
  a kolo 3-2) a automat s pseudonápisom (`tiper-c` kolo 3-1).

### Opatrovateľka (Občan, Zahraničný, Pracujúci, Žena) — 2026-10-30

`H5` = `F:\Projects\handoff\ilustracie-2026-10-30-opatrovatelka\`, koláž `H5\kolaz.jpg`.
Typ ženy nebol z karty jasný, preto oba: „hot chick“ (č. 1–4, 7–8) a stará
rašpľa (č. 5–6). Michal vybral „hot chick“.

- **Schválené (č. 4):** `H5\opatrovatelka-hra-4.jpg` (`opatrovatelka-b`,
  kolo 1-2). Námet: prísna štíhla opatrovateľka okolo päťdesiatky s ostrým
  nosom, odfarbeným platinovým pixie s tmavými odrastami, karmínovým rúžom
  a modrými tieňmi, so zlatou reťazou s krížikom. Má bledomodrú sesterskú
  tuniku na leopardích legínach a biele kroksy. Ruku má v bok a zabavenú fľašu
  pálenky drží mimo dosahu krehkého starčeka na vozíku v alpskej izbe
  (kukučkové hodiny, parohy, dečky). Nikto nefajčí.
  Predlohy: Krčmárka, Veterinár, Poštárka. Michal dôvod neuviedol.
  **Lekcia:** satira zo zákazu cudzej neresti (zabavená fľaša, smutný starček)
  vyhrala. Druhá postava prešla, lebo je malá, sedí a len natŕča ruku.
  Tmavá vineta po okrajoch Michalovi neprekážala.
- **Nevybrané:**
  - č. 3: ten istý námet, kolo 1-1, s podpisom vpravo dole.
  - č. 1–2 (`opatrovatelka-a`): čierny vysoký cop, lilavé tepláky
    a páperka s kožušinou, sedí na kufri na zastávke pred autobusom, opilci
    na lavičke. Predlohy: Poštárka, Krčmárka, Podvodník.
  - č. 5–6 (`opatrovatelka-c`, kolo 2): šedivá rašpľa v kardigane počíta
    bankovky, fľaša bez etikety, kufor pri dverách. Predlohy: Niekoho stryná,
    Veterinár, Krčmárka.
  - č. 7–8 (`opatrovatelka-d`): karamelová blondína v leopardej blúzke
    a gumených rukaviciach, kľúč na krku, zamknutá vitrína s alkoholom.
    Predlohy: Krčmárka, Finančná poradkyňa, Podvodník.

  **Lekcia:** Pracujúca žena = „hot chick“ pri práci, ktorá zakazuje iným.
  Rašpľa s peniazmi bola bez pointy a čakanie na autobus bolo bez deja.
- **Zamietnuté pred kolážou:** `opatrovatelka-c` kolo 1, kde bolo čitateľné
  „SLIVOVICA“ na etikete, pseudotext na bankovkách a zlatý zub vyzeral ako
  tesák. Lekcia: fľašu píš „plain glass bottle with no label at all“, zlatý
  zub pri ženách vynechaj.
