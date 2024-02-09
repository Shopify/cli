import {selectConfigFile, selectConfigName, validate} from './config.js'

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
