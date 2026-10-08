import {MigrationCancellationProtocolError, cancelMigrationOperations} from './cancel-operations.js'
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
  test.each([
    ['gid://shopify/AppSubscriptionMigrationOperation/one', 'invalid-id'],
    ['invalid-id', 'gid://shopify/AppSubscriptionMigrationOperation/one'],
    ['gid://shopify/AppSubscriptionMigrationOperation/one', 'gid://shopify/Shop/123'],
    ['gid://shopify/AppSubscriptionMigrationOperation/one', 'gid://shopify/AppSubscriptionMigrationOperation/'],
  ])('rejects malformed IDs before canceling any operation: %s, %s', async (firstId, secondId) => {
    const operationIds = [firstId, secondId]
    const cancelOperation = vi.fn().mockResolvedValue(payload('gid://shopify/AppSubscriptionMigrationOperation/one'))

    const promise = cancelMigrationOperations({clientId: 'client-id', operationIds, cancelOperation})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Invalid subscription migration operation IDs:')
    expect(cancelOperation).not.toHaveBeenCalled()
  })

  test('returns mixed success and failure outcomes in input order', async () => {
    const cancelOperation = vi.fn(({operationId}: {operationId: string}) => {
      if (operationId === 'gid://shopify/AppSubscriptionMigrationOperation/failed') {
        return Promise.resolve({
          operation: operation(operationId),
          userErrors: [{message: 'Already completed', field: ['id']}],
        })
      }
      return Promise.resolve(payload(operationId))
    })

    const result = await cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: [
        'gid://shopify/AppSubscriptionMigrationOperation/two',
        'gid://shopify/AppSubscriptionMigrationOperation/failed',
        'gid://shopify/AppSubscriptionMigrationOperation/one',
      ],
      cancelOperation,
    })

    expect(cancelOperation).toHaveBeenNthCalledWith(1, {
      clientId: 'client-id',
      operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
    })
    expect(cancelOperation).toHaveBeenNthCalledWith(2, {
      clientId: 'client-id',
      operationId: 'gid://shopify/AppSubscriptionMigrationOperation/failed',
    })
    expect(cancelOperation).toHaveBeenNthCalledWith(3, {
      clientId: 'client-id',
      operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
    })
    expect(result).toEqual({
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/two'),
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/failed',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/failed'),
          userErrors: [{message: 'Already completed', field: ['id']}],
        },
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one'),
        },
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

    const result = await cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/one'],
      cancelOperation,
    })

    expect(result).toEqual({
      outcomes: [
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
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

    const promise = cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/missing'],
      cancelOperation,
    })

    await expect(promise).rejects.toBeInstanceOf(MigrationCancellationProtocolError)
    await expect(promise).rejects.toMatchObject({
      operationId: 'gid://shopify/AppSubscriptionMigrationOperation/missing',
    })
    await expect(promise).rejects.toThrow(
      'Migration cancellation for gid://shopify/AppSubscriptionMigrationOperation/missing returned neither an operation nor user errors',
    )
  })

  test('retains successful cancellations and every requested operation when another request fails', async () => {
    const cancelOperation = vi
      .fn()
      .mockResolvedValueOnce(payload('gid://shopify/AppSubscriptionMigrationOperation/one'))
      .mockRejectedValueOnce(new Error('Network unavailable'))
    const result = await cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: [
        'gid://shopify/AppSubscriptionMigrationOperation/one',
        'gid://shopify/AppSubscriptionMigrationOperation/two',
      ],
      cancelOperation,
    })
    expect(result).toEqual({
      outcomes: [
        {
          status: 'success',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/one',
          operation: operation('gid://shopify/AppSubscriptionMigrationOperation/one'),
        },
        {
          status: 'failed',
          operationId: 'gid://shopify/AppSubscriptionMigrationOperation/two',
          operation: null,
          userErrors: [{message: 'Network unavailable', field: null}],
        },
      ],
    })
  })

  test('preserves transport errors', async () => {
    const transportError = new Error('Network unavailable')
    const cancelOperation = vi.fn().mockRejectedValue(transportError)

    const promise = cancelMigrationOperations({
      clientId: 'client-id',
      operationIds: ['gid://shopify/AppSubscriptionMigrationOperation/one'],
      cancelOperation,
    })

    await expect(promise).rejects.toBe(transportError)
  })
})
