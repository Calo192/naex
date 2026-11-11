# Otázky EN — vlna 3d (2026-11-11)

Preklad prázdnych kľúčov `apps/web/src/i18n/en.json` (stôl, profil, Domov, medziobrazovky, vzory motora).
Glosár sa nemenil; nové pojmy a pochybnosti sú tu.

## Chyby v zdroji (sk.json)

1. **`galeria.priznana`, `galeria.dedicstvo`** — slovenská hodnota je pokazená extrakciou z kódu:
   `priznane", k, "Priznaná kliatba` a `dedicstvo", k, "Dedičstvo` (v hre sa to tak aj zobrazí).
   EN má správny význam: *Confessed curse*, *Heirloom*. Treba opraviť sk.json (a ostatné jazyky).

## Nové pojmy mimo glosára (navrhujem doplniť)

2. **dedinská troska** (náhodný avatar) = *village wreck*. Zamietnuté: *village idiot* (urážka inteligencie, nie úpadku), *local legend* (bez irónie).
3. **pult Melichara** (soundboard s hláškami) = *Melichar's soundboard*; **pult** ako režim zobrazenia starších (`linia.pult`, proti *Thermometers*) = *Dashboard*. Ak je režim „Pult“ myslený ako krčmový pult, lepšie *Bar* — overiť v UI.
4. **účet zadĺženia** (zvyšok zadĺženia „ostáva na účte“) = *stays on the account*. Zvažoval som *on the slate*, ale to je v britskej krčme to isté ako *the Tab* (sekera) — miešalo by sa.
5. **prepadnúť** (špaky, zvyšok) = *forfeited*.
6. **exekúcia** v krátkych štítkoch = *the bailiff* („burned by the bailiff“, „bailiff in the brawl“); dlhé *the bailiff's visit* len v súvislých vetách. Glosár má obe.
7. **Ligy** v profile = *Divisions* (podľa glosára *Third / Second / First Division*); **V / R / P** = *W / D / L*.

## Významové pochybnosti

8. **`domov.hero`** — „nikto nebude blatníky na Pionieri ohýbať“: Pionier (Jawa) cudzinec nepozná. Preložené
   *nobody, but nobody, bends the mudguards on your moped* — obraz ostáva, značka zmizla. Možnosti: (a) nechať,
   (b) britský ekvivalent lacnej motorky z dediny (*Honda C90*), (c) *nobody messes with you*. Odporúčam (a).
9. **`rekap.rozdelujeSuper` / `rekap.rozdelujesTy`** — „rozdeľuje {meno}: priazeň jemu, strach z teba“ odporuje
   `plocha.superRozdelujeNakladacku` („priazeň sa posunie k tebe“). Preložené doslova (*favour to them, fear of you*);
   ak ide o legendu farieb, treba spresniť slovenčinu.
10. **Rod súpera** — slovenčina používa pre súpera generické mužské (ho, mu, jeho). V EN je súper *they / their*
    (pohlavie súpera nepoznáme); starší je *the elder* alebo *them* (medzi staršími sú aj ženy: Krčmárka, Poštárka…).
    Tvary `.m / .z / .n` pre hráča samého sú v EN zväčša rovnaké — angličtina rod v 2. osobe nemá.
11. **`plocha.sBzdochouJa`** — veta nemá podmet („S Bzdochou hrá Pitku až po {meno}“); EN zachováva neurčitosť
    (*With the Earwig: plays the Booze-up only after {meno}…*). Overiť, pri ktorom paneli sa ukazuje.
12. **`linia.vPivnici`** pečiatka „V PIVNICI“ → *IN THE CELLAR* (13 znakov proti 9). Ak sa nezmestí, *CELLARED*.
