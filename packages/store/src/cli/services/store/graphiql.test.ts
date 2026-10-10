import {openStoreGraphiQL} from './graphiql.js'
import {loadStoredStoreSession} from './auth/session-lifecycle.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortError} from '@shopify/cli-kit/node/error'
import {generateRandomGraphiQLKey, runGraphiQLSession} from '@shopify/cli-kit/node/graphiql/session'
import {ensureNoOrganizationAutomationToken} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/graphiql/session')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('./auth/session-lifecycle.js')

const mockedRunGraphiQLSession = vi.mocked(runGraphiQLSession)
const mockedGenerateRandomGraphiQLKey = vi.mocked(generateRandomGraphiQLKey)
const mockedLoadSession = vi.mocked(loadStoredStoreSession)

describe('openStoreGraphiQL', () => {
  beforeEach(() => {
    mockedRunGraphiQLSession.mockResolvedValue()
    mockedGenerateRandomGraphiQLKey.mockReturnValue('generated-key')
    mockedLoadSession.mockResolvedValue({
      store: 'shop.myshopify.com',
      accessToken: 'stored-token',
    } as unknown as Awaited<ReturnType<typeof loadStoredStoreSession>>)
  })

  test('forwards configuration to the shared GraphiQL session runner', async () => {
    const abortSignal = new AbortController().signal

    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      port: 4567,
      allowMutations: false,
      abortSignal,
    })

    expect(mockedRunGraphiQLSession).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 4567,
        storeFqdn: 'shop.myshopify.com',
        key: 'generated-key',
        protectMutations: true,
        abortSignal,
      }),
    )
  })

  test('protectMutations follows --allow-mutations', async () => {
    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      allowMutations: true,
    })

    expect(mockedRunGraphiQLSession).toHaveBeenCalledWith(
      expect.objectContaining({
        protectMutations: false,
      }),
    )
  })

  test('refuses to start while the organization automation token is set', async () => {
    vi.mocked(ensureNoOrganizationAutomationToken).mockImplementation(() => {
      throw new AbortError("This command can't use SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN.")
    })

    await expect(openStoreGraphiQL({store: 'shop.myshopify.com'})).rejects.toThrow(
      "This command can't use SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN.",
    )
    expect(mockedRunGraphiQLSession).not.toHaveBeenCalled()
  })

  test('uses a TokenProvider backed by loadStoredStoreSession', async () => {
    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
    })

    const tokenProvider = mockedRunGraphiQLSession.mock.calls[0]![0].tokenProvider
    await expect(tokenProvider.getToken()).resolves.toBe('stored-token')
    expect(mockedLoadSession).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('passes prefilled query, variables, and apiVersion to the shared session runner', async () => {
    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
      variables: '{"id":1}',
      apiVersion: '2024-10',
    })

    expect(mockedRunGraphiQLSession).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query { shop { name } }',
        variables: '{"id":1}',
        apiVersion: '2024-10',
      }),
    )
  })

  test('passes mutation status as an additional ready message', async () => {
    await openStoreGraphiQL({
      store: 'shop.myshopify.com',
      allowMutations: true,
    })

    expect(mockedRunGraphiQLSession.mock.calls[0]![0].additionalReadyMessages?.[0]).toMatchObject({
      value: expect.stringContaining('allowed'),
    })
  })
})
