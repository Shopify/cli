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
    id,
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
