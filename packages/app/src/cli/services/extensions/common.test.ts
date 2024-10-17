import {ensureDownloadedExtensionFlavorExists, ensureExtensionDirectoryExists} from './common.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionFlavor} from '../../models/app/template.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('ensureDownloadedExtensionFlavorExists()', () => {
  test('it returns the full path if it exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionFlavor: ExtensionFlavor = {name: 'Javascript', value: 'vanilla-js', path: 'template-path'}
      const fullTemplatePath = joinPath(tmpDir, extensionFlavor.path!)
      await mkdir(fullTemplatePath)

      // When
      const result = await ensureDownloadedExtensionFlavorExists(extensionFlavor, tmpDir)

      // Then
      expect(result).toBe(fullTemplatePath)
    })
  })

  test('it fails if the path does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionFlavor: ExtensionFlavor = {name: 'Javascript', value: 'vanilla-js', path: 'wrong-path'}

      // When
      const result = ensureDownloadedExtensionFlavorExists(extensionFlavor, tmpDir)

      // Then
      await expect(result).rejects.toThrow('The extension is not available for vanilla-js')
    })
  })
})

describe('ensureExtensionDirectoryExists()', () => {
  test('it creates a directory when it does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const name = 'my extension'
      const app: AppInterface = {directory: tmpDir} as AppInterface

      // When
      const result = await ensureExtensionDirectoryExists({app, name})

      // Then
      const expectedPath = joinPath(tmpDir, 'extensions', 'my-extension')
      expect(result).toBe(expectedPath)
    })
  })

  test('it fails if the directory already exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const name = 'my extension'
      const app: AppInterface = {directory: tmpDir} as AppInterface
      const extensionPath = joinPath(tmpDir, 'extensions', 'my-extension')
      await mkdir(extensionPath)

      // When
      const result = ensureExtensionDirectoryExists({app, name})

      // Then
      await expect(result).rejects.toThrow('A directory with this name (my-extension) already exists.')
    })
  })
})
