# Brief: NA EX! ako webová hra pre dvoch cez internet

Zadanie pre Claude Code. Čítaj spolu s `docs/PRAVIDLA.md` — tam je špecifikácia
pravidiel, tu je **čo postaviť, v akom poradí a kedy je to hotové**.

---

## Cieľ

**NA EX! hrateľná v prehliadači, dvaja hráči na dvoch počítačoch, cez internet.**

- Beží všade, kde je prehliadač — Windows, macOS, Linux, telefón, tablet.
- Žiadna inštalácia. Hra je **odkaz**: pošleš kód miestnosti a hráte.
- Hra je podľa pravidiel **striktne pre dvoch hráčov**. „Multiplayer" tu
  znamená dvaja ľudia na dvoch zariadeniach, nie viac hráčov.

Lokálny hotseat (obaja pri jednom počítači) **nie je cieľ**, ale vypadne
zadarmo — je to ten istý motor s oboma pohľadmi na jednej obrazovke. Hodí sa
na ladenie.

---

## Zásadné rozhodnutie, na ktorom stojí všetko ostatné

Hra má **skrytú informáciu**: ruku súpera a poradie doberacieho balíčka.
Preto **musí existovať autoritatívny server** a platí:

> **Server nikdy nepošle klientovi nič, čo hráč nemá vidieť.**

Nie „pošle to a klient to skryje". Skryť kartu v rozhraní je bezpečnostne
bezcenné — stačí otvoriť konzolu prehliadača. Filtrovanie musí byť
v `viewFor()` na serveri a musí byť otestované.

Z toho plynú štyri pravidlá, ktoré nie sú na diskusiu:

**1. `packages/core` neobsahuje žiadne I/O.**
Žiadne DOM, `fetch`, `WebSocket`, `Date.now()`, `Math.random()`, `console`.
Iba čisté funkcie nad dátami. Ten istý kód beží v prehliadači aj na serveri.

**2. Tok je jednosmerný.**

```
klient ──Command──► server ──apply()──► GameState (celý, tajný)
                       │
                       ├──► Event[]  (čo sa stalo, bez tajomstiev)
                       └──► viewFor(state, hráč) ──► ClientState ──► klient
```

**3. Klient posiela zámery, nikdy výsledky.**
`{type:"place", uid:34, target:"own"}` — áno.
`{type:"damageDealt", amount:7}` — nikdy. Server počíta, klient kreslí.

**4. Náhoda je deterministická.**
Jeden seedovaný generátor v `GameState`. Rovnaké semienko + rovnaké príkazy
= rovnaká hra. Bez toho sa nedá reprodukovať bug ani neskôr spraviť replay.

**5. Dáta sú dáta.** Karty, starší a bodové hodnoty žijú v
`packages/core/data/*.json`. Michal ich ladí podľa fyzických komponentov
bez toho, aby otvoril `.ts` súbor.

---

## Čo je už pripravené

Kostra je hotová a overená — `npm install && npm run typecheck && npm run build`
prejde a klient sa zbuilduje (~61 kB gzip vrátane Reactu).

```
packages/core/     jadro pravidiel — čistý TS, bez I/O
  data/cards.json    60 kariet: tagy, efekt, spúšťače, blokované pozície,
                     multimnožina akcií pre obe strany, počet permutácií
  data/elders.json   8 starších (len id)
  data/scorecards.json  priazeň + bočné bodovacie pozície a body za podmienky
packages/server/   autoritatívny server (Node + ws)
apps/web/          klient (React + Vite)
docs/PRAVIDLA.md   destilovaná špecifikácia pravidiel v11
tools/parse_cards.py  regenerácia cards.json z exportu KartyAI
```

`cards.json` je overený proti exportu — počty permutácií sedia pre všetkých 50.

### Príkazy

```bash
npm install
npm run dev          # server na :8787 + klient na :5173 (proxy /ws)
npm test             # vitest
npm run typecheck    # tsc --build
npm run build
```

