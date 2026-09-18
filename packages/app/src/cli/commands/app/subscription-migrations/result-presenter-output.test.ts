import {presentMigrationCancellationResult} from './result-presenter.js'
import {outputMigrationList} from '../../../services/subscription-migrations/list-output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const isUnitTest = vi.hoisted(() => vi.fn(() => false))

vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest,
}))

beforeEach(() => {
  isUnitTest.mockReturnValue(false)
})

describe('migration cancellation JSON output', () => {
  test('writes one parseable JSON document to stdout without stderr output', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const result = {
      outcomes: [
        {
          status: 'failed' as const,
          operationId: 'operation-one',
          operation: null,
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
      ],
    }

    try {
      expect(presentMigrationCancellationResult(result, {json: true})).toBe(1)

      expect(stdout).toHaveBeenCalledOnce()
      const output = stdout.mock.calls[0]?.[0]
      expect(typeof output).toBe('string')
      expect(JSON.parse(output as string)).toEqual({schemaVersion: 1, outcomes: result.outcomes})
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

describe('migration list JSON output', () => {
  test('writes all pages as one JSON document to stdout', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const subscription = {
      shopId: 'gid://shopify/Shop/1',
      status: 'UNSCHEDULED' as const,
      manualSubscriptionName: null,
      manualSubscriptionPrice: null,
      manualSubscriptionInterval: 'ANNUAL' as const,
      targetPlanHandle: null,
      notification: null,
      priceBehavior: null,
      effectiveDate: null,
      lastFailureReason: null,
    }
    async function* pages() {
      yield [subscription]
      expect(stdout).not.toHaveBeenCalled()
      yield []
    }

    try {
      await outputMigrationList({pages: pages(), json: true})

      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout.mock.calls[0]?.[0]).toBe(
        `${JSON.stringify({schemaVersion: 1, subscriptions: [subscription]}, null, 2)}\n`,
      )
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})
