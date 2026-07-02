import ConfigLink from './link.js'
import link from '../../../services/app/config/link.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app/config/link.js')
vi.mock('../../../services/app-context.js')

describe('app config link command', () => {
  test('accepts --client-id with --file-name to link a specific app to a specific config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked()
      vi.mocked(link).mockResolvedValue({
        remoteApp: testOrganizationApp(),
        configFileName: 'shopify.app.staging.toml',
        configuration: app.configuration,
      })
      vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)

      await ConfigLink.run(
        ['--path', tmp, '--client-id', 'api-key', '--file-name', 'staging', '--force'],
        import.meta.url,
      )

      expect(link).toHaveBeenCalledWith({
        directory: tmp,
        apiKey: 'api-key',
        configName: undefined,
        fileName: 'staging',
        force: true,
      })
      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: 'shopify.app.staging.toml',
      })
    })
  })

  test('requires --file-name when --force is passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(ConfigLink.run(['--path', tmp, '--force'], import.meta.url)).rejects.toThrow()

      expect(link).not.toHaveBeenCalled()
    })
  })
})
