import ThemeInitTests from './tests/init.js'
import ThemePushTests from './tests/push.js'
import {createDoctorContext} from '../context.js'
import {
  reportTestStart,
  reportTestResult,
  reportSuiteStart,
  reportSummary,
  initReporter,
} from '@shopify/cli-kit/node/doctor/reporter'
import {DoctorSuite} from '@shopify/cli-kit/node/doctor/framework'
import type {ThemeDoctorContext, ThemeDoctorOptions} from '../context.js'
import type {TestResult} from '@shopify/cli-kit/node/doctor/types'

// Test suites run in order. If a test relies on another, ensure that test runs after it's dependency.
const themeSuites: (new () => DoctorSuite<ThemeDoctorContext>)[] = [ThemeInitTests, ThemePushTests]

/**
 * Run all theme doctor tests.
 * Stops on first failure.
 */
export async function runThemeDoctor(options: ThemeDoctorOptions, commandHandle?: string): Promise<TestResult[]> {
  const results: TestResult[] = []
  const context = createDoctorContext(options, commandHandle)

  // Initialize reporter with working directory
  initReporter(context.workingDirectory)

  // Run all test suites in order
  for (const SuiteClass of themeSuites) {
    const suite = new SuiteClass()
    const description = (SuiteClass as unknown as {description: string}).description ?? 'Test suite'

    reportSuiteStart(SuiteClass.name, description)

    // eslint-disable-next-line no-await-in-loop
    const suiteResults = await suite.runSuite(context)

    for (const result of suiteResults) {
      reportTestStart(result.name)
      reportTestResult(result)
      results.push(result)

      // Stop on first failure
      if (result.status === 'failed') {
        reportSummary(results)
        return results
      }
    }
  }

  reportSummary(results)
  return results
}
