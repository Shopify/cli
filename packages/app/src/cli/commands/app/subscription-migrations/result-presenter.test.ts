import {
  presentAcceptedMigrationSubmission,
  presentMigrationCancellationResult,
  presentMigrationSubmissionResult,
} from './result-presenter.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../../models/subscription-migrations.js'
import type {MigrationCancellationResult} from '../../../services/subscription-migrations/cancel-operations.js'
import type {
  MigrationSubmission,
  MigrationSubmissionResult,
} from '../../../services/subscription-migrations/submit-migration-plan.js'

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
    rootIdempotencyKey: 'root-key',
    inputDigest: 'input-digest',
    total: 2,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        idempotencyKey: 'batch-key',
        operation: operation('operation-one'),
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
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({schemaVersion: 1, ...value})
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('outputs exactly one failed JSON document without invoking a fatal renderer', () => {
    const value = submission()
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failedBatchIndex: 1,
      userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
    }

    const exitCode = presentMigrationSubmissionResult(result, {json: true, watch: true})

    expect(exitCode).toBe(1)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
      schemaVersion: 1,
      ...value,
      failure: {
        batchIndex: 1,
        userErrors: [{message: 'Rejected remaining shops', field: ['input']}],
      },
    })
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
    expect(rendered).toContain('Root idempotency key: root-key')
    expect(rendered).toContain('operation-one')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('renders terminal operations for watched human success', () => {
    const value = submission()
    value.operations[0]!.operation = operation('operation-one', 'COMPLETED')
    const result: MigrationSubmissionResult = {status: 'success', submission: value}

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: true})

    expect(exitCode).toBe(0)
    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Subscription migration operations.',
      body: ['operation-one: COMPLETED (0/2 settled)'],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders accepted submission evidence for watched human progress', () => {
    presentAcceptedMigrationSubmission(submission())

    expect(renderSuccess).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])).toContain('Root idempotency key: root-key')
  })

  test('renders one warning containing accepted IDs and every submission error', () => {
    const value = submission()
    value.operations.push({
      batchIndex: 1,
      batchPayloadDigest: 'batch-digest-two',
      idempotencyKey: 'batch-key-two',
      operation: operation('operation-two'),
    })
    const result: MigrationSubmissionResult = {
      status: 'failed',
      submission: value,
      failedBatchIndex: 2,
      userErrors: [
        {message: 'Rejected remaining shops', field: ['input']},
        {message: 'Invalid plan', field: null},
      ],
    }

    const exitCode = presentMigrationSubmissionResult(result, {json: false, watch: false})

    expect(exitCode).toBe(1)
    expect(renderWarning).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]?.[0])
    expect(rendered).toContain('Root idempotency key: root-key')
    expect(rendered).toContain('operation-one')
    expect(rendered).toContain('operation-two')
    expect(rendered).toContain('Batch index: 2')
    expect(rendered).toContain('Rejected remaining shops')
    expect(rendered).toContain('Invalid plan')
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })
})

describe('migration cancellation result presenter', () => {
  test('outputs exactly one JSON document and reports failure', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {status: 'success', operationId: 'one', operation: operation('one', 'CANCELED')},
        {
          status: 'failed',
          operationId: 'two',
          operation: null,
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
      ],
    }

    const exitCode = presentMigrationCancellationResult(result, {json: true})

    expect(exitCode).toBe(1)
    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual({
      schemaVersion: 1,
      outcomes: result.outcomes,
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders successful and failed cancellations together without discarding returned operations', () => {
    const result: MigrationCancellationResult = {
      outcomes: [
        {status: 'success', operationId: 'one', operation: operation('one', 'CANCELED')},
        {
          status: 'failed',
          operationId: 'two',
          operation: operation('two', 'COMPLETED'),
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
    expect(rendered).toContain('one')
    expect(rendered).toContain('CANCELED')
    expect(rendered).toContain('two')
    expect(rendered).toContain('COMPLETED')
    expect(rendered).toContain('Already completed')
    expect(rendered).toContain('Cancellation denied')
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders all successful cancellations and reports success', () => {
    const result: MigrationCancellationResult = {
      outcomes: [{status: 'success', operationId: 'one', operation: operation('one', 'CANCELED')}],
    }

    const exitCode = presentMigrationCancellationResult(result, {json: false})

    expect(exitCode).toBe(0)
    expect(renderSuccess).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])).toContain('one')
    expect(renderWarning).not.toHaveBeenCalled()
  })
})
