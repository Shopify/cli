import {describe, expect, test, vi} from 'vitest'
// Vitest intercepts console.warn; use Node's console to exercise the real stderr writer.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
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
    const stdout: string[] = []
    const stderr: string[] = []
    vi.stubEnv('SHOPIFY_UNIT_TEST', 'false')
    vi.resetModules()
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout.push(String(chunk))
      return true
    })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk))
      return true
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)

    try {
      const {default: StoreAuth} = await import('./auth.js')
      const {waitForStoreAuthCode} = await import('../../services/store/auth/callback.js')
      const {exchangeStoreAuthCodeForToken} = await import('../../services/store/auth/token-client.js')
      const {resolveExistingStoreAuthScopes} = await import('../../services/store/auth/existing-scopes.js')
      const {storeAuthJsonOutputSchema} = await import('../../services/store/auth/types.js')

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
      const result = JSON.parse(stdout.join(''))
      expect(storeAuthJsonOutputSchema.validate(result)).toEqual({
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: expect.any(String),
        hasRefreshToken: false,
        associatedUser: {id: 42, email: 'merchant@example.com'},
      })
      expect(stderr.join('')).toContain('Shopify CLI will open the app authorization page in your browser.')
      expect(openURLMock).toHaveBeenCalledWith(
        expect.stringContaining('https://shop.myshopify.com/admin/oauth/authorize?'),
      )
      if (!opened) {
        expect(stderr.join('')).toContain('Browser did not open automatically. Open this URL manually:')
        expect(stderr.join('')).toContain(openURLMock.mock.calls[0]![0])
      }
    } finally {
      warnSpy.mockRestore()
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
