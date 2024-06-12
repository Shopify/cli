import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'

import {readdirSync} from 'fs'

const LOG_SELECTOR_LIMIT = 100

interface ReplayOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout: boolean
  path: string
  json: boolean
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
  event_type: string
  cursor: string
  status: string
  source: string
  source_namespace: string
  log_timestamp: string
  identifier: string
}

export async function replay(options: ReplayOptions) {
  const {apiKey} = await ensureConnectedAppFunctionContext(options)
  const functionRunsDir = joinPath(getLogsDir(), apiKey)

  const functionRuns = await getFunctionRunData(functionRunsDir, options.extension.handle)
  const selectedRun = await selectFunctionRunPrompt(functionRuns)

  if (selectedRun === undefined) {
    throw new AbortError(`No logs found in ${functionRunsDir}`)
  }

  await runFunctionRunnerWithLogInput(
    options.extension,
    options,
    JSON.stringify(selectedRun.payload.input),
    selectedRun.payload.export,
  )
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  options: ReplayOptions,
  input: string,
  exportName: string,
) {
  const outputAsJson = options.json ? ['--json'] : []

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

async function getFunctionRunData(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData[]> {
  const allFunctionRunFileNames = readdirSync(functionRunsDir)
    .filter((filename) => {
      // Expected format: 20240522_150641_827Z_extensions_my-function_abcdef.json
      const splitFilename = filename.split('_')
      return splitFilename[3] === 'extensions' && splitFilename[4] === functionHandle
    })
    .reverse()
  const latestFunctionRunFileNames = allFunctionRunFileNames.slice(0, LOG_SELECTOR_LIMIT)
  const functionRunFilePaths = latestFunctionRunFileNames.map((functionRunFile) =>
    joinPath(functionRunsDir, functionRunFile),
  )

  const functionRunData = await Promise.all(
    functionRunFilePaths.map(async (functionRunFilePath) => {
      const fileData = await readFile(functionRunFilePath)
      const parsedData = JSON.parse(fileData)
      return {
        ...parsedData,
        identifier: getIdentifierFromFilename(functionRunFilePath),
      }
    }),
  )

  return functionRunData
}

function getIdentifierFromFilename(fileName: string): string {
  return fileName.split('_').pop()!.substring(0, 6)
}
