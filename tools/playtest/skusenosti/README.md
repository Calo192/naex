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

## Dve verzie pravidiel — Zrejúca a Vypálená (2026-11-02)

Playtesty idú na **Zrejúcu** (kód `master`, verzia = `VERZIA_PRAVIDIEL`
jadra), protihráč hrá proti ľuďom na **Vypálenej** (vetva `vypalena`, verzia
v `verzie.json`). Zošity sú jedny (v `master`) a rozlíšenie nesie pole
**`pravidlá`** každej položky — verzie, na ktorých je overená (`v10`, alebo
`v10, v11`, keď ju potvrdili partie oboch). Inštancia z neho vyplýva, osobitné
pole netreba. `$S` = `node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts`
(príkazy na konci).

- **Návyk** pre hráča verzie X = `stav: overená` a `pravidlá` obsahuje X.
  Ostatné sú pre neho neoverené. Skúsenosť overená **len na novšej** verzii
  (Zrejúca pred Vypálenou) hráč Vypálenej vôbec nedostane — opiera sa
  o pravidlá, ktoré jeho hra ešte nemá.
- Každý hráč číta zošity cez `citaj` s **verziou svojej partie**:
  playtester `citaj zrejuca <kluc> spolocne`, protihráč na Vypálenej
  `citaj vypalena protihrac spolocne`. Výpis delí položky na návyky
  a neoverené.
- **Zápis:** nová skúsenosť dostane verziu partie, z ktorej je (`$S verzie`:
  playtest = Zrejúca, protihráč na živom webe = Vypálená). Potvrdenie
  overenej skúsenosti na inej hranej verzii verziu **pridá** (`v10` →
  `v10, v11`); neoverenú potvrdenú na verzii X prepíše na `overená`, `pravidlá: X`.
- `over-verziu` dorovná `verzie.json` z `origin/vypalena` a na `neoverená`
  prepne len skúsenosti overené výhradne na verziách, ktoré už nehrá ani
  Zrejúca, ani Vypálená.
- **Vypálenie** (skill `naex-vypalit`, krok 8.3): `vypalena` = master, `over-verziu`
  zapíše verziu Zrejúcej ako verziu Vypálenej a skúsenosti zo starej Vypálenej
  spadnú na neoverené. Kto mení `VERZIA_PRAVIDIEL` v master, spustí
  `over-verziu` hneď (skúsenosti overené na verzii Vypálenej ostanú overené —
  protihráč ich ďalej používa).

## Kolobeh

1. **Pred partiou** si playtester prečíta svoj zošit a `spolocne.md`
   (`$S citaj zrejuca <kluc> spolocne`).
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
  - `overená` znamená, že spisovateľ (protihráč) ju overil proti pravidlám
    verzií v poli `pravidlá` a priebeh partie ju podporil.
  - `neoverená` znamená, že verzie z poľa `pravidlá` sa už nehrajú (alebo bola
    opravená) a ešte ju nik neoveril.
- **pravidlá** sú verzie (`VERZIA_PRAVIDIEL` jadra partie), na ktorých bola
  overená: `v11`, alebo `v10, v11` (vzostupne, oddelené čiarkou a medzerou).
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

Keď jadro dostane novú `VERZIA_PRAVIDIEL` (alebo sa vypáli Zrejúca),
`over-verziu` prepne každú overenú skúsenosť, ktorej žiadnu verziu už nehrá
Zrejúca ani Vypálená, na `neoverená`. Pole `pravidlá` nechá, aby bolo vidieť,
z ktorej verzie skúsenosť pochádza.

Playtester neoverenú skúsenosť skúša opatrne:
- najprv ju porovná s aktuálnym `docs/PRAVIDLA.md`,
- použije ju len tam, kde chyba veľa nestojí.

Spisovateľ ju potom potvrdí (`overená`, `pravidlá` = verzia partie) alebo
zahodí. Test `packages/server/test/skusenosti.test.ts` zlyhá, kým overená
skúsenosť nesie len verzie, ktoré nehrá Zrejúca (jadro) ani Vypálená
(`verzie.json`). Kto mení verziu pravidiel, spustí `over-verziu` hneď.

```bash
S="node --experimental-strip-types --no-warnings tools/playtest/skusenosti.ts"
$S verzie                    # verzia Zrejúcej (master) a Vypálenej (verzie.json)
$S citaj zrejuca jano spolocne      # čo číta playtester (návyky / neoverené)
$S citaj vypalena protihrac spolocne # čo číta protihráč na Vypálenej
$S over-verziu [--nasucho]   # verzie.json z origin/vypalena; neoverené po zmene pravidiel
$S kontrola                  # formát, limit 15, verzie; kto vypadne pri plnom zošite
$S cakajuce                  # feedbacky v playtest/ s nezapísanými návrhmi
```

Zošity sú v gite, aby ich mal aj týždenný cloudový playtest. Zmeny v nich
sa commitujú spolu s reportom.
