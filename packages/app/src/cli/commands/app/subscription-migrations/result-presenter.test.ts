import {
  presentAcceptedMigrationSubmission,
  presentMigrationCancellationResult,
  presentMigrationSubmissionResult,
} from './result-presenter.js'
import {projectMigrationSubmissionResult} from '../../../services/subscription-migrations/result-codec.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {
  MigrationCancellationResult,
  MigrationSubmission,
  MigrationSubmissionResult,
} from '../../../services/subscription-migrations/types.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

function operation(id: string, status: MigrationOperation['status'] = 'RUNNING'): MigrationOperation {
  return {id, status, total: 2, results: {edges: []}}
}

function submission(): MigrationSubmission {
  return {
    clientId: 'client-id',
    action: 'schedule',
    inputDigest: 'input-digest',
    total: 2,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        operation: operation('gid://shopify/AppSubscriptionMigrationOperation/operation-one'),
      },
    ],
  }
}

beforeEach(() => {
  vi.mocked(outputResult).mockReset()
  vi.mocked(renderInfo).mockReset()
  vi.mocked(renderSuccess).mockReset()
  vi.mocked(renderWarning).mockReset()
})

describe('migration submission result presenter', () => {
  test('outputs exactly one successful JSON document', () => {
    const value = submission()
    const result: MigrationSubmissionResult = {status: 'success', submission: value}

    const exitCode = presentMigrationSubmissionResult(result, {json: true, watch: false})

    expect(exitCode).toBe(0)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual(
      projectMigrationSubmissionResult(result),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('outputs exactly one operation failure JSON document without invoking a fatal renderer', () => {
    const value = submission()
    value.operations[0]!.operation = operation(
      'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
      'FAILED',
    )
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {type: 'operations', operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/operation-one']},
    }

    const exitCode = presentMigrationSubmissionResult(result, {json: true, watch: true})

    expect(exitCode).toBe(1)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual(
      projectMigrationSubmissionResult(result),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders successful unwatched submission evidence', () => {
    const result: MigrationSubmissionResult = {status: 'success', submission: submission()}

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: false})

    expect(exitCode).toBe(0)
    expect(renderSuccess).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])
    expect(rendered).toContain('Subscription migrations scheduled.')
    expect(rendered).not.toContain('idempotency')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-one')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('renders terminal operations for watched human success', () => {
    const value = submission()
    value.operations[0]!.operation = operation(
      'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
      'COMPLETED',
    )
    const result: MigrationSubmissionResult = {status: 'success', submission: value}

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: true})

    expect(exitCode).toBe(0)
    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Subscription migration operations.',
      body: ['gid://shopify/AppSubscriptionMigrationOperation/operation-one: COMPLETED (0/2 settled)'],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders accepted submission evidence for watched human progress', () => {
    presentAcceptedMigrationSubmission(submission())

    expect(renderSuccess).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-one')
    expect(rendered).not.toContain('idempotency')
  })

  test('renders one warning containing failed IDs and terminal operation evidence', () => {
    const value = submission()
    value.operations.push({
      batchIndex: 1,
      batchPayloadDigest: 'batch-digest-two',
      operation: operation('gid://shopify/AppSubscriptionMigrationOperation/operation-two', 'COMPLETED'),
    })
    value.operations[0]!.operation = operation(
      'gid://shopify/AppSubscriptionMigrationOperation/operation-one',
      'FAILED',
    )
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {type: 'operations', operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/operation-one']},
    }

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: true})

    expect(exitCode).toBe(1)
    expect(renderWarning).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]?.[0])
    expect(rendered).not.toContain('idempotency')
    expect(rendered).toContain('Failed operation IDs')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-one')
    expect(rendered).toContain('FAILED')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-two')
    expect(rendered).toContain('COMPLETED')
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderInfo).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('renders one warning containing accepted IDs and every submission error', () => {
    const value = submission()
    value.operations.push({
      batchIndex: 1,
      batchPayloadDigest: 'batch-digest-two',
      operation: operation('gid://shopify/AppSubscriptionMigrationOperation/operation-two'),
    })
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failure: {
        type: 'submission',
        batchIndex: 2,
        userErrors: [
          {message: 'Rejected remaining shops', field: ['input']},
          {message: 'Invalid plan', field: null},
        ],
      },
    }

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: false})

    expect(exitCode).toBe(1)
    expect(renderWarning).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]?.[0])
    expect(rendered).not.toContain('idempotency')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-one')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/operation-two')
    expect(rendered).toContain('Batch index: 2')
    expect(rendered).toContain('Rejected remaining shops')
    expect(rendered).toContain('Invalid plan')
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test.each([false, true])(
    'throws a fatal error for a failed submission without accepted work with json=%s',
    (json) => {
      const value = {...submission(), operations: []}
      const result: MigrationSubmissionResult = {
        status: 'failed',
        submission: value,
        failure: {
          type: 'submission',
          batchIndex: 0,
          userErrors: [
            {message: 'App not found', field: ['apiKey']},
            {message: 'Invalid plan', field: null},
          ],
        },
      }
      expect(() => presentMigrationSubmissionResult(result, {json, watch: false})).toThrow(
        expect.objectContaining({
          message: 'Subscription migration submission failed.\nApp not found\nInvalid plan',
          details: {
            batchIndex: 0,
            userErrors: [
              {message: 'App not found', fieldPath: ['apiKey']},
              {message: 'Invalid plan', fieldPath: null},
            ],
          },
        }),
      )
      expect(outputResult).not.toHaveBeenCalled()
    },
  )

  test('writes a declined confirmation result and exits zero', () => {
    const result = {
      status: 'cancelled' as const,
      changed: false as const,
      action: 'schedule' as const,
      reason: 'Confirmation declined.',
    }
    expect(presentMigrationSubmissionResult(result, {json: true, watch: false})).toBe(0)
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual(result)
  })
})

describe('migration cancellation result presenter', () => {
  test.each([false, true])('throws a fatal error for one failed cancellation with json=%s', (json) => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: null,
          userErrors: [{message: 'Operation not found', field: ['id']}],
        },
      ],
    }
    expect(() => presentMigrationCancellationResult(result, {json})).toThrow('Operation not found')
    expect(outputResult).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('outputs exactly one JSON document and reports failure', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one', 'CANCELED'),
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
          operation: null,
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
      ],
    }

    const exitCode = presentMigrationCancellationResult(result, {json: true})

    expect(exitCode).toBe(1)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
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
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders successful and failed cancellations together without discarding returned operations', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one', 'CANCELED'),
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/two', 'COMPLETED'),
          userErrors: [
            {message: 'Already completed', field: ['id']},
            {message: 'Cancellation denied', field: null},
          ],
        },
      ],
    }

    const exitCode = presentMigrationCancellationResult(result, {json: false})

    expect(exitCode).toBe(1)
    expect(renderWarning).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]?.[0])
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/one')
    expect(rendered).toContain('CANCELED')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/two')
    expect(rendered).toContain('COMPLETED')
    expect(rendered).toContain('Already completed')
    expect(rendered).toContain('Cancellation denied')
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders all successful cancellations and reports success', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one', 'CANCELED'),
        },
      ],
    }

    const exitCode = presentMigrationCancellationResult(result, {json: false})

    expect(exitCode).toBe(0)
    expect(renderSuccess).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])).toContain(
      'gid://shopify/AppSubscriptionMigrationOperation/one',
    )
    expect(renderWarning).not.toHaveBeenCalled()
  })
})
