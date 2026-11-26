import {buildGraphiQLUrl, generateRandomGraphiQLKey, runGraphiQLSession, waitForGraphiQLAbort} from './session.js'
import {graphiqlJsonOutputSchema} from './schema.js'
import {MUTATIONS_BLOCKED_MESSAGE, setupGraphiQLServer, TokenProvider} from './server.js'
import {runWithCommandEventsForCommand} from '../command-events.js'
import {withCapturedStandardStreams} from '../testing/output.js'
import {AbortController} from '../abort.js'
import {openURL} from '../system.js'
import {getAvailableTCPPort} from '../tcp.js'
import {fetch as shopifyFetch, Response} from '../http.js'
import {supportedApiVersions} from '../api/admin.js'
import {describe, expect, test, vi} from 'vitest'
import {createServer} from 'node:http'

vi.mock('../system.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../system.js')>()
  return {...original, openURL: vi.fn(async () => true)}
})
vi.mock('./server.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./server.js')>()
  return {...original, setupGraphiQLServer: vi.fn(original.setupGraphiQLServer)}
})
vi.mock('../tcp.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../tcp.js')>()
  return {...original, getAvailableTCPPort: vi.fn(original.getAvailableTCPPort)}
})
vi.mock('../http.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../http.js')>()
  return {...original, fetch: vi.fn(original.fetch)}
})
vi.mock('../api/admin.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/admin.js')>()
  return {...original, supportedApiVersions: vi.fn(original.supportedApiVersions)}
})

const options = {
  storeFqdn: 'shop.myshopify.com',
  tokenProvider: {getToken: async () => 'token'},
  key: 'key',
  outputFormat: 'json' as const,
}

function records(stdout: string) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => graphiqlJsonOutputSchema.validate(JSON.parse(line)))
}

function listeners() {
  const processEvents: NodeJS.EventEmitter = process
  return ['SIGINT', 'SIGTERM', 'SIGQUIT', 'shopify:signal'].map((name) => processEvents.listeners(name))
}

describe('buildGraphiQLUrl', () => {
  test('builds a keyed local GraphiQL URL with optional prefilled fields', () => {
    const url = buildGraphiQLUrl({
      port: 4567,
      key: 'key',
      query: 'query { shop { name } }',
      variables: '{"id":1}',
      apiVersion: '2024-10',
    })

    const parsed = new URL(url)
    expect(parsed.origin).toBe('http://localhost:4567')
    expect(parsed.pathname).toBe('/graphiql')
    expect(parsed.searchParams.get('key')).toBe('key')
    expect(parsed.searchParams.get('query')).toBe('query { shop { name } }')
    expect(parsed.searchParams.get('variables')).toBe('{"id":1}')
    expect(parsed.searchParams.get('api_version')).toBe('2024-10')
  })
})