---

## Míľniky

Rob ich v poradí. Každý má **akceptačné kritérium** — kým neplatí, ďalej nechoď.
Po každom míľniku commit.

### M0 — Overenie kostry

Spusti `npm install`, `npm run typecheck`, `npm test`, `npm run dev`.
Nahraď placeholder v `packages/core/src/index.ts`.

**Hotovo, keď:** vitest beží (aj s nula testami) a `npm run dev` otvorí klienta.

---

### M1 — Dátová vrstva

Typy (`Action`, `Tag`, `Trigger`, `Phase`), načítanie `cards.json`,
definícia karty, **generovanie variantov**, konkrétna inštancia karty.

Ťažisko: z multimnožiny akcií + blokovaných pozícií vyrob všetky **rôzne**
rozloženia po voľných slotoch, deterministicky a v stabilnom poradí
(permutácie multimnožiny — duplicitné prvky sa nesmú počítať viackrát).

**Hotovo, keď:**
- načíta sa 50 kariet, 8 starších, 7 lokalít, 8 nástrojov,
- pre **všetkých 50** kariet sedí `rozloženia_vľavo × rozloženia_vpravo`
  s poľom `permutations.total` z JSON-u,
- blokovaná pozícia je prázdna v každom rozložení,
- `ihrisko` má vpravo **1** rozloženie (Poldeci ×3 v 3 slotoch).

---

### M2 — Partia a aktivácia akcií ★ najdôležitejší míľnik

Línia kariet, spoje, otočenie o 180°, Odpor / Vzbura / Posilnenie / NA EX.
Výstup: **súčty podľa akcie** + informácia, **ktoré sloty boli aktívne**
(klient to potrebuje na zvýraznenie).

Sem patrí väčšina chýb, ktoré v tejto hre vzniknú. Testuj na **syntetických
kartách** s presne určeným rozložením, nie na skutočných — chceš
deterministický vstup.

**Hotovo, keď prechádzajú aspoň tieto prípady:**

| Test | Očakávanie |
|---|---|
| Rana@right[1] proti Pecka@left[1] | obe aktívne, tuhé 3 |
| akcie na rôznych indexoch | nič sa neaktivuje |
| akcia proti prázdnemu slotu | neaktívna |
| jedna karta v línii | žiadny spoj |
| otočená karta: akcia z left[0] | je na right[3] |
| otočená karta sa páruje na obrátenom indexe | aktivuje sa |
| Odpor + Petelica | tuhé 0 |
| Odpor + Odpor | Vzbura, obe karty aktivujú neprepojené akcie |
| Posilnenie + Pecka | Pecka ×2 |
| Posilnenie + Hazard | Hazard ×2 (aj nepriaznivé sa zdvojnásobí) |
| Posilnenie + Odpor | neprepojené akcie aktivuje **iba** karta s Odporom |
| NA EX na karte | zruší jej aktívne, zdvojnásobí jej neaktívne akcie |
| NA EX | akcie na susednej karte neovplyvní |

---

### M3 — Stav hráča a hry

Balíčky, poldeci, cigarety, pečeň, závislosť, odvodené hodnoty
(priazne, prahy, limit vykladania).

**Hotovo, keď:**
- 2 plné poldeci → limit 3,
- po vypití jedného → limit 2,
- poldeci položený cez NA EX sa ráta **majiteľovi poldeci**, aj keď karta
  leží v súperovej partii,
- priznané karty limit neovplyvňujú.

---

### M4 — Vyhodnotenie bitky

Presné poradie z `PRAVIDLA.md §8`. Čisté funkcie
(Exekútor / poškodenie / výsledok) oddelené od krokov, ktoré vyžadujú
rozhodnutie hráča (Pohoršenie, Liečba/Pohreb) — tie motor len **pripraví**.

