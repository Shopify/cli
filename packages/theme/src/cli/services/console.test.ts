import {ensureReplEnv} from './console.js'
import {
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
} from '../utilities/theme-environment/storefront-session.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('ensureReplEnv', () => {
  beforeEach(() => {
    vi.mocked(renderTextPrompt).mockResolvedValue('testPassword')
  })

  test('should prompt for password when storefront is password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv('test-store')

    // Then
    expect(renderTextPrompt).toHaveBeenCalledWith({message: 'Enter your theme password', password: true})
    expect(storePassword).toBe('testPassword')
  })

  test('should skip prompt for password when storefront is not password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store')

    // Then
    expect(renderTextPrompt).not.toHaveBeenCalled()
  })

  test('should skip prompt for password when correct storefront password is provided', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    await ensureReplEnv('test-store', 'password')

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
    await ensureReplEnv('test-store', 'asdf')

    // Then
    expect(renderTextPrompt).toHaveBeenCalledTimes(2)
  })
})
