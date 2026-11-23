#!/usr/bin/env node
/**
 * CV-027/CV-120: assert infra README matches README_STYLE repository template rules.
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")
const workspaceRoot = resolve(repoRoot, "..")
const readmePath = join(repoRoot, "README.md")
const licensePath = join(repoRoot, "LICENSE")
const stylePath = join(workspaceRoot, "README_STYLE.md")
const reposPath = join(workspaceRoot, "REPOS.md")
const composePath = join(repoRoot, "compose.yaml")

const REPO = "infra"
const SKILL = "docker"
const LICENSE_ID = "AGPL-3.0-or-later"
const CLOSING =
  "One compose command should stand up the whole board, and every backup must prove it can return."

const PLANNED_AREAS =
  /^(Observability profile|Backup and restore|Load tests|Implementation)$/i

const BUILT_AREAS =
  /^(README|LICENSE|CI verify gate|Docker Compose stack)$/i

const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}

const ok = (msg) => console.log(`OK: ${msg}`)

if (!existsSync(readmePath)) {
  fail(`missing ${readmePath}`)
  process.exit(1)
}

const readme = readFileSync(readmePath, "utf8")

const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
if (emojiRe.test(readme)) {
  fail("emoji found in README")
} else {
  ok("no emoji")
}

const requiredSections = [
  "OVERVIEW",
  "GETTING+STARTED",
  "DEVELOPMENT",
  "TESTING",
  "ARCHITECTURE",
  "STATUS",
]
for (const section of requiredSections) {
  if (!readme.includes(`lines=${section}`)) {
    fail(`missing typing SVG section title: ${section}`)
  }
}
if (!process.exitCode) ok("required section typing titles present")

const sectionAlts = [
  "Overview",
  "Getting Started",
  "Development",
  "Testing",
  "Architecture",
  "Status",
]
for (const alt of sectionAlts) {
  if (!readme.includes(`alt="${alt}"`)) {
    fail(`missing section alt text: ${alt}`)
  }
}
if (!process.exitCode) ok("section alt texts present")

if (!readme.includes(`https://github.com/corvin-chess/${REPO}`)) {
  fail(`missing self link https://github.com/corvin-chess/${REPO}`)
} else {
  ok("self repository link present")
}

if (!readme.includes(`i=${SKILL}&theme=dark`)) {
  fail(`skill icon must be i=${SKILL}&theme=dark`)
} else {
  ok(`skill icon i=${SKILL} theme=dark`)
}

if (!readme.includes("i=github&theme=dark")) {
  fail("GitHub skill icon with theme=dark missing")
} else {
  ok("GitHub skill icon present")
}

const palette = ["0b0d12", "161b2b", "2f3d63", "8fa3d9", "c9a227", "e6e9f2"]
for (const hex of palette) {
  if (!readme.toLowerCase().includes(hex.toLowerCase())) {
    fail(`palette hex missing: ${hex}`)
  }
}
if (!process.exitCode) ok("DESIGN.md palette hexes present")

if (!readme.includes("capsule-render.vercel.app")) {
  fail("capsule-render header/footer missing")
} else {
  ok("capsule-render present")
}

if (!readme.includes("readme-typing-svg.demolab.com")) {
  fail("typing SVG missing")
} else {
  ok("typing SVG present")
}

const headerTypingMatch = readme.match(
  /readme-typing-svg\.demolab\.com\?[^"']*lines=([^"'&]+)/
)
if (!headerTypingMatch) {
  fail("could not parse header typing lines=")
} else {
  const linesParam = headerTypingMatch[1]
  if (/\s/.test(linesParam)) {
    fail("typing SVG lines= contains raw whitespace; encode spaces as +")
  }
  if (!linesParam.startsWith(`${REPO};`)) {
    fail(`typing SVG lines= must start with ${REPO};`)
  }
  ok(`typing SVG lines= encoded and starts with ${REPO};`)
}

if (!readme.includes(`<i>${CLOSING}</i>`)) {
  fail("closing sentence missing or altered")
} else {
  ok("closing sentence matches README_STYLE infra example")
}

if (!readme.includes(LICENSE_ID)) {
  fail(`license section must state ${LICENSE_ID}`)
} else {
  ok(`license named ${LICENSE_ID}`)
}

if (!/CC BY-SA 4\.0/i.test(readme)) {
  fail("README must note documentation licensed under CC BY-SA 4.0 per REPOS.md")
} else {
  ok("documentation CC BY-SA 4.0 noted")
}

const statusTableMatch = readme.match(
  /\|\s*Area\s*\|\s*State\s*\|[\s\S]*?(?=<img src="https:\/\/capsule-render)/
)
if (!statusTableMatch) {
  fail("STATUS table missing or malformed")
} else {
  const table = statusTableMatch[0]
  const stateCells = [...table.matchAll(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g)]
  let sawReadmeBuilt = false
  let sawLicenseBuilt = false
  let sawCiBuilt = false
  let sawComposeBuilt = false
  let sawImplPlanned = false
  for (const [, areaRaw, stateRaw] of stateCells) {
    const area = areaRaw.trim()
    const state = stateRaw.trim()
    if (/^area$/i.test(area) && /^state$/i.test(state)) continue
    if (/^-+$/.test(area)) continue
    if (!/^(Planned|Built)$/i.test(state)) {
      fail(`STATUS row "${area}" must be Planned or Built; got "${state}"`)
      continue
    }
    if (/^README$/i.test(area) && /^Built$/i.test(state)) {
      sawReadmeBuilt = true
    }
    if (/^LICENSE$/i.test(area) && /^Built$/i.test(state)) {
      sawLicenseBuilt = true
    }
    if (/^CI verify gate$/i.test(area) && /^Built$/i.test(state)) {
      sawCiBuilt = true
    }
    if (/^Docker Compose stack$/i.test(area) && /^Built$/i.test(state)) {
      sawComposeBuilt = true
    }
    if (BUILT_AREAS.test(area) && !/^Built$/i.test(state)) {
      fail(`STATUS row "${area}" must be Built; got "${state}"`)
    }
    if (PLANNED_AREAS.test(area) && !/^Planned$/i.test(state)) {
      fail(
        `STATUS row "${area}" must stay Planned until that area lands; got "${state}"`
      )
    }
    if (/^Implementation$/i.test(area) && /^Planned$/i.test(state)) {
      sawImplPlanned = true
    }
  }
  if (!sawReadmeBuilt) fail('STATUS must include "| README | Built |"')
  if (!sawLicenseBuilt) fail('STATUS must include "| LICENSE | Built |"')
  if (!sawCiBuilt) fail('STATUS must include "| CI verify gate | Built |"')
  if (!sawComposeBuilt) {
    fail('STATUS must include "| Docker Compose stack | Built |"')
  }
  if (!sawImplPlanned) fail('STATUS must include "| Implementation | Planned |"')
  if (!process.exitCode) ok("STATUS rows use Planned/Built correctly")
}

if (!existsSync(composePath)) {
  fail("compose.yaml missing; OVERVIEW must describe a real Compose stack")
} else {
  ok("compose.yaml present for Built Compose STATUS")
}

if (
  /No Compose files, observability stack, backup scripts, or load-test harness are in this repository yet/i.test(
    readme
  )
) {
  fail(
    "OVERVIEW must not claim Compose files are absent now that compose.yaml exists"
  )
} else {
  ok("OVERVIEW no longer claims Compose files are absent")
}

if (!/interim|stub|placeholder|stand-?in/i.test(readme)) {
  fail("OVERVIEW/GETTING STARTED must disclose interim server/web stubs")
} else {
  ok("interim server/web stubs disclosed")
}

if (!/docker compose up --build -d/i.test(readme)) {
  fail('GETTING STARTED must document "docker compose up --build -d"')
} else {
  ok("documented start command present")
}

if (!/self-host/i.test(readme) || !/observability/i.test(readme)) {
  fail("README must name self-hosting and observability")
} else {
  ok("self-hosting and observability named")
}

if (!/backup/i.test(readme) || !/load test/i.test(readme)) {
  fail("README must name backups and load tests")
} else {
  ok("backups and load tests named")
}

if (
  !readme.includes("https://github.com/corvin-chess/server") ||
  !readme.includes("https://github.com/corvin-chess/web")
) {
  fail("README must link server and web")
} else {
  ok("server and web linked")
}

const claimedBuilt =
  /\b(Shipped|Live at|users online|uptime|99\.9%|RPO|RTO|in production|\d+\s+nodes|\d+\s+req\/s)\b/i
if (claimedBuilt.test(readme)) {
  fail("unverified capacity, uptime, or production claims found")
} else {
  ok("no unverified capacity/uptime/production claims")
}

const forbiddenSources =
  /\b(Stockfish|Leela|lc0|Lichess|Chess\.com|Kubernetes|Terraform Cloud)\b/i
if (forbiddenSources.test(readme)) {
  fail("third-party or competitor name found; keep wording Corvin Compose-focused")
} else {
  ok("no third-party or competitor names")
}

const linkRe = /https:\/\/github\.com\/corvin-chess\/([A-Za-z0-9._-]+)/g
const linked = new Set()
let m
while ((m = linkRe.exec(readme)) !== null) {
  linked.add(m[1])
}

const knownRepos = new Set([
  "web",
  "server",
  "chess-core",
  "engine",
  "engine-train",
  "worker",
  "fairplay",
  "puzzles",
  "explorer",
  "broadcast",
  "design-system",
  "assets",
  "mobile",
  "sdk",
  "bots",
  "translations",
  "infra",
  "website",
  ".github",
])

for (const name of linked) {
  if (!knownRepos.has(name)) {
    fail(`link to unknown repo: ${name}`)
  }
}
if (!linked.has(REPO)) {
  fail(`missing link to ${REPO}`)
}
if (!process.exitCode) ok("all github.com/corvin-chess links are in REPOS set")

if (existsSync(reposPath)) {
  const reposDoc = readFileSync(reposPath, "utf8")
  if (!reposDoc.includes(`### ${REPO}`)) {
    fail(`REPOS.md missing ### ${REPO}`)
  } else {
    ok("REPOS.md documents infra")
  }
}

if (!existsSync(licensePath)) {
  fail("missing LICENSE")
} else {
  const license = readFileSync(licensePath, "utf8")
  if (!/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(license)) {
    fail("LICENSE must be GNU Affero General Public License")
  } else if (license.length < 30000) {
    fail("LICENSE looks truncated; expect full AGPL-3.0 text")
  } else {
    ok("LICENSE present with full AGPL-3.0 text")
  }
  if (emojiRe.test(license)) {
    fail("emoji found in LICENSE")
  }
}

if (existsSync(stylePath)) {
  const style = readFileSync(stylePath, "utf8")
  if (!style.includes("| infra | `docker` |")) {
    fail("README_STYLE skill table missing infra/docker")
  } else {
    ok("README_STYLE lists infra skill icon docker")
  }
  if (!style.includes(CLOSING)) {
    fail("README_STYLE missing infra closing sentence example")
  } else {
    ok("closing sentence listed in README_STYLE")
  }
}

const requiredHeaderBits = [
  'alt="Corvin"',
  `alt="${REPO}"`,
  "section=footer",
  "## License",
]
for (const bit of requiredHeaderBits) {
  if (!readme.includes(bit)) {
    fail(`missing required README fragment: ${bit}`)
  }
}
if (!process.exitCode) ok("header, footer, license heading present")

if (!process.exitCode) {
  console.log("All CV-120 infra README checks passed.")
}
