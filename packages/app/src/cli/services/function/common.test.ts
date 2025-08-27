import {
  getOrGenerateSchemaPath,
  chooseFunction,
  parseLogFilename,
  getAllFunctionRunFileNames,
  getIdentifierFromFilename,
  getFunctionRunData,
  findFunctionRun,
  getRunFromIdentifier,
  FunctionRunData,
} from './common.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganization,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {generateSchemaService} from '../generate-schema.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {linkedAppContext} from '../app-context.js'
import {describe, vi, expect, beforeEach, test} from 'vitest'
import {renderAutocompletePrompt, renderFatalError} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {existsSync, readdirSync} from 'fs'

vi.mock('../app-context.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/logs')
vi.mock('../generate-schema.js')
vi.mock('fs')

let app: AppLinkedInterface
let ourFunction: ExtensionInstance

const mockReadFile = vi.mocked(readFile)
const mockGetLogsDir = vi.mocked(getLogsDir)
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)

beforeEach(async () => {
  ourFunction = await testFunctionExtension()
  app = testAppLinked({allExtensions: [ourFunction]})
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    specifications: [],
    organization: testOrganization(),
  })
  vi.mocked(renderFatalError).mockReturnValue('')
  vi.mocked(renderAutocompletePrompt).mockResolvedValue(ourFunction)
  vi.mocked(isTerminalInteractive).mockReturnValue(true)

  mockGetLogsDir.mockReturnValue('/logs')
  mockExistsSync.mockReturnValue(true)
  mockReaddirSync.mockReturnValue([])
  mockReadFile.mockResolvedValue(Buffer.from('{}'))
})

describe('getOrGenerateSchemaPath', () => {
  let extension: ExtensionInstance<FunctionConfigType>
  let app: AppLinkedInterface
  let developerPlatformClient: DeveloperPlatformClient
  beforeEach(() => {
    extension = {
      directory: '/path/to/function',
      configuration: {},
    } as ExtensionInstance<FunctionConfigType>

    app = testAppLinked()
    developerPlatformClient = testDeveloperPlatformClient()
  })

  test('returns the path if the schema file exists', async () => {
    // Given
    const expectedPath = joinPath(extension.directory, 'schema.graphql')
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    // Pass extension, app.directory, clientId, forceRelink, userProvidedConfigName
    const result = await getOrGenerateSchemaPath(extension, app.directory, '123', false, undefined)

    // Then
    expect(result).toBe(expectedPath)
    expect(fileExists).toHaveBeenCalledWith(expectedPath)
  })

  test('generates the schema file if it does not exist', async () => {
    // Given
    const expectedPath = joinPath(extension.directory, 'schema.graphql')
    vi.mocked(fileExists).mockResolvedValueOnce(false)
    vi.mocked(fileExists).mockResolvedValueOnce(true)

    vi.mocked(generateSchemaService).mockResolvedValueOnce()

    // When
    // Pass extension, app.directory, clientId, forceRelink, userProvidedConfigName
    const result = await getOrGenerateSchemaPath(extension, app.directory, '123', false, undefined)

    // Then
    expect(result).toBe(expectedPath)
    expect(fileExists).toHaveBeenCalledWith(expectedPath)
  })
})

