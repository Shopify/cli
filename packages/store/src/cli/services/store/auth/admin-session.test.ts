import {loadAdminSessionFromStoreAuth} from './admin-session.js'
import {loadStoredStoreSession} from './session-lifecycle.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./session-lifecycle.js')
vi.mock('../attribution.js')
vi.mock('@shopify/cli-kit/node/session')

describe('loadAdminSessionFromStoreAuth', () => {
  test('returns an Admin session from a matching stored store auth session', async () => {
    const storedSession = {
      store: 'preview.myshopify.com',
      clientId: 'client-id',
      userId: 'preview:123',
      accessToken: 'shpat_token',
      scopes: [],
      acquiredAt: '2026-06-08T12:00:00.000Z',
      kind: 'preview' as const,
      preview: {
        shopId: '123',
        name: 'Preview Store',
        createdAt: '2026-06-08T12:00:00.000Z',
      },
    }
    vi.mocked(loadStoredStoreSession).mockResolvedValue(storedSession)

    const got = await loadAdminSessionFromStoreAuth('https://preview.myshopify.com/admin')

    expect(loadStoredStoreSession).toHaveBeenCalledWith('preview.myshopify.com')
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('preview.myshopify.com', true)
    expect(setLastSeenUserId).toHaveBeenCalledWith('preview:123')
    expect(got).toEqual({
      adminSession: {token: 'shpat_token', storeFqdn: 'preview.myshopify.com'},
      session: storedSession,
    })
  })

  test('propagates store auth cache errors', async () => {
    vi.mocked(loadStoredStoreSession).mockRejectedValue(new Error('missing session'))

    await expect(loadAdminSessionFromStoreAuth('preview.myshopify.com')).rejects.toThrow('missing session')
    expect(recordStoreFqdnMetadata).not.toHaveBeenCalled()
    expect(setLastSeenUserId).not.toHaveBeenCalled()
  })
})
