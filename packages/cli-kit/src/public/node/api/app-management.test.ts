import {appManagementRequestDoc, handleDeprecations} from './app-management.js'
import {graphqlRequestDoc, GraphQLResponse} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {test, vi, expect, describe, beforeEach, beforeAll} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('./graphql.js')
vi.mock('../../../private/node/context/deprecations-store.js')
vi.mock('../context/fqdn.js')

const mockedResult = 'OK'
const appManagementFqdnValue = 'shopify.com'
const orgId = Math.floor(Math.random() * 1000000000000).toString()
const url = `https://${appManagementFqdnValue}/app_management/unstable/graphql.json`

const mockedToken = 'token'

beforeEach(() => {
  vi.mocked(appManagementFqdn).mockResolvedValue(appManagementFqdnValue)
})

describe('appManagementRequestDoc', () => {
  test('graphqlRequest is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    // When
    const query = 'query' as unknown as TypedDocumentNode<object, {variables: string}>
    await appManagementRequestDoc({
      query,
      token: mockedToken,
      variables: {variables: 'variables'},
      requestOptions: {requestMode: 'slow-request'},
      cacheOptions: {cacheTTL: {hours: 1}, cacheExtraKey: `1234`},
      unauthorizedHandler: {
        type: 'token_refresh',
        handler: vi.fn().mockResolvedValue({token: mockedToken}),
      },
    })

    // Then
    expect(graphqlRequestDoc).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'App Management',
      url,
      token: mockedToken,
      variables: {variables: 'variables'},
      responseOptions: {onResponse: handleDeprecations},
      cacheOptions: {cacheTTL: {hours: 1}, cacheExtraKey: `1234`},
      preferredBehaviour: 'slow-request',
      unauthorizedHandler: {
        type: 'token_refresh',
        handler: expect.any(Function),
      },
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
