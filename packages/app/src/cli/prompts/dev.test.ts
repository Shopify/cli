import {
  appNamePrompt,
  createAsNewAppPrompt,
  reloadStoreListPrompt,
  selectAppPrompt,
  selectOrganizationPrompt,
  selectStorePrompt,
  updateURLsPrompt,
  tunnelConfigurationPrompt,
} from './dev.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {describe, expect, vi, test} from 'vitest'
import {
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  betas: {},
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  betas: {},
}
const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
}
const APP2: OrganizationApp = {
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
  organizationId: '1',
  grantedScopes: [],
}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
}
const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

describe('selectOrganization', () => {
  test('request org selection if passing more than 1 org', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('1')

    // When
    const got = await selectOrganizationPrompt([ORG1, ORG2])

    // Then
    expect(got).toEqual(ORG1)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which Partners organization is this work for?',
      choices: [
        {label: 'org1', value: '1'},
        {label: 'org2', value: '2'},
      ],
    })
  })

  test('returns directly if passing only 1 org', async () => {
    // Given
    const orgs = [ORG2]

    // When
    const got = await selectOrganizationPrompt(orgs)

    // Then
    expect(got).toEqual(ORG2)
    expect(renderAutocompletePrompt).not.toBeCalled()
  })
})

describe('selectApp', () => {
  test('returns app if user selects one', async () => {
    // Given
    const apps = {nodes: [APP1, APP2], pageInfo: {hasNextPage: true}}
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('key2')

    // When
    const got = await selectAppPrompt(apps, ORG1.id, 'token')

    // Then
    expect(got).toEqual(APP2.apiKey)
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
})

describe('selectStore', () => {
  test('returns undefined if store list is empty', async () => {
    // Given
    const stores: OrganizationStore[] = []

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(undefined)
    expect(renderAutocompletePrompt).not.toBeCalled()
  })

  test('returns without asking if there is only 1 store', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1]
    const outputMock = mockAndCaptureOutput()

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(STORE1)
    expect(renderAutocompletePrompt).not.toBeCalled()
    expect(outputMock.output()).toMatch('Using your default dev store (store1) to preview your project')
  })

  test('returns store if user selects one', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('2')

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(STORE2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which store would you like to use to view your project?',
      choices: [
        {label: 'store1', value: '1'},
        {label: 'store2', value: '2'},
      ],
    })
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
  test('asks about the URL update and shows 4 different options', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('always')

    // When
    const got = await updateURLsPrompt('http://current-url', [
      'http://current-redirect-url1',
      'http://current-redirect-url2',
    ])

    // Then
    expect(got).toEqual('always')
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: `Have Shopify automatically update your app's URL in order to create a preview experience?`,
      infoTable: {
        'Current app URL': ['http://current-url'],
        'Current redirect URLs': ['http://current-redirect-url1', 'http://current-redirect-url2'],
      },
      choices: [
        {label: 'Always by default', value: 'always'},
        {label: 'Yes, this time', value: 'yes'},
        {label: 'No, not now', value: 'no'},
        {label: `Never, don't ask again`, value: 'never'},
      ],
    })
  })
})

describe('tunnelConfigurationPrompt', () => {
  test('asks about the selected tunnel plugin configuration and shows 3 different options', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('always')

    // When
    const got = await tunnelConfigurationPrompt()

    // Then
    expect(got).toEqual('always')
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'How would you like your tunnel to work in the future?',
      choices: [
        {label: 'Always use it by default', value: 'always'},
        {label: 'Use it now and ask me next time', value: 'yes'},
        {label: 'Nevermind, cancel dev', value: 'cancel'},
      ],
    })
  })
})
