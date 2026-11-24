#!/usr/bin/env node
/**
 * CV-199: structural gate for M1 exit (Compose play + ratings assert scripts).
 * Live two-browser proof runs in CI job `m1-exit` (Docker required).
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

const assertRatings = join(repoRoot, "scripts", "assert-ratings.mjs")
const ciPath = join(repoRoot, ".github", "workflows", "ci.yml")
const composePath = join(repoRoot, "compose.yaml")

if (!existsSync(assertRatings)) {
  fail("missing scripts/assert-ratings.mjs")
} else {
  const body = readFileSync(assertRatings, "utf8")
  if (!/rating_updates/i.test(body)) {
    fail("assert-ratings must query rating_updates")
  }
  if (!/FROM ratings/i.test(body) && !/from ratings/i.test(body)) {
    fail("assert-ratings must query ratings")
  }
  if (!/DATABASE_URL/i.test(body)) {
    fail("assert-ratings must require DATABASE_URL")
  }
  if (!process.exitCode) ok("assert-ratings.mjs present")
}

if (!existsSync(ciPath)) {
  fail("missing .github/workflows/ci.yml")
} else {
  const ci = readFileSync(ciPath, "utf8")
  if (!/^\s*compose-smoke\s*:/m.test(ci)) {
    fail("CI must define job compose-smoke (includes M1 rated proof)")
  }
  if (!/CORVIN_E2E_MANAGED_WEBSERVER/i.test(ci)) {
    fail("compose-smoke must set CORVIN_E2E_MANAGED_WEBSERVER for Compose web")
  }
  if (!/assert-ratings\.mjs/i.test(ci)) {
    fail("compose-smoke must run assert-ratings.mjs")
  }
  if (!/playwright/i.test(ci)) {
    fail("compose-smoke must run Playwright")
  }
  if (!/SERVER_BUILD_CONTEXT/i.test(ci) || !/WEB_BUILD_CONTEXT/i.test(ci)) {
    fail("compose-smoke must set SERVER_BUILD_CONTEXT and WEB_BUILD_CONTEXT")
  }
  if (!/\(healthy\)/.test(ci)) {
    fail('compose-smoke wait must match "(healthy)" so unhealthy cannot pass')
  }
  if (!process.exitCode) ok("CI compose-smoke M1 exit job wired")
}

if (!existsSync(composePath)) {
  fail("missing compose.yaml")
} else {
  const compose = readFileSync(composePath, "utf8")
  if (!/CORVIN_RP_ORIGIN/i.test(compose)) {
    fail("compose must set CORVIN_RP_ORIGIN for web origin")
  }
  ok("compose has play origin env")
}

if (!process.exitCode) {
  console.log("All CV-199 M1 exit structural checks passed.")
}
