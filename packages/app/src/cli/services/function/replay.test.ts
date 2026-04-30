import {FunctionRunData, replay} from './replay.js'
import {renderReplay} from './ui.js'
import {runFunction} from './runner.js'
import {testAppLinked, testFunctionExtension} from '../../models/app/app.test-data.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'

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

  async function runTest(
    callback: (args: {
      extension: ExtensionInstance<FunctionConfigType>
      app: AppLinkedInterface
      functionRunsDir: string
    }) => Promise<void>,
  ) {
    fileCounter = 0
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await testFunctionExtension({
        config: defaultConfig,
        dir: joinPath(tmpDir, 'extensions', 'my-function'),
      })
      const app = testAppLinked({directory: tmpDir})
      const functionRunsDir = app.getLogsDir()
      await mkdir(functionRunsDir)

      await callback({extension, app, functionRunsDir})
    })
  }

  test('runs selected function', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const file1 = createFunctionRunFile({handle: extension.handle})
      const file2 = createFunctionRunFile({handle: extension.handle})
      await writeFiles(functionRunsDir, [file1, file2])

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
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(normalizeRuns([file1.run, file2.run]))
      expectFunctionRun(extension, file1.run.payload.input)
      expect(outputInfo).not.toHaveBeenCalled()
    })
  })

  test('only allows selection of the most recent 100 runs', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const files = new Array(101).fill(undefined).map((_) => createFunctionRunFile({handle: extension.handle}))
      await writeFiles(functionRunsDir, files)
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
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(normalizeRuns(files.map(({run}) => run).slice(0, 100)))
    })
  })

  test('does not allow selection of runs for other functions', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const file1 = createFunctionRunFile({handle: extension.handle})
      const file2 = createFunctionRunFile({handle: 'another-function-handle'})
      await writeFiles(functionRunsDir, [file1, file2])

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
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(normalizeRuns([file1.run]))
    })
  })

  test('throws error if no logs available', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
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
      }).rejects.toThrow(new AbortError(`No logs found in ${functionRunsDir}`))
    })
  })

  test('throws error if log directory does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await testFunctionExtension({config: defaultConfig})
      const app = testAppLinked({directory: tmpDir})
      const functionRunsDir = app.getLogsDir()

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
      }).rejects.toThrow(new AbortError(`No logs found in ${functionRunsDir}`))
    })
  })

  test('delegates to renderReplay when watch is true', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const file = createFunctionRunFile({handle: extension.handle})
      await writeFiles(functionRunsDir, [file])
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
  })

  test('aborts on error', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const file = createFunctionRunFile({handle: extension.handle})
      await writeFiles(functionRunsDir, [file])

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
  })

  test('runs the log specified by the --log flag for the current function', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const identifier = '000000'
      const file1 = createFunctionRunFile({handle: extension.handle})
      const file2 = createFunctionRunFile({handle: extension.handle, identifier})
      const file3 = createFunctionRunFile({handle: extension.handle})
      const file4 = createFunctionRunFile({handle: 'another-extension', identifier})
      await writeFiles(functionRunsDir, [file1, file2, file3, file4])

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
  })

  test('throws error if the log specified by the --log flag is not found', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      const identifier = '000000'
      const file1 = createFunctionRunFile({handle: extension.handle})
      const file2 = createFunctionRunFile({handle: extension.handle})
      await writeFiles(functionRunsDir, [file1, file2])

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
  })

  test('ignores runs with no input and keeps reading chunks until past the threshold', async () => {
    await runTest(async ({extension, app, functionRunsDir}) => {
      // Given
      // To ensure we test the chunking and filtering, we need the file without input
      // to be in the first chunk of 100 newest files.
      // readdirSync().reverse() will return them in descending order of their names (timestamps).
      const additionalFiles = new Array(199)
        .fill(undefined)
        .map((_) => createFunctionRunFile({handle: extension.handle}))
      const fileWithoutInput = createFunctionRunFile({handle: extension.handle, partialPayload: {input: null}})
      const filesWithInput = new Array(99).fill(undefined).map((_) => createFunctionRunFile({handle: extension.handle}))

      await writeFiles(functionRunsDir, [...additionalFiles, fileWithoutInput, ...filesWithInput])

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
      // Chunk 1 will be the 99 newest files (filesWithInput) and the file without input.
      // Since functionRunData.length will be 99 (< 100), it will read Chunk 2.
      // Chunk 2 will have the next 100 newest files (the first 100 of additionalFiles).
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(
        normalizeRuns([...filesWithInput.reverse(), ...additionalFiles.reverse().slice(0, 100)].map(({run}) => run)),
      )
    })
  })
})

interface FunctionRunFileOptions {
  handle: string
  identifier?: string
  partialPayload?: object
}
let fileCounter = 0
function createFunctionRunFile(options: FunctionRunFileOptions) {
  const handle = options.handle
  const identifier = options.identifier ?? randomUUID().substring(0, 6)
  const partialPayload = options.partialPayload ?? {}
  const counter = (fileCounter++).toString().padStart(4, '0')
  const timestamp = `20240522_150641_${counter}Z`
  const path = `${timestamp}_extensions_${handle}_${identifier}.json`
  const run: FunctionRunData = {
    identifier,
    shopId: 1,
    apiClientId: 1,
    logType: 'function_run',
    source: handle,
    sourceNamespace: 'extensions',
    logTimestamp: timestamp,
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

async function writeFiles(dir: string, data: {run: FunctionRunData; path: string}[]) {
  for (const {run, path} of data) {
    // eslint-disable-next-line no-await-in-loop
    await writeFile(joinPath(dir, path), JSON.stringify(run))
  }
}

function normalizeRuns(runs: FunctionRunData[]) {
  return runs.map((run) => ({
    ...run,
    identifier: expect.any(String),
    logTimestamp: expect.any(String),
    payload: {
      ...run.payload,
      input:
        run.payload.input === null
          ? null
          : expect.objectContaining({
              identifier: expect.any(String),
            }),
    },
  }))
}
