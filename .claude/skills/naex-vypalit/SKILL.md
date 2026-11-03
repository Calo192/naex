---
name: naex-vypalit
description: Vypáli Zrejúcu — z aktuálnej Zrejúcej (master) urobí novú Vypálenú (oficiálnu hru pre hráčov). Overí master, zverejní rozpracovanú sadu, posunie vetvu vypalena, nasadí Vypálenú, dopíše Novinky, aktualizuje roadmapu, skryje zastarané AI komentáre a návrhy z playtestov a Prijímača (o zaniknutých kartách a mechanikách), skontroluje výučbu a založí novú Zrejúcu (bez zmien oproti Vypálenej). Spúšťa ho len Michal. Použi, keď Michal povie /naex-vypalit, „vypáľ Zrejúcu“, „Zrejúca do Vypálenej“, „schváľ Zrejúcu“, „vydaj Zrejúcu hráčom“.
argument-hint: "[--hned] (nasadiť Vypálenú aj počas rozohraných partií)"
---

# Vypálenie Zrejúcej

Zrejúca je „aktuálna verzia + 1“ (CLAUDE.md, sekcia Vypálená a Zrejúca).
Vypálenie = Michalovo **schválenie celého stavu Zrejúcej naraz** (pravidlá,
módy, karty). Spustenie tohto skillu Michalom je to schválenie; nikto iný
(agent, iná session) ho spustiť nesmie a Leader ho nespúšťa sám od seba.

Robí ho Leader. Prácu na webe (Novinky, roadmapa, komentáre, sada) zadá
agentovi `naex-admin`, výučbu `naex-vymyselnik`; nasadenie podľa skillu
`naex-nasad`. `A` = `node --experimental-strip-types --no-warnings tools/admin/admin.ts`.

## 0. Čo sa vypáli

1. `git fetch origin`; `origin/vypalena` musí byť predkom `origin/master`
   (`git merge-base --is-ancestor`) — inak niekto zmenil vypalena mimo tohto
   skillu: zastav a povedz Michalovi.
2. Zmeny: `git log --oneline --first-parent origin/vypalena..origin/master`
   a rozdiel sady: `$A overit --zivy` (rozpracovaný tvorca proti zverejnenej
   sade). Ak nie je nič (žiadny commit, ktorý mení hru, a žiadna zmena kariet),
   povedz „Zrejúca nemá zmeny oproti Vypálenej“ a skonči.
3. Zhrň Michalovi ľudskou rečou (5–10 bodov: pravidlá, karty, stôl, web),
   čo ide hráčom. Pokračuj bez ďalšieho pýtania — skill spustil on.

## 1. Overenie mastera

V samostatnom worktree s **novým menom** (napr. `../naex-vypalit-<dátum>`;
ak cesta existuje, zvoľ iné meno — nič nemaž):
`git worktree add --detach <cesta> origin/master`, `npm ci`, `npm test`,
`npm run typecheck`, `npm run build`. Čo neprejde, **nevypaľuj** — povedz čo
a skonči. Nestabilné testy (časový limit pod záťažou) spusti samostatne.

## 2. Výučba

Výučba pre novú verziu sa robí pri vypálení (Michal 2026-11-02). V master sú
testy výučby vypnuté (`exclude` vo `vitest.config.ts`) — najprv výnimku zruš. Over, že
scenár „Prvá hra“ sedí s pravidlami mastera (`tools/vyucba/prehraj.ts` →
„Scenár sedí“, testy výučby). Ak nie, daj `naex-vymyselnik`-ovi prepísať
výučbu na master (texty Melichara čo najbližšie k pôvodným, návrh do
docs/napady/), zlúč ju a vráť sa na krok 1. Michal si výučbu prejde
dodatočne — nečakaj na jeho schválenie textov.

## 3. Sada kariet

Admin (`naex-admin`, `--zivy`): záloha (`$A zaloha "pred vypálením"`),
`$A overit --zivy`, potom `$A zverejni --potvrdene --zivy` — rozpracovaný
stav tvorcu sa stane zverejnenou sadou. Over, že zverejnená sada zodpovedá
`packages/core/data/cards.json` v master (bez Presbitera a karty Dlh); rozdiel
ohlás a nevypaľuj, kým ho nevysvetlíš (sada v repe sa mení len postupom
z CLAUDE.md, pravidlo 5).

## 4. Posun vetvy a nasadenie Vypálenej

1. `git push origin origin/master:vypalena` (len fast-forward; ak nejde,
   zastav).
2. Nasaď Vypálenú presne podľa skillu `naex-nasad` (bez argumentu
   `zrejuca`; s `--hned`, ak ho Michal dal) — uzávierka, čakanie na partie,
   smoke test.

## 5. Novinky

Admin: Novinky na živom webe pre hráča (nie pre vývojára) o všetkom, čo
prišlo z kroku 0, s vydaním (napr. `--vydanie "Pravidlá v11"`); presné znenia
efektov zo zverejnenej sady. Michalove texty doslova, ak ich dal.

## 6. Roadmapa

