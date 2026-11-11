# Otázky prekladateľa — CS, vlna 3d (2026-11-11)

Preklad `apps/web/src/i18n/cs.json`: herný stôl, profil, Domov, medziobrazovky, vzory `motor.*` / `server.*`.
Pojmy podľa `docs/preklady/glosar.json`. Nové voľby a pochybnosti:

1. **Cigorky** (`rekap.cigorky` „+ {n} Cigorky“) — v rekapitulácii cigarety nad rámec akcií (Dedičstvo). V glosári ani v kartách
   nie sú. Preložené slangom **„Cigára“** (CZ hovorové pre cigarety, rovnaká príchuť ako „cigorky“). Ak je to meno karty
   alebo efektu, treba ho dať do glosára. Možnosti: *Cigára* / *Cíga* / *Krabička cigaret* (ak ide o kartu).
2. **Víra v počte** (`ucinok.veriaci`, `ucinokKratko.veriaci`) — česky „5 věr“ neznie (genitív plurálu sa nepoužíva).
   Zvolený zápis ako hodnota: **„+{n} Víra“** vo všetkých tvaroch (ako „+2 Síla“ v deskovkách). Pověra je počítateľná:
   Pověra / Pověry / Pověr. Ak má byť jednotne, alternatíva „+{n}× Víra“.
3. **„karta staršieho je v jeho balíčku“** (`starsi.presvedcilTy`) — pri „Presvedčil ho ty“ je „jeho“ v slovenčine nejasné
   (karta ide do balíčka toho, kto presvedčil). Česky preložené významovo: **„v tvém balíčku“**. Pri súperovi a v `linia.*`
   ostáva „v jeho balíčku“. Ak sa myslí niečo iné, opravím.
4. **Domov — „Bitka o dedinu.“** (`domov.nadpis`) — preložené podľa glosára **„Rvačka o vesnici.“** (bitka = rvačka).
   Alternatíva „Bitva o vesnici.“ znie česky epickejšie a ironickejšie (narážka na vojnové filmy), ale porušuje glosár.
5. **Pionier** (`domov.hero`) — „blatníky na Pionieri ohýbať“ → **„blatníky na Pionýru ohýbat“**. Jawa Pionýr je česká
   ikona, narážka sedí ešte lepšie. Bez otázky, len pre informáciu.
6. **Tlačidlo „Rozumiem“** v medziobrazovkách nie je v `sk.json` (text v kóde). `profil.medziobrazovky` po česky odkazuje
   na **„Rozumím“** — pri extrakcii tlačidla treba v cs.json použiť to isté slovo.
7. **Skratka „š.“ (špaky)** → **„v.“** (vajgly), ako v predošlej vlne (`faza.naSekere`). V titulkoch, kde číslo nemá
   tvar (`stavka.nSpakov`, `os.naSekereSpakov`, `panel.taBitka`), je „{n} v.“, aby nebol zlý pád („3 vajglů“).
8. **Vety s počtom v podmete bez tvarov** (`spaky.prepadlo`, `spaky.sekeraCaka`, `spaky.cakaNaVitaza`…) — slovenský
   „{spaky} prepadlo“ by česky dal „3 vajgly propadlo“ (zlá zhoda). Prestavané s dvojbodkou alebo zátvorkou:
   „propadlo: {spaky}“, „Sekyra: vajgly za rvačku ({spaky}) čekají…“. Význam rovnaký.
9. **Rod „n“ (neuvedený)** — kde slovenčina dáva mužský tvar (`plocha.skoncilSi.n` „Skončil si“), čeština tiež
   (`Dohrál jsi`), lebo pokračuje slovom „Pitku.“. Inde neutrálne: `plocha.uzVybral.n` „má už vybráno“,
   `plocha.vzal.n` „vzal(a)“ (slovenské „má“ dávalo nezmysel „si ju má Fero“).
