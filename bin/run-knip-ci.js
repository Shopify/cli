import {spawnSync} from 'node:child_process'

// Run knip with the JSON reporter so a successful run still emits structured
// output (e.g. {"files":[],"issues":[]}). An empty stdout therefore indicates
// knip did not actually analyze the codebase — a silent-pass mode previously
// observed — and must be treated as a failure to avoid false-green builds.
const knip = spawnSync('pnpm', ['--silent', 'knip', '--reporter', 'json'], {
  encoding: 'utf8',
})

if (knip.error) {
  console.error(`::error::failed to spawn knip: ${knip.error.message}`)
  process.exit(1)
}

let report
try {
  report = JSON.parse(knip.stdout)
} catch {
  console.error(
    `::error::knip exited ${knip.status} but produced no parseable JSON output. Failing CI to avoid a false green.`,
  )
  console.error('Raw stdout:')
  console.error(knip.stdout)
  console.error('Raw stderr:')
  console.error(knip.stderr)
  process.exit(1)
}

if (!Array.isArray(report.files) || !Array.isArray(report.issues)) {
  console.error('::error::knip output had unexpected shape')
  console.error(JSON.stringify(report))
  process.exit(1)
}

if (knip.status !== 0) {
  // Findings: re-run with the default reporter so the log is human-readable.
  spawnSync('pnpm', ['knip'], {stdio: 'inherit'})
}

process.exit(knip.status ?? 1)
