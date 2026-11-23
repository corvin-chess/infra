#!/usr/bin/env node
/**
 * CV-120: assert Docker Compose stack files exist, name the four required
 * services, keep secrets out of git, and document the one-command start.
 * Structural checks only here; CI also runs `docker compose up` smoke.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}
const ok = (msg) => console.log(`OK: ${msg}`)

const composePath = join(repoRoot, "compose.yaml")
const envExamplePath = join(repoRoot, ".env.example")
const envPath = join(repoRoot, ".env")
const gitignorePath = join(repoRoot, ".gitignore")
const readmePath = join(repoRoot, "README.md")
const serverDockerPath = join(repoRoot, "docker", "server", "Dockerfile")
const webDockerPath = join(repoRoot, "docker", "web", "Dockerfile")
const webIndexPath = join(repoRoot, "docker", "web", "index.html")
const serverNginxPath = join(repoRoot, "docker", "server", "default.conf")

const REQUIRED_SERVICES = ["postgres", "redis", "server", "web"]

if (!existsSync(composePath)) {
  fail("missing compose.yaml")
  process.exit(1)
}

const compose = readFileSync(composePath, "utf8")

if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(compose)) {
  fail("emoji found in compose.yaml")
} else {
  ok("compose.yaml has no emoji")
}

for (const name of REQUIRED_SERVICES) {
  // Compose keys are indented under `services:`; require exact service id.
  const re = new RegExp(`^\\s{2}${name}:\\s*$`, "m")
  if (!re.test(compose)) {
    fail(`compose.yaml missing service "${name}"`)
  }
}
if (!process.exitCode) ok("postgres, redis, server, web services present")

if (!/^\s{2}postgres:\s*$/m.test(compose) || !/image:\s*postgres:/i.test(compose)) {
  fail("postgres service must use an official postgres image tag")
} else {
  ok("postgres uses postgres image")
}

if (!/^\s{2}redis:\s*$/m.test(compose) || !/image:\s*redis:/i.test(compose)) {
  fail("redis service must use an official redis image tag")
} else {
  ok("redis uses redis image")
}

const healthcheckCount = (compose.match(/^\s+healthcheck:\s*$/gim) || []).length
if (healthcheckCount < REQUIRED_SERVICES.length) {
  fail(
    `expected at least ${REQUIRED_SERVICES.length} healthcheck blocks; found ${healthcheckCount}`
  )
} else {
  ok(`healthcheck blocks present (${healthcheckCount})`)
}

if (!/context:\s*\.\/docker\/server/i.test(compose)) {
  fail('server service must build from ./docker/server')
} else {
  ok("server builds from ./docker/server")
}

if (!/context:\s*\.\/docker\/web/i.test(compose)) {
  fail('web service must build from ./docker/web')
} else {
  ok("web builds from ./docker/web")
}

if (!/DATABASE_URL/i.test(compose)) {
  fail("server must receive DATABASE_URL")
} else {
  ok("DATABASE_URL present")
}

if (!/REDIS_URL/i.test(compose)) {
  fail("server must receive REDIS_URL")
} else {
  ok("REDIS_URL present")
}

// Reject committed production-looking secrets and private key material.
// Do not match YAML keys like POSTGRES_PASSWORD (substring "PASSWORD:").
const secretSmell =
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|aws_secret_access_key|xox[baprs]-|ghp_[A-Za-z0-9]{36,}/i
if (secretSmell.test(compose)) {
  fail("compose.yaml looks like it embeds a real secret")
} else {
  ok("compose.yaml has no embedded secret smell")
}

const passwordDefaults = [
  ...compose.matchAll(/POSTGRES_PASSWORD:-\s*([A-Za-z0-9_]+)/g),
].map((m) => m[1])
if (passwordDefaults.length === 0) {
  fail("compose.yaml must include a POSTGRES_PASSWORD:- default for local use")
}
for (const value of passwordDefaults) {
  if (!/^corvin_dev/i.test(value)) {
    fail(`Postgres password default must start with corvin_dev; got ${value}`)
  }
}
if (!process.exitCode) ok("password defaults are corvin_dev* local markers")

if (existsSync(envPath)) {
  fail(".env must not be committed; remove it from the working tree before merge")
} else {
  ok(".env is absent (not committed)")
}

if (!existsSync(envExamplePath)) {
  fail("missing .env.example")
} else {
  const envExample = readFileSync(envExamplePath, "utf8")
  if (!/POSTGRES_PASSWORD=/i.test(envExample)) {
    fail(".env.example must define POSTGRES_PASSWORD")
  }
  if (!/corvin_dev/i.test(envExample)) {
    fail(".env.example local defaults must be clearly labeled corvin_dev*")
  }
  if (secretSmell.test(envExample)) {
    fail(".env.example looks like a real secret")
  }
  if (!process.exitCode) ok(".env.example present with local-only defaults")
}

if (!existsSync(gitignorePath)) {
  fail("missing .gitignore")
} else {
  const gi = readFileSync(gitignorePath, "utf8")
  if (!/(^|\n)\.env(\n|$)/.test(gi) && !/(^|\n)\.env\s*$/m.test(gi)) {
    fail(".gitignore must ignore .env")
  } else {
    ok(".gitignore ignores .env")
  }
}

for (const [label, path] of [
  ["server Dockerfile", serverDockerPath],
  ["server nginx conf", serverNginxPath],
  ["web Dockerfile", webDockerPath],
  ["web index.html", webIndexPath],
]) {
  if (!existsSync(path)) {
    fail(`missing ${label}: ${path}`)
  }
}
if (!process.exitCode) ok("server and web stub Docker build contexts present")

if (existsSync(serverNginxPath)) {
  const conf = readFileSync(serverNginxPath, "utf8")
  if (!/location\s*=\s*\/health/i.test(conf) && !/location\s+\/health/i.test(conf)) {
    fail("server stub must expose /health")
  } else {
    ok("server stub exposes /health")
  }
}

if (existsSync(webIndexPath)) {
  const html = readFileSync(webIndexPath, "utf8")
  if (!/Corvin/i.test(html)) {
    fail("web stub index must name Corvin")
  }
  if (/Stockfish|Leela|lc0|Lichess|Chess\.com/i.test(html)) {
    fail("web stub must not name third-party chess products")
  }
  if (!process.exitCode) ok("web stub index is Corvin-branded")
}

if (!existsSync(readmePath)) {
  fail("missing README.md")
} else {
  const readme = readFileSync(readmePath, "utf8")
  if (!/docker compose up --build -d/i.test(readme)) {
    fail('README must document the start command "docker compose up --build -d"')
  } else {
    ok("README documents docker compose up --build -d")
  }
  if (!/\|\s*Docker Compose stack\s*\|\s*Built\s*\|/i.test(readme)) {
    fail('STATUS must mark "Docker Compose stack" as Built')
  } else {
    ok("STATUS marks Docker Compose stack Built")
  }
  // Honesty: stubs are not the Axum/Vite apps yet.
  if (!/stub|interim|placeholder|stand-?in/i.test(readme)) {
    fail("README must state that server/web images are interim stubs until those repos ship")
  } else {
    ok("README discloses interim server/web stubs")
  }
}

// Fair-play / private config must never appear in infra.
const walkTexts = [compose]
if (existsSync(envExamplePath)) walkTexts.push(readFileSync(envExamplePath, "utf8"))
for (const text of walkTexts) {
  if (/fair.?play.*(threshold|weight|model)/i.test(text)) {
    fail("fair-play private config wording found in compose artifacts")
  }
}
if (!process.exitCode) ok("no fair-play private config in compose artifacts")

// Ensure docker/ tree has no accidental .env or key files.
const dockerRoot = join(repoRoot, "docker")
if (existsSync(dockerRoot)) {
  const stack = [dockerRoot]
  while (stack.length) {
    const dir = stack.pop()
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) {
        stack.push(p)
        continue
      }
      if (/^\.env$/i.test(ent.name) || /\.pem$/i.test(ent.name) || /\.key$/i.test(ent.name)) {
        fail(`secret-like file must not ship under docker/: ${p}`)
      }
    }
  }
  if (!process.exitCode) ok("docker/ tree has no .env/.pem/.key files")
}

if (!process.exitCode) {
  console.log("All CV-120 compose checks passed.")
}
