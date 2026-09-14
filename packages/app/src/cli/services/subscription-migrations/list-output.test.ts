import {outputMigrationList, serializeMigrationListCsv, serializeMigrationListJson} from './list-output.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

const CSV_ROW =
  'gid://shopify/Shop/1,SCHEDULED,Legacy plan,19.99,USD,EVERY_30_DAYS,standard,NONE,2026-04-01T00:00:00Z,2026-03-01T00:00:00Z,HONOR_BILLING_PRICE,2026-05-01T00:00:00Z,SCHEDULING_FAILED'

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

async function* pagesOf(...pages: MigratableSubscription[][]): AsyncGenerator<MigratableSubscription[]> {
  for (const page of pages) yield page
}

/**
 * Yields the given pages and records how many times stdout had been written to when each page was requested,
 * so tests can prove that output for a page happens before the next page is pulled.
 */
function observedPages(...pages: MigratableSubscription[][]) {
  const outputCallsWhenPageRequested: number[] = []
  async function* generator(): AsyncGenerator<MigratableSubscription[]> {
    for (const page of pages) {
      outputCallsWhenPageRequested.push(vi.mocked(outputResult).mock.calls.length)
      yield page
    }
  }
  return {pages: generator(), outputCallsWhenPageRequested}
}

async function* pagesThenFailure(
  pages: MigratableSubscription[][],
  error: Error,
): AsyncGenerator<MigratableSubscription[]> {
  for (const page of pages) yield page
  throw error
}

function outputWrittenToStdout(): string {
  return vi
    .mocked(outputResult)
    .mock.calls.map(([content]) => `${content as string}\n`)
    .join('')
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

  test('serializes CSV fields in the fixed header order without a trailing newline', () => {
    expect(serializeMigrationListCsv([subscription()])).toBe(`${CSV_HEADER}\n${CSV_ROW}`)
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
      `${CSV_HEADER}\ngid://shopify/Shop/1,SCHEDULED,,,,EVERY_30_DAYS,,,,,,,`,
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
    expect(csv.endsWith('\n')).toBe(false)
  })

  test('returns only the header for an empty CSV result', () => {
    expect(serializeMigrationListCsv([])).toBe(CSV_HEADER)
  })
})

