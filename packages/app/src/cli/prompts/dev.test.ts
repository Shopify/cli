import {
  appNamePrompt,
  createAsNewAppPrompt,
  reloadStoreListPrompt,
  selectAppPrompt,
  selectStorePrompt,
  updateURLsPrompt,
} from './dev.js'
import {Organization, OrganizationSource, OrganizationStore} from '../models/organization.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../models/app/app.test-data.js'
import {getTomls} from '../utilities/app/config/getTomls.js'
import {searchForAppsByNameFactory} from '../services/dev/prompt-helpers.js'
import {ApplicationURLs} from '../services/dev/urls.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {renderAutocompletePrompt, renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../utilities/app/config/getTomls')

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  source: OrganizationSource.BusinessPlatform,
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  source: OrganizationSource.BusinessPlatform,
}
const APP1 = testOrganizationApp({apiKey: 'key1'})
const APP2 = testOrganizationApp({
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
})
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}
const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}
const STORE3: OrganizationStore = {
  shopId: '3',
  link: 'link3',
  shopDomain: 'domain3',
  shopName: 'store3',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}

beforeEach(() => {
  vi.mocked(getTomls).mockResolvedValue({})
})

describe('selectApp', () => {
  test('returns app if user selects one', async () => {
    // Given
    const apps = [APP1, APP2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(APP2.apiKey)

    // When
    const got = await selectAppPrompt(searchForAppsByNameFactory(testDeveloperPlatformClient(), ORG1.id), apps, true)

    // Then
    expect(got).toEqual(APP2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which existing app is this for?',
      choices: [
        {label: 'app1', value: 'key1'},
        {label: 'app2', value: 'key2'},
      ],
      search: expect.any(Function),
      hasMorePages: true,
    })
  })

  test('includes toml names when present', async () => {
    vi.mocked(getTomls).mockResolvedValueOnce({
      [APP1.apiKey]: 'shopify.app.toml',
      [APP2.apiKey]: 'shopify.app.dev.toml',
    })

    const apps = [APP1, APP2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(APP2.apiKey)

    const got = await selectAppPrompt(searchForAppsByNameFactory(testDeveloperPlatformClient(), ORG1.id), apps, true, {
      directory: '/',
    })

    expect(got).toEqual(APP2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which existing app is this for?',
      choices: [
        {label: 'app1 (shopify.app.toml)', value: 'key1'},
        {label: 'app2 (shopify.app.dev.toml)', value: 'key2'},
      ],
      search: expect.any(Function),
      hasMorePages: true,
    })
  })
})