describe('chooseFunction', () => {
  let app: AppLinkedInterface
  let functionExtension1: ExtensionInstance
  let functionExtension2: ExtensionInstance
  let nonFunctionExtension: ExtensionInstance

  beforeEach(async () => {
    functionExtension1 = await testFunctionExtension({
      dir: '/path/to/app/extensions/function-1',
      config: {
        name: 'function-1',
        type: 'product_discounts',
        description: 'Test function 1',
        build: {
          command: 'echo "hello world"',
          watch: ['src/**/*.rs'],
          wasm_opt: true,
        },
        api_version: '2022-07',
        configuration_ui: true,
      },
    })

    functionExtension2 = await testFunctionExtension({
      dir: '/path/to/app/extensions/function-2',
      config: {
        name: 'function-2',
        type: 'product_discounts',
        description: 'Test function 2',
        build: {
          command: 'echo "hello world"',
          watch: ['src/**/*.rs'],
          wasm_opt: true,
        },
        api_version: '2022-07',
        configuration_ui: true,
      },
    })

    nonFunctionExtension = {
      directory: '/path/to/app/extensions/theme',
      isFunctionExtension: false,
      handle: 'theme-extension',
    } as ExtensionInstance
  })

  test('returns the function when path matches a function directory', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2, nonFunctionExtension]})

    // When
    const result = await chooseFunction(app, '/path/to/app/extensions/function-1')

    // Then
    expect(result).toBe(functionExtension1)
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('returns the only function when app has single function and path does not match', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, nonFunctionExtension]})

    // When
    const result = await chooseFunction(app, '/some/other/path')

    // Then
    expect(result).toBe(functionExtension1)
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('prompts user to select function when multiple functions exist and path does not match', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2, nonFunctionExtension]})
    vi.mocked(isTerminalInteractive).mockReturnValue(true)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(functionExtension2)

    // When
    const result = await chooseFunction(app, '/some/other/path')

    // Then
    expect(result).toBe(functionExtension2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which function?',
      choices: [
        {label: functionExtension1.handle, value: functionExtension1},
        {label: functionExtension2.handle, value: functionExtension2},
      ],
    })
  })

  test('throws error when terminal is not interactive and cannot determine function', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2]})
    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When/Then
    await expect(chooseFunction(app, '/some/other/path')).rejects.toThrowError(
      'Run this command from a function directory or use `--path` to specify a function directory.',
    )
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('filters out non-function extensions', async () => {
    // Given
    app = testAppLinked({allExtensions: [nonFunctionExtension]})
    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When/Then
    await expect(chooseFunction(app, '/some/path')).rejects.toThrowError(
      'Run this command from a function directory or use `--path` to specify a function directory.',
    )
  })
})

describe('parseLogFilename', () => {
  test('parses valid log filename correctly', () => {
    // Given
    const filename = '20240522_150641_827Z_extensions_my-function_abcdef.json'

    // When
    const result = parseLogFilename(filename)

    // Then
    expect(result).toEqual({
      namespace: 'extensions',
      functionHandle: 'my-function',
      identifier: 'abcdef',
    })
  })

  test('returns undefined for invalid filename format', () => {
    // Given
    const invalidFilenames = [
      'invalid.json',
      '20240522_150641_827Z_extensions.json',
      'extensions_my-function_abcdef.json',
    ]

    // When/Then
    invalidFilenames.forEach((filename) => {
      expect(parseLogFilename(filename)).toBeUndefined()
    })
  })
})

describe('getAllFunctionRunFileNames', () => {
  test('returns empty array when directory does not exist', () => {
    // Given
    mockExistsSync.mockReturnValue(false)

    // When
    const result = getAllFunctionRunFileNames('/nonexistent/dir')

    // Then
    expect(result).toEqual([])
    expect(mockExistsSync).toHaveBeenCalledWith('/nonexistent/dir')
  })

  test('returns file names when directory exists', () => {
    // Given
    const mockFiles = ['file1.json', 'file2.json', 'file3.json']
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(mockFiles as any)

    // When
    const result = getAllFunctionRunFileNames('/existing/dir')

    // Then
    expect(result).toEqual(mockFiles)
    expect(mockExistsSync).toHaveBeenCalledWith('/existing/dir')
    expect(mockReaddirSync).toHaveBeenCalledWith('/existing/dir')
  })
})

describe('getIdentifierFromFilename', () => {
  test('extracts identifier from valid filename', () => {
    // Given
    const filename = '20240522_150641_827Z_extensions_my-function_abcdef.json'

    // When
    const result = getIdentifierFromFilename(filename)

    // Then
    expect(result).toBe('abcdef')
  })

  test('handles filename with no underscores', () => {
    // Given
    const filename = 'invalid'

    // When
    const result = getIdentifierFromFilename(filename)

    // Then
    expect(result).toBe('invali')
  })

  test('handles filename with multiple underscores', () => {
    // Given
    const filename = '20240522_150641_827Z_extensions_my_function_abcdef.json'

    // When
    const result = getIdentifierFromFilename(filename)

    // Then
    expect(result).toBe('abcdef')
  })
})

