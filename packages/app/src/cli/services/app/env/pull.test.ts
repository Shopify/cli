import {pullEnv} from './pull.js'
import {AppInterface, AppLinkedInterface} from '../../../models/app/app.js'
import {testApp, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {fetchAppFromConfigOrSelect} from '../fetch-app-from-config-or-select.js'
import {OrganizationApp} from '../../../models/organization.js'
import {describe, expect, vi, beforeEach, test} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {resolvePath, joinPath} from '@shopify/cli-kit/node/path'
import {unstyled, stringifyMessage} from '@shopify/cli-kit/node/output'

vi.mock('../fetch-app-from-config-or-select')

describe('env pull', () => {
  let app: AppLinkedInterface
  let remoteApp: OrganizationApp

  beforeEach(async () => {
    app = mockApp() as AppLinkedInterface
    remoteApp = testOrganizationApp()
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(testOrganizationApp())
  })

  test('creates a new environment file when there is no .env', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      vi.spyOn(file, 'writeFile')

      // When
      const filePath = resolvePath(tmpDir, '.env')
      const result = await pullEnv({app, remoteApp, envFile: filePath})

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

  test('updates an existing environment file and shows the diff', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const filePath = resolvePath(tmpDir, '.env')
      file.writeFileSync(filePath, 'SHOPIFY_API_KEY=ABC\nSHOPIFY_API_SECRET=XYZ\nSCOPES=my-scope')
      vi.spyOn(file, 'writeFile')

      // When
      const result = await pullEnv({app, remoteApp, envFile: filePath})

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

  test('shows no changes if there is an already up to date env file', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const filePath = resolvePath(tmpDir, '.env')
      file.writeFileSync(filePath, 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=my-scope')
      vi.spyOn(file, 'writeFile')

      // When
      const result = await pullEnv({app, remoteApp, envFile: filePath})

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
    configuration: {
      path: joinPath('/', 'shopify.app.toml'),
      scopes: 'my-scope',
      extension_directories: ['extensions/*'],
    },
    nodeDependencies,
  })
}
