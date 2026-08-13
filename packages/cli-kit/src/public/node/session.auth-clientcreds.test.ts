import {describe, expect, test, vi} from 'vitest'

import {ensureAuthenticatedAdminAsApp} from './session.js'
import {shopifyFetch} from './http.js'

vi.mock('./http.js')

describe('ensureAuthenticatedAdminAsApp client credentials errors', () => {
  test('does not include upstream status text in the error', async () => {
    vi.mocked(shopifyFetch).mockResolvedValueOnce({
      status: 500,
      statusText: 'attacker-controlled upstream detail',
      text: async () => JSON.stringify({error: 'invalid_client'}),
    } as unknown as Awaited<ReturnType<typeof shopifyFetch>>)

    const error = await ensureAuthenticatedAdminAsApp('mystore.myshopify.com', 'client123', 'secret456').catch(
      (caught) => caught,
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      'Failed to get access token for app client123 on store mystore.myshopify.com: HTTP status 500',
    )
    expect((error as Error).message).not.toContain('attacker-controlled upstream detail')
  })
})
