import {describe, test, expect, vi, beforeEach} from 'vitest'
import {runFunctionTests, getTestCommandFromToml, runFunctionTestsIfExists} from './test-runner.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {existsSync, readdirSync} from 'fs'
import {loadConfigurationFileContent} from '../../models/app/loader.js'

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
    vi.clearAllMocks()

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
        extensions: [{
          test: {
            command: 'npm test'
          }
        }]
      })

      const result = await getTestCommandFromToml('/test/path')

      expect(result).toBe('npm test')
      expect(mockLoadConfigurationFileContent).toHaveBeenCalledWith('/test/path/shopify.extension.toml')
    })

    test('returns undefined when TOML file does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await getTestCommandFromToml('/test/path')

      expect(result).toBeUndefined()
      expect(mockLoadConfigurationFileContent).not.toHaveBeenCalled()
    })

    test('returns undefined when test command is not present', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{}]
      })

      const result = await getTestCommandFromToml('/test/path')

      expect(result).toBeUndefined()
    })

    test('handles TOML parsing errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockRejectedValue(new Error('TOML parse error'))

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
        stdout: { write: vi.fn() },
        stderr: { write: vi.fn() },
      } as any

      mockExistsSync.mockReturnValue(true)
      vi.mocked(runFunctionTests).mockResolvedValue()

      await runFunctionTestsIfExists(mockExtension, mockOptions)

      expect(mockExistsSync).toHaveBeenCalledWith('/test/path/tests')
      expect(mockOptions.stdout.write).toHaveBeenCalledWith('Running tests for function: test-function...\n')
      expect(runFunctionTests).toHaveBeenCalledWith(mockExtension, mockOptions)
    })

    test('should not run tests when tests directory does not exist', async () => {
      const mockExtension = {
        directory: '/test/path',
        localIdentifier: 'test-function',
        outputPrefix: 'test-function',
      } as ExtensionInstance<FunctionConfigType>

      const mockOptions = {
        stdout: { write: vi.fn() },
        stderr: { write: vi.fn() },
      } as any

      mockExistsSync.mockReturnValue(false)

      await runFunctionTestsIfExists(mockExtension, mockOptions)

      expect(mockExistsSync).toHaveBeenCalledWith('/test/path/tests')
      expect(runFunctionTests).not.toHaveBeenCalled()
    })
  })

describe('runFunctionTests', () => {
    test('runs custom test command when specified in TOML', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{
          test: {
            command: 'npm test'
          }
        }]
      })

      await runFunctionTests(mockExtension, {
        stdout: mockStdout,
        stderr: mockStderr,
      })

      expect(mockExec).toHaveBeenCalledWith('npm test', [], {
        cwd: '/test/path',
        stdout: mockStdout,
        stderr: mockStderr,
        signal: undefined,
      })
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('✅ Tests completed in'))
    })

    test('runs vitest when no custom test command is specified', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{}]
      })

      // Mock tests directory exists
      mockJoinPath
        .mockReturnValueOnce('/test/path/shopify.extension.toml')
        .mockReturnValueOnce('/test/path/tests')

      mockExistsSync
        .mockReturnValueOnce(true) // TOML exists
        .mockReturnValueOnce(true) // tests directory exists

      mockReaddirSync.mockReturnValue(['test1.test.ts', 'test2.test.js'] as any)

      await runFunctionTests(mockExtension, {
        stdout: mockStdout,
        stderr: mockStderr,
      })

      expect(mockExec).toHaveBeenCalledWith('npx', ['vitest', 'run', 'tests'], {
        cwd: '/test/path',
        stdout: mockStdout,
        stderr: mockStderr,
        signal: undefined,
      })
    })

    test('handles test execution errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockLoadConfigurationFileContent.mockResolvedValue({
        extensions: [{
          test: {
            command: 'npm test'
          }
        }]
      })

      mockExec.mockRejectedValue(new Error('Test execution failed'))

      await runFunctionTests(mockExtension, {
        stdout: mockStdout,
        stderr: mockStderr,
      })

      expect(mockStdout.write).toHaveBeenCalledWith('Warning: Tests failed: Test execution failed\n')
    })
  })
})
