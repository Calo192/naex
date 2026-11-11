# Kontrola HU — 2026-11-11 (vlna 3d)

Spätný preklad vzorky 40 kľúčov herného stola z `apps/web/src/i18n/hu.json` do slovenčiny
a porovnanie s originálom (`sk.json`). Overenie: `npx vitest run i18n` (18/18), `npm run typecheck` OK,
dosadenie vzorov motora vyskúšané na štyroch hláškach (pozri nižšie).

| Kľúč | HU | Spätný preklad | Verdikt |
|---|---|---|---|
| tabula.poldeciText | Kijátszási korlát = teli + 1; a kör elején {dolieva} üres magától újratöltődik… | Limit vykladania = plné + 1; na začiatku kola sa {dolieva} prázdny sám doleje… | OK |
| tabula.chutText | Bűn csak az, amit megiszol és elszívsz: Felhajtás 1… | Nerest je len to, čo vypiješ a vyfajčíš: Vypitie 1… | OK |
| tabula.pecenText | …ha a játék végén nincs bevallva, {spaky} mínusz… | …ak na konci hry nie je priznaná, mínus {spaky}… | OK; `{spaky}` už nesie slovo „csikk“ |
| tabula.dlhyExekutor | …jön a Végrehajtó: elég az Adósságok fele (felfelé kerekítve) és ugyanannyi csikk. | …príde Exekútor: zhorí polovica Dlhov (zaokrúhlene nahor) a toľko špakov. | OK |
| starsi.titulJa | {z} elöljáróból {priazen} kegyét élvezed (felső oszlop)… | Z {z} starších máš priazeň {priazen} (horný stĺpec)… | OK |
| starsi.pravidloStrachu | Minden játékosnak saját hőmérője van az elöljárónál… | Každý hráč má pri staršom vlastný teplomer… | OK, pravidlo celé |
| strach.bezExekucie | …azonnal nyer — a játék a végrehajtás előtt véget ér… | …vyhráva hneď — hra skončí pred exekúciou… | OK |
| priazen.vetaZajatia | {kto} megnyert verekedés után elfoghatja az Elpáholásból {cena} áron… | {kto} ho po vyhratej bitke môže zajať z Nakladačky za {cena}… | OK; slovosled iný, krádež na koniec vety |
| ucinok.uzernik | Keresztapa: verekedés után legfeljebb {n} bevallott Adósságod átmegy az ellenfél bevallottjai közé. | Kmotor: po bitke prejde najviac {n} tvojich priznaných Dlhov medzi súperove priznané. | OK |
| ucinok.advokat | Ügyvéd: a végrehajtás {n} csikkel kevesebbet visz el tőled… | Advokát: exekúcia ti vezme o {n} špakov menej… | OK |
| schopnost.vychovavatelka | Az ellenfél ezen a Gyűlésen azonnal passzol, és a passzért nem kap cigarettát. | Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety. | OK |
| suhrn.naSekeru | Krétára — mindketten csak azokért a fokokért kapnak, amelyeket pletykával tartanak. | Na sekeru — obaja dostanú len za stupne, ktoré držia rečami. | OK |
| pocitadlo.vyhravas | Nyersz, {n} különbséggel | Vyhrávaš, rozdielom {n} | OK (prípona po čísle by bola chybná) |
| spaky.koniecTitul | A döntő után beváltják, ami a játékosoknál maradt… | Po finále sa vymení, čo hráčom zostalo… | OK |
| linia.vazenAria | {meno} — {kto} pincéjében: még mindig {stupen}, pirosnak számít | {meno} — v pivnici u {kto}: stále {stupen}, ráta sa ako červená | OK |
| linia.zajat / zajaty | ELFOG / ELFOGVA | ZAJAŤ / ZAJATÝ | OK, pečiatky z glosára |
| rekap.naexNaKarte | {kto} {karta} ({meno}): {n} → „a te NA EX-ed az ő kártyáján (Iszákos): 2“ | tvoje NA EX na jeho karte (Pijan): 2 | OK; `rekap.tvoje/superovo` nesú celé „NA EX-ed / NA EX-e“ |
| rekap.vieraZrusila | {komu}: a Hit {n} Babonát semlegesített — azok nem adtak puha sebzést | {komu}: Viera zrušila {n} Povier — tie nedali mäkké | OK; dvojbodka namiesto datívu (meno sa neskloňuje) |
| rekap.prazdna | Ezen az Ivászaton semmi sem történt — se NA EX, se Adósság, se máj, se cigaretta. | V tejto Pitke sa nič nestalo — žiadne NA EX, Dlh, pečeň ani cigareta. | OK |
| panel.obrancaText | Megnyerte az utolsó verekedést: ő választja a kör célját… különben a csikkek krétára mennek. | Vyhral poslednú bitku: vyberá cieľ kola… inak idú špaky na sekeru. | OK |
| panel.rozdielTuheho | A kemény sebzés különbsége az Elpáholás, a győztesé… | Rozdiel tuhého je Nakladačka, drží ju víťaz… | OK |
| panel.dlhyExekutor | …A bandádban lévő Hobbikertész miatt abban a körben elkerül. | …Záhradkár v tvojej partii ho v tom kole obíde. | OK; Partia (tvoje karty) = banda |
| panel.vyhralBitku.m/.z/.n | Megnyerted a verekedést | Vyhral(a) si bitku | OK; .n v hu osobne (rod netreba) |
| os.pitkaText | <b>Egyszerre játszotok</b>… NA EX × Erős nő = ×4… | <b>Hráte naraz</b>… NA EX × Silná žena = ×4… | OK |
| os.bitkaText2 | …a vesztes kap {cigarety} cigarettát, és az ellenfél sarcot fizet neked a piros félelmedért. | …porazený dostane {cigarety} cigaretu a súper ti zaplatí výpalné za tvoj červený strach. | OK |
| plocha.vytrznikTitul | NA EX-ütközés: … Garázda lesz belőle — minden akciója Pofon, és ezek gazdája: {koho}. | Zrážka NA EX: … bude z nej Výtržník — každá akcia je Rana, a ich pánom je {koho}. | OK |
| plocha.naexOdkryte | A NA EX-ek felfordultak — {meno} {dal} NA EX-et{na}. Kirakhatsz <b>egy kártyát képpel lefelé</b>… | NA EX sú odkryté — {meno} dal NA EX{na}. Môžeš vyložiť jednu kartu lícom dole… | OK |
| plocha.zaverecnaTlacidlo | Záróra: a javaslat utolsó kártyája képpel lefelé megy, {cig} fizetsz érte… | Záverečná: posledná karta návrhu ide lícom dole, zaplatíš {cig}… | OK |
| plocha.barterTip | Csöves cserebere: {cena} fizetsz, és kapsz egy új, teli felest pluszban — véglegesen eggyel több feles lesz nálad. | Stokársky barter: zaplatíš {cena} a dostaneš nový plný poldeci navyše — natrvalo budeš mať o poldeci viac. | OK |
| plocha.krcmaMusis | Kocsma: amíg van teli felesed, NA EX-et kell adnod… | Krčma: kým máš plný poldeci, musíš dať NA EX… | OK |
| plocha.fajcitTip | Rágyújtás, {cena} fizetsz{benzinka}: azonnal húzol egy kártyát… | Fajčenie, zaplatíš {cena}: hneď si dobereš kartu… | OK |
| plocha.svokra | Anyós ({meno}): a verekedésben kioszt neked {n} Pofont… | Svokra ({meno}): v bitke ti udelí {n} Rán… | OK |
| plocha.kostol | Templom: NA EX csak a sor végén álló kártyára mehet… | Kostol: NA EX len na kartu na konci línie… | OK |
| plocha.superRozdelujeNakladacku | …az elöljárók jobban kezdenek félni tőle, a kegy pedig feléd tolódik. | …starší sa ho začnú báť viac a priazeň sa posunie k tebe. | OK |
| plocha.hasicSuper | <b>{meno}</b> a Tűzoltóval {slovo} egy kártyát a dobópaklijából{karta}… | {meno} Hasičom {slovo} kartu z odhadzovacieho balíčka… | OK |
| plocha.uzNetaham | elég | dosť | OK, kratšie než doslovné „nem veszek többet“ |
| plocha.vesticaVymena | {dam} átmegy {meno} paklijába, {vezmem} hozzád jön. | {dam} ide do balíčka {meno}, {vezmem} príde k tebe. | OK |
| prechod.menejSpakov | Kevesebb a csikked, ezért te támadsz; {meno} vezet, és ő {vybera} a csúcshelyszínt. | Máš menej špakov, preto útočíš; {meno} vedie a vyberá vrcholovú lokalitu. | OK |
| motor.exekutorDlhy | Végrehajtó: {hrac} játékosnak elég {n2} bevallott Adóssága és {n} csikkje. | Exekútor: hráčovi {hrac} zhorí {n2} priznaných Dlhov a {n} špakov. | OK; tri sk tvary (vzory) → jeden hu text |
| domov.hero | …csak lássa a másik, hogy a te Simsonod sárvédőjét aztán senki nem fogja görbítgetni. | …nech ten druhý vidí, že tebe nikto nebude blatníky na Simsone ohýbať. | Miestny ekvivalent (Pionier → Simson), otázka 3 |

