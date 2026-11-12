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
}

describe('appSecurityRecordJsonOutputSchema', () => {
  test.each([
    ['the selected app', result],
    ['no checks or findings', {...result, checkCount: 0, findingCount: 0}],
    ['no app configuration', {...result, app: {directory: appDirectory, configurationPath: null, clientId: 'abc'}}],
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
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityRecordJsonOutputSchema.validate(value)).toThrow()
  })
})
