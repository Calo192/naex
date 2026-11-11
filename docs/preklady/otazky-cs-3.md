# Otázky prekladateľa — CS, vlna 3e (2026-11-11)

Preklad `apps/web/src/i18n/cs.json` (stôl, Detail partie, Novinky, Vývoj, Spätná väzba, `motor.*`, Predavačka v11.22)
a dlhých textov `i18n/{pravidla,pojmy,vyucba,napovedy,achievementy}/cs.json`. Pojmy podľa `docs/preklady/glosar.json`.

1. **Pečiatky momentov v achievementoch** (`achievementy/posledne-slovo`, `eso-v-rukave`) — popis odkazuje na pečiatku
   („pečiatka ZVRAT!“, „ZÁVEREČNÁ!“). Pečiatky momentov (`packages/core/src/momenty.ts`) sa zatiaľ neprekladajú, hráč
   vidí slovenský nápis. Preto v texte ostal nápis z obrazovky: „razítko ZVRAT!“ (zhodné s češtinou), „razítko
   ZÁVEREČNÁ!“. Keď sa pečiatky preložia, treba „ZAVÍRAČKA!“. Možnosti: *nechať podľa obrazovky* / *hneď ZAVÍRAČKA!*.
2. **„Len.“** (`napovedy/vydesenie`, `melichar.moje`: „…a vyhral si hneď. Len.“) — význam nie je istý (ironické
   „len tak“? „len hovorím“? useknuté?). Preložené **„Jen tak.“** (= „len tak, mimochodom“). Možnosti: *Jen tak.* /
   *Jen říkám.* / *Nic víc.*
3. **Hlásnik obce** (`novinky.hlasnik`) → **„Obecní zpravodaj“** — český dedinský spravodaj, sedí k „vydaniam“ a
   „správam“. Alternatíva *Obecní rozhlas* (amplión na stĺpe, silnejšia príchuť, ale nesedí k „vydaniu“).
4. **Päta, Lakeť, Otočka** (`pata.*`): „Dať vyžrať“ → **„Dát vyžrat“** (hovorové, rovnako hrubé); „Hadovito“ (hadový
   draft) → **„Hadem“**; „padol“ → „padl“; „Má dosť: …“ → „Má dost: …“ (česky aj „je nalitý“). Rad starších = „řada“.
5. **Stokár** (achievement `stokar`) → **„Socka“** — podľa glosára (Stokársky barter = Socký barter); „socka“ je
   v češtine rovnako pohŕdavé. Popis prestavaný na „Panáky koupené sockým barterem: celkem {prah}“, aby pri prahu 1
   nevyšiel zlý pád („1 panáků“). Podobne `petelica-z-neba` a `do-dna` (prahy 2–4) majú tvar pre 2–4.
6. **Pojem „Dobratie“** (`pojmy/dobratie`) v glosári nie je — preložené **„Dobírání“**. Navrhujem doplniť do glosára.
7. **Traktoristka** (výučba, `k-kupa-bot`, `k-zh-bot2`…) — v preklade kariet je „Traktorista“. Výučba píše ženský
   variant, preložené **„Traktoristka“**. Ak je to tá istá karta s jedným menom, opravím.
8. **Kraj v hláškach motora** (`motor.odpovedaNaex`, `motor.vykladaNaKoniec`, `motor.zaverecnaLicomDole`) — {kraj}
   dosadí jadro po slovensky („pri výčape“), takže česká veta bude mať slovenský kraj. Riešenie je v jadre/klientovi
   (id kraja), nie v preklade.
9. **Ohorky – špaky** (výučba `i-lokalita`, `i-spaky`; pojem `spak.kratko`) → „nedopalky – vajgly“: slovná dvojica
   ostáva (spisovné + slang), Melicharovo „zbieram celý život“ sedí.
10. **Kultúrny dom** vo výučbe („dom“, „domu“) → vždy **„Kulturák“** (glosár), aj tam, kde slovenčina skracuje na „dom“.
