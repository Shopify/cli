import {MigrationCancellationProtocolError, cancelMigrationOperations} from './cancel-operations.js'
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
  test('returns mixed success and failure outcomes in input order', async () => {
    const cancelOperation = vi.fn(({operationId}: {operationId: string}) => {
      if (operationId === 'failed') {
        return Promise.resolve({
          operation: operation(operationId),
          userErrors: [{message: 'Already completed', field: ['id']}],
        })
      }
      return Promise.resolve(payload(operationId))
    })

    const result = await cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['two', 'failed', 'one'],
      cancelOperation,
    })

    expect(cancelOperation).toHaveBeenNthCalledWith(1, {clientId: 'client-id', operationId: 'two'})
    expect(cancelOperation).toHaveBeenNthCalledWith(2, {clientId: 'client-id', operationId: 'failed'})
    expect(cancelOperation).toHaveBeenNthCalledWith(3, {clientId: 'client-id', operationId: 'one'})
    expect(result).toEqual({
      outcomes: [
        {status: 'success', operationId: 'two', operation: operation('two')},
        {
          status: 'failed',
          operationId: 'failed',
          operation: operation('failed'),
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
        {status: 'success', operationId: 'one', operation: operation('one')},
      ],
    })
  })

  test('returns every user error when cancellation has no operation', async () => {
    const cancelOperation = vi.fn().mockResolvedValue({
      operation: null,
      userErrors: [
        {message: 'Already completed', field: ['id']},
        {message: 'Cancellation denied', field: null},
      ],
    })

    const result = await cancelMigrationOperations({clientId: 'client-id', operationIds: ['one'], cancelOperation})

    expect(result).toEqual({
      outcomes: [
        {
          status: 'failed',
          operationId: 'one',
          operation: null,
          userErrors: [
            {message: 'Already completed', field: ['id']},
            {message: 'Cancellation denied', field: null},
          ],
        },
      ],
    })
  })

  test('throws a protocol error for an unexplained empty payload', async () => {
    const cancelOperation = vi.fn().mockResolvedValue({operation: null, userErrors: []})

    const promise = cancelMigrationOperations({clientId: 'client-id', operationIds: ['missing'], cancelOperation})

    await expect(promise).rejects.toBeInstanceOf(MigrationCancellationProtocolError)
    await expect(promise).rejects.toMatchObject({operationId: 'missing'})
    await expect(promise).rejects.toThrow(
      'Migration cancellation for missing returned neither an operation nor user errors',
    )
  })

  test('preserves transport errors', async () => {
    const transportError = new Error('Network unavailable')
    const cancelOperation = vi.fn().mockRejectedValue(transportError)

    const promise = cancelMigrationOperations({clientId: 'client-id', operationIds: ['one'], cancelOperation})

    await expect(promise).rejects.toBe(transportError)
  })
})
