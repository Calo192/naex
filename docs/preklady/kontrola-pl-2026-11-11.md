# Kontrola PL — 2026-11-11 (vlna 3d)

Spätný preklad vzorky 40 kľúčov herného stola z `apps/web/src/i18n/pl.json` (preložených 1544 kľúčov: stôl, profil, Domov, medziobrazovky, vzory motora). Overenie: `npx vitest run i18n` (18/18), `npm run typecheck` OK; parametre, značky a tvary skontrolované skriptom proti `sk.json` (0 rozdielov). Vzory motora vyskúšané na hláškach („Exekútor: hráčovi Fero zhorí 3 priznané Dlhy a 2 špaky.“ → „Komornik pali graczowi Fero: 3 przyznane Długi i 2 pety.“).

| Kľúč | PL | Spätný preklad | Verdikt |
|---|---|---|---|
| plocha.naexOdkryte | NA EX są odkryte — {meno} {dal} NA EX{na}. Możesz wyłożyć z ręki jedną kartę rewersem do góry (za pełny kieliszek, który wypijesz — wątroba +1; nie zużywa limitu)… | NA EX sú odkryté — X dal NA EX na… Môžeš vyložiť z ruky jednu kartu lícom dole (za plný poldeci, ktorý vypiješ — pečeň +1; limit nemíňa)… | OK |
| plocha.vytrznikTitul | Zderzenie NA EX: obaj postawiliście kieliszek na tej karcie. Do końca bójki jest z niej Awanturnik — każda jej akcja to Strzał dla: {koho}. Po bójce wytrzeźwieje. | Zrážka NA EX: obaja ste postavili poldeci na túto kartu… Výtržník — každá akcia je Rana pre… Po bitke vytriezvie. | OK, „vytriezvie“ zachované |
| plocha.odporTitul | Niesparowany Opór stanął przeciw kieliszkowi i zgasił NA EX — karta liczy się jak bez niego. | Nespárovaný Odpor sa postavil proti poldecu a zahasil NA EX… | OK |
| plocha.krcmaMusis | Knajpa: dopóki masz pełny kieliszek, musisz dać NA EX — kliknij kartę ze znaczkiem. | Krčma: kým máš plný poldeci, musíš dať NA EX… | OK |
| plocha.jednota | Spożywczak: masz więcej przyznanych Długów — nie wolno ci palić ani dolewać. | Jednota: máš viac priznaných Dlhov — nesmieš fajčiť ani dolievať. | OK |
| plocha.vinko | Winko w Dziedzictwie: kieliszków za papierosy dolewać nie wolno (nowy kieliszek barterem tak). | Vínko v Dedičstve: poldeci za cigarety dolievať nesmieš (nový barterom áno). | OK |
| plocha.barterTip | Menelski barter: za {cena} dostaniesz dodatkowy nowy pełny kieliszek — masz o kieliszek więcej na stałe. | Stokársky barter: … nový plný poldeci navyše — o poldeci viac natrvalo. | OK |
| plocha.benzinkaTip | Stacja paliw: każde palenie jest o 1 papierosa tańsze, pierwsze w Popijawie za darmo… Grzech to tylko wypalony papieros, darmowy nie. | Benzínka: každé fajčenie o 1 cigaretu lacnejšie… Nerest je len vyfajčená cigareta, zadarmo žiadna. | OK |
| plocha.fajcitTip | Zapal za {cena}{benzinka}: od razu dobierasz kartę… Każdy wypalony papieros to grzech. | Fajči za…: hneď si doberieš kartu… Každá vyfajčená cigareta je nerest. | OK |
| plocha.skoncitBezNaex | Skończyć bez NA EX? Masz pełny kieliszek, a w tej Popijawie już go nie dasz — kliknij jeszcze raz albo Esc. | Skončiť bez NA EX? … | OK |
| plocha.zaverecnaTlacidlo | Ostatnia kolejka: ostatnia karta propozycji pójdzie rewersem do góry za {cig}… (bez papierosów za pas). | Záverečná: posledná karta návrhu pôjde lícom dole… (bez cigariet za pas). | OK; „Ostatnia kolejka“ nesie aj zmysel „posledná runda v krčme“ |
| plocha.superRozdelujeNakladacku | {meno} wygrał bójkę i rozdziela Łomot na swój strach — starsi zaczną się go bać bardziej, a przychylność przesunie się ku tobie. | … rozdeľuje Nakladačku na svoj strach — starší sa ho začnú báť viac a priazeň sa posunie k tebe. | OK |
| plocha.hasicTi | Strażak wyciągnął ci ze stosu kart odrzuconych kartę {karta}. Zatrzymasz ją w ręce czy odłożysz z powrotem na stos? | Hasič ti z odhadzovacieho balíčka vytiahol kartu… Necháš si ju, alebo vrátiš? | OK |
| plocha.cintorinText | jedną kartę ze swojego stosu kart odrzuconych (…) możesz wziąć do ręki. Kliknij ją albo nic. | … smieš vziať do ruky. Klikni na ňu, alebo nič. | OK |
| plocha.svokra (5) | Teściowa ({meno}): w bójce zada ci {n} Strzałów (w twardych już są) | Svokra (X): v bitke ti udelí n Rán (v tuhom už sú) | OK |
| plocha.kar | Stypa: wątrobę za to NA EX dostanie {meno} | Kar: pečeň za toto NA EX dostane X | OK |
| plocha.hrozbaCele | {kdo} dać NA EX na {karta}: {tuhe}{prebytok} (z kart na stole, ręka się nie liczy). | X ešte môže dať NA EX na… (z kariet na stole, ruka sa neráta) | OK; poradie „może jeszcze“ sedí so `tyEsteMozes` |
| plocha.tahStoji (22) | Ruch kosztuje cię 22 pełne kieliszki — limit 3 → 1, wątroba +22 | Ťah ťa stojí 22 plné poldeci… | OK, pl tvar 22–24 overený |
| plocha.vesticaVymena | {dam} trafi do gracza {meno}, {vezmem} przyjdzie do ciebie. | … odíde k hráčovi X, … príde k tebe. | OK (meno nesklonné → „gracza“) |
| plocha.zajatNahlad | Pojmij: {meno} za {cena} — jeniec w twojej piwnicy (…), {super} odda ci {spaky}. | Zajať X za … — väzeň v tvojej pivnici, súper ti odovzdá … | OK |
| panel.obrancaText | Wygrał ostatnią bójkę: wybiera cel rundy, z oferty bierze pierwszy (…), na NA EX odpowiada drugi, na drugie skrzydło. Remis w twardych wygrywa ten, kto ma mniej Głodów, potem Długów; inaczej pety idą na krechę. | Vyhral poslednú bitku: vyberá cieľ kola… Remízu v tuhom vyhrá, kto má menej Absťákov, potom Dlhov; inak špaky na sekeru. | OK |
| panel.chutPravidlo | Grzech to tylko to, co wypijesz i wypalisz… Głodu nie da się przyznać… Spalić go może Wizja. | Nerest je len to, čo vypiješ a vyfajčíš… Absťák sa nedá priznať… Spáliť ho smie Vízia. | OK |
| panel.dlhyExekutor | Za przyznane Długi w każdej bójce przyjdzie Komornik: spłonie połowa Długów (w górę) i tyle samo petów… Działkowiec w twojej ekipie sprawi, że w tej rundzie cię ominie. | Za priznané Dlhy príde Exekútor: zhorí polovica Dlhov (nahor) a toľko špakov… Záhradkár v tvojej partii ho v tom kole obíde. | OK, „partia“ = ekipa podľa glosára |
| panel.rozdielTuheho | Różnica twardych to Łomot, trzyma go zwycięzca (Zgorszenia i Zabobony są miękkie…) | Rozdiel tuhého je Nakladačka, drží ju víťaz… | OK |
| panel.zdrojAbstak | Głody (trzęsą się ręce) | Absťáky (trasú sa ruky) | OK, vtip zachovaný |
| panel.zdrojPasca | Pułapka przeciwnika (−1 za każde twoje Zwierzę w linii) | súperova Pasca (−1 za každé tvoje Zviera) | OK |
| panel.taBitka | ta bójka ({karty}): twoja wygrana +{vyhra} petów, przeciwnika +{prehra} | táto bitka: tvoja výhra +n špakov, súperova +m | OK |
| panel.vyhralBitku.z | Wygrałaś bójkę | Vyhrala si bitku | OK |
| panel.utocnikText | Przegrał ostatnią bójkę: wykłada pierwszy, z oferty bierze drugi. Na NA EX odpowiada pierwszy — rewersem do góry. | Prehral poslednú bitku: vykladá prvý… lícom dole. | OK |
| starsi.pravidloStrachu | Każdy gracz ma przy starszym swój termometr: pełna część to jego strach, kreskowanie to plotki przeciwnika… | Každý hráč má pri staršom svoj teplomer: plná časť je strach, šrafa súperove reči… | OK |
| starsi.titulJa | Przychylność daje ci {priazen} z {z} starszych (słupek u góry)… Boi się ciebie {strach}… | Priazeň ti dáva … z … starších … Bojí sa ťa … | OK |
| tabula.chutText | Grzech to tylko to, co wypijesz i wypalisz: Wypić 1, odpowiedź na NA EX 1… | Nerest je len to, čo vypiješ a vyfajčíš… | OK |
| tabula.dlhyExekutor | Za przyznane Długi w każdej bójce przyjdzie Komornik: spłonie połowa Długów (w górę) i tyle samo petów. | … | OK |
| rekap.vieraZrusila (5) | Wiara zniosła {komu} {n} Zabobonów — te miękkie nie weszły | Viera zrušila komu n Povier — tie mäkké nedali | OK; „nie weszły“ = nezarátali sa |
| rekap.hadkaVyhral | wygrał {meno} o {n} ({a} : {b} miękkich) | vyhral X o n (a : b mäkké) | OK |
| linia.vazenAria | {meno} — w piwnicy ({kto}): wciąż jest nim {stupen}, liczy się jako czerwony | X — v pivnici u Y: je z neho stále vydesený, ráta sa ako červená | OK („jest nim przerażony“ = bojí sa ho) |
| ucinok.uzernik | Chrzestny: po bójce do {n} twoich przyznanych Długów przechodzi do przyznanych Długów przeciwnika. | Kmotor: po bitke prejdú až n tvojich priznaných Dlhov medzi súperove. | OK |
| ucinok.lakomec (2) | Abstynent: w bójce nie liczą ci się {n} Głody… | Abstinent: v bitke sa ti nerátajú n Absťáky… | OK |
| os.pitkaText | Gracie obaj naraz; „gotowe” nie da się cofnąć… NA EX × Silna kobieta = ×4… | Hráte obaja naraz… NA EX × Silná žena = ×4… | OK |
| domov.hero | Zbuduj niepowstrzymaną ekipę zdeterminowanych wiejskich stworzeń. Wypij, pokłóć się, a jak masz ochotę, to i się pobij… byle ten drugi widział, że tobie nikt nie będzie błotników w Komarku wyginał. | Vystavaj nezastaviteľnú partiu… nech ten druhý vidí, že tebe nikto nebude blatníky na Komare ohýbať. | Miestny ekvivalent: Pionier → Komar (otázka 3) |

