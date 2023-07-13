import {confirmPushChanges, selectConfigFile, selectConfigName, validate} from './config.js'
import {PushOptions} from '../services/app/config/push.js'
import {testOrganizationApp, testAppWithConfig} from '../models/app/app.test-data.js'
import {App} from '../api/graphql/get_config.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {renderConfirmationPrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {err, ok} from '@shopify/cli-kit/node/result'

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
        previewPrefix: expect.any(Function),
        previewSuffix: expect.any(Function),
        previewValue: expect.any(Function),
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
      configurationPath: 'shopify.app.toml',
      force: true,
    }
    const app = testOrganizationApp() as App

    // When
    const result = await confirmPushChanges(options, app)

    // Then
    expect(result).toBeTruthy()
  })

  test('calls renderConfirmationPrompt with the expected params', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const options: PushOptions = {
        configuration: testAppWithConfig().configuration,
        configurationPath,
        force: false,
      }
      const app = testOrganizationApp() as App
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      const baselineContent = `client_id = "api-key"
name = "app1"
api_contact_email = "example@example.com"
application_url = "https://example.com"
embedded = true

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
      const updatedContent = baselineContent.replace('app1', 'app2')
      writeFileSync(configurationPath, updatedContent)

      // When
      const result = await confirmPushChanges(options, app)

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message: ['Make the following changes to your remote configuration?'],
        gitDiff: {
          baselineContent,
          updatedContent,
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
      const options: PushOptions = {
        configuration: testAppWithConfig().configuration,
        configurationPath,
        force: false,
      }
      const app = testOrganizationApp() as App
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      const baselineContent = `client_id = "api-key"
name = "app1"
api_contact_email = "example@example.com"
application_url = "https://example.com"
embedded = true

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
      const updatedContent = baselineContent
      writeFileSync(configurationPath, updatedContent)

      // When
      const result = await confirmPushChanges(options, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })

  test('returns false when there are only ordering changes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const configurationPath = joinPath(tmpDir, 'shopify.app.toml')
      const options: PushOptions = {
        configuration: testAppWithConfig().configuration,
        configurationPath,
        force: false,
      }
      const app = testOrganizationApp() as App
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      const baselineContent = `client_id = "api-key"
name = "app1"
api_contact_email = "example@example.com"
application_url = "https://example.com"
embedded = true

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
      const updatedContent = `client_id = "api-key"
      api_contact_email = "example@example.com"
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
      scopes = "read_products"
      use_legacy_install_flow = true
      `
      writeFileSync(configurationPath, updatedContent)

      // When
      const result = await confirmPushChanges(options, app)

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })
})
