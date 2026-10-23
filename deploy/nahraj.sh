#!/usr/bin/env bash
# Nahrá hru z tohto počítača na VPS a spustí ju (Docker + Caddy s HTTPS).
# Posiela pracovnú kópiu (aj necommitnuté zmeny) — GitHub netreba.
#
#   deploy/nahraj.sh <IP-servera> [používateľ] [doména]
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

IP="${1:?Použitie: deploy/nahraj.sh <IP-servera> [používateľ] [doména]}"
POUZIVATEL="${2:-ubuntu}"
DOMENA="${3:-$(echo "$IP" | tr . -).sslip.io}"
KLUC="${NAEX_SSH_KLUC:-$HOME/.ssh/naex_server}"
CIEL="$POUZIVATEL@$IP"
SSH=(ssh -i "$KLUC" -o StrictHostKeyChecking=accept-new "$CIEL")

cd "$(dirname "$0")/.."
# Archív aj výstup do jedného dočasného priečinka, ktorý trap zmaže vždy — aj pri chybe
# (predtým v %TEMP% ostával 50–60 MB naex.tgz po každom nasadení).
DOCASNY="$(mktemp -d)"
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
docker compose build
# Zväzok vytvorený staršou verziou obrazu patrí rootovi — server beží ako node.
docker compose run -T --rm --no-deps --user root --entrypoint chown naex -R node:node /data </dev/null
docker compose up -d
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
