# Otázky prekladateľa PL — vlna 3e (2026-11-11)

Preklad zvyšku `apps/web/src/i18n/pl.json` (781 kľúčov: stôl, Detail partie, Novinky, Vývoj, Spätná väzba, vzory `motor.*`, `plocha.volbaPredavacka`) a dlhých textov `i18n/<oblasť>/pl.json` — pravidla (411 polí), pojmy (204 vrátane `tvary`), vyucba (312, stav master 1a2f30a7), napovedy (24), achievementy (153). Pojmy podľa glosára; nové pojmy a pochybnosti nižšie.

## Chyby či rozpory v zdroji (slovenčina)

1. **`pravidla` › `kliatby.p6`** — „za Dlh, ktorý nemá čo spáliť, dostaneš 1 špak“. Podľa pravidiel (a `starsi.p26`: „spália priznaný Dlh, inak dajú špak“) ide o **Robotu**, ktorá nemá čo spáliť. V PL je preložený zamýšľaný význam: *za Robotę, która nie ma czego spalić, dostajesz 1 peta*. Opraviť slovenčinu?
2. **`napovedy` › `presvedcenie`** — „Reči na červenú a päť navrch – a je presvedčený… Tvoje reči pri ňom zhoria, priazeň ti ostane.“ Pravidlá (`ciel-a-senok.p18`, pojem `presvedcenie`) hovoria: **3 body** hádky, reči na **celom** teplomere a **reči, strach aj priazeň ostávajú**. PL prekladá nápovedu verne (aj s rozporom); treba opraviť slovenský zdroj v `packages/core/data/vyucba/napovedy.json` a preklad potom upraviť.
3. **Výučba „tvoja strana“** — `vyucba` › `k-ciel` („aby Pecka bola vľavo, na tvojej strane“) a `k-zh-bot1` („línia – tvoja vľavo, jeho vpravo“) sú v rozpore so zásadou „moja/súperova strana línie neexistuje“ (Michal 2026-11-08). PL je verné originálu; ak sa výučba pri v11.22 prepisuje, zvážiť aj toto.

## Nové pojmy (nie sú v glosári)

4. **balíček dedinčanov** = *talia mieszkańców*; **balíček nástrojov** = *talia narzędzi* (glosár má len „Narzędzia (talia)“). Zamietnuté: *talia wieśniaków* (hanlivé), *talia obywateli* (Občan je len jeden z tagov balíčka).
5. **Dobratie** (pojem, nová runda: 2 karty) = *Dobieranie*.
6. **Hlásnik obce** (rám Noviniek) = *Szczekaczka gminna* — dedinský amplión, Poliak ho pozná presne ako Slovák hlásnik; podtitul *co się zmieniło w knajpie*. Zamietnuté: *Ogłoszenia gminne* (suché), *Herold* (bez dediny).
7. **Päta, Lakeť, Otočka** (režim, `pata.*`): **Štít** = *Tarcza*, **Jed** = *Jad* (krátke, zmestí sa do štítku; *Trucizna* o 167 % dlhšia), **rad starších** = *szereg starszych*, **Do radu!** (Vychovávateľka) = *Do szeregu!* (to isté školské zvolanie), **Hadovito** (draft) = *Wężykiem*, **Dať vyžrať** = *Dać wychlać*, **padol / podraziť** = *padł / podciąć* (ako `lobby.pataPopis`).
8. **Achievement „Otočka“** (výhra ako útočník) = *Nawrotka* — iné slovo než režim *Z bańki, z łokcia, z kopa*, aby sa nemýlili.
9. **Mená achievementov s miestnou slovnou hračkou**: *Darina wypiła, co nawarzyła* („Darina si to vypila“ — PL príslovie o pive, ktoré si navarila), *Rudo ograny do ostatniej nitki*, *Ciocia Gizka bez plotek* („bez reči“ = bez slova aj bez herných rečí — slovenská dvojznačnosť zachovaná), *Palacz od kołyski* (Celoživotný fajčiar), *Samobój* (Vlastný gól), *Strach na wróble* (Strašiak).
10. **Farebné schémy** — *Modrotlač* = *Modrodruk* (poľský názov tej istej ľudovej techniky), *Mlynský náhon* = *Młynówka*.

## Pochybnosti

11. **Pečiatky momentov** (ZVRAT!, ZÁVEREČNÁ!, BOMBA ×4) sa v hre zatiaľ neprekladajú (`packages/core/src/momenty.ts`), preto achievementy `posledne-slovo` a `eso-v-rukave` píšu *(pieczątka ZVRAT!)* / *(pieczątka ZÁVEREČNÁ!)* po slovensky — to, čo Poliak na stole uvidí. Keď sa pečiatky preložia, treba popisy zosúladiť.
12. **Ženské a mužské tvary kariet vo výučbe** — *Traktoristka* (karta Traktorista) = *Traktorzystka*; *Čierna mačka* = *Czarny kot* (karta má v PL mužský rod, Melichar preto „Kot połączył…“).
13. **Popisy achievementov s `{prah}`** — kde by číslo menilo pád počítaného slova (2–4 vs. 5+), je veta otočená na „X: co najmniej {prah}“ (napr. *Aktywne Sierpowe w jednej bójce: co najmniej {prah}.*), aby sedela pri každom prahu.
14. **`motor.pasujeTim`** — „pasuje do Pitky“ preložené ako *pasuje w Popijawie* (pasuje až do Pitky = v tomto Zhromaždení už nevykladá). Ak „do Pitky“ znamená niečo iné, opraviť.
15. **`motor.nevzateKarty`** — sk nemá tvary, preto PL bez počítaného slova: *Niewzięte karty z oferty idą pod spód talii: {n}.*
