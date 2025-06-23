import {getListingFilePath, updateSettingsDataForListing} from './theme-listing.js'
import {test, describe, expect} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('theme-listing', () => {
  describe('getListingFilePath', () => {
    test('returns listing file path when listing file exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingDir = joinPath(themeDir, 'listings', 'modern')
        const templatesDir = joinPath(listingDir, 'templates')
        await mkdir(templatesDir)
        await writeFile(joinPath(templatesDir, 'index.json'), '{"sections": {}}')

        // When
        const result = await getListingFilePath(themeDir, 'modern', 'templates/index.json')

        // Then
        expect(result).toBe(joinPath(templatesDir, 'index.json'))
      })
    })

    test('returns undefined when listing file does not exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingDir = joinPath(themeDir, 'listings', 'modern')
        await mkdir(listingDir)

        // When
        const result = await getListingFilePath(themeDir, 'modern', 'templates/index.json')

        // Then
        expect(result).toBeUndefined()
      })
    })

    test('returns undefined for non-template/section files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')

        // When
        const result = await getListingFilePath(themeDir, 'modern', 'assets/style.css')

        // Then
        expect(result).toBeUndefined()
      })
    })

    test('returns undefined for non-JSON files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')

        // When
        const result = await getListingFilePath(themeDir, 'modern', 'templates/index.liquid')

        // Then
        expect(result).toBeUndefined()
      })
    })

    test('works with sections files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingDir = joinPath(themeDir, 'listings', 'modern')
        const sectionsDir = joinPath(listingDir, 'sections')
        await mkdir(sectionsDir)
        await writeFile(joinPath(sectionsDir, 'header.json'), '{"name": "header"}')

        // When
        const result = await getListingFilePath(themeDir, 'modern', 'sections/header.json')

        // Then
        expect(result).toBe(joinPath(sectionsDir, 'header.json'))
      })
    })
  })

  describe('updateSettingsDataForListing', () => {
    test('updates current preset to match listing name', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const configDir = joinPath(themeDir, 'config')
        await mkdir(configDir)

        const originalSettings = {
          current: 'Default',
          presets: {
            Default: {color: 'blue'},
            Modern: {color: 'red'},
          },
        }
        await writeFile(joinPath(configDir, 'settings_data.json'), JSON.stringify(originalSettings, null, 2))

        // When
        const result = await updateSettingsDataForListing(themeDir, 'modern')

        // Then
        const updatedSettings = JSON.parse(result)
        expect(updatedSettings.current).toBe('Modern')
        expect(updatedSettings.presets).toEqual(originalSettings.presets)
      })
    })

    test('converts kebab-case to display case correctly', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const configDir = joinPath(themeDir, 'config')
        await mkdir(configDir)

        const originalSettings = {
          current: 'Default',
          presets: {
            Default: {color: 'blue'},
            'Vintage Classic': {color: 'brown'},
          },
        }
        await writeFile(joinPath(configDir, 'settings_data.json'), JSON.stringify(originalSettings))

        // When
        const result = await updateSettingsDataForListing(themeDir, 'vintage-classic')

        // Then
        const updatedSettings = JSON.parse(result)
        expect(updatedSettings.current).toBe('Vintage Classic')
      })
    })

    test('handles malformed JSON gracefully', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const configDir = joinPath(themeDir, 'config')
        await mkdir(configDir)

        const malformedJson = '{ "current": "Default", invalid json'
        await writeFile(joinPath(configDir, 'settings_data.json'), malformedJson)

        // When
        const result = await updateSettingsDataForListing(themeDir, 'modern')

        // Then
        expect(result).toBe(malformedJson)
      })
    })
  })
})
