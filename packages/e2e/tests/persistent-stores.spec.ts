/* eslint-disable no-restricted-imports, no-console */
import {isProtectedStore, readPersistentStores} from '../setup/persistent-stores.js'
import {E2E_STORES} from '../setup/constants.js'
import {deleteDevStoreWithCli, isStoreAppsEmpty} from '../setup/store.js'
import {e2eRunSegment} from '../setup/env.js'
import {teardownAll} from '../setup/teardown.js'
import {devDashboardAppUrl} from '../setup/app.js'
import {cleanupTemporaryStore} from '../setup/temporary-store.js'
import {expect, test, type Page} from '@playwright/test'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {CLIProcess} from '../setup/cli.js'

const stores = Object.values(E2E_STORES)

test('reads protected store domains and supports the local override', () => {
  expect(readPersistentStores({E2E_STORE_FQDNS: ' ONE.myshopify.com,\ntwo.myshopify.com '})).toEqual([
    'one.myshopify.com',
    'two.myshopify.com',
  ])
  expect(readPersistentStores({E2E_STORE_FQDN: 'one.myshopify.com'})).toEqual(['one.myshopify.com'])
  expect(readPersistentStores({}, false)).toEqual([])
  expect(() => readPersistentStores({})).toThrow('existing development-store domains')
})

test('combines and deduplicates all configured stores for cleanup protection', () => {
  expect(
    readPersistentStores({
      E2E_STORE_FQDNS: 'e2e-w-pool.myshopify.com, E2E-W-SHARED.myshopify.com',
      E2E_STORE_FQDN: ' E2E-W-LOCAL.myshopify.com ',
    }),
  ).toEqual(['e2e-w-pool.myshopify.com', 'e2e-w-shared.myshopify.com', 'e2e-w-local.myshopify.com'])
  expect(
    readPersistentStores({
      E2E_STORE_FQDNS: 'e2e-w-shared.myshopify.com, E2E-W-SHARED.myshopify.com',
      E2E_STORE_FQDN: 'e2e-w-shared.myshopify.com',
    }),
  ).toEqual(['e2e-w-shared.myshopify.com'])
  expect(readPersistentStores({E2E_STORE_FQDNS: ' ', E2E_STORE_FQDN: 'e2e-w-local.myshopify.com'})).toEqual([
    'e2e-w-local.myshopify.com',
  ])
  expect(() =>
    readPersistentStores({E2E_STORE_FQDNS: 'e2e-w-pool.myshopify.com', E2E_STORE_FQDN: 'not-a-store'}),
  ).toThrow('Invalid E2E store domain')
})

for (const scenario of [
  {name: 'both variables contain different stores', list: 'e2e-w-pool.myshopify.com'},
  {name: 'both variables contain the same store', list: 'e2e-w-local.myshopify.com'},
  {name: 'the plural variable is empty', list: ''},
  {name: 'the plural variable is unset', list: undefined},
]) {
  test(`refuses deletion of the local override when ${scenario.name}`, async () => {
    const restoreEnv = setStoreEnvironment({
      E2E_STORE_FQDNS: scenario.list,
      E2E_STORE_FQDN: 'e2e-w-local.myshopify.com',
    })
    let invoked = false
    const cli = {
      async exec() {
        invoked = true
        return {exitCode: 0, stdout: '{"store":{"deletionRequested":true}}', stderr: ''}
      },
    }

    try {
      await expect(deleteDevStoreWithCli({cli, storeFqdn: 'e2e-w-local.myshopify.com', orgId: '123'})).rejects.toThrow(
        'Refusing to delete persistent E2E store',
      )
      expect(invoked).toBe(false)
    } finally {
      restoreEnv()
    }
  })
}

test('still allows deletion of an unprotected legacy store', async () => {
  const restoreEnv = setStoreEnvironment({
    E2E_STORE_FQDNS: 'e2e-w-pool.myshopify.com',
    E2E_STORE_FQDN: 'e2e-w-local.myshopify.com',
  })
  let invocations = 0
  const cli = {
    async exec() {
      invocations++
      return {exitCode: 0, stdout: '{"store":{"deletionRequested":true,"deletionConfirmed":true}}', stderr: ''}
    },
  }

  try {
    expect(await deleteDevStoreWithCli({cli, storeFqdn: 'e2e-w-legacy.myshopify.com', orgId: '123'})).toBe(true)
    expect(invocations).toBe(1)
  } finally {
    restoreEnv()
  }
})

