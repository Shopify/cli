import ConfigPull from './pull.js'
import pull from '../../../services/app/config/pull.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
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

  test('passes a subdirectory invocation and client ID override with the linked app', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const invocationDirectory = joinPath(tmp, 'extensions', 'example')
      await mkdir(invocationDirectory)
      const remoteApp = testOrganizationApp({apiKey: 'new-client-id'})
      const app = testAppLinked({
        directory: tmp,
        configPath: joinPath(tmp, 'shopify.app.toml'),
      })
      app.configuration = {...app.configuration, client_id: remoteApp.apiKey}
      vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
      vi.mocked(pull).mockResolvedValue({
        configPath: app.configPath,
        configuration: app.configuration,
        remoteApp,
      })

      await ConfigPull.run(['--path', invocationDirectory, '--client-id', remoteApp.apiKey], import.meta.url)

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: invocationDirectory,
        clientId: remoteApp.apiKey,
        forceRelink: false,
        userProvidedConfigName: undefined,
      })
      expect(pull).toHaveBeenCalledWith({app, directory: invocationDirectory, configName: undefined, remoteApp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Pulled latest configuration for "my app"',
        body: 'Updated shopify.app.toml with the remote data.',
      })
    })
  })
})
