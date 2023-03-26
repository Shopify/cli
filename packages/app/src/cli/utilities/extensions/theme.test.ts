import {themeExtensionFiles} from './theme.js'
import themeSpec from '../../models/extensions/theme-specifications/theme.js'
import {ThemeExtensionInstance} from '../../models/extensions/theme.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('themeExtensionConfig', () => {
  test('excludes system files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeExtension = new ThemeExtensionInstance({
        configuration: {
          name: 'theme extension name',
          type: 'theme' as const,
        },
        configurationPath: '',
        directory: tmpDir,
        specification: themeSpec,
        outputBundlePath: tmpDir,
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
