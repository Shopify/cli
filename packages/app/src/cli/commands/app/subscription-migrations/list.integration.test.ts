import List from './list.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {MigrationListProtocolError} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {getMigratableSubscriptionPage} from '../../../services/subscription-migrations/partners-api.js'
import {Config} from '@oclif/core'
import {outputResult} from '@shopify/cli-kit/node/output'
import {parse} from 'csv-parse/sync'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../../models/subscription-migrations.js'
import type {MigratableSubscriptionPage} from '../../../services/subscription-migrations/partners-api.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/partners-api.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

const CSV_HEADER =
  'shop_id,status,manual_subscription_name,manual_subscription_price_amount,manual_subscription_price_currency_code,manual_subscription_interval,target_plan_handle,notification_kind,notification_opt_out_deadline,notification_sent_at,price_behavior,effective_date,last_failure_reason'

const app = testAppLinked()
const remoteApp = testOrganizationApp({apiKey: 'remote-client-id'})
const historicalSubscription: MigratableSubscription = {
  shopId: 'gid://shopify/Shop/123456789',
  status: 'MIGRATED',
  manualSubscriptionName: 'Historical legacy plan',
  manualSubscriptionPrice: {amount: '29.95', currencyCode: 'CAD'},
  manualSubscriptionInterval: 'ANNUAL',
  targetPlanHandle: 'plus',
  notification: {
    kind: 'NONE',
    optOutDeadline: '2025-12-01T00:00:00Z',
    sentAt: '2025-11-01T00:00:00Z',
  },
  priceBehavior: 'PLAN_PRICE',
  effectiveDate: '2026-01-01T00:00:00Z',
  lastFailureReason: 'SUPERSEDED',
}

function subscription(shopId: string, overrides: Partial<MigratableSubscription> = {}): MigratableSubscription {
  return {...historicalSubscription, shopId, ...overrides}
}

function page(
  subscriptions: MigratableSubscription[],
  pageInfo: MigratableSubscriptionPage['pageInfo'] = {hasNextPage: false, endCursor: null},
): MigratableSubscriptionPage {
  return {subscriptions, pageInfo}
}

function stdoutWrites(): string[] {
  return vi.mocked(outputResult).mock.calls.map(([content]) => content as string)
}

/** Reconstructs what a shell redirection would have captured: every write, each terminated by a newline. */
function stdoutContent(): string {
  return stdoutWrites()
    .map((write) => `${write}\n`)
    .join('')
}

function parseCsvRows(csv: string): {shop_id: string; manual_subscription_name: string}[] {
  return parse(csv, {columns: true})
}

function invocationOrder(mock: {mock: {invocationCallOrder: number[]}}): number[] {
  return mock.mock.invocationCallOrder
}

async function runListWithoutOclifErrorHandling(argv: string[]) {
  const config = await Config.load()
  return new List(argv, config).run()
}

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
})

