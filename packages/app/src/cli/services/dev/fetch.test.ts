import {fetchAppsAndStores, fetchOrganizations} from './fetch'
import {describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'

const ORG1: Organization = {id: '1', businessName: 'org1'}
const ORG2: Organization = {id: '2', businessName: 'org2'}
const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: [{secret: 'secret1'}]}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: [{secret: 'secret2'}]}
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
    expect(got).rejects.toThrow('No Organization found')
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.AllOrganizationsQuery, 'token')
  })
})

describe('fetchAppAndStores', async () => {
  it('returns fetched apps and stores', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await fetchAppsAndStores(ORG1.id, 'token')

    // Then
    expect(got).toEqual({organization: ORG1, apps: [APP1, APP2], stores: [STORE1]})
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
  })
  it('throws if there are no organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = fetchAppsAndStores(ORG1.id, 'token')

    // Then
    expect(got).rejects.toThrow('No Organization found')
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
  })
})
