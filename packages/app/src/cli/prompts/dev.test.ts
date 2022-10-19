import {
  appNamePrompt,
  createAsNewAppPrompt,
  appTypePrompt,
  reloadStoreListPrompt,
  selectAppPrompt,
  selectOrganizationPrompt,
  selectStorePrompt,
  updateURLsPrompt,
  tunnelConfigurationPrompt,
} from './dev.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {ui, outputMocker} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      ui: {
        prompt: vi.fn(),
      },
    }
  })
})

const ORG1: Organization = {id: '1', businessName: 'org1', appsNext: true}
const ORG2: Organization = {id: '2', businessName: 'org2', appsNext: false}
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
  it('request org selection if passing more than 1 org', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({id: '1'})

    // When
    const got = await selectOrganizationPrompt([ORG1, ORG2])

    // Then
    expect(got).toEqual(ORG1)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'autocomplete',
        name: 'id',
        message: 'Which Partners organization is this work for?',
        choices: [
          {name: 'org1', value: '1'},
          {name: 'org2', value: '2'},
        ],
      },
    ])
  })

  it('returns directly if passing only 1 org', async () => {
    // Given
    const orgs = [ORG2]

    // When
    const got = await selectOrganizationPrompt(orgs)

    // Then
    expect(got).toEqual(ORG2)
    expect(ui.prompt).not.toBeCalled()
  })
})

describe('selectApp', () => {
  it('returns app if user selects one', async () => {
    // Given
    const apps: OrganizationApp[] = [APP1, APP2]
    vi.mocked(ui.prompt).mockResolvedValue({apiKey: 'key2'})

    // When
    const got = await selectAppPrompt(apps, ORG1.id, 'token')

    // Then
    expect(got).toEqual(APP2)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'autocomplete',
        name: 'apiKey',
        message: 'Which existing app is this for?',
        choices: [
          {name: 'app1', value: 'key1'},
          {name: 'app2', value: 'key2'},
        ],
        validate: expect.any(Function),
      },
    ])
  })
})

describe('selectStore', () => {
  it('returns undefined if store list is empty', async () => {
    // Given
    const stores: OrganizationStore[] = []

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(undefined)
    expect(ui.prompt).not.toBeCalled()
  })

  it('returns without asking if there is only 1 store', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1]
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(STORE1)
    expect(ui.prompt).not.toBeCalled()
    expect(outputMock.output()).toMatch('Using your default dev store (store1) to preview your project')
  })

  it('returns store if user selects one', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(ui.prompt).mockResolvedValue({id: '2'})

    // When
    const got = await selectStorePrompt(stores)

    // Then
    expect(got).toEqual(STORE2)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'autocomplete',
        name: 'id',
        message: 'Which development store would you like to use to view your project?',
        choices: [
          {name: 'store1', value: '1'},
          {name: 'store2', value: '2'},
        ],
      },
    ])
  })
})

describe('appType', () => {
  it('asks the user to select a type and returns it', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'custom'})

    // When
    const got = await appTypePrompt()

    // Then
    expect(got).toEqual('custom')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'What type of app are you building?',
        choices: [
          {name: 'Public: An app built for a wide merchant audience.', value: 'public'},
          {name: 'Custom: An app custom built for a single client.', value: 'custom'},
        ],
      },
    ])
  })
})

describe('appName', () => {
  it('asks the user to write a name and returns it', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({name: 'app-name'})

    // When
    const got = await appNamePrompt('suggested-name')

    // Then
    expect(got).toEqual('app-name')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        message: 'App Name',
        default: 'suggested-name',
        validate: expect.any(Function),
      },
    ])
  })
})

describe('reloadStoreList', () => {
  it('returns true if user selects reload', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'reload'})

    // When
    const got = await reloadStoreListPrompt(ORG1)

    // Then
    expect(got).toEqual(true)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'Finished creating a dev store?',
        choices: [
          {name: 'Yes, org1 has a new dev store', value: 'reload'},
          {name: 'No, cancel dev', value: 'cancel'},
        ],
      },
    ])
  })
})

describe('createAsNewAppPrompt', () => {
  it('returns true if user selects to create a new app', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'yes'})

    // When
    const got = await createAsNewAppPrompt()

    // Then
    expect(got).toEqual(true)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'Create this project as a new app on Shopify?',
        choices: [
          {name: 'Yes, create it as a new app', value: 'yes'},
          {name: 'No, connect it to an existing app', value: 'cancel'},
        ],
      },
    ])
  })
})

describe('updateURLsPrompt', () => {
  it('asks about the URL update and shows 4 different options', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    const got = await updateURLsPrompt()

    // Then
    expect(got).toEqual('always')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: `Have Shopify automatically update your app's URL in order to create a preview experience?`,
        choices: [
          {name: 'Always by default', value: 'always'},
          {name: 'Yes, this time', value: 'yes'},
          {name: 'No, not now', value: 'no'},
          {name: `Never, don't ask again`, value: 'never'},
        ],
      },
    ])
  })
})

describe('tunnelConfigurationPrompt', () => {
  it('asks about the selected tunnel plugin configuration and shows 3 different options', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    const got = await tunnelConfigurationPrompt()

    // Then
    expect(got).toEqual('always')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'How would you like your tunnel to work in the future?',
        choices: [
          {name: 'Always use it by default', value: 'always'},
          {name: 'Use it now and ask me next time', value: 'yes'},
          {name: 'Nevermind, cancel dev', value: 'cancel'},
        ],
      },
    ])
  })
})
