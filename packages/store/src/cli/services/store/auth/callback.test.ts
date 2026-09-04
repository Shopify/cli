import {waitForStoreAuthCode} from './callback.js'
import {describe, expect, test} from 'vitest'
import {createServer} from 'http'

async function getAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Expected an ephemeral port.'))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

function callbackParams(options?: {code?: string; shop?: string; state?: string; error?: string}): URLSearchParams {
  const params = new URLSearchParams()
  params.set('shop', options?.shop ?? 'shop.myshopify.com')
  params.set('state', options?.state ?? 'state-123')

  if (options?.code) params.set('code', options.code)
  if (options?.error) params.set('error', options.error)
  if (!options?.code && !options?.error) params.set('code', 'abc123')

  return params
}

describe('store auth callback server', () => {
  test('waitForStoreAuthCode resolves after a valid callback', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    const onListening = async () => {
      const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
      expect(response.status).toBe(200)
      await response.text()
    }

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening,
      }),
    ).resolves.toBe('abc123')
  })

  test('waitForStoreAuthCode redirects a valid authorization handoff without settling auth', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    const authorizationUrl = 'https://shop.myshopify.com/admin/oauth/authorize?signup=signed.signup.jwt'
    const onListening = async () => {
      const handoffResponse = await globalThis.fetch(`http://127.0.0.1:${port}/auth/handoff?nonce=nonce-123`, {
        redirect: 'manual',
      })
      expect(handoffResponse.status).toBe(302)
      expect(handoffResponse.headers.get('Location')).toBe(authorizationUrl)
      expect(handoffResponse.headers.get('Cache-Control')).toBe('no-store')
      expect(handoffResponse.headers.get('Referrer-Policy')).toBe('no-referrer')

      const callbackResponse = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
      expect(callbackResponse.status).toBe(200)
      await callbackResponse.text()
    }

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        authorizationRedirect: {
          nonce: 'nonce-123',
          authorizationUrl,
        },
        onListening,
      }),
    ).resolves.toBe('abc123')
  })

  test('waitForStoreAuthCode answers 404 for a wrong nonce, a replay, and a non-GET handoff request', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    const authorizationUrl = 'https://shop.myshopify.com/admin/oauth/authorize?signup=signed.signup.jwt'
    const handoffUrl = `http://127.0.0.1:${port}/auth/handoff?nonce=nonce-123`
    const statuses: Record<string, number> = {}
    const bodies: string[] = []

    const onListening = async () => {
      const wrongNonce = await globalThis.fetch(`http://127.0.0.1:${port}/auth/handoff?nonce=wrong`, {
        redirect: 'manual',
      })
      statuses.wrongNonce = wrongNonce.status
      bodies.push(await wrongNonce.text())

      const missingNonce = await globalThis.fetch(`http://127.0.0.1:${port}/auth/handoff`, {redirect: 'manual'})
      statuses.missingNonce = missingNonce.status
      bodies.push(await missingNonce.text())

      const notGet = await globalThis.fetch(handoffUrl, {method: 'POST', redirect: 'manual'})
      statuses.notGet = notGet.status
      bodies.push(await notGet.text())

      const served = await globalThis.fetch(handoffUrl, {redirect: 'manual'})
      statuses.served = served.status
      await served.text()

      const replay = await globalThis.fetch(handoffUrl, {redirect: 'manual'})
      statuses.replay = replay.status
      bodies.push(await replay.text())

      const callbackResponse = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
      await callbackResponse.text()
    }

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        authorizationRedirect: {nonce: 'nonce-123', authorizationUrl},
        onListening,
      }),
    ).resolves.toBe('abc123')

    expect(statuses).toEqual({wrongNonce: 404, missingNonce: 404, notGet: 404, served: 302, replay: 404})
    expect(bodies.join('')).not.toContain('signed.signup.jwt')
  })

  test('waitForStoreAuthCode does not spend the handoff on a speculative browser fetch', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    const authorizationUrl = 'https://shop.myshopify.com/admin/oauth/authorize?signup=signed.signup.jwt'
    const handoffUrl = `http://127.0.0.1:${port}/auth/handoff?nonce=nonce-123`
    let prefetchStatus = 0
    let prefetchBody = ''
    let navigationStatus = 0
    let navigationLocation: string | null = null

    const onListening = async () => {
      const prefetch = await globalThis.fetch(handoffUrl, {
        headers: {'Sec-Purpose': 'prefetch;prerender'},
        redirect: 'manual',
      })
      prefetchStatus = prefetch.status
      prefetchBody = await prefetch.text()

      const navigation = await globalThis.fetch(handoffUrl, {redirect: 'manual'})
      navigationStatus = navigation.status
      navigationLocation = navigation.headers.get('Location')
      await navigation.text()

      const callbackResponse = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
      await callbackResponse.text()
    }

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        authorizationRedirect: {nonce: 'nonce-123', authorizationUrl},
        onListening,
      }),
    ).resolves.toBe('abc123')

    expect(prefetchStatus).toBe(404)
    expect(prefetchBody).not.toContain('signed.signup.jwt')
    expect(navigationStatus).toBe(302)
    expect(navigationLocation).toBe(authorizationUrl)
  })

  test('waitForStoreAuthCode rejects when callback state does not match', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({state: 'wrong-state'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('OAuth callback state does not match the original request.')
  })

  test('waitForStoreAuthCode rejects when callback store does not match and suggests the returned permanent domain', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({shop: 'other-shop.myshopify.com'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toMatchObject({
      message: 'OAuth callback store does not match the requested store.',
      tryMessage:
        'Shopify returned other-shop.myshopify.com during authentication. Re-run using the permanent store domain:',
      nextSteps: [[{command: 'shopify store auth --store other-shop.myshopify.com --scopes <comma-separated-scopes>'}]],
    })
  })

  test('waitForStoreAuthCode rejects when Shopify returns an OAuth error', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({error: 'access_denied'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('Shopify returned an OAuth error: access_denied')
  })

  test('waitForStoreAuthCode rejects when callback does not include an authorization code', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    params.delete('code')

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('OAuth callback did not include an authorization code.')
  })

  test('waitForStoreAuthCode rejects when the port is already in use', async () => {
    const port = await getAvailablePort()
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject)
      server.listen(port, '127.0.0.1', () => resolve())
    })

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(`Port ${port} is already in use.`)

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  test('waitForStoreAuthCode rejects on timeout', async () => {
    const port = await getAvailablePort()

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 25,
      }),
    ).rejects.toThrow('Timed out waiting for OAuth callback.')
  })
})
