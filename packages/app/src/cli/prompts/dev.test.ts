import {selectApp, selectOrganization, selectStore} from './dev'
import {describe, it, expect, vi, afterEach} from 'vitest'
import {ui} from '@shopify/cli-kit'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    ui: {
      prompt: vi.fn(),
    },
  }
})

afterEach(() => {
  vi.mocked(ui.prompt).mockClear()
})

const ORG1: Organization = {id: '1', businessName: 'org1'}
const ORG2: Organization = {id: '2', businessName: 'org2'}
const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: {secret: 'secret1'}}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: {secret: 'secret2'}}
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
    const got = await selectOrganization([ORG1, ORG2])

    // Then
    expect(got).toEqual(ORG1)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'id',
        message: 'Which org would you like to work in?',
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
    const got = await selectOrganization(orgs)

    // Then
    expect(got).toEqual(ORG2)
    expect(ui.prompt).not.toBeCalled()
  })
})

describe('selectApp', () => {
  it('returns undefined if app list is empty,', async () => {
    // Given
    const apps: OrganizationApp[] = []

    // When
    const got = await selectApp(apps)

    // Then
    expect(got).toEqual(undefined)
    expect(ui.prompt).not.toBeCalled()
  })

  it('returns undefined if user selects to create app', async () => {
    // Given
    const apps: OrganizationApp[] = [APP1, APP2]
    vi.mocked(ui.prompt).mockResolvedValue({apiKey: 'create'})

    // When
    const got = await selectApp(apps)

    // Then
    expect(got).toEqual(undefined)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'apiKey',
        message: 'Which existing app would you like to connect this work to?',
        choices: [
          {name: 'app1', value: 'key1'},
          {name: 'app2', value: 'key2'},
          {name: 'Create a new app', value: 'create'},
        ],
      },
    ])
  })

  it('returns app if user selects one', async () => {
    // Given
    const apps: OrganizationApp[] = [APP1, APP2]
    vi.mocked(ui.prompt).mockResolvedValue({apiKey: 'key2'})

    // When
    const got = await selectApp(apps)

    // Then
    expect(got).toEqual(APP2)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'apiKey',
        message: 'Which existing app would you like to connect this work to?',
        choices: [
          {name: 'app1', value: 'key1'},
          {name: 'app2', value: 'key2'},
          {name: 'Create a new app', value: 'create'},
        ],
      },
    ])
  })
})

describe('selectStore', () => {
  it('returns undefined if store list is empty,', async () => {
    // Given
    const stores: OrganizationStore[] = []

    // When
    const got = await selectStore(stores)

    // Then
    expect(got).toEqual(undefined)
    expect(ui.prompt).not.toBeCalled()
  })

  it('returns app if user selects one', async () => {
    // Given
    const stores: OrganizationStore[] = [STORE1, STORE2]
    vi.mocked(ui.prompt).mockResolvedValue({id: '2'})

    // When
    const got = await selectStore(stores)

    // Then
    expect(got).toEqual(STORE2)
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'id',
        message: 'Where would you like to view your project? Select a dev store',
        choices: [
          {name: 'store1', value: '1'},
          {name: 'store2', value: '2'},
        ],
      },
    ])
  })
})
