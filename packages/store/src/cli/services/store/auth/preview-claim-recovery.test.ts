import {authenticateStoreWithApp} from './index.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {throwIfStoredStoreAuthIsInvalid} from '@shopify/cli-kit/node/store-auth-recovery'
import {
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoreAuthSessionSchema,
  type StoredStoreAppSession,
} from '@shopify/cli-kit/node/store-auth-session'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AdminApiRequestError} from '@shopify/cli-kit/node/api/admin'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../attribution.js')

const SHOP = 'shop.myshopify.com'

// Stopping the run at scope resolution is deliberate: the only question this test asks is whether
// the preview-store guard lets `store auth` start at all, and letting the OAuth flow finish would
// persist a session through the module-level storage this test intentionally bypasses.
const SCOPE_RESOLUTION_REACHED = 'Scope resolution reached, so the preview-store guard did not fire.'

function previewSession(): StoredStoreAppSession {
  return {
    store: SHOP,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: 'preview:placeholder-uuid',
    accessToken: 'shpat_preview_token',
    scopes: ['read_themes', 'write_themes'],
    acquiredAt: '2026-06-08T12:00:00.000Z',
    kind: 'preview',
    preview: {shopId: '123', name: 'Lavender Candles', createdAt: '2026-06-08T12:00:00.000Z'},
  }
}

function runStoreAuth(storage: LocalStorage<StoreAuthSessionSchema>): Promise<unknown> {
  return authenticateStoreWithApp(
    {store: SHOP, scopes: 'read_products'},
    {
      getCurrentStoredStoreAppSession: (store) => getCurrentStoredStoreAppSession(store, storage),
      resolveExistingScopes: () => Promise.reject(new AbortError(SCOPE_RESOLUTION_REACHED)),
      openURL: vi.fn(),
      waitForStoreAuthCode: vi.fn(),
      exchangeStoreAuthCodeForToken: vi.fn(),
      presenter: {openingBrowser: vi.fn(), manualAuthUrl: vi.fn(), success: vi.fn()},
    },
  )
}

// The two halves of the claimed-preview-store recovery only work as a pair: `store auth` is
// unavailable while a preview session is stored, so the `store auth` next step the invalid-session
// error prints is reachable only because that error clears the session on its way out.
describe('recovering from a claimed preview store', () => {
  test('clearing the invalid preview session unblocks the `store auth` run the error points at', async () => {
    await inTemporaryDirectory(async (cwd) => {
      const storage = new LocalStorage<StoreAuthSessionSchema>({cwd})
      const session = previewSession()
      setStoredStoreAppSession(session, storage)

      // Before recovery: `store auth` refuses to start for a store with a stored preview session.
      await expect(runStoreAuth(storage)).rejects.toThrow('`store auth` is unavailable for preview stores.')

      // The 401 the claimed store's stale preview token now answers with.
      const claimFailure = new AdminApiRequestError(401, `Error connecting to your store ${SHOP}: Unauthorized`)
      expect(() => throwIfStoredStoreAuthIsInvalid(claimFailure, session, {storage})).toThrow(
        `The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`,
      )
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()

      // After recovery: the guard no longer fires, so the suggested command gets into the flow that
      // mints a fresh standard session.
      await expect(runStoreAuth(storage)).rejects.toThrow(SCOPE_RESOLUTION_REACHED)
    })
  })
})
