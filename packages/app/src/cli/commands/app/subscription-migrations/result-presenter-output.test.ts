import {presentMigrationCancellationResult} from './result-presenter.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationCancellationResult} from '../../../services/subscription-migrations/types.js'

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
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/operation-two',
          operation: null,
          userErrors: [{message: 'Operation not found', field: null}],
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
          ...(outcome.status === 'failed' && 'userErrors' in outcome
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

  test.each(['empty payload', 'HTTP 403'])(
    'retains every batch outcome and the shared error for %s',
    async (failure) => {
      const successfulId = 'gid://shopify/AppSubscriptionMigrationOperation/one'
      const failedId = 'gid://shopify/AppSubscriptionMigrationOperation/two'
      const forbiddenError = Object.assign(
        new AbortError(
          'Forbidden',
          'Ensure you are using the correct account. You can switch with `shopify auth login`',
        ),
        {
          request: {authorization: 'secret'},
          accessToken: 'secret',
        },
      )
      const cancelOperation = vi.fn().mockResolvedValueOnce({
        operation: {id: successfulId, status: 'CANCELED', total: 1, results: {edges: []}},
        userErrors: [],
      })
      if (failure === 'empty payload') {
        cancelOperation.mockResolvedValueOnce({operation: null, userErrors: []})
      } else {
        cancelOperation.mockRejectedValueOnce(forbiddenError)
      }
      const result = await cancelMigrationOperations({
        clientId: 'client-id',
        operationIds: [successfulId, failedId],
        cancelOperation,
      })
      const expectedError =
        failure === 'empty payload'
          ? {
              type: 'bug',
              message: `Migration cancellation for ${failedId} returned neither an operation nor user errors`,
              stack: expect.any(String),
            }
          : {
              type: 'abort',
              message: 'Forbidden',
              tryMessage: 'Ensure you are using the correct account. You can switch with `shopify auth login`',
            }
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      try {
        expect(presentMigrationCancellationResult(result, {json: true})).toBe(1)

        expect(stdout).toHaveBeenCalledOnce()
        expect(JSON.parse(stdout.mock.calls[0]![0] as string)).toEqual({
          status: 'partial',
          operations: [
            {
              status: 'success',
              operationGid: successfulId,
              operation: {gid: successfulId, status: 'CANCELED', total: 1, results: []},
            },
            {status: 'failed', operationGid: failedId, operation: null, error: expectedError},
          ],
        })
        expect(stderr).not.toHaveBeenCalled()
      } finally {
        stdout.mockRestore()
        stderr.mockRestore()
      }
    },
  )
})
