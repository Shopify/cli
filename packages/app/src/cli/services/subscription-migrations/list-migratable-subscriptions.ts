import {getMigratableSubscriptionPage} from './partners-api.js'
import type {MigratableSubscription, MigratableSubscriptionStatus} from '../../models/subscription-migrations.js'

const PAGE_SIZE = 250

export class MigratableSubscriptionsNotFoundError extends Error {
  constructor() {
    super('Migratable subscriptions were not found')
    this.name = 'MigratableSubscriptionsNotFoundError'
  }
}

export class MigrationListProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationListProtocolError'
  }
}

interface IterateMigratableSubscriptionPagesOptions {
  clientId: string
  status?: MigratableSubscriptionStatus
  getPage?: typeof getMigratableSubscriptionPage
}

/**
 * Yields the subscriptions of each API page as soon as that page arrives, so callers can process
 * (for example, print) a page before the next one is requested instead of holding every result in memory.
 * The next page is only requested when the consumer asks for it.
 */
export async function* iterateMigratableSubscriptionPages({
  clientId,
  status,
  getPage = getMigratableSubscriptionPage,
}: IterateMigratableSubscriptionPagesOptions): AsyncGenerator<MigratableSubscription[], void, undefined> {
  const seenCursors = new Set<string>()
  let after: string | undefined

  while (true) {
    // Pages must be requested sequentially because each request depends on the previous opaque cursor.
    // eslint-disable-next-line no-await-in-loop
    const page = await getPage({clientId, first: PAGE_SIZE, after, status})
    if (page === null) throw new MigratableSubscriptionsNotFoundError()

    yield page.subscriptions
    if (!page.pageInfo.hasNextPage) return

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
