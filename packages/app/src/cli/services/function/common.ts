import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {generateSchemaService} from '../generate-schema.js'
import {linkedAppContext} from '../app-context.js'
import {resolvePath, cwd, joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Flags} from '@oclif/core'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {existsSync, readdirSync} from 'fs'

const LOG_SELECTOR_LIMIT = 100

export const functionFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your function directory.',
    parse: async (input) => resolvePath(input),
    default: async () => cwd(),
    noCacheDefault: true,
    env: 'SHOPIFY_FLAG_PATH',
  }),
}

export async function chooseFunction(app: AppInterface, path: string): Promise<ExtensionInstance<FunctionConfigType>> {
  const allFunctions = app.allExtensions.filter(
    (ext) => ext.isFunctionExtension,
  ) as ExtensionInstance<FunctionConfigType>[]
  const ourFunction = allFunctions.find((fun) => fun.directory === path)
  if (ourFunction) return ourFunction

  if (allFunctions.length === 1 && allFunctions[0]) return allFunctions[0]

  if (isTerminalInteractive()) {
    const selectedFunction = await renderAutocompletePrompt({
      message: 'Which function?',
      choices: allFunctions.map((shopifyFunction) => ({label: shopifyFunction.handle, value: shopifyFunction})),
    })
    return selectedFunction
  }

  throw new AbortError('Run this command from a function directory or use `--path` to specify a function directory.')
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

interface LogFileMetadata {
  namespace: string
  functionHandle: string
  identifier: string
}

export function parseLogFilename(filename: string): LogFileMetadata | undefined {
  // Expected format: 20240522_150641_827Z_extensions_my-function_abcdef.json
  const splitFilename = filename.split(/[_.]/)

  if (splitFilename.length < 6) {
    return undefined
  }

  const namespace = splitFilename[3]
  const functionHandle = splitFilename[4]
  const identifier = splitFilename[5]

  if (!namespace || !functionHandle || !identifier) {
    return undefined
  }

  return {
    namespace,
    functionHandle,
    identifier,
  }
}

export function getIdentifierFromFilename(fileName: string): string {
  const parts = fileName.split('_')
  const lastPart = parts.pop()
  if (!lastPart) {
    throw new Error(`Invalid filename format: ${fileName}`)
  }
  return lastPart.substring(0, 6)
}

export function getAllFunctionRunFileNames(functionRunsDir: string): string[] {
  return existsSync(functionRunsDir) ? readdirSync(functionRunsDir) : []
}

export async function getFunctionRunData(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData[]> {
  const allFunctionRunFileNames = getAllFunctionRunFileNames(functionRunsDir)
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

export async function findFunctionRun(
  functionRunsDir: string,
  functionHandle: string,
  identifier: string,
): Promise<string | undefined> {
  const fileName = getAllFunctionRunFileNames(functionRunsDir).find((filename) => {
    const fileMetadata = parseLogFilename(filename)
    return (
      fileMetadata?.namespace === 'extensions' &&
      fileMetadata?.functionHandle === functionHandle &&
      fileMetadata?.identifier === identifier
    )
  })

  return fileName ? joinPath(functionRunsDir, fileName) : undefined
}

export async function getRunFromIdentifier(
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

export async function getOrGenerateSchemaPath(
  extension: ExtensionInstance<FunctionConfigType>,
  appDirectory: string,
  clientId: string | undefined,
  forceRelink: boolean,
  userProvidedConfigName: string | undefined,
): Promise<string | undefined> {
  const path = joinPath(extension.directory, 'schema.graphql')
  if (await fileExists(path)) {
    return path
  }

  const {app, developerPlatformClient, organization} = await linkedAppContext({
    directory: appDirectory,
    clientId,
    forceRelink,
    userProvidedConfigName,
  })

  await generateSchemaService({
    app,
    developerPlatformClient,
    extension,
    stdout: false,
    orgId: organization.id,
  })

  return (await fileExists(path)) ? path : undefined
}
