import {openAppGraphiQL} from './graphiql.js'
import {createClientCredentialsTokenProvider} from '../dev/processes/graphiql-token-provider.js'
import {testOrganizationApp} from '../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {resolveGraphiQLKey, setupGraphiQLServer} from '@shopify/cli-kit/node/graphiql/server'
import {openURL} from '@shopify/cli-kit/node/system'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {adminFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../dev/processes/graphiql-token-provider.js')
vi.mock('@shopify/cli-kit/node/graphiql/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/graphiql/server')>()
  return {
    ...original,
    setupGraphiQLServer: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/context/fqdn', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/context/fqdn')>()
  return {
    ...original,
    adminFqdn: vi.fn(),
  }
})

const mockedCreateTokenProvider = vi.mocked(createClientCredentialsTokenProvider)
const mockedSetup = vi.mocked(setupGraphiQLServer)
const mockedOpenURL = vi.mocked(openURL)
const mockedGetPort = vi.mocked(getAvailableTCPPort)
const mockedAdminFqdn = vi.mocked(adminFqdn)

function fakeServer() {
  const server = {close: vi.fn()}
  mockedSetup.mockReturnValueOnce(server as unknown as ReturnType<typeof setupGraphiQLServer>)
  return server
}

function abortAfter(controller: AbortController) {
  setImmediate(() => controller.abort())
  return controller.signal
}

describe('openAppGraphiQL', () => {
  beforeEach(() => {
    mockedGetPort.mockResolvedValue(4567)
    mockedOpenURL.mockResolvedValue(true)
    mockedAdminFqdn.mockResolvedValue('admin.shopify.com')
    mockedCreateTokenProvider.mockReturnValue({
      getToken: async () => 'client-credentials-token',
    })
  })

  test('starts GraphiQL with app context and a client credentials token provider', async () => {
    fakeServer()
    const controller = new AbortController()
    const remoteApp = testOrganizationApp({apiKey: 'api-key', title: 'Test App', apiSecretKeys: [{secret: 'secret'}]})

    await openAppGraphiQL({
      remoteApp,
      store: 'shop.myshopify.com',
      port: 4567,
      abortSignal: abortAfter(controller),
    })

    const key = resolveGraphiQLKey(undefined, 'secret', 'shop.myshopify.com')
    expect(mockedGetPort).toHaveBeenCalledWith(4567)
    expect(mockedCreateTokenProvider).toHaveBeenCalledWith({
      apiKey: 'api-key',
      apiSecret: 'secret',
      storeFqdn: 'shop.myshopify.com',
    })
    expect(mockedSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 4567,
        storeFqdn: 'shop.myshopify.com',
        key,
        appContext: {
          appName: 'Test App',
          appUrl: 'https://admin.shopify.com/store/shop/apps/api-key?dev-console=show',
          apiSecret: 'secret',
        },
      }),
    )
  })

  test('opens the keyed URL in the browser and closes the server after abort', async () => {
    const server = fakeServer()
    const controller = new AbortController()
    const remoteApp = testOrganizationApp({apiSecretKeys: [{secret: 'secret'}]})

    await openAppGraphiQL({
      remoteApp,
      store: 'shop.myshopify.com',
      variables: '{"id":1}',
      apiVersion: '2024-10',
      abortSignal: abortAfter(controller),
    })

    const openedUrl = mockedOpenURL.mock.calls[0]![0]
    const parsed = new URL(openedUrl)
    expect(parsed.origin).toBe('http://localhost:4567')
    expect(parsed.pathname).toBe('/graphiql')
    expect(parsed.searchParams.get('key')).toBe(resolveGraphiQLKey(undefined, 'secret', 'shop.myshopify.com'))
    expect(parsed.searchParams.get('variables')).toBe('{"id":1}')
    expect(parsed.searchParams.get('api_version')).toBe('2024-10')
    expect(server.close).toHaveBeenCalled()
  })
})
