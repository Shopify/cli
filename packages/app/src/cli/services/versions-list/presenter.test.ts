import {renderAppVersionsList} from './presenter.js'
import {renderCurrentlyUsedConfigInfo} from '../context.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../models/organization.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../context.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

const organization: Organization = {
  id: 'org-id',
  businessName: 'name of org 1',
  source: OrganizationSource.BusinessPlatform,
}

const remoteApp = testOrganizationApp({organizationId: organization.id, title: 'app-title', id: 'app-id'})

function buildDeveloperPlatformClient() {
  return testDeveloperPlatformClient({
    orgFromId: () => Promise.resolve(organization),
  })
}

describe('renderAppVersionsList', () => {
  test('shows a message when there are no app versions', async () => {
    const outputMock = mockAndCaptureOutput()

    await renderAppVersionsList({
      app: testAppLinked({}),
      appVersions: [],
      totalResults: 0,
      remoteApp,
      organization,
      developerPlatformClient: buildDeveloperPlatformClient(),
    })

    expect(outputMock.info()).toMatchInlineSnapshot(`"No app versions found for this app"`)
  })

  test('shows currently used config info', async () => {
    await renderAppVersionsList({
      app: testAppLinked({}),
      appVersions: [],
      totalResults: 0,
      remoteApp,
      organization,
      developerPlatformClient: buildDeveloperPlatformClient(),
    })

    expect(renderCurrentlyUsedConfigInfo).toHaveBeenCalledWith({
      org: 'name of org 1',
      appName: 'app-title',
      configFile: 'shopify.app.toml',
    })
  })

  const terminalWidth = process.stdout.columns

  test.skipIf(terminalWidth !== undefined)('renders a table and dashboard link when app versions exist', async () => {
    const outputMock = mockAndCaptureOutput()

    await renderAppVersionsList({
      app: testAppLinked({}),
      appVersions: [
        {
          message: 'message',
          versionTag: 'versionTag',
          status: 'active',
          createdAt: '2021-01-01 00:00:00',
          createdBy: 'createdBy',
          versionId: 'gid://shopify/Version/1',
        },
        {
          message: 'message 2',
          versionTag: 'versionTag 2',
          status: 'released',
          createdAt: '2021-01-01 00:00:00',
          createdBy: 'createdBy 2',
          versionId: 'gid://shopify/Version/2',
        },
        {
          message: 'long message with more than 15 characters',
          versionTag: 'versionTag 3',
          status: 'released',
          createdAt: '2021-01-01 00:00:00',
          createdBy: 'createdBy 3',
          versionId: 'gid://shopify/Version/3',
        },
      ],
      totalResults: 31,
      remoteApp,
      organization,
      developerPlatformClient: buildDeveloperPlatformClient(),
    })

    expect(outputMock.info()).toMatchInlineSnapshot(
      `"VERSION       STATUS    MESSAGE        DATE CREATED         CREATED BY
────────────  ────────  ─────────────  ───────────────────  ───────────
versionTag    ★ active  message        2021-01-01 00:00:00  createdBy
versionTag 2  released  message 2      2021-01-01 00:00:00  createdBy 2
versionTag 3  released  long messa...  2021-01-01 00:00:00  createdBy 3

View all 31 app versions in the Test Dashboard ( https://test.shopify.com/org-id/apps/app-id/versions )"`,
    )
  })
})
