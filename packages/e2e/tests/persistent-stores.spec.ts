import {readPersistentStores, isProtectedStore} from '../setup/persistent-stores.js'
import {deleteDevStoreWithCli, isStoreAppsEmpty} from '../setup/store.js'
import {expect, test, type Page} from '@playwright/test'

const stores = Array.from({length: 6}, (_, index) => `no-delete-e2e-reusable-store-${index + 1}.myshopify.com`)

test('reads a pool and supports one local store', () => {
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

test('protects named persistent stores and configured stores from cleanup', async () => {
  expect(isProtectedStore(stores[0]!)).toBe(true)
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
