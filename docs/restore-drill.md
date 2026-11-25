# Restore drill checklist

Operator checklist for Corvin Compose self-host recovery. Scripts live in this repository under `scripts/`. Measured RPO and RTO targets are tracked in task **CV-431** — do not invent numbers here.

## Scope

| Store | Role | Backup script |
|---|---|---|
| Postgres | Durable accounts, sessions, ratings, finished games | `scripts/backup-postgres.sh` |
| Redis | Live games, lobby, presence (ephemeral) | `scripts/backup-redis.sh` (best-effort RDB + AOF copy) |

Finished games and ratings are recovered from Postgres. Live mid-game Redis state may be incomplete after a crash; periodic live flush to Postgres is Planned (CV-180). Never store fair-play private thresholds, weights, or models in this repository or in dumps committed to git — those load from private operator configuration only.

## Prerequisites

- [ ] Docker Engine with Compose v2
- [ ] This `infra` checkout with a healthy `postgres` service (`docker compose up -d postgres`)
- [ ] Write access to a local `backups/` directory (gitignored) or `BACKUP_DIR` (keep dumps out of git; prefer `*.dump` / `*.rdb` / `*.aof` ignored)
- [ ] Operator access to private env / fair-play config outside git (not restored from this repo)
- [ ] Sibling [server](https://github.com/corvin-chess/server) / [web](https://github.com/corvin-chess/web) checkouts if the full play stack must come back up

## Backup

1. [ ] Prefer stopping writers (`docker compose stop server web`) so the dump is logically consistent; or accept that a live dump is crash-consistent only.
2. [ ] Confirm Postgres is healthy: `docker compose ps` shows `postgres` `(healthy)`.
3. [ ] Run `bash scripts/backup-postgres.sh` and record the printed dump path (directory mode 700, dump mode 600 when the filesystem allows).
4. [ ] Optional: run `bash scripts/backup-redis.sh` for a best-effort RDB (+ AOF if present).
5. [ ] Copy dumps off the host to operator-controlled durable storage (not this git tree).
6. [ ] Confirm the Postgres dump starts with custom-format magic (`PGDMP`), `pg_restore -l` lists a TOC, and the file is non-empty.

## Restore

**Warning:** `bash scripts/restore-postgres.sh` runs `pg_restore --clean --if-exists`, which drops and recreates objects in the target database. Treat it as destructive.

1. [ ] Announce maintenance; stop writers (`docker compose stop server web`) so nothing writes during restore.
2. [ ] Keep `postgres` (and optionally `redis`) running and healthy.
3. [ ] Run `bash scripts/restore-postgres.sh backups/corvin-postgres-<stamp>.dump` with the chosen dump. The script refuses non-idle backends and verifies `SELECT 1` after restore.
4. [ ] Align the [server](https://github.com/corvin-chess/server) image / checkout with the dump age so migrate-on-start does not fight `_sqlx_migrations` in the dump (newer image may apply pending migrations; older image should not auto-downgrade).
5. [ ] Redis (only if an RDB/AOF backup exists and live loss is acceptable): `docker compose stop redis`; replace `/data/dump.rdb` **and** replace or remove `/data/appendonly.aof` (Compose runs Redis with `--appendonly yes`, so AOF wins on restart if left stale); `docker compose up -d redis`.
6. [ ] Start application services: `docker compose up -d server web` (migrate-on-start runs in the server image when appropriate).
7. [ ] Re-apply private env and fair-play config from the operator secret store (never from git).

## Verification

1. [ ] `curl -sf http://127.0.0.1:3000/health` returns `ok`.
2. [ ] Spot-check Postgres: `users`, `games`, `ratings`, and `rating_updates` row counts match pre-failure notes when available.
3. [ ] Log in with a known account (passkey or email OTP) and open `/play`.
4. [ ] Optional: load a finished game PGN via `GET /api/v1/games/{id}/pgn` and compare to a pre-drill sample.
5. [ ] Confirm Redis presence/lobby behavior for a fresh session (do not expect unrecovered mid-bullet positions).
6. [ ] Record wall-clock backup age and restore duration for **CV-431** measurement — leave blank until that drill runs.

## Measured targets

Product targets in `PROJECT_SPEC.md` (RPO ≤ 5 min for DB backups; RTO ≤ 30 min for a documented restore drill) are verified only by **CV-431** with owner sign-off. This checklist is the procedure; it does not claim those numbers have been measured yet.

## CI note

CI `backup-smoke` proves a Postgres custom-format dump/restore round-trip on a marker table (and a Redis SAVE copy). It does not replace a full-schema drill against a migrated server database — run this checklist on a stack that has applied [server](https://github.com/corvin-chess/server) migrations before relying on production recovery.
