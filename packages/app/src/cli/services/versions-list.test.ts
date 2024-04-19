import versionList from './versions-list.js'
import {ensureVersionsListContext, renderCurrentlyUsedConfigInfo} from './context.js'
import {testApp, testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {Organization} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../models/app/identifiers.js')
vi.mock('./context.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

const ORG1: Organization = {
  id: 'org-id',
  businessName: 'name of org 1',
  website: '',
}

function buildDeveloperPlatformClient(): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    orgFromId: (_orgId: string) => Promise.resolve(ORG1),
  })
}

describe('versions-list', () => {
  beforeEach(() => {
    vi.mocked(ensureVersionsListContext).mockResolvedValue({
      developerPlatformClient: buildDeveloperPlatformClient(),
      remoteApp: {
        id: 'app-id',
        apiKey: 'app-api-key',
        title: 'app-title',
        organizationId: ORG1.id,
        apiSecretKeys: [],
        grantedScopes: [],
        flags: [],
      },
    })
    // vi.mocked(fetchOrgFromId).mockResolvedValue(ORG1)
  })

  test('ensures there is a valid context to execute `versions list`', async () => {
    // Given
    const app = testApp({})

    // When
    await versionList({
      app,
      reset: false,
      json: false,
    })

    // Then
    expect(ensureVersionsListContext).toHaveBeenCalledWith({
      app,
      reset: false,
      json: false,
    })
  })

  test('show a message when there are no app versions', async () => {
    // Given
    const app = testApp({})
    const outputMock = mockAndCaptureOutput()

    // When
    await versionList({
      app,
      reset: false,
      json: false,
    })

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`"No app versions found for this app"`)
  })

  test('show currently used config info', async () => {
    // Given
    const app = testApp({})

    // When
    await versionList({
      app,
      reset: false,
      json: false,
    })

    // Then
    expect(renderCurrentlyUsedConfigInfo).toHaveBeenCalledWith({
      org: 'name of org 1',
      appName: 'app-title',
      configFile: undefined,
    })
  })

  test('throw error when there is no app', async () => {
    // Given
    const app = testApp({})
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appVersions: (_appId) => Promise.resolve({app: null}),
    })

    // When
    const output = versionList({
      app,
      reset: false,
      json: false,
      developerPlatformClient,
    })

    // Then
    await expect(output).rejects.toThrow('Invalid API Key: app-api-key')
  })

  // asserting the exact format of the table is hard to do consistently across different environments
  const terminalWidth = process.stdout.columns

  test.skipIf(terminalWidth !== undefined)('render table when there are app versions', async () => {
    // Given
    const app = testApp({})
    const mockOutput = mockAndCaptureOutput()
    const appVersionsResult: AppVersionsQuerySchema = {
      app: {
        id: 'appId',
        title: 'title',
        appVersions: {
          nodes: [
            {
              message: 'message',
              versionTag: 'versionTag',
              status: 'active',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy'},
              distributionPercentage: 100,
            },
            {
              message: 'message 2',
              versionTag: 'versionTag 2',
              status: 'released',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy 2'},
              distributionPercentage: 0,
            },
            {
              message: 'long message with more than 15 characters',
              versionTag: 'versionTag 3',
              status: 'released',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy 3'},
              distributionPercentage: 0,
            },
          ],
          pageInfo: {totalResults: 31},
        },
        organizationId: 'orgId',
      },
    }
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appVersions: (_appId) => Promise.resolve(appVersionsResult),
    })

    // When
    await versionList({
      app,
      apiKey: 'apiKey',
      reset: false,
      json: false,
      developerPlatformClient,
    })

    // Then
    expect(mockOutput.info())
      .toMatchInlineSnapshot(`"VERSION       STATUS    MESSAGE        DATE CREATED         CREATED BY
────────────  ────────  ─────────────  ───────────────────  ───────────
versionTag    ★ active  message        2021-01-01 00:00:00  createdBy
versionTag 2  released  message 2      2021-01-01 00:00:00  createdBy 2
versionTag 3  released  long messa...  2021-01-01 00:00:00  createdBy 3

View all 31 app versions in the Partner Dashboard ( https://partners.shopify.com/org-id/apps/app-id/versions )"`)
  })

  test('render json when there are app versions', async () => {
    // Given
    const app = testApp({})

    const mockOutput = mockAndCaptureOutput()
    const appVersionsResult: AppVersionsQuerySchema = {
      app: {
        id: 'appId',
        title: 'title',
        appVersions: {
          nodes: [
            {
              message: 'message',
              versionTag: 'versionTag',
              status: 'active',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy'},
              distributionPercentage: 100,
            },
            {
              message: 'long message with more than 15 characters',
              versionTag: 'versionTag 3',
              status: 'released',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy 3'},
              distributionPercentage: 0,
            },
          ],
          pageInfo: {totalResults: 31},
        },
        organizationId: 'orgId',
      },
    }
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appVersions: (_appId) => Promise.resolve(appVersionsResult),
    })

    // When
    await versionList({
      app,
      apiKey: 'apiKey',
      reset: false,
      json: true,
      developerPlatformClient,
    })

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "[
        {
          \\"message\\": \\"message\\",
          \\"versionTag\\": \\"versionTag\\",
          \\"status\\": \\"active\\",
          \\"createdAt\\": \\"2021-01-01 00:00:00\\",
          \\"createdBy\\": \\"createdBy\\",
          \\"distributionPercentage\\": 100
        },
        {
          \\"message\\": \\"long message with more than 15 characters\\",
          \\"versionTag\\": \\"versionTag 3\\",
          \\"status\\": \\"released\\",
          \\"createdAt\\": \\"2021-01-01 00:00:00\\",
          \\"createdBy\\": \\"createdBy 3\\",
          \\"distributionPercentage\\": 0
        }
      ]"
    `)
  })
})
