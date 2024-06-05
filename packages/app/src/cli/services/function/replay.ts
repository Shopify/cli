import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {exec} from '@shopify/cli-kit/node/system'

import {readdirSync} from 'fs'

interface ReplayOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout: boolean
  path: string
  json: boolean
  export: string
}

export interface FunctionRunData {
  shop_id: number
  api_client_id: number
  payload: {
    input: string
    input_bytes: number
    output: string
    output_bytes: number
    function_id: string
    logs: string
    fuel_consumed: number
  }
  event_type: string
  cursor: string
  status: string
  log_timestamp: string
  identifier: string
}

export async function replay(options: ReplayOptions) {
  const {apiKey} = await ensureConnectedAppFunctionContext(options)
  const functionRunsDir = joinPath(getLogsDir(), apiKey)

  const functionRuns = await getFunctionRunData(functionRunsDir)
  const selectedRun = await selectFunctionRunPrompt(functionRuns.reverse())
  await runFunctionRunnerWithLogInput(options.extension, options, selectedRun.payload.input)
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  options: ReplayOptions,
  input: string,
) {
  const outputAsJson = options.json ? ['--json'] : []
  const exportName = options.export ? ['--export', options.export] : []

  return exec('npm', ['exec', '--', 'function-runner', '-f', fun.outputPath, ...outputAsJson, ...exportName], {
    cwd: fun.directory,
    input,
    stdout: 'inherit',
    stderr: 'inherit',
  })
}

async function getFunctionRunData(functionRunsDir: string): Promise<FunctionRunData[]> {
  const functionRunFileNames = readdirSync(functionRunsDir)
  const functionRunFilePaths = functionRunFileNames.map((functionRunFile) => joinPath(functionRunsDir, functionRunFile))

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
