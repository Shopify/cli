import FetchSchema from './schema.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {generateSchemaService} from '../../../services/generate-schema.js'
import {
  testAppWithConfig,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/generate-schema.js')

describe('app function schema command', () => {
  test.each([
    {
      name: 'explicit client ID and stdout',
      flags: ['--client-id', 'selected-client-id', '--stdout'],
      clientId: 'selected-client-id',
      userProvidedConfigName: undefined,
      forceRelink: false,
      stdout: true,
    },
    {
      name: 'config and file output',
      flags: ['--config', 'staging'],
      clientId: undefined,
      userProvidedConfigName: 'staging',
      forceRelink: false,
      stdout: false,
    },
    {
      name: 'reset and file output',
      flags: ['--reset'],
      clientId: undefined,
      userProvidedConfigName: undefined,
      forceRelink: true,
      stdout: false,
    },
  ])('uses the selected remote app ID with $name', async (scenario) => {
    await inTemporaryDirectory(async (directory) => {
      const extension = await testFunctionExtension({dir: directory})
      const app = testAppWithConfig({app: {allExtensions: [extension]}, config: {client_id: 'local-client-id'}})
      const remoteApp = testOrganizationApp({
        id: 'gid://shopify/App/987',
        apiKey: 'remote-client-id',
        organizationId: '417',
      })
      const organization = {...testOrganization(), id: '417'}
      const developerPlatformClient = testDeveloperPlatformClient()
      vi.mocked(linkedAppContext).mockResolvedValue({
        app,
        remoteApp,
        organization,
        developerPlatformClient,
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      })

      const result = await FetchSchema.run([...scenario.flags, '--path', directory], import.meta.url)

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory,
        clientId: scenario.clientId,
        forceRelink: scenario.forceRelink,
        userProvidedConfigName: scenario.userProvidedConfigName,
      })
      expect(generateSchemaService).toHaveBeenCalledWith({
        appId: remoteApp.id,
        extension,
        stdout: scenario.stdout,
        developerPlatformClient,
        orgId: organization.id,
      })
      expect(result).toEqual({app})
    })
  })
})
