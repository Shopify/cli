import {generateGroupingKey} from './key-generator.js'
import {describe, test, expect} from 'vitest'

describe('aggressive path normalization', () => {
  test('normalizes various node_modules paths to the same pattern', () => {
    const testCases = [
      '/Users/john/project/node_modules/@shopify/cli/dist/index.js',
      'C:\\Users\\jane\\work\\node_modules\\@shopify\\cli\\dist\\index.js',
      '/home/ubuntu/app/node_modules/@shopify/cli/dist/index.js',
      'D:\\Projects\\test\\node_modules\\@shopify\\cli\\dist\\index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Failed at ${path}`)
      error.stack = `Error: Failed at ${path}
      at Object.<anonymous> (${path}:10:15)`
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All should normalize to the same pattern
    keys.forEach((key) => {
      expect(key).toContain('node_modules/@shopify/cli/dist/index.js')
    })
  })

  test('normalizes CLI installation paths aggressively', () => {
    const testCases = [
      '/Users/john/.npm/global/node_modules/@shopify/cli/dist/index.js',
      '/usr/local/lib/node_modules/@shopify/cli/dist/index.js',
      'C:\\Program Files\\nodejs\\node_modules\\@shopify\\cli\\dist\\index.js',
      '/opt/homebrew/lib/node_modules/@shopify/cli/dist/index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`CLI error from ${path}`)
      error.stack = `Error: CLI error from ${path}
      at cliFunction (${path}:20:10)`
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // All should normalize to the same pattern in the message part
    // The sanitization will normalize these paths
    expect(keys[0]).toContain('node_modules/@shopify/cli/dist/index.js')
    expect(keys[1]).toContain('node_modules/@shopify/cli/dist/index.js')
    expect(keys[2]).toContain('node_modules/@shopify/cli/dist/index.js')
    expect(keys[3]).toContain('node_modules/@shopify/cli/dist/index.js')

    // And all should have the same stack frame
    expect(keys[0]).toContain('@shopify/cli/dist/index.js:cliFunction')
    expect(keys[1]).toContain('@shopify/cli/dist/index.js:cliFunction')
    expect(keys[2]).toContain('@shopify/cli/dist/index.js:cliFunction')
    expect(keys[3]).toContain('@shopify/cli/dist/index.js:cliFunction')
  })

  test('handles package manager cache paths', () => {
    const testCases = [
      // Yarn cache paths
      '/Users/john/.yarn/cache/@shopify-cli-npm-3.0.0-abc123.zip/node_modules/@shopify/cli/index.js',
      'C:\\Users\\jane\\.yarn\\berry\\cache\\@shopify-cli-npm-3.0.0-def456.zip\\node_modules\\@shopify\\cli\\index.js',
      // pnpm store paths
      '/home/user/.pnpm/@shopify+cli@3.0.0/node_modules/@shopify/cli/index.js',
      'C:\\Users\\john\\.pnpm-store\\v3\\files\\abc123\\node_modules\\@shopify\\cli\\index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Cache path: ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // The paths in messages get normalized
    // Yarn cache paths - the .yarn/cache part gets normalized to yarn-cache/
    expect(keys[0]).toContain('Cache path: node_modules/@shopify/cli/index.js')
    expect(keys[1]).toContain('Cache path: node_modules/@shopify/cli/index.js')
    // pnpm paths - the .pnpm-store part gets normalized to pnpm-store/
    expect(keys[2]).toContain('Cache path: node_modules/@shopify/cli/index.js')
    expect(keys[3]).toContain('Cache path: node_modules/@shopify/cli/index.js')
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

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    // Both errors should produce keys with normalized paths
    // The paths should be normalized to remove absolute prefixes
    expect(key1).toContain(':Stack trace test:')
    expect(key2).toContain(':Stack trace test:')
    // Check that both keys end with the same normalized stack frame
    const parts1 = key1.split(':')
    const parts2 = key2.split(':')
    expect(parts1[parts1.length - 1]).toBe(parts2[parts2.length - 1])
  })

  test('normalizes temporary directory paths', () => {
    const testCases = [
      // macOS temp with node_modules
      '/var/folders/xx/yyy123/T/npm-12345/node_modules/@shopify/cli/index.js',
      // macOS temp without node_modules
      '/private/var/folders/ab/cde456/T/temp-project/src/index.js',
      // Windows temp
      'C:\\Users\\john\\AppData\\Local\\Temp\\npm-cache\\node_modules\\@shopify\\cli\\index.js',
      // Linux temp
      '/tmp/build-12345/node_modules/@shopify/cli/index.js',
    ]

    const errors = testCases.map((path) => {
      const error = new Error(`Temp path: ${path}`)
      return error
    })

    const keys = errors.map((error) => generateGroupingKey(error, false))

    // Temp paths with node_modules should normalize
    expect(keys[0]).toContain('node_modules/@shopify/cli/index.js')
    expect(keys[1]).toContain('<PATH>')
    expect(keys[2]).toContain('node_modules/@shopify/cli/index.js')
    expect(keys[3]).toContain('node_modules/@shopify/cli/index.js')
  })

  test('handles Docker and container paths', () => {
    const testCases = [
      '/app/node_modules/@shopify/cli/dist/index.js',
      '/workspace/node_modules/@shopify/cli/dist/index.js',
      '/github/workspace/node_modules/@shopify/cli/dist/index.js',
      '/bitbucket/pipelines/agent/build/node_modules/@shopify/cli/dist/index.js',
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

describe('stack frame extraction integration', () => {
  test('includes top stack frame in grouping key', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at testFunction (/Users/john/project/src/file.js:10:5)
    at Object.<anonymous> (/Users/john/project/test.js:20:10)`

    const key = generateGroupingKey(error, false)
    // Should include the normalized stack frame
    expect(key).toMatch(/cli:handled:Error:Test error:src\/file\.js:testFunction$/)
  })

  test('skips Node.js internal frames', () => {
    const error = new Error('Test error')
    error.stack = `Error: Test error
    at node:internal/modules/cjs/loader:123:45
    at node:internal/process/task_queues:95:5
    at testFunction (/Users/john/project/file.js:10:5)`

    const key = generateGroupingKey(error, false)
    // Should skip internal frames and use the first user frame
    expect(key).toMatch(/file\.js:testFunction$/)
  })

  test('differentiates errors from different stack frames', () => {
    const error1 = new Error('Same message')
    error1.stack = `Error: Same message
    at functionA (/project/fileA.js:10:5)`

    const error2 = new Error('Same message')
    error2.stack = `Error: Same message
    at functionB (/project/fileB.js:20:10)`

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    // Same message but different stack frames should produce different keys
    expect(key1).not.toBe(key2)
    expect(key1).toContain('fileA.js:functionA')
    expect(key2).toContain('fileB.js:functionB')
  })

  test('groups same errors with same stack frame', () => {
    const error1 = new Error('Error message 1')
    error1.stack = `Error: Error message 1
    at sameFunction (/project/same-file.js:10:5)`

    const error2 = new Error('Error message 2')
    error2.stack = `Error: Error message 2
    at sameFunction (/project/same-file.js:10:5)`

    const key1 = generateGroupingKey(error1, false)
    const key2 = generateGroupingKey(error2, false)

    // Different messages but same stack frame
    // Different because messages are different
    expect(key1).not.toBe(key2)
    expect(key1).toContain('same-file.js:sameFunction')
    expect(key2).toContain('same-file.js:sameFunction')
  })
})
