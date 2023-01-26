import {pullEnv} from './pull.js'
import {fetchOrgAndApps, fetchOrganizations} from '../../dev/fetch.js'
import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import {selectOrganizationPrompt} from '../../../prompts/dev.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import * as file from '@shopify/cli-kit/node/fs'
import {resolvePath, joinPath} from '@shopify/cli-kit/node/path'
import {unstyled, stringifyMessage} from '@shopify/cli-kit/node/output'

beforeEach(async () => {
  vi.mock('../../dev/fetch.js')
  vi.mock('../select-app.js')
  vi.mock('../../../prompts/dev.js')
  vi.mock('@shopify/cli-kit/node/session')
  vi.mock('@shopify/cli-kit/node/node-package-manager')
  vi.restoreAllMocks()
})

describe('env pull', () => {
  it('creates a new environment file when there is no .env', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(file, 'writeFile')

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
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue(token)

      // When
      const filePath = resolvePath(tmpDir, '.env')
      const result = await pullEnv(app, {envFile: filePath})

      // Then
      expect(file.writeFile).toHaveBeenCalledWith(
        filePath,
        'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope',
      )
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
      "Created ${filePath}:

      SHOPIFY_API_KEY=api-key
      SHOPIFY_API_SECRET=api-secret
      SCOPES=my-scope
      "
      `)
    })
  })

  it('updates an existing environment file and shows the diff', async () => {
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
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue(token)

      const filePath = resolvePath(tmpDir, '.env')

      await file.writeFile(filePath, 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\nSCOPES=my-scope')

      vi.spyOn(file, 'writeFile')

      // When
      const result = await pullEnv(app, {envFile: filePath})

      // Then
      expect(file.writeFile).toHaveBeenCalledWith(
        filePath,
        'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope',
      )
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
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

  it('shows no changes if there is an already up to date env file', async () => {
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
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue(token)

      const filePath = resolvePath(tmpDir, '.env')

      await file.writeFile(filePath, 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope')

      vi.spyOn(file, 'writeFile')
      // When
      const result = await pullEnv(app, {envFile: filePath})

      // Then
      expect(file.writeFile).not.toHaveBeenCalled()
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
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
    configurationPath: joinPath('/', 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
      extensionDirectories: ['extensions/*'],
    },
    nodeDependencies,
  })
}
