# Identita kariet — zadanie na implementáciu (Michal 2026-11-03)

Michalov pokyn doslova: „Zatiaľ takto — celé to treba naimplementovať a nasadiť HNEĎ, ako sa bude dať.
Potom, ako sa to nasadí, rovno verziu vypáliť.“ (session naex-ce, 2026-11-03)

Mock: `docs/napady/identita-kariet.html`. Dáta: `design.mjs` (zdroj), `navrh-sada.json` (strany vo formáte
cards.json), kontrola `check.mjs`, generátor `build.mjs`, export `export.mjs`.

## 1. Akcie všetkých kariet (naex-admin, rozpracovaný stav tvorcu Vypálenej)

- Pre každú z 94 kariet v `navrh-sada.json` nastaviť `left` / `right`: `blocked` a `actions` presne podľa súboru.
  Názvy, tagy, ilustrácie a vzhľad ostávajú. Cirhóza a Absťák bez zmeny.
- `pevny_odpor` = slot, kam ide Odpor Občana (B+: 1, vzbúrenci Recidivista a Kočovník 2) — v tvorcovi ako
  obmedzenie slotu (`allowed`). Iné obmedzenia slotov nedávať, aby počet variantov sedel s mockom
  (Občan 4–8, Nástroj a Zviera 2–4; `check.mjs` ho ráta).
- **Starší majú 1 variant** — treba im zvoliť pevné rozloženie (admin podľa B+: zlá akcia a Odpor v slote 1,
  dobrá a Posilnenie v slote 2).
- Výnimky, ktoré návrh drží zámerne: Praudovravec 2 Odpory; Energeťák 3 akcie; Zrkadlo 2× Pakt;
  Nástroje Pasca a Hrable 2–3 Odpory.

## 2. Efekty (text v tvorcovi + engine, PRAVIDLA §16, testy, ťahák)

| Karta (id) | Nový efekt |
|---|---|
| Noviny (`noviny`) | Dedičstvo: Hádka: Ak vyhráš hádku, súper odhodí 1 náhodnú kartu z ruky. |
| Opatrovateľka (`opatrovatelka`) | Furt: Tvoji Pamätníci v jej okolí majú aktívne akcie posilnené. |
| Podvodník (`podvodnik`) | Konflikt: Súper ti dá 1 cigaretu. Ak žiadnu nemá, získa 1 zadĺženie. |
| Anonymný alkoholik (`anonymny_alkoholik`) | Furt: Akcie Poškodenie pečene tvojich kariet v jeho okolí sa rátajú ako Viera. |
| Šofér (`sofer`) | Bitka: Ak si v tomto kole nedal NA EX, udelíš súperovi 1 Pecku navyše a dostaneš 1 cigaretu. |
| Sypač (`kulturista`) | Podpora: Keď sa stretne s tvojím Chlapom, ten má do konca kola Rany ako Pecky. |
| Kôň (`kon`) | Furt: Nástroj vedľa Koňa s ním tvorí spoj. Roboty Koňa pália o 1 Dlh viac. |

- Kôň: Michal vybral „…a jeho Roboty pália o 1 Dlh viac“; „jeho“ = Koňa (Kôň má po novom Robotu) —
  znenie spresnené, význam ten istý.
- **Ostávajú dnešné efekty:** Hasič a Milujúca manželka (Michal sa nevyjadril — pripomenúť), Veštica (nechať).
- **Veštica — UI** (Michalova poznámka): „Upraviť UI preskúmania kariet — či už mojich alebo súpera. Taktiež
  upraviť vizuál, ktorú kartu kam dávam.“ Pri výmene kariet z doberacích balíkov musí byť jasné, ktorý balík
  je môj a ktorý súperov a kam ktorá karta odíde.

## 3. Riziká

- Testy jadra, výučba (`packages/core/data/vyucba/prva-hra.json`) a ťahák môžu stavať na konkrétnych
  akciách kariet — po novom cards.json ich prejsť.
- Bot (`bot.ts`) má heuristiky na niektoré karty (Šofér, Kôň…) — skontrolovať.
- Pasca so značkou `dorovnajSoSeedom` (najprv cards.json, potom značka).
- Power score zatiaľ len v mocku (odhad); do tvorcu nepatrí.

## 4. Poradie

admin (akcie + texty efektov do rozpracovaného stavu, `sada-do-repa.ts` → cards.json) → programátor
(efekty, Veštica UI, testy, PRAVIDLA §16, ťahák) → merge do master → `/naex-nasad zrejuca` → `/naex-vypalit`
(zverejnenie sady, Novinky).
