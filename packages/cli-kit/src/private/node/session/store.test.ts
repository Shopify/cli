import {Sessions} from './schema.js'
import {
  store,
  storeSession,
  fetch,
  remove,
  removeSession,
  getSessionAlias,
  setSessionAlias,
  findSessionByAlias,
} from './store.js'
import {
  getCurrentSessionId,
  getSessionStoreLockPath,
  getSessions,
  removeSessions,
  setSessions,
  removeCurrentSessionId,
} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import lockfile from 'proper-lockfile'

import {describe, expect, vi, test, beforeEach} from 'vitest'

vi.mock('../conf-store.js')
vi.mock('../../../public/node/context/fqdn.js')
vi.mock('proper-lockfile')

const mockSessions: Sessions = {
  'identity.fqdn.com': {
    user1: {
      identity: {
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresAt: new Date(),
        scopes: ['scope1'],
        userId: 'user1',
        alias: 'Work Account',
      },
      applications: {},
    },
    user2: {
      identity: {
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresAt: new Date(),
        scopes: ['scope2'],
        userId: 'user2',
      },
      applications: {},
    },
  },
}

describe('session store', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('identity.fqdn.com')
    vi.mocked(getSessionStoreLockPath).mockReturnValue('/tmp/shopify-cli-kit-test')
    vi.mocked(lockfile.lock).mockResolvedValue(vi.fn())
  })

  describe('store', () => {
    test('stores sessions as JSON', async () => {
      // When
      await store(mockSessions)

      // Then
      expect(setSessions).toHaveBeenCalledWith(JSON.stringify(mockSessions))
    })
  })

  describe('storeSession', () => {
    test('updates one session while preserving the latest sessions for other accounts', async () => {
      // Given
      const otherFqdn = 'other.identity.com'
      const latestSessions: Sessions = {
        ...mockSessions,
        [otherFqdn]: mockSessions['identity.fqdn.com']!,
      }
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(latestSessions))
      const updatedSession = {
        ...mockSessions['identity.fqdn.com']!.user1!,
        identity: {...mockSessions['identity.fqdn.com']!.user1!.identity, accessToken: 'updated-token'},
      }

      // When
      await storeSession('identity.fqdn.com', 'user1', updatedSession)

      // Then
      const storedSessions = JSON.parse(vi.mocked(setSessions).mock.calls[0]![0]) as Sessions
      expect(storedSessions['identity.fqdn.com']!.user1!.identity.accessToken).toBe('updated-token')
      expect(storedSessions['identity.fqdn.com']!.user2).toEqual(
        JSON.parse(JSON.stringify(mockSessions['identity.fqdn.com']!.user2)),
      )
      expect(storedSessions[otherFqdn]).toEqual(JSON.parse(JSON.stringify(latestSessions[otherFqdn])))
    })
  })

  describe('removeSession', () => {
    test('removes only the matching session and preserves other accounts', async () => {
      // Given
      const otherFqdn = 'other.identity.com'
      vi.mocked(getSessions).mockReturnValue(
        JSON.stringify({...mockSessions, [otherFqdn]: mockSessions['identity.fqdn.com']}),
      )

      // When
      const removed = await removeSession('identity.fqdn.com', 'user1', mockSessions['identity.fqdn.com']!.user1)

      // Then
      expect(removed).toBe(true)
      const storedSessions = JSON.parse(vi.mocked(setSessions).mock.calls[0]![0]) as Sessions
      expect(storedSessions['identity.fqdn.com']!.user1).toBeUndefined()
      expect(storedSessions['identity.fqdn.com']!.user2).toEqual(
        JSON.parse(JSON.stringify(mockSessions['identity.fqdn.com']!.user2)),
      )
      expect(storedSessions[otherFqdn]).toEqual(JSON.parse(JSON.stringify(mockSessions['identity.fqdn.com'])))
    })

    test('clears the current session id when removing that session', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(getCurrentSessionId).mockReturnValue('user1')

      // When
      await removeSession('identity.fqdn.com', 'user1', mockSessions['identity.fqdn.com']!.user1)

      // Then
      expect(removeCurrentSessionId).toHaveBeenCalledOnce()
    })

    test('keeps a session that another process has already refreshed', async () => {
      // Given
      const refreshedSessions: Sessions = {
        ...mockSessions,
        'identity.fqdn.com': {
          ...mockSessions['identity.fqdn.com'],
          user1: {
            ...mockSessions['identity.fqdn.com']!.user1!,
            identity: {...mockSessions['identity.fqdn.com']!.user1!.identity, refreshToken: 'rotated-token'},
          },
        },
      }
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(refreshedSessions))

      // When
      const removed = await removeSession('identity.fqdn.com', 'user1', mockSessions['identity.fqdn.com']!.user1)

      // Then
      expect(removed).toBe(false)
      expect(setSessions).not.toHaveBeenCalled()
    })
  })

  describe('fetch', () => {
    test('returns undefined when no sessions exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(undefined)

      // When
      const result = await fetch()

      // Then
      expect(result).toBeUndefined()
    })

    test('returns parsed sessions when valid JSON exists', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await fetch()

      // Then
      expect(result).toEqual(mockSessions)
    })

    test('returns undefined and discards malformed JSON session content', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue('{not valid json')

      // When
      const result = await fetch()

      // Then
      expect(result).toBeUndefined()
      expect(removeSessions).toHaveBeenCalled()
      expect(removeCurrentSessionId).toHaveBeenCalled()
    })

    test('returns undefined and discards schema-invalid session content', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify({not: 'a valid sessions object'}))
      vi.mocked(removeSessions).mockClear()
      vi.mocked(removeCurrentSessionId).mockClear()

      // When
      const result = await fetch()

      // Then
      expect(result).toBeUndefined()
      expect(removeSessions).toHaveBeenCalled()
      expect(removeCurrentSessionId).toHaveBeenCalled()
    })

    test('rethrows non-SyntaxError parse failures without discarding sessions', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(removeSessions).mockClear()
      vi.mocked(removeCurrentSessionId).mockClear()
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
        throw new Error('unexpected parse failure')
      })

      // Then
      await expect(fetch()).rejects.toThrow('unexpected parse failure')
      expect(removeSessions).not.toHaveBeenCalled()
      expect(removeCurrentSessionId).not.toHaveBeenCalled()

      parseSpy.mockRestore()
    })
  })

  describe('remove', () => {
    test('removes sessions and current session ID', async () => {
      // When
      await remove()

      // Then
      expect(removeSessions).toHaveBeenCalled()
      expect(removeCurrentSessionId).toHaveBeenCalled()
    })
  })

  describe('getSessionAlias', () => {
    test('returns alias for existing user', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await getSessionAlias('user1')

      // Then
      expect(result).toBe('Work Account')
    })

    test('returns undefined for non-existent user', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await getSessionAlias('nonexistent')

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when no sessions exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(undefined)

      // When
      const result = await getSessionAlias('user1')

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when fqdn does not exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(identityFqdn).mockResolvedValue('different.fqdn.com')

      // When
      const result = await getSessionAlias('user1')

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('setSessionAlias', () => {
    test('updates alias for an existing user', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      await setSessionAlias('user1', 'New Alias')

      // Then
      const storedSessions = JSON.parse(vi.mocked(setSessions).mock.calls[0]![0])
      expect(storedSessions['identity.fqdn.com'].user1.identity.alias).toBe('New Alias')
    })

    test('does nothing when no sessions exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(undefined)

      // When
      await setSessionAlias('user1', 'New Alias')

      // Then
      expect(setSessions).not.toHaveBeenCalled()
    })

    test('does nothing when user does not exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      await setSessionAlias('nonexistent', 'New Alias')

      // Then
      expect(setSessions).not.toHaveBeenCalled()
    })

    test('does nothing when fqdn does not match', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(identityFqdn).mockResolvedValue('different.fqdn.com')

      // When
      await setSessionAlias('user1', 'New Alias')

      // Then
      expect(setSessions).not.toHaveBeenCalled()
    })
  })

  describe('findSessionByAlias', () => {
    test('returns userId for existing alias', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await findSessionByAlias('Work Account')

      // Then
      expect(result).toBe('user1')
    })

    test('returns undefined for non-existent alias', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await findSessionByAlias('Nonexistent Alias')

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when no sessions exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(undefined)

      // When
      const result = await findSessionByAlias('Work Account')

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when fqdn does not exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(identityFqdn).mockResolvedValue('different.fqdn.com')

      // When
      const result = await findSessionByAlias('Work Account')

      // Then
      expect(result).toBeUndefined()
    })

    test('returns userId when alias matches userId directly', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      const result = await findSessionByAlias('user1')

      // Then
      expect(result).toBe('user1')
    })

    test('returns first matching userId when multiple sessions have same alias', async () => {
      // Given
      const sessionsWithDuplicateAlias = {
        'identity.fqdn.com': {
          user1: {
            identity: {
              ...mockSessions['identity.fqdn.com']!.user1!.identity,
              alias: 'Duplicate Alias',
            },
            applications: mockSessions['identity.fqdn.com']!.user1!.applications,
          },
          user2: {
            identity: {
              ...mockSessions['identity.fqdn.com']!.user2!.identity,
              alias: 'Duplicate Alias',
            },
            applications: mockSessions['identity.fqdn.com']!.user2!.applications,
          },
        },
      }
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(sessionsWithDuplicateAlias))

      // When
      const result = await findSessionByAlias('Duplicate Alias')

      // Then
      expect(result).toMatch(/^user[12]$/)
    })
  })
})
