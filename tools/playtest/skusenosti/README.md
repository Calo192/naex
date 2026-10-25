# Zošity skúseností AI hráčov

AI hráči si z partií vedú skúsenosti a podľa nich hrajú ďalšie partie
lepšie (Michal 2026-10-25). Príklad: playtester si všimne, že mu chýbal
poldeci, a v ďalšej partii si ho dokúpi za cigarety.

| Zošit | Kto ho číta | Kto doň zapisuje |
|---|---|---|
| `<kluc>.md` (`jano`, `eva`, `fero`, `simon`, `hela`, `vilo` z `../hraci.json`) | playtester tej postavy | spisovateľ pri reporte |
| `spolocne.md` — pravidlá a hra, platí pre všetkých | každý playtester aj protihráč | spisovateľ pri reporte |
| `protihrac.md` — AI protihráč proti ľuďom (`naex-protihrac`) | protihráč | protihráč sám na konci partie |

Nováčikovia výučby (`naex-novacik`) zošity nečítajú. Majú byť vždy čerství.
Playtester číta len svoj zošit a spoločný. Cudzí zošit by mu prezradil, ako
hrá súper.

## Kolobeh

1. **Pred partiou** si playtester prečíta svoj zošit a `spolocne.md`.
   V pláne v `dennik.md` napíše, ktoré skúsenosti chce použiť.
2. **Po partii** do `feedback.md`, časť `## Návrhy skúseností`, napíše:
   - pri použitých skúsenostiach, či sa potvrdili alebo vyvrátili,
   - 1–3 nové návrhy (vlastné aj spoločné).
   Do zošita sám nepíše.
3. **Spisovateľ pri reporte** najprv spustí `skusenosti.ts over-verziu`.
   Potom každý návrh overí proti `docs/PRAVIDLA.md` a skutočnému priebehu
   partie (denník, `priebeh.log`). Až potom zapisuje: pridá, potvrdí,
   vyvráti, opraví alebo vyradí. Nakoniec za nadpis vo feedback.md doplní
   `(zapísané RRRR-MM-DD)` a spustí `skusenosti.ts kontrola`.
4. Pri followupe `min` nie je spisovateľ. Návrhy ostanú vo feedback.md
   a zapíšu sa pri najbližšom reporte. Nájde ich `skusenosti.ts cakajuce`.

## Formát položky

```markdown
### eva-1 · Keď súper pred bitkou drží oveľa viac kariet ako ja, nepasujem kvôli cigaretám, lebo doloží telá a prehodí prevahu.
- stav: overená
- pravidlá: v5
- potvrdenia: 1
- vyvrátenia: 0
- dátum: 2026-10-25
- partie: 20261025-101500-1
- prečo: K5 pas za +3 cigarety proti verejnej ruke 10 kariet; súper doložil 2 Občanov, prevaha 3 : 2, bitka 0 : 6, −12 b.
- oprava: 2026-10-26 20261026-090000-2: … (len ak bola zlá, viac riadkov smie byť)
```

- **Nadpis** je `### <zošit>-<číslo> · <pravidlo správania>`. Nové číslo je
  o 1 vyššie ako najvyššie v zošite. Pravidlo má tvar „Keď X, robím Y,
  lebo Z“ a zmestí sa do jednej vety.
- **stav**:
  - `overená` znamená, že spisovateľ ju overil proti pravidlám verzie
    v poli `pravidlá` a priebeh partie ju podporil.
  - `neoverená` znamená, že sa odvtedy zmenila verzia pravidiel (alebo bola
    opravená) a ešte ju nik neoveril.
- **pravidlá** je `VERZIA_PRAVIDIEL` z `packages/core/src/constants.ts`
  v čase posledného overenia.
- **potvrdenia / vyvrátenia** sú počty partií, v ktorých sa skúsenosť
  osvedčila alebo zlyhala. Partia, z ktorej skúsenosť vznikla, je prvé
  potvrdenie.
- **dátum** je posledná zmena položky. **partie** sú id relácií, najnovšia
  posledná. **prečo** je jeden dôkaz z partie s kolom a číslami.
- Zošit má najviac **15** položiek. Pri preplnení vypadne najslabšia
  (`kontrola` ju vypíše): najmenej potvrdení oproti vyvráteniam, pri zhode
  neoverená, potom najstaršia. Skúsenosť, ktorá má viac vyvrátení ako
  potvrdení, sa vyradí hneď.

## Zmena pravidiel

Keď jadro dostane novú `VERZIA_PRAVIDIEL`, `over-verziu` prepne každú
overenú skúsenosť z inej verzie na `neoverená`. Pole `pravidlá` nechá, aby
bolo vidieť, z ktorej verzie skúsenosť pochádza.

Playtester neoverenú skúsenosť skúša opatrne:
- najprv ju porovná s aktuálnym `docs/PRAVIDLA.md`,
- použije ju len tam, kde chyba veľa nestojí.

Spisovateľ ju potom potvrdí (`overená`, `pravidlá` = nová verzia) alebo
zahodí. Test `packages/server/test/skusenosti.test.ts` zlyhá, kým overená
skúsenosť nesie inú verziu, než má jadro. Kto mení verziu pravidiel, spustí
`over-verziu` hneď.

```bash
S="node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts"
$S over-verziu [--nasucho]   # neoverené po zmene pravidiel
$S kontrola                  # formát, limit 15, verzie; kto vypadne pri plnom zošite
$S cakajuce                  # feedbacky v playtest/ s nezapísanými návrhmi
```

Zošity sú v gite, aby ich mal aj týždenný cloudový playtest. Zmeny v nich
sa commitujú spolu s reportom.
