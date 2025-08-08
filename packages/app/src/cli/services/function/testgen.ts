import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/select-run.js'
import {nameFixturePrompt} from '../../prompts/function/name-fixture.js'

import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {readFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {existsSync, readdirSync} from 'fs'

const LOG_SELECTOR_LIMIT = 100

interface TestgenOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  path: string
  log?: string
  outputDir?: string
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

export async function testgen(options: TestgenOptions) {
  const {extension, app} = options
  const apiKey = app.configuration.client_id
  const functionRunsDir = joinPath(getLogsDir(), apiKey)

  const testsDir = joinPath(options.extension.directory, `tests`)

  // Create the tests directory
  if (!existsSync(testsDir)) {
    await mkdir(testsDir)
  }

  // Create the fixtures directory
  const testFixturesDir = joinPath(testsDir, `fixtures`)
  if (!existsSync(testFixturesDir)) {
    await mkdir(testFixturesDir)
  }

  // Create default test file
  const testFile = joinPath(testsDir, `default.test.ts`)
  if (!existsSync(testFile)) {
    const defaultTestPath = joinPath(cwd(), 'packages/app/src/cli/templates/function/default.test.ts.template')
    const testFileContent = await readFile(defaultTestPath)
    await writeFile(testFile, testFileContent)
  }

  const selectedRun = options.log
    ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
    : await getRunFromSelector(functionRunsDir, extension.handle)

  // Ensure payload exists with default values if undefined
  const payload = selectedRun.payload || {
    input: {},
    output: {},
    export: 'run',
    inputBytes: 0,
    outputBytes: 0,
    functionId: '',
    logs: '',
    fuelConsumed: 0,
  }

  const {input, output} = payload
  // Get the fixture name from user prompt
  const fixtureName = await nameFixturePrompt(selectedRun.identifier)
  const fixturePath = joinPath(testFixturesDir, `${fixtureName}.json`)

  // Create the fixture object in the correct format
  const fixture = {
    name: fixtureName,
    export: payload.export,
    query: `${payload.export}.graphql`,
    input,
    output,
  }

  // Write the fixture file
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2))

  return {
    testsDir,
    fixturePath,
    fixtureName,
    identifier: selectedRun.identifier,
    input,
    output,
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

async function getRunFromSelector(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData> {
  const functionRuns = await getFunctionRunData(functionRunsDir, functionHandle)
  const selectedRun = await selectFunctionRunPrompt(
    functionRuns,
    'Which function run would you like to generate test files from?',
  )

  if (selectedRun === undefined) {
    return {
      shopId: 0,
      apiClientId: 0,
      payload: {
        input: {},
        output: {},
        export: 'run',
        inputBytes: 0,
        outputBytes: 0,
        functionId: '',
        logs: '',
        fuelConsumed: 0,
      },
      logType: 'function',
      cursor: '',
      status: 'success',
      source: '',
      sourceNamespace: 'extensions',
      logTimestamp: new Date().toISOString(),
      identifier: 'default',
    }
  }
  return selectedRun
}

async function getFunctionRunData(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData[]> {
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

function getIdentifierFromFilename(fileName: string): string {
  return fileName.split('_').pop()!.substring(0, 6)
}

function getAllFunctionRunFileNames(functionRunsDir: string): string[] {
  return existsSync(functionRunsDir) ? readdirSync(functionRunsDir) : []
}
