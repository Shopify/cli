import versionList from './versions-list.js'
import {fetchOrCreateOrganizationApp, renderCurrentlyUsedConfigInfo} from './context.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {testApp} from '../models/app/app.test-data.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization} from '../models/organization.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('../models/app/identifiers.js')
vi.mock('./context.js')
vi.mock('./dev/fetch.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

const emptyResult = {
  app: {
    appVersions: {nodes: [], pageInfo: {totalResults: 0}},
    organizationId: 'orgId',
    title: 'my app',
  },
}

const ORG1: Organization = {
  id: '1',
  businessName: 'name of org 1',
  website: '',
}

describe('versions-list', () => {
  beforeEach(() => {
    vi.mocked(fetchOrgFromId).mockResolvedValue(ORG1)
  })

  test('show a message when there are no app versions', async () => {
    // Given
    const app = await testApp({})
    const outputMock = mockAndCaptureOutput()
    vi.mocked(partnersRequest).mockResolvedValueOnce(emptyResult)

    // When
    await versionList({app, apiKey: 'apiKey'})

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`"No app versions found for this app"`)
  })

  test('throw error when there is no app', async () => {
    // Given
    const app = await testApp({})
    vi.mocked(partnersRequest).mockResolvedValueOnce({app: null})

    // When
    const output = versionList({app, apiKey: '1235'})

    // Then
    await expect(output).rejects.toThrow('Invalid API Key: 1235')
  })

  test('use apikey from env if its not passed via flag', async () => {
    // Given
    const app = await testApp({})
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(getAppIdentifiers).mockReturnValue({app: 'env-app-id'})
    vi.mocked(partnersRequest).mockResolvedValueOnce(emptyResult)

    // When
    await versionList({app})

    // Then
    expect(vi.mocked(partnersRequest)).toHaveBeenCalledWith(expect.anything(), 'token', {apiKey: 'env-app-id'})
    expect(vi.mocked(fetchOrCreateOrganizationApp)).not.toHaveBeenCalled()
  })

  test('use client_id from linked toml if no env ids or flags', async () => {
    // Given
    const app = await testApp({}, 'current')
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(partnersRequest).mockResolvedValueOnce(emptyResult)

    // When
    await versionList({app})

    // Then
    expect(vi.mocked(partnersRequest)).toHaveBeenCalledWith(expect.anything(), 'token', {
      apiKey: app.configuration.client_id,
    })
    expect(vi.mocked(fetchOrCreateOrganizationApp)).not.toHaveBeenCalled()
    expect(renderCurrentlyUsedConfigInfo).toHaveBeenCalledWith({
      appName: 'my app',
      org: 'name of org 1',
      configFile: 'shopify.app.toml',
    })
  })

  test('select app if no apiKey is provided and there isnt one cached', async () => {
    // Given
    const app = await testApp({})
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
      id: 'app-id',
      apiKey: 'app-api-key',
      title: 'app-title',
      organizationId: 'org-id',
      apiSecretKeys: [],
      grantedScopes: [],
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: ['https://example.com/callback1'],
    })
    vi.mocked(partnersRequest).mockResolvedValueOnce(emptyResult)

    // When
    await versionList({app})

    // Then
    expect(vi.mocked(partnersRequest)).toHaveBeenCalledWith(expect.anything(), 'token', {apiKey: 'app-api-key'})
    expect(renderCurrentlyUsedConfigInfo).toHaveBeenCalledWith({
      appName: 'my app',
      org: 'name of org 1',
      configFile: undefined,
    })
  })

  test('render table when there are app versions', async () => {
    // Given
    const app = await testApp({})
    const mockOutput = mockAndCaptureOutput()
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      app: {
        id: 'appId',
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
    })

    // When
    await versionList({app, apiKey: 'apiKey'})

    // Then
    expect(mockOutput.info())
      .toMatchInlineSnapshot(`"VERSION       STATUS    MESSAGE        DATE CREATED         CREATED BY
────────────  ────────  ─────────────  ───────────────────  ───────────
versionTag    ★ active  message        2021-01-01 00:00:00  createdBy
versionTag 2  released  message 2      2021-01-01 00:00:00  createdBy 2
versionTag 3  released  long messa...  2021-01-01 00:00:00  createdBy 3

View all 31 app versions in the Partner Dashboard ( https://partners.shopify.com/orgId/apps/appId/versions )"`)
  })
})
