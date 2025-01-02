import {packageTheme} from './package.js'
import {describe, expect, vi, test} from 'vitest'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {mkdir, writeFile, inTemporaryDirectory, touchFile, fileExists} from '@shopify/cli-kit/node/fs'

const StreamZip = require('node-stream-zip')

vi.mock('@shopify/cli-kit/node/ui')

describe('packageTheme', () => {
  test('creates zip file from theme', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)
      const themeRelativePaths = [
        'assets/base.css',
        'layout/theme.liquid',
        'config/settings_schema.json',
        'release-notes.md',
        'update_extension.json',
      ]
      await createFiles(themeRelativePaths, inputDirectory)
      await createSettingsSchema(
        '[{"name": "theme_info", "theme_name": "Dawn", "theme_version": "7.0.2"}]',
        inputDirectory,
      )

      // When
      await packageTheme(inputDirectory)

      // Then
      const expectedOutputZipPath = joinPath(inputDirectory, 'Dawn-7.0.2.zip')
      await expect(fileExists(expectedOutputZipPath)).resolves.toBeTruthy()

      const archiveEntries = await readArchiveFiles(expectedOutputZipPath)
      expect(themeRelativePaths.sort()).toEqual(archiveEntries.sort())

      expect(renderSuccess).toBeCalledWith({
        body: ['Your local theme was packaged in', {filePath: expectedOutputZipPath}],
      })
    })
  })

  test('zip file only includes valid directories', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)
      const themeRelativePaths = [
        'assets/base.css',
        'config/settings_schema.json',
        'config/unsupported_dir/settings_schema.json',
        'templates/customers/account.json',
        'invalid-file.md',
        'invalid/file.liquid',
      ]
      const expectedThemeRelativePaths = [
        'assets/base.css',
        'config/settings_schema.json',
        'templates/customers/account.json',
      ]
      await createFiles(themeRelativePaths, inputDirectory)
      await createSettingsSchema(
        '[{"name": "theme_info", "theme_name": "Dawn", "theme_version": "7.0.2"}]',
        inputDirectory,
      )

      // When
      await packageTheme(inputDirectory)

      // Then
      const expectedOutputZipPath = joinPath(inputDirectory, 'Dawn-7.0.2.zip')
      await expect(fileExists(expectedOutputZipPath)).resolves.toBeTruthy()

      const archiveEntries = await readArchiveFiles(expectedOutputZipPath)
      expect(expectedThemeRelativePaths.sort()).toEqual(archiveEntries.sort())

      expect(renderSuccess).toBeCalledWith({
        body: ['Your local theme was packaged in', {filePath: expectedOutputZipPath}],
      })
    })
  })

  test('zip file name excludes theme version if missing from config/settings_schema.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)
      const themeRelativePaths = [
        'assets/base.css',
        'blocks/product-grid.liquid',
        'layout/theme.liquid',
        'config/settings_schema.json',
        'release-notes.md',
        'update_extension.json',
      ]
      await createFiles(themeRelativePaths, inputDirectory)
      await createSettingsSchema('[{"name": "theme_info", "theme_name": "Dawn"}]', inputDirectory)

      // When
      await packageTheme(inputDirectory)

      // Then
      const expectedOutputZipPath = joinPath(inputDirectory, 'Dawn.zip')
      await expect(fileExists(expectedOutputZipPath)).resolves.toBeTruthy()

      const archiveEntries = await readArchiveFiles(expectedOutputZipPath)
      expect(themeRelativePaths.sort()).toEqual(archiveEntries.sort())

      expect(renderSuccess).toBeCalledWith({
        body: ['Your local theme was packaged in', {filePath: expectedOutputZipPath}],
      })
    })
  })

  test('abort if config/settings_schema.json is missing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)

      await expect(async () => {
        // When
        await packageTheme(inputDirectory)

        // Then
      }).rejects.toThrowError(/Provide a config\/settings_schema.json to package your theme./)

      expect(renderSuccess).not.toBeCalled()
    })
  })

  test('abort if theme name missing from config/settings_schema.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)
      const themeRelativePaths = ['config/settings_schema.json']
      await createFiles(themeRelativePaths, inputDirectory)
      await createSettingsSchema('[{"name": "theme_info"}]', inputDirectory)

      await expect(async () => {
        // When
        await packageTheme(inputDirectory)

        // Then
      }).rejects.toThrowError(/Provide a theme_info.theme_name configuration in config\/settings_schema.json/)

      expect(renderSuccess).not.toBeCalled()
    })
  })

  test('abort when the config/settings_schema.json file is broken', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDirectory = joinPath(tmpDir, 'theme')
      await mkdir(inputDirectory)
      const themeRelativePaths = ['config/settings_schema.json']
      await createFiles(themeRelativePaths, inputDirectory)
      await createSettingsSchema('[{"name":', inputDirectory)

      await expect(async () => {
        // When
        await packageTheme(inputDirectory)

        // Then
      }).rejects.toThrowError(
        /The file config\/settings_schema.json contains an error. Please check if the file is valid JSON and includes the theme_info.theme_name configuration./,
      )

      expect(renderSuccess).not.toBeCalled()
    })
  })
})

async function createFiles(structure: string[], directory: string) {
  for (const fileRelativePath of structure) {
    const filePath = joinPath(directory, fileRelativePath)
    // eslint-disable-next-line no-await-in-loop
    await mkdir(dirname(filePath))
    // eslint-disable-next-line no-await-in-loop
    await touchFile(filePath)
  }
}

async function readArchiveFiles(zipPath: string) {
  await expect(fileExists(zipPath)).resolves.toBeTruthy()
  // eslint-disable-next-line @babel/new-cap
  const archive = new StreamZip.async({file: zipPath})
  const archiveEntries = Object.keys(await archive.entries())
  await archive.close()

  return archiveEntries
}

async function createSettingsSchema(content: string, directory: string) {
  const settingsSchemaPath = joinPath(directory, 'config/settings_schema.json')
  await writeFile(settingsSchemaPath, content)
}
