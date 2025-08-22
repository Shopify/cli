import {describe, expect, test} from 'vitest'
import {bundleChannelSpecificationExtension} from './bundle.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('bundleChannelSpecificationExtension', () => {
  test('copies specification files to output directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extensionDir = joinPath(tmpDir, 'extension')
      const outputDir = joinPath(tmpDir, 'output')
      const specsDir = joinPath(extensionDir, 'specifications')

      await mkdir(extensionDir)
      await mkdir(outputDir)
      await mkdir(specsDir)
      await mkdir(joinPath(specsDir, 'nested'))

      await writeFile(joinPath(specsDir, 'config.json'), '{"key": "value"}')
      await writeFile(joinPath(specsDir, 'settings.toml'), 'setting = "value"')
      await writeFile(joinPath(specsDir, 'nested', 'data.yaml'), 'data: nested')

      const mockExtension = {
        directory: extensionDir,
        outputPath: outputDir,
      } as ExtensionInstance

      await bundleChannelSpecificationExtension(mockExtension)

      expect(await fileExists(joinPath(outputDir, 'specifications', 'config.json'))).toBe(true)
      expect(await fileExists(joinPath(outputDir, 'specifications', 'settings.toml'))).toBe(true)
      expect(await fileExists(joinPath(outputDir, 'specifications', 'nested', 'data.yaml'))).toBe(true)
    })
  })
})