## Skúška vzorov motora

```
Exekútor: hráčovi Fero zhorí 3 priznané Dlhy a 2 špaky. => Végrehajtó: Fero játékosnak elég 3 bevallott Adóssága és 2 csikkje.
Fero priznáva kartu Cirhóza.                             => Fero bevallja: Cirhóza.   (názov karty ostáva sk — otázka 1)
Záverečná hráča Jana sa otáča: Pijan.                     => Jana Zárórája felfordul: Pijan.
Fero už neberie z ponuky (spolu 2).                       => Fero már nem vesz a kínálatból (összesen 2).
```

## Opravené pri kontrole

- Ceny v cigaretách: `{cig}` je akuzatív, preto „{cig} fizetsz érte“ namiesto „ára {cig}“ (aj staršie `zhrom.nastroj`).
- Prípony na premenných (`{n}-et`, `{n}-val/-vel`) nahradené tvarmi bez prípony („{n} darabot“, „{n} különbséggel“).
- „a(z) {meno}“ v nových textoch odstránené (`plocha.bitkaO`, `plocha.natocenieTip`, `plocha.odkazTip`, `plocha.vlavoHrana`, `priazen.reciZHadky*`).
- Dĺžky: skrátené `plocha.uzNetaham` (elég), `plocha.nicNepalit`, `plocha.zrusitVyber` (Mégse), `pocitadlo.hnedVysledok`,
  `linia.suhrnPoBitke`, `plocha.pitkaSkoncila`. Ponechané dlhšie: väčšina z nich vychádza z glosára
  (bitka = verekedés, Dlh = Adósság, v bitke = a verekedésben), čo sú krátke popisky a pásy, nie tlačidlá.
- `galeria.priznana` a `galeria.dedicstvo` preložené podľa správneho znenia („Priznaná kliatba“, „Dedičstvo“),
  nie podľa pokazenej hodnoty z extrakcie.

Nezhody s glosárom: žiadne.
