import {themeExtensionFiles, parseIgnoreFile} from './theme.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('themeExtensionConfig', () => {
  test('excludes system files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'theme')!
      const themeExtension = new ExtensionInstance({
        configuration: {
          name: 'theme extension name',
          type: 'theme' as const,
          metafields: [],
        },
        configurationPath: '',
        directory: tmpDir,
        specification,
      })

      await mkdir(joinPath(tmpDir, 'blocks'))
      // Testing standard filenames, files with leading dots, ignored directories.
      const ignoredFiles = ['Thumbs.db', '.DS_Store', '.sublime-project', 'node_modules/foo/package.json']
      await Promise.all(
        ['test.liquid', ...ignoredFiles].map(async (filename) => {
          const fullpath = joinPath(tmpDir, 'blocks', filename)
          await mkdir(dirname(fullpath))
          await writeFile(fullpath, 'test content')
        }),
      )

      // Then
      await expect(themeExtensionFiles(themeExtension)).resolves.toStrictEqual([joinPath(tmpDir, 'blocks/test.liquid')])
    })
  })
})

describe('parseIgnoreFile()', () => {
  test('returns the patterns that should be ignored', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const filePath = joinPath(tmpDir, '.shopifyignore')
      const content = '#foo\nbar\nbaz\n'
      await writeFile(filePath, content)

      // When
      const patterns = await parseIgnoreFile(filePath)

      // Then
      expect(patterns).toEqual(['bar', 'baz'])
    })
  })
})
