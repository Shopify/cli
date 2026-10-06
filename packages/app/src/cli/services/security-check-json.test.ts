import {
  SCAN_DIRECTORY_MATCHES_CHECK_JSON,
  securityCheckJsonOutputSchema,
  toSecurityCheckJson,
} from './security-check-json.js'
import {securityInstructionsJsonOutputSchema, toAppSecurityInstructionsJson} from './security-instructions-json.js'
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
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [],
}

const appDirectory = '/tmp/app'
const agentChecksPath = '/tmp/app/.shopify/app-security/agent-checks.json'
const scanDirectories = [{directory: appDirectory, origin: 'app_directory' as const}]

function selectionJson(selection: AppSecuritySelection) {
  return toSecurityCheckJson({deterministicFindings}, agentChecksPath, selection, scanDirectories, null).selection
}

const configSelection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: '/tmp/app/shopify.app.toml',
  configClientId: 'test-client-id',
}

describe('app security JSON contract', () => {
  test('keeps the scan directory type and the public schema in sync', () => {
    // `tsc` is the real check: the constant only compiles when the type matches the schema.
    expect(SCAN_DIRECTORY_MATCHES_CHECK_JSON).toBe(true)
  })

  test('encodes the selection, the deterministic findings document, and the agent checks path', async () => {
    const encoded = securityCheckJsonOutputSchema.encode(
      toSecurityCheckJson({deterministicFindings}, agentChecksPath, configSelection, scanDirectories, null),
    )
    const fixture = await readFile(joinPath(fixtureDirectory, 'check.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })

  test('encodes the chosen instructions in the scan result as instructions --json does', () => {
    const instructions = toAppSecurityInstructionsJson({content: '# Instructions', copiedToClipboard: true})

    const checkResult = JSON.parse(
      securityCheckJsonOutputSchema.encode(
        toSecurityCheckJson({deterministicFindings}, agentChecksPath, configSelection, scanDirectories, instructions),
      ),
    )
    const instructionsResult = JSON.parse(securityInstructionsJsonOutputSchema.encode({instructions}))

    expect(checkResult.instructions).toEqual({content: '# Instructions', copied_to_clipboard: true, path: null})
    expect(instructionsResult).toEqual({instructions: checkResult.instructions})
  })

  test('encodes the written file of instructions --write as its path', () => {
    expect(
      toAppSecurityInstructionsJson({
        content: '# Instructions',
        copiedToClipboard: false,
        writePath: '/tmp/handoff.md',
      }),
    ).toEqual({content: '# Instructions', copied_to_clipboard: false, path: '/tmp/handoff.md'})
  })

  test('encodes the --list-files result as the list of files only', () => {
    expect(JSON.parse(securityCheckJsonOutputSchema.encode({files: ['shopify.app.toml']}))).toEqual({
      files: ['shopify.app.toml'],
    })
  })

  test('rejects a check result that is neither a scan nor a file list', () => {
    expect(() => securityCheckJsonOutputSchema.validate({files: 'shopify.app.toml'})).toThrow()
    expect(() => securityCheckJsonOutputSchema.validate({agent_checks_path: agentChecksPath})).toThrow()
  })

  test('publishes the scan and file list results, and one instructions definition for both commands', () => {
    const checkSchema = securityCheckJsonOutputSchema.jsonSchema as {
      anyOf: unknown[]
      definitions: Record<string, unknown>
    }
    const instructionsSchema = securityInstructionsJsonOutputSchema.jsonSchema as {
      definitions: Record<string, unknown>
    }

    expect(checkSchema.anyOf).toEqual([
      {$ref: '#/definitions/AppSecurityCheckScanResult'},
      {$ref: '#/definitions/AppSecurityCheckFileListResult'},
    ])
    expect(checkSchema.definitions.AppSecurityInstructions).toEqual(
      instructionsSchema.definitions.AppSecurityInstructions,
    )
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
