import {info} from './info.js'
import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch.js'
import {selectApp} from './app/select-app.js'
import {AppInterface} from '../models/app/app.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {testApp, testUIExtension} from '../models/app/app.test-data.js'
import {AppErrors} from '../models/app/loader.js'
import {path, output, store} from '@shopify/cli-kit'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

beforeEach(async () => {
  vi.mock('./dev/fetch.js')
  vi.mock('./app/select-app.js')
  vi.mock('../prompts/dev.js')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: vi.fn(),
      },
      store: {
        getAppInfo: vi.fn(),
        setAppInfo: vi.fn(),
        clearAppInfo: vi.fn(),
      },
    }
  })
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('info', () => {
  it('returns update shopify cli reminder when last version is greater than current version', async () => {
    // Given
    const latestVersion = '2.2.3'
    const app = mockApp()
    vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)

    // When
    const result = output.stringifyMessage(await info(app, {format: 'text', webEnv: false}))
    // Then
    expect(output.unstyled(result)).toMatch(
      'Shopify CLI       2.2.2 💡 Version 2.2.3 available! Run yarn shopify upgrade',
    )
  })

  it('returns the current configs for dev when present', async () => {
    // Given
    const cachedAppInfo = {
      directory: '/path',
      title: 'My App',
      appId: '123',
      storeFqdn: 'my-app.example.com',
      updateURLs: true,
    }
    vi.mocked(store.getAppInfo).mockResolvedValue(cachedAppInfo)
    const app = mockApp()

    // When
    const result = output.stringifyMessage(await info(app, {format: 'text', webEnv: false}))

    // Then
    expect(output.unstyled(result)).toMatch(/App\s*My App/)
    expect(output.unstyled(result)).toMatch(/Dev store\s*my-app.example.com/)
    expect(output.unstyled(result)).toMatch(/API key\s*123/)
    expect(output.unstyled(result)).toMatch(/Update URLs\s*Always/)
  })

  it('returns empty configs for dev when not present', async () => {
    // Given
    const app = mockApp()

    // When
    const result = output.stringifyMessage(await info(app, {format: 'text', webEnv: false}))

    // Then
    expect(output.unstyled(result)).toMatch(/App\s*Not yet configured/)
    expect(output.unstyled(result)).toMatch(/Dev store\s*Not yet configured/)
    expect(output.unstyled(result)).toMatch(/API key\s*Not yet configured/)
    expect(output.unstyled(result)).toMatch(/Update URLs\s*Not yet configured/)
  })

  it('returns update shopify cli reminder when last version lower or equals to current version', async () => {
    // Given
    const app = mockApp()
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    // When
    const result = output.stringifyMessage(await info(app, {format: 'text', webEnv: false}))
    // Then
    expect(output.unstyled(result)).toMatch('Shopify CLI       2.2.2')
    expect(output.unstyled(result)).not.toMatch('CLI reminder')
  })

  it('returns the web environment as a text when webEnv is true', async () => {
    // Given
    const app = mockApp()
    const organization = {
      id: '123',
      appsNext: false,
      businessName: 'test',
      website: '',
      apps: {nodes: []},
    }
    const organizationApp = {
      id: '123',
      title: 'Test app',
      appType: 'custom',
      apiSecretKeys: [{secret: 'api-secret'}],
      organizationId: '1',
      apiKey: 'api-key',
      grantedScopes: [],
    }
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
    vi.mocked(fetchOrgAndApps).mockResolvedValue({
      organization,
      stores: [],
      apps: [organizationApp],
    })
    vi.mocked(selectApp).mockResolvedValue(organizationApp)
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

    // When
    const result = await info(app, {format: 'text', webEnv: true})

    // Then
    expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
    "
        SHOPIFY_API_KEY=api-key
        SHOPIFY_API_SECRET=api-secret
        SCOPES=my-scope
      "
    `)
  })

  it('returns the web environment as a json when webEnv is true', async () => {
    // Given
    const app = mockApp()
    const organization = {
      id: '123',
      appsNext: false,
      businessName: 'test',
      website: '',
      apps: {nodes: []},
    }
    const organizationApp = {
      id: '123',
      title: 'Test app',
      appType: 'custom',
      apiSecretKeys: [{secret: 'api-secret'}],
      organizationId: '1',
      apiKey: 'api-key',
      grantedScopes: [],
    }
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
    vi.mocked(fetchOrgAndApps).mockResolvedValue({
      organization,
      stores: [],
      apps: [organizationApp],
    })
    vi.mocked(selectApp).mockResolvedValue(organizationApp)
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

    // When
    const result = await info(app, {format: 'json', webEnv: true})

    // Then
    expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "{
        \\"SHOPIFY_API_KEY\\": \\"api-key\\",
        \\"SHOPIFY_API_SECRET\\": \\"api-secret\\",
        \\"SCOPES\\": \\"my-scope\\"
      }"
    `)
  })

  it('returns errors alongside extensions when extensions have errors', async () => {
    // Given
    const uiExtension1 = await testUIExtension({
      configuration: {
        name: 'Extension 1',
        type: 'ui_extension',
        metafields: [],
      },
      configurationPath: 'extension/path/1',
    })
    const uiExtension2 = await testUIExtension({
      configuration: {
        name: 'Extension 2',
        type: 'checkout_ui_extension',
        metafields: [],
      },
      configurationPath: 'extension/path/2',
    })

    const errors = new AppErrors()
    errors.addError(uiExtension1.configurationPath, 'Mock error with ui_extension')
    errors.addError(uiExtension2.configurationPath, 'Mock error with checkout_ui_extension')

    const app = mockApp(undefined, {
      errors,
      extensions: {
        ui: [uiExtension1, uiExtension2],
        theme: [],
        function: [],
      },
    })
    const organization = {
      id: '123',
      appsNext: false,
      businessName: 'test',
      website: '',
      apps: {nodes: []},
    }
    const organizationApp = {
      id: '123',
      title: 'Test app',
      appType: 'custom',
      apiSecretKeys: [{secret: 'api-secret'}],
      organizationId: '1',
      apiKey: 'api-key',
      grantedScopes: [],
    }
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
    vi.mocked(fetchOrgAndApps).mockResolvedValue({
      organization,
      stores: [],
      apps: [organizationApp],
    })
    vi.mocked(selectApp).mockResolvedValue(organizationApp)
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

    // When
    const result = await info(app, {format: 'text', webEnv: false})

    // Then
    expect(result).toContain('Extensions with errors')
    expect(result).toContain('📂 ui_extension    tmp/project/extensions/test-ui-extension')
    expect(result).toContain('! Mock error with ui_extension')
    expect(result).toContain('📂 ui_extension    tmp/project/extensions/test-ui-extension')
    expect(result).toContain('! Mock error with checkout_ui_extension')
  })
})

function mockApp(currentVersion = '2.2.2', app?: Partial<AppInterface>): AppInterface {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion

  return testApp({
    name: 'myapp',
    directory: '/',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
      extensionDirectories: ['extensions/*'],
    },
    nodeDependencies,
    ...(app ? app : {}),
  })
}
