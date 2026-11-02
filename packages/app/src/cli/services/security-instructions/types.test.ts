import {appSecurityInstructionsJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const result = {
  status: 'success',
  app: {
    directory: appDirectory,
    configurationPath: onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml',
    clientId: 'toml-client-id',
  },
  resultsDirectory: onWindows
    ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
    : '/apps/my-app/.shopify/app-security/shopify.app',
  instructions: {content: '# Instructions', copied: false},
}
const file = {path: onWindows ? 'C:\\apps\\instructions.md' : '/apps/instructions.md', format: 'markdown'}

describe('appSecurityInstructionsJsonOutputSchema', () => {
  test.each([
    ['printed instructions', result],
    ['copied instructions', {...result, instructions: {...result.instructions, copied: true}}],
    ['no app configuration', {...result, app: {directory: appDirectory, configurationPath: null, clientId: 'abc'}}],
    ['the written file alone', file],
  ])('accepts a result with %s', (_description, value) => {
    expect(appSecurityInstructionsJsonOutputSchema.validate(value)).toStrictEqual(value)
  })

  test.each([
    ['an extra field', {...result, path: file.path}],
    ['a missing field', {...result, instructions: undefined}],
    ['extra instructions fields', {...result, instructions: {...result.instructions, path: file.path}}],
    ['a relative results directory', {...result, resultsDirectory: '.shopify/app-security/shopify.app'}],
    ['another status', {...result, status: 'cancelled'}],
    ['a status on the written file', {...file, status: 'success'}],
    ['a relative written file', {...file, path: 'instructions.md'}],
    ['another file format', {...file, format: 'json'}],
    ['the written file and the instructions', {...file, instructions: result.instructions}],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityInstructionsJsonOutputSchema.validate(value)).toThrow()
  })
})
