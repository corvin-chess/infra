#!/usr/bin/env node
/**
 * CV-122: assert backup/restore scripts and restore-drill checklist exist
 * with safe defaults. Structural checks only; CI also runs backup-smoke.
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}
const ok = (msg) => console.log(`OK: ${msg}`)

const backupSh = join(repoRoot, "scripts", "backup-postgres.sh")
const restoreSh = join(repoRoot, "scripts", "restore-postgres.sh")
const redisSh = join(repoRoot, "scripts", "backup-redis.sh")
const drillPath = join(repoRoot, "docs", "restore-drill.md")
const gitignorePath = join(repoRoot, ".gitignore")
const readmePath = join(repoRoot, "README.md")
const envExamplePath = join(repoRoot, ".env.example")

const secretSmell =
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|aws_secret_access_key|xox[baprs]-|ghp_[A-Za-z0-9]{36,}/i
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

const requiredPaths = [
  ["scripts/backup-postgres.sh", backupSh],
  ["scripts/restore-postgres.sh", restoreSh],
  ["scripts/backup-redis.sh", redisSh],
  ["docs/restore-drill.md", drillPath],
]

for (const [label, path] of requiredPaths) {
  if (!existsSync(path)) {
    fail(`missing ${label}`)
  }
}
if (!process.exitCode) ok("backup/restore scripts and restore-drill doc present")

const readText = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")

if (!process.exitCode) {
  for (const [label, path] of requiredPaths) {
    const text = readText(path)
    if (emojiRe.test(text)) fail(`emoji found in ${label}`)
    if (secretSmell.test(text)) fail(`secret smell in ${label}`)
  }
  if (!process.exitCode) ok("no emoji or secret smell in backup artifacts")
}

if (!process.exitCode) {
  const backup = readText(backupSh)
  if (!backup.startsWith("#!/usr/bin/env bash")) {
    fail("backup-postgres.sh must start with #!/usr/bin/env bash")
  }
  if (!/set -euo pipefail/.test(backup)) {
    fail("backup-postgres.sh must set -euo pipefail")
  }
  if (!/pg_dump/.test(backup)) {
    fail("backup-postgres.sh must invoke pg_dump")
  }
  if (!/docker compose/.test(backup)) {
    fail("backup-postgres.sh must use docker compose")
  }
  if (!/backups\//.test(backup) && !/\$\{?BACKUP_DIR/.test(backup)) {
    fail("backup-postgres.sh must write under backups/ or BACKUP_DIR")
  }
  if (!/-Fc|--format=custom/.test(backup)) {
    fail("backup-postgres.sh must use custom format (-Fc)")
  }
  if (!/pg_restore\s+-l|pg_restore -l/.test(backup)) {
    fail("backup-postgres.sh must verify dump TOC with pg_restore -l")
  }
  if (!/chmod 600/.test(backup)) {
    fail("backup-postgres.sh must chmod 600 dump files")
  }
  if (!/healthy/.test(backup)) {
    fail("backup-postgres.sh must wait for healthy postgres")
  }
  if (!process.exitCode) ok("backup-postgres.sh shape")
}

if (!process.exitCode) {
  const restore = readText(restoreSh)
  if (!restore.startsWith("#!/usr/bin/env bash")) {
    fail("restore-postgres.sh must start with #!/usr/bin/env bash")
  }
  if (!/set -euo pipefail/.test(restore)) {
    fail("restore-postgres.sh must set -euo pipefail")
  }
  if (!/pg_restore/.test(restore)) {
    fail("restore-postgres.sh must invoke pg_restore")
  }
  if (!/docker compose/.test(restore)) {
    fail("restore-postgres.sh must use docker compose")
  }
  if (!/--clean|--if-exists|-c\b/.test(restore)) {
    fail("restore-postgres.sh must use clean/if-exists restore flags")
  }
  if (!/--exit-on-error/.test(restore)) {
    fail("restore-postgres.sh must use --exit-on-error")
  }
  if (!/non-idle|pg_stat_activity/.test(restore)) {
    fail("restore-postgres.sh must refuse non-idle backends")
  }
  if (!process.exitCode) ok("restore-postgres.sh shape")
}

if (!process.exitCode) {
  const redis = readText(redisSh)
  if (!redis.startsWith("#!/usr/bin/env bash")) {
    fail("backup-redis.sh must start with #!/usr/bin/env bash")
  }
  if (!/BGSAVE|SAVE|redis-cli/.test(redis)) {
    fail("backup-redis.sh must trigger Redis SAVE/BGSAVE via redis-cli")
  }
  if (!/best-effort|ephemeral|Postgres/i.test(redis)) {
    fail("backup-redis.sh must note Redis is best-effort vs Postgres durability")
  }
  if (!/appendonly\.aof|AOF/i.test(redis)) {
    fail("backup-redis.sh must mention or copy AOF for Compose appendonly")
  }
  if (!process.exitCode) ok("backup-redis.sh shape")
}

if (!process.exitCode) {
  const drill = readText(drillPath)
  const requiredHeadings = [
    /#\s+Restore drill checklist/i,
    /##\s+Scope/i,
    /##\s+Prerequisites/i,
    /##\s+Backup/i,
    /##\s+Restore/i,
    /##\s+Verification/i,
    /##\s+Measured targets/i,
  ]
  for (const re of requiredHeadings) {
    if (!re.test(drill)) {
      fail(`restore-drill.md missing section matching ${re}`)
    }
  }
  if (!/CV-431/.test(drill)) {
    fail("restore-drill.md must point measured RPO/RTO to CV-431")
  }
  if (!/pg_dump|backup-postgres\.sh/i.test(drill)) {
    fail("restore-drill.md must reference the Postgres backup script")
  }
  if (!/fair-play|fair play/i.test(drill)) {
    fail("restore-drill.md must remind operators not to restore fair-play secrets from git")
  }
  if (!/appendonly|--clean|destructive/i.test(drill)) {
    fail("restore-drill.md must document destructive restore and Redis AOF")
  }
  if (!process.exitCode) ok("restore-drill.md checklist sections present")
}

const ciPath = join(repoRoot, ".github", "workflows", "ci.yml")
if (!existsSync(ciPath)) {
  fail("missing .github/workflows/ci.yml")
} else {
  const ci = readText(ciPath)
  if (!/^ {2}backup-smoke:/m.test(ci)) {
    fail("ci.yml must define backup-smoke job")
  }
  if (!/restore-postgres\.sh/.test(ci) || !/backup-postgres\.sh/.test(ci)) {
    fail("backup-smoke must invoke backup and restore scripts")
  }
  if (!/cv-122-marker/.test(ci)) {
    fail("backup-smoke must assert restored marker")
  }
  if (!process.exitCode) ok("ci.yml backup-smoke job wired")
}

if (!existsSync(gitignorePath)) {
  fail("missing .gitignore")
} else {
  const gi = readText(gitignorePath)
  if (!/^backups\/?$/m.test(gi) && !/^\/backups\/?$/m.test(gi)) {
    fail(".gitignore must ignore backups/")
  }
  if (!/\*\.dump/.test(gi) || !/\*\.rdb/.test(gi)) {
    fail(".gitignore must ignore *.dump and *.rdb")
  } else {
    ok(".gitignore ignores backups/ and dump extensions")
  }
}

if (!existsSync(readmePath)) {
  fail("missing README.md")
} else {
  const readme = readText(readmePath)
  if (!/\|\s*Backup and restore\s*\|\s*Built\s*\|/i.test(readme)) {
    fail('README STATUS must include "| Backup and restore | Built |"')
  } else {
    ok("README STATUS Backup and restore Built")
  }
  if (!/backup-postgres\.sh|restore-drill/i.test(readme)) {
    fail("README must document backup script or restore-drill path")
  } else {
    ok("README documents backup/restore paths")
  }
  if (/\b(RPO|RTO)\b/.test(readme)) {
    fail("README must not claim RPO/RTO numbers (CV-431)")
  } else {
    ok("README avoids RPO/RTO claims")
  }
}

if (existsSync(envExamplePath)) {
  const envEx = readText(envExamplePath)
  if (secretSmell.test(envEx)) fail("secret smell in .env.example")
  if (!/BACKUP_DIR|backup/i.test(envEx)) {
    // optional; backup scripts may use defaults only
    ok(".env.example present (BACKUP_DIR optional)")
  } else {
    ok(".env.example documents backup vars")
  }
}

if (!process.exitCode) {
  console.log("All CV-122 backup/restore checks passed.")
}
