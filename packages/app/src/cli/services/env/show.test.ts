import {showEnv} from './show.js'
import {fetchOrgAndApps, fetchOrganizations} from '../dev/fetch.js'
import {selectApp} from '../app/select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {selectOrganizationPrompt} from '../../prompts/dev.js'
import {testApp} from '../../models/app/app.test-data.js'
import {path, session, output, store, file} from '@shopify/cli-kit'
import {describe, it, expect, vi, beforeEach} from 'vitest'

beforeEach(async () => {
  vi.mock('../dev/fetch.js')
  vi.mock('../app/select-app.js')
  vi.mock('../../prompts/dev.js')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: vi.fn(),
      },
      store: {
        cliKitStore: () => ({
          getAppInfo: (): store.CachedAppInfo | undefined => undefined,
        }),
      },
    }
  })
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.restoreAllMocks()
})

describe('env show', () => {
  it('outputs the new environment', async () => {
    // Given
    vi.spyOn(file, 'write')

    const app = mockApp()
    const token = 'token'
    const organization = {
      id: '123',
      appsNext: false,
      businessName: 'test',
      website: '',
      apps: {nodes: []},
    }
    const apiKey = 'api-key'
    const apiSecret = 'api-secret'
    const organizationApp = {
      id: '123',
      title: 'Test app',
      appType: 'custom',
      apiSecretKeys: [{secret: apiSecret}],
      organizationId: '1',
      apiKey,
    }
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
    vi.mocked(fetchOrgAndApps).mockResolvedValue({
      organization,
      stores: [],
      apps: [organizationApp],
    })
    vi.mocked(selectApp).mockResolvedValue(organizationApp)
    vi.mocked(session.ensureAuthenticatedPartners).mockResolvedValue(token)

    // When
    const result = await showEnv(app)

    // Then
    expect(file.write).not.toHaveBeenCalled()
    expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
    "
        SHOPIFY_API_KEY=api-key
        SHOPIFY_API_SECRET=api-secret
        SCOPES=my-scope
      "
    `)
  })
})

function mockApp(currentVersion = '2.2.2'): AppInterface {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion
  return testApp({
    name: 'myapp',
    directory: '/',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
    },
    nodeDependencies,
  })
}
