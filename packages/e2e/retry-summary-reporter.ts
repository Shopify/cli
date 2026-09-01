import type {FullConfig, Reporter, Suite, TestCase, TestResult} from '@playwright/test/reporter'

type TestStatus = TestResult['status']

export interface RetryTestResult {
  title: string
  expectedStatus: TestStatus
  attempts: {retry: number; status: TestStatus}[]
}

export interface RetrySummary {
  firstAttemptFailures: string[]
  passedRetries: string[]
  persistentFailures: string[]
}

export function summarizeRetryTests(tests: RetryTestResult[]): RetrySummary {
  const summary: RetrySummary = {
    firstAttemptFailures: [],
    passedRetries: [],
    persistentFailures: [],
  }

  for (const test of tests) {
    const firstAttempt = test.attempts.find(({retry}) => retry === 0)
    if (!firstAttempt || firstAttempt.status === test.expectedStatus) continue

    summary.firstAttemptFailures.push(test.title)
    if (test.attempts.some(({retry, status}) => retry > 0 && status === test.expectedStatus)) {
      summary.passedRetries.push(test.title)
    } else {
      summary.persistentFailures.push(test.title)
    }
  }

  return summary
}

export default class RetrySummaryReporter implements Reporter {
  private remoteTests: TestCase[] = []

  onBegin(_config: FullConfig, suite: Suite): void {
    this.remoteTests = suite.allTests().filter((test) => test.parent.project()?.name === 'remote')
  }

  onEnd(): void {
    if (this.remoteTests.length === 0) return

    const summary = summarizeRetryTests(
      this.remoteTests.map((test) => ({
        title: test.titlePath().join(' > '),
        expectedStatus: test.expectedStatus,
        attempts: test.results.map(({retry, status}) => ({retry, status})),
      })),
    )

    this.printTests('first-attempt-failure', summary.firstAttemptFailures)
    this.printTests('passed-retry', summary.passedRetries)
    this.printTests('persistent-failure', summary.persistentFailures)
    process.stdout.write(
      `[e2e][retry-summary] first_attempt_failures=${summary.firstAttemptFailures.length} ` +
        `passed_retries=${summary.passedRetries.length} persistent_failures=${summary.persistentFailures.length}\n`,
    )
  }

  printsToStdio(): boolean {
    return true
  }

  private printTests(category: string, tests: string[]): void {
    for (const test of tests) {
      process.stdout.write(`[e2e][retry-summary] ${category} test=${JSON.stringify(test)}\n`)
    }
  }
}
