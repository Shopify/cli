import ConfigPull from './pull.js'
import pull from '../../../services/app/config/pull.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app/config/pull.js')
vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('app config pull command', () => {
  beforeEach(() => {
    vi.mocked(pull).mockReset()
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(renderSuccess).mockReset()
  })

  test('pulls the app returned by the linked app context', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked({
        directory: tmp,
        configPath: joinPath(tmp, 'shopify.app.staging.toml'),
      })
      const remoteApp = testOrganizationApp()
      vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
      vi.mocked(pull).mockResolvedValue({
        configPath: app.configPath,
        configuration: app.configuration,
        remoteApp,
      })

      await ConfigPull.run(['--path', tmp, '--config', 'staging'], import.meta.url)

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: 'staging',
      })
      expect(pull).toHaveBeenCalledWith({app, configName: 'staging', remoteApp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Pulled latest configuration for "my app"',
        body: 'Updated shopify.app.staging.toml with the remote data.',
      })
    })
  })
})
