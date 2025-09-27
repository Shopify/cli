import {runExtensionTests} from './extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortSignal as CLIAbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui/components')
vi.mock('@shopify/cli-kit/node/system')

describe('runExtensionTests', () => {
  let mockApp: AppLinkedInterface
  let mockStdout: Writable
  let mockStderr: Writable
  let mockSignal: CLIAbortSignal

  beforeEach(() => {
    mockApp = {} as AppLinkedInterface
    mockStdout = {write: vi.fn()} as any
    mockStderr = {write: vi.fn()} as any
    mockSignal = {
      aborted: false,
      reason: undefined,
      onabort: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      throwIfAborted: vi.fn(),
    } as CLIAbortSignal
    vi.mocked(useConcurrentOutputContext).mockImplementation(async (_, fn) => fn())
  })

  const createMockExtension = (overrides: Partial<ExtensionInstance> = {}): ExtensionInstance => {
    const mockBuild = vi.fn().mockResolvedValue(undefined)
    return {
      localIdentifier: 'test-extension',
      outputPrefix: '[test-extension]',
      directory: '/app/extensions/test-extension',
      configuration: {
        tests: {
          command: 'npm test',
        },
      },
      build: mockBuild,
      ...overrides,
    } as any
  }

  const createMockExtensionWithoutTests = (overrides: Partial<ExtensionInstance> = {}): ExtensionInstance => {
    const mockBuild = vi.fn().mockResolvedValue(undefined)
    return {
      localIdentifier: 'no-test-extension',
      outputPrefix: '[no-test-extension]',
      directory: '/app/extensions/no-test-extension',
      configuration: {},
      build: mockBuild,
      ...overrides,
    } as any
  }

  test('handles empty extensions array', async () => {
    // When
    await runExtensionTests([], {
      stdout: mockStdout,
      stderr: mockStderr,
      app: mockApp,
    })

    // Then
    expect(outputInfo).toHaveBeenCalledWith('ℹ️  No extensions provided for testing')
  })

  test('handles extensions with no test commands', async () => {
    // Given
    const extension = createMockExtensionWithoutTests()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      app: mockApp,
    })

    // Then
    expect(outputInfo).toHaveBeenCalledWith('ℹ️  No extensions with test commands found')
    expect(outputInfo).toHaveBeenCalledWith(
      '   Add [extensions.tests] command = "your-test-command" to your extension TOML files to enable testing',
    )
  })

  test('runs test for single extension with test command', async () => {
    // Given
    const extension = createMockExtension()
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      app: mockApp,
    })

    // Then
    expect(extension.build).toHaveBeenCalledWith({
      stdout: mockStdout,
      stderr: mockStderr,
      app: mockApp,
      environment: 'production',
    })
    expect(exec).toHaveBeenCalledWith('sh', ['-c', 'npm test'], {
      cwd: '/app/extensions/test-extension',
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
    })
  })

  test('runs tests for multiple extensions in parallel', async () => {
    // Given
    const ext1 = createMockExtension({
      localIdentifier: 'ext1',
      directory: '/app/extensions/ext1',
    })
    const ext2 = createMockExtension({
      localIdentifier: 'ext2',
      directory: '/app/extensions/ext2',
    })
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([ext1, ext2], {
      stdout: mockStdout,
      stderr: mockStderr,
      app: mockApp,
    })

    // Then
    expect(outputInfo).toHaveBeenCalledWith('🧪 Found 2 extension(s) with test commands')
    expect(outputInfo).toHaveBeenCalledWith('✅ All extension tests completed')
    expect(ext1.build).toHaveBeenCalled()
    expect(ext2.build).toHaveBeenCalled()
    expect(exec).toHaveBeenCalledTimes(2)
  })

  test('skips build when skipBuild flag is true', async () => {
    // Given
    const extension = createMockExtension()
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      skipBuild: true,
      app: mockApp,
    })

    // Then
    expect(extension.build).not.toHaveBeenCalled()
    expect(exec).toHaveBeenCalledWith('sh', ['-c', 'npm test'], {
      cwd: '/app/extensions/test-extension',
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
    })
  })

  test('skips build when no app context is available', async () => {
    // Given
    const extension = createMockExtension()
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
    })

    // Then
    expect(extension.build).not.toHaveBeenCalled()
    expect(exec).toHaveBeenCalledWith('sh', ['-c', 'npm test'], {
      cwd: '/app/extensions/test-extension',
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
    })
  })

  test('filters extensions that have test commands', async () => {
    // Given
    const extWithTests = createMockExtension({localIdentifier: 'with-tests'})
    const extWithoutTests = createMockExtensionWithoutTests({localIdentifier: 'without-tests'})
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extWithTests, extWithoutTests], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      app: mockApp,
    })

    // Then
    expect(extWithTests.build).toHaveBeenCalled()
    // Should not build extensions without tests
    expect(extWithoutTests.build).not.toHaveBeenCalled()
    // Only one extension should run tests
    expect(exec).toHaveBeenCalledTimes(1)
  })

  test('does not build extension when no test command is configured', async () => {
    // Given
    const extensionWithoutTests = createMockExtensionWithoutTests()

    // When
    await runExtensionTests([extensionWithoutTests], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      app: mockApp,
    })

    // Then
    expect(extensionWithoutTests.build).not.toHaveBeenCalled()
    expect(exec).not.toHaveBeenCalled()
  })

  test('propagates test command failures', async () => {
    // Given
    const extension = createMockExtension()
    const testError = new Error('Test failed')
    vi.mocked(exec).mockRejectedValue(testError)

    // When/Then
    await expect(
      runExtensionTests([extension], {
        stdout: mockStdout,
        stderr: mockStderr,
        app: mockApp,
      }),
    ).rejects.toThrow('Test command failed for test-extension: Test failed')
  })

  test('shows proper output messages for single extension', async () => {
    // Given
    const extension = createMockExtension()
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      app: mockApp,
    })

    // Then
    expect(outputInfo).toHaveBeenCalledWith('🧪 Found 1 extension(s) with test commands')
    expect(outputInfo).toHaveBeenCalledWith('✅ All extension tests completed')
  })

  test('uses custom signal for test execution', async () => {
    // Given
    const extension = createMockExtension()
    vi.mocked(exec).mockResolvedValue()

    // When
    await runExtensionTests([extension], {
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
      app: mockApp,
    })

    // Then
    expect(exec).toHaveBeenCalledWith('sh', ['-c', 'npm test'], {
      cwd: '/app/extensions/test-extension',
      stdout: mockStdout,
      stderr: mockStderr,
      signal: mockSignal,
    })
  })
})
