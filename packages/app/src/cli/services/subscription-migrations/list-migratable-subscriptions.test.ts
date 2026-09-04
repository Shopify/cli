import {iterateMigratableSubscriptionPages, MigrationListProtocolError} from './list-migratable-subscriptions.js'
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

async function collectPages(pages: AsyncIterable<MigratableSubscription[]>): Promise<MigratableSubscription[][]> {
  const collected: MigratableSubscription[][] = []
  for await (const subscriptions of pages) collected.push(subscriptions)
  return collected
}

describe('iterateMigratableSubscriptionPages', () => {
  test('yields one page in API order and sends the exact initial request', async () => {
    const subscriptions = [subscription('shop-two'), subscription('shop-one')]
    const getPage = vi.fn().mockResolvedValue(page(subscriptions))

    await expect(collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', getPage}))).resolves.toEqual([
      subscriptions,
    ])

    expect(getPage).toHaveBeenCalledOnce()
    expect(getPage).toHaveBeenCalledWith({
      clientId: 'client-id',
      first: 250,
      after: undefined,
      status: undefined,
    })
  })

  test('yields a single empty page for an empty result', async () => {
    const getPage = vi.fn().mockResolvedValue(page([]))

    await expect(collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', getPage}))).resolves.toEqual([
      [],
    ])
  })

  test('does not request a page until the consumer asks for it', async () => {
    const getPage = vi.fn().mockResolvedValue(page([]))

    const pages = iterateMigratableSubscriptionPages({clientId: 'client-id', getPage})
    expect(getPage).not.toHaveBeenCalled()

    await pages.next()
    expect(getPage).toHaveBeenCalledOnce()
  })

  test('yields every page in order and forwards the exact opaque cursor and status on each request', async () => {
    const firstSubscription = subscription('shop-one')
    const secondSubscription = subscription('shop-two')
    const thirdSubscription = subscription('shop-three')
    const opaqueCursor = ' opaque cursor '
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([firstSubscription], {hasNextPage: true, endCursor: opaqueCursor}))
      .mockResolvedValueOnce(page([secondSubscription], {hasNextPage: true, endCursor: 'second-cursor'}))
      .mockResolvedValueOnce(page([thirdSubscription]))

    await expect(
      collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', status: 'SCHEDULED', getPage})),
    ).resolves.toEqual([[firstSubscription], [secondSubscription], [thirdSubscription]])

    expect(getPage).toHaveBeenCalledTimes(3)
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
    expect(getPage).toHaveBeenNthCalledWith(3, {
      clientId: 'client-id',
      first: 250,
      after: 'second-cursor',
      status: 'SCHEDULED',
    })
  })

  test('yields page one before requesting page two', async () => {
    const firstSubscription = subscription('shop-one')
    const secondSubscription = subscription('shop-two')
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([firstSubscription], {hasNextPage: true, endCursor: 'cursor'}))
      .mockResolvedValueOnce(page([secondSubscription]))

    const pages = iterateMigratableSubscriptionPages({clientId: 'client-id', getPage})

    await expect(pages.next()).resolves.toEqual({done: false, value: [firstSubscription]})
    expect(getPage).toHaveBeenCalledOnce()

    await expect(pages.next()).resolves.toEqual({done: false, value: [secondSubscription]})
    expect(getPage).toHaveBeenCalledTimes(2)

    await expect(pages.next()).resolves.toEqual({done: true, value: undefined})
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  test.each(MIGRATABLE_SUBSCRIPTION_STATUSES)('forwards the %s status on every page', async (status) => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([], {hasNextPage: true, endCursor: 'cursor'}))
      .mockResolvedValueOnce(page([]))

    await collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', status, getPage}))

    expect(getPage).toHaveBeenCalledTimes(2)
    expect(getPage).toHaveBeenNthCalledWith(1, {
      clientId: 'client-id',
      first: 250,
      after: undefined,
      status,
    })
    expect(getPage).toHaveBeenNthCalledWith(2, {
      clientId: 'client-id',
      first: 250,
      after: 'cursor',
      status,
    })
  })

  test('throws an exact AbortError when the app connection is null', async () => {
    const getPage = vi.fn().mockResolvedValue(null)
    const promise = collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', getPage}))

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('App not found')
  })

  test.each([null, '', '   \t'])('rejects a next page with an invalid cursor: %j', async (endCursor) => {
    const getPage = vi.fn().mockResolvedValue(page([], {hasNextPage: true, endCursor}))
    const promise = collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', getPage}))

    await expect(promise).rejects.toBeInstanceOf(MigrationListProtocolError)
    expect(getPage).toHaveBeenCalledOnce()
  })

  test('rejects a repeated cursor instead of requesting the same page again', async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([], {hasNextPage: true, endCursor: 'cursor'}))
      .mockResolvedValueOnce(page([], {hasNextPage: true, endCursor: 'cursor'}))
    const promise = collectPages(iterateMigratableSubscriptionPages({clientId: 'client-id', getPage}))

    await expect(promise).rejects.toBeInstanceOf(MigrationListProtocolError)
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  test('yields earlier pages and then propagates a later-page API failure', async () => {
    const apiError = new Error('Partners API unavailable')
    const firstSubscription = subscription('shop-one')
    const getPage = vi
      .fn()
      .mockResolvedValueOnce(page([firstSubscription], {hasNextPage: true, endCursor: 'next'}))
      .mockRejectedValueOnce(apiError)

    const pages = iterateMigratableSubscriptionPages({clientId: 'client-id', getPage})

    await expect(pages.next()).resolves.toEqual({done: false, value: [firstSubscription]})
    await expect(pages.next()).rejects.toBe(apiError)
    expect(getPage).toHaveBeenCalledTimes(2)
  })
})
