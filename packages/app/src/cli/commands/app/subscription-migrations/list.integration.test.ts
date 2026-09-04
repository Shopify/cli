import List from './list.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {listMigratableSubscriptions} from '../../../services/subscription-migrations/list-migratable-subscriptions.js'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, readdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {MigratableSubscription} from '../../../models/subscription-migrations.js'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/subscription-migrations/list-migratable-subscriptions.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

const app = testAppLinked()
const remoteApp = testOrganizationApp({apiKey: 'remote-client-id'})
const subscriptions: MigratableSubscription[] = [
  {
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
  },
]

async function runListWithoutOclifErrorHandling(argv: string[]) {
  const config = await Config.load()
  return new List(argv, config).run()
}

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(listMigratableSubscriptions).mockResolvedValue(subscriptions)
})

describe('subscription migration list command output integration', () => {
  test('preserves a file created after the initial availability check', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'subscriptions.csv')
      const sentinel = 'created while subscriptions were loading'
      vi.mocked(listMigratableSubscriptions).mockImplementation(async () => {
        await writeFile(outputPath, sentinel)
        return subscriptions
      })

      const promise = runListWithoutOclifErrorHandling(['--output', outputPath])

      await expect(promise).rejects.toEqual(
        new AbortError(`Output file already exists: ${outputPath}. Use --force to overwrite it.`),
      )
      await expect(readFile(outputPath)).resolves.toBe(sentinel)
    })
  })

  test('writes the exact JSON schema to stdout once without creating a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await List.run(['--json', '--path', tmpDir])

      expect(outputResult).toHaveBeenCalledOnce()
      const output = vi.mocked(outputResult).mock.calls[0]![0]
      expect(JSON.parse(output as string)).toEqual({schemaVersion: 1, subscriptions})
      expect(output).toBe(JSON.stringify({schemaVersion: 1, subscriptions}, null, 2))
      await expect(readdir(tmpDir)).resolves.toEqual([])
      expect(listMigratableSubscriptions).toHaveBeenCalledOnce()
    })
  })
})
