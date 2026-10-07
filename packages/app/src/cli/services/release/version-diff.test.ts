import {ReleaseVersionLookupError, versionDiffByVersion} from './version-diff.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppVersionWithContext} from '../../utilities/developer-platform-client.js'
import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('versionDiffByVersion', () => {
  test('reports the failed lookup without presentation and retains its cause', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const cause = new Error('not found')
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersionByTag: () => {
        throw cause
      },
    })

    // When/Then
    const result = versionDiffByVersion(testOrganizationApp(), 'version', developerPlatformClient)
    await expect(result).rejects.toThrow(ReleaseVersionLookupError)
    await expect(result).rejects.toMatchObject({versionTag: 'version', cause})
    expect(outputMock.error()).toBe('')
  })

  test('returns versionDiff and versionDetails when the version is found', async () => {
    // Given
    const versionDetails: AppVersionWithContext = {
      id: 1,
      uuid: 'uuid',
      versionTag: 'versionTag',
      location: 'location',
      message: 'message',
      appModuleVersions: [],
    }
    const versionsDiff: AppVersionsDiffSchema = {
      app: {
        versionsDiff: {
          added: [
            {
              registrationTitle: 'Extension 1',
              uuid: 'uuid1',
              specification: {
                identifier: 'app_access',
                experience: 'configuration',
                options: {
                  managementExperience: 'cli',
                },
              },
            },
          ],
          updated: [
            {
              registrationTitle: 'Extension 2',
              uuid: 'uuid2',
              specification: {
                identifier: 'flow_action_definition',
                experience: 'legacy',
                options: {
                  managementExperience: 'dashboard',
                },
              },
            },
          ],
          removed: [
            {
              registrationTitle: 'Extension 3',
              uuid: 'uuid3',
              specification: {
                identifier: 'post_purchase_ui_extension',
                experience: 'extension',
                options: {
                  managementExperience: 'cli',
                },
              },
            },
          ],
        },
      },
    }

    const developerPlatformClient = testDeveloperPlatformClient({
      appVersionByTag: () => Promise.resolve(versionDetails),
      appVersionsDiff: () => Promise.resolve(versionsDiff),
    })

    // When
    const result = await versionDiffByVersion(testOrganizationApp(), 'version', developerPlatformClient)

    // Then
    expect(result).toEqual({versionsDiff: versionsDiff.app.versionsDiff, versionDetails})
  })
})
