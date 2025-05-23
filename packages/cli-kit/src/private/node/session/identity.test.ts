import {clientId, applicationId} from './identity.js'
import {Environment} from '../context/service.js'
import {BugError} from '../../../public/node/error.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../context/service.js')

const mockServiceEnvironment = vi.mocked(await import('../context/service.js')).serviceEnvironment

describe('identity', () => {
  describe('clientId', () => {
    test.each([
      {
        environment: Environment.Local,
        expected: 'e5380e02-312a-7408-5718-e07017e9cf52',
        description: 'local environment',
      },
      {
        environment: Environment.Production,
        expected: 'fbdb2649-e327-4907-8f67-908d24cfd7e3',
        description: 'production environment',
      },
      {
        environment: Environment.Spin,
        expected: 'e5380e02-312a-7408-5718-e07017e9cf52',
        description: 'spin environment (default)',
      },
    ])('returns correct client ID for $description', ({environment, expected}) => {
      // Given
      mockServiceEnvironment.mockReturnValue(environment)

      // When
      const result = clientId()

      // Then
      expect(result).toBe(expected)
    })
  })

  describe('applicationId', () => {
    test.each([
      // Admin API
      {
        api: 'admin' as const,
        environment: Environment.Local,
        expected: 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52',
        description: 'admin API in local environment',
      },
      {
        api: 'admin' as const,
        environment: Environment.Production,
        expected: '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c',
        description: 'admin API in production environment',
      },
      {
        api: 'admin' as const,
        environment: Environment.Spin,
        expected: 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52',
        description: 'admin API in spin environment',
      },
      // Partners API
      {
        api: 'partners' as const,
        environment: Environment.Local,
        expected: 'df89d73339ac3c6c5f0a98d9ca93260763e384d51d6038da129889c308973978',
        description: 'partners API in local environment',
      },
      {
        api: 'partners' as const,
        environment: Environment.Production,
        expected: '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6',
        description: 'partners API in production environment',
      },
      {
        api: 'partners' as const,
        environment: Environment.Spin,
        expected: 'df89d73339ac3c6c5f0a98d9ca93260763e384d51d6038da129889c308973978',
        description: 'partners API in spin environment',
      },
      // Storefront-renderer API
      {
        api: 'storefront-renderer' as const,
        environment: Environment.Local,
        expected: '46f603de-894f-488d-9471-5b721280ff49',
        description: 'storefront-renderer API in local environment',
      },
      {
        api: 'storefront-renderer' as const,
        environment: Environment.Production,
        expected: 'ee139b3d-5861-4d45-b387-1bc3ada7811c',
        description: 'storefront-renderer API in production environment',
      },
      {
        api: 'storefront-renderer' as const,
        environment: Environment.Spin,
        expected: '46f603de-894f-488d-9471-5b721280ff49',
        description: 'storefront-renderer API in spin environment',
      },
      // Business-platform API
      {
        api: 'business-platform' as const,
        environment: Environment.Local,
        expected: 'ace6dc89-b526-456d-a942-4b8ef6acda4b',
        description: 'business-platform API in local environment',
      },
      {
        api: 'business-platform' as const,
        environment: Environment.Production,
        expected: '32ff8ee5-82b8-4d93-9f8a-c6997cefb7dc',
        description: 'business-platform API in production environment',
      },
      {
        api: 'business-platform' as const,
        environment: Environment.Spin,
        expected: 'ace6dc89-b526-456d-a942-4b8ef6acda4b',
        description: 'business-platform API in spin environment',
      },
      // App-management API
      {
        api: 'app-management' as const,
        environment: Environment.Production,
        expected: '7ee65a63608843c577db8b23c4d7316ea0a01bd2f7594f8a9c06ea668c1b775c',
        description: 'app-management API in production environment',
      },
      {
        api: 'app-management' as const,
        environment: Environment.Local,
        expected: 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52',
        description: 'app-management API in local environment',
      },
      {
        api: 'app-management' as const,
        environment: Environment.Spin,
        expected: 'e92482cebb9bfb9fb5a0199cc770fde3de6c8d16b798ee73e36c9d815e070e52',
        description: 'app-management API in spin environment',
      },
    ])('returns correct application ID for $description', ({api, environment, expected}) => {
      // Given
      mockServiceEnvironment.mockReturnValue(environment)

      // When
      const result = applicationId(api)

      // Then
      expect(result).toBe(expected)
    })

    test('throws BugError for unknown API type', () => {
      // Given
      const unknownAPI = 'unknown-api' as any

      // When/Then
      expect(() => applicationId(unknownAPI)).toThrow(BugError)
      expect(() => applicationId(unknownAPI)).toThrow('Application id for API of type: unknown-api')
    })
  })
})
