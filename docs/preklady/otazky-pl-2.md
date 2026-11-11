# Otázky prekladateľa PL — vlna 3d (2026-11-11)

Preklad prázdnych kľúčov `apps/web/src/i18n/pl.json` (stôl, profil, Domov, medziobrazovky, vzory `motor.*` / `server.*`). Pojmy podľa glosára; nové pojmy a pochybnosti nižšie.

## Chyby v zdroji (sk.json)

1. **`galeria.priznana` a `galeria.dedicstvo`** — v `sk.json` je rozbitý text z extrakcie: `priznane", k, "Priznaná kliatba` a `dedicstvo", k, "Dedičstvo`. Slovenský hráč tak vidí kúsok kódu. V PL je preložený zamýšľaný text (*Przyznana klątwa*, *Dziedzictwo*). **Vyriešené** — `sk.json` opravený v master 759b44c0 („Priznaná kliatba“, „Dedičstvo“), PL mu zodpovedá.

## Nové pojmy (nie sú v glosári)

2. **dedinská troska** (`profil.nahodnyTitul`, `profil.vyberTrosku`) = *wiejski wrak człowieka*. Zamietnuté: *menel* (je bezdomovec-pijan, glosár ho už má pre Stokársky barter), *łajza* (skôr flákač než troska). Pridať do glosára?
3. **Pionier** (`domov.hero`: „nikto nebude blatníky na Pionieri ohýbať“) → *Komarek* (Romet Komar, poľský dedinský moped z tej istej doby; „błotników w Komarku wyginał“). Jawa Pionier Poliak nepozná, Komar áno. Pridať do glosára ako miestny ekvivalent?
4. **Nápovedy (Melichara)** = *Podpowiedzi*; **medziobrazovky** = *plansze przejściowe*; **pult (Melichara)** = *pulpit*; **teplomer/šrafa** = *termometr / kreskowanie*; **stĺpček** = *słupek*; **dlaždica** = *kafelek*. Len UI, do glosára netreba, ak nechceš.
5. **Rekapitulácia** = *Podsumowanie* (nie *Rekapitulacja* — v PL znie úradne); **Odhad bitky** = *Prognoza bójki* (glosár).
6. **lícom dole** = *rewersem do góry* (ustálené v kartových hrách). Alternatíva *zakryta* — kratšia, ak by sa nezmestila.
7. **sekera** — glosár má *krecha / na krechę*. Pre „na sekere“ (špaky čakajú) používam tiež *na krechę*; lokál „pri sekere“ = *przy kresze* (správny, ale menej bežný tvar). Ak chceš, *na krechę* aj tam.

## Pochybnosti

8. **Mená hráčov v páde** — `{meno}` sa v PL nedá skloňovať. Kde slovenčina dáva meno do iného pádu („u {meno}“, „k {meno}“, „po {meno}“), píšem *gracz {meno}* („w piwnicy u gracza {meno}“, „po graczu {meno}“) alebo zátvorku/dvojbodku („w piwnicy ({meno})“, „trzyma: {kto}“). Pri `{kto}`, ktoré môže byť aj „ty“, vždy dvojbodka (`linia.presvedcilHo`, `linia.uKoho`).
9. **`rekap.protiViere` / `rekap.protiPovere`** — „tvoja {lavy} proti jeho Viere“: rod `{lavy}` v PL nie je známy (Zabobon m., Wiara ž.), preto „Twoje: {lavy} przeciw jego Wierze“. Ak `{lavy}` je vždy opačná akcia (Povera proti Viere), dá sa napísať pevne „twój Zabobon…“ — over.
10. **Vzory motora** — `{karta}` a `{karty}` z hlášky servera ostávajú po slovensky (napr. „Fero przyznaje kartę Cirhóza.“). To je obmedzenie vzorov, nie prekladu; ak to má byť po poľsky, klient by musel mená kariet v zachytených skupinách prekladať.
11. **`motor.exekutorDlhov`** — vzor sa vyberá podľa slovenského tvaru (`{n2}` ≥ 5 → „Dlhov“). Pri 22–24 Dlhoch by PL správne chcelo „przyznane Długi“, dostane „przyznanych Długów“. V hre nereálne, len poznámka.
12. **`spaky.nPoldeci`** je v sk reťazec bez tvarov („{n} poldeci“ je v SK nesklonné), v PL by potreboval 3 tvary; test vyžaduje rovnaký tvar ako sk, preto skratka *{n} kiel.* (ako *{n} pap.* pri cigaretách). Ak chceš plný tvar, treba v `sk.json` zmeniť na tvary.
13. **Rod v slovenských textoch len mužský** („Vyhral si hádku“, „Presvedčil ho ty“, „vzal si“) — PL drží to isté (mužský rod), kde sk nemá `.m/.z/.n` varianty.
