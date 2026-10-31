# Playtest mobilu — návod pre AI playtestera

Hráš partiu NA EX! proti botovi na **telefóne na šírku** (rozloženie stola „Pult“, zatiaľ
len pre správcov) a hodnotíš **výlučne UI/UX**: ako hra na telefóne vyzerá a ako sa ovláda.
Herné pravidlá, rovnováhu kariet ani silu bota **nehodnotíš** — ak ti niečo v pravidlách
príde divné, nevšímaj si to, ak to nie je chyba zobrazenia.

Prehliadač ovládaš ako človek: pozeráš snímky obrazovky (Read) a ťukáš prstom na súradnice.
Nástroj: `tools/playtest/mobil.ts` (spúšťaj z koreňa pracoviska, kde beží server).

## Začiatok relácie (robí Leader alebo ten, kto playtest spúšťa)

```bash
# vývojový server pracoviska (API na PORT, web na NAEX_WEB_PORT)
PORT=8791 NAEX_WEB_PORT=5176 npm run dev        # na pozadí

M="node --experimental-strip-types --no-warnings tools/playtest/mobil.ts"
$M zaloz 2 --url http://localhost:8791 --web http://localhost:5176 [--displej 762x340] [--kola 1] [--liga kratka]
```

- `zaloz N` pripraví N playtesterov (1–3) v jednej relácii: každý má vlastný prehliadač
  a vlastný účet **Palec (AI)**, **Ukazovák (AI)**, **Prsteník (AI)** (subadmin; heslo admina
  z `.env`). Iné mená: `--hraci "Palec,Ukazovák"` (bez čísla na konci).
- `--displej`: okno telefónu na šírku **s lištou prehliadača** v CSS px. Predvolene
  `762x340` (Android Chrome, Michal 2026-10-31); ďalej `800x330`, `844x350` (iPhone Safari),
  `915x380`, `780x300` (malý telefón). Hustota pixelov 3, dotyk, user-agent telefónu.
- `--kola 1` = playtest „jedno kolo“ (predvolené). Krátka hra = `--liga kratka` (Tretia
  liga: 3 lokality + finále) a `--kola 4` (celá partia). Partia s botom sa do štatistík neráta.
- Výpis povie cestu relácie `R` (napr. `playtest/mobil/20261031-152424`).

## Príkazy playtestera n

| Príkaz | Čo urobí |
|---|---|
| `$M R n partia` | založí partiu proti botovi a otvorí stôl |
| `$M R n pozri` | snímka + zoznam ťukateľných prvkov + upozornenia |
| `$M R n tuk <číslo\|x,y>` | ťuk prstom; `tuk 18 18` = dva ťuky rýchlo po sebe (potvrdenie „naozaj?“) |
| `$M R n podrz <číslo\|x,y> [--ms 700]` | dlhý dotyk (zväčšenie karty) — dá aj snímku počas držania |
| `$M R n potiahni <odkiaľ> <kam>` | ťahanie prstom (karta na stôl, posun stránky) |
| `$M R n otoc` | telefón na výšku; znova = späť na šírku |
| `$M R n detail <číslo\|x,y,w,h>` | ostrý výrez v skutočnej hustote (3×) — drobné písmo, orezaný text |
| `$M R n pockaj <s>` | počká (ťah bota) a odfotí |
| `$M R n pis <text>` / `klaves Enter` / `otvor /cesta` | písanie, kláves, iná stránka |

Po každom príkaze dostaneš:

- **Snímku** (`hrac<n>/snimky/NNN-….png`) — pozri ju. Je v CSS px telefónu, takže súradnice
  zo snímky platia priamo pre `tuk x,y`.
- **Partia:** kolo, fáza (kde nález vznikol) a kto je na ťahu. Pri „ťahá súper“ daj `pockaj 3`.
- **Ťukateľné prvky** s číslom, stredom a rozmerom v CSS px; `⚠ < 44 px` = menší cieľ, než je
  pohodlné pre prst. Čísla platia len pre posledný výpis.
- **Upozornenia z DOM** — automatické merania: text orezaný alebo vytŕčajúci z boxu, prvky
  mimo displeja, ťukateľné prvky cez seba, písmo < 11 px. Sú to **podozrenia**: každé over
  na snímke (prípadne `detail`). Do nálezov patrí len to, čo naozaj vadí človeku.
- Keď výpis povie **KONIEC PLAYTESTU**, dohraj len obrazovku, na ktorej si, a napíš nálezy.

Neotváraj počas partie inú stránku (`otvor`) — partia proti botovi odchodom zo stola zanikne.

## Čo hodnotiť (len UI/UX)

1. **Vzhľad na malom displeji** — zmestí sa stôl bez posúvania? Je jasné, čo je tvoje a čo súperovo?
2. **Texty** — zle zalomené, orezané, vytŕčajúce z tlačidiel a bublín, prekrývajúce sa.
3. **Čitateľnosť** — drobné písmo, kontrast, ikony bez popisu.
4. **Ovládanie prstom** — malé ciele, ciele tesne vedľa seba, ťuk trafí niečo iné,
   chýbajúca odozva, nejasné, či sa ťuk ujal; dlhý dotyk a ťahanie.
5. **Prekrývanie** — vrstvy, nápovedy a bubliny, ktoré zakryjú, čo práve treba.
6. **Tok a orientácia** — vieš v každej fáze, čo máš urobiť a kam ťuknúť? Dostaneš sa ďalej
   bez hľadania?
7. **Otočenie** — aspoň raz `otoc` a späť; partia má pokračovať v tom istom stave.

Stôl sa na telefóne hrá povinne na celej obrazovke: pri príchode k stolu (aj po obnovení
stránky) je celoplošná výzva „Ťukni a hraj na celú obrazovku“ — ťukni na ňu. Nástroj celú
obrazovku len predstiera (rozmer displeja ostáva, aký si zadal pri `zaloz`), lebo skutočná celá
obrazovka v headless Chrome rozbije emuláciu telefónu. Ťahy sú v pruhu pokynu hore (hlavná
akcia žltá, ▾ vedľajšie), menu ☰ v pravom hornom rohu plste (Log, nápovedy, vzdať sa).

## Zápis nálezov

Ulož do `R/hrac<n>/naleze.md` (snímky už sú v `R/hrac<n>/snimky/`):

```markdown
# Playtest mobilu — <meno playtestera>, displej 762×340, <dátum>

## Celkový dojem
2–4 vety: ako sa na telefóne hrá, čo je najväčší problém.

## Nálezy
### 1. <krátky názov>
- **Miesto / fáza:** Pitka, dok dole vpravo (tlačidlo Skončiť Pitku)
- **Snímka:** snimky/041-pockaj.png (prípadne detail)
- **Čo je zle:** čo vidíš a prečo to vadí (konkrétne, s rozmermi z výpisu)
- **Závažnosť:** vysoká | stredná | nízka
- **Návrh:** ako to opraviť

## Čo funguje dobre
Krátko — čo nemeniť.
```

Závažnosť: **vysoká** = bráni hrať alebo vedie k omylu (nedá sa ťuknúť, text nečitateľný,
dôležité zakryté); **stredná** = hrať sa dá, ale pracne alebo nepekne; **nízka** = kozmetika.
Jeden problém = jeden nález (to isté na viacerých miestach spoj do jedného).

## Koniec

`$M R stav` ukáže súhrn (kolá, akcie, upozornenia, či je naleze.md). Prehliadače zastaví
`$M R ukonci` (server beží ďalej).
