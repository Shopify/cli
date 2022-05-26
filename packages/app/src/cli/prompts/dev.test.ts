import {
  appNamePrompt,
  createAsNewAppPrompt,
  reloadStoreListPrompt,
  selectAppPrompt,
  selectOrganizationPrompt,
  selectStorePrompt,
} from './dev'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {ui} from '@shopify/cli-kit'
import {outputMocker} from '@shopify/cli-testing'

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

const ORG1: Organization = {id: '1', businessName: 'org1'}
const ORG2: Organization = {id: '2', businessName: 'org2'}
const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: [{secret: 'secret1'}]}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: [{secret: 'secret2'}]}
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
    const got = await selectAppPrompt(apps)

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
    const outputMock = outputMocker.mockAndCapture()

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
    const got = await reloadStoreListPrompt()

    // Then
    expect(got).toEqual(true)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'value',
        message: 'Have you created a new dev store?',
        choices: [
          {name: 'Yes, reload my stores', value: 'reload'},
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
