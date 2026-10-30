# Absťák → Chuť — zadanie pre Developera a Admina

Zdroj: interview Michala 2026-10-30 večer (session Brainstorming), návrh a rozhodnutia
v `docs/napady/abstak-3.html` (§ Rozhodnutia). Roadmapa #113. Implementuje sa na vetve
pravidiel v9 (`pravidla/vazen`) spolu s quick wins z ULTRA playtestu; potom playtest.

## Rozhodnuté (Michal)

1. **Chuť** — verejné počítadlo hráča, štart 0. Názov je Chuť (nie Smäd, nie Závislosť).
2. **Nerest = len konzumácia:** Vypiť v Zhromaždení **1**, **NA EX 2** (pri odkrytí / vypití
   v bitke — každé NA EX hráča, aj pri zrážke Výtržníka obaja za svoje), vyfajčená cigareta **1**
   za každú zaplatenú (druhé fajčenie 2 atď.). **Nie sú nerest:** doliatie, barter, šenok,
   Záverečná, cigarety za Kšefty lokalít (Zberný dvor, Sklad, Úrad…), Dedičstvo, Starosta.
3. **Koniec kola** (po bitke a návrate kariet, pred udržaným strachom; po poslednej bitke hry
   nie), pre každého hráča:
   - ak `neresti kola < Chuť` → karta **Absťák** do **odhadzovacieho balíčka** hráča,
     `abstakyZiskane += 1`, log: „Hráč 1 dostáva Absťák: Chuť 3, v kole vypil a vyfajčil 1.“
   - potom `Chuť = max(0, max(Chuť, neresti kola) − 1)`, log: „Chuť hráča 1: 3 → 2.“
   - `nerestiTotoKolo = 0`.
   Žiadne porovnanie so súperom (Krok so stolom zaniká), žiadne zbavovanie sa Absťáku.
4. **Karta Absťák** (tag Kliatba, všetky sloty blokované, bez akcií):
   - **nedá sa priznať** ani vyložiť do línie; **žiadne zapitie** (zatiaľ);
   - po bitke ide z **ruky do odhadzovacieho balíčka** (ako nepriznaná Cirhóza, §9.7);
   - **Vízia a Kar ju smú zahodiť z hry** ako Cirhózu; Hasič ju vytiahne a hráč ju vráti alebo
     si ju nechá; Anonymný alkoholik sa jej netýka;
   - **účinok v bitke:** −1 tuhé hráčovi za každú kartu Absťák **kdekoľvek v jeho balíčku**
     (ruka + doberací + odhadzovací); pri remíze v tuhom prehráva, kto ich má viac (ako dnes),
     potom Dlhy, inak sekera;
   - **Nervák zaniká:** žiadne Pohoršenie za Absťák;
   - **koniec hry:** Absťák nestojí nič.
5. **Mierka ostáva** — ekonomika (poldeci, cigarety, cena fajčenia) sa nemení.
6. **Výučba Prvá hra:** Chuť a Absťák sa v 1. časti **neuplatňujú** (prepínač partie), texty
   o Absťáku z 1. časti **vypadnú** (prva-hra.json 19 miest, napovedy.json nápoveda `abstak`);
   výučba Chuti patrí do 2. časti (zatiaľ neexistuje — položka do roadmapy, Vymyselník).
7. **Ilustrácia:** stará zo seedu `packages/server/seed/karty/abstak.jpg` (+ `@512`).
8. **Opatrovateľka v2** („latka Absťáku −2“, prijatá v revízii sady, v sade ešte nie je):
   znenie pre Chuť navrhne Admin pri zakladaní tej karty — nie súčasť tohto zadania.

## Admin (karty v tvorcovi) — pred Developerovým kopírovaním sady

- Nová karta `abstak` „Absťák“: vzor `admin-agent/abstak.json` (id, tag Kliatba, blokované sloty,
  kópie 10, mierky); ak médiá z JSON v lokálnej DB nie sú, `A nahraj seed/karty/abstak.jpg karta`
  a priradiť. Efekt: „Bitka: Každý Absťák v tvojom balíčku (ruka, doberací aj odhadzovací) ti
  uberie 1 tuhé; pri remíze v tuhom prehráva, kto ich má viac. Nedá sa priznať; po bitke ide
  z ruky do odhadzovacieho balíčka. Zahodí ju len Vízia alebo Kar.“
