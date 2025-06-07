import {isVSCode, addRecommendedExtensions} from './vscode.js'
import {inTemporaryDirectory, mkdir, writeFile, readFile} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test, beforeEach, vi} from 'vitest'

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
  let originalDebugFn: any

  beforeEach(() => {
    // Mock the outputDebug function to avoid noise in tests
    originalDebugFn = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  test('creates extensions.json file if VSCode directory exists but file does not', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const vscodePath = joinPath(tmpDir, '.vscode')
      await mkdir(vscodePath)

      // Mock isVSCode
      vi.spyOn(await import('./vscode.js'), 'isVSCode').mockResolvedValue(true)

      const extensionsToAdd = ['publisher.extension1', 'publisher.extension2']

      // When
      await addRecommendedExtensions(tmpDir, extensionsToAdd)

      // Then
      const extensionsFilePath = joinPath(vscodePath, 'extensions.json')
      const fileContent = await readFile(extensionsFilePath)
      const extensionsJson = JSON.parse(fileContent)

      expect(extensionsJson).toEqual({
        recommendations: ['publisher.extension1', 'publisher.extension2'],
      })
    })
  })

  test('adds new extensions to existing extensions.json file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const vscodePath = joinPath(tmpDir, '.vscode')
      await mkdir(vscodePath)

      const existingExtensions = {
        recommendations: ['existing.extension'],
      }
      await writeFile(joinPath(vscodePath, 'extensions.json'), JSON.stringify(existingExtensions))

      // Mock isVSCode
      vi.spyOn(await import('./vscode.js'), 'isVSCode').mockResolvedValue(true)

      const extensionsToAdd = ['publisher.extension1', 'publisher.extension2']

      // When
      await addRecommendedExtensions(tmpDir, extensionsToAdd)

      // Then
      const extensionsFilePath = joinPath(vscodePath, 'extensions.json')
      const fileContent = await readFile(extensionsFilePath)
      const extensionsJson = JSON.parse(fileContent)

      expect(extensionsJson).toEqual({
        recommendations: ['existing.extension', 'publisher.extension1', 'publisher.extension2'],
      })
    })
  })

  test('preserves other properties in existing extensions.json file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const vscodePath = joinPath(tmpDir, '.vscode')
      await mkdir(vscodePath)

      const existingExtensions = {
        recommendations: ['existing.extension'],
        unwantedRecommendations: ['unwanted.extension'],
      }
      await writeFile(joinPath(vscodePath, 'extensions.json'), JSON.stringify(existingExtensions))

      // Mock isVSCode
      vi.spyOn(await import('./vscode.js'), 'isVSCode').mockResolvedValue(true)

      const extensionsToAdd = ['publisher.extension1']

      // When
      await addRecommendedExtensions(tmpDir, extensionsToAdd)

      // Then
      const extensionsFilePath = joinPath(vscodePath, 'extensions.json')
      const fileContent = await readFile(extensionsFilePath)
      const extensionsJson = JSON.parse(fileContent)

      expect(extensionsJson).toEqual({
        recommendations: ['existing.extension', 'publisher.extension1'],
        unwantedRecommendations: ['unwanted.extension'],
      })
    })
  })

  test('does nothing when VSCode is not detected', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      // No .vscode directory

      // Mock isVSCode
      vi.spyOn(await import('./vscode.js'), 'isVSCode').mockResolvedValue(false)

      const extensionsToAdd = ['publisher.extension1', 'publisher.extension2']

      // When
      await addRecommendedExtensions(tmpDir, extensionsToAdd)

      // Then
      const vscodePath = joinPath(tmpDir, '.vscode')
      const extensionsFilePath = joinPath(vscodePath, 'extensions.json')

      // We expect no extensions.json file to be created
      await expect(readFile(extensionsFilePath)).rejects.toThrow()
    })
  })
})
