import {partnersRequest, functionProxyRequest, handleDeprecations} from './partners.js'
import {graphqlRequest, GraphQLResponse} from './graphql.js'
import {partnersFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {test, vi, expect, describe, beforeEach, beforeAll} from 'vitest'

vi.mock('./graphql.js')
vi.mock('../../../private/node/context/deprecations-store.js')
vi.mock('../context/fqdn.js')

const mockedResult = 'OK'
const partnersFQDN = 'partners.shopify.com'
const url = 'https://partners.shopify.com/api/cli/graphql'

const mockedToken = 'token'

beforeEach(() => {
  vi.mocked(partnersFqdn).mockResolvedValue(partnersFQDN)
})

describe('partnersRequest', () => {
  test('graphqlRequest is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await partnersRequest('query', mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'Partners',
      url,
      token: mockedToken,
      variables: {variables: 'variables'},
      responseOptions: {onResponse: handleDeprecations},
    })
  })
})

describe('functionProxyRequest', () => {
  test('graphqlRequest is called with correct parameters', async () => {
    // Given
    const extensions = {deprecations: [{supportedUntilDate: new Date().toISOString()}]}
    const scriptServiceResponse = {data: {}, extensions}
    const proxyResponse = {scriptServiceProxy: JSON.stringify(scriptServiceResponse)}
    vi.mocked(graphqlRequest).mockResolvedValue(proxyResponse)

    // When
    const apiKey = 'api-key'
    const query = 'query'
    const variables = {variables: 'variables'}
    await functionProxyRequest(apiKey, query, mockedToken, variables)

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: expect.stringContaining('scriptServiceProxy'),
      api: 'Partners',
      url,
      token: mockedToken,
      variables: {
        api_key: apiKey,
        query,
        variables: JSON.stringify(variables) || '{}',
      },
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
