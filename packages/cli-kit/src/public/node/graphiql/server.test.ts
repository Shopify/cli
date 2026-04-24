import {deriveGraphiQLKey, resolveGraphiQLKey, setupGraphiQLServer, TokenProvider} from './server.js'
import {getAvailableTCPPort} from '../tcp.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {Server} from 'http'
import {Writable} from 'stream'

describe('deriveGraphiQLKey', () => {
  test('returns a 64-character hex string', () => {
    const key = deriveGraphiQLKey('secret', 'store.myshopify.com')
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  test('is deterministic — same inputs produce the same key', () => {
    const key1 = deriveGraphiQLKey('secret', 'store.myshopify.com')
    const key2 = deriveGraphiQLKey('secret', 'store.myshopify.com')
    expect(key1).toBe(key2)
  })

  test('different secrets produce different keys', () => {
    const key1 = deriveGraphiQLKey('secret-1', 'store.myshopify.com')
    const key2 = deriveGraphiQLKey('secret-2', 'store.myshopify.com')
    expect(key1).not.toBe(key2)
  })

  test('different stores produce different keys', () => {
    const key1 = deriveGraphiQLKey('secret', 'store-a.myshopify.com')
    const key2 = deriveGraphiQLKey('secret', 'store-b.myshopify.com')
    expect(key1).not.toBe(key2)
  })
})

describe('resolveGraphiQLKey', () => {
  test('uses provided key when non-empty', () => {
    const key = resolveGraphiQLKey('my-custom-key', 'secret', 'store.myshopify.com')
    expect(key).toBe('my-custom-key')
  })

  test('derives key when provided key is undefined', () => {
    const key = resolveGraphiQLKey(undefined, 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })

  test('derives key when provided key is empty string', () => {
    const key = resolveGraphiQLKey('', 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })

  test('derives key when provided key is whitespace-only', () => {
    const key = resolveGraphiQLKey('   ', 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })
})

describe('setupGraphiQLServer', () => {
  const servers: Server[] = []

  afterEach(() => {
    for (const server of servers) server.close()
    servers.length = 0
  })

  /**
   * Starts the GraphiQL server with the given options on an available port and
   * returns its base URL. Server is auto-closed by the afterEach hook.
   */
  async function startServer(options: {
    tokenProvider: TokenProvider
    storeFqdn?: string
    key?: string
    protectMutations?: boolean
    appContext?: {appName: string; appUrl: string; apiSecret: string}
  }) {
    const port = await getAvailableTCPPort()
    const noopStdout = new Writable({write: (_chunk, _enc, cb) => cb()})
    const server = setupGraphiQLServer({
      stdout: noopStdout,
      port,
      storeFqdn: options.storeFqdn ?? 'store.myshopify.com',
      tokenProvider: options.tokenProvider,
      key: options.key,
      protectMutations: options.protectMutations,
      appContext: options.appContext,
    })
    servers.push(server)
    await new Promise<void>((resolve) => server.on('listening', () => resolve()))
    return {url: `http://localhost:${port}`}
  }

  test('rejects mutations with HTTP 400 when protectMutations is true', async () => {
    const tokenProvider: TokenProvider = {getToken: vi.fn(async () => 'access-token')}
    const {url} = await startServer({tokenProvider, key: 'k', protectMutations: true})

    const response = await fetch(`${url}/graphiql/graphql.json?key=k&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: 'mutation M { shopUpdate(input: {}) { id } }'}),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as {errors: {message: string}[]}
    expect(body.errors[0]?.message).toMatch(/mutations are disabled/i)
    expect(tokenProvider.getToken).not.toHaveBeenCalled()
  })

  test('does not invoke the token provider for blocked mutations', async () => {
    const tokenProvider: TokenProvider = {
      getToken: vi.fn(async () => 'access-token'),
      refreshToken: vi.fn(async () => 'refreshed-token'),
    }
    const {url} = await startServer({tokenProvider, key: 'k', protectMutations: true})

    await fetch(`${url}/graphiql/graphql.json?key=k&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: 'mutation M { shopUpdate(input: {}) { id } }'}),
    })

    expect(tokenProvider.getToken).not.toHaveBeenCalled()
    expect(tokenProvider.refreshToken).not.toHaveBeenCalled()
  })

  test('lets queries through to the upstream call when protectMutations is true', async () => {
    const tokenProvider: TokenProvider = {getToken: vi.fn(async () => 'access-token')}
    const {url} = await startServer({tokenProvider, key: 'k', protectMutations: true})

    const response = await fetch(`${url}/graphiql/graphql.json?key=k&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: 'query Q { shop { name } }'}),
    })

    expect(response.status).not.toBe(400)
    expect(tokenProvider.getToken).toHaveBeenCalled()
  })

  test('returns 404 when the request key does not match', async () => {
    const tokenProvider: TokenProvider = {getToken: async () => 'access-token'}
    const {url} = await startServer({tokenProvider, key: 'expected-key'})

    const response = await fetch(`${url}/graphiql/graphql.json?key=wrong-key&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: '{ shop { name } }'}),
    })

    expect(response.status).toBe(404)
  })

  test('uses the deterministic derived key when appContext is provided and no key is set', async () => {
    const tokenProvider: TokenProvider = {getToken: async () => 'access-token'}
    const derived = deriveGraphiQLKey('app-secret', 'store.myshopify.com')
    const {url} = await startServer({
      tokenProvider,
      appContext: {appName: 'My App', appUrl: 'https://example.com', apiSecret: 'app-secret'},
    })

    const valid = await fetch(`${url}/graphiql/graphql.json?key=${derived}&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: 'mutation M { x { id } }'}),
    })
    expect(valid.status).not.toBe(404)

    const invalid = await fetch(`${url}/graphiql/graphql.json?key=wrong&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: 'mutation M { x { id } }'}),
    })
    expect(invalid.status).toBe(404)
  })

  test('generates a random per-process key when no appContext and no key are provided', async () => {
    const tokenProvider: TokenProvider = {getToken: async () => 'access-token'}
    const {url} = await startServer({tokenProvider})

    const response = await fetch(`${url}/graphiql/graphql.json?key=anything&api_version=2024-10`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: '{ shop { name } }'}),
    })

    // We don't know the key; hitting the endpoint with an arbitrary key should 404.
    expect(response.status).toBe(404)
  })
})
