import {partnersRequest, handleDeprecations} from './partners.js'
import {graphqlRequest, GraphQLResponse} from './graphql.js'
import {partnersFqdn} from '../context/fqdn.js'
import {blockPartnersAccess} from '../environment.js'
import {BugError} from '../error.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'

import {test, vi, expect, describe, beforeEach, beforeAll} from 'vitest'

vi.mock('./graphql.js')
vi.mock('../../../private/node/context/deprecations-store.js')
vi.mock('../context/fqdn.js')
vi.mock('../environment.js')

const mockedResult = 'OK'
const partnersFQDN = 'partners.shopify.com'
const url = 'https://partners.shopify.com/api/cli/graphql'

const mockedToken = 'token'

beforeEach(() => {
  vi.mocked(partnersFqdn).mockResolvedValue(partnersFQDN)
  vi.mocked(blockPartnersAccess).mockReturnValue(false)
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

  test('throws BugError when blockPartnersAccess returns true', async () => {
    // Given
    vi.mocked(blockPartnersAccess).mockReturnValue(true)

    // When/Then
    await expect(partnersRequest('query', mockedToken, {variables: 'variables'})).rejects.toThrow(BugError)
    expect(blockPartnersAccess).toHaveBeenCalled()
  })

  test('does not throw when blockPartnersAccess returns false', async () => {
    // Given
    vi.mocked(blockPartnersAccess).mockReturnValue(false)
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await partnersRequest('query', mockedToken, {variables: 'variables'})

    // Then
    expect(blockPartnersAccess).toHaveBeenCalled()
    expect(graphqlRequest).toHaveBeenCalled()
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
