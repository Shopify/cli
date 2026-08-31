import {parseMigrationCsv} from './parse-migration-csv.js'
import {describe, expect, test} from 'vitest'

describe('parseMigrationCsv', () => {
  test('maps schedule headers and preserves source row numbers', () => {
    expect(
      parseMigrationCsv(
        'shop_id,target_plan_handle,price_behavior,notification\n123,basic,PLAN_PRICE,WHEN_REQUIRED\n',
        'schedule',
      ),
    ).toEqual({
      ok: true,
      rows: [
        {
          sourceRow: 2,
          shopId: '123',
          targetPlanHandle: 'basic',
          priceBehavior: 'PLAN_PRICE',
          notification: 'WHEN_REQUIRED',
        },
      ],
    })
  })

  test('parses quoted fields, a BOM, whitespace, and empty lines', () => {
    const result = parseMigrationCsv(
      '\ufeffshop_id,target_plan_handle,price_behavior,notification\n\n "123" , "Basic, monthly" , PLAN_PRICE , WHEN_REQUIRED \n',
      'schedule',
    )

    expect(result).toMatchObject({
      ok: true,
      rows: [{shopId: '123', targetPlanHandle: 'Basic, monthly'}],
    })
  })

  test('accepts a full schedule CSV for unschedule and ignores schedule-only columns', () => {
    expect(
      parseMigrationCsv(
        'shop_id,target_plan_handle,price_behavior,notification\n123,basic,not-validated,not-validated\n',
        'unschedule',
      ),
    ).toEqual({ok: true, rows: [{sourceRow: 2, shopId: '123'}]})
  })

  test('accepts a minimal unschedule CSV', () => {
    expect(parseMigrationCsv('shop_id\n123\n', 'unschedule')).toEqual({
      ok: true,
      rows: [{sourceRow: 2, shopId: '123'}],
    })
  })

  test('rejects every missing required schedule header', () => {
    expect(parseMigrationCsv('shop_id\n123\n', 'schedule')).toEqual({
      ok: false,
      errors: [
        {field: 'target_plan_handle', message: 'Missing required CSV header: target_plan_handle'},
        {field: 'price_behavior', message: 'Missing required CSV header: price_behavior'},
      ],
    })
  })

  test('rejects an unschedule CSV without shop_id', () => {
    expect(parseMigrationCsv('notification\nOPT_OUT\n', 'unschedule')).toEqual({
      ok: false,
      errors: [{field: 'shop_id', message: 'Missing required CSV header: shop_id'}],
    })
  })

  test('rejects every unknown header', () => {
    expect(parseMigrationCsv('shop_id,unexpected,also_bad\n123,value,value\n', 'unschedule')).toEqual({
      ok: false,
      errors: [
        {field: 'unexpected', message: 'Unknown CSV header: unexpected'},
        {field: 'also_bad', message: 'Unknown CSV header: also_bad'},
      ],
    })
  })

  test('rejects duplicate and unknown headers together', () => {
    expect(parseMigrationCsv('shop_id,shop_id,unexpected\n123,456,value\n', 'unschedule')).toEqual({
      ok: false,
      errors: [
        {field: 'shop_id', message: 'Duplicate CSV header: shop_id'},
        {field: 'unexpected', message: 'Unknown CSV header: unexpected'},
      ],
    })
  })

  test('returns a structured error for malformed CSV', () => {
    const result = parseMigrationCsv('shop_id\n"unterminated\n', 'unschedule')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.message).toContain('Invalid CSV')
    }
  })

  test('rejects a header-only CSV', () => {
    expect(parseMigrationCsv('shop_id\n', 'unschedule')).toEqual({
      ok: false,
      errors: [{message: 'The CSV must contain at least one data row'}],
    })
  })

  test('rejects empty input', () => {
    expect(parseMigrationCsv('', 'schedule')).toEqual({
      ok: false,
      errors: [{message: 'The CSV is empty'}],
    })
  })
})