**Hotovo, keď:**
- Viera znižuje súperovo tuhé poškodenie o `1 + priazeň Veriaceho`,
- Viera a Povera sa vyrušia 1:1 a zrušená Povera neudelí nič,
- mäkké poškodenie je zastropené súperovým **priznaným** dlhom,
- pri remíze v tuhom poškodení o lokalitu rozhodne **celkové** a potom **obranca**, o staršieho nevyhrá nikto (Michal 2026-10-19; predtým útočník),
- pri remíze v celkovom poškodení **nikto nezíska prebytok**.

---

### M5 — Starší, ukazovatele, bodovanie

**Hotovo, keď:**
- marker v strede → priazeň nemá nikto,
- posun k hráčovi 1 → priazeň má hráč 1, ale starší sa bojí hráča 0,
- z pozície 6 sa v jednom kole nedá dôjsť ďalej než na 7,
- z pozície 7 **na začiatku kola** sa dá na 8 → starší sa prebudí pre hráča,
  ktorý tlačil,
- z krajnej pozície sa marker bežným posunom nepohne,
- Pohoršenie nikdy nedostane marker na krajnú pozíciu.

---

### M6 — Motor kola a filtrovaný pohľad

Stavový automat: Voľba cieľa → Draft → (Zhromaždenie → Pitka) × N → Bitka →
ďalšie kolo.

```ts
apply(state: GameState, cmd: Command): { state: GameState; events: Event[] }
viewFor(state: GameState, player: PlayerId): ClientState
```

Minimálna sada príkazov: `chooseLocation`, `chooseElder`, `draft`, `place`,
`pass`, `naex`, `skipNaex`, `barter`, `refillPoldeci`.

`viewFor` je **bezpečnostná hranica** — tu sa odstráni súperova ruka
a poradie doberacieho balíčka.

**Hotovo, keď:**
- smoke test odohrá celú hru **náhodnými legálnymi ťahmi** až do niektorej
  z podmienok konca, bez zacyklenia a bez chyby,
- **test filtrovania:** `JSON.stringify(viewFor(state, 0))` neobsahuje ani
  jedno `uid` karty zo súperovej ruky ani z doberacieho balíčka. Tento test
  napíš skôr, než napíšeš server.

---

### M7 — Server

Node + `ws`. Miestnosti s kódom, dvaja hráči, autoritatívny motor.

- klient sa pripojí, vytvorí alebo sa pridá do miestnosti podľa kódu,
- server drží `GameState`, prijíma `Command`, overuje **kto** ho poslal
  (hráč nesmie hrať za súpera ani mimo poradia),
- po každom príkaze pošle každému hráčovi jeho `viewFor` + `Event[]`,
- stav žije v pamäti; databáza pre v1 netreba.

**Hotovo, keď:** dva prehliadače na tom istom stroji odohrajú celú partiu
a ani jeden nedostane dáta toho druhého (over v záložke Network).

---

### M8 — Klient

Až teraz. Pravidlá musia byť dovtedy hotové a otestované.

Rozloženie: partia súpera / lokalita / vlastná partia, ruka dole,
ukazovatele starších a šenok bokom, stav hráčov a log.

Dve veci rozhodujú o hrateľnosti:

1. **Živé zvýraznenie aktívnych slotov už počas Zhromaždenia.** Hra stojí na
   susedstve — hráč musí okamžite vidieť, čo mu na spoji chytilo. Vyhodnotenie
   partie je čistá funkcia z `@naex/core`, takže ju klient smie volať na
   svojom pohľade pri každom prekreslení.
2. **Karty sú DOM prvky, nie plátno.** Efekty kariet sú dlhé texty —
   nechaj ich sádzať prehliadač. Pohyb kariet rob cez CSS `transform`.

**Hotovo, keď:** dá sa odohrať celé kolo myšou, od voľby lokality po výsledok
bitky, na dvoch zariadeniach.

---

### M9 — Odolnosť

- **Reconnect**: hráč obnoví stránku a vráti sa do rozohratej partie
  (kód miestnosti + token hráča v `localStorage`).