## Posuny, opravy, dĺžky

- Opravené pri kontrole: `profil.hlasitostVypnuty` „wyłączony“ → **„Głośność: wyłączona“** (rod sedí so „Głośność“); `plocha.naSekereText` „Na kreskę“ → **„Na krechę“** (glosár); `plocha.zajatNahlad` / `presvedcitNahlad` dvojitá dvojbodka → pomlčka; `domov.uvod` „dla dwojga“ → **„dla dwóch graczy“**.
- Mŕtve vtipy: žiadne. „Ostatnia kolejka“, „Głody (trzęsą się ręce)“, „wytrzeźwieje“, „wiejski wrak człowieka“ nesú pôvodnú príchuť.
- Nezhody s glosárom: žiadne (overené mená akcií, fáz, starších, lokalít, kariet z `docs/preklady/karty/pl.json`).
- Dĺžky tlačidiel (> 40 % nad originálom): `plocha.fajcit` „zapal“ (kratšie), `plocha.doliat` „dolej“, `plocha.zasunut` „podłóż“, `plocha.uzNetaham` „już nie biorę“ (+8 %), `plocha.skoncitPitku` „Zakończ Popijawę“ (+33 %), `plocha.vratitKartuDoPonuky` „Odłóż kartę do oferty“ (−5 %) — v limite. Dlhšie o > 40 %: `plocha.odpovedLicomDole` „Odpowiedź · rewersem do góry“ (+45 %) a `plocha.zaverecnaLicom` „Ostatnia kolejka · rewersem do góry“ — štítky karty; ak sa nezmestia, skrátiť na *zakryta* (otázka 6).
- Obmedzenie vzorov: mená kariet zachytené z hlášky servera ostávajú po slovensky (otázka 10).
