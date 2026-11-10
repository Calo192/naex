# Otázky prekladateľa (en, pl, cs, hu)

Kde si prekladateľ nie je istý významom alebo voľbou. Formát: cesta · originál · možnosti · čo je zatiaľ v prekladoch.

## Význam originálu (Michal)

1. **Päta, Lakeť, Otočka** (`docs/PRAVIDLA.md` §19, glosár `pata`) — na čo názov naráža (bitkárska kombinácia, tanec, rečňovanka)? Zatiaľ doslovne: *Heel, Elbow, Spin* / *Pięta, łokieć, obrót* / *Pata, loket, otočka* / *Sarok, könyök, fordulás*. Ak je to známa slovenská fráza, nahradím ju miestnou s rovnakým účinkom.
2. **Sypač** (karta `kulturista`, tag Influencer, Podpora: Preškolenie {Rana}→{Pecka}) — čo presne znamená „sypač“: posilňovňový frajer, čo „sype“ (chvastá sa), alebo ten, čo „sype“ rany? Zatiaľ ako posilňovňový frajer: *Gym Bro* / *Koksu* / *Svalovec* / *Gyúrós*.
3. **Praudovravec** (karta `praudovravec`, kedysi Dezinformátor) — je chybné „praud“ úmysel (výsmech samozvaným hlásateľom pravdy)? Zatiaľ ako konšpiračný hlásateľ: *Truther* / *Foliarz* (alobalová čiapka) / *Pravdomluvec* / *Igazmondó* (narážka na ľudovú rozprávku). Pravopisný vtip sa v cieľových jazykoch nedá preniesť 1 : 1.
4. **Kočovník** (tag Zahraničný) — preložený neutrálne ako tulák (*Drifter* / *Wędrowiec* / *Kočovník* / *Vándor*), aby sa nedal čítať ako etnická narážka. Súhlasíš?

## Zdrojové texty, ktoré nesedia s pravidlami (Admin, len hlásim)

5. **Popisy akcií vo vzhľade tvorcu** (`docs/preklady/vzhlad/*.json`, zdroj živý tvorca 2026-11-10): Odpor — „Odpor proti Odporu = Vzbura: obe karty aktivujú všetky inak neaktívne akcie“ (od v11.1 sa karty obracajú: nespojené aktívne, spojené neaktívne); Cigareta — „Kšefty“ (Kšeft zanikol); Vízia — „zahodíš (navždy z hry)“ (dnes „spáliš“). Preložené verne podľa zdroja, Vízia už so „spáliť“ (burn / spalić / spálit / elégetni). Po oprave zdroja preložím znova.
6. **Karta Dlh** (`dlh`) je v tvorcovi, ale nie v `cards.json` (pravidlo 5) — preložená tiež, keby ju niekde ukazoval glosár kariet.
7. **Príbeh a účel kariet** — tvorca (živý web, rozpracovaný stav) ich nemá pri žiadnej karte; preložené sú len názov, efekt a kraje lokalít.

## Voľby na potvrdenie rodeným hovoriacim

8. **PL Absťák = *Głód*** („być na głodzie“) a Chuť = *Pragnienie*. Alternatíva *Trzęsiawka* (trasavka) — neviem overiť, či je bežná.
9. **CS Autobusár = *Autobusák*** — hovorové (ako tramvaják); ak sa nehovorí, *Řidič autobusu*. **CS Rapavý Fero** (vyradená povaha) = *Dolíčkovaný Fero* — neisté.
10. **Bzdocha** (`klebetnica`, vidí súperovo NA EX) — vo všetkých jazykoch hmyz, ktorý je zároveň „ploštica“ na odpočúvanie: *Earwig* (EN aj „earwigging“ = načúvať), *Pluskwa*, *Štěnice*, *Poloska*. Slovenská bzdocha takú dvojzmyselnosť nemá — pridáva sa vtip, ktorý sedí k efektu. Ak nechceš, *Nosy Parker* / *Wścibska* / *Slídilka* / *Kíváncsi néni*.
11. **Angličtina britská** (pub, landlady, last orders, favour, butts). Ak má byť americká, zmení sa ~15 pojmov.

## Odpovede Michala (2026-11-10)

