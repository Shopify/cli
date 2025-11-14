import {ensureReplEnv, initializeRepl} from './console.js'
import {
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../utilities/theme-environment/storefront-password-prompt.js')
vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/repl/repl-theme-manager.js', () => {
  const REPLThemeManager = vi.fn()
  REPLThemeManager.prototype.findOrCreate = () => ({
    id: 1,
    name: 'theme',
    role: 'development',
    createdAtRuntime: true,
    processing: true,
  })
  return {REPLThemeManager}
})

describe('initializeRepl', () => {
  const mockAdminSession = {token: 'mock-token', storeFqdn: 'test-store.myshopify.com'}

  test('throws error when an Admin API token is used', async () => {
    // When
    const result = initializeRepl(mockAdminSession, '1', '/', 'shpat_hello', undefined)

    // Then
    await expect(result).rejects.toThrow(
      new AbortError(
        'Unable to use Admin API tokens with the console command',
        `To use this command with the --password flag you must:

1. Install the Theme Access app on your shop
2. Generate a new password

Alternatively, you can authenticate normally by not passing the --password flag.

Learn more: https://shopify.dev/docs/storefronts/themes/tools/theme-access`,
      ),
    )
  })
})

describe('ensureReplEnv', () => {
  beforeEach(() => {
    vi.mocked(ensureValidPassword).mockResolvedValue('testPassword')
  })

  const adminSession: AdminSession = {storeFqdn: 'test-store.myshopify.com', token: 'token'}

  test('should prompt for password when storefront is password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv(adminSession)

    // Then
    expect(ensureValidPassword).toHaveBeenCalled()
    expect(storePassword).toBe('testPassword')
  })

  test('should skip prompt and return undefined for password when storefront is not password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv(adminSession)

    // Then
    expect(ensureValidPassword).not.toHaveBeenCalled()
    expect(storePassword).toBeUndefined()
  })

  test('should return undefined for storePassword when password is provided but storefront is not password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv(adminSession, 'testPassword')

    // Then
    expect(ensureValidPassword).not.toHaveBeenCalled()
    expect(storePassword).toBeUndefined()
  })
})
