import * as admin from './admin.js'
import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import {AdminSession} from '../session.js'
import {AbortError, BugError, shouldReportErrorAsUnexpected} from '../error.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import * as http from '../http.js'
import {defaultThemeKitAccessDomain} from '../../../private/node/constants.js'

import {ClientError} from 'graphql-request'
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

describe('fetchApiVersions error classification', () => {
  // Mirrors `packages/cli-kit/src/public/node/error/index.test.ts`: a real `ClientError`, because
  // the branches under test use `instanceof ClientError`.
  function clientError(status: number, errors: unknown): ClientError {
    return new ClientError(
      {status, errors, headers: {}} as any,
      {
        query: 'query publicApiVersions { publicApiVersions { handle supported } }',
      } as any,
    )
  }

  test('reports a 402 Unavailable Shop as an expected store-state failure, not a CLI bug', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockRejectedValue(clientError(402, 'Unavailable Shop'))

    // When
    const error = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(error).toBeInstanceOf(AbortError)
    expect(error).not.toBeInstanceOf(BugError)
    expect(shouldReportErrorAsUnexpected(error)).toBe(false)
    expect((error as AbortError).message).toBe(`The store ${Session.storeFqdn} is currently unavailable.`)
    expect(String((error as AbortError).tryMessage)).toContain('frozen, paused, or closed')
    expect((error as AbortError).message).not.toContain('Unknown error')
  })

  test('reports an Admin API 5xx as an expected server-side failure, not a CLI bug', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockRejectedValue(clientError(500, 'Internal Server Error'))

    // When
    const error = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(error).toBeInstanceOf(AbortError)
    expect(error).not.toBeInstanceOf(BugError)
    expect(shouldReportErrorAsUnexpected(error)).toBe(false)
    expect((error as AbortError).message).toBe(
      `The Admin API for ${Session.storeFqdn} returned a server error (HTTP 500).`,
    )
  })

  // The literal messages the runtimes emit, not the production constant: asserting against real
  // observed wording keeps the test honest if someone edits the fragment list.
  // 'The user aborted a request.' is node-fetch; 'This operation was aborted' is undici;
  // 'The operation was aborted' is cli-kit's own request-timeout signal.
  test.each(['The user aborted a request.', 'This operation was aborted', 'The operation was aborted'])(
    'keeps an aborted request (%j) distinguishable from a store-state failure',
    async (fragment) => {
      // Given
      vi.mocked(graphqlRequestDoc).mockRejectedValue(new Error(fragment))

      // When
      const error = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

      // Then
      expect(error).toBeInstanceOf(AbortError)
      expect(error).not.toBeInstanceOf(BugError)
      expect(shouldReportErrorAsUnexpected(error)).toBe(false)
      expect((error as AbortError).message).toBe(`Request to ${Session.storeFqdn} was aborted before it completed.`)
      expect((error as AbortError).message).not.toContain('is currently unavailable')
    },
  )

  test('keeps an AbortError-named fetch rejection distinguishable too', async () => {
    // Given
    const aborted = new Error('aborted')
    aborted.name = 'AbortError'
    vi.mocked(graphqlRequestDoc).mockRejectedValue(aborted)

    // When
    const error = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(error).toBeInstanceOf(AbortError)
    expect((error as AbortError).message).toBe(`Request to ${Session.storeFqdn} was aborted before it completed.`)
  })

  test('still reports a genuinely unknown failure as a CLI bug', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockRejectedValue(new Error('something nobody has classified'))

    // When
    const error = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(error).toBeInstanceOf(BugError)
    expect(shouldReportErrorAsUnexpected(error)).toBe(true)
    expect((error as BugError).message).toContain('Unknown error connecting to your store')
  })

  test('leaves the existing 403 and 401 classifications alone', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockRejectedValue(clientError(403, 'Forbidden'))

    // When
    const forbidden = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(forbidden).toBeInstanceOf(AbortError)
    expect((forbidden as AbortError).message).toContain("Looks like you don't have access to this dev store")

    // Given
    vi.mocked(graphqlRequestDoc).mockRejectedValue(clientError(401, 'Unauthorized'))

    // When
    const unauthorized = await admin.fetchApiVersions(Session).catch((err: unknown) => err)

    // Then
    expect(unauthorized).toBeInstanceOf(AbortError)
    expect((unauthorized as AbortError).message).toContain('Error connecting to your store')
  })
})
