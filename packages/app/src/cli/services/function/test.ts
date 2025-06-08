import {runFunction} from './runner.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug, outputInfo, outputContent, outputToken, outputNewline} from '@shopify/cli-kit/node/output'
import {renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

export interface TestCase {
  name: string
  input: unknown
  expected: unknown
  export?: string
}

// Each JSON file contains a single test case
export type TestFile = TestCase

export interface TestResult {
  name: string
  passed: boolean
  error?: string
  actual?: unknown
  expected?: unknown
  input?: unknown
  export?: string
  sourceFile?: string
}

export interface FunctionTestOptions {
  functionExtension: ExtensionInstance<FunctionConfigType>
  export: string
  schemaPath?: string
  queryPath?: string
  testFile?: string
}

interface TestContext {
  results: TestResult[]
}

export async function functionTest(options: FunctionTestOptions) {
  const functionExport = options.export

  const testsPath = joinPath(options.functionExtension.directory, 'tests')
  const testFiles = await discoverTestFiles(testsPath, options.testFile)

  if (testFiles.length === 0) {
    throw new AbortError('No test files found in the tests directory.')
  }

  // Load all test cases in parallel first
  const testCasePromises = testFiles.map(async (testFile) => {
    const testCase = await loadTestCase(testFile)
    const fileName = testFile.split('/').pop()?.replace('.json', '') ?? 'unknown'
    outputDebug(`Loaded test: ${testCase.name}`)
    const testExport = testCase.export ?? functionExport
    return {testCase, fileName, export: testExport}
  })

  const allTestCases = await Promise.all(testCasePromises)

  // Store results outside tasks to avoid context issues
  const allResults: TestResult[] = []

  // Convert test cases to tasks for real-time feedback
  const tasks: Task<void>[] = allTestCases.map(({testCase, fileName, export: testExport}) => ({
    title: `${fileName} > ${testCase.name}`,
    task: async () => {
      const result = await runSingleTest(testCase, {
        functionExtension: options.functionExtension,
        export: testExport,
        schemaPath: options.schemaPath,
        queryPath: options.queryPath,
      })

      // Add source file info
      result.sourceFile = fileName
      allResults.push(result)

      // Don't throw for failed tests - we want to collect all results
    },
  }))

  // Run tests with real-time progress feedback
  await renderTasks(tasks)

  const passedTests = allResults.filter((result) => result.passed).length
  const totalTests = allResults.length

  displayResults(allResults, passedTests, totalTests, options.testFile)

  // Set exit code but don't throw or exit - let the command complete normally
  if (passedTests < totalTests) {
    process.exitCode = 1
  }
}

export async function checkIfTestFilesHaveExports(testsPath: string, specificFile?: string): Promise<boolean> {
  const testFiles = await discoverTestFiles(testsPath, specificFile)

  // Check all files in parallel
  const exportCheckPromises = testFiles.map(async (testFile) => {
    try {
      const content = await readFile(testFile)
      const parsed = JSON.parse(content) as TestFile
      return Boolean(parsed.export)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // Ignore files that fail to parse
      return false
    }
  })

  const results = await Promise.all(exportCheckPromises)
  return results.some((hasExport) => hasExport)
}

async function discoverTestFiles(testsPath: string, specificFile?: string): Promise<string[]> {
  if (specificFile) {
    const fullPath = joinPath(testsPath, specificFile)
    return [fullPath]
  }

  try {
    return await glob(joinPath(testsPath, '**/*.json'))
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return []
  }
}

async function loadTestCase(filePath: string): Promise<TestCase> {
  try {
    const content = await readFile(filePath)
    const parsed = JSON.parse(content) as TestFile

    // If no name is provided, use the filename
    if (!parsed.name) {
      parsed.name = filePath.split('/').pop()?.replace('.json', '') ?? 'Unnamed test'
    }

    return parsed
  } catch (error) {
    throw new AbortError(`Failed to load test file ${filePath}: ${error}`)
  }
}

async function runSingleTest(
  testCase: TestCase,
  options: {
    functionExtension: ExtensionInstance<FunctionConfigType>
    export: string
    schemaPath?: string
    queryPath?: string
  },
): Promise<TestResult> {
  try {
    let stdout = ''
    let stderr = ''

    const stdoutStream = new Writable({
      write(chunk, _encoding, callback) {
        stdout += String(chunk)
        callback()
      },
    })

    const stderrStream = new Writable({
      write(chunk, _encoding, callback) {
        stderr += String(chunk)
        callback()
      },
    })

    await runFunction({
      functionExtension: options.functionExtension,
      input: JSON.stringify(testCase.input),
      export: options.export,
      json: true,
      schemaPath: options.schemaPath,
      queryPath: options.queryPath,
      stdout: stdoutStream,
      stderr: stderrStream,
    })

    if (stderr) {
      return {
        name: testCase.name,
        passed: false,
        error: stderr,
      }
    }

    let functionResult: unknown
    try {
      functionResult = JSON.parse(stdout.trim())
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return {
        name: testCase.name,
        passed: false,
        error: 'Function output is not valid JSON',
        actual: stdout,
      }
    }

    // Extract the actual output from the JSON response
    const actual = (functionResult as any).output ?? functionResult

    const passed = JSON.stringify(actual) === JSON.stringify(testCase.expected)

    return {
      name: testCase.name,
      passed,
      actual: passed ? undefined : actual,
      expected: passed ? undefined : testCase.expected,
      input: passed ? undefined : testCase.input,
      export: testCase.export,
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      error: String(error),
      input: testCase.input,
      export: testCase.export,
    }
  }
}

/* eslint-disable no-console */
function displayResults(results: TestResult[], passed: number, total: number, _isIndividualTest?: string): void {
  const failedTests = results.filter((result) => !result.passed)

  // Show summary like vitest with colors
  outputNewline()
  for (const result of results) {
    const status = result.passed ? outputToken.successIcon() : outputToken.failIcon()
    const file = outputToken.gray(`${result.sourceFile ?? 'test'}.json`)
    outputInfo(outputContent`${status} ${file} > ${result.name}`)
  }

  outputNewline()

  // Show detailed failures like vitest
  for (const failed of failedTests) {
    outputInfo(
      outputContent`${outputToken.errorText('❯ FAIL')}  ${outputToken.gray(`${failed.sourceFile ?? 'test'}.json`)} > ${
        failed.name
      }`,
    )

    if (failed.error) {
      outputInfo(`  ${failed.error}`)
    } else if (failed.actual !== undefined && failed.expected !== undefined) {
      outputInfo('  Function output mismatch')
      outputNewline()
      outputInfo(outputContent`  ${outputToken.errorText('- Expected')}`)
      outputInfo(outputContent`  ${outputToken.green('+ Received')}`)
      outputNewline()
      generateVitestStyleDiff(failed.expected, failed.actual)
    }
    outputNewline()
  }

  // Final summary with colors
  if (passed === total) {
    outputInfo(outputContent`${outputToken.green(`✓ ${total} passed`)}`)
  } else {
    outputInfo(
      outputContent`${outputToken.errorText(`✗ ${failedTests.length} failed`)}, ${outputToken.green(
        `${passed} passed`,
      )}, ${String(total)} total`,
    )
  }
}
/* eslint-enable no-console */

/* eslint-disable no-console */
function generateVitestStyleDiff(expected: unknown, actual: unknown): void {
  const expectedStr = JSON.stringify(expected, null, 2)
  const actualStr = JSON.stringify(actual, null, 2)

  const expectedLines = expectedStr.split('\n')
  const actualLines = actualStr.split('\n')

  const maxLines = Math.max(expectedLines.length, actualLines.length)

  for (let i = 0; i < maxLines; i++) {
    const expectedLine = expectedLines[i]
    const actualLine = actualLines[i]

    if (expectedLine === actualLine) {
      if (expectedLine !== undefined) {
        outputInfo(outputContent`${outputToken.gray(`    ${expectedLine}`)}`)
      }
    } else {
      if (expectedLine !== undefined) {
        outputInfo(outputContent`  ${outputToken.errorText(`- ${expectedLine}`)}`)
      }
      if (actualLine !== undefined) {
        outputInfo(outputContent`  ${outputToken.green(`+ ${actualLine}`)}`)
      }
    }
  }
}
/* eslint-enable no-console */

function _findFieldDifferences(expected: unknown, actual: unknown, path: string): string[] {
  const differences: string[] = []

  if (typeof expected !== typeof actual) {
    differences.push(`${path || 'root'}: type mismatch (expected ${typeof expected}, got ${typeof actual})`)
    return differences
  }

  if (expected === null || actual === null) {
    if (expected !== actual) {
      differences.push(`${path || 'root'}: expected ${expected}, got ${actual}`)
    }
    return differences
  }

  if (typeof expected === 'object' && typeof actual === 'object') {
    const expectedObj = expected as {[key: string]: unknown}
    const actualObj = actual as {[key: string]: unknown}

    // Check for missing keys
    const expectedKeys = Object.keys(expectedObj)
    const actualKeys = Object.keys(actualObj)

    for (const key of expectedKeys) {
      if (!(key in actualObj)) {
        differences.push(`${path}.${key}: missing in actual output`)
      }
    }

    for (const key of actualKeys) {
      if (!(key in expectedObj)) {
        differences.push(`${path}.${key}: unexpected field in actual output`)
      }
    }

    // Check for value differences
    for (const key of expectedKeys) {
      if (key in actualObj) {
        const newPath = path ? `${path}.${key}` : key
        differences.push(..._findFieldDifferences(expectedObj[key], actualObj[key], newPath))
      }
    }
  } else if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      differences.push(`${path}: array length mismatch (expected ${expected.length}, got ${actual.length})`)
    }

    const minLength = Math.min(expected.length, actual.length)
    for (let i = 0; i < minLength; i++) {
      differences.push(..._findFieldDifferences(expected[i], actual[i], `${path}[${i}]`))
    }
  } else if (expected !== actual) {
    differences.push(`${path || 'root'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }

  return differences
}
