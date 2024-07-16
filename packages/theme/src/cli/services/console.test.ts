import {ensureReplEnv} from './console.js'
import {
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/prompts.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/prompts.js')

describe('ensureReplEnv', () => {
  beforeEach(() => {
    vi.mocked(ensureValidPassword).mockResolvedValue('testPassword')
  })

  test('should prompt for password when storefront is password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv('test-store')

    // Then
    expect(ensureValidPassword).toHaveBeenCalled()
    expect(storePassword).toBe('testPassword')
  })

  test('should skip prompt for password when storefront is not password protected', async () => {
    // Given
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
    vi.mocked(isStorefrontPasswordCorrect).mockResolvedValue(true)

    // When
    const {storePassword} = await ensureReplEnv('test-store')

    // Then
    expect(ensureValidPassword).not.toHaveBeenCalled()
    expect(storePassword).toBeUndefined()
  })
})
