import * as partnersApi from './partners'
import {buildHeaders} from './common'
import {partners} from '../environment/fqdn'
import {test, vi, expect, describe} from 'vitest'
import {request as graphqlRequest} from 'graphql-request'

vi.mock('graphql-request', async () => {
  const {gql} = await vi.importActual('graphql-request')
  return {
    request: vi.fn(),
    gql,
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
