import {warnIfScopesDifferBeforeDev} from './dev.js'
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
