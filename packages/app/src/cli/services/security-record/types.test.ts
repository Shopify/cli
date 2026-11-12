import {appSecurityRecordJsonOutputSchema} from './types.js'
import {savedSuppressionFixture} from '../app-security/types.test-data.js'
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
const savedEntry = savedSuppressionFixture(routeFile)
const suppressions = {
  filePath: suppressionsFile,
  entries: [savedEntry],
  alreadySavedCount: 1,
  notSaved: [
    {
      checkId: 'MISSING_TENANT_ISOLATION',
      location: {filePath: routeFile, line: 40},
      message:
        'every automatic code candidate also names another finding of MISSING_TENANT_ISOLATION in app/routes/orders.tsx',
      advice:
        'The automatic code selectors did not select this finding alone. You can try a manual entry with a code that names it alone. An agent entry without code suppresses all 2 agent findings of MISSING_TENANT_ISOLATION in that file. Omit code only if you intend to suppress all of these findings.',
      invalidFields: null,
      findingCountWithoutCode: 2,
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
          entries: [{...savedEntry, change: 'added', code: null}],
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
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityRecordJsonOutputSchema.validate(value)).toThrow()
  })
})
