#!/usr/bin/env node
/**
 * CV-120/CV-199: assert Docker Compose stack files name the four required
 * services, wire real server/web build contexts, keep secrets out of git, and
 * document the one-command start. Structural checks only; CI also runs compose.
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

if (!/SERVER_BUILD_CONTEXT/i.test(compose) || !/\.\.\/server/i.test(compose)) {
  fail("server must build from SERVER_BUILD_CONTEXT with ../server default")
} else {
  ok("server build context is SERVER_BUILD_CONTEXT/../server")
}

if (!/WEB_BUILD_CONTEXT/i.test(compose) || !/\.\.\/web/i.test(compose)) {
  fail("web must build from WEB_BUILD_CONTEXT with ../web default")
} else {
  ok("web build context is WEB_BUILD_CONTEXT/../web")
}

if (/context:\s*\.\/docker\/(server|web)/i.test(compose)) {
  fail("compose must not build interim ./docker stubs (CV-199 uses real images)")
} else {
  ok("no interim ./docker stub contexts")
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

if (!/CORVIN_RP_ORIGIN/i.test(compose)) {
  fail("server must receive CORVIN_RP_ORIGIN for passkey/cookie origin")
} else {
  ok("CORVIN_RP_ORIGIN present")
}

if (!/PORT:\s*"3000"/i.test(compose) || !/127\.0\.0\.1:3000\/health/i.test(compose)) {
  fail("server must set PORT 3000 and healthcheck that port")
} else {
  ok("server port 3000 wiring present")
}

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
  if (!/CORVIN_RP_ORIGIN=/i.test(envExample)) {
    fail(".env.example must document CORVIN_RP_ORIGIN")
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
  if (!/\|\s*M1 play stack\s*\|\s*Built\s*\|/i.test(readme)) {
    fail('STATUS must mark "M1 play stack" as Built')
  } else {
    ok("STATUS marks M1 play stack Built")
  }
  if (/interim stub|placeholder|stand-?in/i.test(readme)) {
    fail("README must not claim interim server/web stubs after CV-199")
  } else {
    ok("README no longer claims interim stubs")
  }
  if (!/SERVER_BUILD_CONTEXT|sibling/i.test(readme)) {
    fail("README must document SERVER_BUILD_CONTEXT / sibling checkouts")
  } else {
    ok("README documents build contexts")
  }
}

const walkTexts = [compose]
if (existsSync(envExamplePath)) walkTexts.push(readFileSync(envExamplePath, "utf8"))
for (const text of walkTexts) {
  if (/fair.?play.*(threshold|weight|model)/i.test(text)) {
    fail("fair-play private config wording found in compose artifacts")
  }
}
if (!process.exitCode) ok("no fair-play private config in compose artifacts")

const dockerRoot = join(repoRoot, "docker")
if (existsSync(dockerRoot)) {
  fail("docker/ stub tree must be removed after CV-199 (real images live in server/web)")
} else {
  ok("no leftover docker/ stub tree")
}

if (!process.exitCode) {
  console.log("All CV-199 compose checks passed.")
}
