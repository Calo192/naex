# Pravidlá v9.2 — stav práce (vetva `oprava/v91-zrazka-ohrozenie`, 2026-10-30)

Pokračuje cloudový agent. Zadania od organizátora (Michal 2026-10-30).

## Hotové (commitnuté)

1. **Opravy z playtestu 20261030-184957** (commit 95f9b2a):
   - Zrážka Výtržníka sa nestratila: v Pitke 2 dala Eva Úplatok na toho istého Kulturistu,
     Úplatok znížil 4 Rany Výtržníka na nič (`partia.ts utokPoUplatku`). Jadro nemenené;
     regresný test „zrážka v 1. Pitke platí cez ďalšiu Pitku až do bitky“ (pravidla-v5.test.ts);
     výpis karty v `hrac.ts` ukazuje ÚPLATOK ×N. Pravidlo Úplatok × Výtržník nie je v §7/§16
     výslovne — rozhodne Michal.
   - Nakladačka: starší v ohrození bol v ponuke len v `tools/playtest/hrac.ts` — teraz
     `starsiNaNakladacku` (texty-hraca.ts) = `prebytokNaStarsieho` ako server. Jadro aj web boli OK.
   - Náhľad NA EX (`poOdkrytiNaex`) skladá zrážku, keď súperovo NA EX vidno cez Bzdochu.
   - Náhľad vyloženia (`nahladVylozenia`) dostáva `naexVKole` — Šofér po NA EX neukazuje +2.
2. **Jadro v9.2** (commit 66009ef, potom merge origin/master bcaa2de):
   - Šenok: začína **obranca**; kto berie prvý, na **prvom ťahu len 1 kartu**
     (`KONSTANTY.SENOK_PRVY_TAH`, `maxZoSenku` — ponuka aj validácia). Bot: útočník berie druhý.
   - **NA EX sa odkrývajú naraz** (jedna hláška „NA EX sa odkrývajú naraz: …“). Poradie odkrytia
     výsledok nemenilo (zrážka symetrická, pečeň/Cirhóza po hráčoch, Vychovávateľka až po
     všetkých, Kar po hráčoch) — formulácia „najprv obrancove“ vznikla v 4da3232/e74bcd4 (v5,
     2026-10-25) ako implementačný detail, nie rozhodnutie z interview.
   - **Odpovede lícom dole** (štýl Záverečnej, zadarmo): `PlacedCard.odpoved` + `zaverecna`
     (skrytá vo viewFor ako Záverečná, bot ju zahmlí). Najprv útočník, potom obranca na druhý kraj
     (`PitkaStav.krajOdpovede`, `cieleOdpovede`); obe sa otočia naraz pred vyhodnotením
     (`otocOdpovede`: Nástup, Konflikt, prevaha, počet Pitiek; Hasič → `potom: "odpovede"`).
   - Testy jadra upravené (okrem výučby a nápovedí — tie stoja na scenári).

## Výklady, ktoré som zatiaľ rozhodol (treba zapísať do PRAVIDLA.md s dátumom a dať Michalovi)

- Viac NA EX → **viac kôl odpovedí**: v kole najviac jedna odpoveď každého (útočník, potom
  obranca na druhý kraj), kolo sa otočí, potom ďalšie (za kartou lícom dole sa nedá priložiť).
- Kto v kole nemá čím odpovedať (alebo dá „bez odpovede“), v tejto Pitke už neodpovedá.
- Útočník neodpovie → obranca na ktorýkoľvek kraj (rozhodol Michal).
- Kohút: posledné slovo zrušené, v kóde bez účinku (TODO); karta sa vyradí zo sady (Admin).
- Krčmárka (väzeň) zakazuje NA EX, nie odpoveď — s odpoveďami nekoliduje (veta v §7 r. ~524
  „Krčmárka zakáže súperovi odpovedať“ je zastaraná).
- Bzdocha skrytú odpoveď nevidí (týka sa len NA EX).
- Hasič/Nástup odpovede sa vyhodnotí pri otočení (nie pri vyložení).
- `VERZIA_PRAVIDIEL` ostáva `"v9"` (test vyžaduje `^v\d+$`); v9.2 len v dokumentoch,
  ako v9.1 — treba potvrdiť s organizátorom.

## Dokončené 2026-10-31

- Klient: skrytá odpoveď (štítok „Odpoveď · lícom dole“, rub súperovej odpovede), výber kraja
  (druhý kraj s vysvetlením), texty poradia; šenok — v prvom ťahu obrancu len 1 karta s vysvetlením.
- `tools/playtest/hrac.ts`: ponuka odpovede cez `cieleOdpovede`, texty šenku a odpovedí, výpis
  `karty` (Absťák vzniká počas hry), log finále (Nakladačka sa vo finále nerozdeľuje).
- Ťahák + `tahak.test.ts`, PRAVIDLA.md v9.2, stránka Pravidlá, `pravidla-historia.md`,
  `zmeny-pravidiel.html`, mapa rozhodcu, nový test `pravidla-v92.test.ts`.
- Turnaj (20, chamtivy, stredna, Štamgast): pred 18 výhier + 1 remíza (872 : 485) → po 19 výhier
  (1082 : 253), všetko dohrané. Odtlačok sa zmenil (zámerná zmena pravidiel).

## Ostáva

- Výučba: `prehraj.ts --ticho` padá na **kroku 10 (k-kupa-bot)** — obranca (hráč) berie zo šenku
  prvý. Padajú `vyucba.test.ts`, `napovedy.test.ts` (2) a `apps/web/test/zmenyVyucby.test.ts` —
  všetky stoja na scenári; prepočíta Vymyselník (ďalšie rozchody — odkrytie NA EX naraz, odpovede
  lícom dole, zrážka vo finále — sa ukážu až po prepočte kroku 10).
- Kohút vyradiť zo sady (Admin v tvorcovi), potom skopírovať cards.json zo sady.
- Známa chyba v9.1 (mimo zadania): Zastávka odloží zmenu fázy → `pitkaPredBitkou` nespozná
  poslednú Pitku (test rekapitulacia má TODO výnimku).
- Rozhodnutie Michala: Úplatok na Výtržníkovi (dnes zníži jeho Rany na nič).