- Ukáž, keď súper stratil spojenie.
- Ošetri druhý tab, plnú miestnosť, neexistujúci kód.

**Hotovo, keď:** obnovenie stránky uprostred kola hru nerozbije.

---

### M10 — Efekty kariet

50 efektov, každý iný. **Nerob DSL** — pri 50 kartách sa neoplatí a text
efektov je príliš rôznorodý. Jedna malá funkcia na kartu, register podľa `id`.

Postav to tak, aby **neimplementovaný efekt nebol blokujúci**: karty bez
implementácie nech bežia v režime MANUAL — hra ich v správnej fáze vypíše do
logu a hráči ich vyhodnotia sami. Hrať sa dá od prvého dňa a efekty sa
dopĺňajú po jednom.

Implementuj najprv **3–4 vzorové** pre rôzne typy spúšťačov (napr. `ihrisko`
= Furt/modifikátor prahu, `cigorky` = Dedičstvo, `cirhoza` = Bitka,
`cierna_macka` = Furt/negácia súperovej akcie), potom zvyšok.

**Hotovo, keď:** register pokrýva všetkých 50 id a nenaprogramované sa
spoľahlivo pripomínajú v logu.

---

## Nasadenie

Jeden Node proces obsluhuje **aj statického klienta, aj WebSocket** — jeden
pôvod, jeden deploy, žiadne CORS. Stačí najmenší VPS (~5 €/mesiac) alebo
Fly.io / Railway / Render.

Nasadzuj až po M8. Do vtedy stačí `npm run dev`.

---

## Otvorené otázky — spýtaj sa Michala, nehádaj potichu

