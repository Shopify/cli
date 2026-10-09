import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {ensureNoOrganizationAutomationToken, setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../auth/session-lifecycle.js', () => ({loadStoredStoreSession: vi.fn()}))
vi.mock('../attribution.js')
vi.mock('@shopify/cli-kit/node/session')

describe('prepareBulkAdminContext', () => {
  const store = 'shop.myshopify.com'
  const storedSession = {
    store,
    clientId: 'client-id',
    userId: '42',
    accessToken: 'token',
    refreshToken: 'refresh-token',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.mocked(loadStoredStoreSession).mockResolvedValue(storedSession)
  })

  test('loads the stored session and builds an admin session', async () => {
    const result = await prepareBulkAdminContext(store)

    expect(loadStoredStoreSession).toHaveBeenCalledWith(store)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(store, true)
    expect(setLastSeenUserId).toHaveBeenCalledWith('42')
    expect(result).toEqual({token: 'token', storeFqdn: store})
  })

  test('refuses to use stored store auth while the organization automation token is set', async () => {
    vi.mocked(ensureNoOrganizationAutomationToken).mockImplementation(() => {
      throw new AbortError("This command can't use SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN.")
    })

    await expect(prepareBulkAdminContext(store)).rejects.toThrow(
      "This command can't use SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN.",
    )
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
  })
})
