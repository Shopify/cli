import {formatMigrationOperationsStatus, outputOperations, outputSubmission} from './command-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationSubmission} from './submit-migration-plan.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

function operation(id: string, status: MigrationOperation['status'] = 'RUNNING'): MigrationOperation {
  return {
    id,
    status,
    total: 2,
    results: {edges: [{node: {shopId: 'gid://shopify/Shop/1', code: 'SCHEDULED'}}]},
  }
}

function submission(action: MigrationSubmission['action'] = 'schedule'): MigrationSubmission {
  return {
    clientId: 'client-id',
    action,
    rootIdempotencyKey: 'root-key',
    inputDigest: 'input-digest',
    total: 2,
    operations: [
      {
        batchIndex: 0,
        batchPayloadDigest: 'batch-digest',
        idempotencyKey: 'batch-key',
        operation: operation('gid://shopify/AppSubscriptionMigrationOperation/1'),
      },
    ],
  }
}

describe('command output', () => {
  beforeEach(() => {
    vi.mocked(outputResult).mockReset()
    vi.mocked(renderSuccess).mockReset()
    vi.mocked(renderInfo).mockReset()
    vi.mocked(renderWarning).mockReset()
  })

  test('outputs the exact submission JSON schema without local or history fields', () => {
    const value = submission()

    outputSubmission(value, {json: true})

    const expected = JSON.stringify({schemaVersion: 1, ...value}, null, 2)
    expect(outputResult).toHaveBeenCalledWith(expected)
    expect(expected).not.toContain('"run"')
    expect(expected).not.toContain('"localId"')
    expect(expected).not.toContain('"source"')
    expect(expected).not.toContain('"history"')
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test.each([
    ['schedule', 'scheduled'],
    ['unschedule', 'unscheduled'],
  ] as const)('renders %s submission evidence with a differentiated headline', (action, headlineAction) => {
    outputSubmission(submission(action), {json: false})

    expect(renderSuccess).toHaveBeenCalledOnce()
    const rendered = JSON.stringify(vi.mocked(renderSuccess).mock.calls[0]?.[0])
    expect(rendered).toContain(headlineAction)
    expect(rendered).toContain('Root idempotency key: root-key')
    expect(rendered).toContain('Shops: 2')
    expect(rendered).toContain('Operation IDs:')
    expect(rendered).toContain('gid://shopify/AppSubscriptionMigrationOperation/1')
    expect(rendered).toContain('Save the root idempotency key and every operation ID')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('renders accepted partial submission evidence as a warning', () => {
    const partialSubmission = submission()
    partialSubmission.operations.push({
      batchIndex: 1,
      batchPayloadDigest: 'batch-digest-2',
      idempotencyKey: 'batch-key-2',
      operation: operation('gid://shopify/AppSubscriptionMigrationOperation/2'),
    })

    outputSubmission(partialSubmission, {json: false, partial: true})

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderInfo).not.toHaveBeenCalled()
    expect(renderWarning).toHaveBeenCalledOnce()
    expect(renderWarning).toHaveBeenCalledWith({
      headline: 'Some subscription migration operations were accepted before submission failed.',
      body: [
        'Root idempotency key: root-key',
        'Accepted operation IDs:',
        'gid://shopify/AppSubscriptionMigrationOperation/1',
        'gid://shopify/AppSubscriptionMigrationOperation/2',
        'Save the root idempotency key and every accepted operation ID. You will need them to check or cancel accepted operations.',
      ],
    })
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('renders a warning when submission fails before any operations are accepted', () => {
    const partialSubmission = submission()
    partialSubmission.operations = []

    outputSubmission(partialSubmission, {json: false, partial: true})

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({body: expect.arrayContaining(['Accepted operation IDs: None.'])}),
    )
  })

  test('keeps the exact submission JSON schema for partial evidence', () => {
    const value = submission()

    outputSubmission(value, {json: true, partial: true})

    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({schemaVersion: 1, ...value}, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('formats operation progress in input order with status and settled counts', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'RUNNING')]

    expect(formatMigrationOperationsStatus(operations)).toBe(
      'one: COMPLETED (1/2 settled) · two: RUNNING (1/2 settled)',
    )
  })

  test('outputs the exact operations JSON schema', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'FAILED')]

    outputOperations(operations, true)

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({schemaVersion: 1, operations}, null, 2))
    const jsonDocument = vi.mocked(outputResult).mock.calls[0]?.[0]
    if (typeof jsonDocument !== 'string') throw new Error('Expected operations output to be one JSON document')
    expect(JSON.parse(jsonDocument)).toEqual({schemaVersion: 1, operations})
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders each operation status and settled count for human output', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'RUNNING')]

    outputOperations(operations, false)

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Subscription migration operations.',
      body: ['one: COMPLETED (1/2 settled)', 'two: RUNNING (1/2 settled)'],
    })
    expect(outputResult).not.toHaveBeenCalled()
  })
})
