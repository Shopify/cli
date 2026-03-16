import {storeContext} from './store-context.js'
import {fetchStore} from './dev/fetch.js'
import {convertToTransferDisabledStoreIfNeeded, selectStore} from './dev/select-store.js'
import {LoadedAppContextOutput} from './app-context.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {appHiddenConfigPath, AppLinkedInterface} from '../models/app/app.js'
import {vi, describe, test, expect} from 'vitest'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('./dev/fetch')
vi.mock('./dev/select-store')

describe('storeContext', () => {
  const mockApp = testAppLinked({
    configuration: {
      client_id: 'client_id',
      name: 'app-config-name',
      build: {
        dev_store_url: 'cached-store.myshopify.com',
      },
    } as any,
    hiddenConfig: {
      dev_store_url: 'cached-store.myshopify.com',
    },
  })

  const mockOrganization = testOrganization()
  const mockDeveloperPlatformClient = testDeveloperPlatformClient()
  const mockStore = testOrganizationStore({shopId: 'store1', shopDomain: 'test-store.myshopify.com'})

  const appContextResult: LoadedAppContextOutput = {
    app: mockApp,
    organization: mockOrganization,
    developerPlatformClient: mockDeveloperPlatformClient,
    remoteApp: testOrganizationApp(),
    specifications: [],
  }

  test('uses explicitly provided storeFqdn', async () => {
    await inTemporaryDirectory(async (dir) => {
      vi.mocked(fetchStore).mockResolvedValue(mockStore)
      await prepareAppFolder(mockApp, dir)

      const result = await storeContext({
        appContextResult,
        storeFqdn: 'explicit-store.myshopify.com',
        forceReselectStore: false,
      })

      expect(fetchStore).toHaveBeenCalledWith(
        mockOrganization,
        'explicit-store.myshopify.com',
        mockDeveloperPlatformClient,
        ['APP_DEVELOPMENT'],
      )
      expect(convertToTransferDisabledStoreIfNeeded).toHaveBeenCalledWith(
        mockStore,
        mockOrganization.id,
        mockDeveloperPlatformClient,
        'never',
      )
      expect(result).toEqual(mockStore)
    })
  })

  test('uses cached dev_store_url when no explicit storeFqdn is provided', async () => {
    await inTemporaryDirectory(async (dir) => {
      vi.mocked(fetchStore).mockResolvedValue(mockStore)
      await prepareAppFolder(mockApp, dir)

      const result = await storeContext({
        appContextResult,
        forceReselectStore: false,
      })

      expect(fetchStore).toHaveBeenCalledWith(
        mockOrganization,
        'cached-store.myshopify.com',
        mockDeveloperPlatformClient,
        ['APP_DEVELOPMENT'],
      )
      expect(result).toEqual(mockStore)
    })
  })

  test('fetches and selects store when no storeFqdn or cached value is available', async () => {
    await inTemporaryDirectory(async (dir) => {
      const appWithoutCachedStore = testAppLinked()
      await prepareAppFolder(appWithoutCachedStore, dir)
      const allStores = [mockStore, {...mockStore, shopId: 'store2', shopDomain: 'another-store.myshopify.com'}]

      vi.mocked(mockDeveloperPlatformClient.devStoresForOrg).mockResolvedValue({stores: allStores, hasMorePages: false})
      vi.mocked(selectStore).mockResolvedValue(mockStore)

      const updatedAppContextResult = {...appContextResult, app: appWithoutCachedStore}
      const result = await storeContext({
        appContextResult: updatedAppContextResult,
        forceReselectStore: false,
      })

      expect(mockDeveloperPlatformClient.devStoresForOrg).toHaveBeenCalledWith(mockOrganization.id)
      expect(selectStore).toHaveBeenCalledWith(
        {stores: allStores, hasMorePages: false},
        mockOrganization,
        mockDeveloperPlatformClient,
      )
      expect(result).toEqual(mockStore)
    })
  })

  test('fetches and selects store when forceReselectStore is true', async () => {
    await inTemporaryDirectory(async (dir) => {
      const allStores = [mockStore, {...mockStore, shopId: 'store2', shopDomain: 'another-store.myshopify.com'}]
      await prepareAppFolder(mockApp, dir)
      vi.mocked(mockDeveloperPlatformClient.devStoresForOrg).mockResolvedValue({stores: allStores, hasMorePages: false})
      vi.mocked(selectStore).mockResolvedValue(mockStore)

      const result = await storeContext({
        appContextResult,
        forceReselectStore: true,
      })

      expect(mockDeveloperPlatformClient.devStoresForOrg).toHaveBeenCalledWith(mockOrganization.id)
      expect(selectStore).toHaveBeenCalledWith(
        {stores: allStores, hasMorePages: false},
        mockOrganization,
        mockDeveloperPlatformClient,
      )
      expect(result).toEqual(mockStore)
    })
  })

  test('throws an error when fetchStore fails', async () => {
    vi.mocked(fetchStore).mockRejectedValue(new Error('Store not found'))

    await expect(storeContext({appContextResult, forceReselectStore: false})).rejects.toThrow('Store not found')
  })

  test('throws an error when selectStore fails', async () => {
    const appWithoutCachedStore = testAppLinked()

    vi.mocked(mockDeveloperPlatformClient.devStoresForOrg).mockResolvedValue({stores: [], hasMorePages: false})
    vi.mocked(selectStore).mockRejectedValue(new Error('No stores available'))
    const updatedAppContextResult = {...appContextResult, app: appWithoutCachedStore}

    await expect(storeContext({appContextResult: updatedAppContextResult, forceReselectStore: false})).rejects.toThrow(
      'No stores available',
    )
  })

  test('calls logMetadata', async () => {
    await inTemporaryDirectory(async (dir) => {
      vi.mocked(fetchStore).mockResolvedValue(mockStore)
      await prepareAppFolder(mockApp, dir)

      // When
      await storeContext({appContextResult, forceReselectStore: false})

      // Then
      const meta = metadata.getAllPublicMetadata()
      expect(meta).toEqual(
        expect.objectContaining({
          store_fqdn_hash: hashString(mockStore.shopDomain),
        }),
      )

      const sensitiveMeta = metadata.getAllSensitiveMetadata()
      expect(sensitiveMeta).toEqual(
        expect.objectContaining({
          store_fqdn: mockStore.shopDomain,
        }),
      )
    })
  })

  test('adds hidden config to gitignore if needed', async () => {
    await inTemporaryDirectory(async (dir) => {
      await prepareAppFolder(mockApp, dir)
      vi.mocked(fetchStore).mockResolvedValue(mockStore)

      await storeContext({appContextResult, forceReselectStore: false})
    })
  })

  test('updates hidden config', async () => {
    await inTemporaryDirectory(async (dir) => {
      await prepareAppFolder(mockApp, dir)
      vi.mocked(fetchStore).mockResolvedValue(mockStore)

      await storeContext({appContextResult, forceReselectStore: false})

      const hiddenConfig = await readFile(appHiddenConfigPath(dir))
      expect(hiddenConfig).toEqual('{\n  "client_id": {\n    "dev_store_url": "test-store.myshopify.com"\n  }\n}')
    })
  })

  test('does not update hidden config when cached URL differs only by format', async () => {
    await inTemporaryDirectory(async (dir) => {
      // The TOML has an un-normalized URL (with https:// prefix)
      const appWithUnnormalizedUrl = testAppLinked({
        configuration: {
          client_id: 'client_id',
          name: 'app-config-name',
          build: {
            dev_store_url: 'https://test-store.myshopify.com',
          },
        } as any,
        hiddenConfig: {
          dev_store_url: 'test-store.myshopify.com',
        },
      })
      const updatedAppContextResult = {...appContextResult, app: appWithUnnormalizedUrl}
      const storeMatchingNormalized = testOrganizationStore({
        shopId: 'store1',
        shopDomain: 'test-store.myshopify.com',
      })

      await prepareAppFolder(appWithUnnormalizedUrl, dir)
      vi.mocked(fetchStore).mockResolvedValue(storeMatchingNormalized)

      await storeContext({appContextResult: updatedAppContextResult, forceReselectStore: false})

      // The hidden config should NOT be updated since the normalized URLs match
      // and the hidden config already has a value
      const hiddenConfig = await readFile(appHiddenConfigPath(dir))
      // The file was initialized empty, so if updateHiddenConfig was NOT called,
      // it should still be empty
      expect(hiddenConfig).toEqual('')
    })
  })

  test('does not update hidden config when cached URL is a short store name', async () => {
    await inTemporaryDirectory(async (dir) => {
      // The TOML has just the store name without .myshopify.com
      const appWithShortUrl = testAppLinked({
        configuration: {
          client_id: 'client_id',
          name: 'app-config-name',
          build: {
            dev_store_url: 'test-store',
          },
        } as any,
        hiddenConfig: {
          dev_store_url: 'test-store.myshopify.com',
        },
      })
      const updatedAppContextResult = {...appContextResult, app: appWithShortUrl}
      const storeMatchingNormalized = testOrganizationStore({
        shopId: 'store1',
        shopDomain: 'test-store.myshopify.com',
      })

      await prepareAppFolder(appWithShortUrl, dir)
      vi.mocked(fetchStore).mockResolvedValue(storeMatchingNormalized)

      await storeContext({appContextResult: updatedAppContextResult, forceReselectStore: false})

      // The hidden config should NOT be updated since normalized URLs match
      const hiddenConfig = await readFile(appHiddenConfigPath(dir))
      expect(hiddenConfig).toEqual('')
    })
  })

  test('updates hidden config when store actually changes', async () => {
    await inTemporaryDirectory(async (dir) => {
      await prepareAppFolder(mockApp, dir)
      const differentStore = testOrganizationStore({
        shopId: 'store2',
        shopDomain: 'different-store.myshopify.com',
      })
      vi.mocked(fetchStore).mockResolvedValue(differentStore)

      await storeContext({appContextResult, forceReselectStore: false})

      const hiddenConfig = await readFile(appHiddenConfigPath(dir))
      expect(hiddenConfig).toEqual(
        '{\n  "client_id": {\n    "dev_store_url": "different-store.myshopify.com"\n  }\n}',
      )
    })
  })

  test('ensures user access to store', async () => {
    await inTemporaryDirectory(async (dir) => {
      await prepareAppFolder(mockApp, dir)
      vi.mocked(fetchStore).mockResolvedValue(mockStore)

      await storeContext({appContextResult, forceReselectStore: false})

      expect(mockDeveloperPlatformClient.ensureUserAccessToStore).toHaveBeenCalledWith(mockOrganization.id, mockStore)
    })
  })
})

async function prepareAppFolder(app: AppLinkedInterface, directory: string) {
  app.directory = directory
  await mkdir(joinPath(directory, '.shopify'))
  await writeFile(joinPath(directory, '.shopify', 'project.json'), '')
  await writeFile(joinPath(directory, '.gitignore'), '')
}
