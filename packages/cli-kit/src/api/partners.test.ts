import {ApplicationToken} from 'session/schema'
import {test, vi, expect, describe} from 'vitest'
import {request as graphqlRequest} from 'graphql-request'

import {partners} from '../environment/fqdn'

import * as partnersApi from './partners'
import {buildHeaders} from './common'

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
const partnersURL = 'https://partners.shopify.com'
const mockedToken: ApplicationToken = {
  accessToken: 'mytoken',
  expiresAt: new Date(),
  scopes: [],
}

describe('partners-api', () => {
  test('calls the graphql client once', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.request('query', mockedToken, {some: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenCalledOnce()
  })

  test('request is called with correct parameters', async () => {
    // Given
    const headers = {'custom-header': mockedToken.accessToken}
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.request('query', mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith(partnersURL, 'query', {variables: 'variables'}, headers)
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.request('query', mockedToken, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(mockedToken.accessToken)
  })
})
