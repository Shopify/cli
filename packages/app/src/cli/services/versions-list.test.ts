import {getAppVersions} from './versions-list.js'
import {appVersionsListJsonOutputSchema} from './versions-list/types.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../models/app/app.test-data.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {describe, expect, test} from 'vitest'

const remoteApp = testOrganizationApp({apiKey: 'api-key'})

function appVersionsResponse(): AppVersionsQuerySchema {
  return {
    app: {
      id: 'app-id',
      title: 'app-title',
      organizationId: 'org-id',
      appVersions: {
        nodes: [
          {
            message: 'message',
            versionTag: 'versionTag',
            versionId: 'gid://shopify/Version/1',
            status: 'active',
            createdAt: '2021-01-01',
            createdBy: {displayName: 'createdBy'},
          },
          {
            message: null,
            versionTag: null,
            versionId: 'gid://shopify/Version/2',
            status: 'released',
            createdAt: '2021-01-02',
            createdBy: {displayName: null},
          },
          {
            versionId: 'gid://shopify/Version/3',
            status: 'released',
            createdAt: '2021-01-03',
          },
        ],
        pageInfo: {totalResults: 31},
      },
    },
  }
}

describe('getAppVersions', () => {
  test('returns the existing JSON values and omission behavior as typed data', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersions: () => Promise.resolve(appVersionsResponse()),
    })

    const result = await getAppVersions(developerPlatformClient, remoteApp)

    expect(result).toEqual({
      appVersions: [
        {
          createdAt: '2021-01-01 00:00:00',
          createdBy: 'createdBy',
          versionTag: 'versionTag',
          status: 'active',
          versionId: 'gid://shopify/Version/1',
          message: 'message',
        },
        {
          createdAt: '2021-01-02 00:00:00',
          createdBy: '',
          versionTag: null,
          status: 'released',
          versionId: 'gid://shopify/Version/2',
          message: '',
        },
        {
          createdAt: '2021-01-03 00:00:00',
          createdBy: '',
          status: 'released',
          versionId: 'gid://shopify/Version/3',
          message: '',
        },
      ],
      totalResults: 31,
    })

    expect(appVersionsListJsonOutputSchema.encode(result.appVersions)).toMatchInlineSnapshot(`
      "[
        {
          "createdAt": "2021-01-01 00:00:00",
          "createdBy": "createdBy",
          "versionTag": "versionTag",
          "status": "active",
          "versionId": "gid://shopify/Version/1",
          "message": "message"
        },
        {
          "createdAt": "2021-01-02 00:00:00",
          "createdBy": "",
          "versionTag": null,
          "status": "released",
          "versionId": "gid://shopify/Version/2",
          "message": ""
        },
        {
          "createdAt": "2021-01-03 00:00:00",
          "createdBy": "",
          "status": "released",
          "versionId": "gid://shopify/Version/3",
          "message": ""
        }
      ]"
    `)
  })

  test('throws the factual error when the API response does not contain an app', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersions: () => Promise.resolve({app: null}),
    })

    await expect(getAppVersions(developerPlatformClient, remoteApp)).rejects.toThrow(
      'Shopify did not return app information for API key api-key.',
    )
  })

  test('rejects invalid result values', () => {
    expect(() =>
      appVersionsListJsonOutputSchema.validate([
        {
          createdAt: '2021-01-01',
          createdBy: 1,
          versionTag: 'versionTag',
          status: 'active',
          versionId: 'versionId',
          message: 'message',
        },
      ]),
    ).toThrow()
  })
})
