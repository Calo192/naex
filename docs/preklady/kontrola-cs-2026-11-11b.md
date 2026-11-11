# Kontrola CS — 2026-11-11b (vlna 3e: Pravidlá, výučba, nápovedy, achievementy, zvyšok stola)

Spätný preklad vzorky do slovenčiny: 10 odsekov Pravidiel (`apps/web/src/i18n/pravidla/cs.json`) a 10 krokov výučby
(`apps/web/src/i18n/vyucba/cs.json`). Značky `<p k>`, `<a href>`, `<strong>` a ikony `[Akcia]` sú pri spätnom preklade vynechané.

## Pravidlá

| Id | Spätný preklad (CS → SK) | Verdikt |
|---|---|---|
| co-je-naex.p1 | NA EX! je kartová hra pre dvoch hráčov zasadená do drsnej dediny. Každé kolo sa bijete o jednu lokalitu — krčmu, kostol, benzínku. Kto vyhrá bitku, zbiera špaky, ohorky, ktorými sa tu ráta. A starší, dedinské autority, ktorí bitku videli, sa ho začnú báť. | OK; „vajgly, nedopalky“ = „špaky, ohorky“ (glosár) |
| ako-sa-vyhrava.p2 | Špaky za strach. O koľko úderov si bitku vyhral, toľko strachu rozdelíš medzi starších. Kto sa ťa bojí, platí ti po každej ďalšej vyhratej bitke — čím viac sa bojí, tým viac. | OK, zhodné |
| zhromazdenie.p2 | Karty v línii sa dotýkajú hranami. Karta sa páruje vnútornou hranou — tou, ktorá je obrátená k lokalite — so susedom bližšie k stredu (alebo s lokalitou). Akcia je aktívna, keď sa na spoji stretnú dve neprázdne akcie v rovnakej výške… | OK, pravidlo presné |
| zhromazdenie.p5 | Akcie hrany lokality dostane hráč s prevahou v tom kraji… Pri rovnosti hráč, ktorého karta v kraji leží hneď pri lokalite… Kraje majú mená podľa lokality, napríklad v Krčme „pri výčape“ a „pri dverách“. | OK; mená krajov podľa glosára (u výčepu / u dveří) |
| pitka.p12 | NA EX karte zruší aktívne akcie a zdvojí neaktívne… Násobky sa násobia — NA EX vedľa Silnej ženy dá ×4, aj Hazardu a Poškodeniu pečene. Poldeci leží na karte do bitky… pečeň +1 je tvoja… | OK |
| pitka.p25 | Zrážka: ak ste obaja vybrali tú istú kartu, je z nej Výtržník… Po bitke Výtržník vytriezvie a karta má znova pôvodné akcie. | OK, vtip s vytriezvením ostáva |
| pitka.p26 | Po odkrytí smieš za každé súperovo NA EX vyložiť jednu kartu z ruky na ktorýkoľvek koniec línie — lícom dole, za plný poldeci… Odpoveď limit vykladania nemíňa… | OK; „nemíňa limit“ → „nespotřebuje limit“ (nie slovakizmus „nemíjí“) |
| cena-pitia.p8 | Súper ti latku neurčuje. Absťák sa nedá priznať ani vyložiť… každý Absťák… ti v bitke uberie 1 tuhé — trasú sa ti ruky… | OK |
| bitka.p7 | Vyhráva vyššie tuhé. Pri rovnakom tuhom vyhrá, kto má menej Absťákov, a keď aj tých máte rovnako, kto má menej priznaných Dlhov… špaky kola čakajú na sekere… | OK; idióm „na sekyru“ (glosár) |
| starsi.p3 | Reči dvíha víťaz hádky a ležia na teplomere súpera: obsadzuješ od vrchu jeho strachu nadol, potom nad neho, zo sivej zdola nahor… Kto prehral hádku, tomu reči po bodovaní klesnú zospodu. | OK, zhodné |

## Výučba

