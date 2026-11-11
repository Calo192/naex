# Kontrola HU — 2026-11-11b (vlna 3e)

Spätný preklad vzorky do slovenčiny a porovnanie s originálom: 10 odsekov Pravidiel (`apps/web/src/i18n/pravidla/hu.json`)
a 10 krokov výučby (`apps/web/src/i18n/vyucba/hu.json`). Overenie: `npx vitest run i18n` (32/32), `npm run typecheck` OK;
značky `<p k>`, `<a href>`, `<odkaz href>`, `<strong>` a `{parametre}` strojovo porovnané so zdrojom vo všetkých 1104 poliach
(0 rozdielov); vzor achievementu s dosadeným prahom vyskúšaný (`tazka-ruka` „…udeľ aspoň 12 tuhého“ → „…legalább 12 kemény
sebzést“); tvary 15 pojmov jadra sa nájdu v textoch výučby a nápoved.

## Pravidlá

| Odsek | Spätný preklad (z HU) | Posun / verdikt |
|---|---|---|
| co-je-naex.p1 | **NA EX!** je kartová hra pre dvoch zasadená do drsnej dediny. Každé kolo sa bijete o jednu lokalitu — krčmu, kostol, benzínku. Kto vyhrá bitku, zbiera špaky — tu sa ráta v ohorkoch. A starší, dedinské veličiny, ktorí bitku videli, sa ho začnú báť. | OK. „ohorky, ktorými sa tu ráta“ → „itt cigarettavégekben számolnak“ — vysvetľuje, že csikk = ohorok. |
| kolo.p9 | **Pitka.** Pije sa (Pitka). Smieš dať NA EX: plný poldeci vyleješ na kartu v línii a jej akcie v spoji zhasnú. Zhromaždenie a Pitka sa v kole môžu zopakovať. | OK. |
| ciel-a-senok.p17 | **Zajatie** — kto rozdeľuje Nakladačku, za 5 bodov zajme staršieho, pri ktorom má strach na červenej už pred touto Nakladačkou — teda z minulého kola; strach dotiahnutý na červenú v tom istom rozdelení nestačí. Pri takom staršom sa ukáže pečiatka ELFOG. Smie aj viac naraz, nemusí. Starší je jeho väzeň: leží medzi priznanými kartami, zmizne zo stupnice a súper mu odovzdá toľko špakov, koľko bodov hádky má pri ňom v rečiach — koľko stáli jeho stupne rečí (žltá 1, oranžová 2, červená 3) —, najviac koľko má. Väzeň sa ráta ako červená a má schopnosť. Väzni na výhru podľa ligy (2 / 3 / 4) končia hru hneď. | OK, pravidlo celé. Pečiatka „ELFOG“ / „MEGGYŐZNI“ sedí s `linia.zajat` / `linia.presvedcit` v hu.json. |
| zhromazdenie.p5 | Akcie hrany lokality dostane hráč, ktorý má prevahu v tom kraji — kto tam má viac svojich **Občanov, Zvierat a Starešinov** (podložený Nástroj sa neráta). Pri rovnosti ten, koho karta leží v kraji hneď pri lokalite. Jedna súperova karta teda neukradne akcie hrany, ale tvorí s nimi spoj… Kraje majú mená podľa lokality, v Krčme „pri výčape“ a „pri dverách“. | OK. Pozor na „Elöljáró“ = tag Starešina aj starší (otázka v otazky-hu-3.md). |
| pitka.p12 | NA EX na karte **zruší aktívne akcie a zdvojí neaktívne**. Akcie sa rátajú majiteľovi: na svojej zdvojíš Petelicu alebo zrušíš vlastný Hazard, na súperovej zrušíš, čo potreboval, ale neaktívne mu zdvojíš. Násobky sa násobia — vedľa Silnej, nezávislej ženy dá ×4, aj Hazardu a Poškodeniu pečene. Poldeci leží do bitky…; pečeň +1 je tvoja (pripíše sa pri odkrytí)… | OK. Meno karty z prekladu kariet („Erős, független nő“) — v origináli skrátené „Silná žena“. |
| pitka.p26 | Po odkrytí **smieš za každé súperovo NA EX vyložiť jednu kartu** z ruky na ktorýkoľvek koniec línie — **lícom dole, za plný poldeci**: pri odpovedi ho vypiješ (pečeň +1 hneď, ráta sa ako nerest)… Najprv útočník, potom obranca — len na druhý kraj… Najlepšie tak, aby si spároval neaktívne akcie karty s NA EX… | OK. |
| cena-pitia.p8 | Latku ti neurčuje súper. Absťák **sa nedá priznať** ani vyložiť; po bitke sa z ruky vráti do odhadzovacieho a ťaháš ho znova. Každý Absťák v balíčku… ti v bitke vezme **1 tuhé** — trasú sa ti ruky —, pri remíze v tuhom prehrá, kto ich má viac. Spáliť ho vie len Vízia… Hra si pamätá, koľko Absťákov si **získal za hru**. | OK. „Remegés“ (glosár) — „trasú sa ti ruky“ sedí s menom karty doslova. |
| bitka.p7 | Vyhráva vyššie **tuhé**. Pri rovnakom tuhom kto má **menej Absťákov**, potom **menej priznaných Dlhov**. Ak ani Dlhy, bitku nevyhrá nikto: špaky kola idú **na krétu** (na sekeru) a navyše ich vezme víťaz najbližšej bitky; vo finále prepadnú. Útočník ostáva útočníkom, starší bodujú obom len za reči, cigaretu za prehru nedostane nikto. | OK. „krétára“ = „na sekeru“ (krčmár píše kriedou), glosár. |
| starsi.p4 | **Priazeň** má ten, koho sa starší bojí menej: **sila = strach súpera − tvoj strach**… Keď dvíhaš strach, zarábaš špaky, ale súperovi dávaš priazeň. **Po bitke** má každý stupeň hodnotu žltá 1, oranžová 2, červená 3 a dostane ho, kto ho drží… Boduje sa podľa stavu pred zdvihnutím. | OK. |
| bodovanie.p30 | **O špaky prídeš** pri exekúcii (v každej bitke, keď máš priznané Dlhy: zhorí polovica Dlhov nahor a rovnako veľa špakov) a na konci hry za každú nepriznanú Cirhózu (3 špaky). Okamžitá prehra nie je — ani exekúcia, ani tenký balíček ťa z hry nevyradia. | OK. „malý balíček“ → „vékony pakli“ (tenký balíček), zmysel rovnaký. |

