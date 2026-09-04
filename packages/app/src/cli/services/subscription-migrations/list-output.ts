import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

interface MigrationListOutputOptions {
  subscriptions: MigratableSubscription[]
  json: boolean
  output?: string
  force: boolean
}

export function validateMigrationListDestination(output: string | undefined, json: boolean): void {
  if (output === undefined && !json) {
    throw new AbortError('Provide --output <path> or use --json to write subscriptions to stdout.')
  }
}

export async function assertMigrationListOutputAvailable(output: string, force: boolean): Promise<void> {
  if ((await fileExists(output)) && !force) abortOutputAlreadyExists(output)
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

  return `${[CSV_HEADER, ...rows].join('\n')}\n`
}

export async function outputMigrationList({
  subscriptions,
  json,
  output,
  force,
}: MigrationListOutputOptions): Promise<void> {
  validateMigrationListDestination(output, json)

  if (output === undefined) {
    outputResult(serializeMigrationListJson(subscriptions))
    return
  }

  await assertMigrationListOutputAvailable(output, force)
  const content = json ? `${serializeMigrationListJson(subscriptions)}\n` : serializeMigrationListCsv(subscriptions)

  try {
    if (force) {
      await writeFile(output, content, {encoding: 'utf8'})
    } else {
      await writeFile(output, content, {encoding: 'utf8', flag: 'wx'})
    }
  } catch (error) {
    if (isErrorWithCode(error, 'EEXIST')) abortOutputAlreadyExists(output)
    const message = error instanceof Error ? error.message : String(error)
    throw new AbortError(`Couldn't write subscription export to ${output}: ${message}`)
  }

  const subscriptionLabel = subscriptions.length === 1 ? 'subscription' : 'subscriptions'
  outputInfo(`Wrote ${subscriptions.length} ${subscriptionLabel} to ${output}.`)
}

function serializeCsvValue(value: string | null | undefined): string {
  const serializedValue = value ?? ''
  return /[",\r\n]/.test(serializedValue) ? `"${serializedValue.replaceAll('"', '""')}"` : serializedValue
}

function abortOutputAlreadyExists(output: string): never {
  throw new AbortError(`Output file already exists: ${output}. Use --force to overwrite it.`)
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
