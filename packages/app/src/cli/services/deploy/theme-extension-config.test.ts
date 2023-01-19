import {themeExtensionConfig} from './theme-extension-config.js'
import themeSpec from '../../models/extensions/theme-specifications/theme.js'
import {ThemeExtensionInstance} from '../../models/extensions/theme.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('themeExtensionConfig', () => {
  test('builds a base64 encoded payload containing all theme files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeExtension = new ThemeExtensionInstance({
        configuration: {
          name: 'theme extension name',
          type: 'theme' as const,
        },
        configurationPath: '',
        directory: tmpDir,
        remoteSpecification: undefined,
        specification: themeSpec,
        outputBundlePath: tmpDir,
      })

      await mkdir(joinPath(tmpDir, 'blocks'))
      await writeFile(joinPath(tmpDir, 'blocks', 'test.liquid'), 'test content')

      // Then
      await expect(themeExtensionConfig(themeExtension)).resolves.toStrictEqual({
        theme_extension: {
          files: {
            'blocks/test.liquid': Buffer.from('test content').toString('base64'),
          },
        },
      })
    })
  })
})
