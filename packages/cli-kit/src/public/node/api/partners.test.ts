import * as partnersApi from './partners.js'
import {buildHeaders} from './common.js'
import {partners} from '../environment/fqdn.js'
import {graphqlClient} from '../http/graphql.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'
import {GraphQLClient} from 'graphql-request'

vi.mock('../http/graphql.js')
vi.mock('./common.js', async () => {
  const module: any = await vi.importActual('./common.js')
  return {
    ...module,
    buildHeaders: vi.fn(),
  }
})
vi.mock('../environment/fqdn.js')

const mockedResult = 'OK'
const partnersFQDN = 'partners.shopify.com'
const url = 'https://partners.shopify.com/api/cli/graphql'
const mockedToken = 'token'

let client: GraphQLClient
beforeEach(() => {
  client = {
    request: vi.fn(),
  } as any
  vi.mocked(graphqlClient).mockResolvedValue(client)
})

describe('partners-api', () => {
  test('calls the graphql client once', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.partnersRequest('query', mockedToken, {some: 'variables'})

    // Then
    expect(client.request).toHaveBeenCalledOnce()
  })

  test('request is called with correct parameters', async () => {
    // Given
    const headers = {'custom-header': mockedToken}
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(client.request).mockResolvedValue(headers)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.partnersRequest('query', mockedToken, {variables: 'variables'})

    // Then
    expect(client.request).toHaveBeenLastCalledWith('query', {variables: 'variables'})
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.partnersRequest('query', mockedToken, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(mockedToken)
  })
})
