import {runFunctionRunner} from './build.js'
import {ensureConnectedAppFunctionContext} from '../generate-schema.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectLogPrompt} from '../../prompts/dev.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
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

export interface LogData {
  shop_id: string
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
}

export async function replay(options: ReplayOptions) {
  const {apiKey} = await ensureConnectedAppFunctionContext(options)
  const logsDir = joinPath(getLogsDir, apiKey)

  const logs = await getFunctionLogData(logsDir)
  const selectedRun = await selectLogPrompt(logs.reverse())

  await inTemporaryDirectory(async (tmpDir) => {
    // create file to pass to runner
    const inputPath = joinPath(tmpDir, 'input_for_runner.json')
    await writeFile(inputPath, selectedRun.payload.input)

    // invoke the existing run command with the input from the file
    await runFunctionRunner(options.extension, {
      json: options.json,
      input: inputPath,
      export: options.export,
    })
  })
}

async function getFunctionLogData(logsFolder: string): Promise<LogData[]> {
  const logFileNames = readdirSync(logsFolder)
  const logFilePaths = logFileNames.map((logFile) => joinPath(logsFolder, logFile))
  const logData = await Promise.all(
    logFilePaths.map((logFile) => {
      return readFile(logFile)
    }),
  )
  const logs = logData.map((log) => JSON.parse(log))
  return logs
}
