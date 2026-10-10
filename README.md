# NA EX!

Webová verzia kartovej hry **NA EX!** (Michal Calík) — dvaja hráči,
dva prehliadače, cez internet. Beží všade, kde je prehliadač.

Web má tri časti a prihlásenie:

| Časť | Kto | Čo |
|---|---|---|
| **Pravidlá** (`/pravidla`) | ktokoľvek | pravidlá v2 po kapitolách s ilustráciami a interaktívnymi ukážkami |
| **Karty** (`/karty`) | ktokoľvek | glosár kariet v tlačovom vzhľade, tooltipy akcií a pojmov, varianty |
| **Hrať** (`/hra`) | prihlásený hráč | súkromná hra s kódom alebo verejná hra zo zoznamu, mená a avatary |
| **Tvorba** (`/admin`) | admin | webová verzia MAUI aplikácie KartyAI — návrhy kariet, tvorca, akcie, kľúčové slová, farby, štatistiky, simulácia, bodovacie karty, tlač, import/export, používatelia, zverejnenie sady |
| **Profil** (`/profil`) | prihlásený | herné meno, avatar, heslo |

**Stav:** míľniky M0–M14 hotové; `npm run typecheck` a `npm test` končia
s kódom 0 (88 testov vrátane celej partie cez server, filtrovania pohľadu,
účtov, rolí a zverejnenia sady).

## Spustenie

```bash
npm install
NAEX_ADMINS=michal npm run dev   # server :8787 + klient http://localhost:5173
```

Zaregistruj sa s prihlasovacím menom z `NAEX_ADMINS` — účet dostane rolu
admin. Pri prvom štarte sa databáza (`data/naex.sqlite`) naplní tlačovou
sadou kariet a zverejní ako verzia 1. Obrázky z `docs/NA EX` pridáš do
knižnice tvorcu: `npm run kniznica -- "docs/NA EX/NA EX"`.

Ďalšie príkazy: `npm test`, `npm run typecheck`, `npm run build`,
`npm start` (produkčný server s klientom na :8787).

**Nasadenie na internet:** `docs/NASADENIE.md` (Hetzner VPS + Docker +
Caddy s HTTPS, ~6 € mesačne).

## Architektúra

```
packages/core/     jadro pravidiel — čistý TS, bez I/O, deterministické
  data/cards.json    východisková sada (z tlačového PDF, tools/import_print_pdf.py)
  data/elders.json   8 starších — hodnoty PROVIZÓRNE (viď nižšie)
packages/tvorba/   model tvorcu kariet — čistý TS (varianty, farby, geometria
                   karty, formát textu, export/import TXT, štatistiky)
packages/server/   autoritatívny server: hra (ws), REST API, SQLite, médiá
  seed/              ilustrácie a vzhľad kariet pre prvé spustenie
apps/web/          klient (React + Vite)
tools/             import z tlačového PDF, piktogramy akcií
```

- **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.**
  `viewFor()` posiela súperovu ruku a všetky doberacie balíčky len ako
  počty; dokazuje to test filtrovania a e2e test kontroluje každú správu.
- Klient posiela zámery (`Command`), server počíta (`apply`), klient
  kreslí (`ClientState`). Náhoda je jeden seedovaný generátor v stave.
- **Sady kariet:** admin upravuje návrhy; hráči, glosár a nové partie
  vidia len poslednú **zverejnenú** sadu. Rozohraná partia dohrá na sade,
  s ktorou začala. Zverejnenie overí návrhy cez `loadGameData` jadra;
  karta s vlastnou akciou bez pravidiel v jadre sa zverejniť nedá.
- **Účty:** heslá scrypt, relácia v HttpOnly cookie (v databáze len hash
  tokenu), každá zmena nesie hlavičku `X-Naex` (CSRF), admin cesty
  overujú rolu na serveri. Nahraté súbory sa overujú podľa obsahu.

## Efekty kariet (M10)

Register `packages/core/src/effects.ts` pokrýva všetkých 50 id tlačovej sady.
Nová karta z tvorcu (neznáme id) beží automaticky v režime MANUAL.

- **Natívne v motore:** `dlh`, `cirhoza`, `kocovnik`, `abstak`.
- **Implementované:** `ihrisko`, `cigorky`, `cierna_macka`, `nealko`,
  `vinko`, `zastavka`, `zberny_dvor`, `kostol`, `lesna_cesta`, `puska`,
  `noviny`, `vyherny_automat`, `podvodnik`, `recidivista`, `pes`,
  `autobusar`, `farar`, `veterinar`, `ministrant`, `financna_poradkyna`,
  `praudovravec`, `hasic`, `niekoho_stryna`, `zivnostnik`,
  `velmi_smutiaca_vdova`, `zahradkar`.
