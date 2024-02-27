import use, {UseOptions} from './use.js'
import {
  buildVersionedAppSchema,
  testApp,
  testAppWithConfig,
  testOrganizationApp,
} from '../../../models/app/app.test-data.js'
import {getAppConfigurationFileName, loadAppConfiguration} from '../../../models/app/loader.js'
import {clearCurrentConfigFile, setCachedAppInfo} from '../../local-storage.js'
import {selectConfigFile} from '../../../prompts/config.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {err, ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('../../../prompts/config.js')
vi.mock('../../local-storage.js')
vi.mock('../../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('../../context.js')

const REMOTE_APP = testOrganizationApp()

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(partnersRequest).mockResolvedValue({app: REMOTE_APP})
})

describe('use', () => {
  test('clears currentConfiguration when reset is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: UseOptions = {
        directory: tmp,
        configName: 'invalid',
        reset: true,
      }
      writeFileSync(joinPath(tmp, 'package.json'), '{}')

      // When
      await use(options)

      // Then
      expect(clearCurrentConfigFile).toHaveBeenCalledWith(tmp)
      expect(setCachedAppInfo).not.toHaveBeenCalled()
      expect(loadAppConfiguration).not.toHaveBeenCalled()

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Cleared current configuration.',
        body: [
          'In order to set a new current configuration, please run',
          {command: 'npm run shopify app config use CONFIG_NAME'},
          {char: '.'},
        ],
      })
    })
  })

  test('throws an error when config file does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: UseOptions = {
        directory: tmp,
        configName: 'not-there',
      }
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.not-there.toml')

      // When
      const result = use(options)

      // Then
      await expect(result).rejects.toThrow(/Could not find configuration file shopify\.app\.not-there\.toml/)
    })
  })

  test('throws an error when config file does not contain client_id', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      createConfigFile(tmp, 'shopify.app.no-id.toml')
      const options: UseOptions = {
        directory: tmp,
        configName: 'no-id',
      }
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.no-id.toml')

      const {schema: configSchema} = await buildVersionedAppSchema()
      const appWithoutClientID = testApp()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: appWithoutClientID.configuration,
        configSchema,
      })

      // When
      const result = use(options)

      // Then
      await expect(result).rejects.toThrow(/Configuration file shopify\.app\.no-id\.toml needs a client_id./)
    })
  })

  test("throws error when config file can't be parsed", async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      createConfigFile(tmp, 'shopify.app.invalid.toml')
      const options: UseOptions = {
        directory: tmp,
        configName: 'invalid',
      }
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.invalid.toml')

      const error = new Error(`Fix a schema error in ${tmp}/shopify.app.invalid.toml:
[
  {
    "code": "invalid_type",
    "expected": "array",
    "received": "string",
    "path": [
      "redirect_url_allowlist"
    ],
    "message": "Expected array, received string"
  }
]'`)
      vi.mocked(loadAppConfiguration).mockRejectedValue(error)

      // When
      const result = use(options)

      // Then
      await expect(result).rejects.toThrow(error)
    })
  })

  test('saves currentConfiguration config name to localstorage', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      createConfigFile(tmp, 'shopify.app.staging.toml')
      const options: UseOptions = {
        directory: tmp,
        configName: 'staging',
      }
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.staging.toml')

      const app = testAppWithConfig({
        config: {
          name: 'something',
          client_id: 'something',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://example.com',
        },
      })
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: app.configuration,
        configSchema,
      })

      // When
      await use(options)

      // Then
      expect(setCachedAppInfo).toHaveBeenCalledWith({
        directory: tmp,
        configFile: 'shopify.app.staging.toml',
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Using configuration file shopify.app.staging.toml',
      })
    })
  })

  test('prompts user to choose a config file when argument is omitted', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      createConfigFile(tmp, 'shopify.app.local.toml')
      const options: UseOptions = {
        directory: tmp,
      }
      vi.mocked(selectConfigFile).mockResolvedValue(ok('shopify.app.local.toml'))

      const app = testAppWithConfig({
        config: {
          name: 'something',
          application_url: 'https://example.com',
          client_id: 'something',
          webhooks: {api_version: '2023-04'},
        },
      })
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: app.configuration,
        configSchema,
      })

      // When
      await use(options)

      // Then
      expect(setCachedAppInfo).toHaveBeenCalledWith({
        directory: tmp,
        configFile: 'shopify.app.local.toml',
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Using configuration file shopify.app.local.toml',
      })
    })
  })

  test('throws error when argument is omitted and no config file exists in the directory', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: UseOptions = {
        directory: tmp,
      }
      vi.mocked(selectConfigFile).mockResolvedValue(err('Could not find any shopify.app.toml file in the directory.'))

      // When
      const result = use(options)

      // Then
      await expect(result).rejects.toThrow(/Could not find any shopify\.app\.toml file in the directory./)
    })
  })

  test('renders warning when warning message is specified', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const {configuration} = testApp({}, 'current')
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({directory, configuration, configSchema})
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.something.toml')
      createConfigFile(directory, 'shopify.app.something.toml')

      // When
      await use({directory, configName: 'something', warningContent: {headline: "we're doomed. DOOMED."}})

      // Then
      expect(renderWarning).toHaveBeenCalledWith({headline: "we're doomed. DOOMED."})
      expect(setCachedAppInfo).toHaveBeenCalledWith({directory, configFile: 'shopify.app.something.toml'})
    })
  })

  test('does not render success when shouldRenderSuccess is false', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const {configuration} = testApp({}, 'current')
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({directory, configuration, configSchema})
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.something.toml')
      createConfigFile(directory, 'shopify.app.something.toml')

      // When
      await use({directory, configName: 'something', shouldRenderSuccess: false})

      // Then
      expect(renderSuccess).not.toHaveBeenCalled()
      expect(setCachedAppInfo).toHaveBeenCalledWith({directory, configFile: 'shopify.app.something.toml'})
    })
  })

  test('logs metadata', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Given
      const {configuration} = testApp({}, 'current')
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({directory, configuration, configSchema})
      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.something.toml')
      createConfigFile(directory, 'shopify.app.something.toml')

      // When
      await use({directory, configName: 'something'})

      // Then
      expect(logMetadataForLoadedContext).toHaveBeenNthCalledWith(1, REMOTE_APP)
    })
  })
})

function createConfigFile(tmp: string, fileName: string) {
  const filePath = joinPath(tmp, fileName)
  writeFileSync(filePath, '')
}
