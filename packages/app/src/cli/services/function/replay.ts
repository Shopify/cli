/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {renderReplay} from './ui.js'
import {runFunction} from './runner.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/replay.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'

import {readdirSync} from 'fs'

const LOG_SELECTOR_LIMIT = 100

interface ReplayOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  stdout?: boolean
  path: string
  json: boolean
  watch: boolean
  log?: string
}

export interface FunctionRunData {
  shopId: number
  apiClientId: number
  payload: {
    input: unknown
    inputBytes: number
    output: unknown
    outputBytes: number
    functionId: string
    export: string
    logs: string
    fuelConsumed: number
  }
  logType: string
  cursor: string
  status: string
  source: string
  sourceNamespace: string
  logTimestamp: string
  identifier: string
}

export async function replay(options: ReplayOptions) {
  const {watch, extension, app} = options
  const abortController = new AbortController()

  try {
    const apiKey = options.app.configuration.client_id
    const functionRunsDir = joinPath(getLogsDir(), apiKey)

    const selectedRun = options.log
      ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
      : await getRunFromSelector(functionRunsDir, extension.handle)

    const {input, export: runExport} = selectedRun.payload

    if (watch) {
      await renderReplay({
        selectedRun,
        abortController,
        app,
        extension,
      })
    } else {
      await runFunction({
        functionExtension: extension,
        json: options.json,
        input: JSON.stringify(input),
        export: runExport,
      })
    }
  } catch (error) {
    abortController.abort()
    throw error
  }
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
