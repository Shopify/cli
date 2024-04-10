import * as admin from './admin.js'
import {graphqlRequest} from './graphql.js'
import {AdminSession} from '../session.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import * as http from '../../../public/node/http.js'
import {defaultThemeKitAccessDomain} from '../../../private/node/constants.js'
import {test, vi, expect, describe} from 'vitest'

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
const Session: AdminSession = {token, storeFqdn: 'store'}

describe('admin-graphql-api', () => {
  test('calls the graphql client twice: get api version and then execute the request', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {})

    // Then
    expect(graphqlRequest).toHaveBeenCalledTimes(2)
  })

  test('request is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith({
      query: 'query',
      api: 'Admin',
      url: 'https://store/admin/api/2022-01/graphql.json',
      token,
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

    vi.spyOn(http, 'fetch').mockResolvedValue({
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
    const spyFetch = vi.spyOn(http, 'fetch').mockResolvedValue({
      json,
      status,
      headers: {raw: () => ({})},
    } as any)

    // When
    await admin.restRequest('GET', '/themes', Session)

    // Then
    expect(spyFetch).toHaveBeenLastCalledWith('https://store/admin/api/unstable/themes.json', {
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
    const spyFetch = vi.spyOn(http, 'fetch').mockResolvedValue({
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
          'X-Shopify-Shop': 'store',
        },
        method: 'GET',
      },
    )
  })
})