describe('getFunctionRunData', () => {
  const mockFunctionRunData: FunctionRunData = {
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
    source: 'test-function',
    sourceNamespace: 'extensions',
    logTimestamp: '2024-01-01T00:00:00Z',
    identifier: 'abcdef',
  }

  test('returns filtered function run data', async () => {
    // Given
    const mockFiles = ['20240522_150641_827Z_extensions_test-function_abcdef.json']
    mockReaddirSync.mockReturnValue(mockFiles as any)
    mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockFunctionRunData)))

    // When
    const result = await getFunctionRunData('/logs/test-client', 'test-function')

    // Then
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      ...mockFunctionRunData,
      identifier: 'abcdef',
    })
  })

  test('filters out runs with null input', async () => {
    // Given
    const mockFiles = ['20240522_150641_827Z_extensions_test-function_abcdef.json']
    const runWithNullInput = {...mockFunctionRunData, payload: {...mockFunctionRunData.payload, input: null}}
    mockReaddirSync.mockReturnValue(mockFiles as any)
    mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(runWithNullInput)))

    // When
    const result = await getFunctionRunData('/logs/test-client', 'test-function')

    // Then
    expect(result).toHaveLength(0)
  })

  test('respects LOG_SELECTOR_LIMIT', async () => {
    // Given
    const mockFiles = Array.from(
      {length: 150},
      (_, i) => `20240522_150641_827Z_extensions_test-function_${i.toString().padStart(6, '0')}.json`,
    )
    mockReaddirSync.mockReturnValue(mockFiles as any)
    mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockFunctionRunData)))

    // When
    const result = await getFunctionRunData('/logs/test-client', 'test-function')

    // Then
    expect(result).toHaveLength(100)
  })
})

describe('findFunctionRun', () => {
  test('finds function run by identifier', async () => {
    // Given
    const mockFiles = ['20240522_150641_827Z_extensions_test-function_abcdef.json']
    mockReaddirSync.mockReturnValue(mockFiles as any)

    // When
    const result = await findFunctionRun('/logs/test-client', 'test-function', 'abcdef')

    // Then
    expect(result).toBe('/logs/test-client/20240522_150641_827Z_extensions_test-function_abcdef.json')
  })

  test('returns undefined when function run not found', async () => {
    // Given
    const mockFiles = ['20240522_150641_827Z_extensions_test-function_abcdef.json']
    mockReaddirSync.mockReturnValue(mockFiles as any)

    // When
    const result = await findFunctionRun('/logs/test-client', 'test-function', 'nonexistent')

    // Then
    expect(result).toBeUndefined()
  })

  test('filters by correct function handle', async () => {
    // Given
    const mockFiles = [
      '20240522_150641_827Z_extensions_test-function_abcdef.json',
      '20240522_150641_827Z_extensions_other-function_abcdef.json',
    ]
    mockReaddirSync.mockReturnValue(mockFiles as any)

    // When
    const result = await findFunctionRun('/logs/test-client', 'test-function', 'abcdef')

    // Then
    expect(result).toBe('/logs/test-client/20240522_150641_827Z_extensions_test-function_abcdef.json')
  })
})

describe('getRunFromIdentifier', () => {
  test('returns function run data when found', async () => {
    // Given
    const mockFunctionRunData: FunctionRunData = {
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
      source: 'test-function',
      sourceNamespace: 'extensions',
      logTimestamp: '2024-01-01T00:00:00Z',
      identifier: 'abcdef',
    }

    const mockFiles = ['20240522_150641_827Z_extensions_test-function_abcdef.json']
    mockReaddirSync.mockReturnValue(mockFiles as any)
    mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockFunctionRunData)))

    // When
    const result = await getRunFromIdentifier('/logs/test-client', 'test-function', 'abcdef')

    // Then
    expect(result).toEqual({
      ...mockFunctionRunData,
      identifier: 'abcdef',
    })
  })

  test('throws error when function run not found', async () => {
    // Given
    mockReaddirSync.mockReturnValue([] as any)

    // When/Then
    await expect(getRunFromIdentifier('/logs/test-client', 'test-function', 'nonexistent')).rejects.toThrow(
      "No log found for 'nonexistent'",
    )
  })
})
