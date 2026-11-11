# Kontrola EN — 2026-11-11b (vlna 3e)

Rozsah: 781 prázdnych kľúčov `apps/web/src/i18n/en.json` a oblasti `pravidla` (411 polí), `pojmy` (204 polí, aj `tvary`),
`vyucba` (312), `napovedy` (24), `achievementy` (153). Overené skriptom: každé pole vyplnené, parametre `{…}`,
piktogramy `[Rana]`…, značky `<strong>`, `<p k="…">`, `<a href>`, `<odkaz href>` sedia so slovenčinou (aj hodnoty `k`
a `href`); tvary počítaných slov len `1` a `5`. `npx vitest run i18n` (32 testov) a `npm run typecheck` prechádzajú.
Otázky: `docs/preklady/otazky-en-3.md`.

## Spätný preklad — Pravidlá (10 odsekov)

| Id | Spätný preklad EN → SK | Verdikt |
|---|---|---|
| co-je-naex.p1 | NA EX! je kartová hra pre dvoch hráčov v drsnej dedine. Každé kolo sa bijete o jednu lokalitu — krčmu, kostol, benzínku. Kto vyhrá bitku, zbiera špaky, ohorky, ktorými sa tu vedie skóre. A starší, dedinskí papaláši, ktorí bitku videli, sa ho začnú báť. | OK; *big shots* nesie iróniu „autorít“ |
| ako-sa-vyhrava.p2 | Špaky za strach. O koľko úderov si vyhral bitku, toľko strachu rozdelíš medzi starších. Kto sa ťa bojí, platí ti po každej ďalšej vyhratej bitke — čím viac sa bojí, tým viac platí. | OK |
| ciel-a-senok.p15 | Beriete striedavo, začína obranca — na prvom ťahu len 1 kartu, aby ponuku nevybielil. Inak na ťahu vezmeš 1 kartu za 1 cigaretu alebo 2 karty za 3. Za ponuku sa poldeci neplatia. Keď jeden prestane, druhý má už len jeden ťah; kto nemá cigaretu, prestane sám. Potom sa ponuka doplní na 8 — najprv z balíčka nástrojov, kým v nej nie sú aspoň 2 Nástroje, zvyšok z balíčka dedinčanov. Väzni počet kariet stavby nemenia. | OK; *clean out* = vykradnúť |
| ciel-a-senok.p17 | Zajatie — kto rozdeľuje Nakladačku, zajme za 5 bodov staršieho, pri ktorom bol jeho strach na červenej už pred touto Nakladačkou, teda od minulého kola; strach dotiahnutý na červenú v tom istom rozdelení nestačí. Pečiatka CAPTURE. Smie viac naraz a nemusí. Starší je väzeň: leží medzi priznanými kartami, zmizne zo stupnice a súper odovzdá toľko špakov, koľko bodov hádky má pri ňom v rečiach … najviac koľko má. Väzni na výhru podľa ligy končia hru hneď. | OK; pravidlo presné |
| zhromazdenie.p5 | Akcie hrany lokality dostane hráč s prevahou v kraji — kto tam má viac svojich Občanov, Zvierat a Starešinov (podložený Nástroj sa neráta). Pri rovnosti ten, koho karta leží hneď pri lokalite. Jedna súperova karta teda akcie hrany neukradne, ale tvorí s nimi spoj … Kraje sa volajú podľa lokality, v Krčme „pri pípe“ a „pri dverách“. | OK; *by the tap* = glosár (pri výčape) |
| pitka.p12 | NA EX karte zruší aktívne akcie a zdvojí neaktívne. Akcie sa rátajú majiteľovi … Násobky sa násobia — NA EX vedľa Silnej, nezávislej ženy dá ×4, aj Hazardu a Poškodeniu pečene. Poldeci leží na karte do bitky … pečeň +1 je tvoja (pripíše sa pri odkrytí) a v bitke sa poldeci vypije. Pred potvrdením hra ukáže bitku pred a po aj kliatby. | OK; „Silná žena“ v origináli = karta Silná, nezávislá žena, plné meno karty |
| pitka.p26 | Po odkrytí smieš za každé súperovo NA EX vyložiť jednu kartu z ruky na ktorýkoľvek koniec línie — lícom dole, za plný poldeci: pri odpovedi ho vypiješ (pečeň +1 hneď, ráta sa ako nerest) … Najprv útočník, potom obranca — len na druhý kraj línie … Najlepšie spárovať neaktívne akcie karty s NA EX: stanú sa aktívnymi a NA EX ich zruší. | OK |
| cena-pitia.p4 | Nerest je len to, čo vypiješ a vyfajčíš: Vypiť v Zhromaždení 1, odpoveď na NA EX 1, každé NA EX 2 (väčšia dávka), každá vyfajčená cigareta 1 (druhé fajčenie za 2 cigarety teda 2, na Benzínke za 1 cigaretu 1, fajčenie zadarmo nič). Doliatie, barter, ponuka, Záverečná, Dedičstvo nerest nie sú. | OK |
| bitka.p7 | Vyhráva vyššie tuhé. Pri rovnakom tuhom vyhrá, kto má menej Absťákov, potom menej priznaných Dlhov. Ak nerozhodnú ani Dlhy, nevyhrá nikto: špaky kola čakajú na sekere a vezme ich navyše víťaz ďalšej bitky; vo finále prepadnú. Útočník ostáva útočníkom, starší bodujú obom len za reči, cigaretu za prehru nedostane nikto. | OK; *on the Tab* = sekera (glosár) |
| starsi.p12 | Hneď po bitke ti súper dá 1 cigaretu za každého staršieho s tvojím červeným strachom — aj keď si prehral, aj pri sekere. Väzeň sa ráta ako červená, reči nie. … Platíte naraz, prijaté výpalné v tom istom kroku neodovzdáš ďalej. Obmedzenie výpalné neuberá, nie je to nerest a po finále sa neplatí. | OK |

