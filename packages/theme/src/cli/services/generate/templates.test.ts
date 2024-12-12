import {generateTemplate} from './templates.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/fs')
describe('generateTemplate', () => {
  beforeEach(() => {
    vi.mocked(fileExists).mockResolvedValue(false)
  })

  test('generates new content for named template when base does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: 'test-template',
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

  test('generates a base liquid template file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const baseContent = `{% schema %}
{
  "name": "product",
  "type": "product",
  "settings": [
    {
      "type": "text",
      "id": "custom_setting",
      "label": "Custom Setting"
    }
  ]
}
{% endschema %}`
      await writeFile(joinPath(tmpDir, 'templates', 'product.liquid'), baseContent)

      const options = {
        name: undefined,
        path: tmpDir,
        fileType: 'liquid',
        resource: 'product',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'product.liquid')
      const content = await readFile(templatePath)
      expect(content).toBe(baseContent)
    })
  })

  test('generates new content for named json template when base does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const options = {
        name: 'test-template',
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

  test('generates a base json template file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'templates'))
      const baseContent = `{
  "sections": {
    "main": {
      "type": "main-collection",
      "settings": {
        "custom_setting": "value"
      }
    }
  },
  "order": ["main"]
}`
      await writeFile(joinPath(tmpDir, 'templates', 'collection.json'), baseContent)

      const options = {
        name: undefined,
        path: tmpDir,
        fileType: 'json',
        resource: 'collection',
      }

      // When
      await generateTemplate(options)

      // Then
      const templatePath = joinPath(tmpDir, 'templates', 'collection.json')
      const content = await readFile(templatePath)
      expect(content).toBe(baseContent)
    })
  })
})
