import {storefrontDispatcher, storefrontFetch} from './storefront-fetch.js'

import {afterAll, expect, test} from 'vitest'

import {createServer} from 'node:http'

afterAll(async () => {
  await storefrontDispatcher.close()
})

test('accepts storefront responses with large headers', async () => {
  const server = createServer((_request, response) => {
    response.setHeader('set-cookie', `session=${'x'.repeat(48 * 1024)}`)
    response.end('ok')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')

  try {
    await expect(
      storefrontFetch(new URL(`http://127.0.0.1:${address.port}`), {method: 'GET'}).then(async (response) => ({
        status: response.status,
        body: await response.text(),
      })),
    ).resolves.toEqual({status: 200, body: 'ok'})
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})
