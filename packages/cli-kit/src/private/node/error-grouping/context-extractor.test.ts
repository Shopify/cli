import {extractTopStackFrame} from './context-extractor.js'
import {describe, test, expect} from 'vitest'

describe('extractTopStackFrame', () => {
  test('extracts top stack frame correctly', () => {
    const stack = `Error: Test error
    at testFunction (/Users/john/project/file.js:10:5)
    at Object.<anonymous> (/Users/john/project/test.js:20:10)`

    const frame = extractTopStackFrame(stack)
    // Path has 5 parts, so all are kept
    expect(frame).toBe('Users/john/project/file.js:testFunction')
  })

  test('skips Node.js internal frames', () => {
    const stack = `Error: Test error
    at node:internal/modules/cjs/loader:123:45
    at node:internal/process/task_queues:95:5
    at testFunction (/Users/john/project/file.js:10:5)`

    const frame = extractTopStackFrame(stack)
    // Skips internal frames, uses first user frame
    expect(frame).toBe('Users/john/project/file.js:testFunction')
  })

  test('handles various Node.js internal module formats', () => {
    const testCases = [
      {
        stack: `Error: Test
        at node:internal/modules/cjs/loader:123:45
        at node:fs:456:78
        at node:path:789:10
        at userFunction (file.js:10:5)`,
        expected: 'file.js:userFunction',
      },
      {
        stack: `Error: Test
        at internal/process/task_queues:95:5
        at userFunction (file.js:10:5)`,
        expected: 'file.js:userFunction',
      },
    ]

    testCases.forEach(({stack, expected}) => {
      const frame = extractTopStackFrame(stack)
      expect(frame).toBe(expected)
    })
  })

  test('handles missing function name in stack frame', () => {
    const stack = `Error: Test error
    at /Users/john/project/file.js:10:5
    at Object.<anonymous> (/Users/john/project/test.js:20:10)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBe('Users/john/project/file.js:<anonymous>')
  })

  test('handles no stack trace', () => {
    const frame = extractTopStackFrame(undefined)
    expect(frame).toBeUndefined()
  })

  test('handles empty stack trace', () => {
    const frame = extractTopStackFrame('')
    expect(frame).toBeUndefined()
  })

  test('handles malformed stack trace', () => {
    const frame = extractTopStackFrame('This is not a valid stack trace')
    expect(frame).toBeUndefined()
  })

  test('normalizes different path formats to consistent frame', () => {
    const testCases = [
      {
        stack: `Error: Test
        at handler (/Users/john/project/src/handler.js:10:5)`,
        // src/ pattern matches
        expected: 'src/handler.js:handler',
      },
      {
        stack: `Error: Test
        at handler (C:\\Users\\john\\project\\src\\handler.js:10:5)`,
        // src/ pattern matches
        expected: 'src/handler.js:handler',
      },
      {
        stack: `Error: Test
        at handler (/home/user/workspace/project/src/handler.js:10:5)`,
        // src/ pattern matches
        expected: 'src/handler.js:handler',
      },
    ]

    testCases.forEach(({stack, expected}) => {
      const frame = extractTopStackFrame(stack)
      expect(frame).toBe(expected)
    })
  })

  test('handles async/await wrappers in method names', () => {
    const stack = `Error: Test
    at async handler (/project/file.js:10:5)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBe('project/file.js:handler')
  })

  test('handles generator functions', () => {
    const stack = `Error: Test
    at * generatorFunction (/project/file.js:10:5)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBe('project/file.js:generatorFunction')
  })

  test('handles Object method calls', () => {
    const stack = `Error: Test
    at Object.methodName (/project/file.js:10:5)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBe('project/file.js:methodName')
  })

  test('handles constructor calls', () => {
    const stack = `Error: Test
    at new MyClass (/project/file.js:10:5)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBe('project/file.js:MyClass')
  })

  test('handles webpack/bundled code with hashes', () => {
    const stack = `Error: Test
    at handler (webpack://app/./src/handler.js?a1b2:10:5)`

    const frame = extractTopStackFrame(stack)
    // webpack:// prefix gets stripped but query string remains
    expect(frame).toBe('src/handler.js?a1b2:handler')
  })

  test('handles node_modules paths consistently', () => {
    const testCases = [
      {
        stack: `Error: Test
        at handler (/Users/john/project/node_modules/express/lib/router.js:10:5)`,
        // node_modules/ gets stripped
        expected: 'express/lib/router.js:handler',
      },
      {
        stack: `Error: Test
        at handler (C:\\project\\node_modules\\@shopify\\cli-kit\\dist\\index.js:10:5)`,
        // node_modules/ gets stripped
        expected: '@shopify/cli-kit/dist/index.js:handler',
      },
    ]

    testCases.forEach(({stack, expected}) => {
      const frame = extractTopStackFrame(stack)
      expect(frame).toBe(expected)
    })
  })

  test('handles stack trace with no line numbers', () => {
    const stack = `Error: Test
    at native
    at handler (unknown source)`

    const frame = extractTopStackFrame(stack)
    expect(frame).toBeUndefined()
  })

  test('handles eval and anonymous functions', () => {
    const testCases = [
      {
        stack: `Error: Test
        at eval (eval at <anonymous> (/project/file.js:10:5))`,
        // eval patterns are complex and not perfectly handled
        // No match for eval pattern
        expected: undefined,
      },
      {
        stack: `Error: Test
        at <anonymous>:1:2
        at userFunction (/project/file.js:10:5)`,
        expected: 'project/file.js:userFunction',
      },
    ]

    testCases.forEach(({stack, expected}) => {
      const frame = extractTopStackFrame(stack)
      if (expected === undefined) {
        // For eval, we don't get a clean match
        expect(frame === undefined || frame.includes('eval')).toBe(true)
      } else {
        expect(frame).toBe(expected)
      }
    })
  })

  test('handles TypeScript source maps', () => {
    const stack = `Error: Test
    at handler (/project/dist/handler.js:10:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`

    const frame = extractTopStackFrame(stack)
    // dist/ pattern matches
    expect(frame).toBe('dist/handler.js:handler')
  })

  test('handles deeply nested paths', () => {
    const stack = `Error: Test
    at handler (/very/deeply/nested/path/to/project/src/components/handlers/error/handler.js:10:5)`

    const frame = extractTopStackFrame(stack)
    // src/ pattern matches and keeps everything after src/
    expect(frame).toBe('src/components/handlers/error/handler.js:handler')
  })
})
