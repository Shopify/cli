import {checkBaseTemplateExists, promptForType} from './generator.js'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/ui')

describe('generator utilities', () => {
  describe('checkBaseTemplateExists', () => {
    test('checks for base template existence', async () => {
      // Given
      vi.mocked(fileExists).mockResolvedValue(true)
      const options = {
        resource: 'product',
        fileType: 'liquid',
        path: '/path/to/theme',
      }

      // When
      const exists = await checkBaseTemplateExists(options)

      // Then
      expect(exists).toBe(true)
      expect(fileExists).toHaveBeenCalledWith('/path/to/theme/templates/product.liquid')
    })

    test('returns false when base template does not exist', async () => {
      // Given
      vi.mocked(fileExists).mockResolvedValue(false)
      const options = {
        resource: 'collection',
        fileType: 'json',
        path: '/path/to/theme',
      }

      // When
      const exists = await checkBaseTemplateExists(options)

      // Then
      expect(exists).toBe(false)
      expect(fileExists).toHaveBeenCalledWith('/path/to/theme/templates/collection.json')
    })
  })

  describe('promptForType', () => {
    test('prompts user to select from available types', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue('selected-type')
      const types = ['type1', 'type2', 'type3']

      // When
      const result = await promptForType('Select a type', types)

      // Then
      expect(result).toBe('selected-type')
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'Select a type',
        choices: [
          {label: 'type1', value: 'type1'},
          {label: 'type2', value: 'type2'},
          {label: 'type3', value: 'type3'},
        ],
      })
    })
  })
})
