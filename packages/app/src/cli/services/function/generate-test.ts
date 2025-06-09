import {TestCase} from './test.js'
import {FunctionRunData} from './replay.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'

import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputSuccess, outputInfo} from '@shopify/cli-kit/node/output'
import {renderTextPrompt, renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

import {existsSync, readdirSync} from 'fs'

interface GenerateTestOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  log?: string
}

async function selectFunctionRunForTestPrompt(functionRuns: FunctionRunData[]): Promise<FunctionRunData | undefined> {
  if (functionRuns.length === 0) return undefined
  const toAnswer = (functionRun: FunctionRunData) => {
    return {
      label: `${functionRun.logTimestamp} (${functionRun.status}) - ${functionRun.identifier}`,
      value: functionRun,
    }
  }

  const functionRunsList = functionRuns.map(toAnswer)

  const selectedRun = await renderAutocompletePrompt({
    message: 'Which function run would you like to generate a test from?',
    choices: functionRunsList,
  })
  return selectedRun
}

export async function generateTest(options: GenerateTestOptions) {
  const {extension} = options

  const apiKey = options.app.configuration.client_id
  const functionRunsDir = joinPath(getLogsDir(), apiKey)

  // Get the selected function run (either by identifier or from selector)
  const selectedRun = options.log
    ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
    : await getRunFromSelector(functionRunsDir, extension.handle)

  // Prompt for test name
  const testName = await renderTextPrompt({
    message: 'What would you like to name this test?',
    defaultValue: `test-${selectedRun.identifier}`,
    validate: (input) => {
      if (!input.trim()) {
        return 'Test name can not be empty'
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(input.trim())) {
        return 'Test name can only contain letters, numbers, hyphens, and underscores'
      }
      return undefined
    },
  })

  // Create the test case
  const testCase: TestCase = {
    name: testName.trim(),
    input: selectedRun.payload.input,
    expected: selectedRun.payload.output,
    export: selectedRun.payload.export,
  }

  // Ensure tests directory exists
  const testsDir = joinPath(extension.directory, 'tests')
  await mkdir(testsDir)

  // Write the test file
  const testFileName = `${testName.trim()}.json`
  const testFilePath = joinPath(testsDir, testFileName)

  await writeFile(testFilePath, JSON.stringify(testCase, null, 2))

  outputSuccess(`Test case created: ${testFilePath}`)
  outputInfo(`You can run this test with: shopify app function test --test-file=${testFileName}`)
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
  const selectedRun = await selectFunctionRunForTestPrompt(functionRuns)

  if (selectedRun === undefined) {
    throw new AbortError(`No logs found in ${functionRunsDir}`)
  }
  return selectedRun
}

const LOG_SELECTOR_LIMIT = 100

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
      return run.payload.input != null && run.payload.output != null
    })

    functionRunData = functionRunData.concat(filteredFunctionRunDataFromChunk)
  }

  return functionRunData
}

function getIdentifierFromFilename(fileName: string): string {
  const parts = fileName.split('_')
  const lastPart = parts.pop()
  return lastPart ? lastPart.substring(0, 6) : 'unknown'
}

function getAllFunctionRunFileNames(functionRunsDir: string): string[] {
  return existsSync(functionRunsDir) ? readdirSync(functionRunsDir) : []
}
