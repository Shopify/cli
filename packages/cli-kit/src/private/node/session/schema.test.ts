import {SessionSchema, validateCachedIdentityTokenStructure, type IdentityToken} from './schema.js'
import {describe, test, expect} from 'vitest'

describe('schema', () => {
  describe('SessionSchema', () => {
    test('validates a valid session object', () => {
      // Given
      const validSession = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'identity-access-token',
            refreshToken: 'identity-refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products', 'write_orders'],
            userId: 'user-123',
          },
          applications: {
            'admin-app-id': {
              accessToken: 'admin-access-token',
              expiresAt: new Date('2024-12-31T23:59:59Z'),
              scopes: ['read_products'],
            },
            'partners-app-id': {
              accessToken: 'partners-access-token',
              expiresAt: new Date('2024-12-31T23:59:59Z'),
              scopes: ['app_management'],
            },
          },
        },
      }

      // When
      const result = SessionSchema.safeParse(validSession)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validSession)
      }
    })

    test('validates multiple domains in session', () => {
      // Given
      const sessionWithMultipleDomains = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'prod-identity-token',
            refreshToken: 'prod-refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products'],
            userId: 'user-123',
          },
          applications: {},
        },
        'identity.spin.com': {
          identity: {
            accessToken: 'spin-identity-token',
            refreshToken: 'spin-refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products'],
            userId: 'user-456',
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithMultipleDomains)

      // Then
      expect(result.success).toBe(true)
    })

    test('accepts string dates and converts them to Date objects', () => {
      // Given
      const sessionWithStringDates = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: '2024-12-31T23:59:59Z',
            scopes: ['read_products'],
            userId: 'user-123',
          },
          applications: {
            'app-id': {
              accessToken: 'app-access-token',
              expiresAt: '2024-12-31T23:59:59Z',
              scopes: ['read_products'],
            },
          },
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithStringDates)

      // Then
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data['accounts.shopify.com']!.identity.expiresAt).toBeInstanceOf(Date)
        expect(result.data['accounts.shopify.com']!.applications['app-id']!.expiresAt).toBeInstanceOf(Date)
      }
    })

    test('rejects session with missing identity', () => {
      // Given
      const sessionMissingIdentity = {
        'accounts.shopify.com': {
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionMissingIdentity)

      // Then
      expect(result.success).toBe(false)
    })

    test('rejects session with missing applications', () => {
      // Given
      const sessionMissingApplications = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products'],
            userId: 'user-123',
          },
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionMissingApplications)

      // Then
      expect(result.success).toBe(false)
    })

    test('rejects identity token with missing required fields', () => {
      // Given
      const sessionWithIncompleteIdentity = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            // Missing refreshToken, expiresAt, scopes, userId
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithIncompleteIdentity)

      // Then
      expect(result.success).toBe(false)
    })

    test('rejects application token with missing required fields', () => {
      // Given
      const sessionWithIncompleteAppToken = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'identity-access-token',
            refreshToken: 'identity-refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products'],
            userId: 'user-123',
          },
          applications: {
            'app-id': {
              accessToken: 'app-access-token',
              // Missing expiresAt, scopes
            },
          },
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithIncompleteAppToken)

      // Then
      expect(result.success).toBe(false)
    })

    test('rejects invalid date formats', () => {
      // Given
      const sessionWithInvalidDate = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: 'invalid-date-string',
            scopes: ['read_products'],
            userId: 'user-123',
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithInvalidDate)

      // Then
      expect(result.success).toBe(false)
    })

    test('rejects scopes that are not arrays of strings', () => {
      // Given
      const sessionWithInvalidScopes = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: 'not-an-array',
            userId: 'user-123',
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithInvalidScopes)

      // Then
      expect(result.success).toBe(false)
    })

    test('handles empty applications object', () => {
      // Given
      const sessionWithEmptyApplications = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: ['read_products'],
            userId: 'user-123',
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithEmptyApplications)

      // Then
      expect(result.success).toBe(true)
    })

    test('handles empty scopes arrays', () => {
      // Given
      const sessionWithEmptyScopes = {
        'accounts.shopify.com': {
          identity: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date('2024-12-31T23:59:59Z'),
            scopes: [],
            userId: 'user-123',
          },
          applications: {},
        },
      }

      // When
      const result = SessionSchema.safeParse(sessionWithEmptyScopes)

      // Then
      expect(result.success).toBe(true)
    })
  })

  describe('validateCachedIdentityTokenStructure', () => {
    test('returns true for valid identity token', () => {
      // Given
      const validIdentityToken: IdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        scopes: ['read_products', 'write_orders'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(validIdentityToken)

      // Then
      expect(result).toBe(true)
    })

    test('returns true for valid identity token with string date', () => {
      // Given
      const identityTokenWithStringDate = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2024-12-31T23:59:59Z',
        scopes: ['read_products'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(identityTokenWithStringDate)

      // Then
      expect(result).toBe(true)
    })

    test('returns false for identity token missing accessToken', () => {
      // Given
      const invalidIdentityToken = {
        refreshToken: 'refresh-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        scopes: ['read_products'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token missing refreshToken', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        scopes: ['read_products'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token missing expiresAt', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        scopes: ['read_products'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token missing scopes', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token missing userId', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        scopes: ['read_products'],
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token with invalid date', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 'invalid-date',
        scopes: ['read_products'],
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for identity token with invalid scopes type', () => {
      // Given
      const invalidIdentityToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        scopes: 'not-an-array',
        userId: 'user-123',
      }

      // When
      const result = validateCachedIdentityTokenStructure(invalidIdentityToken)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for null input', () => {
      // When
      const result = validateCachedIdentityTokenStructure(null)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for undefined input', () => {
      // When
      const result = validateCachedIdentityTokenStructure(undefined)

      // Then
      expect(result).toBe(false)
    })

    test('returns false for primitive input', () => {
      // When
      const result = validateCachedIdentityTokenStructure('not-an-object')

      // Then
      expect(result).toBe(false)
    })

    test('returns false for empty object', () => {
      // When
      const result = validateCachedIdentityTokenStructure({})

      // Then
      expect(result).toBe(false)
    })
  })
})
