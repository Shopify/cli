import * as admin from './admin.js'
import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import {AdminSession} from '../session.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import * as http from '../http.js'
import {defaultThemeKitAccessDomain} from '../../../private/node/constants.js'

import {test, vi, expect, describe} from 'vitest'
import {ClientError} from 'graphql-request'

vi.mock('./graphql.js')
vi.mock('../../../private/node/api/headers.js')
vi.mock('../http.js')

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
const Session: AdminSession = {token, storeFqdn: 'store.myshopify.com'}

describe('admin-graphql-api', () => {
  test('calls the graphql client twice: get api version and then execute the request', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {})

    // Then
    expect(graphqlRequest).toHaveBeenCalledTimes(1)
    expect(graphqlRequestDoc).toHaveBeenCalledTimes(1)
  })

  test('request is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'Admin',
      url: 'https://store.myshopify.com/admin/api/2022-01/graphql.json',
      addedHeaders: {},
      token,
      variables: {variables: 'variables'},
    })
  })

  test('request uses the provided API version when specified', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue({})
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {variables: 'variables'}, 'unstable')

    // Then
    expect(graphqlRequestDoc).not.toHaveBeenCalled()
    expect(graphqlRequest).toHaveBeenCalledOnce()
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query',
      api: 'Admin',
      url: 'https://store.myshopify.com/admin/api/unstable/graphql.json',
      addedHeaders: {},
      token,
      variables: {variables: 'variables'},
    })
  })

  test('request is called with correct parameters when it is a theme access session', async () => {
    // Given
    const themeAccessToken = 'shptka_token'
    const themeAccessSession = {
      ...Session,
      token: themeAccessToken,
    }

    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', themeAccessSession, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'Admin',
      addedHeaders: {
        'X-Shopify-Access-Token': 'shptka_token',
        'X-Shopify-Shop': 'store.myshopify.com',
      },
      url: `https://${defaultThemeKitAccessDomain}/cli/admin/api/2022-01/graphql.json`,
      token: themeAccessToken,
      variables: {variables: 'variables'},
    })
  })
})

describe('admin-rest-api', () => {
  test('"#restRequest" returns a valid response', async () => {
    // Given
    const json = () => Promise.resolve({result: true})
    const status = 200
    const headers = {'some-header': 123}

    vi.spyOn(http, 'shopifyFetch').mockResolvedValue({
      json,
      status,
      headers: {raw: () => headers},
    } as any)

    // When
    const result = await admin.restRequest('GET', '/themes', Session)

    // Then
    expect(result.json).toEqual({result: true})
    expect(result.status).toEqual(200)
    expect(result.headers).toEqual({'some-header': 123})
  })

  test('fetch is called with correct parameters', async () => {
    // Given
    const json = () => Promise.resolve({result: true})
    const status = 200
    const headers = {'X-Shopify-Access-Token': `Bearer ${token}`, 'Content-Type': 'application/json'}

    vi.mocked(buildHeaders).mockReturnValue(headers)
    const spyFetch = vi.spyOn(http, 'shopifyFetch').mockResolvedValue({
      json,
      status,
      headers: {raw: () => ({})},
    } as any)

    // When
    await admin.restRequest('GET', '/themes', Session)

    // Then
    expect(spyFetch).toHaveBeenLastCalledWith('https://store.myshopify.com/admin/api/unstable/themes.json', {
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

    const status = 200
    const headers = {'X-Shopify-Access-Token': `Bearer ${token}`, 'Content-Type': 'application/json'}

    vi.mocked(buildHeaders).mockReturnValue(headers)
    const spyFetch = vi.spyOn(http, 'shopifyFetch').mockResolvedValue({
      json: () => Promise.resolve({result: true}),
      status,
      headers: {raw: () => ({})},
    } as any)

    // When
    await admin.restRequest('GET', '/themes', themeAccessSession)

    // Then
    expect(spyFetch).toHaveBeenLastCalledWith(
      `https://${defaultThemeKitAccessDomain}/cli/admin/api/unstable/themes.json`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shptka_token',
          'X-Shopify-Shop': 'store.myshopify.com',
        },
        method: 'GET',
      },
    )
  })
})

describe('fetchApiVersions', () => {
  // The HTTP status has to survive version discovery: callers such as the stored `store auth`
  // recovery flow classify on the status, and they can't recover it from the rendered message.
  test.each([401, 404])('preserves HTTP %i on the thrown error while keeping the message intact', async (status) => {
    // Given a store whose API version has not been discovered yet
    const session: AdminSession = {token, storeFqdn: `status-${status}.myshopify.com`}
    vi.mocked(graphqlRequestDoc).mockRejectedValue(
      new ClientError({status, data: 'body', errors: []}, {query: 'query'}),
    )

    // When
    const error = await admin.fetchApiVersions(session).catch((thrown: unknown) => thrown)

    // Then
    expect(error).toBeInstanceOf(admin.AdminApiRequestError)
    expect(error).toMatchObject({status})
    expect((error as Error).message).toContain(`Error connecting to your store status-${status}.myshopify.com:`)
  })

  test('leaves other statuses to the existing classification', async () => {
    // Given
    const session: AdminSession = {token, storeFqdn: 'forbidden.myshopify.com'}
    vi.mocked(graphqlRequestDoc).mockRejectedValue(new ClientError({status: 403, errors: []}, {query: 'query'}))

    // When
    const error = await admin.fetchApiVersions(session).catch((thrown: unknown) => thrown)

    // Then
    expect(error).not.toBeInstanceOf(admin.AdminApiRequestError)
    expect((error as Error).message).toContain("Looks like you don't have access to this dev store")
  })
})
