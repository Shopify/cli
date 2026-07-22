import Add from './add.js'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {Config} from '@oclif/core'
import {authAliasFlag} from '@shopify/cli-kit/node/cli'
import {fileExistsSync, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})
const session = {token: 'test-token', storeFqdn: 'trusted-store.myshopify.com'}
const configurationFileName = 'shopify.theme.toml'

async function runCommand(argv: string[]) {
  await CommandConfig.load()
  const command = new Add(argv, CommandConfig)
  return command.run()
}

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

describe('theme airlock add', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  })

  test('rejects a missing store argument without authenticating or writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(runCommand(['--path', themePath, '--environment', 'preview'])).rejects.toThrow()

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('rejects a missing environment flag without authenticating or writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(runCommand(['trusted-store', '--path', themePath])).rejects.toThrow()

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('rejects an empty environment before authenticating or writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(runCommand(['trusted-store', '--path', themePath, '--environment', '  \t'])).rejects.toMatchObject({
        reason: 'invalid-environment',
        message: expect.stringContaining("Environment name to add can't be empty"),
      })

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('normalizes the store before authentication and writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await runCommand([
        'https://TRUSTED-STORE.myshopify.com/admin/',
        '--path',
        themePath,
        '--environment',
        ' preview ',
      ])

      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('trusted-store.myshopify.com', undefined)
      await expect(readFile(joinPath(themePath, configurationFileName))).resolves.toContain(
        '[environments.preview]\nstore = "trusted-store.myshopify.com"',
      )
    })
  })

  test('authenticates before creating a new configuration file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = joinPath(themePath, configurationFileName)
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async () => {
        expect(fileExistsSync(configurationPath)).toBe(false)
        return session
      })

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      expect(fileExistsSync(configurationPath)).toBe(true)
    })
  })

  test('passes the password to authentication exactly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await runCommand([
        'trusted-store',
        '--path',
        themePath,
        '--environment',
        'preview',
        '--password',
        'shptka_secret',
      ])

      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('trusted-store.myshopify.com', 'shptka_secret')
    })
  })

  test('does not create a file when authentication fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      vi.mocked(ensureAuthenticatedThemes).mockRejectedValue(new Error('authentication failed'))

      await expect(runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])).rejects.toThrow(
        'authentication failed',
      )

      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('preserves an existing file byte-for-byte when authentication fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const original = '# Existing trust\nname = "theme"\n'
      const configurationPath = await writeConfiguration(themePath, original)
      vi.mocked(ensureAuthenticatedThemes).mockRejectedValue(new Error('authentication failed'))

      await expect(runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])).rejects.toThrow(
        'authentication failed',
      )

      await expect(readFile(configurationPath)).resolves.toBe(original)
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('creates a new trust configuration after authentication', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      await expect(readFile(joinPath(themePath, configurationFileName))).resolves.toContain(
        '[environments.preview]\nstore = "trusted-store.myshopify.com"',
      )
      expect(renderSuccess).toHaveBeenCalledOnce()
    })
  })

  test('preserves comments and unrelated keys when patching an existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(
        tmpDir,
        '# Keep this comment\nname = "theme"\n\n[other]\nvalue = true\n',
      )

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      const updated = await readFile(configurationPath)
      expect(updated).toContain('# Keep this comment')
      expect(updated).toContain('name = "theme"')
      expect(updated).toContain('[other]\nvalue = true')
      expect(updated).toContain('[environments.preview]\nstore = "trusted-store.myshopify.com"')
    })
  })

  test('is idempotent for the same environment and store after authentication', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(
        themePath,
        '[environments.preview]\nstore = "trusted-store.myshopify.com"\n',
      )
      const original = await readFile(configurationPath)

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test('propagates an environment conflict after authentication without changing bytes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(
        themePath,
        '[environments.preview]\nstore = "other-store.myshopify.com"\n',
      )
      const original = await readFile(configurationPath)

      await expect(
        runCommand(['trusted-store', '--path', themePath, '--environment', 'preview']),
      ).rejects.toMatchObject({reason: 'environment-conflict'})

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      await expect(readFile(configurationPath)).resolves.toBe(original)
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('propagates a normalized store conflict after authentication without changing bytes', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = await writeConfiguration(
        themePath,
        '[environments.default]\nstore = "trusted-store.myshopify.com"\n',
      )
      const original = await readFile(configurationPath)

      await expect(
        runCommand(['https://TRUSTED-STORE.myshopify.com/', '--path', themePath, '--environment', 'preview']),
      ).rejects.toMatchObject({reason: 'store-conflict'})

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      await expect(readFile(configurationPath)).resolves.toBe(original)
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  })

  test('uses the effective path and nearest existing configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const projectPath = joinPath(tmpDir, 'project')
      const themePath = joinPath(projectPath, 'themes', 'dawn')
      await mkdir(themePath)
      const configurationPath = await writeConfiguration(projectPath, 'name = "project"\n')

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      await expect(readFile(configurationPath)).resolves.toContain('[environments.preview]')
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('renders normalized store, environment, and configuration path after writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = joinPath(themePath, configurationFileName)

      await runCommand(['https://TRUSTED-STORE.myshopify.com/', '--path', themePath, '--environment', ' preview '])

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Store added to Theme Airlock.',
        body: expect.arrayContaining([
          expect.stringContaining('preview'),
          expect.stringContaining('trusted-store.myshopify.com'),
          expect.stringContaining(configurationPath),
        ]),
      })
    })
  })

  test('exposes the standard auth-alias base flag', () => {
    expect(Add.baseFlags).toBe(authAliasFlag)
  })

  test('does not declare bypass, force, or yes flags', () => {
    expect(Add.flags).not.toHaveProperty('bypass')
    expect(Add.flags).not.toHaveProperty('force')
    expect(Add.flags).not.toHaveProperty('yes')
  })

  test('does not import or call global store utilities', async () => {
    const source = await readFile(joinPath(__dirname, 'add.ts'))

    expect(source).not.toMatch(/ensureThemeStore|getThemeStore|setThemeStore/)
    expect(source).not.toMatch(/node\/store/)
  })
})
