// Drift guard: fails if the local CI-gate manifest (bin/ci-gates.js) falls out of
// sync with .github/workflows/tests-pr.yml, or if the pinned tool versions in
// dev.yml and tests-pr.yml disagree. Kept dependency-free (no YAML library) so the
// CI job can run on bare Node; the parsing below is hardened for the formats these
// two files actually use.
import {readFileSync} from 'node:fs'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join} from 'node:path'

import {MANIFEST_JOB_IDS} from './ci-gates.js'

// Job ids are the keys directly under `jobs:`. Bound the search to the jobs block
// (up to the next top-level key) and allow a trailing comment after the id. Job
// keys are always bare (their mapping is on following lines), so nested keys —
// indented deeper than 2 spaces — and `key: value` anchors are naturally excluded.
export function parseJobIds(workflowText) {
  const workflow = workflowText.replace(/\r\n/g, '\n')
  const jobsAt = workflow.search(/^jobs:/m)
  if (jobsAt === -1) return []
  const afterHeader = workflow.slice(jobsAt).replace(/^jobs:.*\n/, '')
  const nextTopLevel = afterHeader.search(/^\S/m)
  const block = nextTopLevel === -1 ? afterHeader : afterHeader.slice(0, nextTopLevel)
  return [...block.matchAll(/^ {2}([A-Za-z0-9_-]+):[ \t]*(?:#.*)?$/gm)].map((match) => match[1])
}

// Pure and testable: given the two YAML texts and the manifest job ids, return the
// list of human-readable problems (empty when everything is in sync).
export function findProblems({workflow: workflowText, devYml: devYmlText, manifestJobIds}) {
  const problems = []

  // Normalize line endings so the parsing below is robust to CRLF working trees.
  const workflow = workflowText.replace(/\r\n/g, '\n')
  const devYml = devYmlText.replace(/\r\n/g, '\n')

  const workflowJobIds = parseJobIds(workflow)
  const manifestSet = new Set(manifestJobIds)
  const workflowSet = new Set(workflowJobIds)
  const missingFromManifest = workflowJobIds.filter((id) => !manifestSet.has(id))
  const staleInManifest = manifestJobIds.filter((id) => !workflowSet.has(id))

  if (missingFromManifest.length > 0) {
    problems.push(
      `Workflow jobs not classified in bin/ci-gates.js: ${missingFromManifest.join(', ')}.\n` +
        `  Add each to CI_GATES as a 'pre-ci' gate (with a local command) or 'ci-only' (with a reason).`,
    )
  }
  if (staleInManifest.length > 0) {
    problems.push(`bin/ci-gates.js lists jobs absent from tests-pr.yml: ${staleInManifest.join(', ')}.`)
  }

  const pick = (source, regex, label) => {
    const match = source.match(regex)
    if (!match) problems.push(`Could not read ${label}.`)
    return match ? match[1] : undefined
  }
  const ciNode = pick(workflow, /DEFAULT_NODE_VERSION:\s*['"]?([0-9][\w.-]*)/, 'DEFAULT_NODE_VERSION from tests-pr.yml')
  const ciPnpm = pick(workflow, /PNPM_VERSION:\s*['"]?([0-9][\w.-]*)/, 'PNPM_VERSION from tests-pr.yml')
  // dev.yml pins these on the `version:`/`package_manager:` lines under the `node:` step.
  const devNode = pick(devYml, /node:\s*\n\s+version:\s*['"]?([0-9][\w.-]*)/, 'the node version from dev.yml')
  const devPnpm = pick(devYml, /package_manager:\s*['"]?pnpm@([0-9][\w.-]*)/, 'the pnpm version from dev.yml')

  if (ciNode && devNode && ciNode !== devNode) {
    problems.push(`Node version mismatch: dev.yml ${devNode} vs tests-pr.yml DEFAULT_NODE_VERSION ${ciNode}.`)
  }
  if (ciPnpm && devPnpm && ciPnpm !== devPnpm) {
    problems.push(`pnpm version mismatch: dev.yml ${devPnpm} vs tests-pr.yml PNPM_VERSION ${ciPnpm}.`)
  }

  return {problems, workflowJobIds, ciNode, ciPnpm}
}

// Run as a CLI when invoked directly (not when imported by a test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const read = (rel) => readFileSync(join(root, rel), 'utf8')

  const {problems, workflowJobIds, ciNode, ciPnpm} = findProblems({
    workflow: read('.github/workflows/tests-pr.yml'),
    devYml: read('dev.yml'),
    manifestJobIds: MANIFEST_JOB_IDS,
  })

  if (problems.length > 0) {
    console.error('CI gate manifest is out of sync with the workflow:\n')
    for (const problem of problems) console.error(`- ${problem}`)
    process.exit(1)
  }
  console.log(
    `CI gate manifest in sync: ${workflowJobIds.length} workflow jobs classified; tool versions match (node ${ciNode}, pnpm ${ciPnpm}).`,
  )
}
