import {
  appSecurityAppSchema,
  appSecurityInstructionsSchema,
  projectAppSecurityApp,
  projectAppSecurityInstructions,
  projectAppSecurityPath,
} from './app-security-json-output.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {AppSecuritySelection} from './app-security-selection.js'

// Selections hold the app directory's real path and paths joined from it with forward slashes, even on Windows.
const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const nativeConfigurationPath = onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml'

function configSelection(
  overrides: Partial<Extract<AppSecuritySelection, {kind: 'config'}>> = {},
): AppSecuritySelection {
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'), ...overrides}
}

describe('projectAppSecurityPath', () => {
  test('returns the absolute path with native separators', () => {
    expect(projectAppSecurityPath(joinPath(appDirectory, '.shopify', 'app-security', 'shopify.app'))).toBe(
      onWindows
        ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
        : '/apps/my-app/.shopify/app-security/shopify.app',
    )
  })
})

describe('projectAppSecurityApp', () => {
  test("projects an app configuration with the TOML's client ID", () => {
    expect(projectAppSecurityApp(configSelection({configClientId: 'toml-client-id'}))).toStrictEqual({
      directory: appDirectory,
      configurationPath: nativeConfigurationPath,
      clientId: 'toml-client-id',
    })
  })

  test('prefers the --client-id value to the TOML client ID', () => {
    const selection = configSelection({configClientId: 'toml-client-id', clientIdOverride: 'flag-client-id'})

    expect(projectAppSecurityApp(selection)).toMatchObject({clientId: 'flag-client-id'})
  })

  test('has a null client ID when the app configuration is not linked', () => {
    expect(projectAppSecurityApp(configSelection())).toStrictEqual({
      directory: appDirectory,
      configurationPath: nativeConfigurationPath,
      clientId: null,
    })
  })

  test('has a null configuration path without app configuration', () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }

    expect(projectAppSecurityApp(selection)).toStrictEqual({
      directory: appDirectory,
      configurationPath: null,
      clientId: 'flag-client-id',
    })
  })
})

describe('appSecurityAppSchema', () => {
  const app = {directory: appDirectory, configurationPath: nativeConfigurationPath, clientId: 'toml-client-id'}

  test('accepts a projected app', () => {
    expect(appSecurityAppSchema.parse(app)).toStrictEqual(app)
  })

  test.each([
    ['an extra field', {...app, name: 'My app'}],
    ['a missing field', {directory: app.directory, clientId: app.clientId}],
    ['a relative directory', {...app, directory: 'my-app'}],
    ['a relative configuration path', {...app, configurationPath: 'shopify.app.toml'}],
    ['an empty client ID', {...app, clientId: ''}],
  ])('rejects %s', (_description, value) => {
    expect(appSecurityAppSchema.safeParse(value).success).toBe(false)
  })
})

describe('projectAppSecurityInstructions', () => {
  test.each([
    ['printed', {copy: false}, false],
    ['copied to the clipboard', {copy: true}, true],
  ])('projects instructions that were %s', (_description, delivery, copied) => {
    expect(projectAppSecurityInstructions('# Instructions', delivery)).toStrictEqual({
      content: '# Instructions',
      copied,
    })
  })
})

describe('appSecurityInstructionsSchema', () => {
  const instructions = {content: '# Instructions', copied: true}

  test('accepts projected instructions', () => {
    expect(appSecurityInstructionsSchema.parse(instructions)).toStrictEqual(instructions)
  })

  test.each([
    ['an extra field', {...instructions, path: '/apps/my-app/instructions.md'}],
    ['a missing field', {content: instructions.content}],
    ['empty content', {...instructions, content: ''}],
    ['a copied flag that is not a boolean', {...instructions, copied: 'true'}],
  ])('rejects %s', (_description, value) => {
    expect(appSecurityInstructionsSchema.safeParse(value).success).toBe(false)
  })
})
