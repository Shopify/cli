import {describe, expect, test} from 'vitest'
import {channelSpecificationFiles} from './channel-specification.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

describe('channelSpecificationFiles', () => {
  test('includes only config files from specifications subdirectory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'channel_specification')!
      const channelSpecificationExtension = new ExtensionInstance({
        configuration: {
          name: 'channel specification extension',
          type: 'channel_specification' as const,
          handle: 'my-channel',
        },
        configurationPath: '',
        directory: tmpDir,
        specification,
      })

      const files = [
        'specifications/config.json',
        'specifications/settings.toml',
        'specifications/mappings.yaml',
        'specifications/data.yml',
        'specifications/nested/deep.json',
        'specifications/nested/config.toml',
        'specifications/README.md',
        'specifications/.DS_Store',
        'root-config.json',
        'shopify.extension.toml',
      ]

      await Promise.all(
        files.map(async (filename) => {
          const fullpath = joinPath(tmpDir, filename)
          await mkdir(dirname(fullpath))
          await writeFile(fullpath, 'test content')
        }),
      )

      const result = await channelSpecificationFiles(channelSpecificationExtension)

      expect(result.sort()).toStrictEqual([
        joinPath(tmpDir, 'specifications/config.json'),
        joinPath(tmpDir, 'specifications/data.yml'),
        joinPath(tmpDir, 'specifications/mappings.yaml'),
        joinPath(tmpDir, 'specifications/nested/config.toml'),
        joinPath(tmpDir, 'specifications/nested/deep.json'),
        joinPath(tmpDir, 'specifications/settings.toml'),
      ].sort())
    })
  })
})
