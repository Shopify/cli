import ConfigLink from './link.js'
import link from '../../../services/app/config/link.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app/config/link.js')
vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/system')

describe('app config link command', () => {
  beforeEach(() => {
    vi.mocked(link).mockReset()
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.stubEnv('SHOPIFY_FLAG_APP_CONFIG', undefined)
    vi.stubEnv('SHOPIFY_FLAG_CLIENT_ID', undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test.each([
    {name: 'both flags', args: ['--config', 'staging', '--client-id', 'api-key']},
    {name: 'the short config flag', args: ['-c', 'staging', '--client-id', 'api-key']},
    {name: 'an empty config value', args: ['--config', '', '--client-id', 'api-key']},
    {name: 'config from the environment', args: ['--client-id', 'api-key'], config: 'staging'},
    {name: 'client ID from the environment', args: ['--config', 'staging'], clientId: 'api-key'},
    {name: 'both environment variables', args: [], config: 'staging', clientId: 'api-key'},
  ])('recommends --file-name when using $name', async ({args, config, clientId}) => {
    vi.stubEnv('SHOPIFY_FLAG_APP_CONFIG', config)
    vi.stubEnv('SHOPIFY_FLAG_CLIENT_ID', clientId)

    await inTemporaryDirectory(async (tmp) => {
      const command = new ConfigLink(['--path', tmp, ...args], await Config.load(import.meta.url))
      await expect(command.run()).rejects.toMatchObject({
        message: "The --config and --client-id flags can't be used together.",
        tryMessage: 'Use --file-name instead of --config to choose the configuration file to create or overwrite.',
      })

      expect(link).not.toHaveBeenCalled()
      expect(linkedAppContext).not.toHaveBeenCalled()
    })
  })

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

  test('accepts --config without requiring --file-name when --force is not passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked()
      vi.mocked(link).mockResolvedValue({
        remoteApp: testOrganizationApp(),
        configFileName: 'shopify.app.secondary.toml',
        configuration: app.configuration,
      })
      vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)

      await ConfigLink.run(['--path', tmp, '--config', 'secondary'], import.meta.url)

      expect(link).toHaveBeenCalledWith({
        directory: tmp,
        apiKey: undefined,
        configName: 'secondary',
        fileName: undefined,
        force: false,
      })
      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: 'shopify.app.secondary.toml',
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
