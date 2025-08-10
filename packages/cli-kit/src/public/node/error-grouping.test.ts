import {generateGroupingHash, clearHashCache, extractErrorContext, sanitizeErrorMessage} from './error-grouping.js'
import {describe, test, expect, beforeEach} from 'vitest'

describe('generateGroupingHash', () => {
  beforeEach(() => {
    clearHashCache()
  })

  test('generates consistent hash for same error patterns', () => {
    const error1 = new Error('Failed to connect to my-store.myshopify.com')
    const error2 = new Error('Failed to connect to another-store.myshopify.com')

    const hash1 = generateGroupingHash(error1)
    const hash2 = generateGroupingHash(error2)

    // Same pattern, different store names
    expect(hash1).toBe(hash2)
  })

  test('generates different hashes for different error classes', () => {
    const error = new Error('Test error')
    const typeError = new TypeError('Test error')

    const hash1 = generateGroupingHash(error)
    const hash2 = generateGroupingHash(typeError)

    expect(hash1).not.toBe(hash2)
  })

  test('handles null/undefined message gracefully', () => {
    const error = new Error()
    const hash = generateGroupingHash(error)
    expect(hash).toBeTruthy()
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  test('uses memoization for repeated errors', () => {
    const error = new Error('Test error')
    const hash1 = generateGroupingHash(error)
    const hash2 = generateGroupingHash(error)

    expect(hash1).toBe(hash2)
  })

  test('generates different hashes for same message but different stack frames', () => {
    // Test cache collision fix - same message, different stack locations
    const error1 = new Error('Database connection failed')
    error1.stack = `Error: Database connection failed
    at connectDB (/app/src/database.js:10:5)
    at main (/app/src/index.js:20:10)`

    const error2 = new Error('Database connection failed')
    error2.stack = `Error: Database connection failed
    at retryConnection (/app/src/retry.js:30:15)
    at handleError (/app/src/error.js:40:20)`

    const hash1 = generateGroupingHash(error1)
    const hash2 = generateGroupingHash(error2)

    // Same message but different stack frames should produce different hashes
    expect(hash1).not.toBe(hash2)
  })

  test('cache key includes stack frame to prevent collision', () => {
    // Clear cache to ensure fresh test
    clearHashCache()

    const error1 = new Error('API request failed')
    error1.stack = `Error: API request failed
    at fetchAPI (/app/src/api.js:100:10)`

    const error2 = new Error('API request failed')
    error2.stack = `Error: API request failed
    at retryAPI (/app/src/api.js:200:20)`

    // Generate first hash - will be cached
    const hash1 = generateGroupingHash(error1)

    // Generate second hash - should not use cached value from error1
    const hash2 = generateGroupingHash(error2)

    expect(hash1).not.toBe(hash2)

    // Verify same error generates same hash (cache working correctly)
    const hash1Again = generateGroupingHash(error1)
    expect(hash1).toBe(hash1Again)
  })
})

describe('sanitizeErrorMessage', () => {
  test.each([
    // JWT tokens - CRITICAL: Test first to ensure they're caught before other patterns
    [
      'Auth failed with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'Auth failed with token <JWT>',
    ],
    ['JWT token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SWTKwK', 'JWT token: <JWT>'],

    // Database URLs
    ['mongodb://user:pass@localhost:27017/db', '<DATABASE_URL>'],
    ['postgresql://user:password@host.com:5432/mydb', '<DATABASE_URL>'],
    ['mysql://root:secret@127.0.0.1:3306/database', '<DATABASE_URL>'],
    ['redis://user:pass@redis.example.com:6379', '<DATABASE_URL>'],
    ['sqlite:///path/to/database.db', '<DATABASE_URL>'],

    // GitHub tokens
    ['Token ghp_1234567890abcdefghijklmnopqrstuvwxyz1234', 'Token <GITHUB_TOKEN>'],
    ['GitHub PAT: gho_abcdefghijklmnopqrstuvwxyz1234567890', 'GitHub PAT: <GITHUB_TOKEN>'],
    ['Secret ghps_1234567890abcdefghijklmnopqrstuvwxyz12', 'Secret <GITHUB_TOKEN>'],

    // NPM tokens
    ['npm_abcdefghijklmnopqrstuvwxyz1234567890', '<NPM_TOKEN>'],
    ['NPM token npm_1234567890abcdefghijklmnopqrstuvwxyzAB', 'NPM token <NPM_TOKEN>'],

    // API keys in various formats
    ['api_key=sk_test_1234567890abcdef', 'api_key=<REDACTED>'],
    ['apikey: "my-secret-api-key-12345"', 'api_key=<REDACTED>'],
    ['api-key=abc123xyz789', 'api_key=<REDACTED>'],
    ['api_secret:super_secret_value_123', 'api_key=<REDACTED>'],
    ['api_token="token_abc_123_xyz"', 'api_key=<REDACTED>'],

    // Bearer tokens
    ['Authorization: Bearer abc123xyz789token', 'Authorization: Bearer <TOKEN>'],
    ['Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'Bearer <TOKEN>'],

    // Email addresses
    ['Contact user@example.com for help', 'Contact <EMAIL> for help'],
    ['Send to john.doe+test@company.co.uk', 'Send to <EMAIL>'],
    ['Email admin@shopify.com failed', 'Email <EMAIL> failed'],

    // File paths
    ['Cannot read file /Users/john/project/file.js', 'Cannot read file <PATH>'],
    ['Error at C:\\Users\\jane\\app\\index.ts', 'Error at <PATH>'],
    ['Failed to load /home/user/app/config.json', 'Failed to load <PATH>'],

    // Store names
    ['Failed to connect to my-store.myshopify.com', 'Failed to connect to <STORE>.myshopify.com'],
    ['Store quick-brown-fox-123.myshopify.com not found', 'Store <STORE>.myshopify.com not found'],

    // Ports
    ['Connection refused at localhost:3456', 'Connection refused at localhost:<PORT>'],
    ['Server running on http://127.0.0.1:8080', 'Server running on http://127.0.0.1:<PORT>'],

    // UUIDs/GIDs
    ['Resource gid://shopify/Product/7890123456', 'Resource gid://shopify/<TYPE>/<ID>'],
    ['UUID a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UUID <UUID>'],

    // Tokens
    ['Invalid token shpat_1234567890abcdef', 'Invalid token <TOKEN>'],
    ['Auth failed for shpua_xyz123', 'Auth failed for <TOKEN>'],

    // Versions
    ['Package @shopify/cli@3.82.0 not found', 'Package @<PACKAGE>@<VERSION> not found'],
    ['Node v20.10.0 required', 'Node <VERSION> required'],

    // API versions
    ['Failed GET /admin/2024-01/products.json', 'Failed GET /admin/<API_VERSION>/products.json'],

    // Webpack chunks
    ['Cannot load chunk app.a1b2c3d4.js', 'Cannot load chunk app.<HASH>.js'],
    ['Module vendors~main.xyz789.js failed', 'Module vendors~main.<HASH>.js failed'],

    // Line/column numbers
    ['Error at line 42, column 17', 'Error at line <LINE>, column <COL>'],
    ['SyntaxError (123:45)', 'SyntaxError (<LINE>:<COL>)'],

    // Complex combinations with sensitive data
    [
      'Store my-shop.myshopify.com failed at localhost:3000 with token shpat_abc123',
      'Store <STORE>.myshopify.com failed at localhost:<PORT> with token <TOKEN>',
    ],
    [
      'Database mongodb://admin:password@localhost:27017/shopify at user@example.com',
      'Database <DATABASE_URL> at <EMAIL>',
    ],
    [
      'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc failed for api_key=secret123',
      'JWT <JWT> failed for api_key=<REDACTED>',
    ],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeErrorMessage(input)).toBe(expected)
  })

  test('handles empty string', () => {
    expect(sanitizeErrorMessage('')).toBe('')
  })

  test('handles very long messages', () => {
    const longMessage = `Error: ${'a'.repeat(10000)} at /Users/john/file.js`
    const result = sanitizeErrorMessage(longMessage)
    expect(result).toContain('<PATH>')
    expect(result.length).toBeGreaterThan(100)
  })
})

describe('extractErrorContext', () => {
  test('extracts all required context fields', () => {
    const error = new Error('Test error message')
    error.stack = `Error: Test error message
    at testFunction (/Users/john/project/file.js:10:5)
    at Object.<anonymous> (/Users/john/project/test.js:20:10)`

    const context = extractErrorContext(error)

    expect(context.errorClass).toBe('Error')
    expect(context.errorMessage).toBe('Test error message')
    expect(context.sanitizedMessage).toBe('Test error message')
    expect(context.topFrame).toEqual({
      method: 'testFunction',
      file: '<PATH>',
      lineNumber: 10,
    })
    expect(context.originalMessage).toBe('Test error message')
    expect(context.originalStack).toBe(error.stack)
  })

  test('handles missing stack trace', () => {
    const error = new Error('No stack')
    // Intentionally removing stack for test
    delete error.stack

    const context = extractErrorContext(error)

    expect(context.topFrame).toBeUndefined()
    expect(context.originalStack).toBeUndefined()
  })

  test('handles custom error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'CustomError'
      }
    }

    const error = new CustomError('Custom error')
    const context = extractErrorContext(error)

    expect(context.errorClass).toBe('CustomError')
  })
})