describe('selectStore', () => {
  const defaultShowDomainOnPrompt = false
  test('returns undefined if store list is empty', async () => {
    // Given
    const stores: OrganizationStore[] = []

    // When
    const got = await selectStorePrompt({stores, showDomainOnPrompt: defaultShowDomainOnPrompt})

    // Then
    expect(got).toEqual(undefined)
    expect(renderAutocompletePrompt).not.toBeCalled()
  })

  test('returns without asking if there is only 1 store', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1]
    const outputMock = mockAndCaptureOutput()

    // When
    const got = await selectStorePrompt({stores, showDomainOnPrompt: defaultShowDomainOnPrompt})

    // Then
    expect(got).toEqual(STORE1)
    expect(renderAutocompletePrompt).not.toBeCalled()
    expect(outputMock.output()).toMatch('Using your default dev store, store1, to preview your project')
  })

  test('prompts when only one store is loaded but more pages are available', async () => {
    const stores: OrganizationStore[] = [STORE1]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(STORE1.shopId)

    const got = await selectStorePrompt({
      stores,
      hasMorePages: true,
      showDomainOnPrompt: defaultShowDomainOnPrompt,
    })

    expect(got).toEqual(STORE1)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [{label: 'store1', value: '1'}],
      hasMorePages: true,
    })
  })

  test('creates directly when the list is empty and a zero-store creation handler is provided', async () => {
    const onCreateStoreWhenEmpty = vi.fn().mockResolvedValue(STORE1)

    const got = await selectStorePrompt({
      stores: [],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStoreWhenEmpty,
    })

    expect(got).toEqual(STORE1)
    expect(onCreateStoreWhenEmpty).toHaveBeenCalledOnce()
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('returns the only store without creating when a zero-store creation handler is provided', async () => {
    const onCreateStoreWhenEmpty = vi.fn().mockResolvedValue(STORE2)
    const outputMock = mockAndCaptureOutput()

    const got = await selectStorePrompt({
      stores: [STORE1],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStoreWhenEmpty,
    })

    expect(got).toEqual(STORE1)
    expect(onCreateStoreWhenEmpty).not.toHaveBeenCalled()
    expect(renderAutocompletePrompt).not.toBeCalled()
    expect(outputMock.output()).toMatch('Using your default dev store, store1, to preview your project')
  })

  test('offers a create choice instead of auto-selecting the only store when a picker creation handler is provided', async () => {
    const createdStore = {...STORE2, shopId: 'created'}
    const onCreateStore = vi.fn().mockResolvedValue(createdStore)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('__create_new_dev_store__')

    const got = await selectStorePrompt({
      stores: [STORE1],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStore,
    })

    expect(got).toEqual(createdStore)
    expect(onCreateStore).toHaveBeenCalledOnce()
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1', value: '1'},
        {label: 'Create a new dev store', value: '__create_new_dev_store__'},
      ],
      hasMorePages: false,
    })
  })

  test('returns the selected store when the create choice is offered with multiple stores', async () => {
    const onCreateStore = vi.fn().mockResolvedValue(STORE3)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('2')

    const got = await selectStorePrompt({
      stores: [STORE1, STORE2],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStore,
    })

    expect(got).toEqual(STORE2)
    expect(onCreateStore).not.toHaveBeenCalled()
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1', value: '1'},
        {label: 'store2', value: '2'},
        {label: 'Create a new dev store', value: '__create_new_dev_store__'},
      ],
      hasMorePages: false,
    })
  })

  test('keeps the create choice when the store list is searched', async () => {
    const onCreateStore = vi.fn().mockResolvedValue(STORE3)
    vi.mocked(renderAutocompletePrompt).mockImplementation(async ({search}) => {
      const searchResults = await search!('new')
      expect(searchResults.data).toContainEqual({label: 'Create a new dev store', value: '__create_new_dev_store__'})
      return '__create_new_dev_store__'
    })

    const got = await selectStorePrompt({
      stores: [STORE1],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStore,
      onSearchForStoresByName: (_term: string) => Promise.resolve({stores: [STORE3], hasMorePages: false}),
    })

    expect(got).toEqual(STORE3)
    expect(onCreateStore).toHaveBeenCalledOnce()
  })

  test('returns a searched store without creating when the create choice is offered', async () => {
    const onCreateStore = vi.fn().mockResolvedValue(STORE2)
    vi.mocked(renderAutocompletePrompt).mockImplementation(async ({search}) => {
      const searchResults = await search!('new')
      expect(searchResults.data).toContainEqual({label: 'store3', value: '3'})
      expect(searchResults.data).toContainEqual({label: 'Create a new dev store', value: '__create_new_dev_store__'})
      return '3'
    })

    const got = await selectStorePrompt({
      stores: [STORE1],
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onCreateStore,
      onSearchForStoresByName: (_term: string) => Promise.resolve({stores: [STORE3], hasMorePages: false}),
    })

    expect(got).toEqual(STORE3)
    expect(onCreateStore).not.toHaveBeenCalled()
  })

  test('returns store if user selects one', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('2')

    // When
    const got = await selectStorePrompt({stores, showDomainOnPrompt: defaultShowDomainOnPrompt})

    // Then
    expect(got).toEqual(STORE2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1', value: '1'},
        {label: 'store2', value: '2'},
      ],
      hasMorePages: false,
    })
    // We are not enabling backend search because we are not passing a search function
    const lastCall = vi.mocked(renderAutocompletePrompt).mock.calls[0]!
    expect(lastCall[0]).not.toHaveProperty('search')
  })

  test('renders stores list with domain if showDomainOnPrompt is true ', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('2')

    // When
    const got = await selectStorePrompt({stores, showDomainOnPrompt: true})

    // Then
    expect(got).toEqual(STORE2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1 (domain1)', value: '1'},
        {label: 'store2 (domain2)', value: '2'},
      ],
      hasMorePages: false,
    })
    // We are not enabling backend search because we are not passing a search function
    const lastCall = vi.mocked(renderAutocompletePrompt).mock.calls[0]!
    expect(lastCall[0]).not.toHaveProperty('search')
  })

  test('returns correct store if user selects one after searching', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(renderAutocompletePrompt).mockImplementation(async ({search}) => {
      const searchResults = await search!('')
      return searchResults.data[0]!.value
    })

    // When
    const got = await selectStorePrompt({
      stores,
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onSearchForStoresByName: (_term: string) => Promise.resolve({stores: [STORE3], hasMorePages: false}),
    })

    // Then
    expect(got).toEqual(STORE3)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1', value: '1'},
        {label: 'store2', value: '2'},
      ],
      hasMorePages: false,
      search: expect.any(Function),
    })
  })

  test('returns an initial store after a search when clearing input restores the initial choices', async () => {
    const stores: OrganizationStore[] = [STORE1, STORE2]
    const onSearchForStoresByName = vi.fn().mockResolvedValue({stores: [STORE3], hasMorePages: false})
    vi.mocked(renderAutocompletePrompt).mockImplementation(async ({search}) => {
      await search!('store3')
      return STORE1.shopId
    })

    const got = await selectStorePrompt({
      stores,
      showDomainOnPrompt: defaultShowDomainOnPrompt,
      onSearchForStoresByName,
    })

    expect(got).toEqual(STORE1)
    expect(onSearchForStoresByName).toHaveBeenCalledWith('store3')
    expect(onSearchForStoresByName).toHaveBeenCalledOnce()
  })
})

