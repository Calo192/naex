---
name: naex-dizajn
description: Spustí UI a UX dizajnéra webu NA EX! naraz (agenti naex-ui a naex-ux) na stránku alebo časť stránky, ktorú používateľ pošle — UI navrhne vizuálne zlepšenia s ukážkami pred a po, UX zlepšenia použiteľnosti s tokmi a drôtenými modelmi, obaja viacero návrhov podľa súčasných best practices. Použi, keď používateľ povie /naex-dizajn, „navrhni redizajn", „vylepši vzhľad stránky", „UI/UX návrh", „ako spraviť stránku použiteľnejšou", „pozri sa na dizajn".
argument-hint: "<stránka alebo časť, napr. /spatna-vazba alebo „panel Pitky v hre“> [| čo ťa trápi]"
---

# Dizajn stránky NA EX! — UI a UX naraz

Spustíš **oboch** dizajnérov na ten istý cieľ a odovzdáš ich návrhy. Sám
nenavrhuješ ani nemeníš kód.

- `naex-ui` (`.claude/agents/naex-ui.md`) — vzhľad: hierarchia, typografia,
  rozostupy, farby a kontrast, komponenty a stavy, responzivita.
- `naex-ux` (`.claude/agents/naex-ux.md`) — použiteľnosť: úlohy a toky,
  heuristiky, kognitívna záťaž, spätná väzba, prístupnosť, mobil, mikrocopy.

Argumenty: `$ARGUMENTS` — cieľ (cesta na webe, názov stránky alebo časť,
napr. „panel Pitky“, „tabuľka v Tvorba → Hráči“), za `|` voliteľne, čo
používateľa trápi. Ak cieľ chýba, opýtaj sa, ktorú stránku alebo časť.

1. **Cieľ.** Prelož ho na cestu webu (`/`, `pravidla`, `karty`, `hra`,
   `rebricek`, `spatna-vazba`, `profil`, `admin/…`) a ak je to časť stránky,
   nájdi jej súbor v `apps/web/src/`. Zvoľ `id` = krátky slug cieľa + dátum a
   čas (`spatna-vazba-20261021-1030`) — obaja dostanú to isté.
2. **Web.** Over `node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny`;
   ak nebeží, spusti `npm run dev` na pozadí a over znova.
3. **Herný stôl.** Ak cieľ je partia (`/hra` alebo jej časť), založ partiu,
   na ktorej sa dá fotiť:
   `node --experimental-strip-types --no-warnings tools/playtest/zaloz.ts "Dizajn 1" "Dizajn 2" kratka`
   a obom daj reláciu `R`. Ak potrebujú inú fázu než začiatok, môžu ťahať
   cez `tools/playtest/hrac.ts R <1|2> tah …` — povedz im to. Po skončení
   oboch partiu zastav (`tools/playtest/ukonci.ts R`).
4. **Spusti oboch naraz** — v jednej správe dve volania Agent na pozadí:
   - `naex-ui`: „Cieľ: … (cesta, súbor). Id: <id>. Michala trápi: … .
     (Relácia: R.) Navrhni vizuálne zlepšenia.“
   - `naex-ux`: to isté, „Navrhni zlepšenia použiteľnosti.“
   Používateľovi povedz, že obaja bežia a na čom.
5. **Keď skončia obaja**, odovzdaj:
   - odkazy `http://localhost:8787/playtest/reporty/dizajn-<id>-ui.html` a
     `…-ux.html` (lokálne súbory v `docs/playtesty/` otvor v prehliadači),
   - spoločný prehľad: najväčšie problémy (kde sa UI a UX zhodli, zvýrazni),
     návrhy oboch v jednej tabuľke (UI / UX, názov, čo rieši, náročnosť),
   - čo spolu súvisí alebo si odporuje (napr. UI zmenší prvok, ktorý UX chce
     výraznejší) a tvoje odporúčané poradie,
   - otázky na Michala.
   Ponúkni, ktoré návrhy implementovať. Implementácia je samostatná úloha.
