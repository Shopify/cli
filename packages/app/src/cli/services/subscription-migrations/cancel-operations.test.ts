import {cancelMigrationOperations} from './cancel-operations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationOperationPayload} from './partners-api.js'

function operation(id: string): MigrationOperation {
  return {id, status: 'CANCELED', total: 1, results: {edges: []}}
}

function payload(id: string): MigrationOperationPayload {
  return {operation: operation(id), userErrors: []}
}

describe('cancelMigrationOperations', () => {
  test('cancels every ID and returns operations in input order', async () => {
    const cancelOperation = vi.fn(({operationId}: {operationId: string}) => Promise.resolve(payload(operationId)))

    const operations = await cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['two', 'one'],
      cancelOperation,
    })

    expect(cancelOperation).toHaveBeenNthCalledWith(1, {clientId: 'client-id', operationId: 'two'})
    expect(cancelOperation).toHaveBeenNthCalledWith(2, {clientId: 'client-id', operationId: 'one'})
    expect(operations.map(({id}) => id)).toEqual(['two', 'one'])
  })

  test('throws an AbortError containing all user error messages', async () => {
    const cancelOperation = vi.fn().mockResolvedValue({
      operation: operation('one'),
      userErrors: [
        {message: 'Already completed', field: ['id']},
        {message: 'Cancellation denied', field: null},
      ],
    })

    const promise = cancelMigrationOperations({clientId: 'client-id', operationIds: ['one'], cancelOperation})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Already completed\nCancellation denied')
  })

  test('throws an exact AbortError for a missing operation while still calling every ID', async () => {
    const cancelOperation = vi
      .fn()
      .mockResolvedValueOnce({operation: null, userErrors: []})
      .mockResolvedValueOnce(payload('two'))

    const promise = cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['missing', 'two'],
      cancelOperation,
    })

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Operation not found: missing')
    expect(cancelOperation).toHaveBeenCalledTimes(2)
  })
})
