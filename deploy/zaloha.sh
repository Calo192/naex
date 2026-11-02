#!/bin/sh
# Denná záloha databázy a nahraných súborov (spúšťaj z cronu na serveri):
#   0 4 * * * /opt/naex/deploy/zaloha.sh
# Uchováva posledných 14 záloh v /opt/naex-zalohy.
set -eu
CIEL=/opt/naex-zalohy
mkdir -p "$CIEL"
DATUM=$(date +%Y-%m-%d)
cd "$(dirname "$0")"
# Konzistentná kópia SQLite aj počas behu (VACUUM INTO), potom médiá.
docker compose exec -T naex node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/naex.sqlite').exec(\"VACUUM INTO '/data/zaloha.sqlite'\")"
docker compose cp naex:/data/zaloha.sqlite "$CIEL/naex-$DATUM.sqlite"
docker compose exec -T naex rm /data/zaloha.sqlite
docker compose exec -T naex tar -C /data -cf - media | gzip > "$CIEL/media-$DATUM.tar.gz"
ls -1t "$CIEL"/naex-*.sqlite | tail -n +15 | xargs -r rm
ls -1t "$CIEL"/media-*.tar.gz | tail -n +15 | xargs -r rm
# Zrejúca (pokusná, Michal 2026-11-02) má vlastnú databázu — partie a štatistiky testerov.
# Obrázky nemá (berie ich z Vypálenej), stačí databáza.
ZREJUCA=/opt/naex-zrejuca/deploy
if [ -f "$ZREJUCA/docker-compose.zrejuca.yml" ] && (cd "$ZREJUCA" && docker compose -f docker-compose.zrejuca.yml ps -q naex-zrejuca | grep -q .); then
  (
    cd "$ZREJUCA"
    docker compose -f docker-compose.zrejuca.yml exec -T naex-zrejuca node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/naex.sqlite').exec(\"VACUUM INTO '/data/zaloha.sqlite'\")"
    docker compose -f docker-compose.zrejuca.yml cp naex-zrejuca:/data/zaloha.sqlite "$CIEL/zrejuca-$DATUM.sqlite"
    docker compose -f docker-compose.zrejuca.yml exec -T naex-zrejuca rm /data/zaloha.sqlite
  )
  ls -1t "$CIEL"/zrejuca-*.sqlite | tail -n +15 | xargs -r rm
fi
