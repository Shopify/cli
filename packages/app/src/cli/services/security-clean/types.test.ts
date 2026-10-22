import {appSecurityCleanJsonOutputSchema} from './types.js'
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

describe('appSecurityCleanJsonOutputSchema', () => {
  test.each([
    ['the selected app', {status: 'success', changed: true, app, resultsDirectories: [resultsDirectory]}],
    [
      'the app directory alone',
      {status: 'success', changed: false, app: {directory: appDirectory}, resultsDirectories: []},
    ],
  ])('accepts a result with %s', (_description, result) => {
    expect(appSecurityCleanJsonOutputSchema.validate(result)).toStrictEqual(result)
  })

  test.each([
    ['an extra field', {status: 'success', changed: false, app, resultsDirectories: [], removed: []}],
    [
      'a partial app',
      {status: 'success', changed: false, app: {directory: appDirectory, clientId: null}, resultsDirectories: []},
    ],
    ['an extra app field', {status: 'success', changed: false, app: {...app, name: 'My app'}, resultsDirectories: []}],
    [
      'a relative results directory',
      {status: 'success', changed: true, app, resultsDirectories: ['.shopify/app-security/shopify.app']},
    ],
    ['another status', {status: 'skipped', changed: false, app, resultsDirectories: []}],
  ])('rejects %s', (_description, result) => {
    expect(() => appSecurityCleanJsonOutputSchema.validate(result)).toThrow()
  })
})
