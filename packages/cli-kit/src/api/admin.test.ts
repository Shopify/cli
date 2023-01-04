import * as admin from './admin.js'
import {buildHeaders} from './common.js'
import {AdminSession} from '../session.js'
import fetch from '../http/fetch.js'
import {graphqlClient} from '../http/graphql.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'
import {GraphQLClient} from 'graphql-request'

vi.mock('../http/graphql.js')
vi.mock('../http/fetch.js')
vi.mock('./common.js', async () => {
  const module: any = await vi.importActual('./common.js')
  return {
    ...module,
    buildHeaders: vi.fn(),
  }
})

let client: GraphQLClient
beforeEach(() => {
  client = {
    request: vi.fn(),
  } as any
  vi.mocked(graphqlClient).mockResolvedValue(client)
})

const mockedResult = {
  publicApiVersions: [
    {
      handle: '2021-01',
      supported: false,
    },
    {
      handle: '2022-01',
      supported: true,
    },
    {
      handle: '2019-01',
      supported: true,
    },
  ],
}

const token = 'token'
const Session: AdminSession = {token, storeFqdn: 'my-shop.myshopify.com'}

describe('admin-graphql-api', () => {
  test('calls the graphql client twice: get api version and then execute the request', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    // When
    await admin.request('query', Session, {})

    // Then
    expect(client.request).toHaveBeenCalledTimes(2)
  })

  test('request is called with correct parameters', async () => {
    // Given
    const headers = {'custom-header': token}
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)

    // When
    await admin.request('query', Session, {variables: 'variables'})

    // Then
    expect(client.request).toHaveBeenLastCalledWith('query', {variables: 'variables'})
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    // When
    await admin.request('query', Session, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(token)
  })
})

describe('admin-rest-api', () => {
  test('"#restRequest" returns a valid response', async () => {
    // Given
    const json = () => Promise.resolve({result: true})
    const status = 200
    const headers = {'x-request-id': 123}

    vi.mocked(fetch).mockResolvedValue({
      json,
      status,
      headers: {raw: () => headers},
    } as any)

    // When
    const result = await admin.restRequest('GET', '/themes', Session)

    // Then
    expect(result.json).toEqual({result: true})
    expect(result.status).toEqual(200)
    expect(result.headers).toEqual({'x-request-id': 123})
  })

  test('fetch is called with correct parameters', async () => {
    // Given
    const json = () => Promise.resolve({result: true})
    const status = 200
    const headers = {'X-Shopify-Access-Token': `Bearer ${token}`, 'Content-Type': 'application/json'}

    vi.mocked(buildHeaders).mockResolvedValue(headers)
    vi.mocked(fetch).mockResolvedValue({
      json,
      status,
      headers: {raw: () => ({})},
    } as any)

    // When
    await admin.restRequest('GET', '/themes', Session)

    // Then
    expect(fetch).toHaveBeenLastCalledWith('https://my-shop.myshopify.com/admin/api/unstable/themes.json', {
      headers,
      method: 'GET',
    })
  })

  test('fetch is called with correct parameters when it is a theme access session', async () => {
    // Given
    const themeAccessSession = {
      ...Session,
      token: 'shptka_token',
    }

    const json = () => Promise.resolve({result: true})
    const status = 200
    const headers = {'X-Shopify-Access-Token': `Bearer ${token}`, 'Content-Type': 'application/json'}

    vi.mocked(buildHeaders).mockResolvedValue(headers)
    vi.mocked(fetch).mockResolvedValue({
      json,
      status,
      headers: {raw: () => ({})},
    } as any)

    // When
    await admin.restRequest('GET', '/themes', themeAccessSession)

    // Then
    expect(fetch).toHaveBeenLastCalledWith(
      'https://theme-kit-access.shopifyapps.com/cli/admin/api/unstable/themes.json',
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shptka_token',
          'X-Shopify-Shop': 'my-shop.myshopify.com',
        },
        method: 'GET',
      },
    )
  })
})
