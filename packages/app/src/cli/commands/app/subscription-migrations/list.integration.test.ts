import List from './list.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {listMigratableSubscriptions} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {parse} from 'csv-parse/sync'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../../models/subscription-migrations.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/list-migratable-subscriptions.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

const app = testAppLinked()
const remoteApp = testOrganizationApp({apiKey: 'remote-client-id'})
const subscriptions: MigratableSubscription[] = [
  {
    shopId: 'gid://shopify/Shop/123456789',
    status: 'MIGRATED',
    manualSubscriptionName: 'Historical legacy plan',
    manualSubscriptionPrice: {amount: '29.95', currencyCode: 'CAD'},
    manualSubscriptionInterval: 'ANNUAL',
    targetPlanHandle: 'plus',
    notification: {
      kind: 'NONE',
      optOutDeadline: '2025-12-01T00:00:00Z',
      sentAt: '2025-11-01T00:00:00Z',
    },
    priceBehavior: 'PLAN_PRICE',
    effectiveDate: '2026-01-01T00:00:00Z',
    lastFailureReason: 'SUPERSEDED',
  },
]

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(listMigratableSubscriptions).mockResolvedValue(subscriptions)
})

describe('subscription migration list command output integration', () => {
  test('writes default CSV to stdout exactly once', async () => {
    await List.run([])

    expect(outputResult).toHaveBeenCalledOnce()
    const output = vi.mocked(outputResult).mock.calls[0]![0] as string
    expect(output).toBe(
      'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason\n' +
        'gid://shopify/Shop/123456789,MIGRATED,Historical legacy plan,29.95,CAD,ANNUAL,plus,NONE,2025-12-01T00:00:00Z,2025-11-01T00:00:00Z,PLAN_PRICE,2026-01-01T00:00:00Z,SUPERSEDED',
    )
    expect(parse(output, {columns: true})).toEqual([
      {
        shop_id: 'gid://shopify/Shop/123456789',
        status: 'MIGRATED',
        manual_subscription_name: 'Historical legacy plan',
        manual_subscription_price_amount: '29.95',
        manual_subscription_price_currency_code: 'CAD',
        manual_subscription_interval: 'ANNUAL',
        target_plan_handle: 'plus',
        notification_kind: 'NONE',
        notification_opt_out_deadline: '2025-12-01T00:00:00Z',
        notification_sent_at: '2025-11-01T00:00:00Z',
        price_behavior: 'PLAN_PRICE',
        effective_date: '2026-01-01T00:00:00Z',
        last_failure_reason: 'SUPERSEDED',
      },
    ])
  })

  test('writes versioned JSON to stdout exactly once when requested', async () => {
    await List.run(['--json'])

    expect(outputResult).toHaveBeenCalledOnce()
    const output = vi.mocked(outputResult).mock.calls[0]![0] as string
    expect(output).toBe(JSON.stringify({schemaVersion: 1, subscriptions}, null, 2))
    expect(JSON.parse(output)).toEqual({schemaVersion: 1, subscriptions})
  })
})
