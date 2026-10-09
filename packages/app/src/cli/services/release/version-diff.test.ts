import {versionDiffByVersion} from './version-diff.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppVersionWithContext} from '../../utilities/developer-platform-client.js'
import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('versionDiffByVersion', () => {
  test('reports the failed lookup as an abort without presentation', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const cause = new AbortError('HTTP 404: Cannot find a valid organization')
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersionByTag: () => {
        throw cause
      },
    })

    // When/Then
    const result = versionDiffByVersion(testOrganizationApp(), 'version', developerPlatformClient)
    await expect(result).rejects.toThrow(AbortError)
    await expect(result).rejects.toThrow('Version version could not be found.')
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
