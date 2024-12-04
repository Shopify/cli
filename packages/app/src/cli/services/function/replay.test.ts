import {FunctionRunData, replay} from './replay.js'
import {renderReplay} from './ui.js'
import {runFunction} from './runner.js'
import {testAppLinked, testFunctionExtension} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {readFile} from '@shopify/cli-kit/node/fs'
import {describe, expect, beforeAll, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {readdirSync} from 'fs'

vi.mock('fs')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../generate-schema.js')
vi.mock('../../prompts/function/replay.js')
vi.mock('../dev/extension/bundler.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./ui.js')
vi.mock('./runner.js')

describe('replay', () => {
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

  test('runs selected function', async () => {
    // Given
    const file1 = createFunctionRunFile({handle: extension.handle})
    const file2 = createFunctionRunFile({handle: extension.handle})
    mockFileOperations([file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app: testAppLinked(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith([file1.run, file2.run])
    expectFunctionRun(extension, file1.run.payload.input)
    expect(outputInfo).not.toHaveBeenCalled()
  })

  test('only allows selection of the most recent 100 runs', async () => {
    // Given
    const files = new Array(101).fill(undefined).map((_) => createFunctionRunFile({handle: extension.handle}))
    mockFileOperations(files)
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(files[100]!.run)

    // When
    await replay({
      app: testAppLinked(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith(files.map(({run}) => run).slice(0, 100))
  })

  test('does not allow selection of runs for other functions', async () => {
    // Given
    const file1 = createFunctionRunFile({handle: extension.handle})
    const file2 = createFunctionRunFile({handle: 'another-function-handle'})
    mockFileOperations([file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app: testAppLinked(),
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
        app: testAppLinked(),
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
      })
    }).rejects.toThrow()
  })

  test('delegates to renderReplay when watch is true', async () => {
    // Given
    const file = createFunctionRunFile({handle: extension.handle})
    mockFileOperations([file])
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    vi.mocked(renderReplay)

    // When
    await replay({
      app: testAppLinked(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })

    expect(renderReplay).toHaveBeenCalledOnce()
  })

  test('aborts on error', async () => {
    // Given
    const file = createFunctionRunFile({handle: extension.handle})
    mockFileOperations([file])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)
    vi.mocked(renderReplay).mockRejectedValueOnce('failure')

    // When
    await expect(async () =>
      replay({
        app: testAppLinked(),
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: true,
      }),
    ).rejects.toThrow()

    const abortSignal = vi.mocked(renderReplay).mock.calls[0]![0].abortController.signal

    // Then
    expect(abortSignal.aborted).toBeTruthy()
  })

  test('runs the log specified by the --log flag for the current function', async () => {
    // Given
    const identifier = '000000'
    const file1 = createFunctionRunFile({handle: extension.handle})
    const file2 = createFunctionRunFile({handle: extension.handle, identifier})
    const file3 = createFunctionRunFile({handle: extension.handle})
    const file4 = createFunctionRunFile({handle: 'another-extension', identifier})
    mockFileOperations([file1, file2, file3, file4])

    // When
    await replay({
      app: testAppLinked(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
      log: identifier,
    })

    // Then
    expectFunctionRun(extension, file2.run.payload.input)
  })

  test('throws error if the log specified by the --log flag is not found', async () => {
    // Given
    const identifier = '000000'
    const file1 = createFunctionRunFile({handle: extension.handle})
    const file2 = createFunctionRunFile({handle: extension.handle})
    mockFileOperations([file1, file2])

    // When
    await expect(async () =>
      replay({
        app: testAppLinked(),
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
        log: identifier,
      }),
    ).rejects.toThrow()
  })

  test('ignores runs with no input and keeps reading chunks until past the threshold', async () => {
    // Given
    const filesWithInput = new Array(99).fill(undefined).map((_) => createFunctionRunFile({handle: extension.handle}))
    const fileWithoutInput = createFunctionRunFile({handle: extension.handle, partialPayload: {input: null}})
    const additionalFiles = new Array(199).fill(undefined).map((_) => createFunctionRunFile({handle: extension.handle}))

    mockFileOperations([...filesWithInput, fileWithoutInput, ...additionalFiles])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(filesWithInput[0]!.run)

    // When
    await replay({
      app: testAppLinked(),
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith(
      [...filesWithInput, ...additionalFiles.slice(0, 100)].map(({run}) => run),
    )
  })
})

interface FunctionRunFileOptions {
  handle: string
  identifier?: string
  partialPayload?: object
}
function createFunctionRunFile(options: FunctionRunFileOptions) {
  const handle = options.handle
  const identifier = options.identifier ?? randomUUID().substring(0, 6)
  const partialPayload = options.partialPayload ?? {}
  const path = `20240522_150641_827Z_extensions_${handle}_${identifier}.json`
  const run: FunctionRunData = {
    identifier,
    shopId: 1,
    apiClientId: 1,
    logType: 'function_run',
    source: handle,
    sourceNamespace: 'extensions',
    logTimestamp: '2024-06-12T20:38:18.796Z',
    cursor: '2024-06-12T20:38:18.796Z',
    status: 'success',
    payload: {
      input: {identifier},
      export: 'run',
      fuelConsumed: 1,
      functionId: 'function-id',
      inputBytes: 1,
      logs: '',
      output: '',
      outputBytes: 1,
      ...partialPayload,
    },
  }

  return {run, path}
}

function expectFunctionRun(functionExtension: ExtensionInstance<FunctionConfigType>, input: unknown) {
  expect(runFunction).toHaveBeenCalledWith({functionExtension, json: true, export: 'run', input: JSON.stringify(input)})
}

function mockFileOperations(data: {run: FunctionRunData; path: string}[]) {
  vi.mocked(readdirSync).mockReturnValue([...data].reverse().map(({path}) => path) as any)
  vi.mocked(readFile).mockImplementation((path) => {
    const run = data.find((file) => path.endsWith(file.path))
    if (!run) {
      throw new AbortError(`Mock file not found: ${path}`)
    }
    return Promise.resolve(Buffer.from(JSON.stringify(run.run), 'utf8'))
  })
}
