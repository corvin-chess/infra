#!/usr/bin/env bash
# CV-122: best-effort Redis RDB snapshot from the Compose redis service.
# Redis holds ephemeral live game / lobby / presence state. Durable finished
# games and accounts live in Postgres (use backup-postgres.sh). Mid-game
# Redis loss recovery for correspondence is Planned (CV-180). Compose runs
# Redis with AOF; restoring RDB alone is not enough — see docs/restore-drill.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

SERVICE="${REDIS_SERVICE:-redis}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/corvin-redis-${STAMP}.rdb"
AOF_OUT="${BACKUP_DIR}/corvin-redis-${STAMP}.aof"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}" || true

wait_healthy() {
  local i
  for i in $(seq 1 36); do
    if docker compose ps 2>/dev/null | grep -qE "${SERVICE} .* \\(healthy\\)"; then
      return 0
    fi
    sleep 2
  done
  echo "error: Compose service '${SERVICE}' is not healthy. Start with: docker compose up -d ${SERVICE}" >&2
  return 1
}

wait_healthy

echo "Triggering Redis SAVE on ${SERVICE} (best-effort; Postgres remains source of truth for durable data)"
docker compose exec -T "${SERVICE}" redis-cli SAVE >/dev/null
docker compose cp "${SERVICE}:/data/dump.rdb" "${OUT}"
chmod 600 "${OUT}" || true

# Copy AOF when present so operators can restore under appendonly yes.
if docker compose exec -T "${SERVICE}" test -f /data/appendonly.aof; then
  docker compose cp "${SERVICE}:/data/appendonly.aof" "${AOF_OUT}"
  chmod 600 "${AOF_OUT}" || true
  echo "OK: also wrote ${AOF_OUT}"
fi

if [[ ! -s "${OUT}" ]]; then
  echo "error: copied dump.rdb is empty" >&2
  rm -f "${OUT}"
  exit 1
fi

echo "OK: wrote ${OUT} ($(wc -c < "${OUT}" | tr -d ' ') bytes)"
echo "${OUT}"
