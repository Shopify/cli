import {
  businessPlatformRequest,
  businessPlatformRequestDoc,
  businessPlatformOrganizationsRequest,
  businessPlatformOrganizationsRequestDoc,
} from './business-platform.js'
import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import {handleDeprecations} from './partners.js'
import {businessPlatformFqdn} from '../context/fqdn.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {test, vi, expect, describe, beforeEach} from 'vitest'

vi.mock('./graphql.js')
vi.mock('../context/fqdn.js')

const mockedResult = {data: {ok: true}}
const businessPlatformFqdnValue = 'business-platform.shopify.com'
const mockedToken = 'test-token'
const orgId = '12345'

beforeEach(() => {
  vi.mocked(businessPlatformFqdn).mockResolvedValue(businessPlatformFqdnValue)
})

describe('businessPlatformRequest', () => {
  test('calls graphqlRequest with expected parameters', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    const result = await businessPlatformRequest('query { user }', mockedToken, {var: 'val'}, {cacheTTL: {hours: 1}})

    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { user }',
      api: 'BusinessPlatform',
      url: `https://${businessPlatformFqdnValue}/destinations/api/2020-07/graphql`,
      token: mockedToken,
      variables: {var: 'val'},
      cacheOptions: {cacheTTL: {hours: 1}},
      responseOptions: {onResponse: handleDeprecations},
    })
    expect(result).toEqual(mockedResult)
  })
})

describe('businessPlatformRequestDoc', () => {
  test('calls graphqlRequestDoc with expected parameters', async () => {
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)
    const query = 'query' as unknown as TypedDocumentNode<object, object>
    const unauthorizedHandler = {type: 'token_refresh' as const, handler: vi.fn()}

    const result = await businessPlatformRequestDoc({
      query,
      token: mockedToken,
      variables: {var: 'val'},
      cacheOptions: {cacheTTL: {hours: 1}},
      unauthorizedHandler,
    })

    expect(graphqlRequestDoc).toHaveBeenCalledWith({
      query,
      api: 'BusinessPlatform',
      url: `https://${businessPlatformFqdnValue}/destinations/api/2020-07/graphql`,
      token: mockedToken,
      variables: {var: 'val'},
      cacheOptions: {cacheTTL: {hours: 1}},
      responseOptions: {onResponse: handleDeprecations},
      unauthorizedHandler,
    })
    expect(result).toEqual(mockedResult)
  })
})

describe('businessPlatformOrganizationsRequest', () => {
  test('calls graphqlRequest with organization-scoped URL', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    const unauthorizedHandler = {type: 'token_refresh' as const, handler: vi.fn()}

    const result = await businessPlatformOrganizationsRequest({
      query: 'query { org }',
      token: mockedToken,
      organizationId: orgId,
      unauthorizedHandler,
      variables: {var: 'val'},
    })

    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { org }',
      api: 'BusinessPlatform',
      url: `https://${businessPlatformFqdnValue}/organizations/api/unstable/organization/${orgId}/graphql`,
      token: mockedToken,
      variables: {var: 'val'},
      responseOptions: {onResponse: handleDeprecations},
      unauthorizedHandler,
    })
    expect(result).toEqual(mockedResult)
  })
})

describe('businessPlatformOrganizationsRequestDoc', () => {
  test('calls graphqlRequestDoc with organization-scoped URL', async () => {
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)
    const query = 'query' as unknown as TypedDocumentNode<object, object>
    const unauthorizedHandler = {type: 'token_refresh' as const, handler: vi.fn()}

    const result = await businessPlatformOrganizationsRequestDoc({
      query,
      token: mockedToken,
      organizationId: orgId,
      unauthorizedHandler,
      variables: {var: 'val'},
    })

    expect(graphqlRequestDoc).toHaveBeenCalledWith({
      query,
      api: 'BusinessPlatform',
      url: `https://${businessPlatformFqdnValue}/organizations/api/unstable/organization/${orgId}/graphql`,
      token: mockedToken,
      variables: {var: 'val'},
      responseOptions: {onResponse: handleDeprecations},
      unauthorizedHandler,
    })
    expect(result).toEqual(mockedResult)
  })
})