## Výučba

| Krok | Spätný preklad (z HU) | Posun / verdikt |
|---|---|---|
| i-vitaj | ČO TAM SEDÍŠ – POĎ SEM! Ja som Meliš… EH! Majster Melichar. Daj mi cigaretu, ak chceš, aby som ťa naučil hrať! | OK, vrátane prerieknutia mena. |
| k-ciel zle.2 | Vo Vegyesbolte (Jednota) sa nakupuje, nebije: ani jeden úder. Na Lesnej ceste je Pecka, to sú 2. Počítať vieš, nie? | OK. |
| i-spoj | Pozri: Mäsiarova Pecka sa dotkla Pecky cesty v rovnakej výške. To je spoj – obe platia. Rana vedľa nemá pár, je mŕtva. | OK. |
| q-zhromazdenie vysv.1 | Áno. To je celá hra, zvyšok sú výhovorky. | OK. |
| i-kraje | Lokalita delí líniu podľa hrán na dva kraje: trávnik a tribúnu. Kto má v kraji viac svojich Občanov, Zvierat a Starešinov, má tam prevahu a berie akcie hrany. Na tribúne má Štamgast Pijana, ty nikoho – a kto má pri Ihrisku viac ľudí, toho sú aj 2 tuhé. | OK; kraje podľa glosára (gyep / lelátó). |
| q-superova vysv.2 | Áno. Strana nie je partia (banda). Karta patrí tomu, ku komu je natočená. | Slovná hračka zachovaná vďaka glosáru (partia = banda). |
| i-pitka-ucet | Pitka! Karty sa už nehrajú, pije sa – obaja naraz… Spojené Hazardy a Poškodenia pečene ti teraz dajú Dlhy a pečeň, každá spojená Cigareta cigaretu. Preto ide Pitka až po Zhromaždení. Na toto máš talent, to uznávam. | OK, irónia zachovaná. |
| k-naex1 zle.1 | Na Dvojčatách by NA EX zrušilo Štamgastov spojený Hazard, ale zdvojilo by dve osamotené Rany. Tuhé by mu vyskočilo. Gratulujem. | OK, sarkazmus zachovaný. |
| k-reci-bot | Hádku vyhral Štamgast a minul ju na reči – ohováranie. Reči obsadzujú stupne na tvojom teplomere a stoja ako strach: pri Farárovi obsadil tvoju červenú za 3, pri Krčmárke žltú za 1. Ten stupeň je teraz jeho: Farár mu za červenú dá po každej bitke 3, vyhrá či nie, a tebe zo 6 ostanú 3. | OK. „ohováranie“ → „rágalom“ (ohováranie, ostrejšie „klebeta“); zmysel sedí. |
| i-dovidenia3 | To je všetko. Už ma nepotrebuješ a ja teba nikdy, len tvoje cigarety. Choď hrať proti počítaču alebo proti ľuďom. Keď sa niečo objaví prvý raz – Chuť, Absťák a iné svinstvá –, ešte sa ozvem, z čistej zlomyseľnosti. Na zdravie! | OK, tón aj pointa. „svinstvá“ → „disznóságok“ (doslova svinstvá). |

## Dĺžky (tlačidlá a pásy, > 40 % dlhšie)

Skrátené priamo v `hu.json`: `krcmovyUcet.vyhraO/prehraO` („győzelem +{n}“ / „vereség −{n}“), `prehravac.krokSpat/krokVpred`
(„Vissza“ / „Előre“), `stol2na2.zrusitNavrh`, `soundboard.zapnutZvuk`, `novinky.meniHru`, `vyvoj.titul`, `pata.rozdel`, `kseft.vziatZa`.
Ostávajú dlhšie (zmysel by inak utrpel, nie sú v úzkych tlačidlách): `kseft.zisk.hrobar` („kártya az ellenfél dobópaklijából“),
`suhrnLokality.strachReci`, `kriterium.interakcia.nazov`, nadpisy `stol2na2.stol` / `timPanel` („2 a 2 ellen …“ podľa glosára).

## Mŕtve vtipy / nezhody s glosárom

- Žiadna nezhoda s glosárom nenájdená (pojmy strojovo nekontrolované všade — vzorka ručne).
- Slovenská slovná hračka „šrot“ (súperov odhadzovací balíček) v HU nahradená jasným „dobópakli“ — príchuť stratená, zámerne.
- Zdrojové nezhody (nápovedy presvedčenie/zajatie vs. Pravidlá, „tvoja strana“ vo výučbe) sú v `otazky-hu-3.md`, preložené verne.
