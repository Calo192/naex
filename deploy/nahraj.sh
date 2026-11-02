#!/usr/bin/env bash
# Nahrá hru z tohto počítača na VPS a spustí ju (Docker + Caddy s HTTPS).
# Posiela pracovnú kópiu (aj necommitnuté zmeny) — GitHub netreba.
#
#   deploy/nahraj.sh <IP-servera> [používateľ] [doména] [--zrejuca]
#
# Bez prepínača nasadí Vypálenú (oficiálna hra, /opt/naex, nasadzuje sa z vetvy vypalena).
# --zrejuca nasadí pokusnú Zrejúcu (Michal 2026-11-02; /opt/naex-zrejuca, z master) — samostatný
# kontajner s vlastnou databázou v sieti Vypálenej, na tej istej adrese (Caddy smeruje podľa
# cookie a cesty /zrejuca/). Mení LEN kontajner Zrejúcej: Vypálenú ani Caddy nereštartuje, jej
# partie bežia ďalej; nasadzuje sa hneď, bez čakania. Vypálená musí byť nasadená skôr s týmto
# deploy/ (heslo admina, sieť, Caddyfile so Zrejúcou).
#
# používateľ: predvolene ubuntu (OVH, Ubuntu 24.04), root pri iných VPS.
# doména:     predvolene <ip-s-pomlčkami>.sslip.io — zadarmo, Caddy na ňu
#             vybaví HTTPS; vlastnú doménu (A záznam na IP) stačí doplniť neskôr.
#
# Prvé spustenie nainštaluje Docker, firewall a dennú zálohu a vytvorí
# deploy/.env na serveri s náhodným heslom admina; heslo sa uloží aj sem do
# deploy/.env.produkcia (mimo gitu). Ďalšie spustenia len aktualizujú hru —
# rozohrané partie sa reštartom stratia, databáza a obrázky ostávajú.
set -euo pipefail

ZREJUCA=false
POZICNE=()
for a in "$@"; do
  if [ "$a" = "--zrejuca" ]; then ZREJUCA=true; else POZICNE+=("$a"); fi
done
set -- "${POZICNE[@]+"${POZICNE[@]}"}"
IP="${1:?Použitie: deploy/nahraj.sh <IP-servera> [používateľ] [doména] [--zrejuca]}"
POUZIVATEL="${2:-ubuntu}"
DOMENA="${3:-$(echo "$IP" | tr . -).sslip.io}"
KLUC="${NAEX_SSH_KLUC:-$HOME/.ssh/naex_server}"
CIEL="$POUZIVATEL@$IP"
SSH=(ssh -i "$KLUC" -o StrictHostKeyChecking=accept-new "$CIEL")

cd "$(dirname "$0")/.."
# Archív aj výstup do jedného dočasného priečinka, ktorý trap zmaže vždy — aj pri chybe
# (predtým v %TEMP% ostával 50–60 MB naex.tgz po každom nasadení).
# Na disk projektu, nie na C (Michal 2026-10-23): NAEX_TMP, inak ../naex-tmp vedľa repa.
NAEX_TMP="${NAEX_TMP:-$(pwd)/../naex-tmp}"
command -v cygpath >/dev/null && NAEX_TMP="$(cygpath -u "$NAEX_TMP")"
mkdir -p "$NAEX_TMP"
DOCASNY="$(mktemp -d "$NAEX_TMP/naex-nasad.XXXXXX")"
ARCHIV="$DOCASNY/naex.tgz"
VYSTUP="$DOCASNY/vystup.txt"
# Čo presne beží na serveri (GET /api/admin/stav-servera) — skill naex-stav
# podľa toho vie, ktoré commity ešte nie sú nasadené.
NECOMMITNUTE=false
[ -n "$(git status --porcelain 2>/dev/null)" ] && NECOMMITNUTE=true
printf '{"commit":"%s","vetva":"%s","necommitnute":%s,"nahrate":"%s"}\n' \
  "$(git rev-parse HEAD 2>/dev/null || echo "?")" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")" \
  "$NECOMMITNUTE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > VERZIA.json
trap 'rm -f VERZIA.json; rm -rf "$DOCASNY"' EXIT
echo "Balím pracovnú kópiu…"
tar -czf "$ARCHIV" \
  --exclude=./node_modules --exclude='./*/*/node_modules' --exclude='./*/*/dist' \
  --exclude=./.git --exclude=./data --exclude=./playtest --exclude=./admin-agent \
  --exclude='./docs/NA EX' --exclude='./docs/*.pdf' --exclude='./docs/*.zip' \
  --exclude=./.env --exclude=./deploy/.env --exclude=./deploy/.env.produkcia \
  --exclude='*.tsbuildinfo' .

echo "Posielam na $CIEL…"
scp -i "$KLUC" -o StrictHostKeyChecking=accept-new "$ARCHIV" "$CIEL:/tmp/naex.tgz"

if $ZREJUCA; then
  # Kód do /opt/naex-zrejuca, .env (heslo admina, doména) z Vypálenej. Vypálenú, jej databázu ani
  # Caddy nemení — Caddyfile so Zrejúcou prináša nasadenie Vypálenej.
  "${SSH[@]}" "sudo bash -s" <<'SKRIPT' | tee "$VYSTUP"
set -euo pipefail
if [ ! -f /opt/naex/deploy/.env ]; then
  echo "CHYBA: Vypálená nie je nasadená (/opt/naex/deploy/.env chýba) — najprv deploy/nahraj.sh <IP>."
  exit 1
fi
if ! grep -q "naex_instancia" /opt/naex/deploy/Caddyfile; then
  echo "CHYBA: Caddyfile Vypálenej ešte nepozná Zrejúcu na spoločnej adrese — najprv nasaď Vypálenú s týmto deploy/ (docs/NASADENIE.md, časť 9)."
  exit 1
