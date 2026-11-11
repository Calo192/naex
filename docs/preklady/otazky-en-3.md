# Otázky EN — vlna 3e (2026-11-11)

Preklad prázdnych kľúčov `apps/web/src/i18n/en.json` (781: stôl, Detail partie, Novinky, Vývoj, Spätná väzba,
vzory `motor.*`, Predavačka v12) a oblastí `pravidla`, `pojmy`, `vyucba`, `napovedy`, `achievementy`.
Glosár sa nemenil; pochybnosti a nové pojmy sú tu.

## Zdroj (sk) a pravidlá hry

1. **„Moja / súperova strana“ vo výučbe** (Michal 2026-11-08: strana línie neexistuje) — slovenský zdroj ju ešte má:
   `vyucba` `k-ciel.melichar` („aby Pecka bola vľavo, na tvojej strane“), `k-zh-bot1.melichar` („línia – tvoja vľavo,
   jeho vpravo“), `i-prevaha-tvoja` / `k-hotovo3-bot` („akcie tvojej hrany“), `q-superova.vysvetlenie.2`
   („Strana nie je partia“). EN to prekladá verne (*on your side*, *yours on the left, his on the right*, *your edge*).
   Keď sa slovenčina opraví (napr. „vľavo, k tebe“), dorovnaj ukáže preklad ako zastaraný.
2. **`vyucba` `k-zh-bot1`: „Polovník“** — preklep za Poľovník? Preložené ako *Hunter* (karta Poľovník).
3. **`motor.vykladaNaKoniec`, `motor.odpovedaNaex`, `motor.zaverecnaLicomDole`: parameter `{kraj}`** dosadzuje jadro
   po slovensky (`menoKraja` → „pri výčape“, „vľavo od lokality (pohľad hráča 1)“). V angličtine teda vyjde
   *„… at the end of the line pri výčape.“* Možnosti: (a) klient preloží aj mená krajov (vzory `kraj.*` z glosára:
   *by the tap / by the door*…), (b) jadro pošle v logu id lokality a stranu, (c) nechať. Odporúčam (a).

## Pojmy mimo glosára (navrhujem doplniť)

4. **Pečiatky momentov** (`packages/core/src/momenty.ts`) ešte nie sú preložené; v achievementoch som použil
   *TURNAROUND!* (ZVRAT!), *LAST ORDERS!* (ZÁVEREČNÁ!), *BOMB ×4* (BOMBA ×4), v Pravidlách *CAPTURE* / *PERSUADE*
   (glosár). Keď sa budú pečiatky prekladať, nech sú rovnaké.
5. **Balíček dedinčanov** (`pojmy.obcania`) = *villagers deck*; **balíček nástrojov** = *Tools deck*. Glosár má len
   *Citizens* / *Tools (deck)* — „dedinčania“ v Pravidlách nie sú tag Občan (patria tam aj Zvieratá a Starešinovia),
   preto *villagers*, nie *Citizens*.
6. **Dobratie** = *Drawing* (pojem), sloveso *draw*. **Liga** v pojmoch = *Division*. **Koniec línie** = *End of the line*.
7. **Režim Päta, Lakeť, Otočka** (`pata.*`): *Štít* = *Shield*, *Jed* = *Poison*, *padol* = *down*, *Má dosť* = *Had enough*,
   *podraziť* = *trip up* (podľa `lobby.pataPopis`), *Hadovito* = *Snake draft*, *Dať vyžrať* = *Pour it down 'em*,
   *Do radu!* = *Fall in!* (Vychovávateľka).
8. **Krčmový účet** (`krcmovyUcet.*`, bodovanie partií do v5) = *Bill*; súboje = *duels*; *ks* = *pcs*.
9. **Hlásnik obce** (Novinky) = *The Village Crier*, podtitul *what's changed down the pub*.
10. **Farebné schémy** (`schema.*`) — preložené ako názvy farieb a nálad; *Slivovica* = *Plum Brandy*
    (nie *Slivovitz* — Brit ho nepozná), *Modrotlač* = *Indigo Print*, *Káva s mliekom* = *White Coffee*.

## Výučba a ovládanie

11. **Tlačidlá vo vetách Melichara** — „končím (K)“ v Pitke je v EN rozhraní tlačidlo *End the Booze-up*
    (`plocha.skoncitPitku`), tak ho Melichar aj volá: *Click End the Booze-up (K)*. „už neťahám (P)“ = *stop taking (P)*
    (`plocha.uzNetaham`). Písmená klávesov K / P ostávajú (skratky sú viazané na tieto klávesy); ak sa skratky
    budú lokalizovať, treba upraviť aj výučbu.
12. **„Meliš… EH! Majster Melichar“** (`i-vitaj`) — preložené *I'm Meliš… ER! Master Melichar.* Prerieknutie
    ostáva po slovensky (narážka na skutočné meno hlasu); ak ho anglický hráč nemá pochopiť, dá sa vynechať.
13. **„Len.“** (`napovedy` `vydesenie.melichar.moje`) — pochopené ako suché „A je to.“ → *Simple as that.*
14. **Achievementy s narážkou** — *Liver, Medium Rare* (Ružová pečienka), *Hammered* (Na hlavu: porazený aj ožratý),
    *Gutter Rat* (Stokár, väzba na *Gutter barter*), *Fear and Loathing* (Hrôza a des), *Winner Buys the Round*
    (Kto vyhráva, platí), *Rudo Fleeced* (Rudo obratý do nitky).
