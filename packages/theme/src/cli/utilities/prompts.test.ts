import {isStorefrontPasswordProtected, isStorefrontPasswordCorrect} from './theme-environment/storefront-session.js'
import {ensureValidPassword} from './prompts.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {describe, beforeEach, vi, test, expect} from 'vitest'

vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../utilities/repl-theme-manager.js', () => {
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

describe('ensureValidPassword', () => {
  beforeEach(() => {
    vi.mocked(renderTextPrompt).mockResolvedValue('testPassword')
  })

  const adminSession: AdminSession = {storeFqdn: 'test-store.myshopify.com', token: 'token'}

  test('should skip prompt for password when correct storefront password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureValidPassword('correctPassword', 'test-store')

    // Then
    expect(renderTextPrompt).not.toHaveBeenCalled()
  })

  test('should prompt for correct password when incorrect password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)

    // When
    await ensureValidPassword('incorrectPassword', 'test-store')

    // Then
    expect(renderTextPrompt).toHaveBeenCalledTimes(2)
  })
})