fi
mkdir -p /opt/naex-zrejuca
find /opt/naex-zrejuca -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf /tmp/naex.tgz -C /opt/naex-zrejuca && rm /tmp/naex.tgz
cp /opt/naex/deploy/.env /opt/naex-zrejuca/deploy/.env && chmod 600 /opt/naex-zrejuca/deploy/.env
cd /opt/naex-zrejuca/deploy
docker compose -f docker-compose.zrejuca.yml build
docker compose -f docker-compose.zrejuca.yml run -T --rm --no-deps --user root --entrypoint chown naex-zrejuca -R node:node /data </dev/null
docker compose -f docker-compose.zrejuca.yml up -d
# Hudba a hlášky Melichara sa importujú do Vypálenej — Zrejúca má vlastný zväzok, tak ich sem
# pri každom nasadení skopírujeme (inak by v Zrejúcej chýbali).
VYP=$(cd /opt/naex/deploy && docker compose ps -q naex)
ZR=$(docker compose -f docker-compose.zrejuca.yml ps -q naex-zrejuca)
if [ -n "$VYP" ] && [ -n "$ZR" ]; then
  T=$(mktemp -d)
  for d in hudba melichar; do
    if docker cp "$VYP:/data/$d" "$T/$d" 2>/dev/null; then docker cp "$T/$d/." "$ZR:/data/$d"; fi
  done
  rm -rf "$T"
  docker exec -u 0 "$ZR" chown -R node:node /data/hudba /data/melichar 2>/dev/null || true
fi
docker image prune -f >/dev/null
SKRIPT
  echo "Čakám na Zrejúcu…"
  for i in $(seq 1 60); do
    if curl -fsS -o /dev/null "https://$DOMENA/zrejuca/api/ja"; then
      echo "Zrejúca beží: https://$DOMENA (prepínač na stránke Hrať; nástroje https://$DOMENA/zrejuca)"
      exit 0
    fi
    sleep 5
  done
  echo "Zrejúca ešte neodpovedá — pozri: ssh -i $KLUC $CIEL 'cd /opt/naex-zrejuca/deploy && sudo docker compose -f docker-compose.zrejuca.yml logs --tail 80'"
  exit 1
fi

HESLO_NOVE="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
"${SSH[@]}" "sudo bash -s" <<SKRIPT | tee "$VYSTUP"
set -euo pipefail
if ! command -v docker >/dev/null; then
  echo "Inštalujem Docker…"
  curl -fsSL https://get.docker.com | sh
fi
if command -v ufw >/dev/null && ! ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
fi
mkdir -p /opt/naex
# Nový kód, ale .env (heslo admina, doména) ostáva.
find /opt/naex -mindepth 1 -maxdepth 1 ! -name deploy -exec rm -rf {} +
find /opt/naex/deploy -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} + 2>/dev/null || true
tar -xzf /tmp/naex.tgz -C /opt/naex && rm /tmp/naex.tgz
cd /opt/naex/deploy
if [ ! -f .env ]; then
  printf 'DOMENA=%s\nNAEX_ADMIN_HESLO=%s\n' "$DOMENA" "$HESLO_NOVE" > .env
  chmod 600 .env
  echo "NOVE_HESLO"
fi
sed -i "s|^DOMENA=.*|DOMENA=$DOMENA|" .env
chmod +x zaloha.sh
( crontab -l 2>/dev/null | grep -v naex/deploy/zaloha.sh || true; echo "0 4 * * * /opt/naex/deploy/zaloha.sh" ) | crontab -
# Caddyfile je v kontajneri pripojený ako súbor: nový obsah na disku Caddy neuvidí, kým kontajner
# nevznikne nanovo. Rozhoduje preto ten, s ktorým Caddy naozaj beží, nie predošlý na disku
# (2026-11-02 tak ostal bežať starý — disk už mal nový z predošlého behu). </dev/null: exec by inak
# zjedol zvyšok tohto skriptu zo stdin.
CADDY_BEZI=\$(docker compose exec -T caddy sha256sum /etc/caddy/Caddyfile </dev/null 2>/dev/null | cut -d' ' -f1 || true)
CADDY_NOVY=\$(sha256sum Caddyfile | cut -d' ' -f1)
if [ "\$CADDY_BEZI" != "\$CADDY_NOVY" ]; then
  docker compose run -T --rm --no-deps --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile </dev/null
fi
docker compose build
# Zväzok vytvorený staršou verziou obrazu patrí rootovi — server beží ako node.
docker compose run -T --rm --no-deps --user root --entrypoint chown naex -R node:node /data </dev/null
docker compose up -d
[ "\$CADDY_BEZI" = "\$CADDY_NOVY" ] || docker compose up -d --no-deps --force-recreate caddy
docker image prune -f >/dev/null
SKRIPT

# Kópia nastavení servera (heslo admina) sem, mimo gitu — vždy tá platná.
{ echo "IP=$IP"; echo "NAEX_ADMIN_LOGIN=Admin"; "${SSH[@]}" "sudo cat /opt/naex/deploy/.env"; } > deploy/.env.produkcia
echo "Heslo admina je v deploy/.env.produkcia (mimo gitu)."

echo "Čakám na HTTPS…"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "https://$DOMENA/api/ja"; then
    echo "Hra beží: https://$DOMENA"
    exit 0
  fi
  sleep 5
done
echo "HTTPS ešte neodpovedá — pozri: ssh -i $KLUC $CIEL 'cd /opt/naex/deploy && sudo docker compose logs --tail 80'"
exit 1
