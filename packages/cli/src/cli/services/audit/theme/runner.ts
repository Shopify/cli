import ThemeInitTests from './tests/init.js'
import ThemePushTests from './tests/push.js'
import {createAuditContext} from '../context.js'
import {reportTestStart, reportTestResult, reportSuiteStart, reportSummary} from '../reporter.js'
import {AuditSuite} from '../framework.js'
import type {TestResult, AuditTest, ThemeAuditOptions, SuiteResult} from '../types.js'

// Class-based test suites
const themeSuites: (new () => AuditSuite)[] = [
  ThemeInitTests,
  ThemePushTests,
  // Future suites:
  // ThemeListTests,
  // ThemePullTests,
]

// Legacy object-based tests (for backwards compatibility during transition)
const legacyTests: AuditTest[] = [
  // All tests migrated to class-based suites
  // Future tests can still use old API if needed
]

/**
 * Run all theme audit test suites (new class-based API)
 */
export async function runThemeAuditSuites(options: ThemeAuditOptions = {}): Promise<SuiteResult[]> {
  const suiteResults: SuiteResult[] = []
  const context = createAuditContext(options)
  const hasStoreConnection = Boolean(context.environment || context.store)

  for (const SuiteClass of themeSuites) {
    const suite = new SuiteClass()
    const description = (SuiteClass as unknown as {description: string}).description ?? 'Test suite'
    const requiresStore = (SuiteClass as unknown as {requiresStore?: boolean}).requiresStore ?? false

    // Skip suites that require store if no store connection
    if (requiresStore && !hasStoreConnection) {
      suiteResults.push({
        name: SuiteClass.name,
        description,
        results: [],
        duration: 0,
      })
      continue
    }

    reportSuiteStart(SuiteClass.name, description)
    const startTime = Date.now()

    // eslint-disable-next-line no-await-in-loop
    const results = await suite.runSuite(context)

    for (const result of results) {
      reportTestResult(result)
    }

    suiteResults.push({
      name: SuiteClass.name,
      description,
      results,
      duration: Date.now() - startTime,
    })

    // Stop if fail-fast and any test failed
    if (options.failFast && results.some((r) => r.status === 'failed')) {
      break
    }
  }

  return suiteResults
}

/**
 * Run theme audit (mixed mode - supports both new suites and legacy tests)
 */
export async function runThemeAudit(options: ThemeAuditOptions = {}): Promise<TestResult[]> {
  const results: TestResult[] = []
  const context = createAuditContext(options)

  // Check if we have store connection for tests that require it
  const hasStoreConnection = Boolean(context.environment || context.store)

  // Run new class-based suites first
  for (const SuiteClass of themeSuites) {
    const suite = new SuiteClass()
    const suiteName = SuiteClass.name
    const requiresStore = (SuiteClass as unknown as {requiresStore?: boolean}).requiresStore ?? false

    // Skip suites that require store if no store connection
    if (requiresStore && !hasStoreConnection) {
      continue
    }

    // Handle only/skip filters at suite level
    if (options.only && options.only.length > 0) {
      // Check if any test in options.only matches this suite
      const suiteMatches = options.only.some((name) => name.startsWith(suiteName) || suiteName.includes(name))
      if (!suiteMatches) continue
    }

    // eslint-disable-next-line no-await-in-loop
    const suiteResults = await suite.runSuite(context)

    for (const result of suiteResults) {
      reportTestStart(result.name)
      reportTestResult(result)
      results.push(result)

      // Stop if fail-fast and test failed
      if (options.failFast && result.status === 'failed') {
        reportSummary(results)
        return results
      }
    }
  }

  // Then run legacy object-based tests
  for (const test of legacyTests) {
    // Handle only/skip filters
    if (options.only && options.only.length > 0 && !options.only.includes(test.name)) {
      continue
    }
    if (options.skip && options.skip.includes(test.name)) {
      results.push({
        name: test.name,
        status: 'skipped',
        duration: 0,
        assertions: [],
      })
      continue
    }

    // Skip tests that require store if no store connection
    if (test.requiresStore && !hasStoreConnection) {
      results.push({
        name: test.name,
        status: 'skipped',
        duration: 0,
        assertions: [],
        error: new Error('Test requires store connection. Use -e <environment> flag.'),
      })
      continue
    }

    reportTestStart(test.name)

    // eslint-disable-next-line no-await-in-loop
    const result = await test.run(context)
    results.push(result)

    reportTestResult(result)

    // Stop if fail-fast and test failed
    if (options.failFast && result.status === 'failed') {
      break
    }
  }

  reportSummary(results)
  return results
}
