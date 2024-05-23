import {versionDiffByVersion} from './version-diff.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppVersionByTagSchema} from '../../api/graphql/app_version_by_tag.js'
import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {describe, expect, test} from 'vitest'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('versionDiffByVersion', () => {
  test('throws an abort silent error and display an error message when the version is not found', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersionByTag: () => {
        throw new Error('not found')
      },
    })

    // When/Then
    await expect(versionDiffByVersion(testOrganizationApp(), 'version', developerPlatformClient)).rejects.toThrow(
      AbortSilentError,
    )
    expect(outputMock.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Version couldn't be released.                                               │
      │                                                                              │
      │  Version version could not be found.                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('returns versionDiff and versionDetails when the version is found', async () => {
    // Given
    const versionDetails: AppVersionByTagSchema = {
      app: {
        appVersion: {
          id: 1,
          uuid: 'uuid',
          versionTag: 'versionTag',
          location: 'location',
          message: 'message',
          appModuleVersions: [],
        },
      },
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
    expect(result).toEqual({versionsDiff: versionsDiff.app.versionsDiff, versionDetails: versionDetails.app.appVersion})
  })
})
