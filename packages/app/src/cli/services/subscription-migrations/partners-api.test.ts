import {
  cancelMigrationOperation,
  createMigrationOperation,
  getMigratableSubscriptionPage,
  getMigrationOperation,
  type MigrationApiInput,
} from './partners-api.js'
import {
  AppSubscriptionMigrationOperationCancelMutation,
  AppSubscriptionMigrationOperationCreateMutation,
  AppSubscriptionMigrationOperationQuery,
  MigratableAppSubscriptionsQuery,
} from '../../api/graphql/subscription_migrations.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

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

const migratableSubscription: MigratableSubscription = {
  shopId: 'gid://shopify/Shop/1001',
  status: 'SCHEDULED',
  manualSubscriptionName: 'Legacy plan',
  manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
  manualSubscriptionInterval: 'ANNUAL',
  targetPlanHandle: 'pro',
  notification: {
    kind: 'NONE',
    optOutDeadline: '2025-01-02T03:04:05Z',
    sentAt: '2025-01-01T03:04:05Z',
  },
  priceBehavior: 'PLAN_PRICE',
  effectiveDate: '2025-02-01',
  lastFailureReason: 'SCHEDULING_FAILED',
}

describe('Partners migration API', () => {
  beforeEach(() => {
    request.mockReset()
    vi.mocked(PartnersClient.getInstance).mockReset()
    vi.mocked(PartnersClient.getInstance).mockReturnValue({request} as unknown as PartnersClient)
  })

  test('defines the complete migratable subscriptions query', () => {
    expect(MigratableAppSubscriptionsQuery.replace(/[\s,]/g, '')).toBe(
      'queryMigratableAppSubscriptions($apiKey:String!$first:Int!$after:String$status:AppSubscriptionMigrationStatus){migratableAppSubscriptions(apiKey:$apiKeyfirst:$firstafter:$afterstatus:$status){edges{cursornode{shopIdstatusmanualSubscriptionNamemanualSubscriptionPrice{amountcurrencyCode}manualSubscriptionIntervaltargetPlanHandlenotification{kindoptOutDeadlinesentAt}priceBehavioreffectiveDatelastFailureReason}}pageInfo{hasNextPageendCursor}}}',
    )
  })

  test('gets a migratable subscription page with the exported document and exact variables', async () => {
    request.mockResolvedValue({
      migratableAppSubscriptions: {
        edges: [{cursor: 'next-cursor', node: migratableSubscription}],
        pageInfo: {hasNextPage: true, endCursor: 'next-cursor'},
      },
    })

    await expect(
      getMigratableSubscriptionPage({
        clientId: 'client-id',
        first: 25,
        after: 'previous-cursor',
        status: 'SCHEDULED',
      }),
    ).resolves.toEqual({
      subscriptions: [migratableSubscription],
      pageInfo: {hasNextPage: true, endCursor: 'next-cursor'},
    })

    expect(request).toHaveBeenCalledWith(MigratableAppSubscriptionsQuery, {
      apiKey: 'client-id',
      first: 25,
      after: 'previous-cursor',
      status: 'SCHEDULED',
    })
  })

  test('always sends optional migratable subscription variables', async () => {
    request.mockResolvedValue({
      migratableAppSubscriptions: {
        edges: [],
        pageInfo: {hasNextPage: false, endCursor: null},
      },
    })

    await getMigratableSubscriptionPage({clientId: 'client-id', first: 250})

    expect(request).toHaveBeenCalledWith(MigratableAppSubscriptionsQuery, {
      apiKey: 'client-id',
      first: 250,
      after: undefined,
      status: undefined,
    })
  })

  test('preserves a nullable migratable subscription connection', async () => {
    request.mockResolvedValue({migratableAppSubscriptions: null})

    await expect(getMigratableSubscriptionPage({clientId: 'client-id', first: 250})).resolves.toBeNull()
  })

  test('normalizes nullable migratable subscription edges', async () => {
    request.mockResolvedValue({
      migratableAppSubscriptions: {
        edges: null,
        pageInfo: {hasNextPage: false, endCursor: null},
      },
    })

    await expect(getMigratableSubscriptionPage({clientId: 'client-id', first: 250})).resolves.toEqual({
      subscriptions: [],
      pageInfo: {hasNextPage: false, endCursor: null},
    })
  })

  test('filters nullable migratable subscription edge elements while preserving order', async () => {
    const secondSubscription = {...migratableSubscription, shopId: 'gid://shopify/Shop/1002'}
    request.mockResolvedValue({
      migratableAppSubscriptions: {
        edges: [{cursor: 'one', node: migratableSubscription}, null, {cursor: 'two', node: secondSubscription}],
        pageInfo: {hasNextPage: false, endCursor: 'two'},
      },
    })

    await expect(getMigratableSubscriptionPage({clientId: 'client-id', first: 250})).resolves.toEqual({
      subscriptions: [migratableSubscription, secondSubscription],
      pageInfo: {hasNextPage: false, endCursor: 'two'},
    })
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
