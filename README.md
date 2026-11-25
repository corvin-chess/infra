<div align="center">

<a href="https://github.com/corvin-chess"><img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=0:0b0d12,55:161b2b,100:2f3d63&text=Corvin&fontColor=e6e9f2&fontSize=64&fontAlignY=45&animation=twinkling" alt="Corvin" width="100%" /></a>

<img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=500&size=16&color=8FA3D9&center=true&vCenter=true&width=560&height=34&duration=2800&pause=1200&lines=infra;Compose+stack:+Postgres,+Redis,+server,+web.;Backup+scripts+%2B+restore+drill+checklist." alt="infra" />

<p>
  <a href="https://github.com/corvin-chess/infra"><img src="https://skillicons.dev/icons?i=docker&theme=dark" width="44" height="44" alt="infra" /></a>&nbsp;
  <a href="https://github.com/corvin-chess"><img src="https://skillicons.dev/icons?i=github&theme=dark" width="44" height="44" alt="GitHub" /></a>
</p>

</div>

<br/>

Self-hosting Compose stack for Corvin, with an optional observability profile, Postgres/Redis backup scripts, a restore drill checklist, and planned load tests.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=OVERVIEW" alt="Overview" /></p>

This repository ships a Docker Compose stack that starts Postgres, Redis, the real [server](https://github.com/corvin-chess/server) Axum process, and the real [web](https://github.com/corvin-chess/web) play client in one command. Build contexts default to sibling checkouts `../server` and `../web` (override with `SERVER_BUILD_CONTEXT` / `WEB_BUILD_CONTEXT`). CI proves two browsers can finish a rated game on this stack with Glicko-2 rows stored. An optional Compose profile `observability` (ADR-015) starts Prometheus, Loki, Tempo, and Grafana for operational telemetry only (no end-user analytics). Operators back up durable Postgres with `scripts/backup-postgres.sh` and follow `docs/restore-drill.md`; Redis snapshots are best-effort via `scripts/backup-redis.sh`. Load-test harnesses remain Planned. No production secrets or fair-play private configuration live in this repository.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=GETTING+STARTED" alt="Getting Started" /></p>

Requires Docker Engine with Compose v2 and sibling clones of [server](https://github.com/corvin-chess/server) and [web](https://github.com/corvin-chess/web) next to this repository (or set `SERVER_BUILD_CONTEXT` / `WEB_BUILD_CONTEXT`). Compose defaults work without a `.env` file; copy `.env.example` only when you need overrides.

```bash
docker compose up --build -d
```

Default ports bind to `127.0.0.1`: web `8080`, server `3000`, Postgres `5432`, Redis `6379`. Open `http://127.0.0.1:8080/play`. Check the server with `curl -sf http://127.0.0.1:3000/health`. Stop with `docker compose down`.

Optional observability profile (Prometheus, Loki, Tempo, Grafana):

```bash
docker compose --profile observability up -d
```

Grafana listens on `http://127.0.0.1:3001` by default (`GRAFANA_PORT`). Default admin credentials are the `corvin_dev*` markers in `.env.example` (`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`); change them before any shared host. Confirm Grafana with `curl -sf http://127.0.0.1:3001/api/health`. Server OTel export into this stack is Planned.

Postgres backup (custom-format dump under gitignored `backups/`):

```bash
bash scripts/backup-postgres.sh
bash scripts/restore-postgres.sh backups/corvin-postgres-<stamp>.dump
```

Optional Redis RDB/AOF copy (best-effort; durable data is Postgres): `bash scripts/backup-redis.sh`. Full operator steps are in [`docs/restore-drill.md`](docs/restore-drill.md).

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=DEVELOPMENT" alt="Development" /></p>

Edit `compose.yaml`, configs under `observability/`, backup scripts under `scripts/`, and the Dockerfiles owned by [server](https://github.com/corvin-chess/server) and [web](https://github.com/corvin-chess/web). Copy `.env.example` to `.env` for local overrides; never commit `.env` or `backups/`. Load-test entrypoints remain Planned. Live deploys follow maintainer workflow when a deploy CLI is already authenticated.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=TESTING" alt="Testing" /></p>

Structural gates (no Docker required):

```bash
node scripts/verify-readme.mjs
node scripts/verify-compose.mjs
node scripts/verify-observability.mjs
node scripts/verify-backup.mjs
node scripts/verify-m1-exit.mjs
```

CI job `compose-smoke` builds the play stack from sibling checkouts, curls server `/health` and web `/play`, seeds sessions, runs Playwright rated blitz on `:8080`, and asserts Glicko-2 rows with `node scripts/assert-ratings.mjs`. CI job `observability-smoke` starts `docker compose --profile observability up -d` and curls Grafana `/api/health` until it reports database ok. CI job `backup-smoke` starts Postgres only, seeds a marker row, runs `backup-postgres.sh` / `restore-postgres.sh`, and asserts the marker returns. Measured recovery timing stays Planned (CV-431). Load-test runs land in later tasks.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=ARCHITECTURE" alt="Architecture" /></p>

`compose.yaml` runs Postgres 16 and Redis 7 with durable volumes, builds [server](https://github.com/corvin-chess/server) (migrate-on-start Axum on port 3000) and [web](https://github.com/corvin-chess/web) (nginx static play client proxying `/api` and `/ws` to the server). Profile `observability` adds Prometheus, Loki, Tempo, and Grafana with provisioning under `observability/` (committed Corvin overview dashboard). Postgres custom-format backup/restore scripts and `docs/restore-drill.md` cover durable recovery; Redis RDB copy is best-effort. Load-test harnesses are Planned. See organization ADRs and [website](https://github.com/corvin-chess/website) once docs are published.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=STATUS" alt="Status" /></p>

| Area | State |
|---|---|
| README | Built |
| LICENSE | Built |
| CI verify gate | Built |
| Docker Compose stack | Built |
| M1 play stack | Built |
| Observability profile | Built |
| Backup and restore | Built |
| Load tests | Planned |
| Implementation | Planned |

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><sub><i>One compose command should stand up the whole board, and every backup must prove it can return.</i></sub></p>

## License

Scripts in this repository are licensed under AGPL-3.0-or-later. Documentation is licensed under CC BY-SA 4.0.

<img src="https://capsule-render.vercel.app/api?type=waving&section=footer&height=110&color=0:0b0d12,55:161b2b,100:2f3d63" alt="" width="100%" />
