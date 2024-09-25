import {ensureValidPassword} from './storefront-password-prompt.js'
import {isStorefrontPasswordProtected, isStorefrontPasswordCorrect} from './storefront-session.js'
import {
  getStorefrontPassword,
  getThemeStore,
  removeStorefrontPassword,
  setStorefrontPassword,
} from '../../services/local-storage.js'
import {ensureThemeStore} from '../theme-store.js'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {describe, beforeEach, vi, test, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../theme-environment/storefront-session.js')
vi.mock('../../services/local-storage.js')
vi.mock('../theme-store.js')
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

  test('should read the password from local storage when no password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)
    vi.mocked(getStorefrontPassword).mockReturnValue('testPassword')

    // When
    await ensureValidPassword(undefined, 'test-store')

    // Then
    expect(isStorefrontPasswordCorrect).toHaveBeenCalledWith('testPassword', 'test-store')
  })

  test('should set the password in local storage when a password is validated', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureValidPassword('testPassword', 'test-store')

    // Then
    expect(setStorefrontPassword).toHaveBeenCalledWith('testPassword')
  })

  test('should prompt user for password if local storage password is no longer correct', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValueOnce(false).mockResolvedValue(true)
    vi.mocked(getStorefrontPassword).mockReturnValue('incorrectPassword')
    vi.mocked(renderTextPrompt).mockResolvedValue('correctPassword')

    // When
    await ensureValidPassword(undefined, 'test-store')

    // Then
    expect(renderTextPrompt).toHaveBeenCalled()
    expect(setStorefrontPassword).toHaveBeenCalledWith('correctPassword')
    expect(removeStorefrontPassword).toHaveBeenCalled()
  })

  test('should call ensureThemeStore with the store URL', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)
    vi.mocked(getThemeStore).mockReturnValue(undefined as any)

    // When
    await ensureValidPassword('testPassword', 'test-store')

    // Then
    expect(ensureThemeStore).toHaveBeenCalledWith({store: 'test-store'})
  })
})
