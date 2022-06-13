import {info} from './info'
import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch'
import {selectOrCreateApp} from './dev/select-app'
import {App} from '../models/app/app'
import {selectOrganizationPrompt} from '../prompts/dev'
import {path, dependency, session, string, output} from '@shopify/cli-kit'
import {describe, it, expect, vi, beforeEach} from 'vitest'

vi.mock('./dev/fetch')
vi.mock('./dev/select-app')
vi.mock('../prompts/dev')

const currentVersion = '2.2.2'
beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      dependency: {
        checkForNewVersion: vi.fn(),
        getOutputUpdateCLIReminder: vi.fn(),
      },
      session: {
        ensureAuthenticatedPartners: vi.fn(),
      },
    }
  })
})

describe('info', () => {
  it('returns update shopify cli reminder when last version is greater than current version', async () => {
    // Given
    const latestVersion = '2.2.3'
    const app = mockApp()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(latestVersion)
    const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

    // When
    const result = info(app, {format: 'text', webEnv: false})
    // Then
    expect(result).resolves.toMatch('Shopify CLI       2.2.2 \u001b[1m\u001b[91m! CLI reminder\u001b[39m\u001b[22m')
  })

  it('returns update shopify cli reminder when last version lower or equals to current version', async () => {
    // Given
    const app = mockApp()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(undefined)
    const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

    // When
    const result = info(app, {format: 'text', webEnv: false})
    // Then
    expect(result).resolves.toMatch('Shopify CLI       2.2.2')
    expect(result).resolves.not.toMatch(' \u001b[1m\u001b[91m! CLI reminder\u001b[39m\u001b[22m')
  })

  it('returns the web environment as a text when webEnv is true', async () => {
    // Given
    const app = mockApp()
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

    // When
    const result = await info(app, {format: 'text', webEnv: true})

    // Then
    expect(string.stringStrippingAnsi(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "
      Use these environment variables to set up your deployment pipeline for this app:
        · SHOPIFY_API_KEY: api-key
        · SHOPIFY_API_SECRET: api-secret
        · SCOPES: my-scope
          "
    `)
  })

  it('returns the web environment as a json when webEnv is true', async () => {
    // Given
    const app = mockApp()
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

    // When
    const result = await info(app, {format: 'json', webEnv: true})

    // Then
    expect(string.stringStrippingAnsi(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "{
        \\"SHOPIFY_API_KEY\\": \\"api-key\\",
        \\"SHOPIFY_API_SECRET\\": \\"api-secret\\",
        \\"SCOPES\\": \\"my-scope\\"
      }"
    `)
  })
})

function mockApp(): App {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion
  return {
    name: 'myapp',
    idEnvironmentVariableName: 'SHOPIFY_APP_ID',
    directory: '/',
    dependencyManager: 'yarn',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
    },
    webs: [],
    nodeDependencies,
    environment: {
      dotenv: {},
      env: {},
    },
    extensions: {ui: [], function: [], theme: []},
  }
}
