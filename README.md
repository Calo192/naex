# NA EX!

Webová verzia kartovej hry **NA EX!** (Michal Calík) — dvaja hráči,
dva prehliadače, cez internet. Beží všade, kde je prehliadač.

**Stav: hrateľné.** Všetky míľniky M0–M10 z `docs/BRIEF.md` sú
implementované; `npm run typecheck` aj `npm test` končia s kódom 0
(70 testov vrátane smoke testu celej hry a testu filtrovania).

## Spustenie

```bash
npm install
npm run dev     # server na :8787, klient na http://localhost:5173
```

Jeden hráč klikne **Založiť miestnosť**, pošle 4-znakový kód druhému,
ten sa pripojí — hra začne. Obnovenie stránky uprostred kola hru
nerozbije (kód + token sú v localStorage a klient sa sám vráti).

Ďalšie príkazy: `npm test`, `npm run typecheck`, `npm run build`.

### Nasadenie

`npm run build` a potom `node --experimental-strip-types
packages/server/src/index.ts` — jeden Node proces obsluhuje statického
klienta aj WebSocket (jeden pôvod, žiadne CORS). Stačí najmenší VPS.

## Architektúra

```
packages/core/     jadro pravidiel — čistý TS, bez I/O, deterministické
  data/cards.json    50 kariet (generované z exportu KartyAI)
  data/elders.json   8 starších — hodnoty PROVIZÓRNE (viď nižšie)
packages/server/   autoritatívny server (Node + ws, miestnosti s kódom)
apps/web/          klient (React + Vite)
```

- **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.**
  `viewFor()` posiela súperovu ruku a všetky doberacie balíčky len ako
  počty; dokazuje to test filtrovania (`packages/core/test/engine.test.ts`)
  a e2e test kontroluje každú správu zo servera.
- Klient posiela zámery (`Command`), server počíta (`apply`), klient
  kreslí (`ClientState`). Náhoda je jeden seedovaný mulberry32 v stave —
  rovnaké semienko + rovnaké príkazy = rovnaká hra.
- Rozhodnutia bitky, ktoré siahajú do vlastného balíčka (Exekútor,
  náhrada staršieho), sa zadávajú cez `defId` + zónu — uid kariet
  v doberacom balíčku klient nikdy nevidí.

## Efekty kariet (M10)

Register `packages/core/src/effects.ts` pokrýva všetkých 50 id.

- **Natívne v motore:** `dlh`, `cirhoza`, `kocovnik`.
- **Implementované:** `ihrisko`, `cigorky`, `cierna_macka`, `nealko`,
  `vinko`, `zastavka`, `zberny_dvor`, `kostol`, `lesna_cesta`, `puska`,
  `noviny`, `vyherny_automat`, `podvodnik`, `recidivista`, `pes`,
  `autobusar`, `farar`, `veterinar`, `ministrant`, `financna_poradkyna`,
  `praudovravec`, `hasic`, `policajtka`, `niekoho_stryna`, `zivnostnik`,
  `velmi_smutiaca_vdova`.
- **Režim MANUAL** (hra ich v správnej fáze vypíše do logu so ⚠ a hráči
  ich vyhodnotia sami): `benzinka`, `dievcina_na_vydaj`, `hrobar`,
  `krcma`, `krcmarka`, `liberal`, `milujuca_manzelka`, `pasca`, `pijan`,
  `postarka`, `silna_nezavisla_zena`, `starosta`, `svaty_text`,
  `veteran`, `vestica`, `vychovavatelka`, `zamocnik`, `svokra`,
  `sarlatan`, `polovnik` a doplnkové texty `abstak`u.

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
   a každá minutá fyzická cigareta (fajčenie, refill, barter). Absťák
   vzniká, keď hráč v kole skonzumuje menej než v predošlom
   (`engine.ts`, `koniecBitky`).
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
- `tools/parse_cards.py` — regenerácia `cards.json` pri zmene kariet
