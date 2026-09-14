import {outputResult} from '@shopify/cli-kit/node/output'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

interface MigrationListOutputOptions {
  pages: AsyncIterable<MigratableSubscription[]>
  json: boolean
}

export function serializeMigrationListJson(subscriptions: MigratableSubscription[]): string {
  return JSON.stringify({schemaVersion: 1, subscriptions}, null, 2)
}

export function serializeMigrationListCsv(subscriptions: MigratableSubscription[]): string {
  return [CSV_HEADER, ...serializeCsvRows(subscriptions)].join('\n')
}

/**
 * Writes the migration list to stdout.
 *
 * CSV is streamed page by page as the API returns each page, so a 100k-row export never has to be held in memory.
 * If a later page fails, the rows already written remain on stdout as a valid (partial) CSV and the error propagates.
 *
 * JSON must be a single valid document, so every page is collected first and the document is written only
 * after all pages succeed. A failure produces no JSON output at all.
 */
export async function outputMigrationList({pages, json}: MigrationListOutputOptions): Promise<void> {
  if (json) {
    outputResult(serializeMigrationListJson(await collectPages(pages)))
  } else {
    await streamMigrationListCsv(pages)
  }
}

async function collectPages(pages: AsyncIterable<MigratableSubscription[]>): Promise<MigratableSubscription[]> {
  const subscriptions: MigratableSubscription[] = []
  for await (const page of pages) subscriptions.push(...page)
  return subscriptions
}

async function streamMigrationListCsv(pages: AsyncIterable<MigratableSubscription[]>): Promise<void> {
  let headerWritten = false

  for await (const page of pages) {
    const rows = serializeCsvRows(page)
    // The header goes out with the first page so it reaches stdout before page two is requested. Later pages only
    // write when they have rows, because outputResult terminates every write with a newline and an empty write
    // would leave a blank line in the CSV.
    if (!headerWritten) {
      outputResult([CSV_HEADER, ...rows].join('\n'))
      headerWritten = true
    } else if (rows.length > 0) {
      outputResult(rows.join('\n'))
    }
  }

  if (!headerWritten) outputResult(CSV_HEADER)
}

function serializeCsvRows(subscriptions: MigratableSubscription[]): string[] {
  return subscriptions.map((subscription) =>
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
}

function serializeCsvValue(value: string | null | undefined): string {
  const serializedValue = value ?? ''
  return /[",\r\n]/.test(serializedValue) ? `"${serializedValue.replaceAll('"', '""')}"` : serializedValue
}
