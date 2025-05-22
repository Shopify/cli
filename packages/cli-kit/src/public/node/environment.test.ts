import {
  getEnvironmentVariables,
  getPartnersToken,
  usePartnersToken,
  getOrganization,
  getBackendPort,
  getIdentityTokenInformation,
  jsonOutputEnabled,
  blockPartnersAccess,
  skipNetworkLevelRetry,
  maxRequestTimeForNetworkCallsMs,
} from './environment.js'
import {nonRandomUUID} from './crypto.js'
import {environmentVariables, systemEnvironmentVariables} from '../../private/node/constants.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('./crypto.js', () => ({
  nonRandomUUID: vi.fn(),
}))

describe('environment', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getEnvironmentVariables', () => {
    test('returns process.env', () => {
      // Given
      vi.stubEnv('TEST_VAR', 'test-value')

      // When
      const result = getEnvironmentVariables()

      // Then
      expect(result).toHaveProperty('TEST_VAR', 'test-value')
    })
  })

  describe('getPartnersToken', () => {
    test('returns the partners token when defined', () => {
      // Given
      const token = 'partners-token-value'
      vi.stubEnv(environmentVariables.partnersToken, token)

      // When
      const result = getPartnersToken()

      // Then
      expect(result).toBe(token)
    })

    test('returns undefined when token is not defined', () => {
      // Given - implied by setup

      // When
      const result = getPartnersToken()

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('usePartnersToken', () => {
    test('returns true when partners token is defined', () => {
      // Given
      vi.stubEnv(environmentVariables.partnersToken, 'some-token')

      // When
      const result = usePartnersToken()

      // Then
      expect(result).toBe(true)
    })

    test('returns false when partners token is undefined', () => {
      // Given - implied by setup

      // When
      const result = usePartnersToken()

      // Then
      expect(result).toBe(false)
    })
  })

  describe('getOrganization', () => {
    test('returns the organization ID when defined', () => {
      // Given
      const orgId = '12345'
      vi.stubEnv(environmentVariables.organization, orgId)

      // When
      const result = getOrganization()

      // Then
      expect(result).toBe(orgId)
    })

    test('returns undefined when organization ID is not defined', () => {
      // Given - implied by setup

      // When
      const result = getOrganization()

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('getBackendPort', () => {
    test('returns the backend port number when defined', () => {
      // Given
      vi.stubEnv(systemEnvironmentVariables.backendPort, '3000')

      // When
      const result = getBackendPort()

      // Then
      expect(result).toBe(3000)
    })

    test('returns undefined when backend port is not defined', () => {
      // Given - implied by setup

      // When
      const result = getBackendPort()

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when backend port is not a number', () => {
      // Given
      vi.stubEnv(systemEnvironmentVariables.backendPort, 'not-a-number')

      // When
      const result = getBackendPort()

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('getIdentityTokenInformation', () => {
    test('returns token information when tokens are defined', () => {
      // Given
      const identityToken = 'identity-token'
      const refreshToken = 'refresh-token'
      const userId = 'user-id'
      vi.stubEnv(environmentVariables.identityToken, identityToken)
      vi.stubEnv(environmentVariables.refreshToken, refreshToken)
      vi.mocked(nonRandomUUID).mockReturnValue(userId)

      // When
      const result = getIdentityTokenInformation()

      // Then
      expect(result).toEqual({
        accessToken: identityToken,
        refreshToken,
        userId,
      })
      expect(nonRandomUUID).toHaveBeenCalledWith(identityToken)
    })

    test('returns undefined when identity token is missing', () => {
      // Given
      vi.stubEnv(environmentVariables.refreshToken, 'refresh-token')

      // When
      const result = getIdentityTokenInformation()

      // Then
      expect(result).toBeUndefined()
    })

    test('returns undefined when refresh token is missing', () => {
      // Given
      vi.stubEnv(environmentVariables.identityToken, 'identity-token')

      // When
      const result = getIdentityTokenInformation()

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('jsonOutputEnabled', () => {
    test('returns true when JSON flag is set in environment', () => {
      // Given
      vi.stubEnv(environmentVariables.json, '1')

      // When
      const result = jsonOutputEnabled()

      // Then
      expect(result).toBe(true)
    })

    test('returns false when JSON flag is not set', () => {
      // Given - implied by setup

      // When
      const result = jsonOutputEnabled()

      // Then
      expect(result).toBe(false)
    })
  })

  describe('blockPartnersAccess', () => {
    test('returns true when never use partners API flag is set', () => {
      // Given
      vi.stubEnv(environmentVariables.neverUsePartnersApi, '1')

      // When
      const result = blockPartnersAccess()

      // Then
      expect(result).toBe(true)
    })

    test('returns false when never use partners API flag is not set', () => {
      // Given - implied by setup

      // When
      const result = blockPartnersAccess()

      // Then
      expect(result).toBe(false)
    })
  })

  describe('skipNetworkLevelRetry', () => {
    test('returns true when skip network level retry flag is set', () => {
      // Given
      vi.stubEnv(environmentVariables.skipNetworkLevelRetry, '1')

      // When
      const result = skipNetworkLevelRetry()

      // Then
      expect(result).toBe(true)
    })

    test('returns false when skip network level retry flag is not set', () => {
      // Given - implied by setup

      // When
      const result = skipNetworkLevelRetry()

      // Then
      expect(result).toBe(false)
    })
  })

  describe('maxRequestTimeForNetworkCallsMs', () => {
    test('returns specified value when set in environment', () => {
      // Given
      vi.stubEnv(environmentVariables.maxRequestTimeForNetworkCalls, '60000')

      // When
      const result = maxRequestTimeForNetworkCallsMs()

      // Then
      expect(result).toBe(60000)
    })

    test('returns default value (30 seconds) when not set in environment', () => {
      // Given - implied by setup

      // When
      const result = maxRequestTimeForNetworkCallsMs()

      // Then
      // 30 seconds
      expect(result).toBe(30000)
    })

    test('returns default value when environment value is not a number', () => {
      // Given
      vi.stubEnv(environmentVariables.maxRequestTimeForNetworkCalls, 'not-a-number')

      // When
      const result = maxRequestTimeForNetworkCallsMs()

      // Then
      // 30 seconds
      expect(result).toBe(30000)
    })
  })
})
