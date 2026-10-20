---
name: playtest
description: Spustí playtest hry NA EX! — dvaja AI playtesteri, ktorí poznajú všetky pravidlá, odohrajú celú partiu proti sebe cez skutočný server (bez znalosti súperovej ruky) a spisovateľ z ich spätnej väzby napíše report — známky podľa kritérií, náhoda vs. zručnosť, nezrovnalosti medzi pravidlami a hrou, návrhy na strategickosť, čo bolo dobré a čo zlepšiť — a stratég turnajmi botov zmeria náhodu vs. zručnosť a návrhy overí na variantoch pravidiel. Použi, keď používateľ povie /playtest, „spusti playtest", „nech to zahrajú agenti", „otestuj hru agentmi".
argument-hint: "[štýl hráča 1] | [štýl hráča 2] [| kratka|stredna|dlha]"
---

# Playtest NA EX!

Si **organizátor** playtestu. Založíš partiu, spustíš dvoch playtesterov, počkáš,
kým dohrajú, a dáš spísať report. Sám nehráš a do partie nezasahuješ.

Agenti (definície v `.claude/agents/`):
- `naex-playtester` ×2 — hrajú proti sebe, každý vidí len svoju stranu,
  a po partii zverejnia spätnú väzbu na stránke Spätná väzba webu,
- `naex-spisovatel` — po partii napíše interaktívny HTML report do `docs/playtesty/`,
- `naex-strateg` — po partii zmeria turnajmi botov, koľko rozhoduje zručnosť
  a koľko náhoda, návrhy playtesterov aj vlastné vyskúša ako varianty pravidiel
  (vo worktree, hlavnú vetvu nemení) a napíše rozbor `docs/playtesty/strategia-<id>.html`.

Sledovateľ vizuálu (`naex-sledovatel`) sa zatiaľ nespúšťa (Michal 2026-10-12) —
definícia ostáva pre neskoršie hodnotenie rozhrania.

Hru proti človeku (agent proti používateľovi) zakladá skill `protihrac`.

Kritériá hodnotenia: `tools/playtest/kriteria.md`.

**Hlavná téma (Michal 2026-10-19): strategickosť.** Hra má odmeňovať skill
a znalosť, nie náhodu. Playtesteri pred partiou naštudujú celé pravidlá
a všetky ťahy, hrajú ako experti, zapisujú rozhodovacie záznamy a
nezrovnalosti medzi pravidlami a hrou a v spätnej väzbe rozoberú náhodu
vs. zručnosť a navrhnú aspoň 5 zmien smerom k strategickej hre
(`kriteria.md`, časť C).

## Štýly hráčov

Argumenty: `$ARGUMENTS` — dva štýly oddelené `|`, voliteľne tretia časť
s dĺžkou hry (`kratka` 5, `stredna` 7, `dlha` 11 lokalít). **Predvolená
dĺžka je stredná (7 lokalít).** Ak štýly chýbajú, použi:

- **Hráč 1 — „Jano Bitkár"**: agresívny. Chce vyhrávať bitky — skladá Rany,
  Pecky a Petelice, dáva NA EX na súperove karty, nebojí sa poškodenia
  pečene ani dlhov, tlačí starších k sebe Pohoršením.
- **Hráč 2 — „Eva Stratégová"**: opatrná, hrá na body. Sleduje podmienky
  scorecardov a strach starších, šetrí poldeci a cigarety, vyhýba sa
  kliatbám, bitky vyberá s rozmyslom.

Meno daj krátke (do 24 znakov), štýl opíš jednou-dvoma vetami. Štýl
určuje priority, nie úroveň — obaja hrajú ako skúsení hráči, ktorí poznajú
všetky pravidlá a karty.

## Postup

1. **Web pre spätnú väzbu** — playtesteri zverejnia názory na skutočnom
   webe (predvolene vývojový server `http://localhost:8787`, inak
   `NAEX_WEB_URL`). Over ho:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny
   ```
   Ak nebeží, spusti ho na pozadí (`npm run dev`) a over znova. Ak sa
   nepodarí, playtest aj tak spusti a agentom povedz „Web: nedostupný".

2. **Založ partiu** (vlastný server na voľnom porte, dočasná databáza):
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/zaloz.ts "<meno 1>" "<meno 2>" stredna
   ```
   Z výpisu si zober cestu k relácii `R` (napr. `playtest/20261011-101500`)
   a port. Ak skript zlyhá, pozri `R/server.log` a povedz používateľovi prečo.

3. **Spusti oboch playtesterov naraz** — v jednej správe dve volania Agent,
   obe s `run_in_background: true`:
   - `naex-playtester`: „Relácia: R. Si hráč 1, meno: …, štýl: …. Web: <url>
     (alebo nedostupný). Najprv sa priprav (celé pravidlá, karty,
     moznosti.md), potom odohraj celú partiu ako expert. Hlavne potrebujem
     rozbor náhoda vs. zručnosť, nezrovnalosti medzi pravidlami a hrou
     a návrhy, ako hru spraviť strategickejšou. Napíš spätnú väzbu
     a zverejni ju na webe."
   - `naex-playtester`: to isté pre hráča 2.

   Ak existuje predošlý rozbor `docs/playtesty/strategia-*.html`, pridaj do
   zadania oboch jeho otázky z časti „Čo sledovať v ďalšom playteste“ ako
   **otázky na sledovanie** (playtester na ne odpovie v rozbore náhoda vs.
   zručnosť).

   Používateľovi povedz, že playtest beží, kto proti komu hrá a že partia
   trvá desiatky minút (stredná hra so 7 lokalitami dlhšie ako krátka). Upozorni ho, aby sa na port playtestu neprihlasoval
   za hráčov — prevzal by im spojenie.

