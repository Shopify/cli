import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch'
import {selectOrCreateApp} from './dev/select-app'
import env from './env'
import {selectOrganizationPrompt} from '../prompts/dev'
import {App} from '../models/app/app'
import {describe, expect, test, vi} from 'vitest'
import {session} from '@shopify/cli-kit'
import {outputMocker} from '@shopify/cli-testing'

vi.mock('./dev/fetch')
vi.mock('./dev/select-app')
vi.mock('../prompts/dev')
vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    session: {
      ensureAuthenticatedPartners: vi.fn(),
    },
  }
})
describe('env', () => {
  test('prompts the user to create or select and app and returns its information', async () => {
    // Given
    const outputMock = outputMocker.mockAndCapture()
    const token = 'token'
    const organization = {
      id: '123',
      appsNext: false,
      businessName: 'test',
    }
    const apiKey = 'api-key'
    const apiSecret = 'api-secret'
    const organizationApp = {
      id: '123',
      title: 'Test app',
      appType: 'custom',
      apiSecretKeys: [{secret: apiSecret}],
      apiKey,
    }
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
    vi.mocked(fetchOrgAndApps).mockResolvedValue({
      organization,
      stores: [],
      apps: [organizationApp],
    })
    vi.mocked(selectOrCreateApp).mockResolvedValue(organizationApp)
    vi.mocked(session.ensureAuthenticatedPartners).mockResolvedValue(token)
    const app: App = {
      name: 'myapp',
      idEnvironmentVariableName: 'SHOPIFY_APP_ID',
      directory: '/project',
      dependencyManager: 'yarn',
      configurationPath: '/project/shopify.app.toml',
      configuration: {
        scopes: 'scope1,scope2',
      },
      webs: [],
      nodeDependencies: {},
      environment: {
        dotenv: {},
        env: {},
      },
      extensions: {ui: [], function: [], theme: []},
    }

    // When
    await env({app})

    // Then
    expect(outputMock.output()).toMatchInlineSnapshot(`
      "Use these environment variables when setting up your deploy of Test app:

      - SHOPIFY_API_KEY: api-key
      - SHOPIFY_API_SECRET: api-secret
      - SCOPES: scope1,scope2
      "
    `)
  })
})
