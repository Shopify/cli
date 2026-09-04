import {toDoctorJson, encodeDoctorJson} from './doctor-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {AppDoctorExecution} from './app-doctor-api.js'
import type {ScanResult, TraceV2} from './app-doctor-engine/index.js'

const fixtureDirectory = fileURLToPath(new URL('./app-doctor-json-fixtures', import.meta.url))

const engine = {
  name: 'shopify-app-doctor' as const,
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const scan: ScanResult = {
  version: '1.2.3',
  timestamp: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
  app: {name: 'Test', type: 'public'},
  detection: {framework: 'none', surface: 'config_only', languages: []},
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: false,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  score: {total: 100, baseline: 100, grade: 'EXCELLENT'},
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    doctor_version: '1.2.3',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_complete: true,
    coverage_gaps: [],
    input_hash: 'sha256:input',
    result_hash: 'sha256:result',
    checks_executed: [],
  },
  issues: [],
}

const trace: TraceV2 = {
  schema_version: 2,
  engine,
  generated_at: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null, input_hash: 'sha256:input', input_hashes: {}},
  detection: scan.detection,
  score: scan.score,
  findings: [],
  checks_executed: [],
  suppressions: [],
  coverage: {files_scanned: 1, files_skipped: [], complete: true, gaps: []},
  attestation: {digest: 'sha256:digest', signed: false},
}

const scanExecution: AppDoctorExecution = {
  operation: 'scan',
  appRoot: '/tmp/app',
  scan,
  trace,
  reviewPack: {
    schema_version: 1,
    source_scan_id: 'sha256:input',
    doctor_version: '1.2.3',
    generated_at: '2026-08-24T00:00:00.000Z',
    checks: [],
    instructions: 'review',
  },
  engine,
  elapsedMilliseconds: 12,
}

const compileExecution: AppDoctorExecution = {
  operation: 'compile',
  appRoot: '/tmp/app',
  scan,
  trace,
  findings: {accepted: 1, rejected: [], warnings: []},
  engine,
  elapsedMilliseconds: 15,
}

describe('App Doctor JSON contract', () => {
  test('encodes a tagged scan result', async () => {
    const encoded = encodeDoctorJson(toDoctorJson(scanExecution))
    const fixture = await readFile(joinPath(fixtureDirectory, 'scan.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })

  test('encodes a tagged compile result', async () => {
    const encoded = encodeDoctorJson(toDoctorJson(compileExecution))
    const fixture = await readFile(joinPath(fixtureDirectory, 'compile.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })
})
