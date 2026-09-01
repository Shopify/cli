import {authenticateStoreWithApp} from './index.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {INVALID_STORED_AUTH_STATUSES} from '../admin-errors.js'
import {throwIfStoredStoreAuthIsInvalid} from '@shopify/cli-kit/node/store-auth-recovery'
import {
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoreAuthSessionSchema,
  type StoredStoreAppSession,
} from '@shopify/cli-kit/node/store-auth-session'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AdminApiRequestError} from '@shopify/cli-kit/node/api/admin'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../attribution.js')

const SHOP = 'shop.myshopify.com'
const SCOPE_RESOLUTION_REACHED = 'Scope resolution reached, so the preview-store guard did not fire.'

type StoreAuthStorage = LocalStorage<StoreAuthSessionSchema>

function createStoreAuthStorage(cwd: string): StoreAuthStorage {
  return new LocalStorage<StoreAuthSessionSchema>({cwd})
}

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

function runStoreAuth(storage: StoreAuthStorage): Promise<unknown> {
  return authenticateStoreWithApp(
    {store: SHOP, scopes: 'read_products'},
    {
      getCurrentStoredStoreAppSession: (store) => getCurrentStoredStoreAppSession(store, storage),
      resolveExistingScopes: () => Promise.reject(new AbortError(SCOPE_RESOLUTION_REACHED)),
    },
  )
}

describe('recovering from a claimed preview store', () => {
  test('clearing the invalid preview session unblocks the suggested `store auth` run', async () => {
    await inTemporaryDirectory(async (cwd) => {
      const storage = createStoreAuthStorage(cwd)
      const session = previewSession()
      setStoredStoreAppSession(session, storage)

      await expect(runStoreAuth(storage)).rejects.toThrow('`store auth` is unavailable for preview stores.')

      expect(() =>
        throwIfStoredStoreAuthIsInvalid(
          new AdminApiRequestError(401, `Error connecting to your store ${SHOP}: Unauthorized`),
          session,
          {invalidStatuses: INVALID_STORED_AUTH_STATUSES, storage},
        ),
      ).toThrow(`The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`)
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()

      await expect(runStoreAuth(storage)).rejects.toThrow(SCOPE_RESOLUTION_REACHED)
    })
  })
})