- Skontrolovať texty kariet, ktoré spomínajú nerest alebo Absťák (dnes len Krabička cigariet:
  „Nie je to nerest“ — ostáva pravdivé), a kľúčové slovo Nerest/Kliatba (`A slovo`).
- `A overit`, `A zverejni --potvrdene` — súhlas daný rozhodnutím Michala 2026-10-30
  (implementovať hneď). Pozor: lokálna sada v46 už nesie v9 (scorecard Neprajník „ROBOTA“),
  takže sa zverejňuje z v9 worktree.
- Po nasadení: novinka „Absťák je o tvojej chuti, nie o súperovi“ (Admin).

## Developer (kód, pravidlá, testy)

### Jadro `packages/core`
- `constants.ts`: `NEREST_NAEX: 2`, `CHUT_UBYTOK: 1` (s komentárom prečo — Michal 2026-10-30).
- `player.ts`: pole `chut: number` (štart 0); pole `abstaky` (počítadlo) zrušiť — počet Absťákov
  sa odvodzuje z kariet (`pocetAbstakov(h) = karty "abstak" v ruke + doberacom + odhadzovacom`),
  `abstakyZiskane` ostáva (štatistika, achievement `stat.abstakyZiskane`).
- `engine.ts`:
  - neresti: `cmdVypit` +1 (ostáva), `vypiNaex` +2 za NA EX, `cmdSmoke` +cena (ostáva);
    **odstrániť** z `cmdBarter`, `cmdRefill`, Zberný dvor / Sklad / Úrad (riadky ~3767–3788)
    a odkiaľkoľvek inde, kde sa platí (grep `nerestiTotoKolo`).
  - koniec kola (~5229): nahradiť Krok so stolom pravidlom 3; karta cez
    `novaInstancia(s, data, "abstak")` do `odhadzovaci`.
  - bitka: `abstaky` v `poskodenieBitky` a `battleOutcome` z `pocetAbstakov`; `verejneAbstaky`
    a `aktualneAbstaky` vracajú tento počet pre oboch hráčov (verejný údaj ako nepriznané
    Cirhózy — **do `viewFor()` len počet, nie poloha karty; test**).
  - Nervák preč (`nervak` ~4128, Pohoršenia z Absťákov, `zrazky` zdroj „abstak“ v rekapitulácii
    prerobiť na „−1 tuhé za Absťák“ bez Pohoršenia).
  - §9.7: Absťák v ruke po bitke → odhadzovací (ako Cirhóza ~5213).
  - priznanie: `abstak` odmietnuť (`KLIATBY` ~1392 a cmdPriznaj); Kar (~4340): zahodiť aj Absťák,
    ak je efekt Karu v jadre živý; Vízia zahodí ako každú kartu (overiť).
  - `SetupOptions.bezChuti?: boolean` (výučba): koniec kola Chuť ani Absťák nerieši.
  - kronika (`kronika.ts` KoloKroniky): doplniť `chut` a `abstaky` po kole (prehrávač, rekapitulácia).
- `zavislost.ts`: `StavZavislosti` → `{ chut, teraz (vrátane NA EX na stole ×2), abstaky, ubera,
  vyhlad: "ziska" | "nic", doBezpecia = max(0, chut − teraz), chutPo = max(0, max(chut, teraz) − 1) }`;
  `super`, `doZbavenia`, `pohorsenia` zrušiť.
- `bot.ts`: `hrozbaAbstaku` podľa Chuti (nie súpera), `chybajuceNeresti = max(0, chut − nerestiKola)`;
  kŕmiť Chuť v Pitke, keď je lacné (fajčenie, Vypiť), neflámovať NA EX bez zdrojov na ďalšie kolo
  (hodnota NA EX ráta budúcu Chuť +2); hodnota karty Absťák v balíčku (mŕtvy ťah + −1 tuhé);
  Vízia: Absťák zahodiť ako Cirhózu; `stropNeresti` odstrániť alebo prerobiť. Turnaj pred/po
  (rovnaké parametre), riadok „Ťahy bota podľa typu“ — nová logika musí byť vidno.
