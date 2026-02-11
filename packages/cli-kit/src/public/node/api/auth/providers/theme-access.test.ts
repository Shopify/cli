import {ThemeAccessProvider} from './theme-access.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../../../private/node/api/rest.js', () => ({
  isThemeAccessSession: vi.fn((session: {token: string}) => session.token.startsWith('shptka_')),
}))
vi.mock('../../../../../private/node/session.js', () => ({
  setLastSeenAuthMethod: vi.fn(),
  setLastSeenUserIdAfterAuth: vi.fn(),
}))
vi.mock('../../../crypto.js', () => ({
  nonRandomUUID: vi.fn((token: string) => `uuid-${token}`),
}))

describe('ThemeAccessProvider', () => {
  test('returns password for admin audience', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('admin', {password: 'shptka_test-password'})
    expect(result).toBe('shptka_test-password')
  })

  test('returns password for storefront-renderer audience', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('storefront-renderer', {password: 'shptka_test-password'})
    expect(result).toBe('shptka_test-password')
  })

  test('returns null for partners audience', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('partners', {password: 'shptka_test-password'})
    expect(result).toBeNull()
  })

  test('returns null for business-platform audience', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('business-platform', {password: 'shptka_test-password'})
    expect(result).toBeNull()
  })

  test('returns null for app-management audience', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('app-management', {password: 'shptka_test-password'})
    expect(result).toBeNull()
  })

  test('returns null when no password in context', async () => {
    const provider = new ThemeAccessProvider()
    const result = await provider.getToken('admin')
    expect(result).toBeNull()
  })
})