- 1. **Päta, Lakeť, Otočka** = bitkárska kombinácia → nahradiť miestnou bitkárskou frazeológiou s rovnakým rytmom (tri údery/pohyby), nie doslovne.
- 2. **Sypač** = posilňovňový frajer — voľba ostáva (Gym Bro / Koksu / Svalovec / Gyúrós).
- 3. **Praudovravec** = výsmech samozvaných hlásateľov pravdy, chybné „prau“ je úmysel — kde sa dá, pridať miestnu chybu pravopisu s rovnakým účinkom (napr. EN „Troof Teller“).
- 4. **Kočovník** = neutrálny tulák — schválené.
- 10. **Bzdocha** = hmyz s odpočúvaním (Earwig / Pluskwa / Štěnice / Poloska) — schválené.
- 11. **Angličtina britská** — ostáva.
- 5. Popisy akcií vo vzhľade opravuje Admin v tvorcovi (rozpracovaný stav); po oprave preložiť znova.

## Rozhranie (vlna 3b, 2026-11-10) — voľby na potvrdenie

12. **Päta, Lakeť, Otočka** (`lobby.pata`, glosár `pata`) podľa odpovede 1: *Knee, Elbow, Trip* / *Z bańki, z łokcia, z kopa* / *Facka, loket, podraz* / *Térd, könyök, gáncs*. Všetky tri pohyby, posledný (okrem PL) = podraz, cieľ režimu. Ak chceš bližšie k päte a otočke, alternatíva EN *Heel, Elbow, Leg It*.
13. **Praudovravec** podľa odpovede 3 (`docs/preklady/karty/*.json`): *Troof Teller* / *Prafdomówca* (w→f) / *Šiřitel pravdi* (chyba i/y) / *Igasságharcos* (vyslovované „igasság“). Čeština chybu „prau“ nemá — i/y je najznámejšia česká chyba.
14. **Príklad herného mena** (`ucet.hernemenoPriklad`, „Fero z dolného konca“) nahradený miestnym typom: *Dave from the far end of the village* / *Franek z dolnego końca* / *Franta z dolního konce* / *Alvégi Feri*. Povahy botov (Igor, Rudo, Božena, Darina) ostávajú podľa glosára.

## Melichar (titulky `apps/web/src/i18n/melichar/*.json`, prepis `docs/preklady/melichar-sk.json`)

Prepis je zrekonštruovaný z mien súborov. Pri týchto hláškach si nie som istý významom — titulok je prázdny vo všetkých jazykoch, kým nepovieš, čo znamenajú (stačí presné slovenské znenie):

M1. `nervy/11_cil_isla_ked_najviac_jebe` — „Čil išla, keď najviac jebe“? Je „čil“ = teraz/práve? Kto „išla“ a čo znamená „keď najviac jebe“ (keď najviac leje, keď najviac besní, keď je najhoršie)?
M2. `nervy/ked_jebe` — „Keď jebe“: to isté ako M1 (leje / besní / štve)?
M3. `nervy/do_papuce_ma_jebala` — „Do papuče ma jebala“: udrela ho papučou, kopla, alebo „jebala do mňa“ = nadávala mi?
M4. `pohoda/jaaaja` — citoslovce spokojnosti („Jaaaj, ja!“), alebo niečo iné?
M5. `pohoda/no_nic_ja_zajebem` — „No nič, ja zajebem“: pôjdem spať, idem robiť, zahodím to, prehrám to?
M6. `vyhrazky/kurva_lebo_zajebem_plyn` — „Kurva, lebo zajebem plyn!“: pustí plyn (výbuch), alebo zatvorí/odpojí plyn susedom?

Vyplnené, ale over, či sedí:
M7. `urazky/ze_ten_kokot_umrou` — prečítané ako „Že ten kokot umreu“ (= umrel, nárečové u ako v „nevideu“). Titulok: *That the prick's dead.*
M8. `nervy/ale_sa_jebu` — „Ale sa jebú“: preložené tak, aby ostal dvojzmysel (sex / babrú sa): *they're at it* / *się pierdolą* / *se jebou* / *baszakodnak*. Ak je to jednoznačne jedno z toho, upravím.
M9. `reci/ja_budem_po_nej_maluvat_furt` — vypovedané ako sťažnosť (nie otázka): „Ja budem po nej maľovať furt.“
M10. `bieda/vcera_isiel_televizor` — „išiel“ = pokazil sa alebo išiel do záložne/predal sa; preklady nechávajú obe (*the telly went* / *poszedł telewizor* / *šla televize* / *ment a tévé*).
