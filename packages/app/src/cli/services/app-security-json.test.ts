import {toSecurityJson, encodeSecurityJson} from './security-json.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

const fixtureDirectory = fileURLToPath(new URL('./app-security-json-fixtures', import.meta.url))

const engine = {
  name: 'shopify-app-security' as const,
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine,
  generated_at: '2026-08-24T00:00:00.000Z',
  detection: {framework: 'none', surface: 'config_only', languages: []},
  coverage: {files_scanned: 1, files_skipped: [], gaps: []},
  checks: [],
}

const appDirectory = '/tmp/app'
const agentChecksPath = '/tmp/app/.shopify/app-security/agent-checks.json'
const scanDirectories = [{directory: appDirectory, origin: 'app_directory' as const}]

function selectionJson(selection: AppSecuritySelection) {
  return toSecurityJson({engine, deterministicFindings}, agentChecksPath, selection, scanDirectories).selection
}

describe('App Security JSON contract', () => {
  test('encodes the engine, the selection, the deterministic findings document, and the agent checks path', async () => {
    const encoded = encodeSecurityJson(
      toSecurityJson(
        {engine, deterministicFindings},
        agentChecksPath,
        {
          kind: 'config',
          appDirectory,
          appConfigFilePath: '/tmp/app/shopify.app.toml',
          configClientId: 'test-client-id',
        },
        scanDirectories,
      ),
    )
    const fixture = await readFile(joinPath(fixtureDirectory, 'check.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })

  test('reports the client ID override as coming from the flag', () => {
    expect(
      selectionJson({
        kind: 'config',
        appDirectory,
        appConfigFilePath: '/tmp/app/shopify.app.staging.toml',
        configClientId: 'toml-client-id',
        clientIdOverride: 'flag-client-id',
      }),
    ).toMatchObject({client_id: 'flag-client-id', client_id_source: 'flag'})
  })

  test('reports an unlinked configuration with no client ID', () => {
    expect(selectionJson({kind: 'config', appDirectory, appConfigFilePath: '/tmp/app/shopify.app.toml'})).toMatchObject(
      {client_id: null, client_id_source: null},
    )
  })

  test.each(['flag', 'picker'] as const)('reports no configuration file and a %s client ID', (clientIdSource) => {
    expect(selectionJson({kind: 'no-config', appDirectory, clientId: 'chosen-id', clientIdSource})).toEqual({
      app_directory: appDirectory,
      app_config_file: null,
      client_id: 'chosen-id',
      client_id_source: clientIdSource,
      scan_directories: scanDirectories,
    })
  })
})
