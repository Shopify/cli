import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../../models/organization.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/versions-list/result.js')

const originalUnitTestEnvironment = process.env.SHOPIFY_UNIT_TEST

afterEach(() => {
  if (originalUnitTestEnvironment === undefined) {
    delete process.env.SHOPIFY_UNIT_TEST
  } else {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnvironment
  }
  vi.resetModules()
})

describe('app versions list command', () => {
  test('passes the typed result to the JSON output boundary', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()

    const organization: Organization = {
      id: 'org-id',
      businessName: 'name of org 1',
      source: OrganizationSource.BusinessPlatform,
    }
    const app = testAppLinked({})
    const remoteApp = testOrganizationApp({organizationId: organization.id, apiKey: 'api-key'})
    const developerPlatformClient = testDeveloperPlatformClient({
      appVersions: () =>
        Promise.resolve({
          app: {
            id: 'app-id',
            title: 'app-title',
            organizationId: organization.id,
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
              ],
              pageInfo: {totalResults: 1},
            },
          },
        }),
    })
    const {linkedAppContext} = await import('../../../services/app-context.js')
    const {renderAppVersionsListResult} = await import('../../../services/versions-list/result.js')
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp,
      organization,
      developerPlatformClient,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    const {default: VersionsList} = await import('./list.js')

    await VersionsList.run(['--json'], import.meta.url)

    expect(renderAppVersionsListResult).toHaveBeenCalledWith(
      {
        app,
        remoteApp,
        organization,
        developerPlatformClient,
        appVersions: [
          {
            message: 'message',
            versionTag: 'versionTag',
            status: 'active',
            createdAt: '2021-01-01 00:00:00',
            createdBy: 'createdBy',
            versionId: 'gid://shopify/Version/1',
          },
        ],
        totalResults: 1,
      },
      'json',
    )
  })

  test('keeps the existing invalid API key error', async () => {
    const app = testAppLinked({})
    const remoteApp = testOrganizationApp({apiKey: 'api-key'})
    const {linkedAppContext} = await import('../../../services/app-context.js')
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp,
      organization: {
        id: 'org-id',
        businessName: 'name of org 1',
        source: OrganizationSource.BusinessPlatform,
      },
      developerPlatformClient: testDeveloperPlatformClient({
        appVersions: () => Promise.resolve({app: null}),
      }),
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    const {default: VersionsList} = await import('./list.js')
    vi.spyOn(VersionsList.prototype, 'catch').mockImplementation(async (error) => {
      throw error
    })

    await expect(VersionsList.run(['--json'], import.meta.url)).rejects.toThrow('Invalid API Key: api-key')
  })
})
