import {getListingFilePath, updateSettingsDataForListing, ensureListingExists} from './theme-listing.js'
import {test, describe, expect} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, symlink, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('theme-listing', () => {
  describe('getListingFilePath', () => {
    test('rejects a traversal component in a listing file key', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const themeDir = joinPath(tmpDir, 'theme')
        await mkdir(themeDir)

        await expect(getListingFilePath(themeDir, 'modern', 'templates/../outside.json')).rejects.toThrow(AbortError)
      })
    })

    test.each(['', '.', '..', '../outside', '..\\outside', '/outside', 'C:\\outside'])(
      'rejects unsafe listing name %s',
      async (listingName) => {
        await inTemporaryDirectory(async (tmpDir) => {
          await mkdir(joinPath(tmpDir, 'theme'))
          await expect(
            getListingFilePath(joinPath(tmpDir, 'theme'), listingName, 'templates/index.json'),
          ).rejects.toThrow(AbortError)
        })
      },
    )

    test('rejects a listing file symlink outside the theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const themeDir = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.json')
        const listingPath = joinPath(themeDir, 'listings/modern/templates/index.json')
        await mkdir(joinPath(themeDir, 'listings/modern/templates'))
        await writeFile(outsidePath, '{"secret":true}')
        await symlink(outsidePath, listingPath)

        await expect(getListingFilePath(themeDir, 'modern', 'templates/index.json')).rejects.toThrow(AbortError)
        await expect(readFile(outsidePath)).resolves.toBe('{"secret":true}')
      })
    })

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
    test('rejects a symlinked config directory outside the theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const themeDir = joinPath(tmpDir, 'theme')
        const outsideDir = joinPath(tmpDir, 'outside')
        await mkdir(themeDir)
        await mkdir(outsideDir)
        await writeFile(joinPath(outsideDir, 'settings_data.json'), '{"current":"Secret"}')
        await symlink(outsideDir, joinPath(themeDir, 'config'))

        await expect(updateSettingsDataForListing(themeDir, 'modern')).rejects.toThrow(AbortError)
      })
    })

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

  describe('ensureListingExists', () => {
    test('rejects an unsafe listing name', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        await mkdir(joinPath(tmpDir, 'theme'))
        await expect(ensureListingExists(joinPath(tmpDir, 'theme'), '../outside')).rejects.toThrow(AbortError)
      })
    })

    test('resolves when the listing preset directory exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingDir = joinPath(themeDir, 'listings', 'modern')
        await mkdir(listingDir)

        // When / Then (no throw)
        await ensureListingExists(themeDir, 'modern')
      })
    })

    test('throws with available presets listed when the preset is missing', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingsRoot = joinPath(themeDir, 'listings')
        await mkdir(joinPath(listingsRoot, 'modern'))
        await mkdir(joinPath(listingsRoot, 'classic'))

        // When
        let errorMessage = ''
        try {
          await ensureListingExists(themeDir, 'unknown')
        } catch (error) {
          if (error instanceof Error) {
            errorMessage = error.message
          } else {
            throw error
          }
        }

        // Then
        expect(errorMessage).toContain('Listing preset "unknown" was not found.')
        expect(errorMessage).toContain('Available presets:')
        expect(errorMessage).toContain('"Modern"')
        expect(errorMessage).toContain('"Classic"')
      })
    })

    test('throws with no presets message when listings directory does not exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')

        // When / Then
        await expect(ensureListingExists(themeDir, 'unknown')).rejects.toThrow('No presets found under "listings/"')
      })
    })

    test('throws with no presets message when listings directory exists but is empty', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const themeDir = joinPath(tmpDir, 'theme')
        const listingsRoot = joinPath(themeDir, 'listings')
        await mkdir(listingsRoot)

        // When / Then
        await expect(ensureListingExists(themeDir, 'unknown')).rejects.toThrow('No presets found under "listings/"')
      })
    })
  })
})
