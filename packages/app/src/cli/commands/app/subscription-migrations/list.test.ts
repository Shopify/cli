import List from './list.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {iterateMigratableSubscriptionPages} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {outputMigrationList} from '../../../services/subscription-migrations/list-output.js'
import {Config} from '@oclif/core'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../../models/subscription-migrations.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/list-migratable-subscriptions.js')
vi.mock('../../../services/subscription-migrations/list-output.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/subscription-migrations/list-output.js')>()
  return {...actual, outputMigrationList: vi.fn()}
})

const app = testAppLinked()
const remoteApp = testOrganizationApp({apiKey: 'remote-client-id'})
const subscriptions: MigratableSubscription[] = [
  {
    shopId: 'gid://shopify/Shop/1',
    status: 'SCHEDULED',
    manualSubscriptionName: 'Legacy plan',
    manualSubscriptionPrice: {amount: '19.99', currencyCode: 'USD'},
    manualSubscriptionInterval: 'EVERY_30_DAYS',
    targetPlanHandle: 'standard',
    notification: {kind: 'NONE', optOutDeadline: null, sentAt: null},
    priceBehavior: 'HONOR_BILLING_PRICE',
    effectiveDate: '2026-05-01T00:00:00Z',
    lastFailureReason: null,
  },
]

async function* singlePage(): AsyncGenerator<MigratableSubscription[], void, undefined> {
  yield subscriptions
}

async function runListWithoutOclifErrorHandling(argv: string[]) {
  const config = await Config.load()
  return new List(argv, config).run()
}

let pages: AsyncGenerator<MigratableSubscription[], void, undefined>

beforeEach(() => {
  pages = singlePage()
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(iterateMigratableSubscriptionPages).mockReturnValue(pages)
  vi.mocked(outputMigrationList).mockResolvedValue(undefined)
})

describe('subscription migration list command', () => {
  test('streams the linked app subscription pages as CSV to stdout by default', async () => {
    const result = await List.run(['--path', '/selected/app', '--config', 'staging'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: '/selected/app',
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: 'staging',
    })
    expect(iterateMigratableSubscriptionPages).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      status: undefined,
    })
    expect(outputMigrationList).toHaveBeenCalledOnce()
    expect(outputMigrationList).toHaveBeenCalledWith({pages, json: false})
    expect(result).toEqual({app})
  })

  test('delegates the same page stream to JSON stdout output when requested', async () => {
    await List.run(['--json', '--client-id', 'selected-client-id', '--reset'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'selected-client-id',
      forceRelink: true,
      userProvidedConfigName: undefined,
    })
    expect(outputMigrationList).toHaveBeenCalledWith({pages, json: true})
  })

  test('forwards a status filter to the API', async () => {
    await List.run(['--status', 'SCHEDULED'])

    expect(iterateMigratableSubscriptionPages).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      status: 'SCHEDULED',
    })
    expect(outputMigrationList).toHaveBeenCalledWith({pages, json: false})
  })

  test('rejects an invalid status during parsing before resolving app context or fetching subscriptions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runListWithoutOclifErrorHandling(['--status', 'PENDING'])).rejects.toThrow()

    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(iterateMigratableSubscriptionPages).not.toHaveBeenCalled()
    expect(outputMigrationList).not.toHaveBeenCalled()
  })

  test('propagates an output failure without returning a result', async () => {
    const apiError = new Error('Partners API unavailable')
    vi.mocked(outputMigrationList).mockRejectedValue(apiError)

    await expect(runListWithoutOclifErrorHandling([])).rejects.toBe(apiError)
  })
})
