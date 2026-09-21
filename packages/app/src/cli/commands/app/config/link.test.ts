import ConfigLink from './link.js'
import {linkAppConfiguration as link} from '../../../services/app/config/link.js'
import {appConfigLinkJsonOutputSchema} from '../../../services/app/config/link/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'
import * as context from '@shopify/cli-kit/node/context/local'
import {Config} from '@oclif/core'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app/config/link.js')
vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/system')

describe('app config link command', () => {
  beforeEach(() => {
    vi.mocked(link).mockReset()
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  })

  test.each([{outputFlags: []}, {outputFlags: ['--json']}])(
    'accepts explicit app and file selection with output flags %j',
    async ({outputFlags}) => {
      await inTemporaryDirectory(async (tmp) => {
        const app = testAppLinked()
        vi.mocked(link).mockResolvedValue({
          remoteApp: testOrganizationApp(),
          configFileName: 'shopify.app.staging.toml',
          configuration: app.configuration,
          packageManager: 'npm',
          result: appConfigLinkJsonOutputSchema.validate({
            configFile: '/app/shopify.app.toml',
            configuration: app.configuration,
            app: testOrganizationApp(),
          }),
        })
        vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)

        await ConfigLink.run(
          ['--path', tmp, '--client-id', 'api-key', '--file-name', 'staging', '--force', ...outputFlags],
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
    },
  )

  test('accepts --config without requiring --file-name when --force is not passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked()
      vi.mocked(link).mockResolvedValue({
        remoteApp: testOrganizationApp(),
        configFileName: 'shopify.app.secondary.toml',
        configuration: app.configuration,
        packageManager: 'npm',
        result: appConfigLinkJsonOutputSchema.validate({
          configFile: '/app/shopify.app.toml',
          configuration: app.configuration,
          app: testOrganizationApp(),
        }),
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

test('does not write a JSON result if final app loading fails after linking', async () => {
  const app = testAppLinked()
  vi.mocked(link).mockResolvedValue({
    remoteApp: testOrganizationApp(),
    configuration: app.configuration,
    configFileName: 'shopify.app.toml',
    packageManager: 'npm',
    result: appConfigLinkJsonOutputSchema.validate({
      configFile: app.configPath,
      configuration: app.configuration,
      app: testOrganizationApp(),
    }),
  })
  vi.mocked(linkedAppContext).mockRejectedValue(new Error('App loading failed'))
  const command = new ConfigLink(['--json', '--client-id', 'key'], await Config.load())
  vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
  const streams = mockAndCaptureStandardStreams()
  try {
    await expect(command.run()).rejects.toThrow('App loading failed')
    expect(streams.stdout()).toBe('')
  } finally {
    streams.restore()
  }
})