## Spätný preklad — výučba (10 krokov)

| Krok | Spätný preklad EN → SK | Verdikt |
|---|---|---|
| i-vitaj | ČO TAM SEDÍŠ – POĎ SEM! Ja som Meliš… EH! Majster Melichar. Daj mi cigaretu, ak chceš, aby som ťa naučil hrať! | OK; krik a prerieknutie ostali |
| i-cigareta | Platí sa cigaretami, máš ich dole pri sebe: deväť. Karta stojí jednu. Zvykni si na drobné, veľké peniaze tu neuvidíš. | OK; uštipačnosť ostala |
| k-zh-bot1 | Štamgast začína: Poľovník k Lesnej ceste. Rad kariet pri lokalite je línia – tvoja vľavo, jeho vpravo. | Verne, ale pozri otázku 1 (strana línie) a 2 (Polovník) |
| i-spoj | Pozri: Pecka Mäsiara sa dotkla Pecky cesty v rovnakej výške. To je spoj – obe platia. Rana vedľa nemá s kým, je mŕtva. | OK |
| i-pitka | Vyložené, teraz sa pije – Pitka. Pijú všetci naraz a každý skončí, keď chce. Bez pitia by to bola len schôdza výboru. | OK; *committee meeting* = britská nuda „schôdze“ |
| i-rola | Minulá bitka je tvoja, si obranca: … Štamgast prehral, je útočník: vykladá prvý a na NA EX odpovedá prvý – kto prehrá, dostane výhody. Mne nikto žiadne nedal. … druhá úroveň: na hrane lokality sú dve akcie, viac spojov, viac Pitiek. | OK |
| k-zh2-bot2 | Pozor, podlosť: Štamgast položil Dvojčatá na koniec línie vľavo, k tvojim kartám. Karta je natočená k nemu, ostáva jeho … Do prevahy sa Dvojčatá rátajú za dvoch: na trávniku 2 : 2. | OK; *dirty trick* = podlosť (aj v názve 2. časti) |
| k-odpoved-bot | Teraz odpovede: za každé súperovo NA EX smie hráč vyložiť jednu kartu z ruky, mimo limitu a lícom dole – ale za plný poldeci, ktorý pri tom vypije. Prvý odpovedá útočník … Ty plný poldeci nemáš – je pod NA EX – tak neodpovedáš. | OK |
| k-nakladacka3 | Nakladačku 7 som ti rozdelil ja, nech tu nesedíme do rána. Farár sa ťa bojí na červenej od minulého kola, tak som ho za 5 zajal – je tvoj väzeň a sedí v pivnici. … Farárovu schopnosť – zhodiť jedno súperovo NA EX z karty – smieš raz za hru použiť, kedy chceš. Zvyšné 2: Krčmárka zo žltej na oranžovú. | OK |
| i-dovidenia3 | To je všetko. Už ma nepotrebuješ a ja teba nikdy, len tvoje cigarety. Choď hrať proti počítaču alebo proti ľuďom. Keď sa niečo objaví prvý raz – Chuť, Absťák a iné svinstvá – ešte sa ozvem, z čistej zlomyseľnosti. Na zdravie! | OK; *filth* = svinstvá, *Cheers!* = Na zdravie |

## Ostatné nálezy

- **Dĺžky**: krátke nápisy (≤ 24 znakov) dlhšie o > 40 % som skrátil (`pata.rozdel`, `pata.poUtoku`,
  `pata.superRozhoduje`, `pata.vyberaSuper`, `stol2na2.zrusitNavrh`, signály 2 na 2, `kseft.zisk.*`,
  `soundboard.zapnutZvuk`, `novinky.kategoria.web`, `prehravac.tah.chooseLocation`). Ostatné dlhšie nápisy sú
  v texte, nadpisoch alebo bublinách, kde sa zalomia.
- **Tlačidlá vo výučbe** sa volajú ako v EN rozhraní (*End the Booze-up*, *stop taking*, *smoke*, *no answer*).
- **Tvary pojmov** (`pojmy.*.tvary`) sú anglické tvary pre podčiarkovanie v bublinách Melichara: *butt, butts*;
  *brawl, brawls*; *Booze-up, Booze-ups*; *shot, shots*; *link, links, linked*; *elder, elders*; *Market, Markets* …
  Vzor je bez ohľadu na veľkosť písmen.
- **Mŕtve vtipy nahradené**: „Rudo obratý do nitky“ → *Rudo Fleeced*; „Ružová pečienka“ → *Liver, Medium Rare*;
  „Na hlavu“ → *Hammered*; „Pas za groš“ → *Pass for Pennies*; „Stokár“ → *Gutter Rat* (väzba na *Gutter barter*).
