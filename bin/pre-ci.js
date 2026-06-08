// Runs the local PR CI gates ("run what CI runs") so contributors can catch
// failures before pushing. The gate list and its parity with the workflow are
// defined in bin/ci-gates.js and enforced by bin/check-ci-gates.js.
//
//   pnpm pre-ci            full parity with CI's `--all` targets (slower)
//   pnpm pre-ci:affected   only what your diff touches (faster inner loop)
//
// Affected mode runs the nx/vitest affected variants and skips the codegen
// freshness checks unless the diff plausibly changes generated output.
import {execSync} from 'node:child_process'

import {PRE_CI_GATES, CI_ONLY_GATES} from './ci-gates.js'

const affected = process.argv.includes('--affected')

// Changed files vs the merge-base with origin/main, plus the working tree.
// Returns null if detection fails, so callers can fail safe (assume relevant).
function changedFiles() {
  try {
    const base = execSync('git merge-base HEAD origin/main', {encoding: 'utf8'}).trim()
    const committed = execSync(`git diff --name-only ${base}...HEAD`, {encoding: 'utf8'})
    const working = execSync('git status --porcelain', {encoding: 'utf8'})
    const files = new Set()
    for (const line of committed.split('\n')) if (line.trim()) files.add(line.trim())
    for (const line of working.split('\n')) if (line.slice(3).trim()) files.add(line.slice(3).trim())
    return [...files]
  } catch {
    return null
  }
}

function touchesGeneratedOutput(files) {
  if (files === null) return true
  return files.some(
    (file) => file.includes('/commands/') || file.endsWith('.graphql') || /graphql/i.test(file) || file.startsWith('docs-shopify.dev/'),
  )
}

const diff = affected ? changedFiles() : null
const codegenRelevant = affected ? touchesGeneratedOutput(diff) : true

const steps = [{label: 'CI gate manifest in sync', command: 'pnpm check-ci-gates'}]
const skipped = []
for (const gate of PRE_CI_GATES) {
  if (affected && gate.affectedWhen === 'codegen' && !codegenRelevant) {
    skipped.push({job: gate.job, reason: 'affected mode: diff does not touch commands, flags, or GraphQL'})
    continue
  }
  const command = affected ? gate.affected ?? gate.command : gate.command
  steps.push({label: affected ? `${gate.job} (affected)` : gate.job, command})
}

const results = []
for (const step of steps) {
  process.stdout.write(`\n\u25b6 ${step.label}: ${step.command}\n`)
  try {
    execSync(step.command, {stdio: 'inherit'})
    results.push({...step, ok: true})
  } catch {
    results.push({...step, ok: false})
  }
}

console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 pre-ci${affected ? ' (affected)' : ''} summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
for (const result of results) console.log(`${result.ok ? '\u2713' : '\u2717'} ${result.label}`)
for (const gate of skipped) console.log(`\u00b7 ${gate.job} \u2014 skipped (${gate.reason})`)

if (affected) {
  console.log('\nAffected mode is a fast pre-push check, not full CI parity. Run `pnpm pre-ci` before a high-risk push.')
  if (skipped.length > 0) {
    console.log('If you changed commands, flags, or GraphQL queries, run `pnpm codegen` and commit the result.')
  }
}

console.log('\nNot run locally (CI-only):')
for (const gate of CI_ONLY_GATES) console.log(`\u00b7 ${gate.job} \u2014 ${gate.reason}`)

const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
  console.error(`\npre-ci failed: ${failed.map((result) => result.label).join(', ')}`)
  process.exit(1)
}
console.log('\npre-ci passed. Codegen checks regenerate files — review `git status` for uncommitted generated changes.')
