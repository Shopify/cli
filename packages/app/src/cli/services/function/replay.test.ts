import {FunctionRunData, replay} from './replay.js'
import {renderReplay} from './ui.js'
import {runFunction} from './runner.js'
import {testAppLinked, testFunctionExtension} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, beforeAll, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {testWithTempDir} from '@shopify/cli-kit/node/testing/test-with-temp-dir'

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
      wasm_opt: true,
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

  testWithTempDir('runs selected function', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const file1 = createFunctionRunFile({handle: extension.handle, index: 1})
    const file2 = createFunctionRunFile({handle: extension.handle, index: 2})
    await writeFunctionRunFiles(logsDir, [file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app,
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith([file2.run, file1.run])
    expectFunctionRun(extension, file1.run.payload.input)
    expect(outputInfo).not.toHaveBeenCalled()
  })

  testWithTempDir('only allows selection of the most recent 100 runs', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const files = new Array(101)
      .fill(undefined)
      .map((_, i) => createFunctionRunFile({handle: extension.handle, index: i}))
    await writeFunctionRunFiles(logsDir, files)
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(files[100]!.run)

    // When
    await replay({
      app,
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

  testWithTempDir('does not allow selection of runs for other functions', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const file1 = createFunctionRunFile({handle: extension.handle, index: 1})
    const file2 = createFunctionRunFile({handle: 'another-function-handle', index: 2})
    await writeFunctionRunFiles(logsDir, [file1, file2])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file1.run)

    // When
    await replay({
      app,
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: false,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith([file1.run])
  })

  testWithTempDir('throws error if no logs available', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    await mkdir(logsDir)

    // When/Then
    await expect(async () => {
      await replay({
        app,
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
      })
    }).rejects.toThrow(new AbortError(`No logs found in ${logsDir}`))
  })

  testWithTempDir('throws error if log directory does not exist', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    // logsDir does not exist

    // When/Then
    await expect(async () => {
      await replay({
        app,
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
      })
    }).rejects.toThrow(new AbortError(`No logs found in ${logsDir}`))
  })

  testWithTempDir('delegates to renderReplay when watch is true', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const file = createFunctionRunFile({handle: extension.handle})
    await writeFunctionRunFiles(logsDir, [file])
    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)

    vi.mocked(renderReplay)

    // When
    await replay({
      app,
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })

    expect(renderReplay).toHaveBeenCalledOnce()
  })

  testWithTempDir('aborts on error', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const file = createFunctionRunFile({handle: extension.handle})
    await writeFunctionRunFiles(logsDir, [file])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(file.run)
    vi.mocked(renderReplay).mockRejectedValueOnce('failure')

    // When
    await expect(async () =>
      replay({
        app,
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

  testWithTempDir('runs the log specified by the --log flag for the current function', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const identifier = '000000'
    const file1 = createFunctionRunFile({handle: extension.handle, index: 1})
    const file2 = createFunctionRunFile({handle: extension.handle, identifier, index: 2})
    const file3 = createFunctionRunFile({handle: extension.handle, index: 3})
    const file4 = createFunctionRunFile({handle: 'another-extension', identifier, index: 4})
    await writeFunctionRunFiles(logsDir, [file1, file2, file3, file4])

    // When
    await replay({
      app,
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

  testWithTempDir('throws error if the log specified by the --log flag is not found', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const identifier = '000000'
    const file1 = createFunctionRunFile({handle: extension.handle, index: 1})
    const file2 = createFunctionRunFile({handle: extension.handle, index: 2})
    await writeFunctionRunFiles(logsDir, [file1, file2])

    // When
    await expect(async () =>
      replay({
        app,
        extension,
        stdout: false,
        path: 'test-path',
        json: true,
        watch: false,
        log: identifier,
      }),
    ).rejects.toThrow()
  })

  testWithTempDir('ignores runs with no input and keeps reading chunks until past the threshold', async ({tempDir}) => {
    // Given
    const app = testAppLinked({directory: tempDir})
    const logsDir = app.getLogsDir()
    const filesWithInput = new Array(99)
      .fill(undefined)
      .map((_, i) => createFunctionRunFile({handle: extension.handle, index: i}))
    const fileWithoutInput = createFunctionRunFile({handle: extension.handle, partialPayload: {input: null}, index: 99})
    const additionalFiles = new Array(199)
      .fill(undefined)
      .map((_, i) => createFunctionRunFile({handle: extension.handle, index: 100 + i}))

    await writeFunctionRunFiles(logsDir, [...filesWithInput, fileWithoutInput, ...additionalFiles])

    vi.mocked(selectFunctionRunPrompt).mockResolvedValue(filesWithInput[0]!.run)

    // When
    await replay({
      app,
      extension,
      stdout: false,
      path: 'test-path',
      json: true,
      watch: true,
    })

    // Then
    expect(selectFunctionRunPrompt).toHaveBeenCalledWith(
      [...additionalFiles.reverse(), ...filesWithInput.reverse()].slice(0, 100).map(({run}) => run),
    )
  })
})

interface FunctionRunFileOptions {
  handle: string
  identifier?: string
  partialPayload?: object
  index?: number
}
function createFunctionRunFile(options: FunctionRunFileOptions) {
  const handle = options.handle
  const identifier = options.identifier ?? randomUUID().substring(0, 6)
  const partialPayload = options.partialPayload ?? {}
  const index = options.index ?? 0
  const seconds = index.toString().padStart(6, '0')
  const path = `20240522_00${seconds}_827Z_extensions_${handle}_${identifier}.json`
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

async function writeFunctionRunFiles(logsDir: string, data: {run: FunctionRunData; path: string}[]) {
  await mkdir(logsDir)
  for (const file of data) {
    // eslint-disable-next-line no-await-in-loop
    await writeFile(joinPath(logsDir, file.path), JSON.stringify(file.run))
  }
}
