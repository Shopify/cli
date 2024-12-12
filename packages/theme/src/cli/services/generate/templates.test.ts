import {generateTemplate} from './templates.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('generateTemplate', () => {
  test('generates a liquid template with provided name if provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'product.test-template.liquid')
      const content = await readFile(templatePath)
      expect(content).toBe(`{% schema %}
{
  "name": "product",
  "type": "product",
  "settings": []
}
{% endschema %}`)
    })
  })

  test('generates a base liquid template resource file if name is undefined', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: undefined,
        type: 'basic',
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'product.liquid')
      const content = await readFile(templatePath)
      expect(content).toBe(`{% schema %}
{
  "name": "product",
  "type": "product",
  "settings": []
}
{% endschema %}`)
    })
  })

  test('generates a json template with provided name if provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'json',
        resource: 'collection',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'collection.test-template.json')
      const content = await readFile(templatePath)
      expect(content).toBe(`{
  "sections": {
    "main": {
      "type": "main-collection",
      "settings": {}
    }
  },
  "order": [
    "main"
  ]
}`)
    })
  })

  test('generates a base json template resource file if name is undefined', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: undefined,
        type: 'basic',
        path: tmpDir,
        fileType: 'json',
        resource: 'collection',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'collection.json')
      const content = await readFile(templatePath)
      expect(content).toBe(`{
  "sections": {
    "main": {
      "type": "main-collection",
      "settings": {}
    }
  },
  "order": [
    "main"
  ]
}`)
    })
  })

  test('resolves name conflicts by prompting for a new name', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      await writeFile(joinPath(tmpDir, 'templates', 'product.test-template.liquid'), 'test')
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }
      vi.mocked(renderTextPrompt).mockResolvedValueOnce('test-template').mockResolvedValueOnce('unique-template')

      // When
      await generateTemplate(options)

      // Then`
      expect(renderTextPrompt).toHaveBeenCalledTimes(2)
      expect(renderTextPrompt).toHaveBeenCalledWith({
        message: 'Template product.test-template.liquid already exists. Please provide a new name:',
      })
    })
  })
})
