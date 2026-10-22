import {
  appSecurityAppSchema,
  appSecurityBlockingSchema,
  appSecurityInstructionsSchema,
  appSecurityScanDirectorySchema,
  appSecurityScopeSchema,
} from './types.js'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const nativeConfigurationPath = onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml'

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
