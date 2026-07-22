import {addTrustedThemeEnvironment} from './writer.js'
import {loadThemeProjectTrust} from './config.js'
import {ThemeAirlockError} from './types.js'
import {configurationFileName} from '../../constants.js'
import {describe, expect, test, vi} from 'vitest'
import {chmod, inTemporaryDirectory, mkdir, readFile, readdir, symlink, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {rename as fsRename, lstat} from 'node:fs/promises'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {...actual, rename: vi.fn(actual.rename)}
})

async function createTheme(tmpDir: string): Promise<string> {
  const themePath = joinPath(tmpDir, 'theme')
  await mkdir(themePath)
  return themePath
}

async function writeConfiguration(directory: string, content: string): Promise<string> {
  const configurationPath = joinPath(directory, configurationFileName)
  await writeFile(configurationPath, content)
  return configurationPath
}

async function captureError(operation: () => Promise<unknown>): Promise<ThemeAirlockError | Error> {
  try {
    await operation()
  } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error('Expected operation to throw')
}

async function coordinateConcurrentRenames(): Promise<void> {
  const renameSpy = vi.mocked(fsRename)
  const {rename: originalRename} = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  let renameCount = 0
  let releaseSecondRename!: () => void
  const secondRename = new Promise<void>((resolve) => {
    releaseSecondRename = resolve
  })
  renameSpy.mockImplementation(async (...arguments_: Parameters<typeof fsRename>) => {
    renameCount += 1
    if (renameCount === 2) releaseSecondRename()
    if (renameCount === 1) {
      await Promise.race([secondRename, new Promise<void>((resolve) => setTimeout(resolve, 350))])
    }
    return originalRename(...arguments_)
  })
}

