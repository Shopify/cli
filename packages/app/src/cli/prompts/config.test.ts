import {confirmPushChanges, selectConfigFile, selectConfigName, validate} from './config.js'
import {PushOptions} from '../services/app/config/push.js'
import {
  testOrganizationApp,
  testAppWithConfig,
  DEFAULT_CONFIG,
  buildVersionedAppSchema,
} from '../models/app/app.test-data.js'
import {App} from '../api/graphql/get_config.js'
import {mergeAppConfiguration} from '../services/app/config/link.js'
import {OrganizationApp} from '../models/organization.js'
import {CurrentAppConfiguration} from '../models/app/app.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {renderConfirmationPrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {err, ok} from '@shopify/cli-kit/node/result'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {Config} from '@oclif/core'

vi.mock('@shopify/cli-kit/node/ui')

describe('selectConfigName', () => {
  test('returns the chosen file name when the file does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('staging')

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderTextPrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toEqual('staging')
    })
  })

  test('returns the chosen file name when the file exists and the user decides to overwrite', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.staging.toml'), '')
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('staging')
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderTextPrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(result).toEqual('staging')
    })
  })

  test('asks for another name when the file exists and the users decides to change it', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.staging.toml'), '')
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('staging')
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('pro')

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderTextPrompt).toHaveBeenCalledTimes(2)
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(result).toEqual('pro')
    })
  })

  test('returns the slugified value', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('My app')

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(result).toEqual('my-app')
    })
  })

  test('shows the default name as the placeholder when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('staging')

      // When
      await selectConfigName(tmp, 'My app')

      // Then
      expect(renderTextPrompt).toHaveBeenCalledWith({
        defaultValue: 'My app',
        message: 'Configuration file name:',
        preview: expect.any(Function),
        validate: expect.any(Function),
      })
    })
  })
})

describe('selectConfigFile', () => {
  test('returns the chosen file name when many files exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.local.toml'), '')
      writeFileSync(joinPath(tmp, 'shopify.app.staging.toml'), '')
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce('shopify.app.staging.toml')

      // When
      const result = await selectConfigFile(tmp)

      // Then
      expect(result).toEqual(ok('shopify.app.staging.toml'))
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'Configuration file',
        choices: [
          {label: 'shopify.app.local.toml', value: 'shopify.app.local.toml'},
          {label: 'shopify.app.staging.toml', value: 'shopify.app.staging.toml'},
        ],
      })
    })
  })

  test('returns the file name when only one file exists without prompting', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.local.toml'), '')

      // When
      const result = await selectConfigFile(tmp)

      // Then
      expect(result).toEqual(ok('shopify.app.local.toml'))
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('returns an error when there is no config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // When
      const result = await selectConfigFile(tmp)

      // Then
      expect(result).toEqual(err('Could not find any shopify.app.toml file in the directory.'))
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })
})

describe('validate', () => {
  test('returns undefined when the generated name is valid', () => {
    // Given / When
    const result = validate('Valid name')

    // Then
    expect(result).toBeUndefined()
  })

  test('returns an error when the generated name is empty', () => {
    // Given / When
    const result = validate('- -')

    // Then
    expect(result).toEqual("The file name can't be empty.")
  })

  test('returns an error when the generated name is too long', () => {
    // Given / When
    const result = validate('A'.repeat(300))

    // Then
    expect(result).toEqual('The file name is too long.')
  })
})

describe('confirmPushChanges', () => {
  test('returns true when force is passed', async () => {
    // Given
    const options: PushOptions = {
      configuration: testAppWithConfig().configuration,
      force: true,
      commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
    }
    const app = testOrganizationApp() as App

    // When
    const result = await confirmPushChanges(options.force, options.configuration as CurrentAppConfiguration, app)

    // Then
    expect(result).toBeTruthy()
  })

  test('calls renderConfirmationPrompt with the expected params', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const app = testOrganizationApp({requestedAccessScopes: ['read_products']}) as App

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      const configuration = mergeAppConfiguration(
        {...DEFAULT_CONFIG, path: configurationPath},
        app as OrganizationApp,
        true,
      )

      configuration.name = 'app2'
      configuration.access_scopes = {scopes: 'read_themes, read_customers'}
      configuration.webhooks = {
        api_version: 'unstable',
      }

      const options: PushOptions = {
        configuration,
        force: false,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }

      // When
      const {schema} = await buildVersionedAppSchema()
      const result = await confirmPushChanges(options.force, configuration, app, schema)

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message: ['Make the following changes to your remote configuration?'],
        gitDiff: {
          baselineContent: `name = "app1"

[access_scopes]
scopes = "read_products"

[webhooks]
api_version = "2023-07"
`,
          updatedContent: `name = "app2"

[access_scopes]
scopes = "read_themes,read_customers"

[webhooks]
api_version = "unstable"
`,
        },
        defaultValue: true,
        confirmationMessage: 'Yes, confirm changes',
        cancellationMessage: 'No, cancel',
      })
      expect(result).toBeTruthy()
    })
  })

  test('returns false when there are no changes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const app = testOrganizationApp() as App
      const configuration = mergeAppConfiguration(
        {...DEFAULT_CONFIG, path: configurationPath},
        app as OrganizationApp,
        true,
      )
      const options: PushOptions = {
        configuration,
        force: false,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      // When
      const result = await confirmPushChanges(options.force, configuration, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })

  test('returns false when there are only ordering changes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const app = testOrganizationApp() as App
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      const updatedContent = `client_id = "api-key"
      name = "app1"
      application_url = "https://example.com"
      embedded = true

      [webhooks]
      api_version = "2023-07"

      [auth]
      redirect_urls = [ "https://example.com/callback1" ]

      [pos]
      embedded = false

      [access_scopes]
      use_legacy_install_flow = true
      scopes = "read_products"
      `
      const configuration = decodeToml(updatedContent) as CurrentAppConfiguration
      const options: PushOptions = {
        configuration,
        force: false,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      // When
      const result = await confirmPushChanges(options.force, configuration, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })

  test('returns false when there are only changes in comments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const app = testOrganizationApp() as App
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      const updatedContent = `client_id = "api-key"
      name = "app1"
      application_url = "https://example.com"
      embedded = true

      # new comment!

      [webhooks]
      api_version = "2023-07"

      [auth]
      redirect_urls = [ "https://example.com/callback1" ]

      [pos]
      embedded = false

      [access_scopes]
      scopes = "read_products"
      use_legacy_install_flow = true
      `
      const configuration = decodeToml(updatedContent) as CurrentAppConfiguration
      const options: PushOptions = {
        configuration,
        force: false,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }

      // When
      const result = await confirmPushChanges(options.force, configuration, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })

  test('returns false when there are no changes to app config but there are changes to [build]', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const app = testOrganizationApp() as App
      const configuration = mergeAppConfiguration(
        {...DEFAULT_CONFIG, path: configurationPath},
        app as OrganizationApp,
        true,
      )
      const options: PushOptions = {
        configuration: {
          ...configuration,
          build: {automatically_update_urls_on_dev: true, dev_store_url: 'shop1.myshopify.com'},
        },
        force: false,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      // When
      const result = await confirmPushChanges(options.force, configuration, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })
})