describe('generateRandomGraphiQLKey', () => {
  test('generates a 64-character hexadecimal key', () => {
    expect(generateRandomGraphiQLKey()).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('runGraphiQLSession', () => {
  test.each([
    ['shop.myshopify.com', 'shop.myshopify.com'],
    ['shop.myshopify.io', null],
    ['shop.my.shop.dev', null],
  ] as const)(
    'writes lifecycle records for %s only after listening and closes its real server',
    async (storeFqdn, storeDomain) => {
      const controller = new AbortController()
      const before = listeners()
      let url = ''
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        vi.mocked(openURL).mockImplementationOnce(async (readyUrl) => {
          url = readyUrl
          const response = await fetch(new URL('/graphiql/ping', readyUrl))
          await expect(response.text()).resolves.toBe('pong')
          expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready'])
          controller.abort()
          return true
        })
        await runWithCommandEventsForCommand(['--json'], () =>
          runGraphiQLSession({
            ...options,
            storeFqdn,
            abortSignal: controller.signal,
            protectMutations: true,
            apiVersion: '2024-10',
            appContext: {appName: 'Test App', appUrl: 'https://example.com/app', apiSecret: 'secret'},
          }),
        )
        expect(records(stdout())).toEqual([
          {type: 'starting', storeDomain, timestamp: expect.any(String)},
          {
            type: 'ready',
            timestamp: expect.any(String),
            url,
            storeDomain,
            api: 'admin',
            apiVersion: '2024-10',
            mutationsAllowed: false,
            app: {name: 'Test App', url: 'https://example.com/app'},
          },
          {type: 'stopped', timestamp: expect.any(String), reason: 'cancelled'},
        ])
        expect(stdout()).not.toContain('secret')
        expect(stderr()).toBe('')
      })
      await expect(fetch(new URL('/graphiql/ping', url))).rejects.toThrow()
      expect(listeners()).toEqual(before)
    },
  )

  test('keeps repeated recoverable request failures on stderr and native responses over HTTP', async () => {
    const controller = new AbortController()
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      vi.mocked(openURL).mockImplementationOnce(async (url) => {
        await Promise.all(
          Array.from({length: 2}, async () => {
            const response = await fetch(new URL('/graphiql/graphql.json?key=key&api_version=2024-10', url), {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({query: 'mutation { shopUpdate(input: {}) { shop { id } } }'}),
            })
            expect(response.status).toBe(400)
            await expect(response.json()).resolves.toEqual({errors: [{message: MUTATIONS_BLOCKED_MESSAGE}]})
          }),
        )
        await expect((await fetch(new URL('/graphiql/ping', url))).text()).resolves.toBe('pong')
        controller.abort()
        return true
      })
      await runWithCommandEventsForCommand(['--json'], () =>
        runGraphiQLSession({
          ...options,
          protectMutations: true,
          abortSignal: controller.signal,
        }),
      )
      expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
      const diagnostics = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(diagnostics).toHaveLength(2)
      expect(diagnostics).toEqual(
        Array.from({length: 2}, () => ({
          type: 'diagnostic',
          level: 'error',
          code: 'graphiql-request-failed',
          message: MUTATIONS_BLOCKED_MESSAGE,
          timestamp: expect.any(String),
        })),
      )
    })
  })

  test('rejects bind failures without emitting ready or stopped records and releases listeners', async () => {
    const port = await getAvailableTCPPort()
    const blocker = createServer()
    await new Promise<void>((resolve) => blocker.listen(port, 'localhost', resolve))
    const before = listeners()
    try {
      vi.mocked(getAvailableTCPPort).mockResolvedValueOnce(port)
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(runGraphiQLSession(options)).rejects.toThrow(/EADDRINUSE/)
        expect(records(stdout()).map((record) => record.type)).toEqual(['starting'])
      })
      expect(openURL).not.toHaveBeenCalled()
      expect(listeners()).toEqual(before)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })

  test('encodes HTTP handler failures as diagnostics without H3 terminal logs', async () => {
    const controller = new AbortController()
    vi.mocked(supportedApiVersions).mockRejectedValueOnce(new Error('upstream failed'))
    vi.mocked(openURL).mockImplementationOnce(async (url) => {
      const response = await fetch(url)
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({statusCode: 500, stack: []})
      controller.abort()
      return true
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        runGraphiQLSession({...options, abortSignal: controller.signal}),
      )
      expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', code: 'graphiql-request-failed'})
    })
  })

  test.each(['/graphiql?key=key', '/graphiql/status'])(
    'does not refresh credentials when shutdown aborts API-version loading at %s',
    async (path) => {
      const controller = new AbortController()
      const tokenProvider = {
        getToken: vi.fn(async () => 'token'),
        refreshToken: vi.fn(async () => {
          throw new Error('Unexpected token refresh after shutdown')
        }),
      }
      let requested: () => void
      const upstreamStarted = new Promise<void>((resolve) => {
        requested = resolve
      })
      vi.mocked(supportedApiVersions).mockImplementationOnce(async (_session, mode) => {
        const signal =
          typeof mode === 'object' && typeof mode.useAbortSignal === 'function' ? mode.useAbortSignal() : undefined
        expect(signal).toBeDefined()
        return new Promise((_resolve, reject) => {
          signal!.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
          requested()
        })
      })
      let browserRequest: Promise<unknown> | undefined
      vi.mocked(openURL).mockImplementationOnce(async (url) => {
        browserRequest = fetch(new URL(path, url)).catch((error: unknown) => error)
        await upstreamStarted
        controller.abort()
        return true
      })
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runGraphiQLSession({...options, tokenProvider, abortSignal: controller.signal})
        await expect(browserRequest).resolves.toBeInstanceOf(Error)
        expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
        expect(stderr()).toBe('')
      })
      expect(tokenProvider.getToken).toHaveBeenCalledTimes(1)
      expect(tokenProvider.refreshToken).not.toHaveBeenCalled()
      expect(supportedApiVersions).toHaveBeenCalledTimes(1)
    },
  )

  test.each([
    ['/graphiql?key=key', 'getToken'],
    ['/graphiql/status', 'getToken'],
    ['/graphiql/graphql.json?key=key&api_version=2024-10', 'getToken'],
    ['/graphiql?key=key', 'refreshToken'],
    ['/graphiql/status', 'refreshToken'],
    ['/graphiql/graphql.json?key=key&api_version=2024-10', 'refreshToken'],
  ] as const)('cancels requests to %s during %s on shutdown', async (path, operation) => {
    const controller = new AbortController()
    const tokenProvider: TokenProvider = {
      getToken: vi.fn(async () => 'token'),
      refreshToken: vi.fn(async () => 'refreshed-token'),
    }
    let tokenAborted = false
    let requested: () => void
    const tokenStarted = new Promise<void>((resolve) => {
      requested = resolve
    })
    const pendingToken = vi.fn(async (signal?: AbortSignal) => {
      return new Promise<string>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            tokenAborted = true
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          },
          {once: true},
        )
        requested()
      })
    })
    tokenProvider[operation] = pendingToken
    const graphql = path.includes('graphql.json')
    if (operation === 'refreshToken') {
      if (graphql) {
        vi.mocked(shopifyFetch).mockResolvedValueOnce(new Response(null, {status: 401}))
      } else {
        vi.mocked(supportedApiVersions).mockRejectedValueOnce(new Error('Token expired'))
      }
    }
    let browserRequest: Promise<unknown> | undefined
    vi.mocked(openURL).mockImplementationOnce(async (url) => {
      browserRequest = fetch(
        new URL(path, url),
        graphql
          ? {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({query: '{ shop { name } }'}),
            }
          : undefined,
      ).catch((error: unknown) => error)
      await tokenStarted
      controller.abort()
      return true
    })

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runGraphiQLSession({...options, tokenProvider, abortSignal: controller.signal})
      await expect(browserRequest).resolves.toBeInstanceOf(Error)
      expect(tokenAborted).toBe(true)
      expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
      expect(stderr()).toBe('')
    })
    expect(pendingToken).toHaveBeenCalledTimes(1)
    expect(tokenProvider.getToken).toHaveBeenCalledTimes(1)
    expect(tokenProvider.refreshToken).toHaveBeenCalledTimes(operation === 'refreshToken' ? 1 : 0)
  })

  test('aborts an outstanding upstream request and closes active browser connections on cancellation', async () => {
    const controller = new AbortController()
    let upstreamAborted = false
    let requested: () => void
    const upstreamStarted = new Promise<void>((resolve) => {
      requested = resolve
    })
    vi.mocked(shopifyFetch).mockImplementationOnce(async (_url, request) => {
      requested()
      return new Promise((_resolve, reject) => {
        request?.signal?.addEventListener('abort', () => {
          upstreamAborted = true
          reject(new Error('aborted'))
        })
      })
    })
    let browserRequest: Promise<unknown> | undefined
    vi.mocked(openURL).mockImplementationOnce(async (url) => {
      browserRequest = fetch(new URL('/graphiql/graphql.json?key=key&api_version=2024-10', url), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: '{ shop { name } }'}),
      }).catch((error: unknown) => error)
      await upstreamStarted
      controller.abort()
      return true
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      await runGraphiQLSession({...options, abortSignal: controller.signal})
      expect(records(stdout()).at(-1)).toMatchObject({type: 'stopped'})
      expect(upstreamAborted).toBe(true)
      await expect(browserRequest).resolves.toBeInstanceOf(Error)
    })
  })

  test.each(['browser', 'server', 'close'])('closes the server after a fatal %s failure', async (failure) => {
    const before = listeners()
    const original = await vi.importActual<typeof import('./server.js')>('./server.js')
    let runningServer: ReturnType<typeof setupGraphiQLServer> | undefined
    let url = ''
    vi.mocked(setupGraphiQLServer).mockImplementationOnce((serverOptions) => {
      runningServer = original.setupGraphiQLServer(serverOptions)
      return runningServer
    })
    vi.mocked(openURL).mockImplementationOnce(async (readyUrl) => {
      url = readyUrl
      if (failure === 'browser') throw new Error('browser failed')
      if (failure === 'server') runningServer!.emit('error', new Error('server failed'))
      if (failure === 'close') runningServer!.close()
      return true
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runGraphiQLSession(options)).rejects.toThrow(failure === 'close' ? 'closed unexpectedly' : 'failed')
      expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready'])
    })
    await expect(fetch(new URL('/graphiql/ping', url))).rejects.toThrow()
    expect(listeners()).toEqual(before)
  })

  test.each([
    ['SIGINT', 'sigint', 130],
    ['SIGTERM', 'sigterm', 143],
    ['SIGQUIT', 'sigquit', 131],
  ] as const)('handles delegated %s and emits stopped after cleanup', async (signal, reason, exitCode) => {
    const originalExitCode = process.exitCode
    const before = listeners()
    let url = ''
    vi.mocked(openURL).mockImplementationOnce(async (readyUrl) => {
      url = readyUrl
      const processEvents: NodeJS.EventEmitter = process
      processEvents.emit('shopify:signal', signal)
      processEvents.emit('shopify:signal', signal)
      return true
    })
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await runGraphiQLSession(options)
        expect(records(stdout()).at(-1)).toMatchObject({type: 'stopped', reason})
      })
      expect(process.exitCode).toBe(exitCode)
      await expect(fetch(new URL('/graphiql/ping', url))).rejects.toThrow()
      expect(listeners()).toEqual(before)
    } finally {
      // eslint-disable-next-line require-atomic-updates -- This test owns and restores the process exit code.
      process.exitCode = originalExitCode
    }
  })

  test.each(['text', 'json'] as const)(
    'supports --no-input with %s output without opening a browser',
    async (outputFormat) => {
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
      const controller = new AbortController()
      const original = await vi.importActual<typeof import('./server.js')>('./server.js')
      vi.mocked(setupGraphiQLServer).mockImplementationOnce((serverOptions) => {
        const server = original.setupGraphiQLServer(serverOptions)
        server.once('listening', () => setImmediate(() => controller.abort()))
        return server
      })
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runGraphiQLSession({...options, outputFormat, abortSignal: controller.signal})
          if (outputFormat === 'json') {
            expect(records(stdout()).map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
          } else {
            expect(stdout()).toContain('GraphiQL server started on port')
            expect(stderr()).toContain('Press Ctrl+C to stop.')
          }
        })
        expect(openURL).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllEnvs()
      }
    },
  )

  test('does not acquire a port for an already cancelled session', async () => {
    const controller = new AbortController()
    controller.abort()
    await withCapturedStandardStreams(async ({stdout}) => {
      await runGraphiQLSession({...options, abortSignal: controller.signal})
      expect(records(stdout()).map((record) => record.type)).toEqual(['stopped'])
    })
    expect(getAvailableTCPPort).not.toHaveBeenCalled()
  })
})

describe('waitForGraphiQLAbort', () => {
  test('resolves immediately when the external signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(waitForGraphiQLAbort(controller.signal)).resolves.toBeUndefined()
  })
})
