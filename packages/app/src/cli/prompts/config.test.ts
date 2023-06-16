import {selectConfigName} from './config.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {renderConfirmationPrompt, renderConfigNamePrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/ui')

describe('selectConfigName', () => {
  test('returns the chosen file name when the file does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(renderConfigNamePrompt).mockResolvedValueOnce('staging')

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderConfigNamePrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(result).toEqual('staging')
    })
  })

  test('returns the chosen file name when the file exists and the user decides to overwrite', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.staging.toml'), '')
      vi.mocked(renderConfigNamePrompt).mockResolvedValueOnce('staging')
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderConfigNamePrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(result).toEqual('staging')
    })
  })

  test('asks for another name when the file exists and the users decides to change it', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.staging.toml'), '')
      vi.mocked(renderConfigNamePrompt).mockResolvedValueOnce('staging')
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConfigNamePrompt).mockResolvedValueOnce('pro')

      // When
      const result = await selectConfigName(tmp)

      // Then
      expect(renderConfigNamePrompt).toHaveBeenCalledTimes(2)
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(result).toEqual('pro')
    })
  })

  test('shows the slugified name as default when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(renderConfigNamePrompt).mockResolvedValueOnce('staging')

      // When
      await selectConfigName(tmp, 'My app')

      // Then
      expect(renderConfigNamePrompt).toHaveBeenCalledWith({
        defaultValue: 'my-app',
      })
    })
  })
})
