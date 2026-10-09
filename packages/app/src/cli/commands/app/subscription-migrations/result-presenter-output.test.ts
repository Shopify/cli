import {presentMigrationCancellationResult, presentMigrationSubmissionResult} from './result-presenter.js'
import {cancelMigrationOperations} from '../../../services/subscription-migrations/cancel-operations.js'
import {
  projectMigrationOperation,
  projectMigrationSubmissionResult,
} from '../../../services/subscription-migrations/result-codec.js'
import {outputOperations} from '../../../services/subscription-migrations/command-output.js'
import {watchMigrationOperations} from '../../../services/subscription-migrations/watch-operations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {beforeEach, describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
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

describe('migration submission JSON output', () => {
  test.each([false, true])('writes one final failure document with watch=%s', (watch) => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const submission = {
      clientId: 'client-id',
      action: 'schedule' as const,
      inputDigest: 'input-digest',
      total: 2,
      operations: [
        {
          batchIndex: 0,
          batchPayloadDigest: 'batch-digest',
          operation: {
            id: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
            status: 'RUNNING' as const,
            total: 1,
            results: {edges: []},
          },
        },
      ],
    }
    const failure = {type: 'submission' as const, batchIndex: 1, userErrors: [{message: 'Rejected', field: null}]}

    try {
      expect(presentMigrationSubmissionResult({status: 'failed', submission, failure}, {json: true, watch})).toBe(1)

      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout.mock.calls[0]?.[0]).toBe(
        `${JSON.stringify(projectMigrationSubmissionResult({status: 'failed', submission, failure}), null, 2)}\n`,
      )
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

describe('migration status JSON output', () => {
  test('writes the final result to stdout and typed watch progress to stderr', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    // Use Node's console so Vitest's console capture does not bypass stderr.
    const warn = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)
    const running = {
      id: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
      status: 'RUNNING' as const,
      total: 1,
      results: {edges: []},
    }
    const completed = {...running, status: 'COMPLETED' as const}

    try {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const operations = await watchMigrationOperations({
          clientId: 'client-id',
          operationIds: [running.id],
          waitForOperations: async ({onUpdate}) => {
            await onUpdate?.([running])
            await onUpdate?.([completed])
            expect(stdout).not.toHaveBeenCalled()
            return [completed]
          },
        })
        outputOperations(operations, true)
      })

      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout.mock.calls[0]?.[0]).toBe(
        `${JSON.stringify({operations: [projectMigrationOperation(completed)]}, null, 2)}\n`,
      )
      const events = stderr.mock.calls.map(([content]) => JSON.parse(content as string))
      expect(events).toEqual([
        expect.objectContaining({
          type: 'progress',
          status: 'started',
          message: 'Polling subscription migration operations',
        }),
        expect.objectContaining({
          type: 'progress',
          status: 'updated',
          message: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one: RUNNING (0/1 settled)',
        }),
        expect.objectContaining({
          type: 'progress',
          status: 'updated',
          message: 'gid://shopify/AppSubscriptionMigrationOperation/operation-one: COMPLETED (0/1 settled)',
        }),
        expect.objectContaining({type: 'progress', status: 'completed'}),
      ])
    } finally {
      warn.mockRestore()
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})
