import {ApplicationToken, Sessions} from './schema.js'
import {store, fetch, remove, getSessionAlias, updateSessionAlias, findSessionByAlias} from './store.js'
import {getSessions, removeSessions, setSessions, removeCurrentSessionId} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'

vi.mock('../conf-store.js')
vi.mock('../../../public/node/context/fqdn.js')

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
        alias: 'user2',
      },
      applications: {},
    },
  },
}

describe('session store', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('identity.fqdn.com')
  })

  describe('store', () => {
    test('stores sessions as JSON', async () => {
      // When
      await store(mockSessions)

      // Then
      expect(setSessions).toHaveBeenCalledWith(JSON.stringify(mockSessions))
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

  describe('updateSessionAlias', () => {
    test('updates alias for existing user', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      const expectedSessions = structuredClone(mockSessions)
      expectedSessions['identity.fqdn.com']!.user1!.identity.alias = 'New Alias'

      // When
      await updateSessionAlias('user1', 'New Alias')

      // Then
      expect(setSessions).toHaveBeenCalledWith(JSON.stringify(expectedSessions))
    })

    test('does nothing for non-existent user', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))

      // When
      await updateSessionAlias('nonexistent', 'New Alias')

      // Then
      expect(setSessions).not.toHaveBeenCalled()
    })

    test('does nothing when no sessions exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(undefined)

      // When
      await updateSessionAlias('user1', 'New Alias')

      // Then
      expect(setSessions).not.toHaveBeenCalled()
    })

    test('does nothing when fqdn does not exist', async () => {
      // Given
      vi.mocked(getSessions).mockReturnValue(JSON.stringify(mockSessions))
      vi.mocked(identityFqdn).mockResolvedValue('different.fqdn.com')

      // When
      await updateSessionAlias('user1', 'New Alias')

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

    test('returns first matching userId when multiple sessions have same alias', async () => {
      // Given
      const sessionsWithDuplicateAlias = {
        'identity.fqdn.com': {
          user1: {
            identity: {
              ...mockSessions['identity.fqdn.com'].user1.identity,
              alias: 'Duplicate Alias',
            },
            applications: mockSessions['identity.fqdn.com'].user1.applications,
          },
          user2: {
            identity: {
              ...mockSessions['identity.fqdn.com'].user2.identity,
              alias: 'Duplicate Alias',
            },
            applications: mockSessions['identity.fqdn.com'].user2.applications,
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

function testSession(): Sessions {
  const testToken: ApplicationToken = {
    accessToken: 'access',
    expiresAt: new Date(),
    scopes: [],
  }
  return {
    'accounts.shopify.com': {
      '1234-5678': {
        identity: {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
          expiresAt: new Date(),
          scopes: ['foo'],
          userId: '1234-5678',
          alias: '1234-5678',
        },
        applications: {
          adminApi: testToken,
          partnersApi: testToken,
          storefrontRendererApi: testToken,
        },
      },
    },
  }
}
