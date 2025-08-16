import {generateGroupingKey} from './key-generator.js'
import {describe, test, expect} from 'vitest'

describe('generateGroupingKey', () => {
  test('generates consistent key for same error patterns', () => {
    const error1 = new Error('Failed to connect to my-store.myshopify.com')
    const error2 = new Error('Failed to connect to another-store.myshopify.com')

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    // Same pattern, different store names - keys should still be the same since stack frame would be similar
    // The stack frame part will be 'unknown' if no meaningful frame is found
    expect(key1).toBe(key2)
    expect(key1).toMatch(/^cli:handled:Error:Failed to connect to <STORE>\.myshopify\.com:/)
  })

  test('generates different keys for different error classes', () => {
    const error = new Error('Test error')
    const typeError = new TypeError('Test error')

    const key1 = generateGroupingKey(error, false)
    const key2 = generateGroupingKey(typeError, false)

    expect(key1).not.toBe(key2)
  })

  test('handles null/undefined message gracefully', () => {
    const error = new Error()
    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    expect(key).toMatch(/^cli:handled:Error:.*:/)
  })

  test('includes handled/unhandled status in key', () => {
    const error = new Error('Test error')
    const handledKey = generateGroupingKey(error, false)
    const unhandledKey = generateGroupingKey(error, true)

    expect(handledKey).toMatch(/^cli:handled:/)
    expect(unhandledKey).toMatch(/^cli:unhandled:/)
    expect(handledKey).not.toBe(unhandledKey)
  })

  test('differentiates handled vs unhandled for same error', () => {
    const error = new TypeError('Connection refused')

    const handledKey = generateGroupingKey(error, false)
    const unhandledKey = generateGroupingKey(error, true)

    // Should have same error class and message but different status
    // Now includes stack frame at the end
    expect(handledKey).toMatch(/^cli:handled:TypeError:Connection refused:/)
    expect(unhandledKey).toMatch(/^cli:unhandled:TypeError:Connection refused:/)
    expect(handledKey).not.toBe(unhandledKey)
  })

  test('properly groups handled errors separately from unhandled', () => {
    const errors = [
      {error: new Error('Network timeout'), unhandled: false},
      {error: new Error('Network timeout'), unhandled: true},
      {error: new TypeError('Cannot read property'), unhandled: false},
      {error: new TypeError('Cannot read property'), unhandled: true},
    ]

    const keys = errors.map(({error, unhandled}) => generateGroupingKey(error, unhandled))

    // Should have 4 unique keys (2 error types × 2 statuses)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(4)

    // Verify the expected keys now include stack frame
    expect(keys[0]).toMatch(/^cli:handled:Error:Network timeout:/)
    expect(keys[1]).toMatch(/^cli:unhandled:Error:Network timeout:/)
    expect(keys[2]).toMatch(/^cli:handled:TypeError:Cannot read property:/)
    expect(keys[3]).toMatch(/^cli:unhandled:TypeError:Cannot read property:/)
  })

  test('generates consistent keys for same error type', () => {
    const errors = [
      new Error('Failed to connect to store1.myshopify.com'),
      new Error('Failed to connect to store2.myshopify.com'),
      new Error('Failed to connect to store3.myshopify.com'),
    ]

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All should generate the same key since they have the same pattern
    expect(keys[0]).toBe(keys[1])
    expect(keys[1]).toBe(keys[2])
  })

  test('key format follows expected pattern', () => {
    const error = new TypeError('Failed to connect to quick-brown-fox.myshopify.com')
    const key = generateGroupingKey(error, true)

    // cli:unhandled:TypeError:Failed to connect to <STORE>.myshopify.com:unknown (or stack frame)
    expect(key).toMatch(/^cli:unhandled:TypeError:Failed to connect to <STORE>\.myshopify\.com:/)
  })
})

describe('edge cases', () => {
  test('handles circular references in error objects', () => {
    const error: any = new Error('Circular')
    error.circular = error

    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    expect(key).toContain('Circular')
  })

  test('handles non-ASCII characters', () => {
    const error = new Error('Error: 错误信息 🚀')
    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
  })

  test('handles malformed stack traces', () => {
    const error = new Error('Malformed')
    error.stack = 'This is not a valid stack trace format'

    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    expect(key).toContain('Malformed')
  })
})

describe('error boundary protection', () => {
  test('returns fallback hash for invalid input (null)', () => {
    const key = generateGroupingKey(null as any, false)
    expect(key).toBe('cli:invalid:InvalidInput:invalid-error-object:unknown')
  })

  test('returns fallback hash for invalid input (undefined)', () => {
    const key = generateGroupingKey(undefined as any, false)
    expect(key).toBe('cli:invalid:InvalidInput:invalid-error-object:unknown')
  })

  test('returns fallback hash for invalid input (string)', () => {
    const key = generateGroupingKey('not an error' as any, false)
    expect(key).toBe('cli:invalid:InvalidInput:invalid-error-object:unknown')
  })

  test('returns fallback hash for invalid input (number)', () => {
    const key = generateGroupingKey(42 as any, false)
    expect(key).toBe('cli:invalid:InvalidInput:invalid-error-object:unknown')
  })

  test('returns fallback hash for invalid input (plain object)', () => {
    const key = generateGroupingKey({message: 'fake error'} as any, false)
    expect(key).toBe('cli:invalid:InvalidInput:invalid-error-object:unknown')
  })

  test('handles errors with problematic constructor names', () => {
    const error = new Error('Test')
    Object.defineProperty(error, 'constructor', {
      get() {
        throw new Error('Cannot access constructor')
      },
    })

    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    expect(key).toContain('Test')
  })

  test('handles errors that throw during context extraction', () => {
    const error = new Error('Test')
    Object.defineProperty(error, 'message', {
      get() {
        throw new Error('Cannot access message')
      },
    })

    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    // Should handle gracefully with empty message
    expect(key).toBe('cli:handled:Error::unknown')
  })
})

describe('performance', () => {
  test('generates key within reasonable time for typical errors', () => {
    const error = new Error('Performance test error with a very long message '.repeat(100))
    error.stack = `Error: Performance test
      at Object.<anonymous> (/very/long/path/that/repeats/`.repeat(50)

    const start = performance.now()
    const key = generateGroupingKey(error, false)
    const end = performance.now()

    expect(key).toBeTruthy()
    // Should complete in under 10ms
    expect(end - start).toBeLessThan(10)
  })
})
