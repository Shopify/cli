import {outputResult} from '@shopify/cli-kit/node/output'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

interface MigrationListOutputOptions {
  subscriptions: MigratableSubscription[]
  json: boolean
}

export function serializeMigrationListJson(subscriptions: MigratableSubscription[]): string {
  return JSON.stringify({schemaVersion: 1, subscriptions}, null, 2)
}

export function serializeMigrationListCsv(subscriptions: MigratableSubscription[]): string {
  const rows = subscriptions.map((subscription) =>
    [
      subscription.shopId,
      subscription.status,
      subscription.manualSubscriptionName,
      subscription.manualSubscriptionPrice?.amount,
      subscription.manualSubscriptionPrice?.currencyCode,
      subscription.manualSubscriptionInterval,
      subscription.targetPlanHandle,
      subscription.notification?.kind,
      subscription.notification?.optOutDeadline,
      subscription.notification?.sentAt,
      subscription.priceBehavior,
      subscription.effectiveDate,
      subscription.lastFailureReason,
    ]
      .map(serializeCsvValue)
      .join(','),
  )

  return [CSV_HEADER, ...rows].join('\n')
}

export function outputMigrationList({subscriptions, json}: MigrationListOutputOptions): void {
  outputResult(json ? serializeMigrationListJson(subscriptions) : serializeMigrationListCsv(subscriptions))
}

function serializeCsvValue(value: string | null | undefined): string {
  const serializedValue = value ?? ''
  return /[",\r\n]/.test(serializedValue) ? `"${serializedValue.replaceAll('"', '""')}"` : serializedValue
}
