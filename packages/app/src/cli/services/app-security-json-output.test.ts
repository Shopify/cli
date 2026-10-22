import {
  appSecurityAppSchema,
  appSecurityBlockingSchema,
  appSecurityInstructionsSchema,
  appSecurityScanDirectorySchema,
  appSecurityScopeSchema,
  projectAppSecurityApp,
  projectAppSecurityBlocking,
  projectAppSecurityInstructions,
  projectAppSecurityPath,
  projectAppSecurityRelativePath,
  projectAppSecurityScanDirectory,
  projectAppSecurityScope,
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

describe('projectAppSecurityRelativePath', () => {
  test.each([
    [
      'a file in the app directory',
      'app/routes/orders.tsx',
      onWindows ? 'C:\\apps\\my-app\\app\\routes\\orders.tsx' : '/apps/my-app/app/routes/orders.tsx',
    ],
    ['the app directory', '.', appDirectory],
    ['a directory beside the app directory', '../backend', onWindows ? 'C:\\apps\\backend' : '/apps/backend'],
    ['an absolute path', onWindows ? 'D:/shared' : '/shared', onWindows ? 'D:\\shared' : '/shared'],
  ])('resolves %s against the app directory, with native separators', (_description, path, expected) => {
    expect(projectAppSecurityRelativePath(appDirectory, path)).toBe(expected)
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

describe('projectAppSecurityScope', () => {
  test('keeps the values exactly as typed', () => {
    expect(
      projectAppSecurityScope({include_dirs: ['../backend', 'web/'], excludes: ['vendor/**'], no_git_ignore: true}),
    ).toStrictEqual({includeDirs: ['../backend', 'web/'], excludes: ['vendor/**'], noGitIgnore: true})
  })
})

describe('appSecurityScopeSchema', () => {
  const scope = {includeDirs: ['../backend'], excludes: [], noGitIgnore: false}

  test('accepts a projected scope', () => {
    expect(appSecurityScopeSchema.parse(scope)).toStrictEqual(scope)
  })

  test.each([
    ['an extra field', {...scope, include_dirs: []}],
    ['a missing field', {includeDirs: [], excludes: []}],
  ])('rejects %s', (_description, value) => {
    expect(appSecurityScopeSchema.safeParse(value).success).toBe(false)
  })
})

describe('projectAppSecurityScanDirectory', () => {
  test.each([
    ['app_directory', '.', 'app-directory', appDirectory],
    ['include_dir', '../backend', 'include-dir', onWindows ? 'C:\\apps\\backend' : '/apps/backend'],
    [
      'app_config_directory',
      'extensions/theme',
      'app-config-directory',
      onWindows ? 'C:\\apps\\my-app\\extensions\\theme' : '/apps/my-app/extensions/theme',
    ],
  ] as const)('projects a %s directory', (origin, directory, expectedOrigin, expectedDirectory) => {
    expect(projectAppSecurityScanDirectory(appDirectory, {directory, origin})).toStrictEqual({
      directory: expectedDirectory,
      origin: expectedOrigin,
    })
  })

  test('keeps an absolute directory', () => {
    const directory = onWindows ? 'C:/apps/my-app/web' : '/apps/my-app/web'

    expect(projectAppSecurityScanDirectory(appDirectory, {directory, origin: 'app_config_directory'})).toStrictEqual({
      directory: onWindows ? 'C:\\apps\\my-app\\web' : '/apps/my-app/web',
      origin: 'app-config-directory',
    })
  })
})

describe('appSecurityScanDirectorySchema', () => {
  const scanDirectory = {directory: appDirectory, origin: 'app-directory'}

  test('accepts a projected scan directory', () => {
    expect(appSecurityScanDirectorySchema.parse(scanDirectory)).toStrictEqual(scanDirectory)
  })

  test.each([
    ['an extra field', {...scanDirectory, path: appDirectory}],
    ['a relative directory', {...scanDirectory, directory: '.'}],
    ['a stored origin', {...scanDirectory, origin: 'app_directory'}],
  ])('rejects %s', (_description, value) => {
    expect(appSecurityScanDirectorySchema.safeParse(value).success).toBe(false)
  })
})

describe('projectAppSecurityBlocking', () => {
  test.each([
    ['high', 2],
    ['none', 0],
  ] as const)('projects the %s level and its blocked checks', (level, blockedChecks) => {
    expect(projectAppSecurityBlocking({level, blockedChecks})).toStrictEqual({level, blockedCheckCount: blockedChecks})
  })
})

describe('appSecurityBlockingSchema', () => {
  test.each(['high', 'medium', 'low', 'none'])('accepts the %s level', (level) => {
    expect(appSecurityBlockingSchema.parse({level, blockedCheckCount: 0})).toStrictEqual({level, blockedCheckCount: 0})
  })

  test.each([
    ['an extra field', {level: 'high', blockedCheckCount: 1, blockedChecks: 1}],
    ['an unknown level', {level: 'critical', blockedCheckCount: 1}],
    ['a negative count', {level: 'high', blockedCheckCount: -1}],
    ['a fractional count', {level: 'high', blockedCheckCount: 0.5}],
  ])('rejects %s', (_description, value) => {
    expect(appSecurityBlockingSchema.safeParse(value).success).toBe(false)
  })
})
