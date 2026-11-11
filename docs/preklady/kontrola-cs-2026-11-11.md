# Kontrola CS — 2026-11-11 (vlna 3d: stôl, profil, Domov, vzory motora)

Spätný preklad vzorky 44 kľúčov herného stola z `apps/web/src/i18n/cs.json` (pri tvaroch tvar „5“).

| Kľúč | CS | Spätný preklad | Verdikt |
|---|---|---|---|
| plocha.fajcit | zapálit si | zapáliť si | OK, glosár (tlačidlo „Zapálit si“); o 4 znaky dlhšie, pozri Dĺžky |
| plocha.doliatTip | Dolít panáka: za {cena} otočíš vypitého panáka zpátky na plného. | Doliať poldeci: za {cena} otočíš vypitý späť na plný | OK |
| plocha.barterTip | Socký barter: … nového plného panáka navíc — máš o panáka víc natrvalo. | Stokársky barter: … nový plný poldeci navyše | OK, glosár |
| plocha.krcmaMusis | Hospoda: dokud máš plného panáka, musíš dát NA EX… | Krčma: kým máš plný poldeci, musíš dať NA EX | OK |
| plocha.vytrznikTitul | Srážka NA EX: oba jste dali panáka na tuhle kartu… Rána pro {koho}. Po rvačce vystřízliví. | Zrážka NA EX… Po bitke vytriezvie. | OK, vtip s vytriezvením ostáva |
| plocha.odporTitul | Nespárovaný Odpor se postavil proti panákovi a NA EX uhasil… | …postavil sa proti poldecu a NA EX zahasil | OK |
| plocha.naexOdkryte | NA EX jsou odkrytá — {meno} {dal} NA EX{na}… (za plného panáka, kterého vypiješ — játra +1…) | NA EX sú odkryté… pečeň +1 | OK; NA EX stredný rod (glosár) |
| plocha.tahStoji | Tah tě stojí {n} plných panáků — limit {z} → {na}, játra +{n} | Ťah ťa stojí n plných poldecí | OK; slovenčina má pri 5 „plné poldeci“, čeština správny genitív |
| plocha.zaverecnaTlacidlo | Zavíračka: poslední karta návrhu půjde lícem dolů za {cig}… (bez cigaret za pas) | Záverečná: posledná karta návrhu pôjde lícom dole | OK, glosár |
| plocha.uzOdpovedal | Tady už odpověděl soupeř lícem dolů — tvoje odpověď smí jen na druhý kraj linie. | Tu už odpovedal súper lícom dole… | OK |
| plocha.superRozdelujeNakladacku | {meno} vyhrál rvačku a rozděluje Nakládačku na svůj strach — starší se ho začnou bát víc… | (zhodné) | OK |
| plocha.superRozdelujeHadku | …za ně mu starší dají vajgly i po prohrané rvačce. | …špaky aj po prehratej bitke | OK |
| plocha.bzdochaText | Štěnice: Pitku hraješ až po {meno} — až skončí, uvidíš, jestli a kam dal NA EX. | Bzdocha: Pitku hráš až po… | OK, Štěnice podľa kariet (aj „ploštica“ = odpočúvanie) |
| plocha.hasicTi | Hasič ti z odhazovacího balíčku vytáhl kartu… | (zhodné) | OK |
| plocha.vinko | Vínko v Dědictví: panáka za cigarety dolévat nesmíš (nového panáka barterem ano). | (zhodné) | OK |
| plocha.jednota | Jednota: máš víc přiznaných Dluhů — nesmíš kouřit ani dolévat. | (zhodné) | OK |
| plocha.svokra | Tchyně {meno}: v rvačce ti uštědří {n} Ran (v tvrdém už jsou) | Svokra: v bitke ti udelí n Rán | OK; „uštědří“ nesie posmech lepšie než „udělí“ |
| plocha.kar | Funus: játra za tohle NA EX dostane {meno} | Kar: pečeň za toto NA EX dostane | OK, glosár |
| plocha.cintorin.m | Prohrál jsi na Hřbitově | Prehral si na Cintoríne | OK |
| plocha.naSekereText | Na sekyře: {spaky} — vezme je vítěz této rvačky. Ve finále při sekyře propadnou. | (zhodné) | OK, idióm „na sekyru“ |
| plocha.zajatNahlad | Zajmout {meno} za {cena}: zajatec ve tvém sklepě…, {super} ti odevzdá {spaky}. | Zajať… väzeň v tvojej pivnici | OK, glosár (sklep) |
| plocha.presvedcitNahlad | Přesvědčit {meno}…: jeho karta jde tobě do ruky a zůstane ve tvém balíčku… | (zhodné) | OK |
| panel.obrancaText | Vyhrál poslední rvačku: vybírá cíl kola, z Nabídky bere první… jinak jdou vajgly na sekyru. | (zhodné) | OK |
| panel.utocnikText | Prohrál poslední rvačku: vykládá první, z Nabídky bere druhý… lícem dolů. | (zhodné) | OK |
| panel.rozdielTuheho | Rozdíl tvrdého je Nakládačka, drží ji vítěz (Pohoršení a Pověry jsou měkké…) | (zhodné) | OK |
| panel.chutPravidlo | Neřest je jen to, co vypiješ a vykouříš… Spálit ho smí Vize. Po finále se nic neřeší. | (zhodné) | OK, pravidlo presné |
| panel.zdrojAbstak | Absťáky (třesou se ruce) | Absťáky (trasú sa ruky) | OK |
| panel.vyhralBitku.z | Vyhrála jsi rvačku | Vyhrala si bitku | OK |
| panel.naSekeruPojde | Na sekyru půjde {spaky}, vezme je vítěz další rvačky. | (zhodné) | OK |
| linia.vazenAria | {meno} — ve sklepě u {kto}: je z něj pořád {stupen}, počítá se jako červená | (zhodné) | OK |
| linia.vzalSi | vzal sis {spaky} | vzal si si špaky | OK (hovorové „sis“) |
| linia.schopnostMinuta | Schopnost zajatce je vyčerpaná (jednou za hru). | Schopnosť väzňa je minutá | OK; „minutá“ by bol slovakizmus |
| rekap.vieraZrusila | Víra zrušila {n} Pověr {komu} — ty měkké nedaly | (zhodné) | OK |
| rekap.hadkaVyhralSi | vyhrál jsi o <b>{n}</b> ({a} : {b} měkké) | (zhodné) | OK |
| rekapText.odpor | — nespárovaný Odpor NA EX uhasil | …zahasil | OK |
| tabula.spakyText | Vajgly jsou body… Odkud přišly, ukáže hospodská nástěnka. | (zhodné) | OK, glosár |
| tabula.chutText | …méně neřestí než Chuť = karta Absťák do balíčku (každá ubere v rvačce 1 tvrdé)… | (zhodné) | OK |
| os.pitkaText | Hrajete oba naráz… NA EX × Silná žena = ×4… Kouřit…, dolít panáka…, nový panák (barter). | (zhodné) | OK |
| prechod.bitka | Nejdřív hádka… víc tvrdého (Rána, Pecka, Herda) vyhrává rvačku a vajgly… | (zhodné) | OK, Petelica = Herda (glosár) |
| domov.hero | Postav nezastavitelnou partu odhodlaných vesnických existencí. Napij se, pohádej se, a jestli máš chuť, tak se i porvi… hlavně ať ten druhej vidí, že tobě nikdo blatníky na Pionýru ohýbat nebude. | Vystavaj nezastaviteľnú partiu… nikto nebude blatníky na Pionieri ohýbať | OK; „existencí“ za „stvorení“ (CZ pejoratívne), „druhej“ hovorové ako originál |
| motor.exekutorDlhy | Exekutor: hráči {hrac} shoří {n2} přiznané Dluhy a {n} vajglů. | (zhodné) | OK, zachytávacie skupiny {hrac},{n2},{n} zachované |
| motor.kostolVypit | Kostel: nikdo nesmí pít — v tahu jen jedna karta. | Kostol: nikto nesmie vypiť | OK |
| stavka.titul | Tahle rvačka ({karty}): tvoje výhra +{vyhra} v.{sekera}, soupeřova +{prehra}.{kd} {vysvetlenie} | …+N špakov… | OK; skratka „v.“ kvôli pádu |
| spaky.sekeraCaka | Sekyra: vajgly za rvačku ({spaky}) čekají na vítěze další rvačky. | Sekera: špaky za bitku čakajú… | OK, prestavané kvôli zhode (otázka 8) |

