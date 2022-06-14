import * as partnersApi from './partners'
import {buildHeaders} from './common'
import {partners} from '../environment/fqdn'
import {test, vi, expect, describe, it} from 'vitest'
import {ClientError, request as graphqlRequest} from 'graphql-request'

vi.mock('graphql-request', async () => {
  const {gql, ClientError} = await vi.importActual('graphql-request')
  return {
    request: vi.fn(),
    gql,
    ClientError,
  }
})

vi.mock('./common')
vi.mock('../environment/fqdn')

const mockedResult = 'OK'
const partnersFQDN = 'partners.shopify.com'
const url = 'https://partners.shopify.com/api/cli/graphql'
const mockedToken = 'token'

describe('partners-api', () => {
  test('calls the graphql client once', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.request('query', mockedToken, {some: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenCalledOnce()
  })

  test('request is called with correct parameters', async () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headers = {'custom-header': mockedToken}
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.request('query', mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith(url, 'query', {variables: 'variables'}, headers)
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    // When
    await partnersApi.request('query', mockedToken, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(mockedToken)
  })
})

describe('checkIfTokenIsRevoked', () => {
  it('returns true if error is 401', async () => {
    const graphQLError = new ClientError({status: 401}, {query: ''})
    vi.mocked(graphqlRequest).mockRejectedValueOnce(graphQLError)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    const got = await partnersApi.checkIfTokenIsRevoked(mockedToken)

    expect(got).toBe(true)
  })

  it('returns false if error is not 401', async () => {
    const graphQLError = new ClientError({status: 404}, {query: ''})
    vi.mocked(graphqlRequest).mockRejectedValueOnce(graphQLError)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    const got = await partnersApi.checkIfTokenIsRevoked(mockedToken)

    expect(got).toBe(false)
  })

  it('returns false if there is no error', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersFQDN)

    const got = await partnersApi.checkIfTokenIsRevoked(mockedToken)

    expect(got).toBe(false)
  })
})
