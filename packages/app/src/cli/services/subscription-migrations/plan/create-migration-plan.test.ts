import {createMigrationPlan} from './create-migration-plan.js'
import {describe, expect, test} from 'vitest'
import type {RawMigrationRow} from '../../../models/subscription-migrations.js'

function scheduleRow(sourceRow: number, shopId: string): RawMigrationRow {
  return {
    sourceRow,
    shopId,
    targetPlanHandle: `plan-${shopId}`,
    priceBehavior: 'PLAN_PRICE',
  }
}

describe('createMigrationPlan', () => {
  test('normalizes, canonically sorts, defaults, and batches schedule rows', () => {
    const result = createMigrationPlan('schedule', [
      {
        sourceRow: 2,
        shopId: '2',
        targetPlanHandle: 'pro',
        priceBehavior: 'PLAN_PRICE',
      },
      {
        sourceRow: 3,
        shopId: 'gid://shopify/Shop/10',
        targetPlanHandle: 'basic',
        priceBehavior: 'HONOR_BILLING_PRICE',
        notification: 'OPT_OUT',
      },
    ])

    expect(result).toMatchObject({
      ok: true,
      plan: {
        rows: [
          {
            action: 'schedule',
            shopId: 'gid://shopify/Shop/10',
            targetPlanHandle: 'basic',
            priceBehavior: 'HONOR_BILLING_PRICE',
            notification: 'OPT_OUT',
          },
          {
            action: 'schedule',
            shopId: 'gid://shopify/Shop/2',
            targetPlanHandle: 'pro',
            priceBehavior: 'PLAN_PRICE',
            notification: 'WHEN_REQUIRED',
          },
        ],
        batches: [{index: 0}],
      },
    })
  })

  test('reports zero, malformed, wrong-model, and blank shop IDs', () => {
    const invalidIds = ['', '0', '-1', '1.5', 'gid://shopify/Product/1', 'gid://shopify/Shop/abc']
    const result = createMigrationPlan(
      'unschedule',
      invalidIds.map((shopId, index) => ({sourceRow: index + 2, shopId})),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(invalidIds.length)
      expect(result.errors.every(({field}) => field === 'shop_id')).toBe(true)
      expect('plan' in result).toBe(false)
    }
  })

  test('aggregates every invalid field from every row and returns no plan', () => {
    const result = createMigrationPlan('schedule', [
      {
        sourceRow: 2,
        shopId: 'invalid',
        targetPlanHandle: ' ',
        priceBehavior: 'INVALID',
        notification: 'ALSO_INVALID',
      },
      {
        sourceRow: 3,
        shopId: '0',
        targetPlanHandle: '',
        priceBehavior: '',
        notification: 'UNKNOWN',
      },
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(8)
      expect('plan' in result).toBe(false)
    }
  })

  test('reports all invalid schedule enums together', () => {
    const result = createMigrationPlan('schedule', [
      {
        sourceRow: 2,
        shopId: '1',
        targetPlanHandle: 'basic',
        priceBehavior: 'INVALID',
        notification: 'ALSO_INVALID',
      },
    ])

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          row: 2,
          field: 'price_behavior',
          message: 'Price behavior must be HONOR_BILLING_PRICE or PLAN_PRICE',
        },
        {
          row: 2,
          field: 'notification',
          message: 'Notification must be OPT_OUT or WHEN_REQUIRED',
        },
      ],
    })
  })

  test('rejects NONE as a notification kind', () => {
    const result = createMigrationPlan('schedule', [
      {
        sourceRow: 2,
        shopId: '1',
        targetPlanHandle: 'basic',
        priceBehavior: 'PLAN_PRICE',
        notification: 'NONE',
      },
    ])

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          row: 2,
          field: 'notification',
          message: 'Notification must be OPT_OUT or WHEN_REQUIRED',
        },
      ],
    })
  })

  test('unschedule validates only shop_id', () => {
    const result = createMigrationPlan('unschedule', [
      {
        sourceRow: 2,
        shopId: '1',
        targetPlanHandle: '',
        priceBehavior: 'INVALID',
        notification: 'INVALID',
      },
    ])

    expect(result).toMatchObject({
      ok: true,
      plan: {rows: [{action: 'unschedule', shopId: 'gid://shopify/Shop/1'}]},
    })
  })

  test('rejects normalized duplicates and cites the first source row', () => {
    const result = createMigrationPlan('unschedule', [
      {sourceRow: 2, shopId: '001'},
      {sourceRow: 3, shopId: 'gid://shopify/Shop/1'},
    ])

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          row: 3,
          field: 'shop_id',
          message: 'Duplicate shop ID; first seen on row 2',
        },
      ],
    })
  })

  test('splits 251 rows into deterministic batches of 250 and 1', () => {
    const first = createMigrationPlan(
      'schedule',
      Array.from({length: 251}, (_, index) => scheduleRow(index + 2, String(index + 1))),
    )
    const second = createMigrationPlan(
      'schedule',
      Array.from({length: 251}, (_, index) => scheduleRow(index + 2, String(251 - index))),
    )

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.plan.batches.map(({rows}) => rows.length)).toEqual([250, 1])
      expect(first.plan.batches.map(({index}) => index)).toEqual([0, 1])
      expect(first.plan.batches).toEqual(second.plan.batches)
    }
  })

  test('keeps canonical input and its digest stable across source ordering and ID spelling', () => {
    const first = createMigrationPlan('schedule', [
      {...scheduleRow(2, '2'), targetPlanHandle: 'plan-2'},
      {...scheduleRow(3, '001'), targetPlanHandle: 'plan-1'},
    ])
    const second = createMigrationPlan('schedule', [
      {...scheduleRow(40, 'gid://shopify/Shop/1'), targetPlanHandle: 'plan-1'},
      {...scheduleRow(50, 'gid://shopify/Shop/2'), targetPlanHandle: 'plan-2'},
    ])

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.plan.canonicalInput).toBe(second.plan.canonicalInput)
      expect(first.plan.inputDigest).toBe(second.plan.inputDigest)
      expect(first.plan.batches).toEqual(second.plan.batches)
    }
  })

  test('uses action-specific canonical input', () => {
    const schedule = createMigrationPlan('schedule', [scheduleRow(2, '1')])
    const unschedule = createMigrationPlan('unschedule', [{sourceRow: 2, shopId: '1'}])

    expect(schedule.ok && unschedule.ok).toBe(true)
    if (schedule.ok && unschedule.ok) {
      expect(schedule.plan.canonicalInput).not.toBe(unschedule.plan.canonicalInput)
      expect(schedule.plan.inputDigest).not.toBe(unschedule.plan.inputDigest)
    }
  })
})
