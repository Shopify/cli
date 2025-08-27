import {FunctionRunData, getRunFromIdentifier, getFunctionRunData} from './common.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {selectFunctionRunPrompt} from '../../prompts/function/select-run.js'
import {nameFixturePrompt} from '../../prompts/function/name-fixture.js'

import {loadConfigurationFileContent} from '../../models/app/loader.js'
import {getLogsDir} from '@shopify/cli-kit/node/logs'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {readFile, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {existsSync, readdirSync} from 'fs'

interface GenerateFixtureOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  path: string
  log?: string
  outputDir?: string
}

export async function generateFixture(options: GenerateFixtureOptions) {
  const {extension, app} = options
  const apiKey = app.configuration.client_id
  const functionRunsDir = joinPath(getLogsDir(), apiKey)

  const selectedRun = options.log
    ? await getRunFromIdentifier(functionRunsDir, extension.handle, options.log)
    : await getRunFromSelector(functionRunsDir, extension.handle)

  // Check if we actually got a valid run with data
  if (!selectedRun || !selectedRun.payload) {
    throw new AbortError(
      `No function run logs found for function '${extension.handle}'.\n` +
        `Make sure you have run the function at least once to generate logs.\n` +
        `Logs directory: ${functionRunsDir}`,
    )
  }

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

  // Create default test file only if no test files already exist
  const testFile = joinPath(testsDir, `default.test.ts`)
  const existingTestFiles = readdirSync(testsDir).filter(
    (file) => file.endsWith('.test.ts') || file.endsWith('.test.js'),
  )

  if (existingTestFiles.length === 0 && !existsSync(testFile)) {
    const defaultTestPath = joinPath(cwd(), 'packages/app/templates/function/default.test.ts.template')
    const testFileContent = await readFile(defaultTestPath)
    await writeFile(testFile, testFileContent)
  }

  // Copy package.json to provide Node.js project structure for testing
  const packageJsonPath = joinPath(testsDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    const packageJsonTemplatePath = joinPath(cwd(), 'packages/app/templates/function/package.json')
    const packageJsonContent = await readFile(packageJsonTemplatePath)
    await writeFile(packageJsonPath, packageJsonContent)

    // Install dependencies after creating package.json
    const {exec} = await import('child_process')
    const {promisify} = await import('util')
    const execAsync = promisify(exec)

    await execAsync('npm install', {cwd: testsDir})
  }

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

  // Parse TOML to find the targeting section that matches the export
  let inputQueryPath = ''
  let target = ''
  const tomlPath = joinPath(extension.directory, 'shopify.extension.toml')
  if (existsSync(tomlPath)) {
    const tomlContent = await loadConfigurationFileContent(tomlPath)
    const extensions = tomlContent.extensions as FunctionConfigType[]

    // Find the extension that matches our function
    const functionExtension = extensions.find(
      (ext) => ext.handle === extension.handle && ext.type === 'function',
    ) as FunctionConfigType

    if (functionExtension && functionExtension.targeting) {
      // Find the targeting section that matches our export
      const targetingSection = functionExtension.targeting.find((target) => target.export === payload.export)

      if (targetingSection) {
        if (targetingSection.input_query) {
          inputQueryPath = targetingSection.input_query
        }
        if (targetingSection.target) {
          target = targetingSection.target
        }
      }
    }
  }

  // Get the fixture name from user prompt
  const fixtureName = await nameFixturePrompt(selectedRun.identifier)
  const fixturePath = joinPath(testFixturesDir, `${fixtureName}.json`)

  const fixture = {
    name: fixtureName,
    export: payload.export,
    query: inputQueryPath,
    target,
    input,
    output,
  }

  await writeFile(fixturePath, JSON.stringify(fixture, null, 2))

  return {
    testsDir,
    fixturePath,
    fixtureName,
    identifier: selectedRun.identifier,
    input,
    output,
    target,
  }
}

async function getRunFromSelector(functionRunsDir: string, functionHandle: string): Promise<FunctionRunData> {
  const functionRuns = await getFunctionRunData(functionRunsDir, functionHandle)

  if (functionRuns.length === 0) {
    throw new AbortError(
      `No function run logs found for function '${functionHandle}'.\n` +
        `Make sure you have run the function at least once to generate logs.\n` +
        `Logs directory: ${functionRunsDir}`,
    )
  }

  const selectedRun = await selectFunctionRunPrompt(
    functionRuns,
    'Which function run would you like to generate test files from?',
  )

  if (selectedRun === undefined) {
    throw new AbortError('No function run selected. Exiting.')
  }

  return selectedRun
}
