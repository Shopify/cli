import {pullEnv} from './pull.js'
import {selectApp} from '../select-app.js'
import {AppInterface} from '../../../models/app/app.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {resolvePath, joinPath} from '@shopify/cli-kit/node/path'
import {unstyled, stringifyMessage} from '@shopify/cli-kit/node/output'

vi.mock('../select-app.js', () => {
  return {
    selectApp: vi.fn(),
  }
})

describe('env pull', () => {
  let app: AppInterface

  beforeEach(async () => {
    app = mockApp()
    vi.mocked(selectApp).mockResolvedValue(testOrganizationApp())
  })

  it('creates a new environment file when there is no .env', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(file, 'writeFile')

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
      const filePath = resolvePath(tmpDir, '.env')
      file.writeFileSync(filePath, 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\nSCOPES=my-scope')
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
      const filePath = resolvePath(tmpDir, '.env')
      file.writeFileSync(filePath, 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope')
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

function testOrganizationApp() {
  return {
    id: '123',
    title: 'Test app',
    appType: 'custom',
    apiSecretKeys: [{secret: 'api-secret'}],
    organizationId: '1',
    apiKey: 'api-key',
    grantedScopes: [],
  }
}
