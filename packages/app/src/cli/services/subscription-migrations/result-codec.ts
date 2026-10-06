import type {MigratableSubscription, MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationUserError} from './partners-api.js'

export function projectMigrationOperation(operation: MigrationOperation) {
  return {
    gid: operation.id,
    status: operation.status,
    total: operation.total,
    results: operation.results.edges.map(({node}) => ({shopGid: node.shopId, code: node.code})),
  }
}

export function projectMigrationUserErrors(errors: MigrationUserError[]) {
  return errors.map(({message, field}) => ({message, fieldPath: field}))
}

export function projectMigratableSubscription(subscription: MigratableSubscription) {
  return {
    shopGid: subscription.shopId,
    status: subscription.status,
    manualSubscriptionName: subscription.manualSubscriptionName,
    manualSubscriptionPrice:
      subscription.manualSubscriptionPrice === null
        ? null
        : {
            amount: subscription.manualSubscriptionPrice.amount,
            currencyCode: subscription.manualSubscriptionPrice.currencyCode,
          },
    manualSubscriptionInterval: subscription.manualSubscriptionInterval,
    targetPlanHandle: subscription.targetPlanHandle,
    notification:
      subscription.notification === null
        ? null
        : {
            kind: subscription.notification.kind,
            optOutDeadline: normalizeInstant(subscription.notification.optOutDeadline),
            sentAt: normalizeInstant(subscription.notification.sentAt),
          },
    priceBehavior: subscription.priceBehavior,
    effectiveDate:
      subscription.effectiveDate === null || /^\d{4}-\d{2}-\d{2}$/.test(subscription.effectiveDate)
        ? subscription.effectiveDate
        : normalizeInstant(subscription.effectiveDate),
    lastFailureReason: subscription.lastFailureReason,
  }
}

function normalizeInstant(value: string | null): string | null {
  if (value === null) return null
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z')
}
