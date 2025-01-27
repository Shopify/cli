import {fetchStore, fetchStoreByDomain, NoOrgError} from './fetch.js'
import {Organization, OrganizationStore} from '../../models/organization.js'
import {FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {testPartnersUserSession, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortError} from '@shopify/cli-kit/node/error'

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
}
const FETCH_STORE_RESPONSE_VALUE: FindStoreByDomainSchema = {
  organizations: {
    nodes: [
      {
        id: ORG1.id,
        businessName: ORG1.businessName,
        stores: {nodes: [STORE1]},
      },
    ],
  },
}

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('../../utilities/developer-platform-client/partners-client.js')
vi.mock('../../utilities/developer-platform-client/app-management-client.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

describe('fetchStoreByDomain', async () => {
  test('returns fetched store and organization', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve(FETCH_STORE_RESPONSE_VALUE),
    })

    // When
    const got = await fetchStoreByDomain(ORG1.id, 'domain1', developerPlatformClient)

    // Then
    expect(got).toEqual({organization: ORG1, store: STORE1})
    expect(developerPlatformClient.storeByDomain).toHaveBeenCalledWith(ORG1.id, 'domain1')
  })
})

describe('fetchStore', () => {
  test('returns fetched store', async () => {
    // Given
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve(FETCH_STORE_RESPONSE_VALUE),
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
      storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve({organizations: {nodes: []}}),
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
