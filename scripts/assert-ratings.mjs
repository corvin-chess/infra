#!/usr/bin/env node
/**
 * CV-199: after a rated Compose game, require Postgres rating rows + one audit.
 * Fixed e2e user ids match web/scripts/e2e-seed.mjs / e2e/fixtures.ts.
 */
import { spawnSync } from "node:child_process"

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  console.error("FAIL: DATABASE_URL is required")
  process.exit(1)
}

const USER_A = "01HZXK0CV197AAA00000000001"
const USER_B = "01HZXK0CV197BBB00000000001"

const sql = `
SELECT
  (SELECT COUNT(*)::int FROM ratings
    WHERE user_id IN ('${USER_A}', '${USER_B}')) AS rating_rows,
  (SELECT COUNT(*)::int FROM rating_updates
    WHERE white_id IN ('${USER_A}', '${USER_B}')
       OR black_id IN ('${USER_A}', '${USER_B}')) AS update_rows;
`

const result = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", ",", "-c", sql],
  { encoding: "utf8" }
)
if (result.status !== 0) {
  console.error(result.stdout || "")
  console.error(result.stderr || "")
  console.error("FAIL: assert-ratings query")
  process.exit(result.status ?? 1)
}

const line = (result.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop()
if (!line) {
  console.error("FAIL: empty psql output")
  process.exit(1)
}

const [ratingRowsRaw, updateRowsRaw] = line.split(",")
const ratingRows = Number(ratingRowsRaw)
const updateRows = Number(updateRowsRaw)

if (!Number.isFinite(ratingRows) || ratingRows < 2) {
  console.error(`FAIL: expected >=2 ratings rows for e2e users; got ${ratingRowsRaw}`)
  process.exit(1)
}
if (!Number.isFinite(updateRows) || updateRows < 1) {
  console.error(`FAIL: expected >=1 rating_updates row; got ${updateRowsRaw}`)
  process.exit(1)
}

console.log(`OK: ratings=${ratingRows} rating_updates=${updateRows}`)
