import {DevEnvironmentInput, ensureDevEnvironment} from './environment'
import {fetchAppFromApiKey, fetchOrgAndApps, fetchOrganizations} from './fetch'
import {selectOrCreateApp} from './select-app'
import {selectStore, validateAndConvertToTestStoreIfNeeded} from './select-store'
import {store as conf} from '@shopify/cli-kit'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {outputMocker} from '@shopify/cli-testing'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'
import {App, WebType} from '$cli/models/app/app'
import {selectOrganizationPrompt} from '$cli/prompts/dev'
import {updateAppConfigurationFile} from '$cli/utilities/app/update'

beforeEach(() => {
  vi.mock('./fetch')
  vi.mock('./select-app')
  vi.mock('./select-store')
  vi.mock('$cli/prompts/dev')
  vi.mock('$cli/models/app/app')
  vi.mock('$cli/utilities/app/update')
  vi.mock('./create-app')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: () => 'token',
      },
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
      store: {
        setAppInfo: vi.fn(),
        getAppInfo: vi.fn(),
        clearAppInfo: vi.fn(),
      },
    }
  })
})

const ORG1: Organization = {id: '1', businessName: 'org1'}
const ORG2: Organization = {id: '2', businessName: 'org2'}
const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: [{secret: 'secret1'}]}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: [{secret: 'secret2'}]}
const CACHED1: conf.CachedAppInfo = {appId: 'key1', orgId: '1', storeFqdn: 'domain1'}
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
const LOCAL_APP: App = {
  directory: '',
  dependencyManager: 'yarn',
  configurationPath: '/shopify.app.toml',
  configuration: {name: 'my-app', id: 'key1', scopes: 'read_products'},
  webs: [
    {
      directory: '',
      configuration: {
        type: WebType.Backend,
        commands: {dev: ''},
      },
    },
  ],
  extensions: {ui: [], theme: [], function: []},
}

const INPUT: DevEnvironmentInput = {
  appManifest: LOCAL_APP,
  reset: false,
}

const INPUT_WITH_DATA: DevEnvironmentInput = {
  appManifest: LOCAL_APP,
  reset: false,
  apiKey: 'key1',
  store: 'domain1',
}

const FETCH_RESPONSE = {
  organization: ORG1,
  apps: [APP1, APP2],
  stores: [STORE1, STORE2],
}

beforeEach(async () => {
  vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
  vi.mocked(selectOrCreateApp).mockResolvedValue(APP1)
  vi.mocked(selectStore).mockResolvedValue(STORE1.shopDomain)
  vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])
  vi.mocked(fetchOrgAndApps).mockResolvedValue(FETCH_RESPONSE)
})

describe('ensureDevEnvironment', () => {
  it('returns selected data and updates internal state, without cached state', async () => {
    // Given
    vi.mocked(conf.getAppInfo).mockReturnValue(undefined)

    // When
    const got = await ensureDevEnvironment(INPUT)

    // Then
    expect(got).toEqual({app: APP1, store: STORE1.shopDomain})
    expect(conf.setAppInfo).toHaveBeenNthCalledWith(1, APP1.apiKey, {orgId: ORG1.id})
    expect(conf.setAppInfo).toHaveBeenNthCalledWith(2, APP1.apiKey, {storeFqdn: STORE1.shopDomain})
    expect(updateAppConfigurationFile).toBeCalledWith(LOCAL_APP, {name: APP1.title, id: APP1.apiKey})
  })

  it('returns selected data and updates internal state, with cached state', async () => {
    // Given
    const outputMock = outputMocker.mockAndCapture()
    vi.mocked(conf.getAppInfo).mockReturnValue(CACHED1)

    // When
    const got = await ensureDevEnvironment(INPUT)

    // Then
    expect(got).toEqual({app: APP1, store: STORE1.shopDomain})
    expect(fetchOrganizations).not.toBeCalled()
    expect(selectOrganizationPrompt).not.toBeCalled()
    expect(conf.setAppInfo).toHaveBeenNthCalledWith(1, APP1.apiKey, {orgId: ORG1.id})
    expect(conf.setAppInfo).toHaveBeenNthCalledWith(2, APP1.apiKey, {storeFqdn: STORE1.shopDomain})
    expect(updateAppConfigurationFile).toBeCalledWith(LOCAL_APP, {name: APP1.title, id: APP1.apiKey})
    expect(outputMock.output()).toMatch(/Reusing the org, app, dev store settings from your last run:/)
  })

  it('returns selected data and updates internal state, with inputs from flags', async () => {
    // Given
    vi.mocked(conf.getAppInfo).mockReturnValue(undefined)
    vi.mocked(validateAndConvertToTestStoreIfNeeded).mockResolvedValueOnce(true)
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)

    // When
    const got = await ensureDevEnvironment(INPUT_WITH_DATA)

    // Then
    expect(got).toEqual({app: APP2, store: STORE1.shopDomain})
    expect(conf.setAppInfo).toHaveBeenNthCalledWith(1, APP2.apiKey, {storeFqdn: STORE1.shopDomain, orgId: ORG1.id})
    expect(updateAppConfigurationFile).toBeCalledWith(LOCAL_APP, {name: APP2.title, id: APP2.apiKey})
    expect(fetchOrganizations).toBeCalled()
    expect(selectOrganizationPrompt).toBeCalled()
    expect(selectOrCreateApp).not.toBeCalled()
    expect(selectStore).not.toBeCalled()
  })

  it('resets cached state if reset is true', async () => {
    // When
    await ensureDevEnvironment({...INPUT, reset: true})

    // Then
    expect(conf.clearAppInfo).toHaveBeenCalledWith(APP1.apiKey)
  })
})
