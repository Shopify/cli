import {flowTemplateExtensionFiles} from './flow-template.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('flowTemplateExtensionFiles', () => {
  test('includes only *.flow, *.json, *.toml files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'flow_template')!
      const flowTemplateExtension = new ExtensionInstance({
        configuration: {
          name: 'flow template extension name',
          type: 'flow_template' as const,
          metafields: [],
        },
        configurationPath: '',
        directory: tmpDir,
        specification,
      })

      await mkdir(joinPath(tmpDir, 'myDir'))
      // Testing standard filenames, files with leading dots, ignored directories.
      const files = [
        'shopify.extension.toml',
        'template.flow',
        'locales/en.default.json',
        'locales/fr.json',
        'Thumbs.db',
        '.DS_Store',
      ]
      await Promise.all(
        files.map(async (filename) => {
          const fullpath = joinPath(tmpDir, 'myDir', filename)
          await mkdir(dirname(fullpath))
          await writeFile(fullpath, 'test content')
        }),
      )

      // Then
      await expect(flowTemplateExtensionFiles(flowTemplateExtension)).resolves.toStrictEqual([
        joinPath(tmpDir, 'myDir/template.flow'),
        joinPath(tmpDir, 'myDir/locales/en.default.json'),
        joinPath(tmpDir, 'myDir/locales/fr.json'),
      ])
    })
  })
})
