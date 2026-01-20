import {initTest} from './tests/init.js'
import {pushTest} from './tests/push.js'
import {createAuditContext} from '../context.js'
import {reportTestStart, reportTestResult, reportSummary} from '../reporter.js'
import type {TestResult, AuditTest, ThemeAuditOptions} from '../types.js'

// Tests run in order - they may depend on each other
// Future tests will be added here in order:
// import {listTest} from './tests/list.js'
// import {pullTest} from './tests/pull.js'
const themeTests: AuditTest[] = [
  initTest,
  pushTest,
  // Future tests:
  // listTest,
  // pullTest,
  // devTest,
  // deleteTest,
]

export async function runThemeAudit(options: ThemeAuditOptions = {}): Promise<TestResult[]> {
  const results: TestResult[] = []
  const context = createAuditContext(options)

  // Check if we have store connection for tests that require it
  const hasStoreConnection = Boolean(context.environment || context.store)

  for (const test of themeTests) {
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
