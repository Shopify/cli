import {SessionManager} from './session-manager.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi} from 'vitest'

const mockEnsureAuthenticatedAdmin = vi.fn()
const mockRequestDeviceCode = vi.fn()
const mockCompleteDeviceAuth = vi.fn()
const mockNormalizeStoreFqdn = vi.fn((store: string) => `${store}.myshopify.com`)

vi.mock('@shopify/cli-kit/node/session', () => ({
  ensureAuthenticatedAdmin: (...args: unknown[]) => mockEnsureAuthenticatedAdmin(...args),
}))

vi.mock('@shopify/cli-kit/node/error', () => {
  class MockAbortError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AbortError'
    }
  }
  return {AbortError: MockAbortError}
})

vi.mock('@shopify/cli-kit/node/mcp', () => ({
  requestDeviceCode: (...args: unknown[]) => mockRequestDeviceCode(...args),
  completeDeviceAuth: (...args: unknown[]) => mockCompleteDeviceAuth(...args),
}))

vi.mock('@shopify/cli-kit/node/context/fqdn', () => ({
  normalizeStoreFqdn: (store: string) => mockNormalizeStoreFqdn(store),
}))

describe('SessionManager', () => {
  describe('getSession', () => {
    test('returns existing session from ensureAuthenticatedAdmin', async () => {
      const sessionManager = new SessionManager()
      const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
      mockEnsureAuthenticatedAdmin.mockResolvedValue(session)

      const result = await sessionManager.getSession('test')
      expect(result).toEqual(session)
      expect(mockEnsureAuthenticatedAdmin).toHaveBeenCalledWith('test.myshopify.com', [], {noPrompt: true})
    })

    test('returns undefined when ensureAuthenticatedAdmin throws AbortError', async () => {
      const sessionManager = new SessionManager()
      mockEnsureAuthenticatedAdmin.mockRejectedValue(new AbortError('Unable to prompt'))

      const result = await sessionManager.getSession('test')
      expect(result).toBeUndefined()
    })

    test('rethrows non-AbortError errors', async () => {
      const sessionManager = new SessionManager()
      mockEnsureAuthenticatedAdmin.mockRejectedValue(new TypeError('Unexpected null'))

      await expect(sessionManager.getSession('test')).rejects.toThrow('Unexpected null')
    })

    test('caches session after first successful fetch', async () => {
      const sessionManager = new SessionManager()
      const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
      mockEnsureAuthenticatedAdmin.mockResolvedValueOnce(session)

      await sessionManager.getSession('test')
      const result = await sessionManager.getSession('test')
      expect(result).toEqual(session)
      expect(mockEnsureAuthenticatedAdmin).toHaveBeenCalledTimes(1)
    })
  })

  describe('startAuth', () => {
    test('returns device code response and starts background polling', async () => {
      const sessionManager = new SessionManager()
      const deviceCode = {
        deviceCode: 'dev-123',
        userCode: 'USR-123',
        verificationUri: 'https://accounts.shopify.com/activate',
        verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=USR-123',
        expiresIn: 600,
        interval: 5,
      }
      mockRequestDeviceCode.mockResolvedValue(deviceCode)

      const session = {token: 'new-token', storeFqdn: 'test.myshopify.com'}
      mockCompleteDeviceAuth.mockResolvedValue(session)

      const result = await sessionManager.startAuth('test')
      expect(result).toEqual(deviceCode)
      expect(mockRequestDeviceCode).toHaveBeenCalled()
      expect(mockCompleteDeviceAuth).toHaveBeenCalledWith('dev-123', 5, 'test.myshopify.com')
    })

    test('throws when startAuth called concurrently for same store', async () => {
      const sessionManager = new SessionManager()
      const deviceCode = {
        deviceCode: 'dev-123',
        userCode: 'USR-123',
        verificationUri: 'https://accounts.shopify.com/activate',
        verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=USR-123',
        expiresIn: 600,
        interval: 5,
      }
      mockRequestDeviceCode.mockResolvedValue(deviceCode)
      mockCompleteDeviceAuth.mockReturnValue(new Promise(() => {}))

      await sessionManager.startAuth('test')
      await expect(sessionManager.startAuth('test')).rejects.toThrow('Authentication already in progress')
    })

    test('cleans up pendingAuth on background auth failure', async () => {
      const sessionManager = new SessionManager()
      const deviceCode = {
        deviceCode: 'dev-fail',
        userCode: 'USR-FAIL',
        verificationUri: 'https://accounts.shopify.com/activate',
        verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=USR-FAIL',
        expiresIn: 600,
        interval: 5,
      }
      mockRequestDeviceCode.mockResolvedValue(deviceCode)
      mockCompleteDeviceAuth.mockRejectedValue(new Error('Access denied'))

      await sessionManager.startAuth('test')
      await vi.waitFor(() => Promise.resolve())

      mockEnsureAuthenticatedAdmin.mockRejectedValue(new AbortError('No session'))
      await expect(sessionManager.requireSession('test')).rejects.toThrow(
        'Not authenticated for store test.myshopify.com',
      )
    })
  })

  describe('requireSession', () => {
    test('returns cached session', async () => {
      const sessionManager = new SessionManager()
      const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
      mockEnsureAuthenticatedAdmin.mockResolvedValue(session)

      await sessionManager.getSession('test')
      const result = await sessionManager.requireSession('test')
      expect(result).toEqual(session)
    })

    test('waits for pending auth', async () => {
      const sessionManager = new SessionManager()
      const deviceCode = {
        deviceCode: 'dev-123',
        userCode: 'USR-123',
        verificationUri: 'https://accounts.shopify.com/activate',
        verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=USR-123',
        expiresIn: 600,
        interval: 5,
      }
      mockRequestDeviceCode.mockResolvedValue(deviceCode)

      const session = {token: 'new-token', storeFqdn: 'test.myshopify.com'}
      mockCompleteDeviceAuth.mockResolvedValue(session)

      await sessionManager.startAuth('test')
      const result = await sessionManager.requireSession('test')
      expect(result).toEqual(session)
    })

    test('throws friendly message when AbortError (no session)', async () => {
      const sessionManager = new SessionManager()
      mockEnsureAuthenticatedAdmin.mockRejectedValue(new AbortError('Unable to prompt'))

      await expect(sessionManager.requireSession('test')).rejects.toThrow(
        'Not authenticated for store test.myshopify.com',
      )
    })

    test('rethrows non-AbortError errors in requireSession', async () => {
      const sessionManager = new SessionManager()
      mockEnsureAuthenticatedAdmin.mockRejectedValue(new TypeError('Network failure'))

      await expect(sessionManager.requireSession('test')).rejects.toThrow('Network failure')
    })
  })

  describe('clearSession', () => {
    test('removes cached session so next call re-fetches', async () => {
      const sessionManager = new SessionManager()
      const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
      mockEnsureAuthenticatedAdmin.mockResolvedValue(session)

      await sessionManager.getSession('test')
      sessionManager.clearSession('test')

      const session2 = {token: 'xyz', storeFqdn: 'test.myshopify.com'}
      mockEnsureAuthenticatedAdmin.mockResolvedValue(session2)

      const result = await sessionManager.getSession('test')
      expect(result).toEqual(session2)
      expect(mockEnsureAuthenticatedAdmin).toHaveBeenCalledTimes(2)
    })
  })
})
