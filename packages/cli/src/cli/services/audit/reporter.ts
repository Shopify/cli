import {renderInfo, renderSuccess, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import type {TestResult, AssertionResult} from './types.js'

export function reportSuiteStart(suiteName: string, description: string): void {
  renderInfo({
    headline: `Suite: ${suiteName}`,
    body: description,
  })
}

export function reportTestStart(testName: string): void {
  renderInfo({
    headline: `Running: ${testName}`,
  })
}

export function reportTestResult(result: TestResult): void {
  const durationStr = `${(result.duration / 1000).toFixed(2)}s`

  if (result.status === 'passed') {
    renderSuccess({
      headline: `PASSED: ${result.name} (${durationStr})`,
      body: formatAssertionsBody(result.assertions),
    })
  } else if (result.status === 'failed') {
    const body = formatAssertionsBody(result.assertions)
    if (result.error) {
      body.push('')
      body.push(`Error: ${result.error.message}`)
    }
    renderError({
      headline: `FAILED: ${result.name} (${durationStr})`,
      body,
    })
  } else {
    renderWarning({
      headline: `SKIPPED: ${result.name}`,
    })
  }
}

export function reportSummary(results: TestResult[]): void {
  const passed = results.filter((result) => result.status === 'passed').length
  const failed = results.filter((result) => result.status === 'failed').length
  const skipped = results.filter((result) => result.status === 'skipped').length
  const total = results.length
  const totalDuration = results.reduce((sum, result) => sum + result.duration, 0)

  const headline =
    failed > 0 ? `Audit Complete: ${failed}/${total} tests failed` : `Audit Complete: ${passed}/${total} tests passed`

  const body = [
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    `Skipped: ${skipped}`,
    `Total time: ${(totalDuration / 1000).toFixed(2)}s`,
  ]

  if (failed > 0) {
    renderError({headline, body})
  } else {
    renderSuccess({headline, body})
  }
}

function formatAssertionsBody(assertions: AssertionResult[]): string[] {
  return assertions.map((assertion) => {
    const icon = assertion.passed ? '[OK]' : '[FAIL]'
    const details = assertion.passed
      ? ''
      : ` (expected: ${String(assertion.expected)}, actual: ${String(assertion.actual)})`
    return `  ${icon} ${assertion.description}${details}`
  })
}
