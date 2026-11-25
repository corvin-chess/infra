#!/usr/bin/env node
/**
 * CV-121: assert optional Compose observability profile (ADR-015) is wired
 * so Grafana can load without requiring the profile on the default stack.
 * Structural checks only; CI also starts the profile and curls Grafana.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
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
const readmePath = join(repoRoot, "README.md")
const envExamplePath = join(repoRoot, ".env.example")
const obsRoot = join(repoRoot, "observability")

const REQUIRED_OBS_SERVICES = ["prometheus", "loki", "tempo", "grafana"]
const REQUIRED_FILES = [
  "prometheus/prometheus.yml",
  "loki/loki-config.yml",
  "tempo/tempo-config.yml",
  "grafana/provisioning/datasources/datasources.yml",
  "grafana/provisioning/dashboards/dashboards.yml",
  "grafana/dashboards/corvin-overview.json",
]

const secretSmell =
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|aws_secret_access_key|xox[baprs]-|ghp_[A-Za-z0-9]{36,}/i

if (!existsSync(composePath)) {
  fail("missing compose.yaml")
  process.exit(1)
}

const compose = readFileSync(composePath, "utf8").replace(/\r\n/g, "\n")

if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(compose)) {
  fail("emoji found in compose.yaml")
} else {
  ok("compose.yaml has no emoji")
}

const serviceBlock = (name) => {
  // Do not use `$` with the `m` flag: it matches end-of-line and empties the block.
  const re = new RegExp(
    `^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[A-Za-z0-9_]+:|^volumes:)`,
    "m"
  )
  const m = compose.match(re)
  return m ? m[1] : null
}

const hasObservabilityProfile = (block) =>
  /profiles:\s*\[\s*["']?observability["']?\s*\]/.test(block) ||
  /profiles:\s*\n(?:\s*-\s*["']?observability["']?\s*\n)+/.test(block)

for (const name of REQUIRED_OBS_SERVICES) {
  const block = serviceBlock(name)
  if (!block) {
    fail(`compose.yaml missing observability service "${name}"`)
    continue
  }
  if (!hasObservabilityProfile(block)) {
    fail(`service "${name}" must set profiles: [observability]`)
  }
}
if (!process.exitCode) {
  ok("prometheus, loki, tempo, grafana present with observability profile")
}

if (!/127\.0\.0\.1:\$\{GRAFANA_PORT:-3001\}:3000/.test(compose)) {
  fail("grafana must bind 127.0.0.1:${GRAFANA_PORT:-3001}:3000 (avoid server :3000)")
} else {
  ok("grafana host port defaults to 3001 on loopback")
}

if (
  !/GRAFANA_ADMIN_PASSWORD:-\s*corvin_dev/i.test(compose) &&
  !/GF_SECURITY_ADMIN_PASSWORD:-\s*corvin_dev/i.test(compose)
) {
  fail("grafana admin password default must be a corvin_dev* local marker")
} else {
  ok("grafana admin password uses corvin_dev* default")
}

const grafanaBlock = serviceBlock("grafana")
if (!grafanaBlock || !/healthcheck:/m.test(grafanaBlock)) {
  fail("grafana service block missing healthcheck")
} else if (!/\/api\/health/.test(grafanaBlock)) {
  fail("grafana healthcheck must hit /api/health")
} else {
  ok("grafana healthcheck present")
}

// Default stack services must not require the observability profile.
for (const core of ["postgres", "redis", "server", "web"]) {
  const block = serviceBlock(core)
  if (!block) {
    fail(`missing core service "${core}"`)
    continue
  }
  if (/profiles:/m.test(block)) {
    fail(`core service "${core}" must not set profiles (default stack stays tiny)`)
  }
}
if (!process.exitCode) ok("core play stack services stay profile-free")

if (secretSmell.test(compose)) {
  fail("compose.yaml looks like it embeds a real secret")
} else {
  ok("compose.yaml has no embedded secret smell")
}

if (!existsSync(obsRoot) || !statSync(obsRoot).isDirectory()) {
  fail("missing observability/ config directory")
  process.exit(1)
}

for (const rel of REQUIRED_FILES) {
  const full = join(obsRoot, rel)
  if (!existsSync(full)) {
    fail(`missing observability/${rel}`)
  }
}
if (!process.exitCode) ok("required observability config files present")

const walkCollect = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkCollect(full, out)
    else out.push(full)
  }
  return out
}

for (const file of walkCollect(obsRoot)) {
  const text = readFileSync(file, "utf8")
  if (secretSmell.test(text)) {
    fail(`secret smell in ${file}`)
  }
  if (/fair.?play.*(threshold|weight|model)/i.test(text)) {
    fail(`fair-play private config wording in ${file}`)
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) {
    fail(`emoji in ${file}`)
  }
}
if (!process.exitCode) ok("observability configs clean (no secrets/fair-play/emoji)")

const promYml = readFileSync(join(obsRoot, "prometheus/prometheus.yml"), "utf8")
if (!/job_name:\s*prometheus/i.test(promYml)) {
  fail("prometheus.yml must scrape prometheus itself")
} else {
  ok("prometheus self-scrape configured")
}

const dsYml = readFileSync(
  join(obsRoot, "grafana/provisioning/datasources/datasources.yml"),
  "utf8"
)
for (const name of ["Prometheus", "Loki", "Tempo"]) {
  if (!new RegExp(`name:\\s*${name}\\b`).test(dsYml)) {
    fail(`grafana datasources must provision ${name}`)
  }
}
if (!process.exitCode) ok("grafana provisions Prometheus, Loki, Tempo")

const dashJson = readFileSync(
  join(obsRoot, "grafana/dashboards/corvin-overview.json"),
  "utf8"
)
try {
  const dash = JSON.parse(dashJson)
  if (!dash.title || !/corvin/i.test(String(dash.title))) {
    fail("dashboard JSON title must mention Corvin")
  } else {
    ok(`dashboard title present: ${dash.title}`)
  }
} catch (err) {
  fail(`dashboard JSON parse failed: ${err.message}`)
}

if (!existsSync(envExamplePath)) {
  fail("missing .env.example")
} else {
  const envExample = readFileSync(envExamplePath, "utf8")
  if (!/GRAFANA_PORT=/i.test(envExample)) {
    fail(".env.example must document GRAFANA_PORT")
  }
  if (!/GF_SECURITY_ADMIN_PASSWORD=/i.test(envExample) && !/GRAFANA_ADMIN_PASSWORD=/i.test(envExample)) {
    fail(".env.example must document grafana admin password override")
  }
  if (!process.exitCode) ok(".env.example documents grafana overrides")
}

if (!existsSync(readmePath)) {
  fail("missing README.md")
} else {
  const readme = readFileSync(readmePath, "utf8")
  if (!/--profile observability/i.test(readme)) {
    fail('README must document "docker compose --profile observability"')
  } else {
    ok("README documents --profile observability")
  }
  if (!/127\.0\.0\.1:3001|GRAFANA_PORT/i.test(readme)) {
    fail("README must document Grafana on 3001 / GRAFANA_PORT")
  } else {
    ok("README documents Grafana port")
  }
  if (!/\|\s*Observability profile\s*\|\s*Built\s*\|/i.test(readme)) {
    fail('STATUS must mark "Observability profile" as Built')
  } else {
    ok("STATUS marks Observability profile Built")
  }
  if (/No end-user tracking|operational telemetry|ADR-015/i.test(readme) === false) {
    // soft: prefer privacy note; require at least "no" analytics claim or operational wording
    if (!/operational|no end-user|privacy/i.test(readme)) {
      fail("README should note operational-only telemetry (no end-user analytics)")
    } else {
      ok("README notes operational telemetry posture")
    }
  } else {
    ok("README notes operational telemetry posture")
  }
}

if (!process.exitCode) {
  console.log("All CV-121 observability checks passed.")
}
