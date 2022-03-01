import {ApplicationToken} from 'session/schema'
import {test, vi, expect, describe} from 'vitest'
import {request} from 'graphql-request'

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

const mockedRequest = vi.mocked(request)
const mockedHeaders = vi.mocked(buildHeaders)
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
    vi.mocked(request).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.query('query', mockedToken, {some: 'variables'})

    // Then
    expect(mockedRequest).toHaveBeenCalledOnce()
  })

  test('request is called with correct parameters', async () => {
    // Given
    const headers = {'custom-header': mockedToken.accessToken}
    vi.mocked(request).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.query('query', mockedToken, {variables: 'variables'})

    // Then
    expect(mockedRequest).toHaveBeenLastCalledWith(
      partnersURL,
      'query',
      {variables: 'variables'},
      headers,
    )
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(request).mockResolvedValue(mockedResult)
    vi.mocked(partners).mockResolvedValue(partnersURL)

    // When
    await partnersApi.query('query', mockedToken, {})

    // Then
    expect(mockedHeaders).toHaveBeenCalledWith(mockedToken.accessToken)
  })
})
