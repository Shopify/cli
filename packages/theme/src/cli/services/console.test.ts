import {ensureReplEnv} from './console.js'
import {
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
  promptPassword,
} from '../utilities/theme-environment/storefront-session.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../utilities/theme-environment/storefront-session.js')

describe('ensureReplEnv', () => {
  test('should prompt for password when storefront is password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store')

    // Then
    expect(promptPassword).toHaveBeenCalled()
  })

  test('should skip prompt for password when storefront is not password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store')

    // Then
    expect(promptPassword).not.toHaveBeenCalled()
  })

  test('should skip prompt for password when correct storefront password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store', 'password')

    // Then
    expect(promptPassword).not.toHaveBeenCalled()
  })

  test('should prompt for correct password when incorrect password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store', 'asdf')

    // Then
    expect(promptPassword).toHaveBeenCalledTimes(2)
  })
})
