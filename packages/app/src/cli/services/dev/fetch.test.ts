import {fetchOrganizations, fetchStore, NoOrgError} from './fetch.js'
import {Organization, OrganizationSource, OrganizationStore} from '../../models/organization.js'
import {
  testPartnersServiceSession,
  testPartnersUserSession,
  testDeveloperPlatformClient,
} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'
import {AppManagementClient} from '../../utilities/developer-platform-client/app-management-client.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortError} from '@shopify/cli-kit/node/error'

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  source: OrganizationSource.Partners,
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  source: OrganizationSource.Partners,
}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('../../utilities/developer-platform-client/partners-client.js')
vi.mock('../../utilities/developer-platform-client/app-management-client.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

describe('fetchOrganizations', async () => {
  test('returns fetched organizations from Partners and App Management for 1P development', async () => {
    // Given
    vi.stubEnv('SHOPIFY_CLI_1P_DEV', 'true')
    const partnersClient: PartnersClient = testDeveloperPlatformClient({
      organizations: () => Promise.resolve([ORG1]),
    }) as PartnersClient
    const appManagementClient: AppManagementClient = testDeveloperPlatformClient({
      organizations: () => Promise.resolve([ORG2]),
    }) as AppManagementClient
    vi.mocked(PartnersClient.getInstance).mockReturnValue(partnersClient)
    vi.mocked(AppManagementClient.getInstance).mockReturnValue(appManagementClient)

    // When
    const got = await fetchOrganizations()

    // Then
    expect(got).toEqual([ORG2, ORG1])
    expect(partnersClient.organizations).toHaveBeenCalled()
    expect(appManagementClient.organizations).toHaveBeenCalled()
  })

  test('returns fetched organizations from App Management for 3P development', async () => {
    // Given
    const appManagementClient: AppManagementClient = testDeveloperPlatformClient({
      organizations: () => Promise.resolve([ORG2]),
    }) as AppManagementClient
    vi.mocked(AppManagementClient.getInstance).mockReturnValue(appManagementClient)

    // When
    const got = await fetchOrganizations()

    // Then
    expect(got).toEqual([ORG2])
    expect(PartnersClient.getInstance).not.toHaveBeenCalled()
    expect(appManagementClient.organizations).toHaveBeenCalled()
  })

  test('throws if there are no organizations', async () => {
    // Given
    const appManagementClient: AppManagementClient = testDeveloperPlatformClient({
      organizations: () => Promise.resolve([]),
    }) as AppManagementClient
    vi.mocked(AppManagementClient.getInstance).mockReturnValue(appManagementClient)

    // When
    const got = fetchOrganizations()

    // Then
    await expect(got).rejects.toThrow('No Organization found')
    expect(appManagementClient.organizations).toHaveBeenCalled()
  })
})

describe('fetchStore', () => {
  test('returns fetched store', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve(STORE1),
    })

    // When
    const got = await fetchStore(ORG1, 'domain1', developerPlatformClient)

    // Then
    expect(got).toEqual(STORE1)
    expect(developerPlatformClient.storeByDomain).toHaveBeenCalledWith(ORG1.id, 'domain1')
  })

  test('throws error if store not found', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve(undefined),
    })

    // When
    const got = fetchStore(ORG1, 'domain1', developerPlatformClient)

    // Then
    await expect(got).rejects.toThrow(new AbortError(`Could not find Store for domain domain1 in Organization org1.`))
  })
})

describe('NoOrgError', () => {
  test('renders correctly for user account', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const subject = new NoOrgError(testPartnersUserSession.accountInfo, '3')

    // When
    renderFatalError(subject)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No Organization found                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Your current active session is associated with the partner@shopify.com  │
      │      user account. To start a new session with a different account, run      │
      │      \`shopify auth logout\`                                                   │
      │    • Have you created a Shopify Partners organization [1]?                   │
      │    • Does your account include Manage app permissions?, please contact the   │
      │      owner of the organization to grant you access.                          │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │    • Do you have access to the right Shopify Partners organization? The CLI  │
      │      is loading this organization [2]                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://partners.shopify.com/signup
      [2] https://partner.shopify.com/3
      "
    `)
  })

  test('renders correctly for service account', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const subject = new NoOrgError(testPartnersServiceSession.accountInfo, '3')

    // When
    renderFatalError(subject)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No Organization found                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Your current active session is associated with the organization         │
      │      organization account. To start a new session with a different account,  │
      │      run \`shopify auth logout\`                                               │
      │    • Have you created a Shopify Partners organization [1]?                   │
      │    • Does your account include Manage app permissions?, please contact the   │
      │      owner of the organization to grant you access.                          │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │    • Do you have access to the right Shopify Partners organization? The CLI  │
      │      is loading this organization [2]                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://partners.shopify.com/signup
      [2] https://partner.shopify.com/3
      "
    `)
  })

  test('renders correctly for unknown account type', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const subject = new NoOrgError({type: 'UnknownAccount'}, '3')

    // When
    renderFatalError(subject)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No Organization found                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Your current active session is associated with an unknown account. To   │
      │      start a new session with a different account, run \`shopify auth         │
      │      logout\`                                                                 │
      │    • Have you created a Shopify Partners organization [1]?                   │
      │    • Does your account include Manage app permissions?, please contact the   │
      │      owner of the organization to grant you access.                          │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │    • Do you have access to the right Shopify Partners organization? The CLI  │
      │      is loading this organization [2]                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://partners.shopify.com/signup
      [2] https://partner.shopify.com/3
      "
    `)
  })
})