4. **Čakaj na dokončenie** — agenti ti dajú vedieť sami, nepolluj. Keď
   skončia obaja playtesteri, ulož posledný stav partie:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 1 stav > R/koniec-hrac1.txt
   node --experimental-strip-types --no-warnings tools/playtest/hrac.ts R 2 stav > R/koniec-hrac2.txt
   ```
   Ak niektorý agent skončí bez dohranej partie (chyba, zaseknutý ťah),
   pozri `R/koniec-hrac*.txt` a `R/server.log`, zapíš, čo sa stalo, do
   `R/organizator.md` a pokračuj — aj nedohraná partia je užitočný podklad.

5. **Zastav server playtestu**:
   ```bash
   node --experimental-strip-types --no-warnings tools/playtest/ukonci.ts R
   ```

6. **Report a rozbor** — v jednej správe spusti oboch na pozadí:
   - `naex-spisovatel`: „Relácia: R. Napíš report z playtestu." Ak existuje
     `R/organizator.md`, spomeň ho.
   - `naex-strateg`: „Relácia: R. Zmeraj náhodu a zručnosť, vyhodnoť návrhy
     playtesterov na strategickosť, najsľubnejšie vyskúšaj ako varianty
     a napíš rozbor." Stratég beží dlhšie (turnaje botov, desiatky minút);
     používateľovi odovzdaj report spisovateľa hneď a rozbor stratéga, keď
     dobehne.

7. **Odovzdaj výsledok používateľovi**:
   - report na webe: `<web>/admin/playtesty/<id>.html` (sekcia Tvorba →
     Playtesty, len admin a subadmin) — spisovateľ ho tam pridal uložením do
     `docs/playtesty/`; súbor otvor používateľovi aj lokálne v prehliadači,
   - odkaz na stránku Spätná väzba (`<web>/spatna-vazba`) s názormi agentov,
   - výsledok partie (jedna veta, bez priebehu),
   - tabuľka známok 12 kritérií (hráč 1, hráč 2, priemer),
   - náhoda vs. zručnosť: odhad oboch hráčov a čo rozhodlo partiu,
   - nezrovnalosti medzi pravidlami a hrou — potvrdené chyby v hre zvlášť,
     otázky na autora (nejasné pravidlá) zvlášť; potvrdené chyby ponúkni
     opraviť,
   - 3–5 najsilnejších návrhov na strategickosť,
   - čo bolo dobré a 3–5 ďalších vecí na zlepšenie,
   - z rozboru stratéga (`<web>/admin/playtesty/strategia-<id>.html`):
     kľúčové čísla (rebrík zručnosti, delené rozdania, otočky) a ako sa
     pohli oproti predošlému rozboru, 3 odporúčané zmeny s nameraným
     posunom a čo od Michala potrebuje rozhodnúť. Zmeny pravidiel sám
     nezavádzaj — ponúkni, ktorú implementovať.
   Ponúkni, že report zverejníš ako stránku (Artifact) na zdieľanie.

   Do `docs/playtesty/zmeny-pravidiel.html` doplň pri dotknutých zmenách blok
   „Výsledok playtestu <id>“ (1–3 vety z reportu). Keď sa na základe playtestu
   zmení pravidlo alebo rozhranie, pridaj novú položku (prečo, čo sa zmenilo,
   čo sledovať) — záznam je skúšobný a otvorený zmenám.

   Do `docs/playtesty/vyvoj-znamok.html` pridaj partiu na koniec poľa `PARTIE`
   (známky oboch hráčov z `R/hrac*/feedback.md`, výsledok, dĺžka, odkaz na
   report; `zmenyPred` = doterajšie `CAKAJUCE`) a do `CAKAJUCE` daj zmeny
   pravidiel, ktoré vznikli po tomto playteste. Používateľovi pripomeň,
   ako sa priemer pohol oproti predošlej partii.

   Aj iné texty pre používateľa z playtestu (porovnanie viacerých partií,
   prehľady) píš ako interaktívne HTML, nie Markdown.

## Poznámky

- Relácie sú v `playtest/` (v `.gitignore`); reporty v `docs/playtesty/` sú v gite.
- AI účty na webe („<meno> (AI)") sa zakladajú samy; heslá sú v
  `playtest/ucty.json` (mimo gitu). Rovnaké meno = rovnaký účet naprieč playtestami.
- Playtester vidí len výstup `tools/playtest/hrac.ts`, ktorý dostáva od servera
  filtrovaný pohľad (`viewFor`) — súperovu ruku ani balíčky nepozná.
- Jedna partia je jeden údaj. Na závery o balanse treba viac partií —
  pri opakovaní pripomeň používateľovi, že reporty sa dajú porovnať.
