import {appSecurityCheckJsonOutputSchema} from './types.js'
import {jsonSchemaValidate, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const resultsDirectory = onWindows
  ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
  : '/apps/my-app/.shopify/app-security/shopify.app'
const app = {
  directory: appDirectory,
  configurationPath: onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml',
  clientId: 'toml-client-id',
}
const scope = {includeDirs: ['../backend'], excludes: ['**/generated'], noGitIgnore: false}
const scanDirectories = [
  {directory: appDirectory, origin: 'app-directory'},
  {directory: onWindows ? 'C:\\apps\\backend' : '/apps/backend', origin: 'include-dir'},
]
const suppressionEntry = {
  index: 0,
  source: 'deterministic',
  check: 'COMMITTED_SECRET',
  kind: 'false-positive',
  path: onWindows ? 'C:\\apps\\my-app\\test\\session.ts' : '/apps/my-app/test/session.ts',
  status: 'matched',
  matchedFindingCount: 2,
}
const suppressions = {
  filePath: onWindows ? 'C:\\apps\\my-app\\shopify.app-security.json' : '/apps/my-app/shopify.app-security.json',
  entryCount: 2,
  suppressedFindingCount: 2,
  entries: [
    suppressionEntry,
    {...suppressionEntry, index: 1, kind: 'accepted-risk', status: 'stale', matchedFindingCount: 0},
  ],
}
const scan = {
  status: 'success',
  valid: true,
  app,
  resultsDirectory,
  deterministicFindingsPath: onWindows
    ? `${resultsDirectory}\\deterministic-findings.json`
    : `${resultsDirectory}/deterministic-findings.json`,
  agentChecksPath: onWindows ? `${resultsDirectory}\\agent-checks.json` : `${resultsDirectory}/agent-checks.json`,
  scope,
  scanDirectories,
  agentCheckCount: 31,
  blocking: {level: 'none', blockedCheckCount: 0},
  suppressions,
}
const fileList = {
  status: 'success',
  app,
  scope,
  scanDirectories,
  files: [{path: onWindows ? 'C:\\apps\\backend\\server.ts' : '/apps/backend/server.ts'}],
}

describe('appSecurityCheckJsonOutputSchema', () => {
  test.each([
    ['a scan without instructions', scan],
    ['a scan with instructions', {...scan, instructions: {content: '# Instructions', copied: true}}],
    ['a scan that fails --blocking', {...scan, valid: false, blocking: {level: 'high', blockedCheckCount: 2}}],
    [
      'a scan without app configuration',
      {...scan, app: {directory: appDirectory, configurationPath: null, clientId: 'a'}},
    ],
    [
      'a scan without a suppressions file',
      {...scan, suppressions: {...suppressions, entryCount: 0, suppressedFindingCount: 0, entries: []}},
    ],
    [
      'every entry status',
      {
        ...scan,
        suppressions: {
          ...suppressions,
          entries: (['matched', 'stale', 'ambiguous', 'not-evaluated'] as const).map((status, index) => ({
            ...suppressionEntry,
            index,
            status,
          })),
        },
      },
    ],
    ['the listed files', fileList],
    ['no listed files', {...fileList, files: []}],
    ['a cancellation', {status: 'cancelled'}],
  ])('accepts %s', (_description, value) => {
    expect(appSecurityCheckJsonOutputSchema.validate(value)).toStrictEqual(value)
  })

  test.each([
    ['an extra field', {...scan, findings: []}],
    ['a missing field', {...scan, agentChecksPath: undefined}],
    ['null instructions', {...scan, instructions: null}],
    ['empty instructions', {...scan, instructions: {content: '', copied: false}}],
    ['a relative findings path', {...scan, deterministicFindingsPath: 'deterministic-findings.json'}],
    ['a negative agent check count', {...scan, agentCheckCount: -1}],
    ['a fractional blocked check count', {...scan, blocking: {level: 'high', blockedCheckCount: 0.5}}],
    [
      'a stored scan directory origin',
      {...scan, scanDirectories: [{directory: appDirectory, origin: 'app_directory'}]},
    ],
    ['a stored scope', {...scan, scope: {include_dirs: [], excludes: [], no_git_ignore: false}}],
    ['listed files with the scan fields', {...fileList, valid: true}],
    ['a relative listed file', {...fileList, files: [{path: 'app/routes/index.ts'}]}],
    ['a listed file as a string', {...fileList, files: ['/apps/my-app/shopify.app.toml']}],
    ['a cancellation with a reason', {status: 'cancelled', reason: 'declined'}],
    ['another status', {...scan, status: 'skipped'}],
    ['a scan without suppressions', {...scan, suppressions: undefined}],
    ['null suppressions', {...scan, suppressions: null}],
    ['listed files with suppressions', {...fileList, suppressions}],
    ['an extra suppressions field', {...scan, suppressions: {...suppressions, resultsKey: 'shopify.app'}}],
    ['an extra entry field', {...scan, suppressions: {...suppressions, entries: [{...suppressionEntry, code: 'x'}]}}],
    [
      'a suppression kind with an underscore',
      {...scan, suppressions: {...suppressions, entries: [{...suppressionEntry, kind: 'false_positive'}]}},
    ],
    [
      'an unknown entry status',
      {...scan, suppressions: {...suppressions, entries: [{...suppressionEntry, status: 'not_evaluated'}]}},
    ],
    [
      'a relative entry path',
      {...scan, suppressions: {...suppressions, entries: [{...suppressionEntry, path: 'test/session.ts'}]}},
    ],
    [
      'a relative suppressions file path',
      {...scan, suppressions: {...suppressions, filePath: 'shopify.app-security.json'}},
    ],
    ['a negative entry count', {...scan, suppressions: {...suppressions, entryCount: -1}}],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityCheckJsonOutputSchema.validate(value)).toThrow()
  })

  test('the --json-schema output accepts a scan with suppressions and rejects a kind with an underscore', async () => {
    const jsonSchema = await normaliseJsonSchema(JSON.stringify(appSecurityCheckJsonOutputSchema.jsonSchema))
    const underscoreKind = {
      ...scan,
      suppressions: {...suppressions, entries: [{...suppressionEntry, kind: 'false_positive'}]},
    }

    expect(jsonSchemaValidate(scan, jsonSchema, 'fail').state).toBe('ok')
    expect(jsonSchemaValidate(underscoreKind, jsonSchema, 'fail').state).toBe('error')
  })
})
