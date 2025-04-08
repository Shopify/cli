import {getOrCreateAppConfigHiddenPath} from './hidden-app-config.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as fs from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'
import {getOrCreateHiddenShopifyFolder} from '@shopify/cli-kit/node/hidden-folder'

describe('getOrCreateAppConfigHiddenPath', () => {
  test("creates hidden config file with empty JSON object if it doesn't exist", async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // When
      await getOrCreateAppConfigHiddenPath(tmpDir)
      const configPath = joinPath(tmpDir, '.shopify', 'project.json')

      // Then
      await expect(fs.fileExists(configPath)).resolves.toBe(true)
      const configContent = await fs.readFile(configPath)
      expect(configContent).toBe('{}')
    })
  })

  test('does not recreate the config file if it already exists', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const hiddenShopifyFolder = await getOrCreateHiddenShopifyFolder(tmpDir)
      const hiddenConfigPath = joinPath(hiddenShopifyFolder, 'project.json')
      await fs.writeFile(hiddenConfigPath, JSON.stringify({test: 'value'}))
      const writeFileSpy = vi.spyOn(fs, 'writeFile')

      // When
      const result = await getOrCreateAppConfigHiddenPath(tmpDir)

      // Then
      expect(result).toBe(hiddenConfigPath)
      const configContent = await fs.readFile(hiddenConfigPath)
      expect(JSON.parse(configContent)).toEqual({test: 'value'})
      expect(writeFileSpy).not.toHaveBeenCalled()
    })
  })
})