- `statistiky.ts`: `abstakyZiskane` z prírastku pri karte (ostáva); nič iné.
- Testy: §8 vznik (menej než Chuť → karta do odhadzovacieho; rovnosť nič; Chuť = max − 1; NA EX 2;
  platby nie sú nerest; po finále nič; `bezChuti`), §9.3 (−1 tuhé za kartu kdekoľvek v balíčku),
  §9.4 remíza, §9.7 návrat do odhadzovacieho, §11 (priznať nejde, Vízia a Kar zahodia, Hasič
  vráti), `viewFor` (počet áno, poloha nie), výučba bez Chuti. `tools/rozhodca/mapa.json` doplniť.

### Server a klient
- `packages/server`: výučba Prvá hra zakladá partiu s `bezChuti: true`.
- `apps/web` bar: namiesto Absťákov „Chuť 3 · dnes 1 · chýbajú 2“ (tooltip: čo je nerest, NA EX 2,
  čo sa stane na konci kola); počet Absťákov oboch hráčov vedľa nepriznaných Cirhóz; karta Absťák
  v ruke ako Kliatba bez akcií (nevyložiteľná, bez tlačidla priznať); rekapitulácia bitky
  „−1 tuhé za Absťák“ bez Pohoršenia; odhad bitky; log. Snímky pred/po (desktop aj mobil) ako dôkaz.
- Melichar / výučba: `prva-hra.json` a `napovedy.json` bez Absťáku (1. časť); nápovedu Chuti
  pripraviť až s 2. časťou.

### Dokumenty
- `docs/PRAVIDLA.md`: poznámka verzie (v9), §4 koniec kola, §8 „Nerest a Chuť“ (nové znenie),
  §9.2 (bez Pohoršenia z Absťákov), §9.3, §9.4, §9.7, §11 Kliatby a priznanie (Absťák je karta,
  nedá sa priznať, Vízia a Kar), §14 (koniec hry nič), §16 Výklad kariet (Absťák, Vízia, Kar,
  Hasič), §17 Slovník (Chuť, Nerest, Absťák). História do `docs/pravidla-historia.md`.
- `tools/playtest/tahak.md` (+ `packages/core/test/tahak.test.ts`), `tools/playtest/hrac.ts`
  výpis (Chuť, Absťáky v balíčku), `docs/playtesty/zmeny-pravidiel.html` (prečo: Michalov zámer
  — závislosť vlastného tela, karta špiní balíček; čo sledovať: Absťákov na hráča, NA EX
  a Cirhózy za partiu, suché kolá, rebrík).
- Po zverejnení sady Adminom: kópia sady do `packages/core/data/cards.json`,
  `tools/admin/do-seedu.ts`, nová značka v `Obsah.dorovnajSoSeedom` (docs/NASADENIE.md „Karty
  na produkciu“); značku meniť až po skopírovaní cards.json.

## Čo sledovať po nasadení (playtest)
- Absťákov na hráča a partiu (statický odhad bez prispôsobenia: 1,2; čakáme menej), kto ich dostáva
  (víťaz / porazený), NA EX za partiu (nesmie klesnúť o viac než pätinu), Cirhózy za partiu (dnes 6,8),
  suché kolá (dnes 25 %), či hráči rozumejú „Chuť“ z baru bez pravidiel.

## Otvorené (nerozhoduje sa teraz)
- Zapitie Absťáku (Michal: „zatiaľ žiadne“) — kandidát na ďalší návrh, ak sa balíčky zapchajú.
- Opatrovateľka v2 znenie (Admin pri zakladaní karty).
- 2 na 2: Chuť tímová, karta do tímového odhadzovacieho balíčka (rozhodnuté 2026-10-28: neresti
  a Absťák tímové) — až s #21–#31.
- Výučba 2. časť s Chuťou (Vymyselník).