test('deduplicates store protection lists and rejects invalid domains', () => {
  expect(readPersistentStores({E2E_STORE_FQDNS: 'one.myshopify.com,ONE.myshopify.com'})).toEqual(['one.myshopify.com'])
  expect(() => readPersistentStores({E2E_STORE_FQDNS: 'https://one.myshopify.com'})).toThrow('Invalid E2E store domain')
})

test('keeps app cleanup scoped to the run, attempt, and shard', () => {
  const env = {GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1'}
  expect(e2eRunSegment({...env, E2E_SHARD: '1/2'})).toBe('r3fa1s1')
  expect(e2eRunSegment({...env, E2E_SHARD: '2/2'})).toBe('r3fa1s2')
  expect(e2eRunSegment({...env, GITHUB_RUN_ATTEMPT: '2', E2E_SHARD: '1/2'})).toBe('r3fa2s1')
})

test('uses the numeric remote app ID for cleanup links', async () => {
  const commands: string[][] = []
  const cli = {
    async exec(args: string[]) {
      commands.push(args)
      return {exitCode: 0, stdout: '{"remoteApp":{"id":"gid://shopify/App/456"}}', stderr: ''}
    },
  }
  expect(await devDashboardAppUrl({cli, appDir: '/app', orgId: '123', configName: 'secondary'})).toBe(
    'https://dev.shopify.com/dashboard/123/apps/456',
  )
  expect(commands).toEqual([['app', 'info', '--json', '--path', '/app', '--config', 'secondary']])
})

test('protects named persistent stores and configured stores from cleanup', async () => {
  expect(stores.every((store) => isProtectedStore(store))).toBe(true)
  expect(isProtectedStore('other.myshopify.com', ['other.myshopify.com'])).toBe(true)
  expect(isProtectedStore('e2e-w0-old.myshopify.com', stores)).toBe(false)
  let invoked = false
  const cli = {
    async exec() {
      invoked = true
      return {exitCode: 0, stdout: '{}', stderr: ''}
    },
  }
  await expect(deleteDevStoreWithCli({cli, storeFqdn: stores[0]!, orgId: '123'})).rejects.toThrow(
    'Refusing to delete persistent E2E store',
  )
  expect(invoked).toBe(false)
})

for (const scenario of [
  'owned',
  'absent',
  'protected',
  'duplicate',
  'truncated',
  'wrong-org',
  'unconfirmed',
] as const) {
  test(`temporary store cleanup checks ownership and deletion (${scenario})`, async () => {
    const name = 'e2e-store-local-test'
    const ownedStore = {name, store: 'e2e-store-local-test.myshopify.com', type: 'dev'}
    const candidates = {
      owned: [ownedStore],
      absent: [{...ownedStore, name: 'another-run'}],
      protected: [{...ownedStore, store: stores[0]}],
      duplicate: [ownedStore, {...ownedStore, store: 'another.myshopify.com'}],
      truncated: [],
      'wrong-org': [ownedStore],
      unconfirmed: [ownedStore],
    }
    const deleted: string[] = []
    const cli = {
      async exec(args: string[]) {
        if (args[1] === 'list') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: JSON.stringify({
              organization: {id: scenario === 'wrong-org' ? '456' : '123'},
              stores: candidates[scenario],
              truncated: scenario === 'truncated',
            }),
          }
        }
        expect(args.slice(0, 2)).toEqual(['store', 'delete'])
        deleted.push(args[args.indexOf('--store') + 1]!)
        return {
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify({store: {deletionRequested: true, deletionConfirmed: scenario !== 'unconfirmed'}}),
        }
      },
    }
    const cleanup = cleanupTemporaryStore({cli, orgId: '123', name})
    if (scenario === 'owned' || scenario === 'absent') {
      await cleanup
    } else {
      const errors = {
        protected: 'Refusing to use',
        duplicate: 'Multiple stores',
        truncated: 'The store list is truncated',
        'wrong-org': 'Could not verify the store list',
        unconfirmed: 'was not confirmed',
      }
      await expect(cleanup).rejects.toThrow(errors[scenario])
    }
    expect(deleted).toEqual(scenario === 'owned' || scenario === 'unconfirmed' ? [ownedStore.store] : [])
  })
}

