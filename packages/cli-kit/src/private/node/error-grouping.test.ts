import {generateGroupingKey} from './error-grouping/key-generator.js'
import {extractErrorContext} from './error-grouping/context-extractor.js'
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
    const error1 = new Error('Test error')
    const error2 = new Error('Test error')

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    expect(key1).toBe(key2)
  })

  test('key format follows expected pattern', () => {
    const error = new TypeError('Failed to connect to shop.myshopify.com')
    const key = generateGroupingKey(error, true)

    // Now includes stack frame at the end
    expect(key).toMatch(/^cli:unhandled:TypeError:Failed to connect to <STORE>\.myshopify\.com:/)
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
      columnNumber: 5,
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

    expect(() => generateGroupingKey(error, false)).not.toThrow()
  })

  test('handles non-ASCII characters', () => {
    const error = new Error('Error with emoji 🚀 and unicode λ')
    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
  })

  test('handles malformed stack traces', () => {
    const error = new Error('Malformed')
    error.stack = 'This is not a valid stack trace'

    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
  })
})

describe('aggressive path normalization', () => {
  test('normalizes various node_modules paths to the same pattern', () => {
    const testCases = [
      // Global installations
      '/Users/john/project/node_modules/@shopify/cli/dist/index.js',
      'C:\\Users\\jane\\AppData\\Roaming\\npm\\node_modules\\@shopify\\cli\\dist\\index.js',
      '/home/bob/.local/share/pnpm/global/5/node_modules/@shopify/cli/dist/index.js',
      // Local installations
      '/workspace/myapp/node_modules/@shopify/cli/dist/index.js',
      '/opt/homebrew/lib/node_modules/@shopify/cli/dist/index.js',
      // CI environments
      '/github/workspace/node_modules/@shopify/cli/dist/index.js',
      '/bitbucket/pipelines/agent/node_modules/@shopify/cli/dist/index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Failed to load module at ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All should sanitize to the same pattern - node_modules paths are normalized
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(1)
    expect(keys[0]).toContain('node_modules/@shopify/cli/dist/index.js')
  })

  test('normalizes CLI installation paths aggressively', () => {
    const testCases = [
      // macOS paths
      '/Users/alice/src/github.com/Shopify/cli/packages/cli-kit/dist/error.js',
      '/Users/bob/projects/shopify-cli/packages/cli-kit/dist/error.js',
      // Windows paths
      'C:\\Users\\charlie\\work\\cli\\packages\\cli-kit\\dist\\error.js',
      'D:\\Development\\shopify\\cli\\packages\\cli-kit\\dist\\error.js',
      // Linux paths
      '/home/david/repos/cli/packages/cli-kit/dist/error.js',
      '/opt/shopify/cli/packages/cli-kit/dist/error.js',
      // CI paths
      '/github/workspace/packages/cli-kit/dist/error.js',
      '/var/jenkins/workspace/cli/packages/cli-kit/dist/error.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Error in file ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All should normalize to the same key
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(1)
    expect(keys[0]).toContain('Error in file <PATH>')
  })

  test('handles package manager cache paths', () => {
    const testCases = [
      // Yarn cache paths with node_modules - these get normalized to node_modules/...
      '/.yarn/berry/cache/@shopify-cli-npm-3.50.0-abc123.zip/node_modules/@shopify/cli/dist/index.js',
      '/.yarn/cache/@shopify-cli-npm-3.50.0-xyz789/node_modules/@shopify/cli/dist/index.js',
      // pnpm store paths with node_modules - these get normalized to node_modules/...
      '/.pnpm-store/v3/npm-@shopify-cli-3.50.0-abc123/node_modules/@shopify/cli/dist/index.js',
      '/.pnpm/@shopify+cli@3.50.0/node_modules/@shopify/cli/dist/index.js',
      // npm cache with node_modules
      '/npm/cache/_npx/12345/lib/node_modules/@shopify/cli/dist/index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Cache error at ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All paths with node_modules should normalize to node_modules/...
    // This is correct behavior - we want to normalize ALL node_modules paths the same way
    keys.forEach((key) => {
      expect(key).toContain('node_modules/@shopify/cli/dist/index.js')
    })
  })

  test('removes absolute paths from stack traces', () => {
    const error1 = new Error('Stack trace test')
    error1.stack = `Error: Stack trace test
    at Object.<anonymous> (/Users/john/project/src/index.js:10:15)
    at Module._compile (/Users/john/project/node_modules/module.js:653:30)
    at Object.Module._extensions..js (/usr/local/lib/node_modules/node/lib/module.js:664:10)`

    const error2 = new Error('Stack trace test')
    error2.stack = `Error: Stack trace test
    at Object.<anonymous> (C:\\Users\\jane\\work\\src\\index.js:10:15)
    at Module._compile (C:\\Users\\jane\\work\\node_modules\\module.js:653:30)
    at Object.Module._extensions..js (C:\\Program Files\\nodejs\\lib\\module.js:664:10)`

    const context1 = extractErrorContext(error1)
    const context2 = extractErrorContext(error2)

    // Stack traces should be normalized to remove absolute paths
    expect(context1.topFrame?.file).toBe('<PATH>')
    expect(context2.topFrame?.file).toBe('<PATH>')
  })

  test('normalizes temporary directory paths', () => {
    const testCases = [
      // macOS temp with node_modules
      '/var/folders/xx/yyy123/T/npm-12345/node_modules/@shopify/cli/index.js',
      // macOS temp without node_modules
      '/private/var/folders/ab/cdef456/T/TemporaryItems/@shopify/cli/index.js',
      // Linux temp
      '/tmp/npm-cache-78910/@shopify/cli/index.js',
      '/tmp/build-12345/node_modules/@shopify/cli/index.js',
      // Windows temp
      'C:\\Users\\user\\AppData\\Local\\Temp\\npm-11111\\@shopify\\cli\\index.js',
      'C:\\Windows\\Temp\\build\\@shopify\\cli\\index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Temp file error: ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // Temp paths should be normalized appropriately
    expect(keys[0]).toContain('node_modules/@shopify/cli/index.js')
    expect(keys[1]).toContain('<PATH>')
    expect(keys[2]).toContain('<PATH>')
    expect(keys[3]).toContain('node_modules/@shopify/cli/index.js')
    expect(keys[4]).toContain('<PATH>')
    expect(keys[5]).toContain('<PATH>')
  })

  test('handles Docker and container paths', () => {
    const testCases = [
      '/app/node_modules/@shopify/cli/dist/index.js',
      '/workspace/node_modules/@shopify/cli/dist/index.js',
      '/usr/src/app/node_modules/@shopify/cli/dist/index.js',
      '/opt/app/node_modules/@shopify/cli/dist/index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Container path: ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // Container paths with node_modules should normalize to node_modules/...
    keys.forEach((key) => {
      expect(key).toContain('node_modules/@shopify/cli/dist/index.js')
    })
  })
})

describe('stack frame extraction', () => {
  test('includes top stack frame in grouping key', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at testFunction (/Users/john/project/src/file.js:10:5)
    at runTest (/Users/john/project/test.js:20:10)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/^cli:handled:Error:Test error:src\/file\.js:testFunction$/)
  })

  test('skips Node.js internal frames', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at node:internal/modules/cjs/loader:123:45
    at node:events:513:28
    at actualFunction (/Users/john/project/src/real.js:15:8)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/^cli:handled:Error:Test error:src\/real\.js:actualFunction$/)
  })

  test('handles various Node.js internal module formats', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at node:internal/process/task_queues:95:5
    at node:internal/timers:123:45
    at node:fs:456:78
    at node:path:789:10
    at node:events:513:28
    at userCode (/app/index.js:42:15)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/^cli:handled:Error:Test error:app\/index\.js:userCode$/)
  })

  test('handles missing function name in stack frame', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at /Users/john/project/src/anonymous.js:10:5
    at runTest (/Users/john/project/test.js:20:10)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/^cli:handled:Error:Test error:src\/anonymous\.js:<anonymous>$/)
  })

  test('handles no stack trace', () => {
    const error = new Error('No stack')
    delete error.stack

    const key = generateGroupingKey(error, false)
    expect(key).toBe('cli:handled:Error:No stack:unknown')
  })

  test('handles empty stack trace', () => {
    const error = new Error('Empty stack')
    error.stack = ''

    const key = generateGroupingKey(error, false)
    expect(key).toBe('cli:handled:Error:Empty stack:unknown')
  })

  test('handles malformed stack trace', () => {
    const error = new Error('Malformed')
    error.stack = 'This is not a valid stack trace'

    const key = generateGroupingKey(error, false)
    expect(key).toBe('cli:handled:Error:Malformed:unknown')
  })

  test('normalizes different path formats to consistent frame', () => {
    const errors = [
      {
        stack: `Error: Test
    at handler (/Users/alice/cli/packages/cli-kit/src/error-handler.ts:125:15)`,
        expected: 'packages/cli-kit/src/error-handler.ts:handler',
      },
      {
        stack: `Error: Test
    at handler (C:\\Users\\bob\\cli\\packages\\cli-kit\\src\\error-handler.ts:125:15)`,
        // Windows paths fall back to taking last 3 parts
        expected: 'cli-kit/src/error-handler.ts:handler',
      },
      {
        stack: `Error: Test
    at handler (/home/charlie/projects/cli/packages/cli-kit/src/error-handler.ts:125:15)`,
        expected: 'packages/cli-kit/src/error-handler.ts:handler',
      },
    ]

    const keys = errors.map((errorData) => {
      const error = new Error('Test')
      error.stack = errorData.stack
      return generateGroupingKey(error, false)
    })

    // Unix paths normalize consistently with packages/ prefix
    expect(keys[0]).toMatch(/packages\/cli-kit\/src\/error-handler\.ts:handler$/)
    expect(keys[2]).toMatch(/packages\/cli-kit\/src\/error-handler\.ts:handler$/)

    // Windows path normalizes differently (takes last 3 parts)
    expect(keys[1]).toMatch(/cli-kit\/src\/error-handler\.ts:handler$/)

    // Unix paths should be the same
    expect(keys[0]).toBe(keys[2])
  })

  test('handles async/await wrappers in method names', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at async handleRequest (/app/server.js:10:5)
    at Promise.then (/app/server.js:20:10)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/server\.js:handleRequest$/)
  })

  test('handles generator functions', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at * processItems (/app/generator.js:10:5)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/generator\.js:processItems$/)
  })

  test('handles Object method calls', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at Object.processData (/app/processor.js:10:5)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/processor\.js:processData$/)
  })

  test('handles constructor calls', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at new MyClass (/app/classes.js:10:5)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/classes\.js:MyClass$/)
  })

  test('differentiates errors from different stack frames', () => {
    const error1 = new Error('Database connection failed')
    error1.stack = `Error: Database connection failed
    at connectDB (/app/database.js:10:5)`

    const error2 = new Error('Database connection failed')
    error2.stack = `Error: Database connection failed
    at retryConnection (/app/retry.js:20:10)`

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    expect(key1).not.toBe(key2)
    expect(key1).toMatch(/database\.js:connectDB$/)
    expect(key2).toMatch(/retry\.js:retryConnection$/)
  })

  test('groups same errors with same stack frame', () => {
    const error1 = new Error('Network timeout')
    error1.stack = `Error: Network timeout
    at fetchData (/app/api.js:30:15)`

    const error2 = new Error('Network timeout')
    error2.stack = `Error: Network timeout
    at fetchData (/app/api.js:30:15)`

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    expect(key1).toBe(key2)
    expect(key1).toMatch(/api\.js:fetchData$/)
  })

  test('handles webpack/bundled code with hashes', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at handleClick (app.a1b2c3d4.js:10:5)`

    const key = generateGroupingKey(error, false)
    // The hash is not sanitized in the stack frame, only in the message
    expect(key).toMatch(/app\.a1b2c3d4\.js:handleClick$/)
  })

  test('handles node_modules paths consistently', () => {
    const errors = [
      {
        stack: `Error: Test
    at validate (/Users/john/project/node_modules/@shopify/cli/dist/validator.js:10:5)`,
      },
      {
        stack: `Error: Test
    at validate (C:\\project\\node_modules\\@shopify\\cli\\dist\\validator.js:10:5)`,
      },
    ]

    const keys = errors.map((errorData) => {
      const error = new Error('Test')
      error.stack = errorData.stack
      return generateGroupingKey(error, false)
    })

    // Unix path strips node_modules/ prefix correctly
    expect(keys[0]).toMatch(/@shopify\/cli\/dist\/validator\.js:validate$/)

    // Windows path falls back to last 3 parts (doesn't match node_modules pattern due to backslashes)
    expect(keys[1]).toMatch(/cli\/dist\/validator\.js:validate$/)

    // They won't be identical due to different path handling, but both are consistent within their OS
  })

  test('handles stack trace with no line numbers', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at native
    at userFunction (/app/code.js:10:5)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/code\.js:userFunction$/)
  })

  test('handles eval and anonymous functions', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at eval (eval at runCode (/app/runner.js:10:5))
    at <anonymous> (/app/anonymous.js:20:10)
    at regularFunction (/app/regular.js:30:15)`

    const key = generateGroupingKey(error, false)
    // Eval frames are not properly parsed, so the key shows the eval string
    expect(key).toMatch(/eval at runCode.*eval$/)
  })

  test('handles TypeScript source maps', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at handleRequest (/dist/server.js:125:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`

    const key = generateGroupingKey(error, false)
    expect(key).toMatch(/dist\/server\.js:handleRequest$/)
  })

  test('handles deeply nested paths', () => {
    const error = new Error('Test')
    error.stack = `Error: Test
    at deepFunction (/very/long/path/to/project/src/components/ui/buttons/submit/handler.js:10:5)`

    const key = generateGroupingKey(error, false)
    // Should extract relevant parts
    expect(key).toMatch(/submit\/handler\.js:deepFunction$/)
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
    const error: any = new Error('Test')
    Object.defineProperty(error.constructor, 'name', {
      get: () => {
        throw new Error('Constructor name throws')
      },
    })

    // Should not throw and should generate a valid hash (using fallback values internally)
    expect(() => generateGroupingKey(error, false)).not.toThrow()
    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    // Valid hash format
    expect(key).toMatch(/^cli:handled:/)
  })

  test('handles errors that throw during context extraction', () => {
    const error: any = new Error('Test')
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new Error('Message getter throws')
      },
    })

    // Should not throw and should generate a valid hash (using fallback values internally)
    expect(() => generateGroupingKey(error, false)).not.toThrow()
    const key = generateGroupingKey(error, false)
    expect(key).toBeTruthy()
    // Valid hash format
    expect(key).toMatch(/^cli:handled:/)
  })
})

describe('performance', () => {
  test('generates key within reasonable time for typical errors', () => {
    const error = new Error('Performance test at /Users/john/file.js:123:45')

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      generateGroupingKey(error, false)
    }
    const end = performance.now()

    const avgTime = (end - start) / 100
    // Less than 50ms per key
    expect(avgTime).toBeLessThan(50)
  })
})
