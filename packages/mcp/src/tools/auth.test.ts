import {handleAuthLogin} from './auth.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import type {SessionManager} from '../session-manager.js'

function createMockSessionManager(): SessionManager {
  return {
    getSession: vi.fn(),
    startAuth: vi.fn(),
    requireSession: vi.fn(),
    clearSession: vi.fn(),
  } as unknown as SessionManager
}

describe('handleAuthLogin', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
    delete process.env.SHOPIFY_FLAG_STORE
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns error when no store specified', async () => {
    const sm = createMockSessionManager()
    const result = await handleAuthLogin(sm, undefined)

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('No store specified')
  })

  test('uses SHOPIFY_FLAG_STORE env when no store param', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'env-store.myshopify.com'
    const sm = createMockSessionManager()
    ;(sm.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({token: 'abc', storeFqdn: 'env-store.myshopify.com'})

    const result = await handleAuthLogin(sm, undefined)

    expect(result.isError).toBeUndefined()
    expect(result.content[0]!.text).toContain('Already authenticated')
    expect(sm.getSession).toHaveBeenCalledWith('env-store.myshopify.com')
  })

  test('returns already authenticated when session exists', async () => {
    const sm = createMockSessionManager()
    ;(sm.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({token: 'abc', storeFqdn: 'test.myshopify.com'})

    const result = await handleAuthLogin(sm, 'test.myshopify.com')

    expect(result.isError).toBeUndefined()
    expect(result.content[0]!.text).toContain('Already authenticated with store test.myshopify.com')
  })

  test('returns verification URL on new auth', async () => {
    const sm = createMockSessionManager()
    ;(sm.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(sm.startAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      deviceCode: 'dev-123',
      userCode: 'USR-123',
      verificationUriComplete: 'https://accounts.shopify.com/activate?user_code=USR-123',
      interval: 5,
    })

    const result = await handleAuthLogin(sm, 'test.myshopify.com')

    expect(result.isError).toBeUndefined()
    expect(result.content[0]!.text).toContain('https://accounts.shopify.com/activate?user_code=USR-123')
    expect(result.content[0]!.text).toContain('USR-123')
    expect(result.content[0]!.text).toContain('After approving')
  })

  test('returns error on auth failure', async () => {
    const sm = createMockSessionManager()
    ;(sm.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(sm.startAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network timeout'))

    const result = await handleAuthLogin(sm, 'test.myshopify.com')

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('Network timeout')
  })

  test('sanitizes tokens and paths in error messages', async () => {
    const sm = createMockSessionManager()
    ;(sm.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(sm.startAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Failed with Bearer abc123token at /Users/dev/secret/path'),
    )

    const result = await handleAuthLogin(sm, 'test.myshopify.com')

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('Bearer [REDACTED]')
    expect(result.content[0]!.text).toContain('[PATH]')
    expect(result.content[0]!.text).not.toContain('abc123token')
    expect(result.content[0]!.text).not.toContain('/Users/dev')
  })
})
