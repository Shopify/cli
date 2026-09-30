import {toSecurityJson, encodeSecurityJson} from './security-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {AppSecurityExecution} from './app-security-api.js'
import type {ScanResult, TraceV3} from './app-security-engine/index.js'

const fixtureDirectory = fileURLToPath(new URL('./app-security-json-fixtures', import.meta.url))

const engine = {
  name: 'shopify-app-security' as const,
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
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: false,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    security_version: '1.2.3',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_complete: true,
    coverage_gaps: [],
    checks_executed: [],
  },
  issues: [],
}

const trace: TraceV3 = {
  schema_version: 3,
  engine,
  generated_at: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
  detection: scan.detection,
  findings: [],
  checks_executed: [],
  coverage: {files_scanned: 1, files_skipped: [], complete: true, gaps: []},
}

const scanExecution: AppSecurityExecution = {
  operation: 'scan',
  appRoot: '/tmp/app',
  scan,
  trace,
  reviewPack: {
    schema_version: 1,
    security_version: '1.2.3',
    generated_at: '2026-08-24T00:00:00.000Z',
    checks: [],
    instructions: 'review',
  },
  engine,
  elapsedMilliseconds: 12,
}

describe('App Security JSON contract', () => {
  test('encodes a tagged scan result', async () => {
    const encoded = encodeSecurityJson(toSecurityJson(scanExecution))
    const fixture = await readFile(joinPath(fixtureDirectory, 'scan.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })
})
