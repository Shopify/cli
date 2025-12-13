import {validateConfig} from './configValidation.ts'
import {describe, test, expect, vi} from 'vitest'
import type {GraphiQLConfig} from '@/types/config.ts'

describe('validateConfig', () => {
  const fallbackConfig: GraphiQLConfig = {
    baseUrl: 'http://localhost:3457',
    apiVersion: '2024-10',
    apiVersions: ['2024-01', '2024-04', '2024-07', '2024-10'],
    appName: 'Test App',
    appUrl: 'http://localhost:3000',
    storeFqdn: 'test-store.myshopify.com',
  }

  describe('URL validation', () => {
    test('accepts valid localhost URLs', () => {
      const config = {
        ...fallbackConfig,
        baseUrl: 'http://localhost:3457',
        appUrl: 'http://127.0.0.1:3000',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe('http://localhost:3457')
      expect(result.appUrl).toBe('http://127.0.0.1:3000')
    })

    test('accepts valid Shopify domain URLs', () => {
      const config = {
        ...fallbackConfig,
        baseUrl: 'https://my-store.myshopify.com',
        appUrl: 'https://test-app.myshopify.com',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe('https://my-store.myshopify.com')
      expect(result.appUrl).toBe('https://test-app.myshopify.com')
    })

    test('rejects javascript: protocol URLs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        baseUrl: 'javascript:alert("XSS")',
        appUrl: 'javascript:void(0)',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe(fallbackConfig.baseUrl)
      expect(result.appUrl).toBe(fallbackConfig.appUrl)
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Security] Unsafe URL rejected'))

      consoleWarnSpy.mockRestore()
    })

    test('rejects data: protocol URLs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        baseUrl: 'data:text/html,<script>alert("XSS")</script>',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe(fallbackConfig.baseUrl)

      consoleWarnSpy.mockRestore()
    })

    test('rejects URLs with embedded script tags', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        baseUrl: 'http://localhost:3457/<script>alert("XSS")</script>',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe(fallbackConfig.baseUrl)

      consoleWarnSpy.mockRestore()
    })

    test('rejects URLs with event handlers', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        appUrl: 'http://localhost" onerror="alert(1)',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.appUrl).toBe(fallbackConfig.appUrl)

      consoleWarnSpy.mockRestore()
    })

    test('rejects URLs not in allowlist', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        baseUrl: 'https://evil.com',
        appUrl: 'http://malicious.site',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.baseUrl).toBe(fallbackConfig.baseUrl)
      expect(result.appUrl).toBe(fallbackConfig.appUrl)
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Security] URL not in allowlist'))

      consoleWarnSpy.mockRestore()
    })
  })

  describe('string sanitization', () => {
    test('accepts valid string values', () => {
      const config = {
        ...fallbackConfig,
        apiVersion: '2024-10',
        appName: 'My Test App',
        storeFqdn: 'my-store.myshopify.com',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.apiVersion).toBe('2024-10')
      expect(result.appName).toBe('My Test App')
      expect(result.storeFqdn).toBe('my-store.myshopify.com')
    })

    test('sanitizes strings with script tags', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        appName: '<script>alert("XSS")</script>Malicious App',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.appName).toBe(fallbackConfig.appName)

      consoleWarnSpy.mockRestore()
    })

    test('sanitizes strings with event handlers', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        storeFqdn: 'test" onerror="alert(1)',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.storeFqdn).toBe(fallbackConfig.storeFqdn)

      consoleWarnSpy.mockRestore()
    })

    test('sanitizes strings with javascript: protocol', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        appName: 'javascript:alert("XSS")',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.appName).toBe(fallbackConfig.appName)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('array validation', () => {
    test('filters and sanitizes apiVersions array', () => {
      const config = {
        ...fallbackConfig,
        apiVersions: ['2024-10', '<script>alert("XSS")</script>', '2024-07', 123 as any],
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.apiVersions).toHaveLength(2)
      expect(result.apiVersions).toContain('2024-10')
      expect(result.apiVersions).toContain('2024-07')
      expect(result.apiVersions).not.toContain('<script>alert("XSS")</script>')
    })

    test('uses fallback for invalid apiVersions', () => {
      const config = {
        ...fallbackConfig,
        apiVersions: 'not-an-array' as any,
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.apiVersions).toEqual(fallbackConfig.apiVersions)
    })
  })

  describe('optional fields', () => {
    test('preserves valid optional fields', () => {
      const config = {
        ...fallbackConfig,
        key: 'safe-key-123',
        query: '{ shop { name } }',
        variables: '{}',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.key).toBe('safe-key-123')
      expect(result.query).toBe('{ shop { name } }')
      expect(result.variables).toBe('{}')
    })

    test('sanitizes optional fields with dangerous content', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        query: '<script>alert("XSS")</script>{ shop { name } }',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.query).toBe('')

      consoleWarnSpy.mockRestore()
    })

    test('omits optional fields when undefined', () => {
      const config = {
        ...fallbackConfig,
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.key).toBeUndefined()
      expect(result.query).toBeUndefined()
      expect(result.variables).toBeUndefined()
    })
  })

  describe('defaultQueries validation', () => {
    test('validates and sanitizes defaultQueries array', () => {
      const config = {
        ...fallbackConfig,
        defaultQueries: [
          {
            query: '{ shop { name } }',
            variables: '{}',
            preface: 'Get shop info',
          },
          {
            query: '<script>alert("XSS")</script>',
            variables: '{}',
          },
        ],
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.defaultQueries).toHaveLength(2)
      expect(result.defaultQueries?.[0]?.query).toBe('{ shop { name } }')
      expect(result.defaultQueries?.[1]?.query).toBe('')
    })

    test('uses fallback for invalid defaultQueries', () => {
      const config = {
        ...fallbackConfig,
        defaultQueries: 'not-an-array' as any,
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.defaultQueries).toBe(fallbackConfig.defaultQueries)
    })
  })

  describe('invalid input handling', () => {
    test('returns fallback for undefined config', () => {
      const result = validateConfig(undefined, fallbackConfig)
      expect(result).toEqual(fallbackConfig)
    })

    test('returns fallback for null config', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = validateConfig(null as any, fallbackConfig)
      expect(result).toEqual(fallbackConfig)

      consoleWarnSpy.mockRestore()
    })

    test('returns fallback for non-object config', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = validateConfig('not an object' as any, fallbackConfig)
      expect(result).toEqual(fallbackConfig)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('complex XSS scenarios', () => {
    test('blocks polyglot XSS attempts', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        appName:
          'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e',
      }
      const result = validateConfig(config, fallbackConfig)
      expect(result.appName).toBe(fallbackConfig.appName)

      consoleWarnSpy.mockRestore()
    })

    test('allows localhost URL with query parameters', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config = {
        ...fallbackConfig,
        appUrl: 'http://localhost:3000?query=%3Cscript%3Ealert(1)%3C/script%3E',
      }
      const result = validateConfig(config, fallbackConfig)
      // Localhost URLs are allowed, query params are preserved by URL constructor
      // The protection is at the protocol/domain level, not query string
      expect(result.appUrl).toBe('http://localhost:3000?query=%3Cscript%3Ealert(1)%3C/script%3E')
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })
})