| Krok | Spätný preklad (CS → SK) | Verdikt |
|---|---|---|
| i-vitaj | ČO TAM SEDÍŠ – POĎ SEM! Ja som Meliš… EH! Majster Melichar. Daj mi cigaretu, ak chceš, aby som ťa naučil hrať! | OK, rev aj prerieknutie ostávajú |
| i-lokalita | Hrá sa o ohorky – špaky. Kto ich má na konci viac, vyhral. Dole pri sebe máš zatiaľ nulu. Ako vždy. | OK, rýpnutie na konci ostáva |
| i-poldeci | Koľko kariet zahráš? Panák je pohárik pálenky („štamprle“). Koľko máš plných, toľko kariet, a ešte jednu. Máš dva, teda tri. | OK; poldeci = panák (glosár) |
| q-spoj (vysvetlenie.1) | Áno, spojená akcia platí, osamelá nie. Na začiatočníka nie zlé. | OK |
| k-zh2-bot2 | Pozor, podraz: Štamgast položil Dvojčatá na koniec línie vľavo, k tvojim kartám… Do prevahy sa Dvojčatá rátajú za dvoch: na trávniku 2 : 2. | OK; „podlosť“ → „podraz“ (aj názov 2. časti „NA EX a podrazy“) |
| q-superova (vysvetlenie.2) | Áno. Strana nie je partia. Karta patrí tomu, ku komu je natočená. | OK; partia (tvoje karty) = parta (glosár) |
| i-zadlzenie | Hazard ti v každej Pitke dá Dlh – ten ťa v bitke stojí špaky… dostaneš Cirhózu — dedinskú kliatbu!… Po Pitke sa pečeň vynuluje, Dlh nie. | OK |
| k-povera3 | Viera ruší Povery, ale Mačka má Furt… Hádku vyhral o 4 a po bitke ju minie na svoje reči. Ty sa tentoraz len pozeráš. | OK; „minie“ → „utratí“ (mínať body) |
| i-zajatie | Zajatie: kto vyhrá bitku a rozdeľuje Nakladačku, smie staršieho, ktorý sa ho bojí na červenej už od minulého kola, zajať za päť z nej… Farár sa ťa bojí na červenej – uvidíme, či ti dnes Nakladačka vyjde. | OK, pravidlo presné |
| i-dovidenia3 | To je všetko. Už ma nepotrebuješ, a ja teba nikdy, len tvoje cigarety… ešte sa ozvem, z čistej zlomyseľnosti. Na zdravie! | OK, tón zachovaný |

## Opravené pri kontrole

- `vyucba/k-zh3-1`: „ta zaplatíš“ (zlá zhoda s „játra“) → „dole se jeho Pověra potká s játry Kulturáku – to odnesou tvoje játra“.
- `vyucba/i-bitka-finale`: „nezajímá“ je v češtine aj „nezaujíma sa“ → „Zajetí ani přesvědčení ve finále nejsou.“
- `skratky.p`: „už nebírám“ → „už netahám“ (zhoda s tlačidlom `plocha.uzNetaham`).
- `novinky.odkaz.karty`: „Podívat se na karty“ (+46 %) → „Ukázat karty“.
- `suhrnZmena.poldeci`: „{z} panák“ (zlá zhoda pri +2) → „panáky {z}“.

## Dĺžky

Krátke texty (≤ 25 znakov) z vlny 3e nad +40 % po oprave nie sú. Tlačidlá výučby odkazujú na nápisy rozhrania
v češtine (`už netahám`, `končím`, `zapálit si`, `bez odpovědi`, `Přiznat`, `Dědictví`).

## Nezhody s glosárom

Žiadne. Pojmy (vajgl, panák, rvačka, Nabídka, Shromáždění, Herda, Nakládačka, Zavíračka, zajatec/sklep, Kulturák,
Funus, Hřbitov, Myslivna…) a mená kariet podľa `docs/preklady/glosar.json` a `docs/preklady/karty/cs.json`.
Skript overil {parametre}, značky `<p k>`, `<a href>`, `<odkaz href>`, `<strong>` a ikony `[Akcia]` pri každom poli;
`npx vitest run i18n` 32/32, `npm run typecheck` bez chýb. Kontrola slovakizmov (ä, ô, ľ, „sa“, „aj“, „keď“, „ktor-“,
„súper“, „špak“, „bitk-“, „ponuk-“…) nič nenašla.
