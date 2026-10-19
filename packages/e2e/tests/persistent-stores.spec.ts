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
