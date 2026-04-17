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