describe('addTrustedThemeEnvironment', () => {
  test('creates a new configuration in the theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
      ).resolves.toEqual({path: joinPath(themePath, configurationFileName), store: 'preview-store.myshopify.com'})

      await expect(readFile(joinPath(themePath, configurationFileName))).resolves.toContain(
        '[environments.preview]\nstore = "preview-store.myshopify.com"',
      )
    })
  })

  test('patches the nearest existing ancestor configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const projectPath = joinPath(tmpDir, 'project')
      const themePath = joinPath(projectPath, 'themes', 'dawn')
      await mkdir(themePath)
      const configurationPath = await writeConfiguration(projectPath, 'name = "project"\n')

      const result = await addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'})

      expect(result.path).toBe(configurationPath)
      await expect(readFile(configurationPath)).resolves.toContain('[environments.preview]')
      await expect(readdir(joinPath(themePath))).resolves.not.toContain(configurationFileName)
    })
  })

  test('patches an existing valid configuration without environments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const original = '# Keep this comment\nname = "theme"\n\n[other]\nvalue = true\n'
      const configurationPath = await writeConfiguration(tmpDir, original)

      await addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'})

      const updated = await readFile(configurationPath)
      expect(updated).toContain('# Keep this comment')
      expect(updated).toContain('name = "theme"')
      expect(updated).toContain('[other]\nvalue = true')
      expect(updated).toContain('[environments.preview]\nstore = "preview-store.myshopify.com"')
    })
  })

  test('preserves comments, unrelated keys, and ordering while patching', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const original = [
        '# Header',
        'name = "theme"',
        '',
        '[other]',
        'value = "before"',
        '',
        '# Existing environment',
        '[environments.default]',
        'store = "default-store"',
        '',
      ].join('\n')
      const configurationPath = await writeConfiguration(tmpDir, original)

      await addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'})

      const expected = [
        '# Header',
        'name = "theme"',
        '',
        '[other]',
        'value = "before"',
        '',
        '[environments]',
        'preview.store = "preview-store.myshopify.com"',
        '',
        '# Existing environment',
        '[environments.default]',
        'store = "default-store"',
        '',
      ].join('\n')

      await expect(readFile(configurationPath)).resolves.toBe(expected)

      const trust = await loadThemeProjectTrust(themePath)
      expect(trust).toMatchObject({
        state: 'configured',
        environments: [
          {name: 'preview', store: 'preview-store.myshopify.com'},
          {name: 'default', store: 'default-store.myshopify.com'},
        ],
      })
    })
  })

  test('normalizes the requested store', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(
        addTrustedThemeEnvironment({
          themePath,
          environment: 'preview',
          store: 'https://PREVIEW-STORE.myshopify.com/admin/',
        }),
      ).resolves.toMatchObject({store: 'preview-store.myshopify.com'})
    })
  })

  test('is idempotent for the same environment and normalized store without writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, '[environments.preview]\nstore = "preview-store"\n')
      const original = await readFile(configurationPath)
      const renameSpy = vi.mocked(fsRename)

      await expect(
        addTrustedThemeEnvironment({
          themePath,
          environment: 'preview',
          store: 'https://PREVIEW-STORE.myshopify.com/admin/',
        }),
      ).resolves.toEqual({path: configurationPath, store: 'preview-store.myshopify.com'})

      await expect(readFile(configurationPath)).resolves.toBe(original)
      expect(renameSpy).not.toHaveBeenCalled()
    })
  })

  test('rejects an environment name conflict without writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, '[environments.preview]\nstore = "other-store"\n')
      const original = await readFile(configurationPath)

      const error = await captureError(() =>
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
      )

      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('environment-conflict')
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test('rejects a normalized store conflict under another environment without writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, '[environments.default]\nstore = "shared-store"\n')
      const original = await readFile(configurationPath)

      const error = await captureError(() =>
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'https://SHARED-STORE.myshopify.com/'}),
      )

      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('store-conflict')
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test('rejects invalid requested stores contextually without writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, 'name = "theme"\n')
      const original = await readFile(configurationPath)

      const error = await captureError(() =>
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'not a store'}),
      )

      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('invalid-store')
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test('leaves malformed configuration unchanged', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const original = '[environments.preview\nstore = "broken"\n'
      const configurationPath = await writeConfiguration(tmpDir, original)

      await expect(
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
      ).rejects.toThrow(configurationPath)
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'rejects a read-only existing file',
    async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const themePath = await createTheme(tmpDir)
        const configurationPath = await writeConfiguration(tmpDir, 'name = "theme"\n')
        await chmod(configurationPath, 0o444)
        const original = await readFile(configurationPath)

        const error = await captureError(() =>
          addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
        )

        expect(error).toBeInstanceOf(ThemeAirlockError)
        expect((error as ThemeAirlockError).reason).toBe('permission-denied')
        await expect(readFile(configurationPath)).resolves.toBe(original)
      })
    },
  )

  test('serializes concurrent additions to preserve both environments', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      await coordinateConcurrentRenames()

      const results = await Promise.all([
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
        addTrustedThemeEnvironment({themePath, environment: 'production', store: 'production-store'}),
      ])

      expect(results).toHaveLength(2)
      await expect(loadThemeProjectTrust(themePath)).resolves.toMatchObject({
        state: 'configured',
        environments: expect.arrayContaining([
          {name: 'preview', store: 'preview-store.myshopify.com'},
          {name: 'production', store: 'production-store.myshopify.com'},
        ]),
      })
      await expect(readdir(themePath)).resolves.not.toContain(`${configurationFileName}.lock`)
    })
  })

  test.skipIf(process.platform === 'win32')(
    'serializes distinct symlinked configurations on their shared target',
    async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const firstThemePath = await createTheme(joinPath(tmpDir, 'first'))
        const secondThemePath = await createTheme(joinPath(tmpDir, 'second'))
        const targetPath = joinPath(tmpDir, 'shared', configurationFileName)
        await mkdir(joinPath(tmpDir, 'shared'))
        await writeFile(targetPath, 'name = "shared"\n')
        const firstConfigurationPath = joinPath(firstThemePath, configurationFileName)
        const secondConfigurationPath = joinPath(secondThemePath, configurationFileName)
        await symlink(targetPath, firstConfigurationPath)
        await symlink(targetPath, secondConfigurationPath)

        const results = await Promise.all([
          addTrustedThemeEnvironment({themePath: firstThemePath, environment: 'preview', store: 'preview-store'}),
          addTrustedThemeEnvironment({
            themePath: secondThemePath,
            environment: 'production',
            store: 'production-store',
          }),
        ])

        expect(results).toEqual([
          {path: firstConfigurationPath, store: 'preview-store.myshopify.com'},
          {path: secondConfigurationPath, store: 'production-store.myshopify.com'},
        ])
        expect((await lstat(firstConfigurationPath)).isSymbolicLink()).toBe(true)
        expect((await lstat(secondConfigurationPath)).isSymbolicLink()).toBe(true)
        const targetContent = await readFile(targetPath)
        expect(targetContent).toContain('preview-store.myshopify.com')
        expect(targetContent).toContain('production-store.myshopify.com')
        await expect(readdir(joinPath(tmpDir, 'shared'))).resolves.toEqual([configurationFileName])
        await expect(readdir(firstThemePath)).resolves.toEqual([configurationFileName])
        await expect(readdir(secondThemePath)).resolves.toEqual([configurationFileName])
      })
    },
  )

  test('revalidates a concurrent environment conflict under the lock', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, 'name = "theme"\n')
      await coordinateConcurrentRenames()

      const results = await Promise.allSettled([
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'first-store'}),
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'second-store'}),
      ])

      expect(results.filter(({status}) => status === 'fulfilled')).toHaveLength(1)
      const rejected = results.filter(({status}) => status === 'rejected')
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({reason: 'environment-conflict'})
      await expect(readFile(configurationPath)).resolves.toMatch(/store = "(?:first|second)-store\.myshopify\.com"/)
      await expect(readdir(tmpDir)).resolves.not.toContain(`${configurationFileName}.lock`)
    })
  })

  test('cleans up the temporary sibling and preserves the original on native rename failure', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(tmpDir, 'name = "theme"\n')
      const original = await readFile(configurationPath)
      vi.mocked(fsRename).mockRejectedValueOnce(new Error('injected rename failure'))

      await expect(
        addTrustedThemeEnvironment({themePath, environment: 'preview', store: 'preview-store'}),
      ).rejects.toThrow('injected rename failure')

      await expect(readFile(configurationPath)).resolves.toBe(original)
      const entries = await readdir(tmpDir)
      expect(
        entries.filter((entry) => entry.startsWith(`${configurationFileName}.`) && entry.endsWith('.tmp')),
      ).toEqual([])
    })
  })
})
