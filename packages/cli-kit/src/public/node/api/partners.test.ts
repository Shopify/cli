import * as partnersApi from './partners.js'
import {partners} from '../../../environment/fqdn.js'
import {graphqlRequest} from '../../../private/common/api/graphql.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'

vi.mock('../../../private/common/api/graphql')
vi.mock('../../../environment/fqdn.js')

const mockedResult = 'OK'
const partnersFQDN = 'partners.shopify.com'
const url = 'https://partners.shopify.com/api/cli/graphql'
const mockedToken = 'token'

beforeEach(() => {
  vi.mocked(graphqlRequest).mockResolvedValue({})
})

describe('partners-api', () => {
  test('request is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.partnersRequest('query', mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith('query', 'Partners', url, mockedToken, {variables: 'variables'})
  })
})
