import {loadThemeProjectTrust} from './config.js'
import {ThemeAirlockError} from './types.js'
import {configurationFileName} from '../../constants.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'

async function writeConfiguration(directory: string, content: string): Promise<string> {
  await mkdir(directory)
  const configurationPath = joinPath(directory, configurationFileName)
  await writeFile(configurationPath, content)
  return configurationPath
}

async function captureError(operation: () => Promise<unknown>): Promise<Error> {
  try {
    await operation()
  } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error('Expected operation to throw')
}

describe('loadThemeProjectTrust', () => {
  test('returns unconfigured when no configuration file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({state: 'unconfigured', themePath})
    })
  })

  test('returns unconfigured with the discovered path when the file has no environments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const configurationPath = await writeConfiguration(tmpDir, 'name = "theme-project"\n')
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({
        state: 'unconfigured',
        path: configurationPath,
        themePath,
      })
    })
  })

  test.each(['environments = "preview"\n', 'environments = []\n'])(
    'returns unconfigured when environments is not an object: %s',
    async (content) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const themePath = joinPath(tmpDir, 'theme')
        const configurationPath = await writeConfiguration(tmpDir, content)
        await mkdir(themePath)

        await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({
          state: 'unconfigured',
          path: configurationPath,
          themePath,
        })
      })
    },
  )

  test('uses the nearest ancestor configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const projectPath = joinPath(tmpDir, 'project')
      const themePath = joinPath(projectPath, 'themes', 'dawn')
      await writeConfiguration(tmpDir, '[environments.default]\nstore = "root-store"\n')
      const configurationPath = await writeConfiguration(
        projectPath,
        '[environments.default]\nstore = "project-store"\n',
      )
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({
        state: 'configured',
        path: configurationPath,
        themePath,
        environments: [{name: 'default', store: 'project-store.myshopify.com'}],
      })
    })
  })

  test('ignores configuration files in sibling directories', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      await writeConfiguration(joinPath(tmpDir, 'sibling'), '[environments.default]\nstore = "sibling-store"\n')
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({state: 'unconfigured', themePath})
    })
  })

  test('normalizes default and named stores in TOML iteration order', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const configurationPath = await writeConfiguration(
        tmpDir,
        [
          '[environments.default]',
          'store = "default-store"',
          '',
          '[environments.preview]',
          'store = "https://Named-Store.myshopify.com/admin/"',
          '',
        ].join('\n'),
      )
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({
        state: 'configured',
        path: configurationPath,
        themePath,
        environments: [
          {name: 'default', store: 'default-store.myshopify.com'},
          {name: 'preview', store: 'named-store.myshopify.com'},
        ],
      })
    })
  })

  test('does not trust environment entries without stores', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const configurationPath = await writeConfiguration(
        tmpDir,
        '[environments.default]\ntheme = "123456789"\n\n[environments.preview]\npassword = "secret"\n',
      )
      await mkdir(themePath)

      await expect(loadThemeProjectTrust(themePath)).resolves.toEqual({
        state: 'unconfigured',
        path: configurationPath,
        themePath,
      })
    })
  })

  test('throws for a non-string store without modifying the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const originalContent = '[environments.production]\nstore = 123\n'
      const configurationPath = await writeConfiguration(tmpDir, originalContent)
      await mkdir(themePath)

      const error = await captureError(() => loadThemeProjectTrust(themePath))

      expect(error).toBeInstanceOf(ThemeAirlockError)
      if (!(error instanceof ThemeAirlockError)) throw error
      expect(error.reason).toBe('malformed-configuration')
      expect(error.targets).toEqual([])
      expect(error.tryMessage).toBe('No files were uploaded.')
      expect(error.message).toContain(configurationPath)
      expect(error.message).toContain('production')
      await expect(readFile(configurationPath)).resolves.toBe(originalContent)
    })
  })

  test('throws for an invalid string store without modifying the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const originalContent = '[environments.preview]\nstore = ""\n'
      const configurationPath = await writeConfiguration(tmpDir, originalContent)
      await mkdir(themePath)

      const error = await captureError(() => loadThemeProjectTrust(themePath))

      expect(error).toBeInstanceOf(ThemeAirlockError)
      if (!(error instanceof ThemeAirlockError)) throw error
      expect(error.reason).toBe('malformed-configuration')
      expect(error.targets).toEqual([])
      expect(error.tryMessage).toBe('No files were uploaded.')
      expect(error.message).toContain(configurationPath)
      expect(error.message).toContain('preview')
      await expect(readFile(configurationPath)).resolves.toBe(originalContent)
    })
  })

  test('throws when two environment names normalize to the same store without modifying the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const originalContent = [
        '[environments.default]',
        'store = "shared-store"',
        '',
        '[environments.production]',
        'store = "shared-store.myshopify.com"',
        '',
      ].join('\n')
      const configurationPath = await writeConfiguration(tmpDir, originalContent)
      await mkdir(themePath)

      const error = await captureError(() => loadThemeProjectTrust(themePath))

      expect(error).toBeInstanceOf(ThemeAirlockError)
      if (!(error instanceof ThemeAirlockError)) throw error
      expect(error.reason).toBe('ambiguous-configuration')
      expect(error.targets).toEqual([])
      expect(error.tryMessage).toBe('No files were uploaded.')
      expect(error.message).toContain(configurationPath)
      expect(error.message).toContain('default')
      expect(error.message).toContain('production')
      expect(error.message).toContain('shared-store.myshopify.com')
      await expect(readFile(configurationPath)).resolves.toBe(originalContent)
    })
  })

  test('reports malformed TOML with its exact path without modifying the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = joinPath(tmpDir, 'theme')
      const originalContent = '[environments.default\nstore = "broken"\n'
      const configurationPath = await writeConfiguration(tmpDir, originalContent)
      await mkdir(themePath)

      const error = await captureError(() => loadThemeProjectTrust(themePath))

      expect(error).toBeInstanceOf(TomlFileError)
      if (!(error instanceof TomlFileError)) throw error
      expect(error.path).toBe(configurationPath)
      expect(error.message).toContain(configurationPath)
      await expect(readFile(configurationPath)).resolves.toBe(originalContent)
    })
  })
})
