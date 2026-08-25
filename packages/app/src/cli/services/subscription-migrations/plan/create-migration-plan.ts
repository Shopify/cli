import {
  NOTIFICATION_KINDS,
  PRICE_BEHAVIORS,
  type MigrationAction,
  type MigrationBatch,
  type MigrationPlanResult,
  type MigrationValidationError,
  type NotificationKind,
  type PlannedMigrationRow,
  type PriceBehavior,
  type RawMigrationRow,
} from '../../../models/subscription-migrations.js'
import {sha256} from '@shopify/cli-kit/node/crypto'

const SHOP_GID_PATTERN = /^gid:\/\/shopify\/Shop\/(\d+)$/
const NUMERIC_SHOP_ID_PATTERN = /^\d+$/
const BATCH_SIZE = 250
const priceBehaviors = new Set<string>(PRICE_BEHAVIORS)
const notificationKinds = new Set<string>(NOTIFICATION_KINDS)

export function createMigrationPlan(action: MigrationAction, rawRows: RawMigrationRow[]): MigrationPlanResult {
  const errors: MigrationValidationError[] = []
  const plannedRows: PlannedMigrationRow[] = []
  const firstSourceRowByShopId = new Map<string, number>()

  for (const rawRow of rawRows) {
    const shopId = normalizeShopId(rawRow.shopId)
    let rowIsValid = true

    if (shopId) {
      const firstSourceRow = firstSourceRowByShopId.get(shopId)
      if (firstSourceRow === undefined) {
        firstSourceRowByShopId.set(shopId, rawRow.sourceRow)
      } else {
        errors.push({
          row: rawRow.sourceRow,
          field: 'shop_id',
          message: `Duplicate shop ID; first seen on row ${firstSourceRow}`,
        })
        rowIsValid = false
      }
    } else {
      errors.push({
        row: rawRow.sourceRow,
        field: 'shop_id',
        message: 'Shop ID must be a positive numeric ID or gid://shopify/Shop/<id>',
      })
      rowIsValid = false
    }

    if (action === 'unschedule') {
      if (rowIsValid && shopId) plannedRows.push({action, shopId})
      continue
    }

    const targetPlanHandle = rawRow.targetPlanHandle?.trim()
    const priceBehavior = rawRow.priceBehavior?.trim()
    const rawNotification = rawRow.notification?.trim()
    const notification = rawNotification?.length ? rawNotification : 'WHEN_REQUIRED'

    if (!targetPlanHandle) {
      errors.push({row: rawRow.sourceRow, field: 'target_plan_handle', message: 'Target plan handle is required'})
      rowIsValid = false
    }
    if (!isPriceBehavior(priceBehavior)) {
      errors.push({
        row: rawRow.sourceRow,
        field: 'price_behavior',
        message: 'Price behavior must be HONOR_BILLING_PRICE or PLAN_PRICE',
      })
      rowIsValid = false
    }
    if (!isNotificationKind(notification)) {
      errors.push({
        row: rawRow.sourceRow,
        field: 'notification',
        message: 'Notification must be NONE, OPT_OUT, or WHEN_REQUIRED',
      })
      rowIsValid = false
    }

    if (
      rowIsValid &&
      shopId &&
      targetPlanHandle &&
      isPriceBehavior(priceBehavior) &&
      isNotificationKind(notification)
    ) {
      plannedRows.push({
        action,
        shopId,
        targetPlanHandle,
        priceBehavior,
        notification,
      })
    }
  }

  if (errors.length > 0) return {ok: false, errors}

  const rows = [...plannedRows].sort((left, right) => {
    if (left.shopId < right.shopId) return -1
    if (left.shopId > right.shopId) return 1
    return 0
  })
  const canonicalInput = canonicalize(action, rows)
  return {
    ok: true,
    plan: {
      action,
      rows,
      batches: createBatches(action, rows),
      canonicalInput,
      inputDigest: digest(canonicalInput),
    },
  }
}

function normalizeShopId(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const numericId = NUMERIC_SHOP_ID_PATTERN.test(trimmed) ? trimmed : SHOP_GID_PATTERN.exec(trimmed)?.[1]
  if (numericId === undefined) return undefined

  const canonicalId = BigInt(numericId)
  return canonicalId > 0 ? `gid://shopify/Shop/${canonicalId}` : undefined
}

function isPriceBehavior(value: string | undefined): value is PriceBehavior {
  return value !== undefined && priceBehaviors.has(value)
}

function isNotificationKind(value: string): value is NotificationKind {
  return notificationKinds.has(value)
}

function canonicalize(action: MigrationAction, rows: PlannedMigrationRow[]): string {
  return JSON.stringify({version: 1, action, rows})
}

function createBatches(action: MigrationAction, rows: PlannedMigrationRow[]): MigrationBatch[] {
  const batches: MigrationBatch[] = []
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batchRows = rows.slice(offset, offset + BATCH_SIZE)
    const canonicalPayload = canonicalize(action, batchRows)
    batches.push({
      index: batches.length,
      rows: batchRows,
      canonicalPayload,
      payloadDigest: digest(canonicalPayload),
    })
  }
  return batches
}

function digest(value: string): string {
  return sha256(value).toString('hex')
}
