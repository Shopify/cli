import {generateTemplate} from './templates.js'
import {inTemporaryDirectory, mkdir, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('generateTemplate', () => {
  test('generates a liquid template file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }

      // Create templates directory
      await mkdir(joinPath(tmpDir, 'templates'))

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'product.test-template.liquid')
      const content = await readFile(templatePath)
      expect(content).toBe(`{% schema %}
{
  "name": "test-template",
  "type": "basic",
  "settings": []
}
{% endschema %}`)
    })
  })

  test('generates a json template file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'json',
        resource: 'collection',
      }

      // Create templates directory
      await mkdir(joinPath(tmpDir, 'templates'))

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'collection.test-template.json')
      const content = await readFile(templatePath)
      expect(content).toBe(`{
  "sections": {
    "main": {
      "type": "main-basic",
      "settings": {}
    }
  },
  "order": [
    "main"
  ]
}`)
    })
  })

  test('throws error if template already exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const options = {
        name: 'test-template',
        type: 'basic',
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }

      // Create templates directory and existing template
      await mkdir(joinPath(tmpDir, 'templates'))
      await generateTemplate(options)

      // When/Then
      await expect(generateTemplate(options)).rejects.toThrow('Template test-template already exists')
    })
  })
})
