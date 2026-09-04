import {outputMigrationList, serializeMigrationListCsv, serializeMigrationListJson} from './list-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

function subscription(overrides: Partial<MigratableSubscription> = {}): MigratableSubscription {
  return {
    shopId: 'gid://shopify/Shop/1',
    status: 'SCHEDULED',
    manualSubscriptionName: 'Legacy plan',
    manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
    manualSubscriptionInterval: 'EVERY_30_DAYS',
    targetPlanHandle: 'standard',
    notification: {
      kind: 'NONE',
      optOutDeadline: '2026-04-01T00:00:00Z',
      sentAt: '2026-03-01T00:00:00Z',
    },
    priceBehavior: 'HONOR_BILLING_PRICE',
    effectiveDate: '2026-05-01T00:00:00Z',
    lastFailureReason: 'SCHEDULING_FAILED',
    ...overrides,
  }
}

describe('migration list serialization', () => {
  test('serializes the exact pretty JSON schema without a trailing newline', () => {
    const subscriptions = [subscription()]
    const expected = `{
  "schemaVersion": 1,
  "subscriptions": [
    {
      "shopId": "gid://shopify/Shop/1",
      "status": "SCHEDULED",
      "manualSubscriptionName": "Legacy plan",
      "manualSubscriptionPrice": {
        "amount": "19.99",
        "currencyCode": "USD"
      },
      "manualSubscriptionInterval": "EVERY_30_DAYS",
      "targetPlanHandle": "standard",
      "notification": {
        "kind": "NONE",
        "optOutDeadline": "2026-04-01T00:00:00Z",
        "sentAt": "2026-03-01T00:00:00Z"
      },
      "priceBehavior": "HONOR_BILLING_PRICE",
      "effectiveDate": "2026-05-01T00:00:00Z",
      "lastFailureReason": "SCHEDULING_FAILED"
    }
  ]
}`

    expect(serializeMigrationListJson(subscriptions)).toBe(expected)
    expect(serializeMigrationListJson(subscriptions)).not.toMatch(/\n$/)
  })

  test('serializes CSV fields in the fixed header order without a trailing newline', () => {
    expect(serializeMigrationListCsv([subscription()])).toBe(
      `${CSV_HEADER}\n` +
        'gid://shopify/Shop/1,SCHEDULED,Legacy plan,19.99,USD,EVERY_30_DAYS,standard,NONE,2026-04-01T00:00:00Z,2026-03-01T00:00:00Z,HONOR_BILLING_PRICE,2026-05-01T00:00:00Z,SCHEDULING_FAILED',
    )
  })

  test('serializes null top-level and nested fields as empty CSV values', () => {
    const input = subscription({
      manualSubscriptionName: null,
      manualSubscriptionPrice: null,
      targetPlanHandle: null,
      notification: null,
      priceBehavior: null,
      effectiveDate: null,
      lastFailureReason: null,
    })

    expect(serializeMigrationListCsv([input])).toBe(
      `${CSV_HEADER}\ngid://shopify/Shop/1,SCHEDULED,,,,EVERY_30_DAYS,,,,,,,`,
    )
  })

  test('escapes commas, double quotes, carriage returns, and line feeds in CSV values', () => {
    const input = subscription({
      manualSubscriptionName: 'Legacy, "Plus"\r\nAnnual',
      targetPlanHandle: 'standard,plus',
    })

    const csv = serializeMigrationListCsv([input])

    expect(csv).toContain('"Legacy, ""Plus""\r\nAnnual"')
    expect(csv).toContain(',"standard,plus",')
    expect(csv.endsWith('\n')).toBe(false)
  })

  test('returns only the header for an empty CSV result', () => {
    expect(serializeMigrationListCsv([])).toBe(CSV_HEADER)
  })
})

describe('outputMigrationList', () => {
  test('writes the exact CSV payload to stdout exactly once by default', async () => {
    const subscriptions = [subscription()]
    const expected =
      `${CSV_HEADER}\n` +
      'gid://shopify/Shop/1,SCHEDULED,Legacy plan,19.99,USD,EVERY_30_DAYS,standard,NONE,2026-04-01T00:00:00Z,2026-03-01T00:00:00Z,HONOR_BILLING_PRICE,2026-05-01T00:00:00Z,SCHEDULING_FAILED'

    await outputMigrationList({subscriptions, json: false})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(expected)
  })

  test('writes the exact versioned JSON payload to stdout exactly once', async () => {
    const subscriptions = [subscription()]

    await outputMigrationList({subscriptions, json: true})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(serializeMigrationListJson(subscriptions))
  })
})
