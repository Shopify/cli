import {getMigratableSubscriptionPage} from './partners-api.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {MigratableSubscription, MigratableSubscriptionStatus} from '../../models/subscription-migrations.js'

const PAGE_SIZE = 250

export class MigrationListProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationListProtocolError'
  }
}

interface ListMigratableSubscriptionsOptions {
  clientId: string
  status?: MigratableSubscriptionStatus
  getPage?: typeof getMigratableSubscriptionPage
}

export async function listMigratableSubscriptions({
  clientId,
  status,
  getPage = getMigratableSubscriptionPage,
}: ListMigratableSubscriptionsOptions): Promise<MigratableSubscription[]> {
  const subscriptions: MigratableSubscription[] = []
  const seenCursors = new Set<string>()
  let after: string | undefined

  while (true) {
    // Pages must be requested sequentially because each request depends on the previous opaque cursor.
    // eslint-disable-next-line no-await-in-loop
    const page = await getPage({clientId, first: PAGE_SIZE, after, status})
    if (page === null) throw new AbortError('App not found')

    subscriptions.push(...page.subscriptions)
    if (!page.pageInfo.hasNextPage) return subscriptions

    const {endCursor} = page.pageInfo
    if (endCursor === null || endCursor.trim() === '') {
      throw new MigrationListProtocolError('Migratable subscription page has no cursor for its next page')
    }
    if (seenCursors.has(endCursor)) {
      throw new MigrationListProtocolError(`Migratable subscription pagination repeated cursor: ${endCursor}`)
    }

    seenCursors.add(endCursor)
    after = endCursor
  }
}
