import {isVSCode, addRecommendedExtensions} from './vscode.js'
import {inTemporaryDirectory, mkdir, fileExists, readFile, writeFile} from './fs.js'
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
  test('does nothing when the directory is not a vscode project', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode'])

      // Then
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')
      await expect(fileExists(extensionsPath)).resolves.toEqual(false)
      await expect(fileExists(joinPath(tmpDir, '.vscode'))).resolves.toEqual(false)
    })
  })

  test('creates extensions.json with recommendations when .vscode exists but extensions.json does not', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode', 'shopify.shopify-cli-extensions'])

      // Then
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')
      await expect(fileExists(extensionsPath)).resolves.toEqual(true)
      const content = await readFile(extensionsPath)
      const json = JSON.parse(content)
      expect(json).toEqual({
        recommendations: ['shopify.theme-check-vscode', 'shopify.shopify-cli-extensions'],
      })
    })
  })

  test('appends recommendations to an existing extensions.json file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')
      const initialJson = {
        recommendations: ['existing.extension-id'],
        unwantedRecommendations: [],
      }
      await writeFile(extensionsPath, JSON.stringify(initialJson, null, 2))

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode'])

      // Then
      const content = await readFile(extensionsPath)
      const json = JSON.parse(content)
      expect(json).toEqual({
        recommendations: ['existing.extension-id', 'shopify.theme-check-vscode'],
        unwantedRecommendations: [],
      })
    })
  })
})
