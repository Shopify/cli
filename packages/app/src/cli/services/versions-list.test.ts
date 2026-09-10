import {appVersionsListJsonOutputSchema, getAppVersions} from './versions-list.js'
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
            status: 'active',
            createdAt: '2021-01-01',
            createdBy: {displayName: 'createdBy'},
          },
          {
            message: null,
            versionTag: null,
            status: 'released',
            createdAt: '2021-01-02',
            createdBy: {displayName: null},
          },
          {
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
          message: 'message',
          versionTag: 'versionTag',
          status: 'active',
          createdAt: '2021-01-01 00:00:00',
          createdBy: 'createdBy',
        },
        {
          message: '',
          versionTag: null,
          status: 'released',
          createdAt: '2021-01-02 00:00:00',
          createdBy: '',
        },
        {
          message: '',
          status: 'released',
          createdAt: '2021-01-03 00:00:00',
          createdBy: '',
        },
      ],
      totalResults: 31,
    })
    if (!result) throw new Error('Expected app versions result')

    expect(appVersionsListJsonOutputSchema.encode(result.appVersions)).toMatchInlineSnapshot(`
      "[
        {
          "message": "message",
          "versionTag": "versionTag",
          "status": "active",
          "createdAt": "2021-01-01 00:00:00",
          "createdBy": "createdBy"
        },
        {
          "message": "",
          "versionTag": null,
          "status": "released",
          "createdAt": "2021-01-02 00:00:00",
          "createdBy": ""
        },
        {
          "message": "",
          "status": "released",
          "createdAt": "2021-01-03 00:00:00",
          "createdBy": ""
        }
      ]"
    `)
  })

  test('returns undefined when the API response does not contain an app', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersions: () => Promise.resolve({app: null}),
    })

    await expect(getAppVersions(developerPlatformClient, remoteApp)).resolves.toBeUndefined()
  })

  test('rejects invalid result values', () => {
    expect(() =>
      appVersionsListJsonOutputSchema.validate([
        {message: 'message', versionTag: 'versionTag', status: 'active', createdAt: '2021-01-01', createdBy: 1},
      ]),
    ).toThrow()
  })
})
