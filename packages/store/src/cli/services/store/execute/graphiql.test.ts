import {openStoreGraphiQL} from './graphiql.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {setupGraphiQLServer, TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {openURL} from '@shopify/cli-kit/node/system'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/graphiql/server')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../auth/session-lifecycle.js')

const mockedSetup = vi.mocked(setupGraphiQLServer)
const mockedOpenURL = vi.mocked(openURL)
const mockedGetPort = vi.mocked(getAvailableTCPPort)
const mockedLoadSession = vi.mocked(loadStoredStoreSession)

function fakeServer() {
  const server = {close: vi.fn()}
  mockedSetup.mockReturnValueOnce(server as unknown as ReturnType<typeof setupGraphiQLServer>)
  return server
}

function abortAfter(controller: AbortController) {
  setImmediate(() => controller.abort())
  return controller.signal
}

describe('openStoreGraphiQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetPort.mockResolvedValue(4567)
    mockedOpenURL.mockResolvedValue(true)
    mockedLoadSession.mockResolvedValue({
      store: 'shop.myshopify.com',
      accessToken: 'stored-token',
    } as unknown as Awaited<ReturnType<typeof loadStoredStoreSession>>)
  })

  test('forwards configuration to setupGraphiQLServer', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      port: 4567,
      open: false,
      allowMutations: false,
      abortSignal: abortAfter(controller),
    })

    expect(mockedGetPort).toHaveBeenCalledWith(4567)
    expect(mockedSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 4567,
        storeFqdn: 'shop.myshopify.com',
        protectMutations: true,
      }),
    )
  })

  test('protectMutations follows --allow-mutations', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      open: false,
      allowMutations: true,
      abortSignal: abortAfter(controller),
    })

    expect(mockedSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        protectMutations: false,
      }),
    )
  })

  test('uses a TokenProvider backed by loadStoredStoreSession', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      open: false,
      abortSignal: abortAfter(controller),
    })

    const tokenProvider = mockedSetup.mock.calls[0]![0].tokenProvider as TokenProvider
    expect(await tokenProvider.getToken()).toBe('stored-token')
    expect(mockedLoadSession).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('opens the URL in the browser by default', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      abortSignal: abortAfter(controller),
    })

    expect(mockedOpenURL).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/localhost:4567\/graphiql/))
  })

  test('generates a key, passes it to the server, and includes it in the URL', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      abortSignal: abortAfter(controller),
    })

    const setupOptions = mockedSetup.mock.calls[0]![0]
    const openedUrl = mockedOpenURL.mock.calls[0]![0]

    expect(setupOptions.key).toMatch(/^[0-9a-f]{64}$/)
    expect(new URL(openedUrl).searchParams.get('key')).toBe(setupOptions.key)
  })

  test('does not open the URL when open is false', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      open: false,
      abortSignal: abortAfter(controller),
    })

    expect(mockedOpenURL).not.toHaveBeenCalled()
  })

  test('closes the server after the abort signal fires', async () => {
    const server = fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      open: false,
      abortSignal: abortAfter(controller),
    })

    expect(server.close).toHaveBeenCalled()
  })

  test('encodes prefilled query, variables, and apiVersion into the URL', async () => {
    fakeServer()
    const controller = new AbortController()

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
      variables: '{"id":1}',
      apiVersion: '2024-10',
      abortSignal: abortAfter(controller),
    })

    const openedUrl = mockedOpenURL.mock.calls[0]![0]
    const parsed = new URL(openedUrl)
    expect(parsed.searchParams.get('query')).toBe('query { shop { name } }')
    expect(parsed.searchParams.get('variables')).toBe('{"id":1}')
    expect(parsed.searchParams.get('api_version')).toBe('2024-10')
  })
})