Admin: položky, ktoré sú týmto vypálením hotové (rozpracované a overené
v Zrejúcej), presuň do Hotové s commitom a sadou; položky, ktoré sa týkali
len Zrejúcej (napr. „overiť v Zrejúcej“), uprav alebo presuň. Nič nemaž.

- prehľad: `$A roadmapa --zivy` (poradie v stĺpcoch, id položiek),
- do Hotové: `$A roadmapa-presun <id> hotove --commit "<commit> · sada v<N>" --zivy`
  (server nastaví stav hotové a dátum dokončenia),
- presun inde: `$A roadmapa-presun <id> <stlpec> [--poradie N] --zivy`
  (stĺpce `prijimac | teraz | dalej | potom | neskor | hotove`; bez `--poradie`
  na koniec stĺpca),
- zmena textu: `$A roadmapa-uprav <id> <zmeny.json> --zivy`.

## 7. Upratanie zastaraných AI komentárov

Admin: prejdi **komentáre a názory AI účtov** (Spätná väzba, `$A nazory`),
**reporty a návrhy z playtestov** (sekcia Playtest, `$A playtesty`,
`$A navrhy`) a **Prijímač roadmapy** (`$A roadmapa prijimac`). Zastarané je
to, čo sa týka karty, akcie alebo mechaniky, ktorá vypálením zanikla alebo sa
zmenila tak, že text už neplatí (porovnaj s PRAVIDLA.md a sadou). Také položky
**skry/archivuj** (nie natvrdo zmaž; záloha pred zmenou). **Názory a
komentáre ľudí nikdy nemeň** — len ak sa týkajú zaniknutej veci, odpovedz na
ne ako Admin (AI), že vec zanikla. Výsledok: zoznam skrytých položiek
s dôvodom (id, prvá veta, prečo).

Príkazy (všetky s `--zivy`; nič sa nemaže — každé skrytie má dôvod a server
si zapíše kto, kedy a obsah v čase skrytia):

1. Kandidáti: `$A zastarane --zivy` (alebo `--json`) — AI názory a komentáre,
   reporty, návrhy a Prijímač, ktoré menujú kartu, čo v rozpracovanej sade
   nie je (porovná históriu zverejnených sád s tvorcom), alebo zrušenú
   mechaniku zo zoznamu `tools/admin/zastarane.json`. Je to len návrh: každého
   kandidáta prečítaj a skry len to, čo naozaj neplatí. Mechaniku, ktorá
   týmto vypálením zanikla, najprv dopíš do `zastarane.json` (commit na master).
   Príspevky ľudí vypíše zvlášť — tie sa neskrývajú.
2. Názor / komentár AI: `$A nazor-skry <id> --dovod "<čo zaniklo>" --zivy`,
   `$A komentar-skry <id> --dovod "…" --zivy`. Názor či komentár človeka
   server odmietne (403). Skryté: `$A nazory --archiv --zivy`; späť
   `$A nazor-vrat <id>` / `$A komentar-vrat <id>` (alebo Spätná väzba → Archív AI).
3. Odpoveď človeku: `$A komentar <id-nazoru> <subor.txt> --zivy` (ako Admin (AI)).
4. Report: `$A playtest-archivuj <súbor | turnus RRRRMMDD-HHMMSS> --dovod "…" --zivy`
   (turnus = report, rozbor aj návrhy naraz); archív `$A playtesty --archiv`,
   späť `$A playtest-vrat <súbor | turnus>`. V sekcii Playtest ich ukáže
   prepínač „aj archív“.
5. Návrh: `$A navrh-archivuj <id> --dovod "…" --zivy` (stav a rozhodnutie
   ostanú, nečaká na rozhodnutie, Developer ho nevezme); archív
   `$A navrhy --archiv`, späť `$A navrh-vrat <id>`.
6. Prijímač roadmapy archív nemá: zastaranú položku prepíš na platné pojmy
   (`$A roadmapa-uprav`), alebo ju uveď v odovzdaní Michalovi (zmazať môže on
   na webe).

## 8. Nová Zrejúca

1. Nasaď Zrejúcu z `origin/master` (teraz rovnaký ako `vypalena`) skillom
   `naex-nasad zrejuca` — okamžite, bez čakania.
2. Over, že Zrejúca hlási „bez zmien“: hráči s oprávnením po kliku na voľbu
   Zrejúca uvidia dialóg, že aktuálna Vypálená je posledná verzia a nech
   hrajú Vypálenú (`$A server-stav --zrejuca`, snímka voľby Zrejúca).
3. Skúsenosti AI hráčov (`tools/playtest/skusenosti/`): verzia Zrejúcej sa
   stala verziou Vypálenej — označ ich podľa toho (`tools/playtest/skusenosti.ts
   over-verziu`), aby protihráč na Vypálenej čítal platné.
4. Uprac worktree.

## 9. Odovzdanie Michalovi

Commit, ktorý je teraz na Vypálenej, verzia zverejnenej sady, koľko partií
čakalo / padlo, ID nových noviniek, presunuté položky roadmapy, počet
skrytých AI komentárov a návrhov (so zoznamom), stav výučby (čo si má Michal
prejsť) a že nová Zrejúca je bez zmien. Zapíš do pamäte, kedy a čo sa vypálilo.
