import {
  cancelMigrationOperation,
  createMigrationOperation,
  getMigrationOperation,
  type MigrationApiInput,
} from './partners-api.js'
import {
  AppSubscriptionMigrationOperationCancelMutation,
  AppSubscriptionMigrationOperationCreateMutation,
  AppSubscriptionMigrationOperationQuery,
} from '../../api/graphql/subscription_migrations.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../utilities/developer-platform-client/partners-client.js')

const request = vi.fn()

const operation = {
  id: 'gid://shopify/AppSubscriptionMigrationOperation/42',
  status: 'RUNNING' as const,
  total: 1,
  results: {
    edges: [
      {
        node: {
          shopId: 'gid://shopify/Shop/1001',
          code: 'SCHEDULED' as const,
        },
      },
    ],
  },
}

const scheduledMigration: MigrationApiInput = {
  shopId: 'gid://shopify/Shop/1001',
  action: {
    scheduleMigration: {
      targetPlanHandle: 'pro',
      priceBehavior: 'PLAN_PRICE',
      notification: 'WHEN_REQUIRED',
    },
  },
}

const canceledMigration: MigrationApiInput = {
  shopId: 'gid://shopify/Shop/1002',
  action: {cancelMigration: true},
}

describe('Partners migration API', () => {
  beforeEach(() => {
    request.mockReset()
    vi.mocked(PartnersClient.getInstance).mockReset()
    vi.mocked(PartnersClient.getInstance).mockReturnValue({request} as unknown as PartnersClient)
  })

  test('creates a migration operation with the exported document and exact variables', async () => {
    const payload = {
      operation,
      userErrors: [{message: 'A warning', field: null}],
    }
    const response = {appSubscriptionMigrationOperationCreate: payload}
    request.mockResolvedValue(response)

    await expect(
      createMigrationOperation({
        clientId: 'client-id',
        idempotencyKey: 'batch-key',
        migrations: [scheduledMigration, canceledMigration],
      }),
    ).resolves.toEqual(payload)

    expect(request).toHaveBeenCalledWith(AppSubscriptionMigrationOperationCreateMutation, {
      input: {
        apiKey: 'client-id',
        idempotencyKey: 'batch-key',
        migrations: [scheduledMigration, canceledMigration],
      },
    })
    const variables = request.mock.calls[0]?.[1]
    expect(variables.input).not.toHaveProperty('input')
  })

  test('normalizes nullable user errors in a create payload', async () => {
    request.mockResolvedValue({appSubscriptionMigrationOperationCreate: {operation, userErrors: null}})

    await expect(
      createMigrationOperation({
        clientId: 'client-id',
        idempotencyKey: 'batch-key',
        migrations: [scheduledMigration],
      }),
    ).resolves.toEqual({operation, userErrors: []})
  })

  test('normalizes nullable results in a created operation', async () => {
    request.mockResolvedValue({
      appSubscriptionMigrationOperationCreate: {operation: {...operation, results: null}, userErrors: []},
    })

    await expect(
      createMigrationOperation({
        clientId: 'client-id',
        idempotencyKey: 'batch-key',
        migrations: [scheduledMigration],
      }),
    ).resolves.toEqual({operation: {...operation, results: {edges: []}}, userErrors: []})
  })

  test('gets a migration operation with the exported document and exact variables', async () => {
    const response = {appSubscriptionMigrationOperation: operation}
    request.mockResolvedValue(response)

    await expect(getMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual(operation)

    expect(request).toHaveBeenCalledWith(AppSubscriptionMigrationOperationQuery, {
      apiKey: 'client-id',
      id: operation.id,
    })
  })

  test('preserves a nullable fetched operation', async () => {
    request.mockResolvedValue({appSubscriptionMigrationOperation: null})

    await expect(getMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toBeNull()
  })

  test('normalizes nullable results in a fetched operation', async () => {
    request.mockResolvedValue({appSubscriptionMigrationOperation: {...operation, results: null}})

    await expect(getMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual({
      ...operation,
      results: {edges: []},
    })
  })

  test('normalizes nullable result edges', async () => {
    request.mockResolvedValue({appSubscriptionMigrationOperation: {...operation, results: {edges: null}}})

    await expect(getMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual({
      ...operation,
      results: {edges: []},
    })
  })

  test('filters nullable result edge elements', async () => {
    request.mockResolvedValue({
      appSubscriptionMigrationOperation: {...operation, results: {edges: [operation.results.edges[0], null]}},
    })

    await expect(getMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual(operation)
  })

  test('cancels a migration operation with the exported document and exact variables', async () => {
    const payload = {
      operation: {...operation, status: 'CANCELED' as const},
      userErrors: [],
    }
    const response = {appSubscriptionMigrationOperationCancel: payload}
    request.mockResolvedValue(response)

    await expect(cancelMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual(payload)

    expect(request).toHaveBeenCalledWith(AppSubscriptionMigrationOperationCancelMutation, {
      input: {apiKey: 'client-id', id: operation.id},
    })
  })

  test('normalizes nullable user errors in a cancel payload', async () => {
    const canceledOperation = {...operation, status: 'CANCELED' as const}
    request.mockResolvedValue({
      appSubscriptionMigrationOperationCancel: {operation: canceledOperation, userErrors: null},
    })

    await expect(cancelMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual({
      operation: canceledOperation,
      userErrors: [],
    })
  })

  test('normalizes nullable results in a canceled operation', async () => {
    const canceledOperation = {...operation, status: 'CANCELED' as const, results: null}
    request.mockResolvedValue({
      appSubscriptionMigrationOperationCancel: {operation: canceledOperation, userErrors: []},
    })

    await expect(cancelMigrationOperation({clientId: 'client-id', operationId: operation.id})).resolves.toEqual({
      operation: {...canceledOperation, results: {edges: []}},
      userErrors: [],
    })
  })

  test('returns only the operation payload from the server response', async () => {
    const payload = {operation, userErrors: []}
    request.mockResolvedValue({appSubscriptionMigrationOperationCreate: payload, serverMetadata: 'not gateway data'})

    await expect(
      createMigrationOperation({
        clientId: 'client-id',
        idempotencyKey: 'batch-key',
        migrations: [scheduledMigration],
      }),
    ).resolves.toEqual(payload)
  })
})
