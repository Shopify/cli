import {orgScopedShopifyDevelopersRequest, handleDeprecations} from './shopify-developers.js'
import {graphqlRequest, GraphQLResponse} from './graphql.js'
import {shopifyDevelopersFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {test, vi, expect, describe, beforeEach, beforeAll} from 'vitest'

vi.mock('./graphql.js')
vi.mock('../../../private/node/context/deprecations-store.js')
vi.mock('../context/fqdn.js')

const mockedResult = 'OK'
const shopifyDevelopersFqdnValue = 'shopify.com'
const orgId = Math.floor(Math.random() * 1000000000000).toString()
const url = `https://${shopifyDevelopersFqdnValue}/organization/${orgId}/graphql`

const mockedToken = 'token'

beforeEach(() => {
  vi.mocked(shopifyDevelopersFqdn).mockResolvedValue(shopifyDevelopersFqdnValue)
})

describe('orgScopedShopifyDevelopersRequest', () => {
  test('graphqlRequest is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await orgScopedShopifyDevelopersRequest(orgId, 'query', mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'Shopify Developers',
      url,
      token: mockedToken,
      variables: {variables: 'variables'},
      responseOptions: {onResponse: handleDeprecations},
    })
  })
})

describe('handleDeprecations', () => {
  beforeAll(() => {
    vi.mocked(setNextDeprecationDate)
  })

  test('does not call setNextDeprecationDate if response contains no deprecations', () => {
    // Given
    const response = {data: {}} as GraphQLResponse<object>

    // When
    handleDeprecations(response)

    // Then
    expect(setNextDeprecationDate).not.toBeCalled()
  })

  test('calls setNextDeprecationDate with response extensions deprecation dates', () => {
    // Given
    const deprecationDates = [new Date()]
    const deprecations = deprecationDates.map((supportedUntilDate) => ({supportedUntilDate}))
    const response = {data: {}, extensions: {deprecations}} as GraphQLResponse<object>

    // When
    handleDeprecations(response)

    // Then
    expect(setNextDeprecationDate).toHaveBeenLastCalledWith(deprecationDates)
  })
})