## Opravené pri kontrole

- `plocha.kostol` „na kterou by mělo smysl“ → „na kterou by **to** mělo smysl“.
- `panel.dlhyExekuciaPata` „(nahoru)“ → „(zaokrouhleno nahoru)“, aby to bolo jednotné s `tabula.dlhyExekutor`.
- `profil.medziobrazovky`: „Mezihry“ (čeština = medzihra, intermezzo) → „Přechodové obrazovky mezi fázemi“.
- `galeria.priznana` / `galeria.dedicstvo`: preložené podľa opraveného slovenského znenia (master 759b44c0) — „Přiznaná kletba“, „Dědictví“.

## Falošní priatelia a slovakizmy (strážené v celej vlne)

bitka → **rvačka** (CS bitka = bitva), pivnica → **sklep**, krčma → **hospoda**, minutý → **vyčerpaný / spotřebovaný**,
ťuk → **ťuknutí**, pečiatka → **razítko**, výprask → **nářez**, nemíňa limit → **nespotřebuje limit**,
zvyšok → **zbytek**, dedinčania → **vesničané**, „vyhral si“ → **„vyhrál jsi“**.

## Dĺžky

Krátke texty (tlačidlá, pásy) dlhšie o > 40 %: `plocha.fajcit` „zapálit si“ (10 znakov oproti 6), lebo glosár určuje
tlačidlo „Zapálit si“. Ak sa nezmestí, náhrada je „kouřit“ (6). `plocha.vzal.n` „vzal(a)“ je v texte, nie v tlačidle.
Ostatné sú v norme.

## Nezhody s glosárom

Žiadne. Parametre, značky `<b>/<strong>/<i>` a tvary čísel overil skript (všetky {parametre} zo sk sú aj v cs);
`npx vitest run i18n` 18/18, `npm run typecheck` bez chýb.
