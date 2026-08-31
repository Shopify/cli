export const PRICE_BEHAVIORS = ['HONOR_BILLING_PRICE', 'PLAN_PRICE'] as const
export type PriceBehavior = (typeof PRICE_BEHAVIORS)[number]

export const NOTIFICATION_KINDS = ['OPT_OUT', 'WHEN_REQUIRED'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export type MigrationAction = 'schedule' | 'unschedule'

export interface RawMigrationRow {
  sourceRow: number
  shopId?: string
  targetPlanHandle?: string
  priceBehavior?: string
  notification?: string
}

export interface ScheduledMigrationRow {
  action: 'schedule'
  shopId: string
  targetPlanHandle: string
  priceBehavior: PriceBehavior
  notification: NotificationKind
}

export interface UnscheduledMigrationRow {
  action: 'unschedule'
  shopId: string
}

export type PlannedMigrationRow = ScheduledMigrationRow | UnscheduledMigrationRow

export interface MigrationBatch {
  index: number
  rows: PlannedMigrationRow[]
  canonicalPayload: string
  payloadDigest: string
}

export interface MigrationPlan {
  action: MigrationAction
  rows: PlannedMigrationRow[]
  batches: MigrationBatch[]
  canonicalInput: string
  inputDigest: string
}

export interface MigrationValidationError {
  row?: number
  field?: string
  message: string
}

export type MigrationPlanResult = {ok: true; plan: MigrationPlan} | {ok: false; errors: MigrationValidationError[]}

export type MigrationOperationStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

export type MigrationResultCode =
  | 'SCHEDULED'
  | 'CANCELED'
  | 'INVALID_PLAN'
  | 'INELIGIBLE'
  | 'BLOCKED'
  | 'ALREADY_SCHEDULED'
  | 'ALREADY_MIGRATED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

export interface MigrationOperation {
  id: string
  status: MigrationOperationStatus
  total: number
  results: {
    edges: {
      node: {
        shopId: string
        code: MigrationResultCode
      }
    }[]
  }
}
