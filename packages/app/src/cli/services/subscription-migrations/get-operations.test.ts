import {getMigrationOperations} from './get-operations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

function operation(id: string): MigrationOperation {
  return {id, status: 'RUNNING', total: 1, results: {edges: []}}
}

describe('getMigrationOperations', () => {
  test('fetches every ID once and returns operations in input order', async () => {
    const getOperation = vi.fn(({operationId}: {operationId: string}) => Promise.resolve(operation(operationId)))

    const operations = await getMigrationOperations({
      clientId: 'client-id',
      operationIds: ['two', 'one'],
      getOperation,
    })

    expect(operations.map(({id}) => id)).toEqual(['two', 'one'])
    expect(getOperation).toHaveBeenNthCalledWith(1, {clientId: 'client-id', operationId: 'two'})
    expect(getOperation).toHaveBeenNthCalledWith(2, {clientId: 'client-id', operationId: 'one'})
  })

  test('throws an exact AbortError when a fetched operation is missing', async () => {
    const getOperation = vi.fn().mockResolvedValue(null)

    const promise = getMigrationOperations({
      clientId: 'client-id',
      operationIds: ['missing'],
      getOperation,
    })

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Migration operation not found: missing')
  })
})
