// Drift guard: fails if the local CI-gate manifest (bin/ci-gates.js) falls out of
// sync with .github/workflows/tests-pr.yml, or if the pinned tool versions in
// dev.yml and tests-pr.yml disagree. Runs in CI (ci-gate-sync job) and locally
// (pnpm check-ci-gates, also invoked by pre-ci).
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

import {MANIFEST_JOB_IDS} from './ci-gates.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const problems = []

// 1. Workflow job ids must exactly match the manifest job ids.
const workflow = read('.github/workflows/tests-pr.yml')
const jobsSection = workflow.slice(workflow.search(/^jobs:/m))
const workflowJobIds = [...jobsSection.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((match) => match[1])

const manifestSet = new Set(MANIFEST_JOB_IDS)
const workflowSet = new Set(workflowJobIds)
const missingFromManifest = workflowJobIds.filter((id) => !manifestSet.has(id))
const staleInManifest = MANIFEST_JOB_IDS.filter((id) => !workflowSet.has(id))

if (missingFromManifest.length > 0) {
  problems.push(
    `Workflow jobs not classified in bin/ci-gates.js: ${missingFromManifest.join(', ')}.\n` +
      `  Add each to CI_GATES as a 'pre-ci' gate (with a local command) or 'ci-only' (with a reason).`,
  )
}
if (staleInManifest.length > 0) {
  problems.push(
    `bin/ci-gates.js lists jobs absent from tests-pr.yml: ${staleInManifest.join(', ')}.\n` +
      `  Remove them or fix the job id.`,
  )
}

// 2. Pinned tool versions must agree between dev.yml and tests-pr.yml.
const devYml = read('dev.yml')
const pick = (source, regex, label) => {
  const match = source.match(regex)
  if (!match) problems.push(`Could not parse ${label}.`)
  return match ? match[1] : null
}

const ciNode = pick(workflow, /DEFAULT_NODE_VERSION:\s*'([^']+)'/, 'DEFAULT_NODE_VERSION in tests-pr.yml')
const devNode = pick(devYml, /node:[\s\S]*?version:\s*([0-9][\w.-]*)/, 'node version in dev.yml')
const ciPnpm = pick(workflow, /PNPM_VERSION:\s*'([^']+)'/, 'PNPM_VERSION in tests-pr.yml')
const devPnpm = pick(devYml, /package_manager:\s*pnpm@([0-9][\w.-]*)/, 'pnpm version in dev.yml')

if (ciNode && devNode && ciNode !== devNode) {
  problems.push(`Node version mismatch: dev.yml ${devNode} vs tests-pr.yml DEFAULT_NODE_VERSION ${ciNode}.`)
}
if (ciPnpm && devPnpm && ciPnpm !== devPnpm) {
  problems.push(`pnpm version mismatch: dev.yml ${devPnpm} vs tests-pr.yml PNPM_VERSION ${ciPnpm}.`)
}

if (problems.length > 0) {
  console.error('CI gate manifest is out of sync with the workflow:\n')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log(`CI gate manifest in sync: ${workflowJobIds.length} workflow jobs classified; tool versions match (node ${ciNode}, pnpm ${ciPnpm}).`)
