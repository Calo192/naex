# Otázky prekladateľa PL — dorovnanie po v12.1 a v12.2 (2026-11-11)

Dorovnané podľa master ace26eb8: `apps/web/src/i18n/pl.json` (70 prázdnych kľúčov — pečiatky stavov, výber z ponuky, duchovia kariet, posun línie, texty v12.2), oblasti `pravidla` (37 polí), `pojmy` (11), `vyucba` (49 zastaraných + 6 nových bublín výučby v12.2), `napovedy` (`pas-cigarety`), `achievementy` (kategória *Okolo krčmy* a 38 nových) a `docs/preklady/karty/pl.json` (13 kariet so zmeneným efektom: Vínko, Pasca, Výherný automat, Vychovávateľka, Kostol, Jednota, Družstvo, Kapybara, Traktorista, Hrable, Jogurt, Izolačka, Predavačka). Krčmárka sa nezmenila. Kde sa zmenila len časť vety, ostal pôvodný preklad a zmenila sa len tá časť.

## Nové pojmy v12.2 — návrh do glosára

1. **vykladanie za poldeci** (každá karta stojí plný poldeci, limit = plné poldeci) = *wykładanie za kieliszki*; v texte „każda karta kosztuje (cię) pełny kieliszek“ a „odwraca jeden na wypity“. Zamietnuté: *płacenie kieliszkami* (znie ako platidlo, nie pitie).
2. **maximum poldeci** (Vínko, Krčmárka, barter) = *maksimum kieliszków* („Twoje maksimum kieliszków jest o 1 wyższe“). Zamietnuté: *limit kieliszków* (mýlil by sa s limitom wykładania).
3. **karta navyše** (ďalšia karta v tom istom ťahu, platí aj cigaretu; = Vypiť) = *dodatkowa karta* / *kolejna karta w ruchu* (podľa originálu: „karta navyše“ → *dodatkowa*, „ďalšia karta v ťahu“ → *kolejna karta w ruchu*). Súlad s glosárom „akcja dodatkowa“.
4. **„nestojí poldeci“** (Nástroj, Dedičstvo, priznanie, Robota na Družstve) = *nie kosztuje kieliszka* — nahrádza staré *nie zużywa limitu*.
5. **doliatie po Pitke** (1 zadarmo + akcie Poldeci; za cigarety sa už nedolieva) = *dolewka po Popijawie*, sloveso *dolewa się (ci)*; **obnova po bitke** (všetky na plné) = *odnawiają się do pełna*, štítok prísunu *Po bójce*.
6. **Pečiatky na stole**: VÝTRŽNÍK! = *AWANTURNIK!*, VZBURA! = *BUNT!*, FORSÁŽ! = *TURBO!*, ZAHASENÉ! = *ZGASZONE!*, POSILNENÉ! = *WZMOCNIONE!* (stredný rod — pečiatka patrí k NA EX, ktoré je v PL r. n.), ODPOVEĎ = *ODPOWIEDŹ*, pod pečiatkou *zakryta* / *odkryta* (kratšie než *rewersem do góry*), majiteľ NA EX *twoje* / *obaj* / *ukryte*, „Rany pre {koho}“ = *Strzały dla: {koho}* (ako `plocha.vytrznikTitul`).
7. **Výber z ponuky**: VZIAŤ! (do ruky) = *WEŹ!*, NAVRCH! (do balíčka) = *NA GÓRĘ!* — *NA WIERZCH!* by bolo o 57 % dlhšie; v aria texte ostáva plné *na wierzch talii dobierania*.
8. **Okolo krčmy** (kategória achievementov za Spätnú väzbu, známky, dni hrania) = *Wokół knajpy*.

## Pochybnosti

9. **Pečiatka ZÁVEREČNÁ** (`peciatka.zaverecna`) = *OSTATNIA* — plný pojem *OSTATNIA KOLEJKA* je o 78 % dlhší a na pečiatke cez kartu by sa nemusel zmestiť; pod pečiatkou je *zakryta* / *odkryta*, v titulku plné *Ostatnia kolejka*. Ak sa dlhá pečiatka zmestí, stačí zmeniť jeden kľúč.
10. **`pojmy` › `naex`** — „na kartu s aktívnym (nespárovaným) Odporom nejde — skryté či z Vínka zahasí“: prekladám ako „NA EX ukryte albo z Winka Opór gasi“ (Odpor zahasí NA EX, ktoré sa naň dostane skryto alebo z hrany Vínka). Ak je podmet opačný, opraviť.
11. **Nápoveda `pas-cigarety`** — „Ja by som ich nenechal stáť“ (Melichar by plné poldeci nenechal stáť = vypil by ich) je preložené miestnou hračkou *Ja bym im nie dał się zagrzać* (wódka sa nemá zohriať).
12. **Achievementy so slovnou hračkou**: *Sekera v pni* = *Krecha wymazana* (výhra zoberie, čo bolo na sekere — v PL *na krechę*); *Huba nevymáchaná* = *Niewyparzona gęba*; *Ruka ako lopata* = *Łapa jak łopata*; *O fúz* = *O włos*, *O chlp* = *Ledwo, ledwo* (dve rôzne mená, aby sa nemýlili); *Rýchlovka* = *Na szybko*; *Šichta* = *Szychta*; *Zatĺkať, zatĺkať* = *W zaparte*; *Ani ryba, ani rak* = *Ni pies, ni wydra*; *Platím rundu* = *Stawiam kolejkę* (ustálené spojenie, hoci *kolejka* je aj v *Ostatnia kolejka*); *Rekvalifikácia* = *Przekwalifikowanie* (iné slovo než *Przeszkolenie*).

## Rozpory v slovenskom zdroji (nemenil som ich)

13. **`os.zhromazdenieText2`** (sk.json) stále píše „Kto pasuje … dostane cigaretu za každú kartu, ktorú ešte smel vyložiť“ a „Končí, keď obaja vyčerpajú limit“ — od v12.2 pas cigarety nedáva. Preklad PL zodpovedá starému originálu; po oprave slovenčiny treba kľúč preložiť znova (dorovnaj.ts hlavný slovník zmenu sám nenahlási — vyprázdniť kľúč).
14. **Achievement `abstinent`** — popis „… nedolievaj, nebarteruj …“: dolievanie za cigarety v12.2 zaniklo, hráč už sám nedolieva. Ostáva po starom, kým sa nezmení slovenčina.
