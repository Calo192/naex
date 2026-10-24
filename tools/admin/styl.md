# Štýl ilustrácií NA EX!

Všetkých 50 ilustrácií tlačovej sady vzniklo v Leonardo.Ai modelom **Nano Banana
(`gemini-2.5-flash-image`)**, úpravy modelom GPT Image (`gpt-image-2`). Zdroje
s promptmi v názvoch súborov sú v `docs/NA EX/NA EX/` (mimo gitu, podľa kategórií),
hotové orezané ilustrácie v `packages/server/seed/karty/<id>.jpg` (1024 × 1024)
a `<id>@512.jpg`. Nová ilustrácia sa musí dať položiť vedľa nich bez toho, aby
vyčnievala.

## Čo štýl tvorí

- **Drsný dospelý komiks / graphic novel**: hrubá čierna kontúra, ručná kresba
  tušom, šrafovanie a zrnitá textúra v tieňoch. Nie anime, nie 3D, nie fotka,
  nie akvarel, nie „roztomilé“.
- **Farby tlmené a špinavé**: hnedé, olivové, bridlicovo modré, fialkasté
  a sivé tóny. Jeden **teplý akcent svetla** (sodíková lampa, žiarovka, súmrak,
  svieca, svit mesiaca) — scéna je skôr večerná a zadymená.
- **Postavy**: realistické proporcie, ale tváre **karikované a groteskné** —
  vrásky, strnisko, červený nos, vyvalené oči, zúrivý alebo prefíkaný výraz.
  Gestá preháňajú (päsť, ukazovák, fľaša v ruke). Väčšinou postava od pása
  alebo od kolien, v strede obrazu, pohľad do kamery alebo pri činnosti.
- **Prostredie**: schátraná **slovenská dedina po socializme** — krčma, kuchyňa
  s plesňou, autobusová zastávka, benzínka s graffiti, zberný dvor, kostol,
  zrubová chata. Veľa drobností (fľaše, poháre, papiere, ohorky), opotrebované
  povrchy, oprýskaná omietka.
- **Predmety** (Náradie): predmet v strede na drevenom stole alebo pri stene,
  okolo pár súvisiacich vecí, rovnaká linka a svetlo.
- **Kompozícia**: štvorec 1:1, hlavný motív v strede (karta orezáva okraje),
  žiadny rám ani okraj.
- **Bez textu**: žiadne nápisy, písmená, logá, vodoznaky. (Výnimka: Kliatby
  ako Dlh a Cirhóza sú „dokumenty“ s grafmi — text na nich je zámerne
  nečitateľný.)
- **Bez skutočných osôb a značiek** — žiadne podobizne známych ľudí, žiadne
  skutočné logá či produkty.
- **Dym — pevné pravidlo** (Michal 2026-10-24, platí pre každý obrázok, karty
  aj pásy): dym smie ísť **len z horiacej cigarety, z cigarety v popolníku
  alebo z úst postavy, ktorá ho vyfukuje**. Nikdy z ucha, chrbta, vlasov,
  oblečenia ani len tak zo vzduchu. Model to rád porušuje — zadymená krčma mu
  stačí ako dôvod. Ak scéna fajčenie nepotrebuje, napíš do námetu „nobody is
  smoking, no smoke anywhere“.
- **Ruky** v jednoduchých prirodzených polohách, päť prstov. Žiadne pretláčanie,
  prepletené ruky ani zložité úchopy — model ich kreslí zle.
- **Predmety fyzikálne správne — pevné pravidlo** (Michal 2026-10-24, platí
  pre každý obrázok): krígeľ má **jedno** ucho, pohár a poldecák **žiadne**,
  fľaša **jedno** hrdlo, ruka **päť** prstov, stolička stojí nohami na zemi.
  Model rád kreslí krígle s dvoma uchami, keď ich postava drží oboma rukami —
  radšej nech poháre stoja na pulte či stole pred postavou, nikto ich nedrží.
  Krígeľ s dvoma uchami, fľaša s dvoma hrdlami či šesť prstov = zlý obrázok.

## Šablóna promptu

Prompt píš po anglicky (tak vznikli všetky zdroje) v poradí: **námet → detail
postavy/predmetu → prostredie → svetlo → štýl**. Štýlový chvost pridá príkaz
`admin.ts prompt` (pozri `STYL` v `tools/admin/styl.ts`), ty píšeš len námet:

```
a <prídavné mená k povahe> village <povolanie/rola> <vek, postava>,
<tvár a výraz>, <oblečenie>, <čo robí / čo drží>,
in <konkrétne schátrané dedinské prostredie>, <svetlo>
```

Príklady námetov, z ktorých vznikli súčasné karty (skrátené z názvov súborov):

- Pijan: `a haggard old village drunk man, a realistic weathered human face with a big red nose …`
- Svokra: `a furious scowling old village mother-in-law with a headscarf, deep wrinkles …`
- Hasič: `a burly angry bearded village firefighter in worn tan turnout gear and a battered helmet …`
- Benzínka: `a run-down rural Slovak petrol station at dusk, two old rusty fuel pumps, cracked …`
- Puška: `an old worn double-barreled hunting shotgun leaning against a rough wooden cabin wall …`
- Dlh: `a grim pile of overdue debt notices and red-stamped final demand papers on a worn table …`

## Generovanie v Leonardo.Ai (API)

Agent generuje cez Leonardo.Ai API — kľúč `NAEX_LEONARDO_KEY` v `.env`
(mimo gitu). API sa platí z **vlastného kreditu** (pay-as-you-go,
app.leonardo.ai → API), nie z webového predplatného; automatické dobíjanie
je vypnuté, kredit je teda strop.

