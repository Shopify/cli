import {ensureDevEnvironment} from './environment'
import {api, queries} from '@shopify/cli-kit'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'
import {App} from '$cli/models/app/app'
import {selectAppPrompt, selectOrganizationPrompt, selectStorePrompt} from '$cli/prompts/dev'
import {updateAppConfigurationFile} from '$cli/utilities/app/update'

vi.mock('$cli/prompts/dev')
vi.mock('$cli/models/app/app')
vi.mock('$cli/utilities/app/update')
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
    },
  }
})

afterEach(() => {
  vi.mocked(api.partners.request).mockClear()
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
const LOCAL_APP: App = {
  directory: '',
  packageManager: 'yarn',
  configuration: {name: 'my-app'},
  scripts: [],
  home: {directory: ''},
  uiExtensions: [],
}

describe('ensureDevEnvironment', () => {
  it('selects an org, app and store if there is no previous state and saves it', async () => {
    // Given
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    vi.mocked(selectAppPrompt).mockResolvedValue(APP1)
    vi.mocked(selectStorePrompt).mockResolvedValue(STORE1)
    vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
    vi.mocked(api.partners.request).mockResolvedValueOnce({
      organizations: {nodes: [{apps: {nodes: [APP1, APP2]}, stores: {nodes: [STORE1, STORE2]}}]},
    })

    // When
    await ensureDevEnvironment(LOCAL_APP)

    // Then
    expect(updateAppConfigurationFile).toHaveBeenCalledWith(LOCAL_APP, {id: 'key1', name: 'app1'})
    expect(api.partners.request).toHaveBeenNthCalledWith(1, queries.AllOrganizationsQuery, 'token')
    expect(api.partners.request).toHaveBeenNthCalledWith(2, queries.FindOrganizationQuery, 'token', {id: ORG1.id})
    expect(selectOrganizationPrompt).toHaveBeenCalledWith([ORG1, ORG2])
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('throws if there are no organizations', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: []}})

    // When
    const got = ensureDevEnvironment(LOCAL_APP)

    expect(got).rejects.toThrow(`No Organization found`)
  })

  it('throws if there are no dev stores', async () => {
    // Given
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
    vi.mocked(selectAppPrompt).mockResolvedValue(APP1)
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(api.partners.request).mockResolvedValueOnce({organizations: {nodes: [ORG1, ORG2]}})
    vi.mocked(api.partners.request).mockResolvedValueOnce({
      organizations: {nodes: [{apps: {nodes: [APP1, APP2]}, stores: {nodes: []}}]},
    })

    // When
    const got = ensureDevEnvironment(LOCAL_APP)

    expect(got).rejects.toThrow(`There are no developement stores available`)
  })
})