Pravidlá v11 tieto veci nehovoria jednoznačne. Ak sa rozhodneš sám, **napíš to
do commitu a do README**, nech sa to dá ľahko prepnúť. Všetky doterajšie otázky
uzavrel Michal 2026-10-22 (roadmapa #11); odpovede sú v PRAVIDLA.md.

1. ~~**Posilnenie proti Posilneniu** na spoji — nič, alebo niečo?~~ Nič sa nedeje (§4).
2. ~~**NA EX** — je „ruší aktívne a zdvojnásobuje neaktívne" naozaj **tá istá**
   operácia na vlastnej aj súperovej karte?~~ Vyriešené (Michal 2026-10-18):
   áno, NA EX smie na vlastného aj súperovho Občana či Starešinu a operácia
   je tá istá (PRAVIDLA §5).
3. ~~**Podpora** — počíta sa lokalita ako karta v okolí?~~ Áno (§4).
4. ~~**Vzbura na lokalite** — aktivuje obe strany lokality, alebo len tú, ktorá
   patrí do danej partie?~~ Len hranu lokality pri tom kraji (§4).
5. ~~**Cirhóza v partii** — „Obdržíš od súpera dodatočnú ranu" znamená +1 tuhé
   pre súpera za každú Cirhózu v mojej línii?~~ Vyriešené (Michal 2026-10-20):
   kliatba do línie nepatrí; každá **priznaná** Cirhóza dá súperovi v každej
   bitke +1 tuhé (PRAVIDLA §8).
6. ~~**Absťák** — čo presne sa počíta ako „nerest"?~~ Pitie aj fajčenie, platby
   za šenok, Dedičstvo a Starostu nie (§12).
7. ~~**Štartovacia ruka** — ako sa 10 kariet delí medzi 4 typy štartoviek?~~
   Vyriešené (Michal 2026-10-18): obaja 4 Pijan, 2 Miňištrant, 2 Milujúca
   manželka, 2 Dievčina na vydaj; tieto druhy nie sú v spoločnom balíčku ani v šenku.
8. ~~**Lokality** — v `cards.json` je len **7**.~~ Vyriešené (Michal 2026-10-20):
   sada má 14 lokalít; krátka 5, stredná 7, dlhá 11 bitiek, dlhá hra sa dá zvoliť.
10. ~~**Kočovník** (pravidlá v3) — pôvodný efekt stratil zmysel.~~ Vyriešené
   (Michal 2026-10-19): Kočovník míňa limit ako každá karta; efekt „Furt: Dlh
   a Poškodenie pečene z jeho akcií dostáva hráč, na ktorého strane leží.“
11. **Svokra** (pravidlá v3) — NA EX smie len na vlastné karty, pôvodný efekt
   („vráť súperovi jedno NA EX z tvojej karty“) stratil zmysel. **Nový efekt
   (rozhodnutie Michala 2026-10-11):** „Nástup: Súper v najbližšej Pitke nesmie
   dať NA EX.“ **Nahradené 2026-10-18** (NA EX opäť aj na súperove karty,
   ochranu nesie nová karta Anonymný alkoholik): „Furt: Keď súper dá NA EX,
   ukradni mu 1 cigaretu.“ — od 2026-10-19 **2 cigarety**, dve Svokry 4.
   Implementované a zverejnené (sada v6).
9. ~~**Šenok** — čo sa stane, keď sa minie spoločný doberací balíček?~~ Šenok sa
   zmenšuje až na nulu, hra beží ďalej bez trestu (§7).

---

## Neznáme hodnoty (nie sú v pravidlách, sú na komponentoch)

Všetky uzavrel Michal 2026-10-22 (roadmapa #11). Nové neznáme hodnoty daj ako
**konštanty na jednom mieste** s komentárom `TODO` a spýtaj sa.

- ~~`data/elders.json` — ktorý starší dáva ktorú **priazeň** a **bočné
  bodovacie pozície**.~~ Vyriešené: priazeň aj bodovacie podmienky nesie
  **scorecard**, ktorý starší dostane pri príprave hry náhodne
  (`data/scorecards.json`, prepísané z KartyAI 2026-07-13; §9, §10).
- ~~Body za **ovládnutú lokalitu**, za **získaného staršieho**, za **cigaretu**,
  pokuta za **nepriznanú cirhózu**.~~ Finálne: lokalita 2, starší 2, cigarety
  1 za trojicu, Cirhóza −2, Dlh −1 (`data/scorecards.json`).
- ~~Počet kópií kariet v spoločnom balíčku.~~ 2 kópie (`constants.ts`).

---

## Konvencie

- **Doménové pojmy po slovensky** — `Partia`, `poldeci`, `zhromazdenie`,
  `naex`, `staresina`, `priazen`. Nesnaž sa ich prekladať; `Assembly` ani
  `DrinkingPhase` Michalovi nič nepovedia a v pravidlách to tak nie je.
- Programátorské názvy (`apply`, `resolve`, `state`) anglicky.
- Komentáre po slovensky, a len tam, kde vysvetľujú **prečo**.
- TypeScript v `strict` režime, žiadne `any`. Stav je **nemenný** —
  `apply` vracia nový stav, nemutuje starý.
- Bez ďalších závislostí. Čo treba, je už v `package.json`.

---

## Čo NErobiť

- Nerob klienta skôr než M8.
- Neposielaj klientovi celý stav „a nech si to skryje".
- Nerob AI protihráča.
- Nerob DSL na efekty.
- Nepridávaj databázu, ORM, Redux, state-management knižnicu ani UI kit.
- Nevymýšľaj si chýbajúce herné hodnoty potichu — daj ich do `data/` s `TODO`.

---

## Definícia hotového

- `npm run typecheck` a `npm test` končia s kódom 0.
- Test filtrovania (M6) dokazuje, že súperova ruka sa ku klientovi nedostane.
- Dvaja ľudia na dvoch počítačoch si vedia odohrať celú partiu cez internet.
- `README.md` hovorí, čo je hotové, čo beží v režime MANUAL a ktoré hodnoty
  ešte treba doladiť podľa komponentov.