```
node --experimental-strip-types --no-warnings tools/admin/admin.ts prompt <id-karty> "<námet>"
node --experimental-strip-types --no-warnings tools/admin/admin.ts generuj <id-karty> [--pocet 2] [--sila MID]
```

`prompt` uloží `prompt.txt` a `zadanie.json` (prompt, kategória, referencie)
do `admin-agent/obrazky/<id>/`. `generuj` nahrá referencie (id v Leonarde si
pamätá v `admin-agent/leonardo-referencie.json`), spustí model **Nano Banana**
(`gemini-2.5-flash-image`), 1024 × 1024, referencie ako *image reference*,
stiahne obrázky ako `kolo<N>-<i>.*` a kolo aj s cenou zapíše do
`leonardo.json`. Limit: 2 obrázky na kolo, 3 kolá na kartu (`--navyse` len
so súhlasom Michala). Prehľad útraty: `admin.ts leonardo`. Vybraný obrázok
sa nastaví príkazom `obrazok`.

## Referenčné obrázky

Nano Banana dostane spolu s promptom 2–3 hotové ilustrácie ako **image
reference** (sila MID; HIGH, keď výsledok uteká zo štýlu). Vyber ich z tej istej
kategórie ako nová karta — nástroj má predvoľby (`--kategoria`):

| kategória | referencie (seed/karty) |
|---|---|
| obcan | `svokra`, `pijan`, `hasic` |
| staresina | `krcmarka`, `veterinar`, `autobusar` |
| lokalita | `benzinka`, `krcma`, `zastavka` |
| naradie | `puska`, `vinko`, `vyherny_automat` |
| zviera | `cierna_macka`, `pes` |
| kliatba | `dlh`, `cirhoza`, `abstak` |

## Kontrola výsledku

Pred použitím si každý návrh pozri (Read na súbor) a over:

1. Linka, šrafovanie a paleta sedia s referenciami (polož ich vedľa seba).
2. Motív je v strede a prežije orez do karty (54 × 80 mm, ilustrácia v hornej časti).
3. Žiadny text, logo, rám, ani deformované ruky či tváre. Ruky a prsty si
   pozri pri plnej veľkosti (pri pochybnosti zväčšený výrez).
4. **Dym**: každý obláčik musí viesť k cigarete, popolníku alebo k ústam.
   Dym z chrbta, hlavy či zo vzduchu = zlý obrázok, generuj znova.
5. **Predmety**: spočítaj uchá kríglov (jedno), pohárov (žiadne), hrdlá fliaš
   (jedno) a prsty (päť) — aj na poličkách v pozadí. Pri pochybnosti zväčšený
   výrez.
6. Postava zodpovedá názvu a téme karty (Kliatba pôsobí ako trest, Starešina
   ako autorita, Zviera ako dedinské zviera).
7. **Starešina vyzerá skorumpovaný, že až** (Michal 2026-10-24): zlaté reťaze,
   zlaté zuby, diamanty, drahé hodinky a šperky, značkové kabelky, luxus, ktorý
   sa na dedinu nehodí (drahý traktor s krokodílom na kapote). Prehnane a okato.
8. **Ženy sú dvoch typov** (Michal 2026-10-24): staré rašple (zatrpknuté,
   škaredé, klebetné) alebo dedinské „hot chicks“ (tepláky, gýčové vyzývavé
   lacné handry, krikľavé doplnky). Vždy dospelé, bez nahoty.
   Body 7–8 sú aj v chvoste `STYL` (podmienečne, „if … appears“, aby sa
   nepretlačili do lokalít a predmetov); v námete ich aj tak napíš konkrétne.

Ak žiadny z návrhov nesedí, uprav námet (konkrétnejšie prostredie, výraz,
svetlo) a generuj znova — nie viac ako 3 kolá na kartu bez konzultácie
s Michalom (generovanie stojí kredity).

## Pásy kapitol pravidiel

`admin.ts pas-generuj <kluc> "<námet>" [--sila MID]` — široký pás nad
kapitolou stránky Pravidlá: 1536 × 672 (21:9, najširší pomer Nano Banana),
potom orez na 2,5 : 1 a zmenšenie na 1600 × 640 JPEG (150–250 kB) do
`apps/web/src/stranky/pravidla-obrazky/`. Predloha štýlu sú karty, ktoré
Michal považuje za najvydarenejšie (`REFERENCIE_PASU` v `styl.ts`: Kočovník,
Niekoho stryná, Podvodník, Zámočník, Krčmárka, Poštárka, Veterinár, Pán farár).
Model občas pridá biely okraj alebo čierne pruhy — orezávaj len čistú plochu.

## Ikony akcií (SVG)

Vstavané piktogramy (`apps/web/src/karta/ikony.ts`, vytiahnuté z tlačového
PDF) sú **plné biele siluety bez obrysov** v štvorci `viewBox="0 0 100 100"`,
motív vyplní asi 80 % plochy a je zrozumiteľný aj pri 12 px. Čierne pozadie
slotu dodáva web, preto vlastná ikona:

- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`, len `<path>`
  (prípadne `<circle>`, `<rect>`) s `fill="#fff"`, bez `stroke`, bez pozadia,
- žiadne skripty, `on…` atribúty, `<foreignObject>`, externé odkazy (server
  ich odmietne), žiadny text,
- jeden jasný predmet z dediny (fľaša, cigareta, päsť, kríž, kladivo…),
  prechody a tiene sa nerobia.

Nahratie: `admin.ts ikona <kluc> <subor.svg>`. Vrátiť vstavanú ikonu vie Michal
v Tvorba → Akcie a ikony.
