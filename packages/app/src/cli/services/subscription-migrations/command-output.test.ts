import {projectMigrationOperation} from './result-codec.js'
import {migrationStatusJsonOutputSchema} from './types.js'
import {formatMigrationOperationsStatus, outputOperations} from './command-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

function operation(id: string, status: MigrationOperation['status'] = 'RUNNING'): MigrationOperation {
  return {
    id: `gid://shopify/AppSubscriptionMigrationOperation/${id}`,
    status,
    total: 2,
    results: {edges: [{node: {shopId: 'gid://shopify/Shop/1', code: 'SCHEDULED'}}]},
  }
}

describe('operation command output', () => {
  beforeEach(() => {
    vi.mocked(outputResult).mockReset()
    vi.mocked(renderInfo).mockReset()
  })

  test('formats operation progress in input order with status and settled counts', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'RUNNING')]

    expect(formatMigrationOperationsStatus(operations)).toBe(
      'gid://shopify/AppSubscriptionMigrationOperation/one: COMPLETED (1/2 settled) · gid://shopify/AppSubscriptionMigrationOperation/two: RUNNING (1/2 settled)',
    )
  })

  test('outputs the exact operations JSON schema', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'FAILED')]

    outputOperations(operations, true)

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify({operations: operations.map(projectMigrationOperation)}, null, 2),
    )
    const jsonDocument = vi.mocked(outputResult).mock.calls[0]?.[0]
    if (typeof jsonDocument !== 'string') throw new Error('Expected operations output to be one JSON document')
    expect(JSON.parse(jsonDocument)).toEqual({operations: operations.map(projectMigrationOperation)})
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders each operation status and settled count for human output', () => {
    const operations = [operation('one', 'COMPLETED'), operation('two', 'RUNNING')]

    outputOperations(operations, false)

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Subscription migration operations.',
      body: [
        'gid://shopify/AppSubscriptionMigrationOperation/one: COMPLETED (1/2 settled)',
        'gid://shopify/AppSubscriptionMigrationOperation/two: RUNNING (1/2 settled)',
      ],
    })
    expect(outputResult).not.toHaveBeenCalled()
  })
})

describe('migration status JSON contract', () => {
  test('encodes an empty operation list', () => {
    outputOperations([], true)
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({operations: []}, null, 2))
  })

  test('accepts future upstream resource statuses and result codes', () => {
    const value = {
      ...projectMigrationOperation(operation('one')),
      status: 'QUEUED',
      results: [{shopGid: 'gid://shopify/Shop/1', code: 'FUTURE_CODE'}],
    }
    expect(migrationStatusJsonOutputSchema.validate({operations: [value]})).toEqual({operations: [value]})
  })

  test.each([
    {...projectMigrationOperation(operation('one')), total: '2'},
    {...projectMigrationOperation(operation('one')), total: -1},
    {...projectMigrationOperation(operation('one')), unexpected: true},
    {...projectMigrationOperation(operation('one')), results: [{shopGid: 'shop-one', code: 'SCHEDULED'}]},
    {...projectMigrationOperation(operation('one')), results: null},
  ])('rejects invalid operations: %j', (value) => {
    expect(() => migrationStatusJsonOutputSchema.validate({operations: [value]})).toThrow()
  })
})
