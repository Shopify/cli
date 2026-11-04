import {MAX_HEADER_SIZE, installStorefrontFetchDispatcher} from './storefront-fetch.js'

import {Agent, getGlobalDispatcher, setGlobalDispatcher} from 'undici'
import {afterAll, describe, expect, test} from 'vitest'

import {createServer, type Server} from 'node:http'

const originalDispatcher = getGlobalDispatcher()

afterAll(() => {
  // Other files share no process state with this one, but leave the global
  // dispatcher exactly as it was found anyway.
  setGlobalDispatcher(originalDispatcher)
})

/**
 * Starts a server that responds with `Set-Cookie` headers totalling roughly
 * `headerBytes` bytes, mimicking a storefront response on a cookie'd request.
 */
async function startCookieServer(headerBytes: number): Promise<{url: string; close: () => Promise<void>}> {
  const server = createServer((_req, res) => {
    const cookies: string[] = []
    let size = 0
    for (let index = 0; size < headerBytes; index++) {
      const cookie = `cookie${index}=${'x'.repeat(200)}; Path=/; Secure`
      cookies.push(cookie)
      size += cookie.length
    }
    res.writeHead(200, {'content-type': 'text/html', 'set-cookie': cookies})
    res.end('<html>ok</html>')
  })
  return listen(server)
}

async function startEchoServer(options?: {maxHeaderSize?: number}): Promise<{url: string; close: () => Promise<void>}> {
  const server = createServer(options ?? {}, (_req, res) => {
    res.writeHead(200, {'content-type': 'text/plain'})
    res.end('ok')
  })
  return listen(server)
}

async function listen(server: Server): Promise<{url: string; close: () => Promise<void>}> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected the test server to have a port')
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

async function fetchError(url: string): Promise<Error & {cause?: Error & {code?: string}}> {
  try {
    const response = await fetch(url)
    await response.text()
  } catch (error) {
    // Fetch failures surface as TypeError; anything else is a broken test.
    if (error instanceof TypeError) return error as Error & {cause?: Error & {code?: string}}
    throw error
  }
  throw new Error(`Expected fetching ${url} to fail`)
}

describe('storefront fetch header limits', () => {
  test('rejects a storefront response past the inherited default cap before the dispatcher is installed', async () => {
    // Given a plain undici agent, whose header cap is whatever Node defaults to
    setGlobalDispatcher(new Agent())
    const server = await startCookieServer(64 * 1024)
    try {
      // When fetching a response with a ~64 KiB header block
      const error = await fetchError(server.url)
      // Then the real cause is the header overflow, not the generic wrapper
      expect(error.message).toBe('fetch failed')
      expect(error.cause?.code).toBe('UND_ERR_HEADERS_OVERFLOW')
    } finally {
      await server.close()
    }
  })

  test('accepts storefront responses with large Set-Cookie headers once the dispatcher is installed', async () => {
    // Given
    installStorefrontFetchDispatcher()
    const server = await startCookieServer(96 * 1024)
    try {
      // When
      const response = await fetch(server.url)
      // Then
      expect(response.status).toBe(200)
      await expect(response.text()).resolves.toContain('ok')
    } finally {
      await server.close()
    }
  })

  test('still rejects storefront responses past the pinned cap', async () => {
    // Given
    installStorefrontFetchDispatcher()
    const server = await startCookieServer(MAX_HEADER_SIZE * 2)
    try {
      // When / Then: the cap is pinned at MAX_HEADER_SIZE, not removed
      const error = await fetchError(server.url)
      expect(error.cause?.code).toBe('UND_ERR_HEADERS_OVERFLOW')
    } finally {
      await server.close()
    }
  })

  test('a server created with MAX_HEADER_SIZE accepts requests with large Cookie headers', async () => {
    const cookie = `session=${'x'.repeat(64 * 1024)}`

    // Given a server with Node's default request-header cap
    const defaultServer = await startEchoServer()
    try {
      const response = await fetch(defaultServer.url, {headers: {cookie}})
      // Then Node turns the browser's request away before the app sees it
      expect(response.status).toBe(431)
      await response.text()
    } finally {
      await defaultServer.close()
    }

    // Given the dev server's pinned cap
    const server = await startEchoServer({maxHeaderSize: MAX_HEADER_SIZE})
    try {
      // When / Then the same request is handled normally
      const response = await fetch(server.url, {headers: {cookie}})
      expect(response.status).toBe(200)
      await expect(response.text()).resolves.toBe('ok')
    } finally {
      await server.close()
    }
  })
})
