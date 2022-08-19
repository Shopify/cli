import {fetchOrgAndApps, fetchOrganizations} from './dev/fetch.js'
import {selectApp} from './app/select-app.js'
import {webEnv} from './web-env.js'
import {AppInterface} from '../models/app/app.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {testApp} from '../models/app/app.test-data.js'
import {path, session, output, store, file} from '@shopify/cli-kit'
import {describe, it, expect, vi, beforeEach} from 'vitest'

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
        cliKitStore: () => ({
          getAppInfo: (): store.CachedAppInfo | undefined => undefined,
        }),
      },
    }
  })
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.restoreAllMocks()
})

describe('web-env', () => {
  it('only outputs the new environment when update is false', async () => {
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
    const result = await webEnv(app, {update: false, envFile: '.env'})

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

  it('creates a new environment file when update is true and there is no .env', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
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
      const organizationApp = {
        id: '123',
        title: 'Test app',
        appType: 'custom',
        apiSecretKeys: [{secret: 'api-secret'}],
        organizationId: '1',
        apiKey: 'api-key',
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
      const filePath = path.resolve(tmpDir, '.env')
      const result = await webEnv(app, {update: true, envFile: filePath})

      // Then
      expect(file.write).toHaveBeenCalledWith(
        filePath,
        'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope',
      )
      expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "Created ${filePath}:

        SHOPIFY_API_KEY=api-key
      SHOPIFY_API_SECRET=api-secret
      SCOPES=my-scope
          "
      `)
    })
  })

  it('updates an existing environment file and shows the diff when update is true', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const app = mockApp()
      const token = 'token'
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

      const filePath = path.resolve(tmpDir, '.env')

      await file.write(filePath, 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\nSCOPES=my-scope')

      vi.spyOn(file, 'write')

      // When
      const result = await webEnv(app, {update: true, envFile: filePath})

      // Then
      expect(file.write).toHaveBeenCalledWith(
        filePath,
        'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope',
      )
      expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "Updated ${filePath} to be:

        SHOPIFY_API_KEY=api-key
      SHOPIFY_API_SECRET=api-secret
      SCOPES=my-scope

        Here's what changed:

        - SHOPIFY_API_KEY=ABC
      - SHOPIFY_API_SECRET=XYZ
      + SHOPIFY_API_KEY=api-key
      + SHOPIFY_API_SECRET=api-secret
      SCOPES=my-scope
        "
      `)
    })
  })

  it('shows no changes if there is an already up to date env file when update is true', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const app = mockApp()
      const token = 'token'
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

      const filePath = path.resolve(tmpDir, '.env')

      await file.write(filePath, 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope')

      vi.spyOn(file, 'write')
      // When
      const result = await webEnv(app, {update: true, envFile: filePath})

      // Then
      expect(file.write).not.toHaveBeenCalled()
      expect(output.unstyled(output.stringifyMessage(result))).toMatchInlineSnapshot(`
      "No changes to ${filePath}"
      `)
    })
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
