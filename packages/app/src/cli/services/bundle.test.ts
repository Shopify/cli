import {writeManifestToBundle, compressBundle} from './bundle.js'
import {AppInterface} from '../models/app/app.js'
import {describe, test, expect} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, inTemporaryDirectory, mkdir, writeFile, readFile} from '@shopify/cli-kit/node/fs'

describe('writeManifestToBundle', () => {
  test('writes manifest.json to the specified directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const manifestContent = {
        name: 'Test App',
        version: '1.0.0',
      }
      const mockApp = {
        manifest: async () => manifestContent,
      } as unknown as AppInterface

      // When
      await writeManifestToBundle(mockApp, tmpDir)

      // Then
      const manifestPath = joinPath(tmpDir, 'manifest.json')
      const manifest = await readFile(manifestPath)
      expect(JSON.parse(manifest)).toEqual(manifestContent)
    })
  })
})

describe('compressBundle', () => {
  test('creates a zip file from the input directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')

      // When
      await compressBundle(inputDir, outputZip)

      // Then
      const zipExists = await fileExists(outputZip)
      expect(zipExists).toBe(true)
    })
  })

  test('excludes .js.map files from the zip', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')
      await writeFile(joinPath(inputDir, 'test.js.map'), 'test content')

      // When
      await compressBundle(inputDir, outputZip)

      // Then
      const zipContent = await readFile(outputZip)
      // We are reading the zip as a binary because we don't have a library to unzip, but we can still check for the presence of the file name
      expect(zipContent).not.toContain('test.js.map')
    })
  })
})
