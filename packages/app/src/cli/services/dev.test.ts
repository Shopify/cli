import {warnIfScopesDifferBeforeDev, blockIfMigrationIncomplete} from './dev.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('./dev/fetch.js')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('../utilities/mkcert.js')

describe('warnIfScopesDifferBeforeDev', () => {
  const appsWithScopes = (local: string, remote: string) => {
    const localApp = testAppLinked({})
    const remoteApp = testOrganizationApp()
    localApp.configuration = {
      ...localApp.configuration,
      access_scopes: {scopes: local, use_legacy_install_flow: false},
    }
    remoteApp.configuration = {
      ...remoteApp.configuration,
      access_scopes: {scopes: remote, use_legacy_install_flow: false},
    } as any
    return {
      localApp,
      remoteApp,
    }
  }

  test('does not warn if the scopes are the same', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})
    const apps = appsWithScopes('scopes1,scopes2', 'scopes1,scopes2')

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toBe('')
  })

  test('warns if the scopes differ', async () => {
    // Given
    const apps = appsWithScopes('scopes1,scopes2', 'scopes3,scopes4')
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toContain("The scopes in your TOML don't match")
  })

  test('silent if scopes differ cosmetically', async () => {
    // Given
    const apps = appsWithScopes('scopes1,      scopes2 ', '  scopes2,     scopes1')
    const developerPlatformClient = testDeveloperPlatformClient({supportsDevSessions: false})

    // When
    const mockOutput = mockAndCaptureOutput()
    mockOutput.clear()
    await warnIfScopesDifferBeforeDev({...apps, developerPlatformClient})

    // Then
    expect(mockOutput.warn()).toBe('')
  })
})

describe('blockIfMigrationIncomplete', () => {
  const baseConfig = () => ({
    localApp: testAppLinked({}),
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient({supportsDevSessions: true}),
  })

  test('does nothing when dev sessions not supported', async () => {
    const devConfig = {
      ...baseConfig(),
      developerPlatformClient: testDeveloperPlatformClient({supportsDevSessions: false}),
    } as any
    await expect(blockIfMigrationIncomplete(devConfig)).resolves.toBeUndefined()
  })

  test('does nothing when all remote extensions have ids (migrated)', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDevSessions: true,
      async appExtensionRegistrations() {
        return {
          app: {
            extensionRegistrations: [
              {id: '1', uuid: 'u1', title: 'Ext 1', type: 'theme'},
              {id: '2', uuid: 'u2', title: 'Ext 2', type: 'web_pixel_extension'},
            ],
            configurationRegistrations: [],
            dashboardManagedExtensionRegistrations: [],
          },
        } as any
      },
    })

    const devConfig = {
      ...baseConfig(),
      developerPlatformClient,
    } as any

    await expect(blockIfMigrationIncomplete(devConfig)).resolves.toBeUndefined()
  })

  test('throws AbortError when some remote extensions are missing ids (not migrated)', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDevSessions: true,
      async appExtensionRegistrations() {
        return {
          app: {
            extensionRegistrations: [
              {id: '', uuid: 'u1', title: 'Legacy Ext 1', type: 'theme'},
              {uuid: 'u2', title: 'Legacy Ext 2', type: 'web_pixel_extension'},
            ],
            configurationRegistrations: [],
            dashboardManagedExtensionRegistrations: [],
          },
        } as any
      },
    })

    const devConfig = {
      ...baseConfig(),
      developerPlatformClient,
    } as any

    await expect(blockIfMigrationIncomplete(devConfig)).rejects.toThrow(/need to be migrated/)
  })
})
