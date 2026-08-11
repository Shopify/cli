import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

// Classifies failed E2E shard jobs from the PR workflow into named failure
// modes and appends them to a durable dataset. Job logs expire after 90 days
// and run history after ~8 months; this dataset is what survives.
//
// Because the E2E job is continue-on-error, runs with failed shards still
// conclude as success, so we cannot filter for failed runs — every run's job
// list is scanned.
//
// Usage:
//   GITHUB_TOKEN=... node bin/e2e-failure-report.js --days 2 --data-dir .e2e-data
//   GITHUB_TOKEN=... node bin/e2e-failure-report.js --since 2026-05-15 --until 2026-05-22 --data-dir .e2e-data
//
// Data files (JSONL, idempotent — re-scans skip already-recorded IDs):
//   runs.jsonl     — one line per completed PR-workflow run (the denominator)
//   failures.jsonl — one line per failed E2E shard job, with matched modes
//   summary.md     — last-7-days mode table vs the prior 7 days

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const token = process.env.GITHUB_TOKEN
if (!token) {
  console.error('GITHUB_TOKEN is required')
  process.exit(1)
}
const repo = process.env.GITHUB_REPOSITORY ?? 'Shopify/cli'

const args = process.argv.slice(2)
const argValue = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const dataDir = argValue('--data-dir') ?? '.e2e-data'
const days = Number(argValue('--days') ?? 2)
const until = argValue('--until') ?? new Date().toISOString().slice(0, 10)
const since =
  argValue('--since') ?? new Date(new Date(until).getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const {modes: MODES} = JSON.parse(readFileSync(path.join(repoRoot, 'bin/e2e-failure-modes.json'), 'utf8'))
for (const mode of MODES) mode.regex = new RegExp(mode.pattern)

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function apiRequest(url, {raw = false} = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json'},
      redirect: 'manual',
    })
    // Log downloads redirect to blob storage; refetch without the auth header.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      const blob = await fetch(location)
      return raw ? blob.text() : blob.json()
    }
    if (response.status === 403 || response.status === 429) {
      const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000
      const waitMs = Math.min(Math.max(reset - Date.now(), 30_000), 15 * 60_000)
      console.error(`rate limited, waiting ${Math.round(waitMs / 1000)}s`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      continue
    }
    if (response.status === 404 || response.status === 410) return undefined
    if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
    return raw ? response.text() : response.json()
  }
  throw new Error(`${url} still rate limited after retries`)
}

async function listRunsForDay(day) {
  const runs = []
  for (let page = 1; page <= 10; page++) {
    const result = await apiRequest(
      `https://api.github.com/repos/${repo}/actions/workflows/tests-pr.yml/runs?created=${day}..${day}&per_page=100&page=${page}`,
    )
    runs.push(...(result?.workflow_runs ?? []))
    if (!result || result.workflow_runs.length < 100) break
  }
  return runs
}

async function listJobs(runId) {
  const jobs = []
  for (let page = 1; page <= 5; page++) {
    const result = await apiRequest(
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
    )
    jobs.push(...(result?.jobs ?? []))
    if (!result || result.jobs.length < 100) break
  }
  return jobs
}

// ---------------------------------------------------------------------------
// Classification and dataset
// ---------------------------------------------------------------------------

