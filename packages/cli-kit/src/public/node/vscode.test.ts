import {isVSCode, addRecommendedExtensions} from './vscode.js'
import {inTemporaryDirectory, mkdir, writeFile, readFile, fileExists} from './fs.js'
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
  test('does nothing if the project is not a VSCode project', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode'])

      // Then
      await expect(fileExists(extensionsPath)).resolves.toEqual(false)
    })
  })

  test('creates extensions.json if missing inside a VSCode project', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode'])

      // Then
      await expect(fileExists(extensionsPath)).resolves.toEqual(true)
      const content = JSON.parse(await readFile(extensionsPath))
      expect(content).toEqual({
        recommendations: ['shopify.theme-check-vscode'],
      })
    })
  })

  test('appends recommendations to an existing extensions.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, '.vscode'))
      const extensionsPath = joinPath(tmpDir, '.vscode/extensions.json')
      const initialJson = {
        recommendations: ['octref.vetur'],
        otherSetting: true,
      }
      await writeFile(extensionsPath, JSON.stringify(initialJson, null, 2))

      // When
      await addRecommendedExtensions(tmpDir, ['shopify.theme-check-vscode'])

      // Then
      const content = JSON.parse(await readFile(extensionsPath))
      expect(content).toEqual({
        recommendations: ['octref.vetur', 'shopify.theme-check-vscode'],
        otherSetting: true,
      })
    })
  })
})
