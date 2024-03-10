import {configExtensionsIdentifiersBreakdown, extensionsIdentifiersDeployBreakdown} from './breakdown-extensions.js'
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
      onlyRemote: [],
      toCreate: [],
      toUpdate: [],
      fromDashboard: [],
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