describe('outputMigrationList CSV streaming', () => {
  test('writes the header and first page rows to stdout exactly once for a single page', async () => {
    await outputMigrationList({pages: pagesOf([subscription()]), json: false})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(`${CSV_HEADER}\n${CSV_ROW}`)
  })

  test('writes only the header for an empty result', async () => {
    await outputMigrationList({pages: pagesOf([]), json: false})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(CSV_HEADER)
  })

  test('writes the header and page one before page two is requested', async () => {
    const {pages, outputCallsWhenPageRequested} = observedPages(
      [subscription({shopId: 'gid://shopify/Shop/1'})],
      [subscription({shopId: 'gid://shopify/Shop/2'})],
    )

    await outputMigrationList({pages, json: false})

    expect(outputCallsWhenPageRequested).toEqual([0, 1])
    expect(vi.mocked(outputResult).mock.calls[0]![0]).toBe(`${CSV_HEADER}\n${CSV_ROW}`)
  })

  test('writes each page in API order and the combined stdout equals the single-document CSV', async () => {
    const pageOne = [subscription({shopId: 'gid://shopify/Shop/1'}), subscription({shopId: 'gid://shopify/Shop/2'})]
    const pageTwo = [subscription({shopId: 'gid://shopify/Shop/3'})]
    const pageThree = [subscription({shopId: 'gid://shopify/Shop/4', manualSubscriptionName: 'Legacy, "Plus"'})]

    await outputMigrationList({pages: pagesOf(pageOne, pageTwo, pageThree), json: false})

    expect(outputResult).toHaveBeenCalledTimes(3)
    expect(vi.mocked(outputResult).mock.calls.map(([content]) => content)).toEqual([
      `${CSV_HEADER}\n${CSV_ROW}\n${CSV_ROW.replace('Shop/1', 'Shop/2')}`,
      CSV_ROW.replace('Shop/1', 'Shop/3'),
      CSV_ROW.replace('Shop/1', 'Shop/4').replace('Legacy plan', '"Legacy, ""Plus"""'),
    ])
    expect(outputWrittenToStdout()).toBe(`${serializeMigrationListCsv([...pageOne, ...pageTwo, ...pageThree])}\n`)
  })

  test('does not write blank lines for empty later pages', async () => {
    const pageOne = [subscription({shopId: 'gid://shopify/Shop/1'})]
    const pageThree = [subscription({shopId: 'gid://shopify/Shop/3'})]

    await outputMigrationList({pages: pagesOf(pageOne, [], pageThree), json: false})

    expect(outputResult).toHaveBeenCalledTimes(2)
    expect(outputWrittenToStdout()).toBe(`${serializeMigrationListCsv([...pageOne, ...pageThree])}\n`)
  })

  test('writes the header with the first non-empty page when the first page is empty', async () => {
    const pageTwo = [subscription({shopId: 'gid://shopify/Shop/2'})]

    await outputMigrationList({pages: pagesOf([], pageTwo), json: false})

    expect(outputResult).toHaveBeenCalledTimes(2)
    expect(vi.mocked(outputResult).mock.calls.map(([content]) => content)).toEqual([
      CSV_HEADER,
      CSV_ROW.replace('Shop/1', 'Shop/2'),
    ])
    expect(outputWrittenToStdout()).toBe(`${serializeMigrationListCsv(pageTwo)}\n`)
  })

  test('leaves earlier pages on stdout as valid partial CSV and propagates a later page failure', async () => {
    const apiError = new Error('Partners API unavailable')
    const pageOne = [subscription({shopId: 'gid://shopify/Shop/1'})]
    const pageTwo = [subscription({shopId: 'gid://shopify/Shop/2'})]

    await expect(
      outputMigrationList({pages: pagesThenFailure([pageOne, pageTwo], apiError), json: false}),
    ).rejects.toBe(apiError)

    expect(outputResult).toHaveBeenCalledTimes(2)
    expect(outputWrittenToStdout()).toBe(`${serializeMigrationListCsv([...pageOne, ...pageTwo])}\n`)
  })

  test('writes nothing when the first page fails', async () => {
    const apiError = new Error('Partners API unavailable')

    await expect(outputMigrationList({pages: pagesThenFailure([], apiError), json: false})).rejects.toBe(apiError)

    expect(outputResult).not.toHaveBeenCalled()
  })
})

describe('outputMigrationList JSON', () => {
  test('writes exactly one complete JSON document only after every page succeeds', async () => {
    const pageOne = [subscription({shopId: 'gid://shopify/Shop/1'})]
    const pageTwo = [subscription({shopId: 'gid://shopify/Shop/2'})]
    const {pages, outputCallsWhenPageRequested} = observedPages(pageOne, pageTwo)

    await outputMigrationList({pages, json: true})

    expect(outputCallsWhenPageRequested).toEqual([0, 0])
    expect(outputResult).toHaveBeenCalledOnce()
    const output = vi.mocked(outputResult).mock.calls[0]![0] as string
    expect(output).toBe(serializeMigrationListJson([...pageOne, ...pageTwo]))
    expect(JSON.parse(output)).toEqual({schemaVersion: 1, subscriptions: [...pageOne, ...pageTwo]})
  })

  test('writes an empty versioned JSON document for an empty result', async () => {
    await outputMigrationList({pages: pagesOf([]), json: true})

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(serializeMigrationListJson([]))
  })

  test('writes nothing and propagates the error when a later page fails', async () => {
    const apiError = new Error('Partners API unavailable')
    const pageOne = [subscription({shopId: 'gid://shopify/Shop/1'})]

    await expect(outputMigrationList({pages: pagesThenFailure([pageOne], apiError), json: true})).rejects.toBe(apiError)

    expect(outputResult).not.toHaveBeenCalled()
  })
})
