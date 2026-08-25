import {planMigrationInput} from './plan-migration-input.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

describe('planMigrationInput', () => {
  test('plans a schedule migration from a real CSV file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'migrations.csv')
      await writeFile(
        path,
        'shop_id,target_plan_handle,price_behavior,notification\n2,pro,PLAN_PRICE,\n1,basic,HONOR_BILLING_PRICE,OPT_OUT\n',
      )

      const result = await planMigrationInput('schedule', path)

      expect(result).toMatchObject({
        ok: true,
        plan: {
          rows: [
            {shopId: 'gid://shopify/Shop/1', notification: 'OPT_OUT'},
            {shopId: 'gid://shopify/Shop/2', notification: 'WHEN_REQUIRED'},
          ],
          batches: [{index: 0}],
        },
      })
    })
  })

  test('plans an unschedule migration from injected stdin', async () => {
    const readStdin = vi.fn().mockResolvedValue('shop_id\n123\n')

    const result = await planMigrationInput('unschedule', '-', {readStdin})

    expect(result).toMatchObject({
      ok: true,
      plan: {rows: [{action: 'unschedule', shopId: 'gid://shopify/Shop/123'}]},
    })
  })

  test('throws an actionable AbortError when stdin has no data', async () => {
    const readStdin = vi.fn().mockResolvedValue(undefined)

    const promise = planMigrationInput('schedule', '-', {readStdin})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toMatchObject({
      message: 'Provide --input <path> or pipe CSV data to stdin.',
    })
  })

  test('returns all semantic row errors and no plan', async () => {
    const readStdin = vi
      .fn()
      .mockResolvedValue('shop_id,target_plan_handle,price_behavior\ninvalid,,INVALID\n0,basic,PLAN_PRICE\n')

    const result = await planMigrationInput('schedule', '-', {readStdin})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(4)
      expect('plan' in result).toBe(false)
    }
  })

  test('returns parser errors without semantic planning', async () => {
    const readStdin = vi.fn().mockResolvedValue('shop_id\n"unterminated\n')

    const result = await planMigrationInput('unschedule', '-', {readStdin})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('Invalid CSV')
    }
  })
})