- **Režim MANUAL** (hra ich v správnej fáze vypíše do logu so ⚠ a hráči
  ich vyhodnotia sami): `benzinka`, `dievcina_na_vydaj`, `hrobar`,
  `krcma`, `krcmarka`, `liberal`, `milujuca_manzelka`, `pasca`, `pijan`,
  `policajtka`, `postarka`, `silna_nezavisla_zena`, `starosta`,
  `svaty_text`, `veteran`, `vestica`, `vychovavatelka`, `zamocnik`,
  `svokra`, `sarlatan`.

## Rozhodnuté nejasnosti (otvorené otázky z BRIEF-u)

Pravidlá v11 tieto veci nehovoria jednoznačne; správanie sa dá zmeniť
na jednom mieste v kóde (odkazy v zátvorkách).

1. **Posilnenie + Posilnenie** na spoji → nič sa nedeje (`partia.ts`).
2. **NA EX** je tá istá operácia na vlastnej aj súperovej karte: zruší
   aktívne, zdvojnásobí neaktívne akcie cieľovej karty; dôsledky jej
   akcií na susedoch (Posilnenie ×2, zrušenie Odporom) ostávajú
   (`partia.ts`, `applyNaex`).
3. **Podpora** — lokalita sa počíta ako karta v okolí (zatiaľ bez
   dosahu: žiadny implementovaný efekt Podporu nepoužíva).
4. **Vzbura na lokalite** aktivuje len stranu patriacu danej partii
   (`partia.ts`, `markVzbura`).
5. **Cirhóza v partii** = +1 tuhé pre súpera za každú (`battle.ts`,
   `cirhozaBonus`; veterinár ju znižuje).
6. **Absťák / neresti** — ako nerest sa počíta každý vypitý poldeci
   a každá minutá fyzická cigareta (fajčenie, refill, barter). Podľa
   pravidiel v2: menej než minulé kolo → Absťák rovno priznaný; viac →
   jeden Absťák späť do zásoby; prvé kolo len nastaví základ
   (`engine.ts`, `koniecBitky`).
10. **Robota** odhadzuje priznaný Dlh do odhadzovacieho balíčka hráča
   („odhodenie“ podľa pojmov), pred kontrolou prahu Exekútora.
11. **Prah Cirhózy** — pravidlá v2 uvádzajú raz „základ 3“, inde
   „Alkoholik: 2 + priazeň“; ponechané 2 + priazeň (`constants.ts`).
7. **Štartovacia ruka** — 3× Pijan, 3× Miňištrant, 2× Milujúca
   manželka, 2× Dievčina na vydaj (`constants.ts`, TODO overiť).
8. **Lokality** — v hre sú 3 náhodné zo 7 (krátka hra;
   `KONSTANTY.LOKALIT_V_HRE`).
9. **Šenok** — dopĺňa sa na počet nenahradených starších na začiatku
   kola; keď sa spoločný balíček minie, šenok sa už nedopĺňa
   (`engine.ts`, `doplnSenok`).

Ďalšie drobné rozhodnutia: prebytok rozdeľuje jeho **držiteľ** (vyššie
celkové) smerom k súperovi; veľkosť balíčka sa kontroluje po drafte
a na konci kola (nie uprostred, keď karty ležia v partiách); Vízia sa
vyhodnocuje automaticky (zahodí kliatby z práve dobraných); Liečba
berie kartu zo šenku priamo (zjednodušené Preskúmanie); barter berie
len fyzické cigarety.

## Hodnoty, ktoré treba doladiť podľa komponentov

Všetko na jednom mieste: `packages/core/src/constants.ts` (s TODO
komentármi) a `packages/core/data/elders.json`:

- priradenie **priazní** starším a **bočné bodovacie pozície**
  (zóna + body) — teraz tematický odhad,
- body za **lokalitu**, **staršieho**, **cigaretu**, pokuta za
  **nepriznanú cirhózu** (pravidlá udávajú len −1 za nepriznaný dlh),
- rozdelenie **štartovacej ruky** a počet **kópií kariet** v spoločnom
  balíčku.

## Zdroje

- Pravidlá v11: `C:\Users\Michal\Documents\Claude\naex_pravidla_v11_tlac.docx`
- Export kariet: `C:\Users\Michal\Documents\Claude\kartyai_cards_20260713_rozsirene.txt`
- `tools/parse_cards.py` — staršia cesta: `cards.json` z TXT exportu MAUI (ten istý TXT dnes importuje aj tvorca na webe)