describe('edge cases', () => {
  test('handles circular references in error objects', () => {
    const error: any = new Error('Circular')
    error.circular = error

    expect(() => generateGroupingHash(error)).not.toThrow()
  })

  test('handles non-ASCII characters', () => {
    const error = new Error('Error with emoji 🚀 and unicode λ')
    const hash = generateGroupingHash(error)
    expect(hash).toBeTruthy()
  })

  test('handles malformed stack traces', () => {
    const error = new Error('Malformed')
    error.stack = 'This is not a valid stack trace'

    const hash = generateGroupingHash(error)
    expect(hash).toBeTruthy()
  })
})

describe('error boundary protection', () => {
  test('returns fallback hash for invalid input (null)', () => {
    const hash = generateGroupingHash(null as any)
    expect(hash).toBe('invalid-input')
  })

  test('returns fallback hash for invalid input (undefined)', () => {
    const hash = generateGroupingHash(undefined as any)
    expect(hash).toBe('invalid-input')
  })

  test('returns fallback hash for invalid input (string)', () => {
    const hash = generateGroupingHash('not an error' as any)
    expect(hash).toBe('invalid-input')
  })

  test('returns fallback hash for invalid input (number)', () => {
    const hash = generateGroupingHash(42 as any)
    expect(hash).toBe('invalid-input')
  })

  test('returns fallback hash for invalid input (plain object)', () => {
    const hash = generateGroupingHash({message: 'fake error'} as any)
    expect(hash).toBe('invalid-input')
  })

  test('handles errors with problematic constructor names', () => {
    const error: any = new Error('Test')
    Object.defineProperty(error.constructor, 'name', {
      get: () => {
        throw new Error('Constructor name throws')
      },
    })

    // Should not throw and should generate a valid hash (using fallback values internally)
    expect(() => generateGroupingHash(error)).not.toThrow()
    const hash = generateGroupingHash(error)
    expect(hash).toBeTruthy()
    // Valid hash format
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  test('handles errors that throw during context extraction', () => {
    const error: any = new Error('Test')
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new Error('Message getter throws')
      },
    })

    // Should not throw and should generate a valid hash (using fallback values internally)
    expect(() => generateGroupingHash(error)).not.toThrow()
    const hash = generateGroupingHash(error)
    expect(hash).toBeTruthy()
    // Valid hash format
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })
})

