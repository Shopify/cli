import {DevEnvironmentInput, ensureDevEnvironment} from './environment'
import {createApp} from './create-app'
import {api, store as conf} from '@shopify/cli-kit'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {outputMocker} from '@shopify/cli-testing'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'
import {App} from '$cli/models/app/app'
import {reloadStoreListPrompt, selectAppPrompt, selectOrganizationPrompt, selectStorePrompt} from '$cli/prompts/dev'
import {updateAppConfigurationFile} from '$cli/utilities/app/update'

outputMocker.mockAndCapture()
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
    },
  }
})

afterEach(() => {
  vi.mocked(api.partners.request).mockClear()
  vi.mocked(selectStorePrompt).mockClear()
  vi.mocked(selectAppPrompt).mockClear()
  vi.mocked(selectOrganizationPrompt).mockClear()
  vi.mocked(selectStorePrompt).mockClear()
  vi.mocked(conf.getAppInfo).mockClear()
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
  packageManager: 'yarn',
  configuration: {name: 'my-app', id: 'key1'},
  scripts: [],
  home: {directory: '', configuration: {commands: {dev: ''}}},
  extensions: [],
}

const INPUT: DevEnvironmentInput = {
  appManifest: LOCAL_APP,
  reset: false,
}

const FETCH_ORG_RESPONSE_VALUE = {
  organizations: {
    nodes: [
      {
        id: ORG1.id,
        businessName: ORG1.businessName,
        apps: {nodes: [APP1, APP2]},
        stores: {nodes: [STORE1, STORE2]},
      },
    ],
  },
}

describe('ensureDevEnvironment', () => {
  it('selects an org, app and store if there is no previous state and saves it', async () => {
    // Given
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    vi.mocked(selectAppPrompt).mockResolvedValue(APP1)
    vi.mocked(selectStorePrompt).mockResolvedValue(STORE1)
    vi.mocked(api.partners.request)
      .mockResolvedValue({})
      .mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
      .mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await ensureDevEnvironment(INPUT)

    // Then
    expect(got).toEqual({org: ORG1, app: APP1, store: STORE1})
    expect(updateAppConfigurationFile).toHaveBeenCalledWith(LOCAL_APP, {id: 'key1', name: 'app1'})
    expect(api.partners.request).toHaveBeenNthCalledWith(1, api.graphql.AllOrganizationsQuery, 'token')
    expect(api.partners.request).toHaveBeenNthCalledWith(2, api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith([ORG1, ORG2])
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('shows prompts if cached info exists but is invalid', async () => {
    // Given
    vi.mocked(conf.getAppInfo).mockReturnValue({appId: 'key4'})
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    vi.mocked(selectAppPrompt).mockResolvedValue(APP1)
    vi.mocked(selectStorePrompt).mockResolvedValue(STORE1)
    vi.mocked(api.partners.request)
      .mockResolvedValue({})
      .mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
      .mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await ensureDevEnvironment(INPUT)

    // Then
    expect(got).toEqual({org: ORG1, app: APP1, store: STORE1})
    expect(updateAppConfigurationFile).toHaveBeenCalledWith(LOCAL_APP, {id: 'key1', name: 'app1'})
    expect(api.partners.request).toHaveBeenNthCalledWith(1, api.graphql.AllOrganizationsQuery, 'token')
    expect(api.partners.request).toHaveBeenNthCalledWith(2, api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith([ORG1, ORG2])
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('returns cached info if exists and is valid', async () => {
    // Given
    vi.mocked(conf.getAppInfo).mockReturnValue(CACHED1)
    vi.mocked(api.partners.request).mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)

    // When
    const got = await ensureDevEnvironment(INPUT)

    // Then
    expect(got).toEqual({org: ORG1, app: APP1, store: STORE1})
    expect(updateAppConfigurationFile).toHaveBeenCalledWith(LOCAL_APP, {id: 'key1', name: 'app1'})
    expect(api.partners.request).toHaveBeenNthCalledWith(1, api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
    expect(selectOrganizationPrompt).not.toHaveBeenCalled()
    expect(selectAppPrompt).not.toHaveBeenCalled()
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('throws if there are no organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: []}})

    // When
    const got = ensureDevEnvironment(INPUT)

    expect(got).rejects.toThrow(`No Organization found`)
  })

  it('throws if there are no dev stores and user selects to cancel', async () => {
    // Given
    // const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    //   throw new Error('process.exit')
    // })
    // vi.mocked(conf.getAppInfo).mockReturnValue(undefined)
    // vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    // vi.mocked(selectAppPrompt).mockResolvedValue(APP1)
    // vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)
    // vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    // vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
    // vi.mocked(api.partners.request).mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)
    // // vi.mocked(api.partners.request)
    // //   .mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)
    // //   .mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
    // //   .mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)
    // // When
    // // const got = ensureDevEnvironment(LOCAL_APP)
    // // console.log(got)
    // // Then
    // // const got2 = await got
    // // expect.assertions(1)
    // expect(ensureDevEnvironment(LOCAL_APP)).rejects.toThrowError('') // expect(got).rejects.toThrowError('process.exit')
    // expect(api.partners.request).toHaveBeenCalledTimes(2)
    // expect(mockExit).toHaveBeenCalled()
    // mockExit.mockRestore()
  })

  it('prompts to create a new app if app selection returns undefined', async () => {
    // Given
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    vi.mocked(selectAppPrompt).mockResolvedValue(undefined)
    vi.mocked(createApp).mockResolvedValue(APP2)
    vi.mocked(selectStorePrompt).mockReturnValueOnce(Promise.resolve(STORE1))
    vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
    vi.mocked(api.partners.request).mockResolvedValueOnce(FETCH_ORG_RESPONSE_VALUE)

    // When
    await ensureDevEnvironment(INPUT)

    // Then
    expect(updateAppConfigurationFile).toHaveBeenCalledWith(LOCAL_APP, {id: 'key2', name: 'app2'})
    expect(createApp).toBeCalledWith(ORG1.id, LOCAL_APP)
    expect(api.partners.request).toHaveBeenNthCalledWith(1, api.graphql.AllOrganizationsQuery, 'token')
    expect(api.partners.request).toHaveBeenNthCalledWith(2, api.graphql.FindOrganizationQuery, 'token', {id: ORG1.id})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith([ORG1, ORG2])
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })
})