function classify(logText) {
  const matched = MODES.filter((mode) => mode.regex.test(logText)).map((mode) => mode.mode)
  if (matched.length === 0) {
    const firstError = logText.match(/^.*(Error:|error).*$/m)?.[0]?.slice(0, 200) ?? ''
    return {primary: 'unclassified', modes: [], firstError}
  }
  return {primary: matched[0], modes: matched}
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return []
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

mkdirSync(dataDir, {recursive: true})
const runsPath = path.join(dataDir, 'runs.jsonl')
const failuresPath = path.join(dataDir, 'failures.jsonl')
const seenRuns = new Set(readJsonl(runsPath).map((run) => run.runId))
const seenJobs = new Set(readJsonl(failuresPath).map((failure) => failure.jobId))

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const dayCursor = new Date(since)
const untilDate = new Date(until)
let scanned = 0
let newFailures = 0

while (dayCursor <= untilDate) {
  const day = dayCursor.toISOString().slice(0, 10)
  dayCursor.setDate(dayCursor.getDate() + 1)

  const runs = await listRunsForDay(day)
  console.error(`${day}: ${runs.length} runs`)

  for (const run of runs) {
    if (run.status !== 'completed' || seenRuns.has(run.id)) continue
    scanned++

    const jobs = await listJobs(run.id)
    const shardJobs = jobs.filter((job) => job.name.startsWith('E2E tests (shard'))
    const ranJobs = shardJobs.filter((job) => job.conclusion && job.conclusion !== 'skipped')
    const failedJobs = ranJobs.filter((job) => job.conclusion === 'failure')

    appendFileSync(
      runsPath,
      `${JSON.stringify({
        runId: run.id,
        createdAt: run.created_at,
        e2eRan: ranJobs.length > 0,
        shards: ranJobs.length,
        failedShards: failedJobs.length,
      })}\n`,
    )
    seenRuns.add(run.id)

    for (const job of failedJobs) {
      if (seenJobs.has(job.id)) continue
      const logText = await apiRequest(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`, {raw: true})
      const result = logText ? classify(logText) : {primary: 'log-unavailable', modes: []}
      appendFileSync(
        failuresPath,
        `${JSON.stringify({
          date: run.created_at.slice(0, 10),
          runId: run.id,
          jobId: job.id,
          shard: job.name,
          pr: run.pull_requests?.[0]?.number ?? null,
          primary: result.primary,
          modes: result.modes,
          firstError: result.firstError,
          url: job.html_url,
        })}\n`,
      )
      seenJobs.add(job.id)
      newFailures++
    }
  }
}

console.error(`scanned ${scanned} new runs, recorded ${newFailures} new failed shards`)

// ---------------------------------------------------------------------------
// Summary — last 7 days vs the 7 before, by primary mode
// ---------------------------------------------------------------------------

const now = Date.now()
const weekMs = 7 * 24 * 60 * 60 * 1000
const inWindow = (dateString, start, end) => {
  const time = new Date(dateString).getTime()
  return time >= start && time < end
}

const allRuns = readJsonl(runsPath)
const allFailures = readJsonl(failuresPath)

function windowStats(start, end) {
  const runs = allRuns.filter((run) => inWindow(run.createdAt, start, end) && run.e2eRan)
  const failures = allFailures.filter((failure) => inWindow(failure.date, start, end))
  const runsWithFailure = runs.filter((run) => run.failedShards > 0).length
  const modeCounts = {}
  for (const failure of failures) modeCounts[failure.primary] = (modeCounts[failure.primary] ?? 0) + 1
  return {runs: runs.length, runsWithFailure, failures: failures.length, modeCounts}
}

const thisWeek = windowStats(now - weekMs, now)
const lastWeek = windowStats(now - 2 * weekMs, now - weekMs)
const rate = (stats) => (stats.runs === 0 ? '—' : `${((stats.runsWithFailure / stats.runs) * 100).toFixed(1)}%`)

const allModeNames = [...new Set([...Object.keys(thisWeek.modeCounts), ...Object.keys(lastWeek.modeCounts)])].sort(
  (a, b) => (thisWeek.modeCounts[b] ?? 0) - (thisWeek.modeCounts[a] ?? 0),
)

const lines = [
  '# E2E failure report',
  '',
  `| | last 7 days | previous 7 days |`,
  `|---|---|---|`,
  `| Runs where E2E ran | ${thisWeek.runs} | ${lastWeek.runs} |`,
  `| Runs with a failed shard | ${thisWeek.runsWithFailure} (${rate(thisWeek)}) | ${lastWeek.runsWithFailure} (${rate(lastWeek)}) |`,
  `| Failed shard jobs | ${thisWeek.failures} | ${lastWeek.failures} |`,
  '',
  '## Failure modes (primary, per failed shard)',
  '',
  '| Mode | last 7 days | previous 7 days |',
  '|---|---|---|',
  ...allModeNames.map(
    (mode) => `| ${mode} | ${thisWeek.modeCounts[mode] ?? 0} | ${lastWeek.modeCounts[mode] ?? 0} |`,
  ),
  '',
  `_Window scanned this execution: ${since}..${until}. Unclassified failures carry a \`firstError\` snippet in failures.jsonl — name them in bin/e2e-failure-modes.json._`,
]

writeFileSync(path.join(dataDir, 'summary.md'), `${lines.join('\n')}\n`)
console.log(lines.join('\n'))
