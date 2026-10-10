# Nasadenie NA EX! na internet

Hra potrebuje **stále bežiaci server** (WebSocket pre hru), **trvalý disk**
(SQLite databáza a nahrané obrázky) a **HTTPS**. Najlacnejšie a najspoľahlivejšie
je to na malom virtuálnom serveri (VPS).

## Odporúčanie: Hetzner Cloud + Docker + Caddy

| Položka | Cena (približne) |
|---|---|
| VPS Hetzner **CX22** (2 vCPU, 4 GB RAM, 40 GB SSD, dátové centrum v Nemecku) | ~4 – 5 € / mesiac |
| Automatické zálohy servera v Hetzneri (voliteľné, +20 %) | ~1 € / mesiac |
| Doména `.sk` (napr. Websupport, Active24) | ~10 – 15 € / rok |
| HTTPS certifikát (Let's Encrypt cez Caddy) | zadarmo |
| **Spolu** | **~6 € mesačne** |

Prečo práve takto:

- Server v Nemecku je zo Slovenska blízko — hra reaguje rýchlo.
- Výkon CX22 bohato stačí na desiatky súčasných partií; hra je malá (stav partie
  je v pamäti, obrázky sa cachujú v prehliadači).
- Bezplatné „platformy" (Render, Railway free…) server po nečinnosti uspia a
  nemajú trvalý disk — rozbehnutá partia by sa prerušila a dáta by sa stratili.
- Fly.io je podobne lacné, ale nastavenie trvalého disku a WebSocketov je
  zložitejšie. VPS s Dockerom sa dá kedykoľvek presťahovať inam.

## Postup krok za krokom

### 1. Server

1. Založ účet na <https://www.hetzner.com/cloud>, vytvor projekt a server:
   - lokalita **Falkenstein** alebo **Nuremberg**,
   - obraz **Ubuntu 24.04**,
   - typ **CX22**,
   - pridaj svoj SSH kľúč,
   - zapni **Backups** (odporúčané).
2. Poznač si IP adresu servera.

### 2. Doména

U registrátora domény nastav DNS záznam **A** (napr. `naex.sk` alebo
`hra.naex.sk`) na IP adresu servera. Zmena sa prejaví do pár minút až hodín.

### 3. Inštalácia na server

```bash
ssh root@IP_SERVERA

# Docker
curl -fsSL https://get.docker.com | sh

# Firewall: len SSH, HTTP a HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Kód hry
git clone <adresa tvojho git repozitára> /opt/naex
cd /opt/naex/deploy
cp .env.example .env
nano .env        # DOMENA=tvoja-domena.sk, NAEX_ADMINS=tvoje-prihlasovacie-meno
docker compose up -d --build
```

Po minúte beží hra na `https://tvoja-domena.sk`. Caddy sám získa a obnovuje
HTTPS certifikát.

### 4. Prvý admin

Na stránke sa **zaregistruj** s prihlasovacím menom, ktoré si zapísal do
`NAEX_ADMINS`. Účet dostane rolu admin automaticky a v menu sa objaví
**Tvorba**. Ďalších adminov môžeš pridať v sekcii *Tvorba → Používatelia*.

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

### 6. Zálohy

Okrem záloh Hetzneru si nastav dennú zálohu databázy a obrázkov:

```bash
chmod +x /opt/naex/deploy/zaloha.sh
crontab -e
# pridaj riadok:
0 4 * * * /opt/naex/deploy/zaloha.sh
```

Zálohy sú v `/opt/naex-zalohy` (posledných 14 dní). Raz za čas si ich stiahni
k sebe (`scp -r root@IP_SERVERA:/opt/naex-zalohy .`).

### 7. Aktualizácia hry

```bash
cd /opt/naex && git pull && cd deploy && docker compose up -d --build
```

Rozohrané partie sa pri reštarte stratia (stav partie je v pamäti) — aktualizuj,
keď nikto nehrá. Účty, karty a obrázky ostávajú v databáze.

## Lokálne bez Dockera

```bash
npm install
npm run build
NAEX_ADMINS=michal npm start      # http://localhost:8787
```

Dáta sú v priečinku `data/` (databáza `naex.sqlite` a `media/`).

## Premenné prostredia

| Premenná | Význam | Predvolene |
|---|---|---|
| `PORT` | port servera | `8787` |
| `NAEX_DATA` | priečinok s databázou a obrázkami | `<repo>/data` |
| `NAEX_ADMINS` | prihlasovacie mená adminov (čiarkou) | — |
| `NAEX_SECURE_COOKIE` | `1` = prihlásenie len cez HTTPS (za Caddy vždy) | — |
