<div align="center">

<a href="https://github.com/corvin-chess"><img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=0:0b0d12,55:161b2b,100:2f3d63&text=Corvin&fontColor=e6e9f2&fontSize=64&fontAlignY=45&animation=twinkling" alt="Corvin" width="100%" /></a>

<img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=500&size=16&color=8FA3D9&center=true&vCenter=true&width=560&height=34&duration=2800&pause=1200&lines=infra;Compose+stack:+Postgres,+Redis,+server+stub,+web+stub." alt="infra" />

<p>
  <a href="https://github.com/corvin-chess/infra"><img src="https://skillicons.dev/icons?i=docker&theme=dark" width="44" height="44" alt="infra" /></a>&nbsp;
  <a href="https://github.com/corvin-chess"><img src="https://skillicons.dev/icons?i=github&theme=dark" width="44" height="44" alt="GitHub" /></a>
</p>

</div>

<br/>

Self-hosting Compose stack for Corvin, with planned observability, backups, and load tests.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=OVERVIEW" alt="Overview" /></p>

This repository ships a Docker Compose stack that starts Postgres, Redis, an interim [server](https://github.com/corvin-chess/server) health stub, and an interim [web](https://github.com/corvin-chess/web) placeholder in one command. The stubs stand in until those repositories publish real deploy images. Observability Compose profile, backup and restore docs, and load-test harnesses remain Planned. No production secrets or fair-play private configuration live in this repository.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=GETTING+STARTED" alt="Getting Started" /></p>

Requires Docker Engine with Compose v2. Compose defaults work without a `.env` file; copy `.env.example` only when you need overrides.

```bash
docker compose up --build -d
```

Default ports bind to `127.0.0.1`: web `8080`, server `3000`, Postgres `5432`, Redis `6379`. Check the server stub with `curl -sf http://127.0.0.1:3000/health` and the web stub at `http://127.0.0.1:8080/`. Stop with `docker compose down`.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=DEVELOPMENT" alt="Development" /></p>

Edit `compose.yaml` and the stub contexts under `docker/server` and `docker/web`. Copy `.env.example` to `.env` for local overrides; never commit `.env`. Observability profile wiring, backup scripts, and load-test entrypoints will be documented when those files exist. Live deploys follow maintainer workflow when a deploy CLI is already authenticated.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=TESTING" alt="Testing" /></p>

Structural gates (no Docker required):

```bash
node scripts/verify-readme.mjs
node scripts/verify-compose.mjs
```

CI also runs `docker compose up --build -d`, waits for healthy services, and curls server `/health` and web `/`. Planned restore drills and load-test runs land in later tasks.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=ARCHITECTURE" alt="Architecture" /></p>

`compose.yaml` runs Postgres 16 and Redis 7 with durable volumes, plus interim nginx stubs for [server](https://github.com/corvin-chess/server) (`/health`) and [web](https://github.com/corvin-chess/web) (static placeholder). The server stub receives `DATABASE_URL` and `REDIS_URL` so wiring matches the intended Axum process. An optional observability profile, backup and restore scripts, and load-test harnesses are Planned. See organization ADRs and [website](https://github.com/corvin-chess/website) once docs are published.

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><img src="https://readme-typing-svg.demolab.com?font=IBM+Plex+Mono&weight=700&size=18&color=8FA3D9&center=true&vCenter=true&width=420&height=40&duration=1&pause=1000000&letterSpacing=6px&lines=STATUS" alt="Status" /></p>

| Area | State |
|---|---|
| README | Built |
| LICENSE | Built |
| CI verify gate | Built |
| Docker Compose stack | Built |
| Observability profile | Planned |
| Backup and restore | Planned |
| Load tests | Planned |
| Implementation | Planned |

<img src="https://capsule-render.vercel.app/api?type=rect&height=3&color=0:0b0d12,35:8fa3d9,70:c9a227,100:0b0d12" width="100%" alt="" />

<br/>

<p align="center"><sub><i>One compose command should stand up the whole board, and every backup must prove it can return.</i></sub></p>

## License

Scripts in this repository are licensed under AGPL-3.0-or-later. Documentation is licensed under CC BY-SA 4.0.

<img src="https://capsule-render.vercel.app/api?type=waving&section=footer&height=110&color=0:0b0d12,55:161b2b,100:2f3d63" alt="" width="100%" />
