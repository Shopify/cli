import assert from 'node:assert/strict'
import test from 'node:test'

import {findProblems, parseJobIds} from './check-ci-gates.js'

// Versions below are arbitrary fixtures, not the repo's real pins — the guard
// reads those from dev.yml / tests-pr.yml at runtime, never hard-coded.
const workflow = (jobIds, {node = '1.2.3', pnpm = '4.5.6'} = {}) =>
  `name: tests\non: pull_request\nenv:\n  DEFAULT_NODE_VERSION: '${node}'\n  PNPM_VERSION: '${pnpm}'\njobs:\n` +
  jobIds.map((id) => `  ${id}:\n    runs-on: ubuntu-latest\n    steps: []`).join('\n') +
  '\n'

const devYml = ({node = '1.2.3', pnpm = '4.5.6'} = {}) =>
  `name: cli\nup:\n  - node:\n      version: ${node}\n      package_manager: pnpm@${pnpm}\n  - packages:\n      - jq\n`

test('in sync: no problems', () => {
  const {problems} = findProblems({workflow: workflow(['a', 'b']), devYml: devYml(), manifestJobIds: ['a', 'b']})
  assert.deepEqual(problems, [])
})

test('workflow job missing from the manifest', () => {
  const {problems} = findProblems({workflow: workflow(['a', 'b', 'c']), devYml: devYml(), manifestJobIds: ['a', 'b']})
  assert.match(problems.join('\n'), /not classified.*\bc\b/)
})

test('manifest lists a job absent from the workflow', () => {
  const {problems} = findProblems({workflow: workflow(['a']), devYml: devYml(), manifestJobIds: ['a', 'b']})
  assert.match(problems.join('\n'), /absent from tests-pr\.yml.*\bb\b/)
})

test('node version mismatch is detected', () => {
  const {problems} = findProblems({workflow: workflow(['a'], {node: '9.9.9'}), devYml: devYml({node: '1.2.3'}), manifestJobIds: ['a']})
  assert.match(problems.join('\n'), /Node version mismatch/)
})

test('pnpm version mismatch is detected', () => {
  const {problems} = findProblems({workflow: workflow(['a']), devYml: devYml({pnpm: '9.0.0'}), manifestJobIds: ['a']})
  assert.match(problems.join('\n'), /pnpm version mismatch/)
})

test('a missing version pin is reported, not silently passed', () => {
  const noEnv = `name: t\non: pull_request\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps: []\n`
  const {problems} = findProblems({workflow: noEnv, devYml: devYml(), manifestJobIds: ['a']})
  assert.match(problems.join('\n'), /Could not read DEFAULT_NODE_VERSION/)
})

// Hardening: tolerate a trailing comment after the job id, and ignore deeper-indented
// keys, blank lines, comment lines, and any top-level section after `jobs:`.
test('parseJobIds tolerates comments and ignores non-job lines', () => {
  const wf = `env:\n  DEFAULT_NODE_VERSION: '1.2.3'\njobs:\n  build: # freshness gate\n    runs-on: ubuntu-latest\n    env:\n      NESTED: 1\n\n  # a comment line\n  test-job:\n    steps: []\nconcurrency:\n  group: x\n`
  assert.deepEqual(parseJobIds(wf), ['build', 'test-job'])
})

test('parseJobIds returns empty when there is no jobs block', () => {
  assert.deepEqual(parseJobIds('name: t\non: push\n'), [])
})

test('CRLF line endings are handled', () => {
  const wf = workflow(['a', 'b']).replace(/\n/g, '\r\n')
  assert.deepEqual(parseJobIds(wf), ['a', 'b'])
  const {problems} = findProblems({workflow: wf, devYml: devYml().replace(/\n/g, '\r\n'), manifestJobIds: ['a', 'b']})
  assert.deepEqual(problems, [])
})
