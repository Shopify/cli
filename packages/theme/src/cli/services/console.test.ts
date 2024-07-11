import {ensureReplEnv} from './console.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {promptPassword} from '../utilities/theme-environment/theme-password.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../utilities/theme-environment/storefront-session.js')
vi.mock('../utilities/theme-environment/theme-password.js')

describe('ensureReplEnv', () => {
  test('should prompt for password when password is not provided', async () => {
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    const store = 'test-store'
    await ensureReplEnv(store)
    expect(promptPassword).toHaveBeenCalled()
  })

  test('should skip prompt for password when password is not provided', async () => {
    vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(true)
    const store = 'test-store'
    await ensureReplEnv(store)
    expect(promptPassword).toHaveBeenCalled()
  })
})
