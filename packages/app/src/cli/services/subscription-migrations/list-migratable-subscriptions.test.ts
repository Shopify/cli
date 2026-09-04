import {listMigratableSubscriptions, MigrationListProtocolError} from './list-migratable-subscriptions.js'
import {MIGRATABLE_SUBSCRIPTION_STATUSES} from '../../models/subscription-migrations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../models/subscription-migrations.js'
import type {MigratableSubscriptionPage} from './partners-api.js'

function subscription(shopId: string): MigratableSubscription {
  return {
    shopId,
    status: 'UNSCHEDULED',
    manualSubscriptionName: null,
    manualSubscriptionPrice: null,
    manualSubscriptionInterval: 'EVERY_30_DAYS',
    targetPlanHandle: null,
    notification: null,
    priceBehavior: null,
    effectiveDate: null,
    lastFailureReason: null,
  }
}

function page(
  subscriptions: MigratableSubscription[],
  pageInfo: MigratableSubscriptionPage['pageInfo'] = {hasNextPage: false, endCursor: null},
): MigratableSubscriptionPage {
  return {subscriptions, pageInfo}
}

describe('listMigratableSubscriptions', () => {
  test('returns one page in API order and sends the exact initial request', async () => {
    const subscriptions = [subscription('shop-two'), subscription('shop-one')]
    const getPage = vi.fn().mockResolvedValue(page(subscriptions))

    await expect(listMigratableSubscriptions({clientId: 'client-id', getPage})).resolves.toEqual(subscriptions)

    expect(getPage).toHaveBeenCalledOnce()
    expect(getPage).toHaveBeenCalledWith({
      clientId: 'client-id',
      first: 250,
      after: undefined,
      status: undefined,
    })
  })

  test('returns an empty list for an empty page', async () => {
    const getPage = vi.fn().mockResolvedValue(page([]))

    await expect(listMigratableSubscriptions({clientId: 'client-id', getPage})).resolves.toEqual([])
  })

  test('fetches every page sequentially and forwards the exact opaque cursor and status', async () => {
    const firstSubscription = subscription('shop-one')
    const secondSubscription = subscription('shop-two')
    const opaqueCursor = ' opaque cursor '
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([firstSubscription], {hasNextPage: true, endCursor: opaqueCursor}))
      .mockResolvedValueOnce(page([secondSubscription]))

    await expect(listMigratableSubscriptions({clientId: 'client-id', status: 'SCHEDULED', getPage})).resolves.toEqual([
      firstSubscription,
      secondSubscription,
    ])

    expect(getPage).toHaveBeenCalledTimes(2)
    expect(getPage).toHaveBeenNthCalledWith(1, {
      clientId: 'client-id',
      first: 250,
      after: undefined,
      status: 'SCHEDULED',
    })
    expect(getPage).toHaveBeenNthCalledWith(2, {
      clientId: 'client-id',
      first: 250,
      after: opaqueCursor,
      status: 'SCHEDULED',
    })
  })

  test.each(MIGRATABLE_SUBSCRIPTION_STATUSES)('forwards the %s status', async (status) => {
    const getPage = vi.fn().mockResolvedValue(page([]))

    await listMigratableSubscriptions({clientId: 'client-id', status, getPage})

    expect(getPage).toHaveBeenCalledWith({
      clientId: 'client-id',
      first: 250,
      after: undefined,
      status,
    })
  })

  test('throws an exact AbortError when the app connection is null', async () => {
    const getPage = vi.fn().mockResolvedValue(null)
    const promise = listMigratableSubscriptions({clientId: 'client-id', getPage})

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('App not found')
  })

  test.each([null, '', '   \t'])('rejects a next page with an invalid cursor: %j', async (endCursor) => {
    const getPage = vi.fn().mockResolvedValue(page([], {hasNextPage: true, endCursor}))
    const promise = listMigratableSubscriptions({clientId: 'client-id', getPage})

    await expect(promise).rejects.toBeInstanceOf(MigrationListProtocolError)
    expect(getPage).toHaveBeenCalledOnce()
  })

  test('rejects a repeated cursor instead of requesting the same page again', async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([], {hasNextPage: true, endCursor: 'cursor'}))
      .mockResolvedValueOnce(page([], {hasNextPage: true, endCursor: 'cursor'}))
    const promise = listMigratableSubscriptions({clientId: 'client-id', getPage})

    await expect(promise).rejects.toBeInstanceOf(MigrationListProtocolError)
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  test('rejects a later-page API failure without returning partial data', async () => {
    const apiError = new Error('Partners API unavailable')
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([subscription('shop-one')], {hasNextPage: true, endCursor: 'next'}))
      .mockRejectedValueOnce(apiError)

    await expect(listMigratableSubscriptions({clientId: 'client-id', getPage})).rejects.toBe(apiError)
    expect(getPage).toHaveBeenCalledTimes(2)
  })
})
