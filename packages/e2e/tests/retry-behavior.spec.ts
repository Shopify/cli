import {summarizeRetryTests} from '../retry-summary-reporter.js'
import {e2eAppName} from '../setup/env.js'
import {generateStoreName} from '../setup/store.js'
import {expect, test} from '@playwright/test'

test.describe('remote retries', () => {
  test('reports first failures, recovered retries, and persistent failures separately', () => {
    const summary = summarizeRetryTests([
      {
        title: 'passes immediately',
        expectedStatus: 'passed',
        attempts: [{retry: 0, status: 'passed'}],
      },
      {
        title: 'passes on retry',
        expectedStatus: 'passed',
        attempts: [
          {retry: 0, status: 'failed'},
          {retry: 1, status: 'passed'},
        ],
      },
      {
        title: 'fails persistently',
        expectedStatus: 'passed',
        attempts: [
          {retry: 0, status: 'timedOut'},
          {retry: 1, status: 'failed'},
        ],
      },
    ])

    expect(summary.firstAttemptFailures).toEqual(['passes on retry', 'fails persistently'])
    expect(summary.passedRetries).toEqual(['passes on retry'])
    expect(summary.persistentFailures).toEqual(['fails persistently'])
  })

  test('uses the retry index to create distinct app and store names', () => {
    const originalNow = Date.now
    Date.now = () => 1_786_704_000_000

    try {
      expect(e2eAppName('dev', 0)).not.toBe(e2eAppName('dev', 1))
      expect(generateStoreName(2, 0)).not.toBe(generateStoreName(2, 1))
    } finally {
      Date.now = originalNow
    }
  })
})
