import {describe, expect, test, vi, beforeEach} from 'vitest'
import {testgen} from './testgen.js'
import {testAppLinked} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {existsSync, readdirSync} from 'fs'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/logs')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('fs')

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)
const mockGetLogsDir = vi.mocked(getLogsDir)
const mockJoinPath = vi.mocked(joinPath)
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)

describe('testgen', () => {
  const mockApp = testAppLinked({
    configuration: {
      client_id: 'test-client-id',
      path: '/test/path/shopify.app.toml',
    },
  })

  const mockExtension: ExtensionInstance<FunctionConfigType> = {
    handle: 'test-function',
    directory: '/test/path',
  } as ExtensionInstance<FunctionConfigType>

  const mockFunctionRunData = {
    shopId: 123,
    apiClientId: 456,
    payload: {
      input: {test: 'input'},
      inputBytes: 100,
      output: {test: 'output'},
      outputBytes: 200,
      functionId: 'test-function-id',
      export: 'run',
      logs: 'test logs',
      fuelConsumed: 50,
    },
    logType: 'function',
    cursor: 'test-cursor',
    status: 'success',
    source: 'test-source',
    sourceNamespace: 'extensions',
    logTimestamp: '2024-01-01T00:00:00Z',
    identifier: 'abcdef',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLogsDir.mockReturnValue('/logs')
    mockJoinPath.mockImplementation((...args) => args.join('/'))
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['20240101_000000_000Z_extensions_test-function_abcdef.json'] as any)
    mockReadFile.mockResolvedValue(JSON.stringify(mockFunctionRunData) as any)
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
  })

  test('generates test files with default output directory', async () => {
    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
      log: 'abcdef',
    })

    expect(mockMkdir).toHaveBeenCalledWith('test-abcdef')
    expect(mockWriteFile).toHaveBeenCalledWith(
      'test-abcdef/input.json',
      JSON.stringify(mockFunctionRunData.payload.input, null, 2),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      'test-abcdef/output.json',
      JSON.stringify(mockFunctionRunData.payload.output, null, 2),
    )
    expect(result).toEqual({
      outputDir: 'test-abcdef',
      identifier: 'abcdef',
      input: mockFunctionRunData.payload.input,
      output: mockFunctionRunData.payload.output,
    })
  })

  test('generates test files with custom output directory', async () => {
    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
      log: 'abcdef',
      outputDir: 'custom-test-dir',
    })

    expect(mockMkdir).toHaveBeenCalledWith('custom-test-dir')
    expect(mockWriteFile).toHaveBeenCalledWith(
      'custom-test-dir/input.json',
      JSON.stringify(mockFunctionRunData.payload.input, null, 2),
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      'custom-test-dir/output.json',
      JSON.stringify(mockFunctionRunData.payload.output, null, 2),
    )
    expect(result).toEqual({
      outputDir: 'custom-test-dir',
      identifier: 'abcdef',
      input: mockFunctionRunData.payload.input,
      output: mockFunctionRunData.payload.output,
    })
  })

  test('throws error when log identifier not found', async () => {
    mockReaddirSync.mockReturnValue([] as any)

    await expect(
      testgen({
        app: mockApp,
        extension: mockExtension,
        path: '/test/path',
        log: 'nonexistent',
      }),
    ).rejects.toThrow(AbortError)
  })

  test('throws error when function runs directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([] as any)

    await expect(
      testgen({
        app: mockApp,
        extension: mockExtension,
        path: '/test/path',
      }),
    ).rejects.toThrow(AbortError)
  })
})
