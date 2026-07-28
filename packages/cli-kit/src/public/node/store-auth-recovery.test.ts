import {
  throwIfStoredStoreAuthIsInvalid,
  throwMissingStoredStoreAuthError,
  throwReauthenticateStoreAuthError,
  throwStoredStoreAuthInvalidError,
} from './store-auth-recovery.js'
import {STORE_AUTH_APP_CLIENT_ID} from './constants.js'
import {AbortError} from './error.js'
import {inTemporaryDirectory} from './fs.js'
import {LocalStorage} from './local-storage.js'
import {
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoreAuthSessionSchema,
  type StoredStoreAppSession,
} from './store-auth-session.js'
import {AdminApiRequestError} from './api/admin.js'
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
      // The full preapproved catalog is much larger in practice; a couple of entries are enough
      // to prove the placeholder is used instead of these.
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

// The shape graphql-request's `ClientError` has: the HTTP status nested under `response`. This is
// what escapes an Admin API call once the API version has been cached.
function graphQLClientError(status: number, message = 'GraphQL Error'): Error {
  const error = new Error(message) as Error & {response: {status: number; errors: {message: string}[]}}
  error.response = {status, errors: [{message}]}
  return error
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

describe('throwMissingStoredStoreAuthError', () => {
  test('reports no stored auth and prompts to authenticate (not re-authenticate) with a scopes placeholder', () => {
    const captured = captureThrown(() => throwMissingStoredStoreAuthError(SHOP))

    expect(captured).toMatchObject({
      message: `No stored app authentication found for ${SHOP}.`,
      nextSteps: [
        ['Run', {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`}, 'to authenticate'],
      ],
    })
  })
})

describe('throwReauthenticateStoreAuthError', () => {
  test('suggests the real scopes for a standard session', () => {
    const captured = captureThrown(() => throwReauthenticateStoreAuthError('Custom message.', standardSession()))

    expect(captured).toMatchObject({
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

  test('suggests a scopes placeholder for a preview session instead of its preapproved catalog', () => {
    const captured = captureThrown(() => throwReauthenticateStoreAuthError('Custom message.', previewSession()))

    expect(captured).toMatchObject({
      message: 'Custom message.',
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`},
          'to re-authenticate',
        ],
      ],
    })
  })
})

describe('throwStoredStoreAuthInvalidError', () => {
  test('uses the generic invalid-auth message and real scopes for a standard session', () => {
    const captured = captureThrown(() => throwStoredStoreAuthInvalidError(standardSession()))

    expect(captured).toMatchObject({
      message: `Stored app authentication for ${SHOP} is no longer valid.`,
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes read_products,write_orders`},
          'to re-authenticate',
        ],
      ],
    })
  })

  test('flags a likely claim and suggests a scopes placeholder for a preview session', () => {
    const captured = captureThrown(() => throwStoredStoreAuthInvalidError(previewSession()))

    expect(captured).toMatchObject({
      message: `The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`,
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`},
          'to re-authenticate',
        ],
      ],
    })
  })
})

describe('throwIfStoredStoreAuthIsInvalid', () => {
  test.each([401, 404])('reports an invalid standard session and clears it for HTTP %i by default', async (status) => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      const captured = captureThrown(() =>
        throwIfStoredStoreAuthIsInvalid(graphQLClientError(status), session, {storage}),
      )

      expect(captured).toBeInstanceOf(AbortError)
      expect(captured).toMatchObject({message: `Stored app authentication for ${SHOP} is no longer valid.`})
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()
    })
  })

  test('recognizes the status carried directly by a typed transport error', async () => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      const transportError = new AdminApiRequestError(401, `Error connecting to your store ${SHOP}: Unauthorized`)

      const captured = captureThrown(() => throwIfStoredStoreAuthIsInvalid(transportError, session, {storage}))

      expect(captured).toMatchObject({message: `Stored app authentication for ${SHOP} is no longer valid.`})
    })
  })

  // Clearing a preview session is what makes the `store auth` command this error prints runnable:
  // `store auth` refuses to start while a preview session is still stored for the store.
  test('clears an invalid preview session so the re-authentication it suggests can run', async () => {
    const session = previewSession()

    await withStoredSession(session, (storage) => {
      const captured = captureThrown(() => throwIfStoredStoreAuthIsInvalid(graphQLClientError(401), session, {storage}))

      expect(captured).toMatchObject({
        message: `The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`,
      })
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toBeUndefined()
    })
  })

  test('ignores a status the caller did not name, so a genuine not-found is not reported as invalid auth', async () => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      expect(() =>
        throwIfStoredStoreAuthIsInvalid(graphQLClientError(404), session, {invalidStatuses: [401], storage}),
      ).not.toThrow()
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toMatchObject({accessToken: 'token'})
    })
  })

  test.each([
    ['an unrelated HTTP status', graphQLClientError(500)],
    ['an error carrying no status at all', new Error('socket hang up')],
  ])('ignores %s', async (_description, error) => {
    const session = standardSession()

    await withStoredSession(session, (storage) => {
      expect(() => throwIfStoredStoreAuthIsInvalid(error, session, {storage})).not.toThrow()
      expect(getCurrentStoredStoreAppSession(SHOP, storage)).toMatchObject({accessToken: 'token'})
    })
  })
})
