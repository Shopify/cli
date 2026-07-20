import {addRecommendedExtensions, isVSCode} from './vscode.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

describe('isVSCode', () => {
  test('returns true if project has a vscode folder', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await expect(isVSCode(tmpDir)).resolves.toEqual(false)

      await mkdir(joinPath(tmpDir, '.vscode'))

      // When
      const got = await isVSCode(tmpDir)

      // Then
      expect(got).toEqual(true)
    })
  })
})

describe('addRecommendedExtensions', () => {
  test('does nothing if the directory does not have a .vscode folder', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.shopify-cli-extensions'])

      // Then
      await expect(fileExists(extensionsPath)).resolves.toEqual(false)
    })
  })

  test('creates extensions.json with the recommendations if .vscode folder exists but no extensions.json exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.shopify-cli-extensions'])

      // Then
      await expect(fileExists(extensionsPath)).resolves.toEqual(true)
      const content = await readFile(extensionsPath)
      const parsed = JSON.parse(content)
      expect(parsed).toEqual({
        recommendations: ['shopify.shopify-cli-extensions'],
      })
    })
  })

  test('appends recommendations to the existing ones in extensions.json if both .vscode folder and extensions.json exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')
      const initialJson = {
        recommendations: ['ms-sarah.another-ext'],
        otherSetting: true,
      }
      await writeFile(extensionsPath, JSON.stringify(initialJson, null, 2))

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.shopify-cli-extensions'])

      // Then
      await expect(fileExists(extensionsPath)).resolves.toEqual(true)
      const content = await readFile(extensionsPath)
      const parsed = JSON.parse(content)
      expect(parsed).toEqual({
        recommendations: ['ms-sarah.another-ext', 'shopify.shopify-cli-extensions'],
        otherSetting: true,
      })
    })
  })
})
