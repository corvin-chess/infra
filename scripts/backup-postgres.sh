#!/usr/bin/env bash
# CV-122: dump durable Corvin Postgres data from the Compose postgres service.
# Custom format (-Fc) so restore-postgres.sh can use pg_restore --clean.
# Never commit dumps; backups/ is gitignored. Restrictive modes on dir/files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

SERVICE="${POSTGRES_SERVICE:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/corvin-postgres-${STAMP}.dump"

USER_NAME="${POSTGRES_USER:-corvin}"
DB_NAME="${POSTGRES_DB:-corvin}"

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

echo "Backing up ${SERVICE}/${DB_NAME} -> ${OUT}"
docker compose exec -T "${SERVICE}" \
  pg_dump -U "${USER_NAME}" -d "${DB_NAME}" -Fc --no-owner --no-acl \
  > "${OUT}"
chmod 600 "${OUT}" || true

# Integrity: custom-format magic + listable TOC (rejects truncated dumps).
if ! head -c 5 "${OUT}" | grep -q PGDMP; then
  echo "error: dump does not look like a pg_dump custom-format file" >&2
  rm -f "${OUT}"
  exit 1
fi
if ! docker compose exec -T "${SERVICE}" \
  pg_restore -l >/dev/null < "${OUT}"; then
  echo "error: pg_restore -l cannot list TOC; dump may be truncated" >&2
  rm -f "${OUT}"
  exit 1
fi

BYTES="$(wc -c < "${OUT}" | tr -d ' ')"
if [[ "${BYTES}" -lt 64 ]]; then
  echo "error: dump too small (${BYTES} bytes)" >&2
  rm -f "${OUT}"
  exit 1
fi

echo "OK: wrote ${OUT} (${BYTES} bytes)"
echo "${OUT}"
