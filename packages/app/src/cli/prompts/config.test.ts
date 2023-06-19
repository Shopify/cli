import {selectConfigName, validate} from './config.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

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
