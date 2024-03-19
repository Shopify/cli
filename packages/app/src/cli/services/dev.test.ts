import {actionsBeforeSettingUpDevProcesses, developerPreviewController} from './dev.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {testAppWithConfig, testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {AppInterface, CurrentAppConfiguration} from '../models/app/app.js'
import {SpecsAppConfiguration} from '../models/extensions/specifications/types/app_config.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('./dev/fetch.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('developerPreviewController', () => {
  test('does not refresh the tokens when they are still valid', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(developerPlatformClient.refreshToken).not.toHaveBeenCalled()
  })
  test('refreshes the tokens when they expire', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockRejectedValueOnce(new Error('expired token'))
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(developerPlatformClient.refreshToken).toHaveBeenCalledOnce()
    expect(fetchAppPreviewMode).toHaveBeenCalledTimes(2)
  })
})

describe('actionsBeforeSettingUpDevProcesses', () => {
  test('shows a warning when the local and remote scopes are different', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const localApp: AppInterface = testAppWithConfig()

    // When
    await actionsBeforeSettingUpDevProcesses(localApp, undefined)

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  The scopes in your TOML don't match the scopes in your Partner Dashboard    │
      │                                                                              │
      │  Scopes in shopify.app.toml:                                                 │
      │    • read_products                                                           │
      │                                                                              │
      │   Scopes in Partner Dashboard:                                               │
      │    • No scopes                                                               │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Run \`yarn shopify app deploy\` to push your scopes to the Partner        │
      │      Dashboard                                                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('does nothing when the local and remote scopes are the same, but in different order', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const localApp: AppInterface = testAppWithConfig()
    const config: CurrentAppConfiguration = localApp.configuration as CurrentAppConfiguration
    config.access_scopes = {
      scopes: 'write_products,read_products',
    }
    const remoteConfig: SpecsAppConfiguration = {
      name: 'name',
      application_url: 'application_url',
      embedded: false,
      access_scopes: {
        scopes: 'read_products,write_products',
      },
    }

    // When
    await actionsBeforeSettingUpDevProcesses(localApp, remoteConfig)

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot('""')
  })
})
