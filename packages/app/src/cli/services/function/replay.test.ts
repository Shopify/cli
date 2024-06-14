import {FunctionRunData, replay} from './replay.js'
import {runFunctionRunner} from './build.js'
import {testApp, testFunctionExtension, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'

vi.mock('../generate-schema.js')
vi.mock('../../prompts/function/replay.js')
vi.mock('@shopify/cli-kit/node/logs')
vi.mock('./build.js')
vi.mock('@shopify/cli-kit/node/system')

const EXTENSION_NAMESPACE = 'extensions'

const EXTENSION = await testFunctionExtension({})
const HANDLE = EXTENSION.handle
const RUN1: FunctionRunData = {
  shop_id: 69665030382,
  api_client_id: 124042444801,
  payload: {
    input: {},
    input_bytes: 136,
    output: {},
    export: 'run',
    output_bytes: 195,
    function_id: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    logs: '',
    fuel_consumed: 458206,
  },
  log_type: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  source: HANDLE,
  source_namespace: EXTENSION_NAMESPACE,
  status: 'success',
  log_timestamp: '2024-05-31T15:29:46.741270Z',
  identifier: 'abcdef',
}
const RUN1_FILENAME = RUN1.log_timestamp.replace(/:/g, '_')

const RUN2: FunctionRunData = {
  shop_id: 69665030382,
  api_client_id: 124042444801,
  payload: {
    input: {},
    input_bytes: 136,
    output: {},
    export: 'run',
    output_bytes: 195,
    function_id: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    logs: '',
    fuel_consumed: 458206,
  },
  log_type: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: HANDLE,
  source_namespace: EXTENSION_NAMESPACE,
  log_timestamp: '2024-05-31T15:29:50.741270Z',
  identifier: '123456',
}
const RUN2_FILENAME = RUN2.log_timestamp.replace(/:/g, '_')

const UNRELATED_HANDLE = 'other-function'
const UNRELATED_LOG: FunctionRunData = {
  shop_id: 69665030382,
  api_client_id: 124042444801,
  payload: {
    input: {},
    input_bytes: 136,
    output: {},
    output_bytes: 195,
    export: 'run',
    function_id: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
    logs: '',
    fuel_consumed: 458206,
  },
  log_type: 'function_run',
  cursor: '2024-05-31T15:29:47.291530Z',
  status: 'success',
  source: UNRELATED_HANDLE,
  source_namespace: EXTENSION_NAMESPACE,
  log_timestamp: '2024-05-31T15:29:50.741270Z',
  identifier: '123456',
}
const UNRELATED_LOG_FILENAME = UNRELATED_LOG.log_timestamp.replace(/:/g, '_')

describe('replay', () => {
  test('reads the app log directory, parses the function runs, and invokes function-runner', async () => {
    // Given
    const app = testApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const apiKey = 'apiKey'

    await inTemporaryDirectory(async (tmpDir) => {
      // setup a directory with function run logs
      const functionRunsDir = joinPath(tmpDir, apiKey)
      await mkdir(functionRunsDir)

      await Promise.all(
        [...Array(100).keys()].map(async (index) => {
          return writeFile(
            joinPath(functionRunsDir, `${RUN1_FILENAME}_extensions_${HANDLE}_${index}_${RUN1.identifier}.json`),
            JSON.stringify(RUN1),
          )
        }),
      )
      await writeFile(
        joinPath(functionRunsDir, `${RUN2_FILENAME}_extensions_${HANDLE}_${RUN2.identifier}.json`),
        JSON.stringify(RUN2),
      )

      const options = {
        app,
        extension: EXTENSION,
        apiKey: undefined,
        stdout: false,
        path: functionRunsDir,
        json: true,
      }

      vi.mocked(ensureConnectedAppFunctionContext).mockResolvedValueOnce({apiKey, developerPlatformClient})
      vi.mocked(getLogsDir).mockReturnValue(tmpDir)
      vi.mocked(selectFunctionRunPrompt).mockResolvedValue(RUN1)
      vi.mocked(runFunctionRunner)
      // When
      await replay(options)

      // Then
      // expect it to get the apiKey
      expect(ensureConnectedAppFunctionContext).toHaveBeenCalledOnce()

      // expect it to determine the directory from the apiKey
      expect(getLogsDir).toHaveBeenCalledOnce()

      // expect it to call the selector with a subset of the runs
      const expectedRuns = Array(100).fill(RUN1)
      expectedRuns[0] = RUN2
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(expectedRuns)

      // expect it to call function runner with that run
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
          input: JSON.stringify(RUN1.payload.input),
          stdout: 'inherit',
          stderr: 'inherit',
        },
      )
    })
  })

  test('does not read logs from other functions', async () => {
    // Given
    const app = testApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const apiKey = 'apiKey'

    await inTemporaryDirectory(async (tmpDir) => {
      // setup a directory with function run logs
      const functionRunsDir = joinPath(tmpDir, apiKey)
      await mkdir(functionRunsDir)

      await writeFile(
        joinPath(functionRunsDir, `${RUN2_FILENAME}_extensions_${HANDLE}_${RUN2.identifier}.json`),
        JSON.stringify(RUN2),
      )
      await writeFile(
        joinPath(
          functionRunsDir,
          `${UNRELATED_LOG_FILENAME}_extensions_${UNRELATED_HANDLE}_${UNRELATED_LOG.identifier}.json`,
        ),
        JSON.stringify(UNRELATED_LOG),
      )

      const options = {
        app,
        extension: EXTENSION,
        apiKey: undefined,
        stdout: false,
        path: functionRunsDir,
        json: true,
        export: 'run',
      }

      vi.mocked(ensureConnectedAppFunctionContext).mockResolvedValueOnce({apiKey, developerPlatformClient})
      vi.mocked(getLogsDir).mockReturnValue(tmpDir)
      vi.mocked(selectFunctionRunPrompt).mockResolvedValue(RUN1)
      vi.mocked(runFunctionRunner)
      // When
      await replay(options)

      // Then
      // expect it to call the selector with a subset of the runs
      const expectedRuns = [RUN2]
      expect(selectFunctionRunPrompt).toHaveBeenCalledWith(expectedRuns)
    })
  })

  test('throws an error if invoked with no logs available', async () => {
    // Given
    const app = testApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const apiKey = 'apiKey'

    await inTemporaryDirectory(async (tmpDir) => {
      // setup a directory with function run logs
      const functionRunsDir = joinPath(tmpDir, apiKey)
      await mkdir(functionRunsDir)

      const options = {
        app,
        extension: EXTENSION,
        apiKey: undefined,
        stdout: false,
        path: functionRunsDir,
        json: true,
        export: 'run',
      }

      vi.mocked(ensureConnectedAppFunctionContext).mockResolvedValueOnce({apiKey, developerPlatformClient})
      vi.mocked(getLogsDir).mockReturnValue(tmpDir)
      vi.mocked(selectFunctionRunPrompt).mockResolvedValue(undefined)

      // When/Then
      await expect(() => replay(options)).rejects.toThrowError('No logs found')
    })
  })
})
