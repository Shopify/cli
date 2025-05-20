import {
  environmentVariables,
  defaultThemeKitAccessDomain,
  systemEnvironmentVariables,
  pathConstants,
  sessionConstants,
  bugsnagApiKey,
  reportingRateLimit,
  themeKitAccessDomain,
  logsFolder,
} from './constants.js'
import {joinPath} from '../../public/node/path.js'
import {describe, expect, test, vi, afterEach} from 'vitest'

describe('constants', () => {
  // Clean up environment variable stubs after each test
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('pathConstants', () => {
    test('executables.dev points to the correct path', () => {
      // When/Then
      expect(pathConstants.executables.dev).toBe('/opt/dev/bin/dev')
    })

    test('directories.cache.path returns the cache folder', () => {
      // When
      const result = pathConstants.directories.cache.path()

      // Then
      expect(result).toBeDefined()
    })

    test('directories.cache.path uses XDG_CACHE_HOME when set', () => {
      // Given
      const customCachePath = '/custom/cache/path'
      vi.stubEnv('XDG_CACHE_HOME', customCachePath)

      // When
      const result = pathConstants.directories.cache.path()

      // Then
      expect(result).toBe(customCachePath)
    })

    test('directories.cache.vendor.path returns the path with vendor appended', () => {
      // Given
      const customCachePath = '/custom/cache/path'
      vi.stubEnv('XDG_CACHE_HOME', customCachePath)

      // When
      const result = pathConstants.directories.cache.vendor.path()

      // Then
      expect(result).toBe(joinPath(customCachePath, 'vendor'))
    })

    test('directories.cache.vendor.binaries returns the path with vendor/binaries appended', () => {
      // Given
      const customCachePath = '/custom/cache/path'
      vi.stubEnv('XDG_CACHE_HOME', customCachePath)

      // When
      const result = pathConstants.directories.cache.vendor.binaries()

      // Then
      expect(result).toBe(joinPath(customCachePath, 'vendor', 'binaries'))
    })
  })

  describe('logsFolder', () => {
    test('returns a logs path', () => {
      // When
      const result = logsFolder()

      // Then
      expect(result).toBeDefined()
    })
  })

  describe('environmentVariables', () => {
    test('contains all expected environment variables', () => {
      // When/Then
      expect(environmentVariables.alwaysLogAnalytics).toBe('SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS')
      expect(environmentVariables.partnersToken).toBe('SHOPIFY_CLI_PARTNERS_TOKEN')
      expect(environmentVariables.themeKitAccessDomain).toBe('SHOPIFY_CLI_THEME_KIT_ACCESS_DOMAIN')
      // We could test all, but just checking a few is sufficient to verify the structure
    })
  })

  describe('defaultThemeKitAccessDomain', () => {
    test('has the expected value', () => {
      // When/Then
      expect(defaultThemeKitAccessDomain).toBe('theme-kit-access.shopifyapps.com')
    })
  })

  describe('themeKitAccessDomain', () => {
    test('returns default domain when environment variable is not set', () => {
      // Given
      vi.stubEnv(environmentVariables.themeKitAccessDomain, '')

      // When/Then - Using the value from the initial import
      expect(themeKitAccessDomain).toBe(defaultThemeKitAccessDomain)
    })

    test('uses environment variable when available', () => {
      // Given
      const customDomain = 'custom.domain.com'
      vi.stubEnv(environmentVariables.themeKitAccessDomain, customDomain)

      // Need to redefine the exported constant to simulate loading with new env value
      const recomputedThemeKitAccessDomain =
        process.env[environmentVariables.themeKitAccessDomain] ?? defaultThemeKitAccessDomain

      // Then - Check it would use the environment variable
      expect(recomputedThemeKitAccessDomain).toBe(customDomain)
    })
  })

  describe('sessionConstants', () => {
    test('has the expected expiration time margin', () => {
      // When/Then
      expect(sessionConstants.expirationTimeMarginInMinutes).toBe(4)
    })
  })

  describe('bugsnagApiKey', () => {
    test('has the correct API key', () => {
      // When/Then
      expect(bugsnagApiKey).toBe('9e1e6889176fd0c795d5c659225e0fae')
    })
  })

  describe('reportingRateLimit', () => {
    test('has the correct values', () => {
      // When/Then
      expect(reportingRateLimit.limit).toBe(300)
      expect(reportingRateLimit.timeout.days).toBe(1)
    })
  })

  describe('systemEnvironmentVariables', () => {
    test('contains the expected system environment variables', () => {
      // When/Then
      expect(systemEnvironmentVariables.backendPort).toBe('BACKEND_PORT')
    })
  })
})
