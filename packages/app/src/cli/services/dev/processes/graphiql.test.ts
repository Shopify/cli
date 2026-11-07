import {launchGraphiQLServer} from './graphiql.js'
import {createClientCredentialsTokenProvider} from './graphiql-token-provider.js'
import {setupGraphiQLServer} from '@shopify/cli-kit/node/graphiql/server'
import {supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {expect, test, vi} from 'vitest'
import {Writable} from 'stream'
import {once} from 'events'

vi.mock('./graphiql-token-provider.js')
vi.mock('@shopify/cli-kit/node/api/admin', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/api/admin')>()
  return {...original, supportedApiVersions: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/graphiql/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/graphiql/server')>()
  return {...original, setupGraphiQLServer: vi.fn(original.setupGraphiQLServer)}
})

test.each(['/graphiql?key=key', '/graphiql/status'])(
  'aborts pending API-version loading at %s when app dev stops',
  async (path) => {
    const controller = new AbortController()
    const tokenProvider = {
      getToken: vi.fn(async () => 'token'),
      refreshToken: vi.fn(async () => 'refreshed-token'),
    }
    vi.mocked(createClientCredentialsTokenProvider).mockReturnValue(tokenProvider)
    let upstreamAborted = false
    let requested: () => void
    const upstreamStarted = new Promise<void>((resolve) => {
      requested = resolve
    })
    vi.mocked(supportedApiVersions).mockImplementationOnce(async (_session, mode) => {
      const signal =
        typeof mode === 'object' && typeof mode.useAbortSignal === 'function' ? mode.useAbortSignal() : undefined
      expect(signal).toBeDefined()
      return new Promise((_resolve, reject) => {
        signal!.addEventListener('abort', () => {
          upstreamAborted = true
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
        requested()
      })
    })
    const port = await getAvailableTCPPort()
    const output = new Writable({write: (_chunk, _encoding, callback) => callback()})
    await launchGraphiQLServer(
      {stdout: output, stderr: output, abortSignal: controller.signal},
      {
        appName: 'App',
        appUrl: 'https://example.com',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        storeFqdn: 'store.myshopify.com',
        key: 'key',
        port,
      },
    )
    const server = vi.mocked(setupGraphiQLServer).mock.results[0]!.value as ReturnType<typeof setupGraphiQLServer>
    let browserRequest: Promise<unknown> | undefined
    try {
      if (!server.listening) await once(server, 'listening')
      browserRequest = fetch(`http://localhost:${port}${path}`).catch((error: unknown) => error)
      await upstreamStarted
      const closed = once(server, 'close')

      controller.abort()

      await expect.poll(() => upstreamAborted).toBe(true)
      await closed
      await expect(browserRequest).resolves.toBeInstanceOf(Error)
      expect(tokenProvider.getToken).toHaveBeenCalledTimes(1)
      expect(tokenProvider.refreshToken).not.toHaveBeenCalled()
      expect(supportedApiVersions).toHaveBeenCalledTimes(1)
    } finally {
      server.close()
      server.closeAllConnections()
      await browserRequest
    }
  },
)
