import {toSecurityJson, encodeSecurityJson} from './security-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

const fixtureDirectory = fileURLToPath(new URL('./app-security-json-fixtures', import.meta.url))

const engine = {
  name: 'shopify-app-security' as const,
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const artifact: DeterministicFindingsDocument = {
  schema_version: 1,
  engine,
  generated_at: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
  detection: {framework: 'none', surface: 'config_only', languages: []},
  findings: [],
  checks_executed: [],
  coverage: {files_scanned: 1, files_skipped: [], gaps: []},
}

const reviewPack = {
  schema_version: 1 as const,
  security_version: '1.2.3',
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: [],
  instructions: 'review',
}

describe('App Security JSON contract', () => {
  test('encodes the engine, the deterministic findings, and the review pack', async () => {
    const encoded = encodeSecurityJson(toSecurityJson({engine, artifact, reviewPack}))
    const fixture = await readFile(joinPath(fixtureDirectory, 'scan.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })
})
