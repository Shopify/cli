import {appSecurityRecordJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const resultsDirectory = onWindows
  ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
  : '/apps/my-app/.shopify/app-security/shopify.app'
const result = {
  status: 'success',
  app: {
    directory: appDirectory,
    configurationPath: onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml',
    clientId: 'toml-client-id',
  },
  resultsDirectory,
  path: onWindows ? `${resultsDirectory}\\agent-findings.json` : `${resultsDirectory}/agent-findings.json`,
  checkCount: 2,
  findingCount: 3,
  suppressions: null,
}

const suppressionsFile = onWindows
  ? 'C:\\apps\\my-app\\shopify.app-security.json'
  : '/apps/my-app/shopify.app-security.json'
const routeFile = onWindows ? 'C:\\apps\\my-app\\app\\routes\\orders.tsx' : '/apps/my-app/app/routes/orders.tsx'
const savedEntry = {
  index: 0,
  change: 'added',
  source: 'agent',
  check: 'MISSING_TENANT_ISOLATION',
  kind: 'false-positive',
  path: routeFile,
  code: 'const orders = await prisma.order.findMany()',
  reason: 'Every order table holds one shop.',
  configurations: ['shopify.app.toml'],
}
const suppressions = {
  filePath: suppressionsFile,
  entries: [savedEntry],
  alreadySavedCount: 1,
  notSaved: [
    {
      checkId: 'MISSING_TENANT_ISOLATION',
      location: {filePath: routeFile, line: 40},
      message:
        'every code from its lines also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
    },
  ],
}

describe('appSecurityRecordJsonOutputSchema', () => {
  test.each([
    ['the selected app', result],
    ['no checks or findings', {...result, checkCount: 0, findingCount: 0}],
    ['no app configuration', {...result, app: {directory: appDirectory, configurationPath: null, clientId: 'abc'}}],
    ['saved suppressions', {...result, suppressions}],
    [
      'an entry without code that got a configuration',
      {
        ...result,
        suppressions: {
          ...suppressions,
          entries: [
            {...savedEntry, change: 'configuration-added', code: null, configurations: ['shopify.app.toml', 'abc']},
          ],
        },
      },
    ],
  ])('accepts a result with %s', (_description, value) => {
    expect(appSecurityRecordJsonOutputSchema.validate(value)).toStrictEqual(value)
  })

  test.each([
    ['an extra field', {...result, checks: 2}],
    ['a missing field', {...result, path: undefined}],
    ['an extra app field', {...result, app: {...result.app, name: 'My app'}}],
    ['a relative path', {...result, path: 'agent-findings.json'}],
    ['a relative results directory', {...result, resultsDirectory: '.shopify/app-security/shopify.app'}],
    ['a negative count', {...result, findingCount: -1}],
    ['a fractional count', {...result, checkCount: 1.5}],
    ['another status', {...result, status: 'cancelled'}],
    ['no suppressions field', {...result, suppressions: undefined}],
    [
      'a kind with an underscore',
      {...result, suppressions: {...suppressions, entries: [{...savedEntry, kind: 'false_positive'}]}},
    ],
    ['an unknown change', {...result, suppressions: {...suppressions, entries: [{...savedEntry, change: 'replaced'}]}}],
    ['a relative entry path', {...result, suppressions: {...suppressions, entries: [{...savedEntry, path: 'a.ts'}]}}],
    ['an empty code', {...result, suppressions: {...suppressions, entries: [{...savedEntry, code: ''}]}}],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityRecordJsonOutputSchema.validate(value)).toThrow()
  })
})
