import {securityCheckJsonOutputSchema, toSecurityCheckFileListJson, toSecurityCheckJson} from './security-check-json.js'
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
  test('encodes the selection, the deterministic findings document, and the agent checks path', async () => {
    const encoded = securityCheckJsonOutputSchema.encode(
      toSecurityCheckJson({deterministicFindings}, agentChecksPath, configSelection, scanDirectories, null),
    )
    const fixture = await readFile(joinPath(fixtureDirectory, 'check.json'))
    expect(JSON.parse(encoded)).toEqual(JSON.parse(fixture))
  })

  test('encodes the chosen instructions in the scan result as instructions --json does', () => {
    const instructions = toAppSecurityInstructionsJson('# Instructions', {copy: true})

    const checkResult = JSON.parse(
      securityCheckJsonOutputSchema.encode(
        toSecurityCheckJson({deterministicFindings}, agentChecksPath, configSelection, scanDirectories, instructions),
      ),
    )
    const instructionsResult = JSON.parse(securityInstructionsJsonOutputSchema.encode({instructions}))

    expect(checkResult.instructions).toEqual({content: '# Instructions', copiedToClipboard: true, path: null})
    expect(instructionsResult).toEqual({instructions: checkResult.instructions})
  })

  test('encodes the written file of instructions --write as its path', () => {
    expect(toAppSecurityInstructionsJson('# Instructions', {copy: false, writePath: '/tmp/handoff.md'})).toEqual({
      content: '# Instructions',
      copiedToClipboard: false,
      path: '/tmp/handoff.md',
    })
  })

  test('encodes the --list-files result as the absolute path of each file only', () => {
    const fileList = toSecurityCheckFileListJson(appDirectory, [
      'shopify.app.toml',
      'app/index.ts',
      '../backend/index.ts',
    ])

    expect(JSON.parse(securityCheckJsonOutputSchema.encode(fileList))).toEqual({
      files: ['/tmp/app/shopify.app.toml', '/tmp/app/app/index.ts', '/tmp/backend/index.ts'],
    })
  })

  test('describes the --list-files paths as absolute', () => {
    const fileList = (
      securityCheckJsonOutputSchema.jsonSchema as {
        definitions: {AppSecurityCheckFileListResult: {properties: {files: {description?: string}}}}
      }
    ).definitions.AppSecurityCheckFileListResult.properties.files

    expect(fileList.description).toBe('The absolute path of each file the check would gather.')
  })

  test('rejects a check result that is neither a scan nor a file list', () => {
    expect(() => securityCheckJsonOutputSchema.validate({files: 'shopify.app.toml'})).toThrow()
    expect(() => securityCheckJsonOutputSchema.validate({agentChecksPath})).toThrow()
  })

  describe('rejects a key the contract does not define', () => {
    const instructions = toAppSecurityInstructionsJson('# Instructions', {copy: false})
    const scanResult = toSecurityCheckJson(
      {deterministicFindings},
      agentChecksPath,
      configSelection,
      scanDirectories,
      instructions,
    )

    test('accepts the scan result as built', () => {
      expect(securityCheckJsonOutputSchema.validate(scanResult)).toEqual(scanResult)
    })

    test.each([
      ['the scan result', {...scanResult, engine: deterministicFindings.engine}],
      ['the selection', {...scanResult, selection: {...scanResult.selection, kind: 'config'}}],
      [
        'a scan directory',
        {
          ...scanResult,
          selection: {
            ...scanResult.selection,
            scanDirectories: [{directory: appDirectory, origin: 'app-directory', requested: true}],
          },
        },
      ],
      ['the instructions', {...scanResult, instructions: {...instructions, writePath: '/tmp/handoff.md'}}],
      ['the --list-files result', {files: ['shopify.app.toml'], directory: appDirectory}],
    ])('in %s of check', (_, result) => {
      expect(() => securityCheckJsonOutputSchema.validate(result)).toThrow(/Unrecognized key/)
    })

    test.each([
      ['the instructions result', {instructions, path: '/tmp/handoff.md'}],
      ['the instructions', {instructions: {...instructions, writePath: '/tmp/handoff.md'}}],
    ])('in %s of instructions', (_, result) => {
      expect(() => securityInstructionsJsonOutputSchema.validate(result)).toThrow(/Unrecognized key/)
    })
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
    ).toMatchObject({clientId: 'flag-client-id', clientIdSource: 'flag'})
  })

  test('reports an unlinked configuration with no client ID', () => {
    expect(selectionJson({kind: 'config', appDirectory, appConfigFilePath: '/tmp/app/shopify.app.toml'})).toMatchObject(
      {clientId: null, clientIdSource: null},
    )
  })

  test.each(['flag', 'picker'] as const)('reports no configuration file and a %s client ID', (clientIdSource) => {
    expect(selectionJson({kind: 'no-config', appDirectory, clientId: 'chosen-id', clientIdSource})).toEqual({
      directory: appDirectory,
      configPath: null,
      clientId: 'chosen-id',
      clientIdSource,
      scanDirectories: [{directory: appDirectory, origin: 'app-directory'}],
    })
  })

  test('spells each scan directory origin in kebab case', () => {
    const selection = toSecurityCheckJson(
      {deterministicFindings},
      agentChecksPath,
      configSelection,
      [
        {directory: appDirectory, origin: 'app_directory'},
        {directory: '/tmp/backend', origin: 'include_dir'},
      ],
      null,
    ).selection

    expect(selection.scanDirectories).toEqual([
      {directory: appDirectory, origin: 'app-directory'},
      {directory: '/tmp/backend', origin: 'include-dir'},
    ])
  })

  test('describes the deterministic findings document as keeping its own conventions and version', () => {
    const scanResult = (
      securityCheckJsonOutputSchema.jsonSchema as {
        definitions: {AppSecurityCheckScanResult: {properties: {deterministicFindings: {description?: string}}}}
      }
    ).definitions.AppSecurityCheckScanResult.properties.deterministicFindings

    expect(scanResult.description).toContain('keeps its own field conventions')
    expect(scanResult.description).toContain('schema_version')
  })
})
