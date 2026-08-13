/* eslint-disable no-console */

// Surfaces tests that failed and then passed on retry ("flaky" in Playwright's
// JSON report). Retries keep flake from failing the shard; this keeps it from
// disappearing. Each flaky test is printed as a grep-able `FLAKY:` log line
// and listed in the GitHub job summary.

import {appendFileSync, existsSync, readFileSync} from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const resultsPath = path.join(__dirname, '../test-results/results.json')

if (!existsSync(resultsPath)) {
  console.log('no results.json found, skipping flaky report')
  process.exit(0)
}

const report = JSON.parse(readFileSync(resultsPath, 'utf8'))

const flakyTests = []
function walkSuite(suite, titlePath) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status === 'flaky') {
        flakyTests.push({title: [...titlePath, spec.title].join(' › '), file: spec.file})
      }
    }
  }
  for (const child of suite.suites ?? []) {
    walkSuite(child, [...titlePath, child.title])
  }
}
for (const suite of report.suites ?? []) {
  // Root suites are titled with the file name, which spec.file already carries.
  walkSuite(suite, [])
}

if (flakyTests.length === 0) {
  console.log('no flaky tests in this shard')
  process.exit(0)
}

for (const test of flakyTests) {
  console.log(`FLAKY: ${test.file} › ${test.title}`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '## Flaky tests (failed, then passed on retry)',
    '',
    ...flakyTests.map((test) => `- \`${test.file}\` › ${test.title}`),
    '',
  ].join('\n')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
}
