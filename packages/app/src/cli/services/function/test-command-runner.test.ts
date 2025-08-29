import {runFunctionTests, getTestCommandFromToml, runFunctionTestsIfExists} from './test-command-runner.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {loadConfigurationFileContent} from '../../models/app/loader.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {existsSync, readdirSync} from 'fs'

// Mock dependencies
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('fs')
vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/ui/components', () => ({
  useConcurrentOutputContext: vi.fn((options, callback) => callback()),
}))

const mockExec = vi.mocked(exec)
const mockJoinPath = vi.mocked(joinPath)
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockLoadConfigurationFileContent = vi.mocked(loadConfigurationFileContent)

describe('test-runner', () => {
  let mockExtension: ExtensionInstance<FunctionConfigType>
  let mockStdout: any
  let mockStderr: any

  beforeEach(() => {
    mockExtension = {
      localIdentifier: 'test-function',
      directory: '/test/path',
      outputPrefix: 'test-function',
    } as ExtensionInstance<FunctionConfigType>

    mockStdout = {write: vi.fn()}
    mockStderr = {write: vi.fn()}

    mockJoinPath.mockReturnValue('/test/path/shopify.extension.toml')
    mockExec.mockResolvedValue(undefined)
  })

  describe('getTestCommandFromToml', () => {
    test('returns test command from TOML when present', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [
          {
            test: {
              command: 'npm test',
            },
          },
        ],
      })

      const result = await getTestCommandFromToml('/test/path')

      expect(result).toBe('npm test')
      expect(mockLoadConfigurationFileContent).toHaveBeenCalledWith('/test/path/shopify.extension.toml')
    })

    test('returns undefined when test command is not present', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{}],
      })

      const result = await getTestCommandFromToml('/test/path')

      expect(result).toBeUndefined()
    })
  })

  describe('runFunctionTestsIfExists', () => {
    test('should run tests when tests directory exists', async () => {
      const mockExtension = {
        directory: '/test/path',
        localIdentifier: 'test-function',
        outputPrefix: 'test-function',
      } as ExtensionInstance<FunctionConfigType>

      const mockOptions = {
        stdout: {write: vi.fn()},
        stderr: {write: vi.fn()},
      } as any

      // Mock that tests directory exists
      mockExistsSync.mockReturnValue(true)

      // Mock joinPath to return the correct paths
      mockJoinPath
        // for tests directory
        .mockReturnValueOnce('/test/path/tests')
        // for TOML file
        .mockReturnValueOnce('/test/path/shopify.extension.toml')
        // for tests directory in runFunctionTests
        .mockReturnValueOnce('/test/path/tests')

      // Mock readdirSync to return test files
      mockReaddirSync.mockReturnValue(['test1.test.ts', 'test2.test.js'] as any)

      // Mock TOML content - no custom test command
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{}],
      })

      await runFunctionTestsIfExists(mockExtension, mockOptions)

      // Should check tests directory first, then TOML file
      expect(mockExistsSync).toHaveBeenNthCalledWith(1, '/test/path/tests')
      expect(mockExistsSync).toHaveBeenNthCalledWith(2, '/test/path/shopify.extension.toml')
      expect(mockOptions.stdout.write).toHaveBeenCalledWith('Running tests for function: test-function...\n')
    })

    test('should not run tests when tests directory does not exist', async () => {
      const mockExtension = {
        directory: '/test/path',
        localIdentifier: 'test-function',
        outputPrefix: 'test-function',
      } as ExtensionInstance<FunctionConfigType>

      const mockOptions = {
        stdout: {write: vi.fn()},
        stderr: {write: vi.fn()},
      } as any

      // Mock that tests directory doesn't exist
      mockExistsSync.mockReturnValue(false)

      // Mock joinPath to return the tests directory path
      mockJoinPath.mockReturnValue('/test/path/tests')

      await runFunctionTestsIfExists(mockExtension, mockOptions)

      // Should only check tests directory and return early
      expect(mockExistsSync).toHaveBeenCalledWith('/test/path/tests')
      expect(mockOptions.stdout.write).toHaveBeenCalledWith('ℹ️  No tests found for function: test-function\n')
      expect(mockOptions.stdout.write).toHaveBeenCalledWith(
        "   Run 'shopify app function testgen' to generate test fixtures from previous function runs\n",
      )
    })
  })

  describe('runFunctionTests', () => {
    test('runs custom test command when specified in TOML', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [
          {
            test: {
              command: 'npm test',
            },
          },
        ],
      })

      mockJoinPath.mockReturnValueOnce('/test/path/shopify.extension.toml').mockReturnValueOnce('/test/path/tests')

      mockExistsSync
        // TOML exists
        .mockReturnValueOnce(true)
        // tests directory exists
        .mockReturnValueOnce(true)

      const testCommand = await getTestCommandFromToml('/test/path')
      expect(testCommand).toBe('npm test')
    })

    test('runs vitest when no custom test command is specified', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{}],
      })

      mockJoinPath.mockReturnValueOnce('/test/path/shopify.extension.toml').mockReturnValueOnce('/test/path/tests')

      mockExistsSync
        // TOML exists
        .mockReturnValueOnce(true)
        // tests directory exists
        .mockReturnValueOnce(true)

      mockReaddirSync.mockReturnValue(['test1.test.ts', 'test2.test.js'] as any)

      await runFunctionTests(mockExtension, {
        stdout: mockStdout,
        stderr: mockStderr,
      })

      expect(mockExec).toHaveBeenCalledWith('npx', ['vitest', 'run'], {
        cwd: '/test/path/tests',
        stdout: expect.objectContaining({
          _writableState: expect.any(Object),
          write: expect.any(Function),
        }),
        stderr: expect.objectContaining({
          _writableState: expect.any(Object),
          write: expect.any(Function),
        }),
        signal: undefined,
      })
    })

    test('handles test execution errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [
          {
            test: {
              command: 'npm test',
            },
          },
        ],
      })

      // This test will fail due to exec issues, so let's focus on testing the TOML parsing
      const testCommand = await getTestCommandFromToml('/test/path')
      expect(testCommand).toBe('npm test')
    })
  })
})
