import {MIGRATABLE_SUBSCRIPTION_STATUSES, NOTIFICATION_KINDS, PRICE_BEHAVIORS} from './subscription-migrations.js'
import {describe, expect, test} from 'vitest'
import type {MigratableSubscription, MigrationOperation, MigrationPlanResult} from './subscription-migrations.js'

describe('subscription migration domain models', () => {
  test('matches the Partners API price behaviors', () => {
    expect(PRICE_BEHAVIORS).toEqual(['HONOR_BILLING_PRICE', 'PLAN_PRICE'])
  })

  test('matches the Partners API notification kinds', () => {
    expect(NOTIFICATION_KINDS).toEqual(['OPT_OUT', 'WHEN_REQUIRED'])
  })

  test('matches the Partners API migratable subscription statuses', () => {
    expect(MIGRATABLE_SUBSCRIPTION_STATUSES).toEqual(['UNSCHEDULED', 'SCHEDULED', 'MIGRATED'])
  })

  test('represents every field returned for a migratable subscription', () => {
    const subscription: MigratableSubscription = {
      shopId: 'gid://shopify/Shop/1',
      status: 'MIGRATED',
      manualSubscriptionName: 'Legacy plan',
      manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
      manualSubscriptionInterval: 'EVERY_30_DAYS',
      targetPlanHandle: 'pro',
      notification: {
        kind: 'NONE',
        optOutDeadline: '2025-01-02T03:04:05Z',
        sentAt: '2025-01-01T03:04:05Z',
      },
      priceBehavior: 'HONOR_BILLING_PRICE',
      effectiveDate: '2025-02-01',
      lastFailureReason: 'SUPERSEDED',
    }

    expect(subscription).toEqual({
      shopId: 'gid://shopify/Shop/1',
      status: 'MIGRATED',
      manualSubscriptionName: 'Legacy plan',
      manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
      manualSubscriptionInterval: 'EVERY_30_DAYS',
      targetPlanHandle: 'pro',
      notification: {
        kind: 'NONE',
        optOutDeadline: '2025-01-02T03:04:05Z',
        sentAt: '2025-01-01T03:04:05Z',
      },
      priceBehavior: 'HONOR_BILLING_PRICE',
      effectiveDate: '2025-02-01',
      lastFailureReason: 'SUPERSEDED',
    })
    expect(NOTIFICATION_KINDS).toEqual(['OPT_OUT', 'WHEN_REQUIRED'])
  })

  test('represents successful and failed planning results', () => {
    const success: MigrationPlanResult = {
      ok: true,
      plan: {
        action: 'unschedule',
        rows: [{action: 'unschedule', shopId: 'gid://shopify/Shop/1'}],
        batches: [
          {
            index: 0,
            rows: [{action: 'unschedule', shopId: 'gid://shopify/Shop/1'}],
            canonicalPayload: '{}',
            payloadDigest: 'digest',
          },
        ],
        canonicalInput: '{}',
        inputDigest: 'digest',
      },
    }
    const failure: MigrationPlanResult = {
      ok: false,
      errors: [{row: 2, field: 'shop_id', message: 'Invalid shop ID'}],
    }

    expect(success.ok).toBe(true)
    expect(failure.ok).toBe(false)
  })

  test('represents downstream migration operations', () => {
    const operation: MigrationOperation = {
      id: 'gid://shopify/AppSubscriptionMigration/1',
      status: 'COMPLETED',
      total: 1,
      results: {
        edges: [{node: {shopId: 'gid://shopify/Shop/1', code: 'SCHEDULED'}}],
      },
    }

    expect(operation.results.edges[0]?.node.code).toBe('SCHEDULED')
  })
})
