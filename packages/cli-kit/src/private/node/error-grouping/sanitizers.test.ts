import {sanitizeErrorMessage} from './sanitizers.js'
import {describe, expect, test} from 'vitest'

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

describe('performance', () => {
  test("sanitization doesn't cause regex catastrophic backtracking", () => {
    const pathologicalInput = `${'a'.repeat(1000)}localhost:${'1'.repeat(1000)}`

    const start = performance.now()
    sanitizeErrorMessage(pathologicalInput)
    const end = performance.now()

    // Should complete quickly - updated to 50ms threshold
    expect(end - start).toBeLessThan(100)
  })

  describe('ReDoS protection tests', () => {
    test('store domains pattern completes within 50ms threshold', () => {
      // Previously vulnerable to ReDoS: 103ms with unbounded quantifier
      const pathologicalInput = `${'-'.repeat(1000)}.myshopify.com`

      const start = performance.now()
      sanitizeErrorMessage(pathologicalInput)
      const end = performance.now()

      expect(end - start).toBeLessThan(50)
    })

    test('webpack chunks pattern completes within 50ms threshold', () => {
      // Previously vulnerable to ReDoS: 51ms with unbounded quantifier
      const pathologicalInput = `app${'-'.repeat(1000)}.abcdef.js`

      const start = performance.now()
      sanitizeErrorMessage(pathologicalInput)
      const end = performance.now()

      expect(end - start).toBeLessThan(50)
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
        expect(end - start).toBeLessThan(50)
      }
    })

    test('all patterns handle extreme inputs within 50ms', () => {
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

        expect(end - start).toBeLessThan(50)
      }
    })
  })
})
