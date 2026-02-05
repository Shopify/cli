import colors from '../colors.js'
import {outputInfo} from '../output.js'
import {relativizePath} from '../path.js'
import type {TestResult, AssertionResult} from './types.js'

const log = (message: string) => outputInfo(message)

// Reporter context for path
let reporterBasePath: string | undefined

/**
 * Initialize the reporter with a base path for truncating file paths in output.
 * Call this before running tests to enable path truncation.
 *
 * @param basePath - The base path used to truncate absolute paths in output.
 */
export function initReporter(basePath: string): void {
  reporterBasePath = basePath
}

/**
 * Truncate absolute paths to be relative to the base path.
 * Looks for paths in common patterns like "File exists: /path/to/file".
 *
 * @param text - The text that may contain absolute paths to truncate.
 * @returns The text with paths relativized when under the reporter base path.
 */
function truncatePaths(text: string): string {
  if (!reporterBasePath) return text

  // Match absolute paths
  // relativizePath will convert paths under reporterBasePath to relative paths
  // and keep other paths unchanged
  const absolutePathPattern = /\/[^\s,)]+/g

  return text.replace(absolutePathPattern, (path) => {
    return relativizePath(path, reporterBasePath)
  })
}

/**
 * Log the start of a test suite.
 *
 * @param suiteName - The name of the suite.
 * @param description - The suite description.
 */
export function reportSuiteStart(suiteName: string, description: string): void {
  log('')
  log(colors.bold(colors.cyan(`Suite: ${suiteName}`)))
  log(colors.dim(description))
}

/**
 * Log the start of a test.
 *
 * @param testName - The name of the test.
 */
export function reportTestStart(testName: string): void {
  log(colors.bold(colors.blue(`Running: ${testName}`)))
}

/**
 * Log the result of a single test (passed, failed, or skipped).
 *
 * @param result - The test result to report.
 */
export function reportTestResult(result: TestResult): void {
  const durationStr = `(${(result.duration / 1000).toFixed(2)}s)`

  if (result.status === 'passed') {
    log(colors.bold(colors.green(`PASSED: ${result.name} ${colors.dim(durationStr)}`)))
    for (const line of formatAssertions(result.assertions)) {
      log(line)
    }
  } else if (result.status === 'failed') {
    log(colors.red(`FAILED: ${result.name} ${colors.dim(durationStr)}`))
    for (const line of formatAssertions(result.assertions)) {
      log(line)
    }
    if (result.error) {
      log(colors.red(`  Error: ${truncatePaths(result.error.message)}`))
    }
  } else {
    log(colors.yellow(`SKIPPED: ${result.name}`))
  }
}

/**
 * Log a summary of all test results.
 *
 * @param results - The list of test results to summarize.
 */
export function reportSummary(results: TestResult[]): void {
  const passed = results.filter((result) => result.status === 'passed').length
  const failed = results.filter((result) => result.status === 'failed').length
  const skipped = results.filter((result) => result.status === 'skipped').length
  const total = results.length
  const totalDuration = results.reduce((sum, result) => sum + result.duration, 0)

  log('')
  log(colors.bold('─'.repeat(40)))

  if (failed > 0) {
    log(colors.red(colors.bold(`Doctor Complete: ${failed}/${total} tests failed`)))
  } else {
    log(colors.green(colors.bold(`Doctor Complete: ${passed}/${total} tests passed`)))
  }

  log(`  Passed: ${colors.green(String(passed))}`)
  log(`  Failed: ${colors.red(String(failed))}`)
  if (skipped > 0) {
    log(`  Skipped: ${colors.yellow(String(skipped))}`)
  }
  log(`  Total time: ${colors.dim(`${(totalDuration / 1000).toFixed(2)}s`)}`)
}

/**
 * Format assertion results as log lines.
 *
 * @param assertions - The assertion results to format.
 * @returns Array of formatted log lines.
 */
function formatAssertions(assertions: AssertionResult[]): string[] {
  return assertions.map((assertion) => {
    if (assertion.passed) {
      return colors.green(`  [OK] ${assertion.description}`)
    } else {
      const details = ` (expected: ${assertion.expected}, actual: ${assertion.actual})`
      return colors.red(`  [FAIL] ${assertion.description}${details}`)
    }
  })
}