describe('appName', () => {
  test('asks the user to write a name and returns it', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('app-name')

    // When
    const got = await appNamePrompt('suggested-name')

    // Then
    expect(got).toEqual('app-name')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'App name',
      defaultValue: 'suggested-name',
      validate: expect.any(Function),
    })
  })
})

describe('reloadStoreList', () => {
  test('returns true if user selects reload', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const got = await reloadStoreListPrompt(ORG1)

    // Then
    expect(got).toEqual(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Finished creating a dev store?',
      confirmationMessage: 'Yes, org1 has a new dev store',
      cancellationMessage: 'No, cancel dev',
    })
  })
})

describe('createAsNewAppPrompt', () => {
  test('returns true if user selects to create a new app', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const got = await createAsNewAppPrompt()

    // Then
    expect(got).toEqual(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Create this project as a new app on Shopify?',
      confirmationMessage: 'Yes, create it as a new app',
      cancellationMessage: 'No, connect it to an existing app',
    })
  })
})

describe('updateURLsPrompt', () => {
  test('shows prompt without app proxy', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const currentAppUrl = 'http://current-url'
    const newUrls = {
      applicationUrl: 'http://new-url',
      redirectUrlWhitelist: ['http://new-redirect-url'],
    }

    // When
    const got = await updateURLsPrompt(currentAppUrl, newUrls)

    // Then
    expect(got).toEqual(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message:
        "Have Shopify override your app URLs when running `app dev` against your dev store? This won't affect your app on other stores",
      infoTable: {
        'Currently released app URL': ['http://current-url'],
        '=> Dev URL': ['http://new-url'],
        'Affected configurations': ['application_url', 'redirect_urls'],
      },
      confirmationMessage: 'Yes, automatically update',
      cancellationMessage: 'No, never',
    })
  })

  test('shows prompt with app proxy', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const currentAppUrl = 'http://current-url'
    const newUrls: ApplicationURLs = {
      applicationUrl: 'http://new-url',
      redirectUrlWhitelist: ['http://new-redirect-url'],
      appProxy: {
        proxyUrl: 'http://proxy-url',
        proxySubPath: '/subpath',
        proxySubPathPrefix: 'prefix',
      },
    }

    // When
    const got = await updateURLsPrompt(currentAppUrl, newUrls)

    // Then
    expect(got).toEqual(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message:
        "Have Shopify override your app URLs when running `app dev` against your dev store? This won't affect your app on other stores",
      infoTable: {
        'Currently released app URL': ['http://current-url'],
        '=> Dev URL': ['http://new-url'],
        'Affected configurations': ['application_url', 'redirect_urls', 'app_proxy'],
      },
      confirmationMessage: 'Yes, automatically update',
      cancellationMessage: 'No, never',
    })
  })
})