test('legacy store cleanup requires an explicit empty state', async () => {
  const page = (empty: boolean) =>
    ({
      locator(selector: string) {
        return {
          async waitFor() {
            if (selector !== 'text=Add apps to your store' || !empty) throw new Error('Element is not visible')
          },
        }
      },
    }) as unknown as Page
  expect(await isStoreAppsEmpty(page(true))).toBe(true)
  expect(await isStoreAppsEmpty(page(false))).toBe(false)
})

function setStoreEnvironment(overrides: NodeJS.ProcessEnv): () => void {
  const previousEnv = process.env
  process.env = {...previousEnv, ...overrides}
  return () => {
    process.env = previousEnv
  }
}

for (const failure of ['none', 'preview', 'uninstall', 'deletion', 'all', 'process-stop'] as const) {
  test(`attempts owned app cleanup without blocking the store (${failure})`, async () => {
    const appDir = await mkdtemp(join(tmpdir(), 'e2e-store-cleanup-'))
    const originalFetch = globalThis.fetch
    const originalWarn = console.warn
    const warnings: string[] = []
    console.warn = (message: string) => warnings.push(message)
    const events: string[] = []
    const fails = (phase: string) => failure === phase || failure === 'all'
    try {
      await writeFile(join(appDir, 'shopify.app.toml'), 'client_id = "test-client"\n')
      const cli: CLIProcess = {
        async stopAll() {
          events.push('stop')
          if (failure === 'process-stop') throw new Error('Process did not stop')
        },
        async exec(args) {
          if (args.slice(0, 3).join(' ') === 'app dev clean') {
            events.push('preview')
            expect(args).toContain(stores[0])
            return {exitCode: fails('preview') ? 1 : 0, stdout: '{"status":"success"}', stderr: ''}
          }
          if (args.slice(0, 3).join(' ') === 'app env show') {
            return {exitCode: 0, stdout: 'SHOPIFY_API_SECRET=test-secret', stderr: ''}
          }
          throw new Error(`Unexpected cleanup command: ${args.join(' ')}`)
        },
        async execCreateApp() {
          throw new Error('Cleanup must not create an app')
        },
        async spawn() {
          throw new Error('Cleanup must not start a process')
        },
      }
      globalThis.fetch = async (url, options) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal)
        if (String(url).endsWith('/admin/oauth/access_token')) return Response.json({access_token: 'test-token'})
        expect(String(url)).toBe(`https://${stores[0]}/admin/api/2026-04/graphql.json`)
        expect(JSON.parse(String(options?.body)).query).toContain('appUninstall')
        events.push('uninstall')
        return Response.json(fails('uninstall') ? {} : {data: {appUninstall: {userErrors: []}}})
      }
      const ctx = {
        cli,
        appDir,
        appName: 'E2E-test-app',
        orgId: '123',
        storeFqdn: stores[0]!,
        dashboard: {
          async deleteApp() {
            events.push('delete-app')
            if (fails('deletion')) throw new Error('App deletion was rejected')
          },
        },
      }
      if (failure === 'process-stop') {
        await expect(teardownAll(ctx)).rejects.toThrow('Process did not stop')
        expect(events).toEqual(['stop'])
        expect(warnings).toEqual([])
        return
      }

      await teardownAll(ctx)
      expect(events).toEqual(['stop', 'preview', 'uninstall', 'delete-app'])
      const expectedWarnings = {none: 0, preview: 1, uninstall: 1, deletion: 1, all: 3}
      expect(warnings).toHaveLength(expectedWarnings[failure])
      for (const warning of warnings) {
        expect(warning).toContain('E2E-test-app')
        expect(warning).toContain(stores[0])
        expect(warning).toContain('cleanup-apps.ts --pattern "E2E-test-app"')
        expect(warning).not.toContain('test-secret')
        expect(warning).not.toContain('test-token')
      }
      if (fails('preview')) expect(warnings.some((warning) => warning.includes('preview removal failed'))).toBe(true)
      if (fails('uninstall')) expect(warnings.some((warning) => warning.includes('app uninstall failed'))).toBe(true)
      if (fails('deletion')) expect(warnings.some((warning) => warning.includes('app deletion failed'))).toBe(true)

      events.length = 0
      await teardownAll({...ctx, appName: 'E2E-next-app'})
      expect(events).toEqual(['stop', 'preview', 'uninstall', 'delete-app'])
    } finally {
      // eslint-disable-next-line require-atomic-updates
      globalThis.fetch = originalFetch
      // eslint-disable-next-line require-atomic-updates
      console.warn = originalWarn
      await rm(appDir, {recursive: true, force: true})
    }
  })
}
