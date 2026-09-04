import {
  assertMigrationListOutputAvailable,
  outputMigrationList,
  serializeMigrationListCsv,
  serializeMigrationListJson,
  validateMigrationListDestination,
} from './list-output.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

vi.mock('@shopify/cli-kit/node/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/fs')>()
  return {...actual, writeFile: vi.fn(actual.writeFile)}
})

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputInfo: vi.fn(), outputResult: vi.fn()}
})

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

function subscription(overrides: Partial<MigratableSubscription> = {}): MigratableSubscription {
  return {
    shopId: 'gid://shopify/Shop/1',
    status: 'SCHEDULED',
    manualSubscriptionName: 'Legacy plan',
    manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
    manualSubscriptionInterval: 'EVERY_30_DAYS',
    targetPlanHandle: 'standard',
    notification: {
      kind: 'NONE',
      optOutDeadline: '2026-04-01T00:00:00Z',
      sentAt: '2026-03-01T00:00:00Z',
    },
    priceBehavior: 'HONOR_BILLING_PRICE',
    effectiveDate: '2026-05-01T00:00:00Z',
    lastFailureReason: 'SCHEDULING_FAILED',
    ...overrides,
  }
}

describe('migration list serialization', () => {
  test('serializes the exact pretty JSON schema without a trailing newline', () => {
    const subscriptions = [subscription()]
    const expected = `{
  "schemaVersion": 1,
  "subscriptions": [
    {
      "shopId": "gid://shopify/Shop/1",
      "status": "SCHEDULED",
      "manualSubscriptionName": "Legacy plan",
      "manualSubscriptionPrice": {
        "amount": "19.99",
        "currencyCode": "USD"
      },
      "manualSubscriptionInterval": "EVERY_30_DAYS",
      "targetPlanHandle": "standard",
      "notification": {
        "kind": "NONE",
        "optOutDeadline": "2026-04-01T00:00:00Z",
        "sentAt": "2026-03-01T00:00:00Z"
      },
      "priceBehavior": "HONOR_BILLING_PRICE",
      "effectiveDate": "2026-05-01T00:00:00Z",
      "lastFailureReason": "SCHEDULING_FAILED"
    }
  ]
}`

    expect(serializeMigrationListJson(subscriptions)).toBe(expected)
    expect(serializeMigrationListJson(subscriptions)).not.toMatch(/\n$/)
  })

  test('serializes CSV fields in the fixed header order, including a NONE notification', () => {
    expect(serializeMigrationListCsv([subscription()])).toBe(
      `${CSV_HEADER}\n` +
        'gid://shopify/Shop/1,SCHEDULED,Legacy plan,19.99,USD,EVERY_30_DAYS,standard,NONE,2026-04-01T00:00:00Z,2026-03-01T00:00:00Z,HONOR_BILLING_PRICE,2026-05-01T00:00:00Z,SCHEDULING_FAILED\n',
    )
  })

  test('serializes null top-level and nested fields as empty CSV values', () => {
    const input = subscription({
      manualSubscriptionName: null,
      manualSubscriptionPrice: null,
      targetPlanHandle: null,
      notification: null,
      priceBehavior: null,
      effectiveDate: null,
      lastFailureReason: null,
    })

    expect(serializeMigrationListCsv([input])).toBe(
      `${CSV_HEADER}\ngid://shopify/Shop/1,SCHEDULED,,,,EVERY_30_DAYS,,,,,,,\n`,
    )
  })

  test('escapes commas, double quotes, carriage returns, and line feeds in CSV values', () => {
    const input = subscription({
      manualSubscriptionName: 'Legacy, "Plus"\r\nAnnual',
      targetPlanHandle: 'standard,plus',
    })

    const csv = serializeMigrationListCsv([input])

    expect(csv).toContain('"Legacy, ""Plus""\r\nAnnual"')
    expect(csv).toContain(',"standard,plus",')
    expect(csv.endsWith('\n')).toBe(true)
    expect(csv.endsWith('\n\n')).toBe(false)
  })

  test('returns the header and one newline for an empty CSV result', () => {
    expect(serializeMigrationListCsv([])).toBe(`${CSV_HEADER}\n`)
  })
})

