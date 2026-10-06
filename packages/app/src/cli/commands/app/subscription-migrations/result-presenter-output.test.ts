import {presentMigrationCancellationResult} from './result-presenter.js'
import type {MigrationCancellationResult} from '../../../services/subscription-migrations/types.js'
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
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'failed' as const,
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
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
      expect(JSON.parse(output as string)).toEqual({
        status: 'partial',
        operations: result.outcomes.map((outcome) => ({
          status: outcome.status,
          operationGid: outcome.operationId,
          operation:
            outcome.operation === null
              ? null
              : {
                  gid: outcome.operation.id,
                  status: outcome.operation.status,
                  total: outcome.operation.total,
                  results: outcome.operation.results.edges.map(({node}) => ({shopGid: node.shopId, code: node.code})),
                },
          ...(outcome.status === 'failed'
            ? {
                error: {
                  type: 'abort',
                  message: outcome.userErrors.map(({message}) => message).join('; '),
                  details: {userErrors: outcome.userErrors.map(({message, field}) => ({message, fieldPath: field}))},
                },
              }
            : {}),
        })),
      })
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})
