// Runs the local subset of PR CI gates ("run what CI runs") so contributors can
// catch failures before pushing. The gate list and its parity with the workflow
// are defined in bin/ci-gates.js and enforced by bin/check-ci-gates.js.
//
// pre-ci mirrors CI's full (`--all`) targets so that green locally implies green
// in CI. It is intentionally slower than the affected-only `dev check`.
import {execSync} from 'node:child_process'

import {PRE_CI_GATES, CI_ONLY_GATES} from './ci-gates.js'

const steps = [
  {label: 'CI gate manifest in sync', command: 'pnpm check-ci-gates'},
  ...PRE_CI_GATES.map((gate) => ({label: gate.job, command: gate.command})),
]

const results = []
for (const step of steps) {
  process.stdout.write(`\n▶ ${step.label}: ${step.command}\n`)
  try {
    execSync(step.command, {stdio: 'inherit'})
    results.push({...step, ok: true})
  } catch {
    results.push({...step, ok: false})
  }
}

console.log('\n──────── pre-ci summary ────────')
for (const result of results) {
  console.log(`${result.ok ? '✓' : '✗'} ${result.label}`)
}

console.log('\nNot run locally (CI-only):')
for (const gate of CI_ONLY_GATES) {
  console.log(`· ${gate.job} — ${gate.reason}`)
}

const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
  console.error(`\npre-ci failed: ${failed.map((result) => result.label).join(', ')}`)
  process.exit(1)
}
console.log('\npre-ci passed. Note: codegen checks regenerate files — review `git status` for any uncommitted generated changes.')
