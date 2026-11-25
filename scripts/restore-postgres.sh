#!/usr/bin/env bash
# CV-122: restore a custom-format dump produced by backup-postgres.sh into
# the Compose postgres service. Destructive: pg_restore --clean --if-exists
# drops and recreates objects. Stop writers first (see docs/restore-drill.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <path-to-corvin-postgres-*.dump>" >&2
  exit 2
fi

DUMP="$1"
if [[ ! -f "${DUMP}" ]]; then
  echo "error: dump not found: ${DUMP}" >&2
  exit 1
fi

SERVICE="${POSTGRES_SERVICE:-postgres}"
USER_NAME="${POSTGRES_USER:-corvin}"
DB_NAME="${POSTGRES_DB:-corvin}"

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

if ! head -c 5 "${DUMP}" | grep -q PGDMP; then
  echo "error: file does not look like a pg_dump custom-format dump: ${DUMP}" >&2
  exit 1
fi

# Refuse restore while non-idle backends are connected (aside from this session).
BACKENDS="$(docker compose exec -T "${SERVICE}" \
  psql -U "${USER_NAME}" -d "${DB_NAME}" -At -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle';")"
BACKENDS="$(echo "${BACKENDS}" | tr -d '[:space:]')"
if [[ "${BACKENDS}" != "0" ]]; then
  echo "error: ${BACKENDS} non-idle connection(s) on ${DB_NAME}; stop server/web writers first" >&2
  exit 1
fi

echo "Restoring ${DUMP} into ${SERVICE}/${DB_NAME} (clean; destructive)"
# --exit-on-error: any restore error is fatal (no half-applied schema + ignored rc).
docker compose exec -T "${SERVICE}" \
  pg_restore -U "${USER_NAME}" -d "${DB_NAME}" \
  --clean --if-exists --no-owner --no-acl --exit-on-error \
  < "${DUMP}"

docker compose exec -T "${SERVICE}" \
  psql -U "${USER_NAME}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
  -c "SELECT 1;" >/dev/null

echo "OK: restore finished for ${DB_NAME}"