describe('performance', () => {
  test('generates hash within reasonable time for typical errors', () => {
    // Clear cache to get accurate timing
    clearHashCache()
    const error = new Error('Performance test at /Users/john/file.js:123:45')

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      // Clear cache each time to test actual generation time
      clearHashCache()
      generateGroupingHash(error)
    }
    const end = performance.now()

    const avgTime = (end - start) / 100
    // Less than 10ms per hash
    expect(avgTime).toBeLessThan(10)
  })

  test("sanitization doesn't cause regex catastrophic backtracking", () => {
    const pathologicalInput = `${'a'.repeat(1000)}localhost:${'1'.repeat(1000)}`

    const start = performance.now()
    sanitizeErrorMessage(pathologicalInput)
    const end = performance.now()

    // Should complete quickly
    expect(end - start).toBeLessThan(100)
  })

  describe('ReDoS protection tests', () => {
    test('store domains pattern completes within 10ms threshold', () => {
      // Previously vulnerable to ReDoS: 103ms with unbounded quantifier
      const pathologicalInput = `${'-'.repeat(1000)}.myshopify.com`

      const start = performance.now()
      sanitizeErrorMessage(pathologicalInput)
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
    })

    test('webpack chunks pattern completes within 10ms threshold', () => {
      // Previously vulnerable to ReDoS: 51ms with unbounded quantifier
      const pathologicalInput = `app${'-'.repeat(1000)}.abcdef.js`

      const start = performance.now()
      sanitizeErrorMessage(pathologicalInput)
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
    })

    test('line:column pattern completes within reasonable time', () => {
      // Test with reasonable input that matches the pattern limits (max 6 digits)
      const inputs = [
        // Max allowed by pattern
        `(999999:999999)`,
        // Should not match due to >6 digits
        `(${'1'.repeat(7)}:${'2'.repeat(7)})`,
        // Normal case
        `(12345:67890)`,
      ]

      for (const input of inputs) {
        const start = performance.now()
        sanitizeErrorMessage(input)
        const end = performance.now()

        // Should complete very quickly since pattern limits to 6 digits
        expect(end - start).toBeLessThan(10)
      }
    })

    test('all patterns handle extreme inputs within 10ms', () => {
      const extremeInputs = [
        // Store with maximum allowed length (62 chars + domain)
        `${'a'.repeat(62)}.myshopify.com`,
        // Complex webpack chunk names
        `vendor~module~component-sub-component.a1b2c3d4.js`,
        // Maximum line:column numbers
        `(999999:999999)`,
        // Mixed pathological patterns
        `Store ${'-'.repeat(100)}.myshopify.com at line 999999:999999 failed`,
      ]

      for (const input of extremeInputs) {
        const start = performance.now()
        sanitizeErrorMessage(input)
        const end = performance.now()

        expect(end - start).toBeLessThan(10)
      }
    })
  })
})
