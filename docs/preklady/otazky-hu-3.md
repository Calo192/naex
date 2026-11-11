# Otázky — HU, vlna 3e (stôl, Detail partie, Novinky, Vývoj, Spätná väzba, vzory motora, Pravidlá, pojmy, výučba, nápovedy, achievementy)

Súbory: `apps/web/src/i18n/hu.json` (781 kľúčov), `apps/web/src/i18n/{pravidla,pojmy,vyucba,napovedy,achievementy}/hu.json`
(1104 polí, všetko vyplnené 2026-11-11). Glosár sa nemenil; nové pojmy a pochybnosti sú tu.

## Otázky na Michala (zdrojový text)

1. **Nápovedy sa rozchádzajú s Pravidlami.** Preložené verne, ale vyzerá to na staré znenie:
   - `napovedy/presvedcenie`: „Reči na červenú a **päť** navrch – a je presvedčený … **Tvoje reči pri ňom zhoria**, priazeň ti ostane.“
     Pravidlá (`ciel-a-senok.p18`, pojem `presvedcenie`): presvedčenie stojí **3 body**, reči, strach aj priazeň **ostávajú**.
   - `napovedy/patronat`: „súper ti dá špaky **za svoj marker** pri ňom“ — Pravidlá: toľko špakov, koľko bodov **hádky má v rečiach** pri ňom.
   Opraviť slovenčinu (preklad sa potom ukáže ako zastaraný a doplní sa)?
2. **Výučba hovorí o stranách línie.** `vyucba/k-ciel`: „aby Pecka bola vľavo, **na tvojej strane**“; `k-zh-bot1`: „línia – **tvoja vľavo, jeho vpravo**“.
   Pravidlo z CLAUDE.md (Michal 2026-11-08): moja/súperova strana línie neexistuje. Preložené verne („a te oldaladon“,
   „a tiéd balra, az övé jobbra“) — zmeniť zdroj?
3. **Pečiatky momentov nie sú lokalizované.** `MOMENTY` v `packages/core/src/momenty.ts` („ZVRAT!“, „ZÁVEREČNÁ!“, „VÝPRASK“…)
   sa na stole ukazujú po slovensky. Achievementy `posledne-slovo` a `eso-v-rukave` preto citujú pečiatku po slovensky
   („„ZVRAT!” pecsét“), aby sedela s tým, čo hráč vidí. Keď sa pečiatky preložia (návrh: FORDULAT!, ZÁRÓRA!, ELNÁSPÁNGOLÁS,
   BOMBA ×4, LÁZADÁS!, PADLÓGÁZ!, MEGMENTVE, ELFOGÁS, MEGGYŐZÉS), treba upraviť aj tieto dva popisy.

## Otázky na programátora (vzory motora a parametre)

4. **`motor.exekutorAdvokat*` — `{usetril}` je slovenský text.** Jadro píše „(Advokát ušetril 2 špaky)“ a vzor zachytí
   „2 špaky“ ako voľný text; maďarská veta tak končí „(az Ügyvéd megspórolt: 2 špaky)“. Riešenie: jadro alebo vzor s číslom
   (`{n3}` + tvar `motor.spakov`).
5. **`motor.odpovedaNaex`, `motor.zaverecnaLicomDole`, `motor.vykladaNaKoniec` — `{kraj}`** je slovenské meno kraja („pri výčape“).
   V maďarčine je preto v zátvorke „a sor végén ({kraj})“, aby nebolo treba príponu. Preložiť mená krajov v klientovi?
6. **`vyucba.radova.*` obsahujú člen** („az első“, „a második“…): maďarský člen závisí od nasledujúceho slova (az + samohláska),
   preto je súčasťou radovej číslovky a vety `vyucba.koniecVyucby`, `dalsiaCastText`, `pripravujemeText`, `koniecCastiText`
   člen nemajú. Pre časť > 4 (fallback `${n}` v `Vyucba.tsx`) by člen chýbal — dnes sú 3 časti, nevadí.
7. **`pravidla.verzia`** — maďarský dátum je „rok. mesiac. deň.“: „Szabályok {verzia}, hatályos: {rok}. {mesiac}. {den}.“
   (poradie parametrov iné ako v sk, funguje).
8. **`kseft.vziatZa`** — `{cena}` je `pocet.cigariet` v akuzatíve („3 cigarettát“), tlačidlo je preto „{n} db, {cena} fizetsz“.

## Nové pojmy (nie sú v glosári — navrhujem doplniť)

| sk | hu | prečo |
|---|---|---|
| spúšťač (Nástup:, Furt:…) | kiváltó | „kivált“ = spustiť; v pravidlách „Az Összetűzést … a hozzárakás váltja ki“ |
| priloženie / priložiť | hozzárakás / hozzárakni | protiklad k alárakás (podloženie) |
| presun karty | áthelyezés | |
| pečať (akcie navyše) | pecsét | už v glosári pri „akcia navyše“, len potvrdenie |
| Má dosť (§19, Päta) | Elege van | „mám toho dosť“ — dvojzmysel opitý / otrávený |
| padol (starší v §19) | kidőlt | „kidől“ = zvalí sa (aj opitý), krčmové |
| podraziť (§19) | elgáncsolni | podľa názvu režimu „gáncs“ v glosári |
| Dať vyžrať (§19) | Leitatni | „leitat“ = opiť niekoho, hrubé ako „vyžrať“ |
| štít / jed (§19) | pajzs / méreg | |
| Do radu! (Vychovávateľka, §19) | Sorakozó! | povel učiteľky / vojenský nástup |
| Krčmový účet (body v4/v5) | Számla | krčmový účet = számla |
| Účet špakov | Csikkszámla | |
| súboje (v5) | párharcok | |
| Hlásnik obce (Novinky) | A falu kisbírója | kisbíró = dedinský vyhlasovač s bubnom, presný ekvivalent |
| Roadmapa | Ütemterv | |
| šrot (súperov odhadzovací) | dobópakli | slang „šrot“ by v HU nikto nespojil s odhadzovacím balíčkom; jasnosť pred príchuťou |
| Balíček dedinčanov | a Polgárok paklija | podľa glosára obcan = Polgárok (pakli) a doterajšieho hu.json |
| Balíček nástrojov | szerszámpakli | |
| Starešina (tag) vs. starší | Elöljáró / elöljárók | **pozor:** glosár dáva obom to isté slovo; v Pravidlách „Polgár, Állat és Elöljáró“ (tag) sa môže pliesť so staršími. Zvážiť iné slovo pre tag (napr. „Tekintély“ je už tag Autorita, „Nagykutya“ hovorovo „veľké zviera“). |

## Poznámky k výučbe

- Kraje Ihriska a Kultúrneho domu podľa glosára: trávnik/tribúna = gyep/lelátó, parket/vchod = táncparkett/bejárat.
- Tlačidlá v texte Melichara podľa hu.json: „už neťahám“ = „elég“, „končím“ (Pitka) = „Ivászat vége“, „fajčiť“ = „Rágyújt“,
  „bez odpovede“ = „válasz nélkül“, pole Priznať = „Bevall“, pole Dedičstvo = „Örökség“.
- Slovná hračka „Strana nie je partia.“ (`q-superova`) funguje aj v HU: „Az oldal nem banda.“ (partia = banda podľa glosára).
- „Darina si to vypila“ → „Darina megitta a levét“ — maďarský idiom „vypiť si následky“ s tým istým pitím.
- Tvary pojmov jadra (`pojmy/hu.json` pole `tvary`) sú maďarské tvary s príponami, overené na textoch výučby a nápoved —
  každý z 15 pojmov sa v nich nájde.
