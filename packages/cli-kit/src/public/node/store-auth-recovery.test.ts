import {
  throwIfStoredStoreAuthIsInvalid,
  throwMissingStoredStoreAuthError,
  throwReauthenticateStoreAuthError,
} from './store-auth-recovery.js'
import {
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoreAuthSessionSchema,
  type StoredStoreAppSession,
} from './store-auth-session.js'
import {STORE_AUTH_APP_CLIENT_ID} from './constants.js'
import {AdminApiRequestError} from './api/admin.js'
import {AbortError} from './error.js'
import {inTemporaryDirectory} from './fs.js'
import {LocalStorage} from './local-storage.js'
import {describe, expect, test} from 'vitest'

const SHOP = 'shop.myshopify.com'

function standardSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: SHOP,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    scopes: ['read_products', 'write_orders'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  }
}

function previewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    ...standardSession({
      userId: 'preview:placeholder-uuid',
      scopes: ['read_products', 'write_products', 'read_themes'],
    }),
    kind: 'preview',
    preview: {
      shopId: '123',
      name: 'Lavender Candles',
      createdAt: '2026-03-27T00:00:00.000Z',
    },
    ...overrides,
  }
}

function captureThrown(run: () => void): AbortError | undefined {
  try {
    run()
  } catch (error) {
    if (!(error instanceof AbortError)) throw error
    return error
  }
  return undefined
}

async function withStoredSession(
  session: StoredStoreAppSession,
  run: (storage: LocalStorage<StoreAuthSessionSchema>) => void,
): Promise<void> {
  await inTemporaryDirectory((cwd) => {
    const storage = new LocalStorage<StoreAuthSessionSchema>({cwd})
    setStoredStoreAppSession(session, storage)
    run(storage)
  })
}

describe('stored store auth recovery', () => {
  test('uses a scopes placeholder when stored authentication is missing', () => {
    const error = captureThrown(() => throwMissingStoredStoreAuthError(SHOP))

    expect(error).toMatchObject({
      message: `No stored app authentication found for ${SHOP}.`,
      nextSteps: [
        ['Run', {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`}, 'to authenticate'],
      ],
    })
  })

  test('uses the stored scopes for a standard session', () => {
    const error = captureThrown(() => throwReauthenticateStoreAuthError('Custom message.', standardSession()))

    expect(error).toMatchObject({
      message: 'Custom message.',
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes read_products,write_orders`},
          'to re-authenticate',
        ],
      ],
    })
  })

  test('clears a preview session and reports a likely claim for a typed 401', async () => {
    const session = previewSession()

    await withStoredSession(session, (storage) => {
      const error = captureThrown(() =>
        throwIfStoredStoreAuthIsInvalid(
          new AdminApiRequestError(401, `Error connecting to your store ${SHOP}: Unauthorized`),
          session,
          {storage},
        ),
      )

      expect(error).toMatchObject({
        message: `The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`,
        nextSteps: [
          [
            'Run',
            {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`},
            'to re-authenticate',
          ],
        ],
      })
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()
    })
  })

  test('keeps a stored session on a 404 under the default 401-only policy', async () => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      expect(() => throwIfStoredStoreAuthIsInvalid({response: {status: 404}}, session, {storage})).not.toThrow()
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toMatchObject({accessToken: 'token'})
    })
  })

  test('clears a stored session on a 404 when the caller classifies it explicitly', async () => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      const error = captureThrown(() =>
        throwIfStoredStoreAuthIsInvalid({response: {status: 404}}, session, {invalidStatuses: [401, 404], storage}),
      )

      expect(error).toMatchObject({message: `Stored app authentication for ${SHOP} is no longer valid.`})
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()
    })
  })
})
