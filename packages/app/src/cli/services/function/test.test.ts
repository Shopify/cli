import {functionTest, TestCase} from './test.js'
import {runFunction} from './runner.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {describe, test, vi, expect, beforeEach} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, glob} from '@shopify/cli-kit/node/fs'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

vi.mock('./runner.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/ui')

describe('functionTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
    
    // Mock renderTasks to execute tasks directly
    vi.mocked(renderTasks).mockImplementation(async (tasks) => {
      for (const task of tasks) {
        await task.task()
      }
    })
  })

  test('throws error when no test files found', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    vi.mocked(glob).mockResolvedValue([])

    // When/Then
    await expect(functionTest({functionExtension, export: '_start'})).rejects.toThrow(AbortError)
    await expect(functionTest({functionExtension, export: '_start'})).rejects.toThrow('No test files found')
  })

  test('runs tests and displays results when all pass', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const testCase: TestCase = {
      name: 'test 1',
      input: {value: 1},
      expected: {result: 1},
      export: 'test_export',
    }

    vi.mocked(glob).mockResolvedValue(['/path/to/test.json'])
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify(testCase)))
    vi.mocked(runFunction).mockImplementation(async (options) => {
      // Mock function execution - return output field like the actual runner
      if (options.stdout && typeof options.stdout === 'object' && 'write' in options.stdout) {
        ;(options.stdout as Writable).write(Buffer.from('{"output": {"result": 1}}'))
      }
    })

    // When
    await functionTest({functionExtension, export: '_start'})

    // Then
    expect(runFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        export: 'test_export',
      }),
    )
    expect(process.exitCode).toBeUndefined()
  })

  test('runs tests and displays failures when tests fail', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const testCase: TestCase = {
      name: 'failing test',
      input: {value: 1},
      expected: {result: 1},
    }

    vi.mocked(glob).mockResolvedValue(['/path/to/test.json'])
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify(testCase)))
    vi.mocked(runFunction).mockImplementation(async (options) => {
      // Mock function execution with different output
      if (options.stdout && typeof options.stdout === 'object' && 'write' in options.stdout) {
        ;(options.stdout as Writable).write(Buffer.from('{"output": {"result": 2}}'))
      }
    })

    // When
    await functionTest({functionExtension, export: '_start'})

    // Then
    expect(process.exitCode).toBe(1)
  })

  test('runs specific test file when testFile option provided', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const testCase: TestCase = {
      name: 'specific test',
      input: {value: 1},
      expected: {result: 1},
    }

    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify(testCase)))
    vi.mocked(runFunction).mockImplementation(async (options) => {
      if (options.stdout && typeof options.stdout === 'object' && 'write' in options.stdout) {
        ;(options.stdout as Writable).write(Buffer.from('{"output": {"result": 1}}'))
      }
    })

    // When
    await functionTest({functionExtension, export: '_start', testFile: 'specific.json'})

    // Then
    expect(glob).not.toHaveBeenCalled()
    expect(readFile).toHaveBeenCalledWith(expect.stringContaining('specific.json'))
    expect(process.exitCode).toBeUndefined()
  })

  test('handles function runtime errors', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const testCase: TestCase = {
      name: 'error test',
      input: {value: 1},
      expected: {result: 1},
    }

    vi.mocked(glob).mockResolvedValue(['/path/to/test.json'])
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify(testCase)))
    vi.mocked(runFunction).mockImplementation(async (options) => {
      // Mock function execution with error
      if (options.stderr && typeof options.stderr === 'object' && 'write' in options.stderr) {
        ;(options.stderr as Writable).write(Buffer.from('Runtime error occurred'))
      }
    })

    // When
    await functionTest({functionExtension, export: '_start'})

    // Then
    expect(process.exitCode).toBe(1)
  })
})
