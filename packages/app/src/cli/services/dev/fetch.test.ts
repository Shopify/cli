import {
  fetchAllDevStores,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchStoreByDomain,
  fetchAppExtensionRegistrations,
  NoOrgError,
} from './fetch.js'
import {Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {AllOrganizationsQuery} from '../../api/graphql/all_orgs.js'
import {FindOrganizationQuery} from '../../api/graphql/find_org.js'
import {AllDevStoresByOrganizationQuery} from '../../api/graphql/all_dev_stores_by_org.js'
import {FindStoreByDomainQuery} from '../../api/graphql/find_store_by_domain.js'
import {AllAppExtensionRegistrationsQuery} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test, vi} from 'vitest'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
}
const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
}
const APP2: OrganizationApp = {
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
  organizationId: '1',
  grantedScopes: [],
}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
}
const FETCH_ORG_RESPONSE_VALUE = {
  organizations: {
    nodes: [
      {
        id: ORG1.id,
        businessName: ORG1.businessName,
        betas: ORG1.betas,
        apps: {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
        stores: {nodes: [STORE1]},
      },
    ],
  },
}
const FETCH_STORE_RESPONSE_VALUE = {
  organizations: {
    nodes: [
      {
        id: ORG1.id,
        businessName: ORG1.businessName,
        betas: ORG1.betas,
        website: ORG1.website,
        stores: {nodes: [STORE1]},
      },
    ],
  },
}

vi.mock('@shopify/cli-kit/node/api/partners')

describe('fetchOrganizations', async () => {
  test('returns fetched organizations', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({organizations: {nodes: [ORG1, ORG2]}})

    // When
    const got = await fetchOrganizations('token')

    // Then
    expect(got).toEqual([ORG1, ORG2])
    expect(partnersRequest).toHaveBeenCalledWith(AllOrganizationsQuery, 'token')
  })

  test('throws if there are no organizations', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = fetchOrganizations('token')

    // Then
    await expect(got).rejects.toThrow(NoOrgError())
    expect(partnersRequest).toHaveBeenCalledWith(AllOrganizationsQuery, 'token')
  })
})

describe('fetchApp', async () => {
  test('returns fetched apps', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchOrgAndApps(ORG1.id, 'token')

    // Then
    expect(got).toEqual({organization: ORG1, apps: {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}}, stores: []})
    expect(partnersRequest).toHaveBeenCalledWith(FindOrganizationQuery, 'token', {id: ORG1.id})
  })

  test('throws if there are no organizations', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = () => fetchOrgAndApps(ORG1.id, 'token')

    // Then
    await expect(got).rejects.toThrowError(NoOrgError())
    expect(partnersRequest).toHaveBeenCalledWith(FindOrganizationQuery, 'token', {id: ORG1.id})
  })
})

describe('fetchAllDevStores', async () => {
  test('returns fetched stores', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchAllDevStores(ORG1.id, 'token')

    // Then
    expect(got).toEqual([STORE1])
    expect(partnersRequest).toHaveBeenCalledWith(AllDevStoresByOrganizationQuery, 'token', {
      id: ORG1.id,
    })
  })
})

describe('fetchStoreByDomain', async () => {
  test('returns fetched store and organization', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue(FETCH_STORE_RESPONSE_VALUE)

    // When
    const got = await fetchStoreByDomain(ORG1.id, 'token', 'domain1')

    // Then
    expect(got).toEqual({organization: ORG1, store: STORE1})
    expect(partnersRequest).toHaveBeenCalledWith(FindStoreByDomainQuery, 'token', {
      id: ORG1.id,
      shopDomain: STORE1.shopDomain,
    })
  })
})

describe('fetchAppExtensionRegistrations', () => {
  test('returns fetched extension registrations', async () => {
    // Given
    const response = {
      app: {
        extensionRegistrations: [
          {
            id: '1234',
            uuid: 'ddb126da-b578-4ce3-a6d4-8ed1cc0703cc',
            title: 'checkout-post-purchase',
            type: 'CHECKOUT_POST_PURCHASE',
          },
        ],
      },
    }
    vi.mocked(partnersRequest).mockResolvedValue(response)

    // When
    const got = await fetchAppExtensionRegistrations({
      apiKey: 'api-key',
      token: 'token',
    })

    // Then
    expect(got).toEqual(response)
    expect(partnersRequest).toHaveBeenCalledWith(AllAppExtensionRegistrationsQuery, 'token', {
      apiKey: 'api-key',
    })
  })
})

describe('NoOrgError', () => {
  test('renders correctly', () => {
    // Given
    const mockOutput = mockAndCaptureOutput()
    const subject = NoOrgError('3')

    // When
    const got = renderFatalError(subject)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No Organization found                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Have you created a Shopify Partners organization [1]?                   │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │    • Do you have access to the right Shopify Partners organization? The CLI  │
      │       is loading this organization [2]                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://partners.shopify.com/signup
      [2] https://partner.shopify.com/3
      "
    `)
  })
})
