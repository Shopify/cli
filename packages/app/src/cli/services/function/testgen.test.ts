import {testgen} from './testgen.js'
import {testAppLinked} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/select-run.js'
import {nameFixturePrompt} from '../../prompts/function/name-fixture.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {existsSync, readdirSync} from 'fs'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/logs')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('fs')
vi.mock('../../prompts/function/select-run.js')
vi.mock('../../prompts/function/name-fixture.js')

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)
const mockGetLogsDir = vi.mocked(getLogsDir)
const mockJoinPath = vi.mocked(joinPath)
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockSelectFunctionRunPrompt = vi.mocked(selectFunctionRunPrompt)
const mockNameFixturePrompt = vi.mocked(nameFixturePrompt)

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

  const mockDefaultTestContent = '// Default test content'

  beforeEach(() => {
    mockGetLogsDir.mockReturnValue('/logs')
    mockJoinPath.mockImplementation((...args) => args.join('/'))
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['20240101_000000_000Z_extensions_test-function_abcdef.json'] as any)
    mockReadFile.mockResolvedValue(JSON.stringify(mockFunctionRunData) as any)
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockSelectFunctionRunPrompt.mockResolvedValue(mockFunctionRunData)
    mockNameFixturePrompt.mockResolvedValue('test-fixture')

    // Mock process.cwd() for default test file path
    vi.spyOn(process, 'cwd').mockReturnValue('/workspace')
  })

  test('generates test fixture with default test file', async () => {
    // Mock that tests directory doesn't exist initially
    mockExistsSync.mockImplementation((path) => {
      if (path === '/test/path/tests') return false
      if (path === '/test/path/tests/fixtures') return false
      if (path === '/test/path/tests/default.test.ts') return false
      return true
    })

    // Mock default test file content
    mockReadFile.mockImplementation((path) => {
      if (path === '/packages/app/src/cli/templates/function/default.test.ts.template') {
        return Promise.resolve(mockDefaultTestContent) as any
      }
      return Promise.resolve(JSON.stringify(mockFunctionRunData)) as any
    })

    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
      log: 'abcdef',
    })

    // Should create tests directory
    expect(mockMkdir).toHaveBeenCalledWith('/test/path/tests')

    // Should create fixtures directory
    expect(mockMkdir).toHaveBeenCalledWith('/test/path/tests/fixtures')

    // Should create default test file
    expect(mockReadFile).toHaveBeenCalledWith(
      '/packages/app/src/cli/templates/function/default.test.ts.template',
    )
    expect(mockWriteFile).toHaveBeenCalledWith('/test/path/tests/default.test.ts', mockDefaultTestContent)

    // Should create fixture file with correct format
    const expectedFixture = {
      name: 'test-fixture',
      export: 'run',
      query: 'run.graphql',
      input: {test: 'input'},
      output: {test: 'output'},
    }
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/test/path/tests/fixtures/test-fixture.json',
      JSON.stringify(expectedFixture, null, 2),
    )

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'abcdef',
      input: {test: 'input'},
      output: {test: 'output'},
    })
  })

  test('uses existing test directories when they exist', async () => {
    // Mock that all directories already exist
    mockExistsSync.mockImplementation((path) => {
      if (path === '/test/path/tests') return true
      if (path === '/test/path/tests/fixtures') return true
      if (path === '/test/path/tests/default.test.ts') return true
      return true
    })

    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
      log: 'abcdef',
    })

    // Should not create directories that already exist
    expect(mockMkdir).not.toHaveBeenCalled()

    // Should not create default test file if it exists
    expect(mockReadFile).not.toHaveBeenCalledWith(
      '/packages/app/src/cli/templates/function/default.test.ts.template',
    )
    expect(mockWriteFile).not.toHaveBeenCalledWith('/test/path/tests/default.test.ts', expect.any(String))

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'abcdef',
      input: {test: 'input'},
      output: {test: 'output'},
    })
  })

  test('handles undefined payload with default values', async () => {
    const mockFunctionRunDataWithoutPayload = {
      ...mockFunctionRunData,
      payload: undefined,
    }

    mockReadFile.mockResolvedValue(JSON.stringify(mockFunctionRunDataWithoutPayload) as any)

    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
      log: 'abcdef',
    })

    const expectedFixture = {
      name: 'test-fixture',
      export: 'run',
      query: 'run.graphql',
      input: {},
      output: {},
    }
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/test/path/tests/fixtures/test-fixture.json',
      JSON.stringify(expectedFixture, null, 2),
    )

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'abcdef',
      input: {},
      output: {},
    })
  })

  test('uses selector prompt when no log identifier provided', async () => {
    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
    })

    expect(mockSelectFunctionRunPrompt).toHaveBeenCalledWith(
      [mockFunctionRunData],
      'Which function run would you like to generate test files from?',
    )
    expect(mockNameFixturePrompt).toHaveBeenCalledWith('abcdef')

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'abcdef',
      input: {test: 'input'},
      output: {test: 'output'},
    })
  })

  test('returns default run data when selector prompt returns undefined', async () => {
    mockSelectFunctionRunPrompt.mockResolvedValue(undefined)

    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
    })

    expect(mockNameFixturePrompt).toHaveBeenCalledWith('default')

    const expectedFixture = {
      name: 'test-fixture',
      export: 'run',
      query: 'run.graphql',
      input: {},
      output: {},
    }
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/test/path/tests/fixtures/test-fixture.json',
      JSON.stringify(expectedFixture, null, 2),
    )

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'default',
      input: {},
      output: {},
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

  test('handles empty function runs directory gracefully', async () => {
    mockReaddirSync.mockReturnValue([] as any)
    mockSelectFunctionRunPrompt.mockResolvedValue(undefined)

    const result = await testgen({
      app: mockApp,
      extension: mockExtension,
      path: '/test/path',
    })

    expect(result).toEqual({
      testsDir: '/test/path/tests',
      fixturePath: '/test/path/tests/fixtures/test-fixture.json',
      fixtureName: 'test-fixture',
      identifier: 'default',
      input: {},
      output: {},
    })
  })
})
