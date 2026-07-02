import {sessionIdFromAuthAlias} from './auth-alias.js'
import {findSessionIdByAlias} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')

describe('sessionIdFromAuthAlias', () => {
  beforeEach(() => {
    vi.mocked(findSessionIdByAlias).mockResolvedValue(undefined)
  })

  test('returns undefined when no alias is provided', async () => {
    const got = await sessionIdFromAuthAlias(undefined)

    expect(got).toBeUndefined()
    expect(findSessionIdByAlias).not.toHaveBeenCalled()
  })

  test('returns the session ID for the alias', async () => {
    vi.mocked(findSessionIdByAlias).mockResolvedValue('session-id-for-work')

    const got = await sessionIdFromAuthAlias('work')

    expect(got).toBe('session-id-for-work')
    expect(findSessionIdByAlias).toHaveBeenCalledWith('work')
  })

  test('throws with login guidance when alias is missing', async () => {
    await expect(sessionIdFromAuthAlias('missing')).rejects.toThrow('No authenticated account found for alias')
  })
})