describe('migration list destination validation', () => {
  test('rejects a missing output path when JSON stdout was not requested', () => {
    expect(() => validateMigrationListDestination(undefined, false)).toThrow(
      new AbortError('Provide --output <path> or use --json to write subscriptions to stdout.'),
    )
  })

  test('rejects an existing destination unless force is enabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      await writeFile(outputPath, 'original')

      const promise = assertMigrationListOutputAvailable(outputPath, false)

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toThrow(`Output file already exists: ${outputPath}. Use --force to overwrite it.`)
      await expect(readFile(outputPath)).resolves.toBe('original')
    })
  })
})

describe('outputMigrationList', () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockReset()
    vi.mocked(outputInfo).mockReset()
    vi.mocked(outputResult).mockReset()
  })

  test('rejects a missing destination through the output entry point', async () => {
    const promise = outputMigrationList({subscriptions: [], json: false, force: false})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Provide --output <path> or use --json to write subscriptions to stdout.')
    expect(outputResult).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  test('writes one JSON document to stdout exactly once and never writes a file', async () => {
    const subscriptions = [subscription()]

    await outputMigrationList({subscriptions, json: true, force: false})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(serializeMigrationListJson(subscriptions))
    expect(outputInfo).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  test('writes JSON with exactly one trailing newline when an output path is provided, regardless of extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      const subscriptions = [subscription(), subscription({shopId: 'gid://shopify/Shop/2'})]

      await outputMigrationList({subscriptions, json: true, output: outputPath, force: false})

      await expect(readFile(outputPath)).resolves.toBe(`${serializeMigrationListJson(subscriptions)}\n`)
      expect(outputInfo).toHaveBeenCalledOnce()
      expect(outputInfo).toHaveBeenCalledWith(`Wrote 2 subscriptions to ${outputPath}.`)
      expect(outputResult).not.toHaveBeenCalled()
    })
  })

  test('preserves an existing file when force is disabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      await writeFile(outputPath, 'original')
      vi.mocked(writeFile).mockClear()

      const promise = outputMigrationList({
        subscriptions: [subscription()],
        json: false,
        output: outputPath,
        force: false,
      })

      await expect(promise).rejects.toThrow(`Output file already exists: ${outputPath}. Use --force to overwrite it.`)
      await expect(readFile(outputPath)).resolves.toBe('original')
      expect(writeFile).not.toHaveBeenCalled()
      expect(outputInfo).not.toHaveBeenCalled()
    })
  })

  test('replaces an existing file when force is enabled and reports a singular count', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      await writeFile(outputPath, 'original')
      vi.mocked(writeFile).mockClear()
      const subscriptions = [subscription()]

      await outputMigrationList({subscriptions, json: false, output: outputPath, force: true})

      await expect(readFile(outputPath)).resolves.toBe(serializeMigrationListCsv(subscriptions))
      expect(writeFile).toHaveBeenCalledWith(outputPath, serializeMigrationListCsv(subscriptions), {encoding: 'utf8'})
      expect(outputInfo).toHaveBeenCalledWith(`Wrote 1 subscription to ${outputPath}.`)
      expect(outputResult).not.toHaveBeenCalled()
    })
  })

  test('translates a race-time EEXIST error into the existing-file AbortError', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      vi.mocked(writeFile).mockRejectedValueOnce(Object.assign(new Error('file appeared'), {code: 'EEXIST'}))

      const promise = outputMigrationList({subscriptions: [], json: false, output: outputPath, force: false})

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toThrow(`Output file already exists: ${outputPath}. Use --force to overwrite it.`)
      expect(writeFile).toHaveBeenCalledWith(outputPath, `${CSV_HEADER}\n`, {encoding: 'utf8', flag: 'wx'})
      expect(outputInfo).not.toHaveBeenCalled()
    })
  })

  test('wraps other write failures with the destination and original message', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      vi.mocked(writeFile).mockRejectedValueOnce(new Error('permission denied'))

      const promise = outputMigrationList({subscriptions: [], json: false, output: outputPath, force: false})

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toThrow(`Couldn't write subscription export to ${outputPath}: permission denied`)
      expect(outputInfo).not.toHaveBeenCalled()
      expect(outputResult).not.toHaveBeenCalled()
    })
  })
})
