import List from './list.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {listMigratableSubscriptions} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {outputMigrationList} from '../../../services/subscription-migrations/list-output.js'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
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

async function runListWithoutOclifErrorHandling(argv: string[]) {
  const config = await Config.load()
  return new List(argv, config).run()
}

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(listMigratableSubscriptions).mockResolvedValue(subscriptions)
  vi.mocked(outputMigrationList).mockResolvedValue()
})

describe('subscription migration list command', () => {
  test('rejects a missing output and JSON mode before resolving app context or fetching subscriptions', async () => {
    const promise = runListWithoutOclifErrorHandling([])

    await expect(promise).rejects.toEqual(
      new AbortError('Provide --output <path> or use --json to write subscriptions to stdout.'),
    )
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(listMigratableSubscriptions).not.toHaveBeenCalled()
    expect(outputMigrationList).not.toHaveBeenCalled()
  })

  test('rejects a real existing output without force before resolving app context or fetching subscriptions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      await writeFile(outputPath, 'original')

      const promise = runListWithoutOclifErrorHandling(['--output', outputPath])

      await expect(promise).rejects.toEqual(
        new AbortError(`Output file already exists: ${outputPath}. Use --force to overwrite it.`),
      )
      expect(linkedAppContext).not.toHaveBeenCalled()
      expect(listMigratableSubscriptions).not.toHaveBeenCalled()
      expect(outputMigrationList).not.toHaveBeenCalled()
    })
  })

  test('lists filtered subscriptions and delegates CSV file output', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')

      const result = await List.run([
        '--output',
        outputPath,
        '--status',
        'SCHEDULED',
        '--path',
        '/selected/app',
        '--config',
        'staging',
      ])

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: '/selected/app',
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: 'staging',
      })
      expect(listMigratableSubscriptions).toHaveBeenCalledWith({
        clientId: 'remote-client-id',
        status: 'SCHEDULED',
      })
      expect(outputMigrationList).toHaveBeenCalledWith({
        subscriptions,
        json: false,
        output: outputPath,
        force: false,
      })
      expect(result).toEqual({app})
    })
  })

  test('delegates JSON stdout mode without an output path', async () => {
    await List.run(['--json', '--client-id', 'selected-client-id', '--reset'])

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: expect.any(String),
      clientId: 'selected-client-id',
      forceRelink: true,
      userProvidedConfigName: undefined,
    })
    expect(listMigratableSubscriptions).toHaveBeenCalledWith({
      clientId: 'remote-client-id',
      status: undefined,
    })
    expect(outputMigrationList).toHaveBeenCalledWith({
      subscriptions,
      json: true,
      output: undefined,
      force: false,
    })
  })

  test('delegates forced JSON file output', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.json')

      await List.run(['--json', '--output', outputPath, '--force'])

      expect(outputMigrationList).toHaveBeenCalledWith({
        subscriptions,
        json: true,
        output: outputPath,
        force: true,
      })
    })
  })

  test('rejects an invalid status during parsing before resolving app context or fetching subscriptions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runListWithoutOclifErrorHandling(['--json', '--status', 'PENDING'])).rejects.toThrow()

    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(listMigratableSubscriptions).not.toHaveBeenCalled()
    expect(outputMigrationList).not.toHaveBeenCalled()
  })

  test('does not invoke the output writer or create the destination when listing fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      const apiError = new Error('Partners API unavailable')
      vi.mocked(listMigratableSubscriptions).mockRejectedValue(apiError)

      await expect(runListWithoutOclifErrorHandling(['--output', outputPath])).rejects.toBe(apiError)

      expect(outputMigrationList).not.toHaveBeenCalled()
      await expect(fileExists(outputPath)).resolves.toBe(false)
    })
  })
})
