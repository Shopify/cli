import {withFetchProxy} from './proxy.js'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {afterEach, expect, test, vi} from 'vitest'
import {getGlobalDispatcher} from 'undici'
import {createServer, type Server} from 'node:http'
import type {Socket} from 'node:net'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('sends GraphQL requests through SHOPIFY_HTTP_PROXY and restores the dispatcher', async () => {
  vi.stubEnv('NO_PROXY', '*')
  vi.stubEnv('no_proxy', '*')
  const previousDispatcher = getGlobalDispatcher()
  const connections: string[] = []
  const proxy = createServer()
  const sockets = trackSockets(proxy)
  proxy.on('connect', (request, socket) => {
    connections.push(request.url!)
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    socket.once('data', () => {
      const body = JSON.stringify({data: {ok: true}})
      socket.end(
        `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`,
      )
    })
  })

  try {
    const proxyUrl = await listen(proxy)
    const result = await withFetchProxy(
      () => graphqlRequest({api: 'test', url: 'http://proxy-only.invalid/graphql', query: 'query { ok }'}),
      {SHOPIFY_HTTP_PROXY: proxyUrl},
    )
    expect(result).toEqual({ok: true})
    expect(connections).toEqual(['proxy-only.invalid:80'])
    expect(getGlobalDispatcher()).toBe(previousDispatcher)
  } finally {
    await close(proxy, sockets)
  }
})

test('retries a native fetch socket failure and preserves GraphQL variables', async () => {
  let requests = 0
  let body = ''
  const server = createServer((request, response) => {
    requests++
    if (requests === 1) {
      request.socket.destroy()
      return
    }
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      response.writeHead(200, {'Content-Type': 'application/json'})
      response.end(JSON.stringify({data: {ok: true}}))
    })
  })
  const sockets = trackSockets(server)

  try {
    const url = await listen(server)
    const result = await graphqlRequest({
      api: 'test',
      url,
      query: 'query Example($id: ID!) { node(id: $id) { id } }',
      variables: {id: 'test-id'},
      preferredBehaviour: {useNetworkLevelRetry: true, maxRetryTimeMs: 2000, useAbortSignal: true, timeoutMs: 1000},
    })
    expect(result).toEqual({ok: true})
    expect(requests).toBe(2)
    expect(JSON.parse(body)).toMatchObject({operationName: 'Example', variables: {id: 'test-id'}})
  } finally {
    await close(server, sockets)
  }
})

test('cancels an active native GraphQL request', async () => {
  const controller = new AbortController()
  const server = createServer(() => controller.abort())
  const sockets = trackSockets(server)

  try {
    const url = await listen(server)
    await expect(
      graphqlRequest({
        api: 'test',
        url,
        query: 'query { ok }',
        preferredBehaviour: {useNetworkLevelRetry: false, useAbortSignal: controller.signal},
      }),
    ).rejects.toMatchObject({name: 'AbortError'})
  } finally {
    await close(server, sockets)
  }
})

test.each(['http', 'https'] as const)('uses the %s proxy for HTTPS requests', async (proxyVariable) => {
  const connections: string[] = []
  const proxy = createServer()
  const sockets = trackSockets(proxy)
  proxy.on('connect', (request, socket) => {
    connections.push(request.url!)
    socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
  })

  try {
    const proxyUrl = await listen(proxy)
    const env =
      proxyVariable === 'http'
        ? {SHOPIFY_HTTP_PROXY: proxyUrl}
        : {SHOPIFY_HTTP_PROXY: 'http://127.0.0.1:1', SHOPIFY_HTTPS_PROXY: proxyUrl}
    await expect(
      withFetchProxy(() => fetch('https://proxy-only.invalid/graphql', {signal: AbortSignal.timeout(1000)}), env),
    ).rejects.toThrow()
    expect(connections).toEqual(['proxy-only.invalid:443'])
  } finally {
    await close(proxy, sockets)
  }
})

test.each(['127.0.0.1', '*'])('bypasses the proxy with SHOPIFY_NO_PROXY=%s', async (noProxy) => {
  const server = createServer((_request, response) => {
    response.end('direct')
  })
  const sockets = trackSockets(server)

  try {
    const url = await listen(server)
    const result = await withFetchProxy(async () => (await fetch(url)).text(), {
      SHOPIFY_HTTP_PROXY: 'http://127.0.0.1:1',
      SHOPIFY_NO_PROXY: noProxy,
    })
    expect(result).toBe('direct')
  } finally {
    await close(server, sockets)
  }
})

test('does not use unprefixed HTTP_PROXY when only SHOPIFY_HTTPS_PROXY is set', async () => {
  vi.stubEnv('HTTP_PROXY', 'http://127.0.0.1:1')
  vi.stubEnv('http_proxy', 'http://127.0.0.1:1')
  const server = createServer((_request, response) => {
    response.end('direct')
  })
  const sockets = trackSockets(server)

  try {
    const url = await listen(server)
    const result = await withFetchProxy(async () => (await fetch(url)).text(), {
      SHOPIFY_HTTPS_PROXY: 'http://127.0.0.1:1',
    })
    expect(result).toBe('direct')
  } finally {
    await close(server, sockets)
  }
})

test('leaves the dispatcher unchanged when no Shopify proxy is set', async () => {
  const dispatcher = getGlobalDispatcher()
  await withFetchProxy(async () => {
    expect(getGlobalDispatcher()).toBe(dispatcher)
  }, {})
  expect(getGlobalDispatcher()).toBe(dispatcher)
})

test('restores the dispatcher when the command fails', async () => {
  const dispatcher = getGlobalDispatcher()
  const error = new Error('command failed')
  await expect(
    withFetchProxy(
      async () => {
        throw error
      },
      {SHOPIFY_HTTP_PROXY: 'http://127.0.0.1:1'},
    ),
  ).rejects.toBe(error)
  expect(getGlobalDispatcher()).toBe(dispatcher)
})

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  return `http://127.0.0.1:${address.port}`
}

function trackSockets(server: Server): Set<Socket> {
  const sockets = new Set<Socket>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  return sockets
}

async function close(server: Server, sockets: Set<Socket>): Promise<void> {
  for (const socket of sockets) socket.destroy()
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}
