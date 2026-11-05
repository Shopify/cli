import StoreAuth from './auth.js'
import {waitForStoreAuthCode} from '../../services/store/auth/callback.js'
import {exchangeStoreAuthCodeForToken} from '../../services/store/auth/token-client.js'
import {resolveExistingStoreAuthScopes} from '../../services/store/auth/existing-scopes.js'
import {storeAuthJsonOutputSchema} from '../../services/store/auth/types.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import type * as System from '@shopify/cli-kit/node/system'

const {openURLMock} = vi.hoisted(() => ({openURLMock: vi.fn()}))

vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/callback.js')
vi.mock('../../services/store/auth/token-client.js')
vi.mock('../../services/store/auth/existing-scopes.js')
vi.mock('@shopify/cli-kit/node/store-auth-session')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof System>()),
  openURL: openURLMock,
}))

describe('store auth JSON output', () => {
  test.each([true, false])('separates browser guidance from the result when opening succeeds: %s', async (opened) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      openURLMock.mockResolvedValue(opened)
      vi.mocked(resolveExistingStoreAuthScopes).mockResolvedValue({scopes: [], authoritative: false})
      vi.mocked(waitForStoreAuthCode).mockImplementation(async (options) => {
        await options.onListening?.()
        return 'auth-code'
      })
      vi.mocked(exchangeStoreAuthCodeForToken).mockResolvedValue({
        access_token: 'access-token',
        scope: 'read_products',
        associated_user: {id: 42, email: 'merchant@example.com'},
      })

      await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products', '--json'])

      // Parsing the entire stream also rejects extra results or guidance written to stdout.
      const result = JSON.parse(stdout())
      expect(storeAuthJsonOutputSchema.validate(result)).toEqual({
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: expect.any(String),
        hasRefreshToken: false,
        associatedUser: {id: 42, email: 'merchant@example.com'},
      })
      expect(stderr()).toContain('Shopify CLI will open the app authorization page in your browser.')
      expect(openURLMock).toHaveBeenCalledWith(
        expect.stringContaining('https://shop.myshopify.com/admin/oauth/authorize?'),
      )
      if (!opened) {
        expect(stderr()).toContain('Browser did not open automatically. Open this URL manually:')
        expect(stderr()).toContain(openURLMock.mock.calls[0]![0])
      }
    })
  })
})
