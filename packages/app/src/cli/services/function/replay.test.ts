import {FunctionRunData, replay} from './replay.js'
import {testApp, testDeveloperPlatformClient, testFunctionExtension} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'
import {setupExtensionWatcher} from '../dev/extension/bundler.js'
import {exec} from '@shopify/cli-kit/node/system'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {readFile} from '@shopify/cli-kit/node/fs'
import {describe, expect, beforeAll, beforeEach, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {readdirSync} from 'fs'

vi.mock('fs')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../generate-schema.js')
vi.mock('../../prompts/function/replay.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../dev/extension/bundler.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('replay', () => {
  const developerPlatformClient = testDeveloperPlatformClient()
  const apiKey = 'apiKey'
  const defaultConfig = {
    name: 'MyFunction',
    type: 'product_discounts',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configuration_ui: true,
    api_version: '2022-07',
    metafields: [],
    handle: 'function-handle',
  }

  let extension: ExtensionInstance<FunctionConfigType>

  beforeAll(async () => {
    extension = await testFunctionExtension({config: defaultConfig})
  })

  beforeEach(() => {
    vi.mocked(ensureConnectedAppFunctionContext).mockResolvedValue({apiKey, developerPlatformClient})
  })

  test('runs selected function', async () => {
    // Given
    const file1 = createFunctionRunFile(extension.handle)
    const file2 = createFunctionRunFile(extension.handle)
    mockFileOperations([file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith([file2.run, file1.run])
    expectExecToBeCalledWithInput(file1.run.payload.input)
  })

  test('only allows selection of the most recent 100 runs', async () => {
    // Given
    const files = new Array(101).fill(undefined).map((_) => createFunctionRunFile(extension.handle))
    mockFileOperations(files)
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(files[100]!.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith(
      files
        .map(({run}) => run)
        .reverse()
        .slice(0, 100),
    )
  })

  test('does not allow selection of runs for other functions', async () => {
    // Given
    const file1 = createFunctionRunFile(extension.handle)
    const file2 = createFunctionRunFile('another-function-handle')
    mockFileOperations([file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith([file1.run])
  })

  test('throws error if no logs available', async () => {
    // Given

    // When/Then
    await expect(async () => {
      await replay({
        app: testApp(),
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
      })
    }).rejects.toThrow()
  })

  test('aborts on error', async () => {
    // Given
    const file = createFunctionRunFile(extension.handle)
    mockFileOperations([file])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)
    vi.mocked(setupExtensionWatcher).mockRejectedValueOnce('failure')

    // When
    await expect(async () =>
      replay({
        app: testApp(),
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: true,
      }),
    ).rejects.toThrow()
    const abortSignal = vi.mocked(setupExtensionWatcher).mock.calls[0]![0].signal

    // Then
    expect(abortSignal.aborted).toBeTruthy()
  })

  test('runs function once in watch mode without changes', async () => {
    // Given
    const file = createFunctionRunFile(extension.handle)
    mockFileOperations([file])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(exec).toHaveBeenCalledOnce()
    expectExecToBeCalledWithInput(file.run.payload.input)
  })

  test('file watcher onChange re-runs function', async () => {
    // Given
    const file = createFunctionRunFile(extension.handle)
    mockFileOperations([file])
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })
    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onChange()

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expectExecToBeCalledWithInput(file.run.payload.input)
    expect(exec).toHaveBeenCalledTimes(2)
  })

  test('renders fatal error in onReloadAndBuildError', async () => {
    // Given
    const expectedError = new AbortError('abort!')
    const file = createFunctionRunFile(extension.handle)
    mockFileOperations([file])
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })
    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(renderFatalError).toHaveBeenCalledWith(expectedError)
  })

  test('outputs non-fatal error in onReloadAndBuildError', async () => {
    // Given
    const expectedError = new Error('non-fatal error')
    const file = createFunctionRunFile(extension.handle)
    mockFileOperations([file])
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    // When
    await replay({
      app: testApp(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })
    await vi.mocked(setupExtensionWatcher).mock.calls[0]![0].onReloadAndBuildError(expectedError)

    // Then
    expect(setupExtensionWatcher).toHaveBeenCalledOnce()
    expect(outputWarn).toHaveBeenCalledWith(`Failed to replay function: ${expectedError.message}`)
  })
})

function createFunctionRunFile(handle: string) {
  const identifier = randomUUID().substring(0, 6)
  const path = `20240522_150641_827Z_extensions_${handle}_${identifier}.json`
  const run: FunctionRunData = {
    identifier,
    shop_id: 1,
    api_client_id: 1,
    log_type: 'function_run',
    source: handle,
    source_namespace: 'extensions',
    log_timestamp: '2024-06-12T20:38:18.796Z',
    cursor: '2024-06-12T20:38:18.796Z',
    status: 'success',
    payload: {
      input: {},
      export: 'run',
      fuel_consumed: 1,
      function_id: 'function-id',
      input_bytes: 1,
      logs: '',
      output: '',
      output_bytes: 1,
    },
  }

  return {run, path}
}

function expectExecToBeCalledWithInput(input: any) {
  expect(exec).toHaveBeenCalledWith(
    'npm',
    [
      'exec',
      '--',
      'function-runner',
      '-f',
      '/tmp/project/extensions/my-function/dist/index.wasm',
      '--json',
      '--export',
      'run',
    ],
    {
      cwd: '/tmp/project/extensions/my-function',
      stdout: 'inherit',
      stderr: 'inherit',
      input: JSON.stringify(input),
    },
  )
}

function mockFileOperations(data: {run: FunctionRunData; path: string}[]) {
  vi.mocked(readdirSync).mockReturnValue(data.map(({path}) => path) as any)
  data.forEach(({run}) => vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(run) as any))
}
