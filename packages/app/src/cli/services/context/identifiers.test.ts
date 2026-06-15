import {
  buildExtensionBreakdownInfo,
  configExtensionsIdentifiersBreakdown,
  ExtensionIdentifierBreakdownInfo,
  extensionsIdentifiersDeployBreakdown,
} from './breakdown-extensions.js'
import {ensureDeploymentIdsPresence} from './identifiers.js'
import {deployConfirmed} from './identifiers-extensions.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {testApp, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

vi.mock('./breakdown-extensions.js')
vi.mock('../../prompts/deploy-release.js')
vi.mock('./identifiers-extensions.js')

describe('ensureDeploymentIdsPresence', () => {
  test('when the prompt is not confirmed an exception is thrown', async () => {
    // Given
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(buildExtensionsBreakdown())
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(false)

    // When / Then
    const params = {
      app: testApp(),
      developerPlatformClient,
      appId: 'appId',
      appName: 'appName',
      remoteApp: testOrganizationApp(),
      envIdentifiers: {},
      force: false,
      release: true,
    }
    await expect(ensureDeploymentIdsPresence(params)).rejects.toThrow(AbortSilentError)
  })

  test('when there are remote-only extensions and not forced, appInstallCount is called with remoteApp.id', async () => {
    // Given
    const breakdown = buildExtensionsBreakdown()
    breakdown.extensionIdentifiersBreakdown.onlyRemote = [buildExtensionBreakdownInfo('removed', 'uuid-1')]
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(breakdown)
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(false)

    const remoteApp = testOrganizationApp({id: 'real-app-id', apiKey: 'api-key-different'})
    const client = testDeveloperPlatformClient({
      appInstallCount: vi.fn().mockResolvedValue(42),
    })

    const params = {
      app: testApp(),
      developerPlatformClient: client,
      appId: 'api-key-different',
      appName: 'appName',
      remoteApp,
      envIdentifiers: {},
      force: false,
      release: true,
    }

    // When
    await expect(ensureDeploymentIdsPresence(params)).rejects.toThrow()

    // Then
    expect(client.appInstallCount).toHaveBeenCalledWith({
      id: 'real-app-id',
      apiKey: 'api-key-different',
      organizationId: remoteApp.organizationId,
    })
  })

  test('when force is true, appInstallCount is not called even with remote-only extensions', async () => {
    // Given
    const breakdown = buildExtensionsBreakdown()
    breakdown.extensionIdentifiersBreakdown.onlyRemote = [buildExtensionBreakdownInfo('removed', 'uuid-1')]
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(breakdown)
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(deployConfirmed).mockResolvedValue({
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    })

    const client = testDeveloperPlatformClient({
      appInstallCount: vi.fn().mockResolvedValue(42),
    })

    const params = {
      app: testApp(),
      developerPlatformClient: client,
      appId: 'appId',
      appName: 'appName',
      remoteApp: testOrganizationApp(),
      envIdentifiers: {},
      force: true,
      release: true,
    }

    // When
    await ensureDeploymentIdsPresence(params)

    // Then
    expect(client.appInstallCount).not.toHaveBeenCalled()
  })

  test('when allowUpdates and allowDeletes are both true, appInstallCount is not called', async () => {
    // Given
    const breakdown = buildExtensionsBreakdown()
    breakdown.extensionIdentifiersBreakdown.onlyRemote = [buildExtensionBreakdownInfo('removed', 'uuid-1')]
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(breakdown)
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(deployConfirmed).mockResolvedValue({
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    })

    const client = testDeveloperPlatformClient({
      appInstallCount: vi.fn().mockResolvedValue(42),
    })

    const params = {
      app: testApp(),
      developerPlatformClient: client,
      appId: 'appId',
      appName: 'appName',
      remoteApp: testOrganizationApp(),
      envIdentifiers: {},
      force: false,
      allowUpdates: true,
      allowDeletes: true,
      release: true,
    }

    // When
    await ensureDeploymentIdsPresence(params)

    // Then
    expect(client.appInstallCount).not.toHaveBeenCalled()
  })

  test('when appInstallCount throws, installCount is undefined and deploy proceeds', async () => {
    // Given
    const breakdown = buildExtensionsBreakdown()
    breakdown.extensionIdentifiersBreakdown.onlyRemote = [buildExtensionBreakdownInfo('removed', 'uuid-1')]
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(breakdown)
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(deployConfirmed).mockResolvedValue({
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    })

    const client = testDeveloperPlatformClient({
      appInstallCount: vi.fn().mockRejectedValue(new Error('API error')),
    })

    const params = {
      app: testApp(),
      developerPlatformClient: client,
      appId: 'appId',
      appName: 'appName',
      remoteApp: testOrganizationApp(),
      envIdentifiers: {},
      force: false,
      release: true,
    }

    // When
    await ensureDeploymentIdsPresence(params)

    // Then - installCount should be undefined in the prompt call
    expect(deployOrReleaseConfirmationPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        installCount: undefined,
      }),
    )
  })

  test('when the prompt is confirmed post-confirmation actions as run and the result is returned', async () => {
    // Given
    vi.mocked(extensionsIdentifiersDeployBreakdown).mockResolvedValue(buildExtensionsBreakdown())
    vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigBreakdown())
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(deployConfirmed).mockResolvedValue({
      extensions: {
        EXTENSION_A: 'UUID_A',
      },
      extensionIds: {EXTENSION_A: 'A'},
      extensionsNonUuidManaged: {},
    })

    // When
    const params = {
      app: testApp(),
      developerPlatformClient,
      appId: 'appId',
      appName: 'appName',
      remoteApp: testOrganizationApp(),
      envIdentifiers: {},
      force: false,
      release: true,
    }
    const result = await ensureDeploymentIdsPresence(params)

    // Then
    expect(result).toEqual({
      app: params.appId,
      extensions: {
        EXTENSION_A: 'UUID_A',
      },
      extensionIds: {EXTENSION_A: 'A'},
      extensionsNonUuidManaged: {},
    })
  })
})

function buildExtensionsBreakdown() {
  return {
    extensionIdentifiersBreakdown: {
      onlyRemote: [] as ExtensionIdentifierBreakdownInfo[],
      toCreate: [],
      toUpdate: [],
      fromDashboard: [],
      unchanged: [],
    },
    extensionsToConfirm: {
      validMatches: {},
      extensionsToCreate: [],
      dashboardOnlyExtensions: [],
    },
    remoteExtensionsRegistrations: {
      extensionRegistrations: [],
      configurationRegistrations: [],
      dashboardManagedExtensionRegistrations: [],
    },
  }
}

function buildConfigBreakdown() {
  return {
    existingFieldNames: [],
    existingUpdatedFieldNames: [],
    newFieldNames: [],
    deletedFieldNames: [],
  }
}
