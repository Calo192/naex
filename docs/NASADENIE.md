# Nasadenie NA EX! na internet

Hra potrebuje **stále bežiaci server** (WebSocket pre hru), **trvalý disk**
(SQLite databáza a nahrané obrázky) a **HTTPS**. Najlacnejšie a najspoľahlivejšie
je to na malom virtuálnom serveri (VPS).

## Odporúčanie: OVHcloud VPS-1, mesačne (stav október 2026)

| Položka | Cena (približne) |
|---|---|
| VPS **OVHcloud VPS-1** (Ubuntu 24.04, dátové centrum Frankfurt / Varšava / Strasbourg), **mesačne bez záväzku** | ~6,50 € bez DPH / mesiac |
| Adresa `<ip-s-pomlčkami>.sslip.io` s HTTPS (Let's Encrypt cez Caddy) | zadarmo |
| Vlastná doména `.sk` (voliteľné, neskôr) | ~10 – 15 € / rok |

Prečo práve takto (Michal 2026-10-19: najlacnejšie, platba mesačne, nie ročne):

- **Hetzner** (doteraz odporúčaný, ~6 €/mes. s hodinovým účtovaním) od jari 2026
  nedáva nové cloud servery novým zákazníkom — lacné plány sú „currently
  unavailable". Keď ich obnoví, je stále dobrá voľba; postup je rovnaký.
- **Netcup** má lacné VPS len so 12-mesačnou zmluvou, **Contabo** inzeruje ceny
  pri 24 mesiacoch.
- **Oracle Always Free** je zadarmo, ale registrácia s kartou často zlyhá a
  nečinné servery vie odobrať — rozohrané partie žijú v pamäti servera.
- Bezplatné „platformy" (Render, Railway free…) server po nečinnosti uspia a
  nemajú trvalý disk.
- VPS s Dockerom sa dá kedykoľvek presťahovať inam tým istým skriptom.

## Postup krok za krokom

### 1. Server (urobí Michal — účet a platba)

1. Založ účet na <https://www.ovhcloud.com> a objednaj **VPS-1**; pri platbe
   zvoľ **mesačne / bez záväzku** (predvolené býva predplatné na 12 mesiacov).
2. Systém **Ubuntu 24.04**, lokalita Frankfurt, Varšava alebo Strasbourg.
3. Vlož verejný SSH kľúč `~/.ssh/naex_server.pub` (vygenerovaný na Michalovom
   počítači 2026-10-19; nový: `ssh-keygen -t ed25519 -f ~/.ssh/naex_server`).
4. Poznač si IP adresu servera (príde aj e-mailom).

### 2. Nahratie a spustenie

Z koreňa repozitára (Git Bash):

```bash
deploy/nahraj.sh <IP-servera>            # OVH: používateľ ubuntu; iný VPS: deploy/nahraj.sh <IP> root
```

Skript zabalí pracovnú kópiu (aj necommitnuté zmeny, bez node_modules, dát a
veľkých podkladov), pošle ju na server, pri prvom spustení nainštaluje Docker,
firewall (SSH, 80, 443) a dennú zálohu, vytvorí `deploy/.env` s náhodným heslom
admina (kópia v `deploy/.env.produkcia`, mimo gitu) a spustí `docker compose`.
Hra potom beží na `https://<ip-s-pomlčkami>.sslip.io`.

### 3. Vlastná doména (neskôr)

U registrátora nastav záznam **A** domény na IP servera a spusti znova
`deploy/nahraj.sh <IP> ubuntu tvoja-domena.sk` — Caddy vybaví nový certifikát.

### 4. Prvý admin

Admin je len jeden: server ho pri štarte založí s prihlasovacím menom
**Admin** a heslom z `NAEX_ADMIN_HESLO` (zmena hesla v `.env` sa prejaví po
reštarte). Prihlás sa ním — v menu sa objaví **Tvorba** a **Hráči**. V sekcii
*Tvorba → Hráči* môžeš ľubovoľného hráča povýšiť na **subadmina** (smie to isté
čo admin okrem zmeny úrovní). Nové účty sú návštevníci; hráčmi sa stanú samy po
prvej dohratej partii proti človeku aj proti botovi (Michal 2026-10-21); partie
proti botovi sa do štatistík nerátajú.

### 5. Knižnica obrázkov (voliteľné)

Obrázky z priečinka `docs/NA EX` (nie sú v gite) nahraj na server a importuj:

```bash
# z tvojho počítača
scp -r "docs/NA EX" root@IP_SERVERA:/opt/naex-obrazky
# na serveri
cd /opt/naex/deploy
docker compose cp /opt/naex-obrazky naex:/tmp/obrazky
docker compose exec naex node --experimental-strip-types packages/server/src/kniznica.ts /tmp/obrazky
```

V tvorcovi kariet sa potom zobrazia v záložke **Knižnica obrázkov**.

### 5b. Hudba počas partie

Počas partie hrajú v náhodnom poradí skladby z playlistu **NaEx – PLEBS** na Suno
(<https://suno.com/playlist/00621406-82e0-4708-9ba6-93a53e9b4908>), medzi nimi
10 s ticho. Hráč si hlasitosť nastaví v profile (0 = vypnutá, predvolene 30 %).

Suno stream šifruje a jeho dočasné odkazy po mesiaci zanikajú, preto hudbu
servíruje náš server. Skladby stiahni zo Suno ako **MP3** (vlastník skladby:
*⋯ → Download → MP3 Audio*) do jedného priečinka — názov súboru je názov
skladby, ktorý sa ukáže hráčovi. Priečinok je celý playlist: import skladby,
ktoré v ňom nie sú, zmaže.

```bash
# lokálne
npm run hudba -- "C:/Users/Michal/Downloads/NaEx PLEBS"
# produkcia — z tvojho počítača
scp -r "C:/Users/Michal/Downloads/NaEx PLEBS" ubuntu@IP_SERVERA:/tmp/hudba
# na serveri
cd /opt/naex/deploy
docker compose cp /tmp/hudba naex:/tmp/hudba
docker compose exec naex node --experimental-strip-types --no-warnings packages/server/src/hudba-import.ts /tmp/hudba
```

Skladby sú v `/data/hudba` (zväzok, prežijú aktualizáciu); denná záloha ich
nekopíruje — originály sú na Suno. Server ich netreba reštartovať.

### 5c. Hlášky majstra Melichara

V partii proti počítaču zaznie krátka hláška majstra Melichara, keď na stole
dopadne pečiatka momentu; hráči si ich púšťajú aj sami z pultu (soundboard).
Hlasitosť si hráč nastaví v profile (predvolene 70 %, 0 = vypnutý). Import
funguje ako pri hudbe — priečinok je celá sada, text hlášky je názov súboru
bez poradového čísla (`03_No_toto_je_marha.mp3` → „No toto je marha“).

Hlášky ležia v priečinkoch skupín (Michal 2026-10-23) — priečinok je skupina
na soundboarde (pečiatka na Melicharovom pulte, kláves pustí náhodnú hlášku
z nej) a podľa nej sa Melichar ozve pri momente:

```
data/majster_melichar/
  udiv/
    skupina.json      názov, citát, ikona, farba, kláves, nálady momentov
    aha.mp3 …
  nervy/ bieda/ urazky/ vyhrazky/ reci/ pohoda/
  _na-posudenie/      priečinok s „_“ sa nenahrá (hláška, o ktorej sa ešte rozhoduje)
```

`skupina.json`:

```json
{
  "nazov": "Údiv",
  "citat": "No teda, toto som nevideu",
  "ikona": "vykricnik",
  "farba": "info-silna",
  "klaves": "1",
  "nalady": ["udiv"]
}
```

- **ikona**: `pivo`, `kladivo`, `minca`, `blesk`, `otaznik`, `vykricnik`,
  `bublina`, `fuz` — alebo krátky text či emoji.
- **farba**: token zo `schemy.css` bez `--` (`akcent`, `akcent-tmavy`,
  `akcent-svetly`, `cervena`, `cervena-svetla`, `cervena-text`, `zelena`,
  `zelena-svetla`, `info`, `info-silna`, `ja`, `tlmeny`, `text`); iná = akcent.
- **klaves**: `1`–`9`, každý len raz (o kláves sa hlási abecedne prvý
  priečinok); bez klávesu je pečiatka len na klik.
- **nalady**: pri ktorých momentoch sa Melichar ozve hláškou zo skupiny —
  `pohoda` (moment v prospech hráča), `smola` (v prospech súpera), `udiv`
  (moment, ktorý nepatrí nikomu). Ktorý moment má akú náladu, určuje
  `NALADY_MOMENTOV` v `packages/core/src/momenty.ts`. Keď skupina s náladou
  chýba, ozve sa Údiv.

**Nová hláška**: súbor do priečinka skupiny, import. **Nová skupina**: nový
priečinok so `skupina.json`, import — pečiatka sa na pulte objaví sama.
Súbor priamo v `majster_melichar/` (mimo skupiny) sa nenahrá. Import vypíše
skupiny s počtom hlášok a všetko, čo vynechal.

```bash
# lokálne
npm run melichar -- "data/majster_melichar"
# produkcia — z tvojho počítača (starý /tmp/melichar najprv preč, inak by sa nová sada vnorila do starej)
ssh ubuntu@IP_SERVERA "rm -rf /tmp/melichar"
scp -r data/majster_melichar ubuntu@IP_SERVERA:/tmp/melichar
# na serveri
cd /opt/naex/deploy
docker compose exec naex rm -rf /tmp/melichar
docker compose cp /tmp/melichar naex:/tmp/melichar
docker compose exec naex node --experimental-strip-types --no-warnings packages/server/src/hudba-import.ts --melichar /tmp/melichar
```

Hlášky sú v `/data/melichar`; originály drž v `data/majster_melichar`.
Import **synchronizuje**: hláška, ktorá v zdroji už nie je (zmazaná alebo
v priečinku s „_“), zmizne zo zoznamu aj z `/data/melichar` — zmazať hlášku
z produkcie = zmazať ju zo zdroja a pustiť import. Reštart servera netreba.

### 6. Zálohy

Dennú zálohu databázy a obrázkov (4:00) nastaví `deploy/nahraj.sh` sám
(cron spúšťa `/opt/naex/deploy/zaloha.sh`).

Zálohy sú v `/opt/naex-zalohy` (posledných 14 dní). Raz za čas si ich stiahni
k sebe (`scp -r root@IP_SERVERA:/opt/naex-zalohy .`).

### 7. Aktualizácia hry

```bash
deploy/nahraj.sh <IP-servera>              # Vypálená (z vetvy vypalena, skill /naex-nasad)
deploy/nahraj.sh <IP-servera> --zrejuca    # Zrejúca (z master, /naex-nasad zrejuca, hneď) — časť 9
```

**Karty na produkciu.** Server má vlastnú databázu tvorcu — nasadenie prenesie
len kód. Keď sa sada zverejnila lokálne (a skopírovala do
`packages/core/data/cards.json`), pred nasadením prenes aj ilustrácie a údaje
návrhov do seedu:

```bash
node --experimental-strip-types --no-warnings tools/admin/do-seedu.ts
```

Server pri štarte (`Obsah.dorovnajSoSeedom`, raz pre každú značku migrácie)
prepíše návrhy podľa `cards.json` a `seed/`, doplní kľúčové slová a zverejní
novú verziu sady. Ak má produkčný tvorca nezverejnenú prácu, dorovnanie sa
preskočí (varovanie v logu) — nič neprepíše. Pre ďalšie dorovnanie treba v kóde
novú značku (`dorovnajSoSeedom(teraz, "migracia-sada-vN-…")`).

Rozohrané partie sa pri reštarte stratia (stav partie je v pamäti) — aktualizuj,
keď nikto nehrá. Účty, karty a obrázky ostávajú v databáze.

### 8. E-maily (obnova zabudnutého hesla)

Hráč si môže v profile uložiť nepovinný e-mail; na stránke prihlásenia je odkaz
**Zabudol som heslo** a server na ten e-mail pošle odkaz na nové heslo (platí
1 hodinu, raz). **Odosielanie je zatiaľ vypnuté** (Michal 2026-11-01): režim
`NAEX_EMAIL_REZIM=log` (predvolený) e-mail neodošle, len ho zapíše do logu
servera — kto, kam a odkaz:

```bash
# na serveri
cd /opt/naex/deploy && sudo docker compose logs naex | grep -A8 "e-mail, neodoslaný"
```

Odkaz v e-maile začína adresou z `NAEX_ADRESA` (compose ju nastaví na
`https://${DOMENA}`). Z hlavičky `Host` sa zámerne neberie — útočník by si
inak vyžiadal obnovu cudzieho účtu s odkazom na vlastnú doménu.

**Čo treba na zapnutie odosielania** (bez nových závislostí, `package.json` sa nemení):

1. V `packages/server/src/email.ts` pridať režim do `REZIMY_EMAILU`
   a jeho implementáciu `PosliEmail` — `(komu, predmet, text) => Promise<void>`;
   v `odosielacZProstredia` ju vybrať podľa režimu. Dve cesty:
   - **Gmail SMTP** (`smtp`): `node:tls` na `smtp.gmail.com:465`, príkazy
     EHLO, AUTH PLAIN (účet + *heslo aplikácie* z Google účtu s dvojfázovým
     overením, nie bežné heslo), MAIL FROM, RCPT TO, DATA, QUIT. Telo
     `Content-Type: text/plain; charset=utf-8`, predmet s diakritikou
     kódovaný ako `=?UTF-8?B?…?=`. Gmail dovolí rádovo stovky správ denne.
   - **HTTPS API služby** (`api`, napr. Brevo, Resend, Postmark): jeden
     `fetch` POST s kľúčom v hlavičke. Doména odosielateľa potrebuje
     záznamy SPF a DKIM, inak pošta padá do nevyžiadanej.
2. Premenné prostredia v `deploy/.env` na serveri (mimo gitu) a ich
   odovzdanie v `deploy/docker-compose.yml` (sekcia `environment`):
   `NAEX_EMAIL_REZIM` a podľa režimu napr. `NAEX_EMAIL_OD` (adresa
   odosielateľa), `NAEX_SMTP_UCET` + `NAEX_SMTP_HESLO`, alebo `NAEX_EMAIL_API_KLUC`.
3. Chyba odosielania sa len zapíše do logu — hráč dostane vždy tú istú
   odpoveď („Ak účet s týmto e-mailom existuje…“), aby sa nedalo zistiť, kto je
   registrovaný. Test odosielača: vlastný e-mail v profile → Zabudol som heslo.

E-mail hráča vidí len on sám (profil) a admin (Hráči → pod loginom,
`admin.ts pouzivatelia` pri prihlásení ako admin); subadmin ani ostatní hráči nie.

### 9. Vypálená a Zrejúca — dve inštancie, jedna adresa (Michal 2026-11-02)

| | **Vypálená** | **Zrejúca** |
|---|---|---|
| čo to je | oficiálna hra pre všetkých | pokusná verzia pre hráčov s oprávnením |
| adresa | `https://<DOMENA>` | tá istá — voľba na stránke Hrať; nástroje `https://<DOMENA>/zrejuca` |
| kód | vetva `vypalena` (posúva ju skill `naex-vypalit` po Michalovom schválení) | `master` |
| na serveri | `/opt/naex`, projekt `deploy`, zväzok `deploy_naex-data`, Caddy | `/opt/naex-zrejuca`, projekt `naex-zrejuca`, zväzok `naex-zrejuca_naex-zrejuca-data` |
| účty a relácie | tu | z Vypálenej — tá istá cookie `naex_sid`; Zrejúca ju overí cez `/api/ja` Vypálenej |
| sada kariet | posledná **zverejnená** | **rozpracovaný** stav tvorcu Vypálenej (prevezme ho do minúty, hneď `admin.ts sada-zrejuca --zrejuca`) |
| tvorca, Spätná väzba, Playtest, Vývoj, Novinky | tu | odkaz prepne späť do Vypálenej |
| partie a štatistiky | vlastná databáza | vlastná databáza; do /vyvoj a známok hry sa nerátajú |
| nasadenie | `/naex-nasad` (uzávierka, čaká na partie) | `/naex-nasad zrejuca` — hneď, nikdy sa nečaká; mení len svoj kontajner |

**Oprávnenie** `hrat_zrejucu` (matica Ranky a práva): predvolene Sedmička; admin,
subadmini a AI účty ho majú vždy. Admin ho v Hráči (stĺpec Zrejúca) konkrétnemu
účtu udelí alebo odoberie — výnimka má prednosť pred rankom (adminovi sa odobrať
nedá). Kto ho nemá, voľbu nevidí a Zrejúca ho slušne odmietne.

**Smerovanie** (`deploy/Caddyfile`): voľba „Zrejúca (pokusná verzia)“ nastaví po
kontrole oprávnenia cookie `naex_instancia=zrejuca` (`POST /api/instancia`);
Caddy potom posiela celý prehliadač (stránka, API, WebSocket) do kontajnera
Zrejúcej. Pás „Zrejúca – pokusná verzia · Späť do Vypálenej“ cookie zmaže.
Cesta `/zrejuca/…` ide do Zrejúcej bez predpony (nástroje agentov). Núdzový
návrat: `https://<DOMENA>/vypalena` (Caddy cookie zmaže sám). Kým Zrejúca
nebeží, jej hráči dostanú stránku s odkazom späť; Vypálená beží ďalej. Stará
adresa `zrejuca.<DOMENA>` presmeruje na spoločnú.

**Bez zmien:** keď Zrejúca beží na tom istom commite ako Vypálená (VERZIA.json
oboch, bez necommitnutých zmien), tvorca nemá nič nezverejnené a žiadny režim nie je
len v Zrejúcej, voľba Zrejúcej ukáže len hlášku „Aktuálna verzia Vypálená je
posledná…“. Počíta to Vypálená (`GET /api/zrejuca/stav`, `NAEX_ZREJUCA_URL`);
`admin.ts server-stav --zrejuca` vypíše „Zrejúca: bez zmien / N commitov, M kariet
navyše, len v Zrejúcej: …“.

**Režimy len v Zrejúcej** (Michal 2026-11-06): 2 na 2 a Päta, Lakeť, Otočka hrá len
Zrejúca (`REZIMY_LEN_V_ZREJUCEJ` v `packages/server/src/zrejuca.ts`). Vypálená ich
odmieta na serveri a klient ich neukáže, aj keď obe bežia na tom istom commite.

Kód je jeden, rozdiel je v prostredí: Zrejúca `NAEX_INSTANCIA=zrejuca` a
`NAEX_VYPALENA=http://naex:8787` (heslo admina z `.env` Vypálenej — ním číta
jej tvorcu); Vypálená `NAEX_ZREJUCA_ADRESA=/` (ponúka voľbu) a
`NAEX_ZREJUCA_URL=http://naex-zrejuca:8787` (porovnanie verzií). Obrázky, ktoré
Zrejúca nemá, podá z Vypálenej. Hudba a hlášky Melichara sú v dátach každej
inštancie zvlášť — importujú sa do Vypálenej (časti 5b a 5c) a `nahraj.sh --zrejuca`
ich pri každom nasadení Zrejúcej skopíruje z Vypálenej (po importe teda stačí nasadiť Zrejúcu).

**Prechod z adresy zrejuca.<DOMENA> na jednu adresu** (raz, infra bez zmeny hry):

1. Nasaď **Vypálenú** z `origin/vypalena`, ktorá už obsahuje tento `deploy/`
   (`/naex-nasad`, s uzávierkou ako vždy). Je to **jediný reštart Vypálenej**:
   skript nový Caddyfile najprv overí (`caddy validate`; zlý by nasadenie
   zastavil skôr, než sa niečo reštartuje), potom reštartuje Vypálenú a nový
   kontajner Caddy (Caddyfile sa zmenil). Od tej chvíle Vypálená ponúka voľbu
   Zrejúcej a pýta sa jej na verziu; `zrejuca.<DOMENA>` presmeruje na spoločnú adresu.
2. Nasaď **Zrejúcu** z `origin/master`: `bash deploy/nahraj.sh <IP> --zrejuca`
   (len jej kontajner, Vypálená a Caddy bežia ďalej). Skript skončí chybou, ak
   Caddyfile Vypálenej Zrejúcu na spoločnej adrese ešte nepozná.
3. Over: `web.ts dostupny --zrejuca`, `admin.ts server-stav --zrejuca`,
   v prehliadači adminom Hrať → „Zrejúca (pokusná verzia)“ → pás Zrejúcej →
   „Späť do Vypálenej“.

Ďalšie nasadenia Zrejúcej už Vypálenú ani Caddy nemenia.

**Schválenie Zrejúcej** (do Vypálenej ide celý stav naraz — módy, pravidlá,
karty) robí skill `naex-vypalit`: posunie `vypalena` na schválený master, Admin
zverejní sadu, nasadí Vypálenú a znova Zrejúcu — potom je Zrejúca „bez zmien“.

## Lokálne bez Dockera

```bash
npm install
npm run build
npm start      # http://localhost:8787 (heslo admina v .env: NAEX_ADMIN_HESLO=…)
```

Dáta sú v priečinku `data/` (databáza `naex.sqlite` a `media/`).

## Premenné prostredia

| Premenná | Význam | Predvolene |
|---|---|---|
| `PORT` | port servera | `8787` |
| `NAEX_DATA` | priečinok s databázou a obrázkami | `<repo>/data` |
| `NAEX_ADMIN_HESLO` | heslo jediného admina; bez neho sa účet nezakladá | — |
| `NAEX_ADMIN_LOGIN` | prihlasovacie meno admina | `Admin` |
| `NAEX_SECURE_COOKIE` | `1` = prihlásenie len cez HTTPS (za Caddy vždy) | — |
| `NAEX_EMAIL_REZIM` | ako posielať e-maily (obnova hesla); zatiaľ len `log` = zapísať do logu | `log` |
| `NAEX_ADRESA` | verejná adresa webu do odkazov v e-mailoch | compose: `https://${DOMENA}`, inak len cesta |
| `NAEX_INSTANCIA` | `vypalena` (oficiálna) alebo `zrejuca` (pokusná, len testeri) — časť 9 | `vypalena` |
| `NAEX_VYPALENA` | Zrejúca: adresa, na ktorej volá Vypálenú (účty, tvorca, obrázky) | compose Zrejúcej: `http://naex:8787` |
| `NAEX_VYPALENA_ADRESA` | Zrejúca vo vývoji: adresa Vypálenej pre prehliadač (iný port) | — (za Caddy tá istá adresa) |
| `NAEX_ZREJUCA_ADRESA` | Vypálená: kam pošle voľba „Zrejúca“ (`/` za Caddy, vo vývoji `http://localhost:<port>`); bez nej sa neponúka | compose: `/` |
| `NAEX_ZREJUCA_URL` | Vypálená: kde sa pýta Zrejúcej na verziu (bez zmien sa neponúka) | compose: `http://naex-zrejuca:8787` |
