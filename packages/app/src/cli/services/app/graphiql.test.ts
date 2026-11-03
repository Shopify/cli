import {openAppGraphiQL} from './graphiql.js'
import {createClientCredentialsTokenProvider} from '../dev/processes/graphiql-token-provider.js'
import {testOrganizationApp} from '../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {resolveGraphiQLKey} from '@shopify/cli-kit/node/graphiql/server'
import {runGraphiQLSession} from '@shopify/cli-kit/node/graphiql/session'
import {adminFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../dev/processes/graphiql-token-provider.js')
vi.mock('@shopify/cli-kit/node/graphiql/session')
vi.mock('@shopify/cli-kit/node/context/fqdn', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/context/fqdn')>()
  return {
    ...original,
    adminFqdn: vi.fn(),
  }
})

const mockedCreateTokenProvider = vi.mocked(createClientCredentialsTokenProvider)
const mockedRunGraphiQLSession = vi.mocked(runGraphiQLSession)
const mockedAdminFqdn = vi.mocked(adminFqdn)

describe('openAppGraphiQL', () => {
  beforeEach(() => {
    mockedRunGraphiQLSession.mockResolvedValue()
    mockedAdminFqdn.mockResolvedValue('admin.shopify.com')
    mockedCreateTokenProvider.mockReturnValue({
      getToken: async () => 'client-credentials-token',
    })
  })

  test('starts GraphiQL with app context and a client credentials token provider', async () => {
    const abortSignal = new AbortController().signal
    const remoteApp = testOrganizationApp({apiKey: 'api-key', title: 'Test App', apiSecretKeys: [{secret: 'secret'}]})

    await openAppGraphiQL({
      remoteApp,
      store: 'shop.myshopify.com',
      port: 4567,
      abortSignal,
    })

    const key = resolveGraphiQLKey(undefined, 'secret', 'shop.myshopify.com')
    expect(mockedCreateTokenProvider).toHaveBeenCalledWith({
      apiKey: 'api-key',
      apiSecret: 'secret',
      storeFqdn: 'shop.myshopify.com',
    })
    expect(mockedRunGraphiQLSession).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 4567,
        storeFqdn: 'shop.myshopify.com',
        tokenProvider: {getToken: expect.any(Function)},
        key,
        appContext: {
          appName: 'Test App',
          appUrl: 'https://admin.shopify.com/store/shop/apps/api-key?dev-console=show',
          apiSecret: 'secret',
        },
        abortSignal,
      }),
    )
  })

  test('passes optional GraphiQL URL parameters to the shared session runner', async () => {
    const remoteApp = testOrganizationApp({apiSecretKeys: [{secret: 'secret'}]})

    await openAppGraphiQL({
      remoteApp,
      store: 'shop.myshopify.com',
      variables: '{"id":1}',
      apiVersion: '2024-10',
      outputFormat: 'json',
    })

    expect(mockedRunGraphiQLSession).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: '{"id":1}',
        apiVersion: '2024-10',
        outputFormat: 'json',
      }),
    )
  })
})
