import {
  fetchAllStores,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchStoresByDomain,
  fetchAppExtensionRegistrations,
  NoOrgError,
} from './fetch.js'
import {Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {describe, expect, it, test, vi} from 'vitest'
import {api} from '@shopify/cli-kit'

const ORG1: Organization = {id: '1', businessName: 'org1', appsNext: true}
const ORG2: Organization = {id: '2', businessName: 'org2', appsNext: false}
const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
}
const APP2: OrganizationApp = {
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
  organizationId: '1',
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
        appsNext: ORG1.appsNext,
        apps: {nodes: [APP1, APP2]},
        stores: {nodes: [STORE1]},
      },
    ],
  },
}

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    api: {
      partners: {
        request: vi.fn(),
      },
      graphql: cliKit.api.graphql,
    },
  }
})

describe('fetchOrganizations', async () => {
  it('returns fetched organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({organizations: {nodes: [ORG1, ORG2]}})

    // When
    const got = await fetchOrganizations('token')

    // Then
    expect(got).toEqual([ORG1, ORG2])
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.AllOrganizationsQuery, 'token')
  })

  it('throws if there are no organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = fetchOrganizations('token')

    // Then
    expect(got).rejects.toThrow(NoOrgError())
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.AllOrganizationsQuery, 'token')
  })
})

describe('fetchApp', async () => {
  it('returns fetched apps', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchOrgAndApps(ORG1.id, 'token')

    // Then
    expect(got).toEqual({organization: ORG1, apps: [APP1, APP2], stores: []})
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
  })

  it('throws if there are no organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = fetchOrgAndApps(ORG1.id, 'token')

    // Then
    expect(got).rejects.toThrowError(NoOrgError())
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
  })
})

describe('fetchAllStores', async () => {
  it('returns fetched stores', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchAllStores(ORG1.id, 'token')

    // Then
    expect(got).toEqual([STORE1])
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.AllStoresByOrganizationQuery, 'token', {id: ORG1.id})
  })
})

describe('fetchStoresByDomain', async () => {
  it('returns fetched store', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchStoresByDomain(ORG1.id, 'token', 'domain1')

    // Then
    expect(got).toEqual([STORE1])
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.FindStoreByDomainQuery, 'token', {id: ORG1.id, shopDomain: STORE1.shopDomain})
  })
})

describe('fetchAppExtensionRegistrations', () => {
  it('returns fetched extension registrations', async () => {
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
    vi.mocked(api.partners.request).mockResolvedValue(response)

    // When
    const got = await fetchAppExtensionRegistrations({
      apiKey: 'api-key',
      token: 'token',
    })

    // Then
    expect(got).toEqual(response)
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.AllAppExtensionRegistrationsQuery, 'token', {
      apiKey: 'api-key',
    })
  })
})

describe('NoOrgError', () => {
  test('tryMessage has the right content', () => {
    // Given
    const subject = NoOrgError('3')

    // When
    const got = subject.tryMessage

    // Then
    /* eslint-disable no-irregular-whitespace */
    expect(got).toMatchInlineSnapshot(`
      "· Have you [32mcreated a Shopify Partners organization[39m (​https://partners.shopify.com/signup​)?
      · Have you confirmed your accounts from the emails you received?
      · Need to connect to a different App or organization? Run the command again with [1m[33m--reset[39m[22m
      · Do you have access to the right Shopify Partners organization? The CLI is loading [32mthis organization[39m (​https://partner.shopify.com/3​)"
    `)
    /* eslint-enable no-irregular-whitespace */
  })
})
