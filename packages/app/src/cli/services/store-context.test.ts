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
import {vi, describe, test, expect} from 'vitest'
import {hashString} from '@shopify/cli-kit/node/crypto'

vi.mock('./dev/fetch')
vi.mock('./dev/select-store')

describe('storeContext', () => {
  const mockApp = testAppLinked({
    configuration: {
      build: {
        dev_store_url: 'cached-store.myshopify.com',
      },
    } as any,
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
    vi.mocked(fetchStore).mockResolvedValue(mockStore)

    const result = await storeContext({
      appContextResult,
      storeFqdn: 'explicit-store.myshopify.com',
      forceReselectStore: false,
    })

    expect(fetchStore).toHaveBeenCalledWith(
      mockOrganization,
      'explicit-store.myshopify.com',
      mockDeveloperPlatformClient,
    )
    expect(convertToTransferDisabledStoreIfNeeded).toHaveBeenCalledWith(
      mockStore,
      mockOrganization.id,
      mockDeveloperPlatformClient,
      'never',
    )
    expect(result).toEqual(mockStore)
  })

  test('uses cached dev_store_url when no explicit storeFqdn is provided', async () => {
    vi.mocked(fetchStore).mockResolvedValue(mockStore)

    const result = await storeContext({
      appContextResult,
      forceReselectStore: false,
    })

    expect(fetchStore).toHaveBeenCalledWith(mockOrganization, 'cached-store.myshopify.com', mockDeveloperPlatformClient)
    expect(result).toEqual(mockStore)
  })

  test('fetches and selects store when no storeFqdn or cached value is available', async () => {
    const appWithoutCachedStore = testAppLinked()
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

  test('fetches and selects store when forceReselectStore is true', async () => {
    const allStores = [mockStore, {...mockStore, shopId: 'store2', shopDomain: 'another-store.myshopify.com'}]

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
    // Given
    vi.mocked(fetchStore).mockResolvedValue(mockStore)

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