describe('subscription migration list command output integration', () => {
  test('writes default CSV for a single page to stdout exactly once', async () => {
    vi.mocked(getMigratableSubscriptionPage).mockResolvedValue(page([historicalSubscription]))

    await List.run([])

    expect(getMigratableSubscriptionPage).toHaveBeenCalledOnce()
    expect(getMigratableSubscriptionPage).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      first: 250,
      after: undefined,
      status: undefined,
    })
    expect(outputResult).toHaveBeenCalledOnce()
    const output = stdoutWrites()[0]!
    expect(output).toBe(
      `${CSV_HEADER}\n` +
        'gid://shopify/Shop/123456789,MIGRATED,Historical legacy plan,29.95,CAD,ANNUAL,plus,NONE,2025-12-01T00:00:00Z,2025-11-01T00:00:00Z,PLAN_PRICE,2026-01-01T00:00:00Z,SUPERSEDED',
    )
    expect(parse(output, {columns: true})).toEqual([
      {
        shop_id: 'gid://shopify/Shop/123456789',
        status: 'MIGRATED',
        manual_subscription_name: 'Historical legacy plan',
        manual_subscription_price_amount: '29.95',
        manual_subscription_price_currency_code: 'CAD',
        manual_subscription_interval: 'ANNUAL',
        target_plan_handle: 'plus',
        notification_kind: 'NONE',
        notification_opt_out_deadline: '2025-12-01T00:00:00Z',
        notification_sent_at: '2025-11-01T00:00:00Z',
        price_behavior: 'PLAN_PRICE',
        effective_date: '2026-01-01T00:00:00Z',
        last_failure_reason: 'SUPERSEDED',
      },
    ])
  })

  test('writes only the CSV header when there are no subscriptions', async () => {
    vi.mocked(getMigratableSubscriptionPage).mockResolvedValue(page([]))

    await List.run([])

    expect(outputResult).toHaveBeenCalledOnce()
    expect(outputResult).toHaveBeenCalledWith(CSV_HEADER)
    expect(parse(stdoutContent(), {columns: true})).toEqual([])
  })

  test('streams CSV page by page, writing the header and page one before requesting page two', async () => {
    vi.mocked(getMigratableSubscriptionPage)
      .mockResolvedValueOnce(
        page([subscription('gid://shopify/Shop/1'), subscription('gid://shopify/Shop/2')], {
          hasNextPage: true,
          endCursor: 'cursor-one',
        }),
      )
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/3')], {hasNextPage: true, endCursor: 'cursor-two'}))
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/4', {manualSubscriptionName: 'Plan, "Plus"'})]))

    await List.run(['--status', 'MIGRATED'])

    expect(getMigratableSubscriptionPage).toHaveBeenCalledTimes(3)
    expect(getMigratableSubscriptionPage).toHaveBeenNthCalledWith(1, {
      clientId: 'remote-client-id',
      first: 250,
      after: undefined,
      status: 'MIGRATED',
    })
    expect(getMigratableSubscriptionPage).toHaveBeenNthCalledWith(2, {
      clientId: 'remote-client-id',
      first: 250,
      after: 'cursor-one',
      status: 'MIGRATED',
    })
    expect(getMigratableSubscriptionPage).toHaveBeenNthCalledWith(3, {
      clientId: 'remote-client-id',
      first: 250,
      after: 'cursor-two',
      status: 'MIGRATED',
    })

    // Each page is written to stdout before the next page is requested.
    const [pageOneRequest, pageTwoRequest, pageThreeRequest] = invocationOrder(vi.mocked(getMigratableSubscriptionPage))
    const [pageOneWrite, pageTwoWrite, pageThreeWrite] = invocationOrder(vi.mocked(outputResult))
    expect(outputResult).toHaveBeenCalledTimes(3)
    expect(pageOneRequest).toBeLessThan(pageOneWrite!)
    expect(pageOneWrite).toBeLessThan(pageTwoRequest!)
    expect(pageTwoRequest).toBeLessThan(pageTwoWrite!)
    expect(pageTwoWrite).toBeLessThan(pageThreeRequest!)
    expect(pageThreeRequest).toBeLessThan(pageThreeWrite!)

    const writes = stdoutWrites()
    expect(writes[0]!.startsWith(`${CSV_HEADER}\n`)).toBe(true)
    expect(writes[1]).not.toContain(CSV_HEADER)
    expect(writes[2]).not.toContain(CSV_HEADER)
    expect(writes[2]).toContain('"Plan, ""Plus"""')

    const rows = parseCsvRows(stdoutContent())
    expect(rows.map((row) => row.shop_id)).toEqual([
      'gid://shopify/Shop/1',
      'gid://shopify/Shop/2',
      'gid://shopify/Shop/3',
      'gid://shopify/Shop/4',
    ])
    expect(rows[3]!.manual_subscription_name).toBe('Plan, "Plus"')
  })

  test('keeps earlier CSV pages on stdout and propagates the error when a later page fails', async () => {
    const apiError = new Error('Partners API unavailable')
    vi.mocked(getMigratableSubscriptionPage)
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/1')], {hasNextPage: true, endCursor: 'cursor-one'}))
      .mockRejectedValueOnce(apiError)

    await expect(runListWithoutOclifErrorHandling([])).rejects.toBe(apiError)

    expect(getMigratableSubscriptionPage).toHaveBeenCalledTimes(2)
    expect(outputResult).toHaveBeenCalledOnce()
    const rows = parseCsvRows(stdoutContent())
    expect(rows.map((row) => row.shop_id)).toEqual(['gid://shopify/Shop/1'])
  })

  test('keeps earlier CSV pages on stdout when a later page has an invalid cursor', async () => {
    vi.mocked(getMigratableSubscriptionPage)
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/1')], {hasNextPage: true, endCursor: 'cursor-one'}))
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/2')], {hasNextPage: true, endCursor: '  '}))

    await expect(runListWithoutOclifErrorHandling([])).rejects.toBeInstanceOf(MigrationListProtocolError)

    expect(getMigratableSubscriptionPage).toHaveBeenCalledTimes(2)
    const rows = parseCsvRows(stdoutContent())
    expect(rows.map((row) => row.shop_id)).toEqual(['gid://shopify/Shop/1', 'gid://shopify/Shop/2'])
  })

  test('writes nothing when the first page fails', async () => {
    const apiError = new Error('Partners API unavailable')
    vi.mocked(getMigratableSubscriptionPage).mockRejectedValue(apiError)

    await expect(runListWithoutOclifErrorHandling([])).rejects.toBe(apiError)

    expect(outputResult).not.toHaveBeenCalled()
  })

  test('writes exactly one complete versioned JSON document after every page succeeds', async () => {
    const pageOne = [subscription('gid://shopify/Shop/1'), subscription('gid://shopify/Shop/2')]
    const pageTwo = [subscription('gid://shopify/Shop/3')]
    vi.mocked(getMigratableSubscriptionPage)
      .mockResolvedValueOnce(page(pageOne, {hasNextPage: true, endCursor: 'cursor-one'}))
      .mockResolvedValueOnce(page(pageTwo))

    await List.run(['--json', '--status', 'SCHEDULED'])

    expect(getMigratableSubscriptionPage).toHaveBeenCalledTimes(2)
    expect(getMigratableSubscriptionPage).toHaveBeenNthCalledWith(2, {
      clientId: 'remote-client-id',
      first: 250,
      after: 'cursor-one',
      status: 'SCHEDULED',
    })

    // Nothing is written until the last page has been fetched.
    const lastPageRequest = invocationOrder(vi.mocked(getMigratableSubscriptionPage)).at(-1)!
    const [jsonWrite] = invocationOrder(vi.mocked(outputResult))
    expect(outputResult).toHaveBeenCalledOnce()
    expect(jsonWrite).toBeGreaterThan(lastPageRequest)

    const output = stdoutWrites()[0]!
    expect(output).toBe(JSON.stringify({schemaVersion: 1, subscriptions: [...pageOne, ...pageTwo]}, null, 2))
    expect(JSON.parse(output)).toEqual({schemaVersion: 1, subscriptions: [...pageOne, ...pageTwo]})
  })

  test('writes an empty versioned JSON document when there are no subscriptions', async () => {
    vi.mocked(getMigratableSubscriptionPage).mockResolvedValue(page([]))

    await List.run(['--json'])

    expect(outputResult).toHaveBeenCalledOnce()
    expect(JSON.parse(stdoutWrites()[0]!)).toEqual({schemaVersion: 1, subscriptions: []})
  })

  test('writes no JSON at all when a later page fails', async () => {
    const apiError = new Error('Partners API unavailable')
    vi.mocked(getMigratableSubscriptionPage)
      .mockResolvedValueOnce(page([subscription('gid://shopify/Shop/1')], {hasNextPage: true, endCursor: 'cursor-one'}))
      .mockRejectedValueOnce(apiError)

    await expect(runListWithoutOclifErrorHandling(['--json'])).rejects.toBe(apiError)

    expect(getMigratableSubscriptionPage).toHaveBeenCalledTimes(2)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
