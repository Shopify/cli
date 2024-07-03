import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'

import {setupExtensionWatcher} from '../dev/extension/bundler.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortError, FatalError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'

import {outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {readdirSync} from 'fs'
import chalk from '@shopify/cli-kit/node/colors'

const LOG_SELECTOR_LIMIT = 100

interface ReplayOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout?: boolean
  path: string
  json: boolean
  watch: boolean
  log?: string
}

export interface FunctionRunData {
  shop_id: number
  api_client_id: number
  payload: {
    input: unknown
    input_bytes: number
    output: unknown
    output_bytes: number
    function_id: string
    export: string
    logs: string
    fuel_consumed: number
  }
  log_type: string
  cursor: string
  status: string
  source: string
  source_namespace: string
  log_timestamp: string
  identifier: string
}

export async function replay(options: ReplayOptions) {
  const {watch, extension, app} = options
  const abortController = new AbortController()

  try {
    const {apiKey} = await ensureConnectedAppFunctionContext(options)
    const functionRunsDir = joinPath(getLogsDir(), apiKey)

    const selectedRun = options.log
      ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
      : await getRunFromSelector(functionRunsDir, extension.handle)

    const {input, export: runExport} = selectedRun.payload
    await runFunctionRunnerWithLogInput(extension, options, JSON.stringify(input), runExport)

    if (watch) {
      outputInfo(`Watching for changes to ${extension.handle}... (Ctrl+C to exit)`)
      await setupExtensionWatcher({
        extension,
        app,
        stdout: process.stdout,
        stderr: process.stderr,
        onChange: async () => {
          await runFunctionRunnerWithLogInput(extension, options, JSON.stringify(input), runExport)
          outputInfo(`Watching for changes to ${extension.handle}... (Ctrl+C to exit)`)
        },
        onReloadAndBuildError: async (error) => {
          if (error instanceof FatalError) {
            renderFatalError(error)
          } else {
            outputWarn(`Failed to replay function: ${error.message}`)
          }
        },
        signal: abortController.signal,
      })
    }
  } catch (error) {
    abortController.abort()
    throw error
  }
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  options: ReplayOptions,
  input: string,
  exportName: string,
) {
  const outputAsJson = options.json ? ['--json'] : []

  printInputForFunctionRunner(input);

  return exec(
    'npm',
    ['exec', '--', 'function-runner', '-f', fun.outputPath, ...outputAsJson, ...['--export', exportName]],
    {
      cwd: fun.directory,
      input,
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )
}

async function getRunFromIdentifier(
  functionRunsDir: string,
  functionHandle: string,
  identifier: string,
): Promise<FunctionRunData> {
  const runPath = await findFunctionRun(functionRunsDir, functionHandle, identifier)
  if (runPath === undefined) {
    throw new AbortError(
      `No log found for '${identifier}'.\nSearched ${functionRunsDir} for function ${functionHandle}.`,
    )
  }
  const fileData = await readFile(runPath)
  return JSON.parse(fileData)
}

interface LogFileMetadata {
  namespace: string
  functionHandle: string
  identifier: string
}

function parseLogFilename(filename: string): LogFileMetadata | undefined {
  // Expected format: 20240522_150641_827Z_extensions_my-function_abcdef.json
  const splitFilename = filename.split(/[_.]/)

  if (splitFilename.length < 6) {
    return undefined
  } else {
    return {
      namespace: splitFilename[3]!,
      functionHandle: splitFilename[4]!,
      identifier: splitFilename[5]!,
    }
  }
}

async function findFunctionRun(
  functionRunsDir: string,
  functionHandle: string,
  identifier: string,
): Promise<string | undefined> {
  const fileName = readdirSync(functionRunsDir).find((filename) => {
    const fileMetadata = parseLogFilename(filename)
    return (
      fileMetadata?.namespace === 'extensions' &&
      fileMetadata?.functionHandle === functionHandle &&
      fileMetadata?.identifier === identifier
    )
  })

  return fileName ? joinPath(functionRunsDir, fileName) : undefined
}

async function getRunFromSelector(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData> {
  const functionRuns = await getFunctionRunData(functionRunsDir, functionHandle)
  const selectedRun = await selectFunctionRunPrompt(functionRuns)

  if (selectedRun === undefined) {
    throw new AbortError(`No logs found in ${functionRunsDir}`)
  }
  return selectedRun
}

async function getFunctionRunData(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData[]> {
  const allFunctionRunFileNames = readdirSync(functionRunsDir)
    .filter((filename) => {
      // Expected format: 20240522_150641_827Z_extensions_my-function_abcdef.json
      const fileMetadata = parseLogFilename(filename)
      return fileMetadata?.namespace === 'extensions' && fileMetadata?.functionHandle === functionHandle
    })
    .reverse()

  let functionRunData: FunctionRunData[] = []
  for (
    let i = 0;
    i < allFunctionRunFileNames.length && functionRunData.length < LOG_SELECTOR_LIMIT;
    i += LOG_SELECTOR_LIMIT
  ) {
    const currentFunctionRunFileNameChunk = allFunctionRunFileNames.slice(i, i + LOG_SELECTOR_LIMIT)
    const functionRunFilePaths = currentFunctionRunFileNameChunk.map((functionRunFile) =>
      joinPath(functionRunsDir, functionRunFile),
    )

    // eslint-disable-next-line no-await-in-loop
    const functionRunDataFromChunk = await Promise.all(
      functionRunFilePaths.map(async (functionRunFilePath) => {
        const fileData = await readFile(functionRunFilePath)
        const parsedData = JSON.parse(fileData)
        return {
          ...parsedData,
          identifier: getIdentifierFromFilename(functionRunFilePath),
        }
      }),
    )

    const filteredFunctionRunDataFromChunk = functionRunDataFromChunk.filter((run) => {
      return run.payload.input != null
    })

    functionRunData = functionRunData.concat(filteredFunctionRunDataFromChunk)
  }

  return functionRunData
}

function getIdentifierFromFilename(fileName: string): string {
  return fileName.split('_').pop()!.substring(0, 6)
}

function printInputForFunctionRunner(input: string) {
  const title = chalk.black.bgRgb(150, 191, 72)('             Input            ');

  console.log(`${title}\n`);
  console.log(`${JSON.stringify(JSON.parse(input), null, 2)}\n`);
}
