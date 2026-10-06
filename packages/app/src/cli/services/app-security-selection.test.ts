import {
  clientIdSource,
  effectiveClientId,
  mergeScanDirectories,
  resolveAppDirectory,
  resolveAppSecuritySelection,
  resolveIncludeDirectories,
  resultsKey,
  selectedConfigFileName,
  type AppSecuritySelection,
  type AppSecuritySelectionDependencies,
} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {appCreationDefaults} from './app/config/link.js'
import {appFromIdentifiers, fetchOrCreateOrganizationApp} from './context.js'
import use from './app/config/use.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {symlink} from 'node:fs/promises'
import type {OrganizationApp} from '../models/organization.js'

vi.mock('./local-storage.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./local-storage.js')>()),
  getCachedAppInfo: vi.fn(),
  setCachedAppInfo: vi.fn(),
}))
vi.mock('./app/config/use.js', () => ({default: vi.fn()}))
vi.mock('./context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./context.js')>()),
  appFromIdentifiers: vi.fn(),
  fetchOrCreateOrganizationApp: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConfirmationPrompt: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function writeConfiguration(directory: string, clientId: string, name = 'shopify.app.toml'): Promise<void> {
  await writeFile(joinPath(directory, name), validAppConfiguration(clientId))
}

function promptDependencies(overrides: Partial<AppSecuritySelectionDependencies> = {}) {
  return {
    confirmScanWithoutAppConfig: vi.fn(async (_directory: string) => true),
    pickClientId: vi.fn(async (_appDirectory: string) => 'picked-client-id'),
    pickConfigFile: vi.fn(async (_appDirectory: string) => 'shopify.app.staging.toml'),
    lookUpApp: vi.fn(async (_clientId: string) => {}),
    ...overrides,
  }
}

async function selectionError(promise: Promise<AppSecuritySelection>): Promise<AbortError> {
  const error: unknown = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

describe('resolveAppSecuritySelection with an app configuration', () => {
  test('selects the default TOML', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      const appDirectory = await fileRealPath(directory)

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: false})

      expect(selection).toEqual({
        kind: 'config',
        appDirectory,
        appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
        appConfigDirectories: [],
        configClientId: 'default-client-id',
        clientIdOverride: undefined,
      })
    })
  })

  test('walks up from a subdirectory to the directory holding the TOML', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      const subdirectory = joinPath(directory, 'app', 'routes')
      await mkdir(subdirectory)

      const selection = await resolveAppSecuritySelection({path: subdirectory, allowPrompts: false})

      expect(selection).toMatchObject({kind: 'config', appDirectory: await fileRealPath(directory)})
    })
  })

  test('aborts when --path does not exist instead of walking up to the app above it', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      const missing = joinPath(directory, 'missing-app')

      const error = await selectionError(resolveAppSecuritySelection({path: missing, allowPrompts: false}))

      expect(error.message).toBe(`--path ${missing}: not a directory.`)
    })
  })

  test('roots the TOML path on the real app directory when --path goes through a symbolic link', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'real-app')
      await mkdir(appDirectory)
      await writeConfiguration(appDirectory, 'default-client-id')
      const link = joinPath(directory, 'linked-app')
      await symlink(appDirectory, link, 'dir')
      const realAppDirectory = await fileRealPath(appDirectory)

      const selection = await resolveAppSecuritySelection({path: link, allowPrompts: false})

      expect(selection).toMatchObject({
        appDirectory: realAppDirectory,
        appConfigFilePath: joinPath(realAppDirectory, 'shopify.app.toml'),
      })
    })
  })

  test('selects the TOML named by --config', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      await writeConfiguration(directory, 'staging-client-id', 'shopify.app.staging.toml')

      const selection = await resolveAppSecuritySelection({path: directory, config: 'staging', allowPrompts: false})

      expect(selection).toMatchObject({
        kind: 'config',
        appConfigFilePath: joinPath(await fileRealPath(directory), 'shopify.app.staging.toml'),
        configClientId: 'staging-client-id',
      })
    })
  })

  test('selects the TOML cached by `app config use`', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      await writeConfiguration(directory, 'production-client-id', 'shopify.app.production.toml')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.production.toml'})

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: false})

      expect(selection).toMatchObject({
        kind: 'config',
        appConfigFilePath: joinPath(await fileRealPath(directory), 'shopify.app.production.toml'),
        configClientId: 'production-client-id',
      })
    })
  })

  test('keeps the TOML and records --client-id as an override of the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')

      const selection = await resolveAppSecuritySelection({
        path: directory,
        clientId: 'flag-client-id',
        allowPrompts: false,
      })

      expect(selection).toMatchObject({
        kind: 'config',
        configClientId: 'toml-client-id',
        clientIdOverride: 'flag-client-id',
      })
      expect(effectiveClientId(selection)).toBe('flag-client-id')
      expect(clientIdSource(selection)).toBe('flag')
    })
  })

  test('reports a TOML with an empty client ID as not linked', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, '')

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: false})

      expect(selection).toMatchObject({kind: 'config', configClientId: undefined})
      expect(effectiveClientId(selection)).toBeUndefined()
      expect(clientIdSource(selection)).toBeUndefined()
    })
  })

  test('aborts on an invalid TOML without offering to scan without app configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = [')
      const dependencies = promptDependencies()

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies),
      )

      expect(error.message).not.toContain('No app configuration found')
      expect(dependencies.confirmScanWithoutAppConfig).not.toHaveBeenCalled()
    })
  })

  test('aborts when --config names a TOML that does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      const dependencies = promptDependencies()

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, config: 'missing', allowPrompts: false}, dependencies),
      )

      expect(error.message).not.toContain('No app configuration found')
      expect(dependencies.confirmScanWithoutAppConfig).not.toHaveBeenCalled()
    })
  })
})

describe('resolveAppSecuritySelection with several TOMLs and none selected', () => {
  async function writeProductionAndStaging(directory: string): Promise<void> {
    await writeConfiguration(directory, 'production-client-id', 'shopify.app.production.toml')
    await writeConfiguration(directory, 'staging-client-id', 'shopify.app.staging.toml')
  }

  test('asks which TOML to scan, without saving the answer', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies)

      expect(selection).toMatchObject({
        kind: 'config',
        appConfigFilePath: joinPath(await fileRealPath(directory), 'shopify.app.staging.toml'),
        configClientId: 'staging-client-id',
        appConfigFilePicked: true,
      })
      expect(dependencies.pickConfigFile).toHaveBeenCalledOnce()
      expect(setCachedAppInfo).not.toHaveBeenCalled()
    })
  })

  test('asks when the `app config use` choice no longer exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.deleted.toml'})
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies)

      expect(selection).toMatchObject({configClientId: 'staging-client-id', appConfigFilePicked: true})
      expect(setCachedAppInfo).not.toHaveBeenCalled()
    })
  })

  test('scans shopify.app.toml without asking or saving a choice when the `app config use` choice no longer exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      await writeConfiguration(directory, 'default-client-id')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.deleted.toml'})
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies)

      expect(selection).toMatchObject({configClientId: 'default-client-id', appConfigFilePicked: false})
      expect(dependencies.pickConfigFile).not.toHaveBeenCalled()
      expect(use).not.toHaveBeenCalled()
      expect(setCachedAppInfo).not.toHaveBeenCalled()
    })
  })

  test('scans shopify.app.toml without asking when it exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      await writeConfiguration(directory, 'default-client-id')
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies)

      expect(selection).toMatchObject({configClientId: 'default-client-id', appConfigFilePicked: undefined})
      expect(dependencies.pickConfigFile).not.toHaveBeenCalled()
    })
  })

  test('scans the only TOML without asking', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'staging-client-id', 'shopify.app.staging.toml')
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: false}, dependencies)

      expect(selection).toMatchObject({configClientId: 'staging-client-id', appConfigFilePicked: false})
      expect(dependencies.pickConfigFile).not.toHaveBeenCalled()
    })
  })

  test('aborts with the TOMLs to choose from when it cannot ask', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      const dependencies = promptDependencies()

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, allowPrompts: false}, dependencies),
      )

      expect(error.message).toBe(`2 app configurations found in ${directory}, and none is selected.`)
      expect(error.tryMessage).toBe('Pass `--config` with one of: production, staging.')
      expect(dependencies.pickConfigFile).not.toHaveBeenCalled()
    })
  })

  test('aborts instead of asking with --client-id, which --config cannot repeat', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeProductionAndStaging(directory)
      const dependencies = promptDependencies()

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, clientId: 'flag-client-id', allowPrompts: true}, dependencies),
      )

      expect(error.tryMessage).toBe(
        "`--client-id` can't be combined with `--config`, so first select one with `shopify app config use <config>`: production, staging.",
      )
      expect(dependencies.pickConfigFile).not.toHaveBeenCalled()
    })
  })
})

/** A TOML whose `extension_directories` and `web_directories` come first, since top-level keys must precede tables. */
async function writeConfigurationWithDirectories(
  appDirectory: string,
  directories: {extension_directories?: string[]; web_directories?: string[]},
  name = 'shopify.app.toml',
): Promise<void> {
  const keys = Object.entries(directories).map(([key, entries]) => `${key} = ${JSON.stringify(entries)}\n`)
  await mkdir(appDirectory)
  await writeFile(joinPath(appDirectory, name), `${keys.join('')}${validAppConfiguration()}`)
}

/** A theme extension named after its directory, since extension handles must be unique. */
async function writeThemeExtension(directory: string): Promise<void> {
  await mkdir(directory)
  await writeFile(joinPath(directory, 'shopify.extension.toml'), `name = "${basename(directory)}"\ntype = "theme"\n`)
}

async function writeBackendWeb(directory: string): Promise<void> {
  await mkdir(directory)
  await writeFile(
    joinPath(directory, 'shopify.web.toml'),
    'name = "backend"\nroles = ["backend"]\n\n[commands]\ndev = "dev"\n',
  )
}

describe('resolveAppSecuritySelection app configuration directories', () => {
  test('are the directories of the extension and web TOMLs that relative entries match outside the app directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await writeConfigurationWithDirectories(appDirectory, {
        extension_directories: ['extensions/*', '../shared/*', '../no-extensions/*'],
        web_directories: ['../backend'],
      })
      await writeThemeExtension(joinPath(appDirectory, 'extensions', 'inside'))
      await writeThemeExtension(joinPath(directory, 'shared', 'theme'))
      await writeFile(joinPath(directory, 'shared', 'README.md'), 'Shared extensions\n')
      await mkdir(joinPath(directory, 'no-extensions', 'empty'))
      await writeBackendWeb(joinPath(directory, 'backend'))

      const selection = await resolveAppSecuritySelection({path: appDirectory, allowPrompts: false})

      expect(selection).toMatchObject({
        appConfigDirectories: [
          await fileRealPath(joinPath(directory, 'backend')),
          await fileRealPath(joinPath(directory, 'shared', 'theme')),
        ],
      })
    })
  })

  test('ignore absolute entries, the way the CLI does', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await writeConfigurationWithDirectories(appDirectory, {
        extension_directories: [joinPath(directory, 'shared', '*')],
        web_directories: [joinPath(directory, 'backend')],
      })
      await writeThemeExtension(joinPath(directory, 'shared', 'theme'))
      await writeBackendWeb(joinPath(directory, 'backend'))

      const selection = await resolveAppSecuritySelection({path: appDirectory, allowPrompts: false})

      expect(selection).toMatchObject({appConfigDirectories: []})
    })
  })

  test('leave out a directory reached through a symbolic link outside the app directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await writeConfigurationWithDirectories(appDirectory, {extension_directories: ['../linked-shared/*']})
      await writeThemeExtension(joinPath(directory, 'shared', 'theme'))
      await symlink(joinPath(directory, 'shared'), joinPath(directory, 'linked-shared'), 'dir')

      const selection = await resolveAppSecuritySelection({path: appDirectory, allowPrompts: false})

      expect(selection).toMatchObject({appConfigDirectories: []})
    })
  })

  test('leave out an extension directory inside the app directory that links outside it', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await writeConfigurationWithDirectories(appDirectory, {extension_directories: ['extensions/*']})
      await writeThemeExtension(joinPath(directory, 'shared', 'theme'))
      await mkdir(joinPath(appDirectory, 'extensions'))
      await symlink(joinPath(directory, 'shared', 'theme'), joinPath(appDirectory, 'extensions', 'theme'), 'dir')

      const selection = await resolveAppSecuritySelection({path: appDirectory, allowPrompts: false})

      expect(selection).toMatchObject({appConfigDirectories: []})
    })
  })

  test('come from the selected TOML only', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await writeConfigurationWithDirectories(appDirectory, {})
      await writeFile(
        joinPath(appDirectory, 'shopify.app.staging.toml'),
        `extension_directories = ["../shared/*"]\n${validAppConfiguration('staging-client-id')}`,
      )
      await writeThemeExtension(joinPath(directory, 'shared', 'theme'))

      const defaultSelection = await resolveAppSecuritySelection({path: appDirectory, allowPrompts: false})
      const stagingSelection = await resolveAppSecuritySelection({
        path: appDirectory,
        config: 'staging',
        allowPrompts: false,
      })

      expect(defaultSelection).toMatchObject({appConfigDirectories: []})
      expect(stagingSelection).toMatchObject({
        appConfigDirectories: [await fileRealPath(joinPath(directory, 'shared', 'theme'))],
      })
    })
  })
})

describe('resolveAppSecuritySelection with --without-app-config', () => {
  test('aborts without --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, withoutAppConfig: true, allowPrompts: false}),
      )

      expect(error.message).toBe('--without-app-config requires --client-id.')
    })
  })

  test('scans the real path of --path inside an app without walking up or reading its TOML', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = [')
      const subdirectory = joinPath(directory, 'packages', 'worker')
      await mkdir(subdirectory)

      const selection = await resolveAppSecuritySelection({
        path: subdirectory,
        clientId: 'flag-client-id',
        withoutAppConfig: true,
        allowPrompts: false,
      })

      expect(selection).toEqual({
        kind: 'no-config',
        appDirectory: await fileRealPath(subdirectory),
        clientId: 'flag-client-id',
        clientIdSource: 'flag',
      })
      expect(selectedConfigFileName(selection)).toBeUndefined()
    })
  })

  test('scans a directory outside any app', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await resolveAppSecuritySelection({
        path: directory,
        clientId: 'flag-client-id',
        withoutAppConfig: true,
        allowPrompts: true,
      })

      expect(selection).toEqual({
        kind: 'no-config',
        appDirectory: await fileRealPath(directory),
        clientId: 'flag-client-id',
        clientIdSource: 'flag',
      })
    })
  })

  test('uses the real path when --path is a symbolic link to a directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const target = joinPath(directory, 'target')
      await mkdir(target)
      const link = joinPath(directory, 'link')
      await symlink(target, link, 'dir')

      const selection = await resolveAppSecuritySelection({
        path: link,
        clientId: 'flag-client-id',
        withoutAppConfig: true,
        allowPrompts: false,
      })

      expect(selection.appDirectory).toBe(await fileRealPath(target))
    })
  })

  test('aborts when --path is a file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const file = joinPath(directory, 'file.txt')
      await writeFile(file, 'text')

      const error = await selectionError(
        resolveAppSecuritySelection({path: file, clientId: 'abc', withoutAppConfig: true, allowPrompts: false}),
      )

      expect(error.message).toBe(`--path ${file}: not a directory.`)
    })
  })

  test('aborts when --path does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const missing = joinPath(directory, 'missing')

      const error = await selectionError(
        resolveAppSecuritySelection({path: missing, clientId: 'abc', withoutAppConfig: true, allowPrompts: false}),
      )

      expect(error.message).toBe(`--path ${missing}: not a directory.`)
    })
  })
})

describe('resolveAppSecuritySelection when no TOML is found', () => {
  test('aborts with the next step when prompts are not allowed', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies()

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, allowPrompts: false}, dependencies),
      )

      expect(error.message).toBe(`No app configuration found at or above ${directory}.`)
      expect(error.tryMessage).toBe(
        'Pass `--path` to your app directory, or scan without app configuration with `--without-app-config --client-id <client-id>`.',
      )
      expect(dependencies.confirmScanWithoutAppConfig).not.toHaveBeenCalled()
    })
  })

  test('aborts with the same error when the prompt is answered no', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies({confirmScanWithoutAppConfig: vi.fn(async () => false)})

      const error = await selectionError(
        resolveAppSecuritySelection({path: directory, clientId: 'abc', allowPrompts: true}, dependencies),
      )

      expect(error.message).toBe(`No app configuration found at or above ${directory}.`)
      expect(dependencies.confirmScanWithoutAppConfig).toHaveBeenCalledWith(directory)
      expect(dependencies.pickClientId).not.toHaveBeenCalled()
    })
  })

  test('scans without app configuration with the --client-id flag when the prompt is answered yes', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection(
        {path: directory, clientId: 'flag-client-id', allowPrompts: true},
        dependencies,
      )

      expect(selection).toEqual({
        kind: 'no-config',
        appDirectory: await fileRealPath(directory),
        clientId: 'flag-client-id',
        clientIdSource: 'flag',
      })
      expect(dependencies.pickClientId).not.toHaveBeenCalled()
    })
  })

  test('takes the client ID from the picker when the prompt is answered yes without --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true}, dependencies)

      expect(selection).toEqual({
        kind: 'no-config',
        appDirectory: await fileRealPath(directory),
        clientId: 'picked-client-id',
        clientIdSource: 'picker',
      })
      expect(dependencies.pickClientId).toHaveBeenCalledWith(await fileRealPath(directory))
    })
  })

  test('asks the no-TOML question and picks the app with the link command defaults', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({apiKey: 'created-client-id'} as OrganizationApp)

      const selection = await resolveAppSecuritySelection({path: directory, allowPrompts: true})

      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message: `No app configuration found at or above ${directory}. Scan it without app configuration? Config checks will be skipped.`,
        confirmationMessage: 'Yes, scan without app configuration',
        cancellationMessage: 'No',
        defaultValue: false,
      })
      expect(fetchOrCreateOrganizationApp).toHaveBeenCalledWith(appCreationDefaults(await fileRealPath(directory)))
      expect(selection).toMatchObject({kind: 'no-config', clientId: 'created-client-id', clientIdSource: 'picker'})
    })
  })
})

describe('resolveAppSecuritySelection with validateClientIdFlag', () => {
  const unknownClientId = new AbortError('No app with client ID unknown-client-id found')

  test('looks up --client-id when it overrides a TOML, not the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection(
        {path: directory, clientId: 'flag-client-id', allowPrompts: false, validateClientIdFlag: true},
        dependencies,
      )

      expect(dependencies.lookUpApp).toHaveBeenCalledOnce()
      expect(dependencies.lookUpApp).toHaveBeenCalledWith('flag-client-id')
      expect(selection).toMatchObject({kind: 'config', clientIdOverride: 'flag-client-id'})
    })
  })

  test('looks up --client-id with --without-app-config', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies({
        lookUpApp: vi.fn(async () => {
          throw unknownClientId
        }),
      })

      const error = await selectionError(
        resolveAppSecuritySelection(
          {
            path: directory,
            clientId: 'unknown-client-id',
            withoutAppConfig: true,
            allowPrompts: false,
            validateClientIdFlag: true,
          },
          dependencies,
        ),
      )

      expect(error).toBe(unknownClientId)
      expect(dependencies.lookUpApp).toHaveBeenCalledWith('unknown-client-id')
    })
  })

  test('looks up --client-id before the no-TOML prompt, which an unknown client ID never reaches', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies({
        lookUpApp: vi.fn(async () => {
          throw unknownClientId
        }),
      })

      const error = await selectionError(
        resolveAppSecuritySelection(
          {path: directory, clientId: 'unknown-client-id', allowPrompts: true, validateClientIdFlag: true},
          dependencies,
        ),
      )

      expect(error).toBe(unknownClientId)
      expect(dependencies.confirmScanWithoutAppConfig).not.toHaveBeenCalled()
      expect(dependencies.pickClientId).not.toHaveBeenCalled()
    })
  })

  test('looks up an empty --client-id, because it was passed', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')
      const dependencies = promptDependencies({
        lookUpApp: vi.fn(async () => {
          throw unknownClientId
        }),
      })

      const error = await selectionError(
        resolveAppSecuritySelection(
          {path: directory, clientId: '', allowPrompts: false, validateClientIdFlag: true},
          dependencies,
        ),
      )

      expect(error).toBe(unknownClientId)
      expect(dependencies.lookUpApp).toHaveBeenCalledWith('')
    })
  })

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')
      const dependencies = promptDependencies()

      await resolveAppSecuritySelection(
        {path: directory, allowPrompts: false, validateClientIdFlag: true},
        dependencies,
      )

      expect(dependencies.lookUpApp).not.toHaveBeenCalled()
    })
  })

  test('does not look up the client ID from the picker', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = promptDependencies()

      const selection = await resolveAppSecuritySelection(
        {path: directory, allowPrompts: true, validateClientIdFlag: true},
        dependencies,
      )

      expect(selection).toMatchObject({clientId: 'picked-client-id', clientIdSource: 'picker'})
      expect(dependencies.lookUpApp).not.toHaveBeenCalled()
    })
  })

  test('does not look up --client-id unless asked to', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')
      const dependencies = promptDependencies()

      await resolveAppSecuritySelection(
        {path: directory, clientId: 'flag-client-id', allowPrompts: false},
        dependencies,
      )
      await resolveAppSecuritySelection(
        {path: directory, clientId: 'flag-client-id', withoutAppConfig: true, allowPrompts: false},
        dependencies,
      )

      expect(dependencies.lookUpApp).not.toHaveBeenCalled()
    })
  })

  test('looks up the app by its client ID in the API by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'toml-client-id')
      vi.mocked(appFromIdentifiers).mockRejectedValue(unknownClientId)

      const error = await selectionError(
        resolveAppSecuritySelection({
          path: directory,
          clientId: 'unknown-client-id',
          allowPrompts: false,
          validateClientIdFlag: true,
        }),
      )

      expect(error).toBe(unknownClientId)
      expect(appFromIdentifiers).toHaveBeenCalledWith({apiKey: 'unknown-client-id'})
    })
  })
})

describe('selection helpers', () => {
  test('shows the client ID of a no-config selection', () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory: '/app',
      clientId: 'abc',
      clientIdSource: 'picker',
    }

    expect(effectiveClientId(selection)).toBe('abc')
    expect(clientIdSource(selection)).toBe('picker')
  })

  test('falls back to the TOML client ID when there is no override', () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory: '/app',
      appConfigFilePath: '/app/shopify.app.staging.toml',
      configClientId: 'toml-id',
    }

    expect(effectiveClientId(selection)).toBe('toml-id')
    expect(clientIdSource(selection)).toBe('config')
    expect(selectedConfigFileName(selection)).toBe('shopify.app.staging.toml')
  })
})

describe('resultsKey', () => {
  test.each([
    ['/app/shopify.app.toml', 'shopify.app'],
    ['/app/shopify.app.production.toml', 'shopify.app.production'],
  ])('uses the name of %s without .toml', (appConfigFilePath, expectedKey) => {
    const selection: AppSecuritySelection = {kind: 'config', appDirectory: '/app', appConfigFilePath}

    expect(resultsKey(selection)).toBe(expectedKey)
  })

  test('never uses the client ID of the TOML', () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory: '/app',
      appConfigFilePath: '/app/shopify.app.toml',
      configClientId: 'toml-id',
    }

    expect(resultsKey(selection)).toBe('shopify.app')
  })

  test('uses the --client-id override of a selected TOML', () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory: '/app',
      appConfigFilePath: '/app/shopify.app.production.toml',
      configClientId: 'toml-id',
      clientIdOverride: 'override-id',
    }

    expect(resultsKey(selection)).toBe('override-id')
  })

  test('uses the client ID without app configuration, whether it came from the flag or the picker', () => {
    expect(resultsKey({kind: 'no-config', appDirectory: '/app', clientId: 'flag-id', clientIdSource: 'flag'})).toBe(
      'flag-id',
    )
    expect(resultsKey({kind: 'no-config', appDirectory: '/app', clientId: 'picked-id', clientIdSource: 'picker'})).toBe(
      'picked-id',
    )
  })
})

describe('resolveAppDirectory', () => {
  test('finds the app directory of the selected TOML without needing a client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'client-id-1')
      const subdirectory = joinPath(directory, 'app')
      await mkdir(subdirectory)

      await expect(resolveAppDirectory({path: subdirectory})).resolves.toBe(await fileRealPath(directory))
    })
  })

  test('is the real path itself with --without-app-config, without needing a client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'client-id-1')
      const subdirectory = joinPath(directory, 'app')
      await mkdir(subdirectory)

      await expect(resolveAppDirectory({path: subdirectory, withoutAppConfig: true})).resolves.toBe(
        await fileRealPath(subdirectory),
      )
    })
  })

  test('finds the app directory when there are several TOMLs and none is selected', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'production-client-id', 'shopify.app.production.toml')
      await writeConfiguration(directory, 'staging-client-id', 'shopify.app.staging.toml')

      await expect(resolveAppDirectory({path: directory})).resolves.toBe(await fileRealPath(directory))
    })
  })

  test('finds the app directory without validating its TOML', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = [')

      await expect(resolveAppDirectory({path: directory})).resolves.toBe(await fileRealPath(directory))
    })
  })

  test('aborts when --path does not exist instead of walking up to the app above it', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeConfiguration(directory, 'default-client-id')
      const missing = joinPath(directory, 'missing-app')

      await expect(resolveAppDirectory({path: missing})).rejects.toMatchObject({
        message: `--path ${missing}: not a directory.`,
      })
    })
  })

  test('aborts when no TOML is found, without prompting', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(resolveAppDirectory({path: directory})).rejects.toMatchObject({
        message: `No app configuration found at or above ${directory}.`,
      })
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    })
  })
})

describe('resolveIncludeDirectories', () => {
  test('resolves each value against the working directory and keeps the order', async () => {
    await inTemporaryDirectory(async (directory) => {
      const workingDirectory = joinPath(directory, 'work')
      await mkdir(workingDirectory)
      await mkdir(joinPath(directory, 'backend'))
      await mkdir(joinPath(workingDirectory, 'lib'))
      vi.stubEnv('INIT_CWD', workingDirectory)

      await expect(resolveIncludeDirectories(['../backend', 'lib', '.'])).resolves.toEqual([
        await fileRealPath(joinPath(directory, 'backend')),
        await fileRealPath(joinPath(workingDirectory, 'lib')),
        await fileRealPath(workingDirectory),
      ])
    })
  })

  test('gives the real path of a symbolic link', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'real'))
      await symlink(joinPath(directory, 'real'), joinPath(directory, 'alias'))
      vi.stubEnv('INIT_CWD', directory)

      await expect(resolveIncludeDirectories(['alias'])).resolves.toEqual([
        await fileRealPath(joinPath(directory, 'real')),
      ])
    })
  })

  test('allows the directory of another app', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'other-app'))
      await writeConfiguration(joinPath(directory, 'other-app'), 'other-client-id')
      vi.stubEnv('INIT_CWD', directory)

      await expect(resolveIncludeDirectories(['other-app'])).resolves.toEqual([
        await fileRealPath(joinPath(directory, 'other-app')),
      ])
    })
  })

  test("aborts with the typed value when the directory doesn't exist", async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)

      await expect(resolveIncludeDirectories(['missing'])).rejects.toMatchObject({
        message: "--include-dir missing: directory doesn't exist.",
      })
    })
  })

  test('aborts with the typed value when the path is a file', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'file.txt'), 'x')
      vi.stubEnv('INIT_CWD', directory)

      await expect(resolveIncludeDirectories(['./file.txt'])).rejects.toMatchObject({
        message: '--include-dir ./file.txt: not a directory.',
      })
    })
  })

  test('aborts when a symbolic link points at nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      await symlink(joinPath(directory, 'gone'), joinPath(directory, 'dangling'))
      vi.stubEnv('INIT_CWD', directory)

      await expect(resolveIncludeDirectories(['dangling'])).rejects.toMatchObject({
        message: "--include-dir dangling: directory doesn't exist.",
      })
    })
  })
})

describe('mergeScanDirectories', () => {
  test('lists the app directory first and then each include directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/backend', '/work/library'])).toEqual({
      scanDirectories: [
        {directory: '/work/app', origin: 'app_directory'},
        {directory: '/work/backend', origin: 'include_dir'},
        {directory: '/work/library', origin: 'include_dir'},
      ],
      requestedScanDirectories: ['/work/app', '/work/backend', '/work/library'],
    })
  })

  test('drops a duplicate include directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/backend', '/work/backend']).scanDirectories).toEqual([
      {directory: '/work/app', origin: 'app_directory'},
      {directory: '/work/backend', origin: 'include_dir'},
    ])
  })

  test('counts an include directory that is the app directory as the app directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/app']).scanDirectories).toEqual([
      {directory: '/work/app', origin: 'app_directory'},
    ])
  })

  test('drops an include directory inside another scan directory, and keeps it as requested', () => {
    expect(mergeScanDirectories('/work/app', ['/work/app/vendor/sdk', '/work/backend']).scanDirectories).toEqual([
      {directory: '/work/app', origin: 'app_directory'},
      {directory: '/work/backend', origin: 'include_dir'},
    ])
    expect(mergeScanDirectories('/work/app', ['/work/app/vendor/sdk']).requestedScanDirectories).toEqual([
      '/work/app',
      '/work/app/vendor/sdk',
    ])
  })

  test('drops the app directory when an include directory contains it', () => {
    expect(mergeScanDirectories('/work/mono/app', ['/work/mono']).scanDirectories).toEqual([
      {directory: '/work/mono', origin: 'include_dir'},
    ])
  })

  test('keeps a directory whose name only starts like another directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/app-library']).scanDirectories).toHaveLength(2)
  })

  test('rejects an include directory on another Windows drive', () => {
    expect(() => mergeScanDirectories('C:/work/app', ['C:/work/backend', 'D:/backend'])).toThrowError(
      new AbortError('--include-dir D:/backend: must be on the same drive as the app directory.'),
    )
  })

  test('rejects an include directory on a Windows network share', () => {
    expect(() => mergeScanDirectories('C:/work/app', ['//server/share/backend'])).toThrowError(
      new AbortError('--include-dir //server/share/backend: must be on the same drive as the app directory.'),
    )
  })

  test('accepts an include directory elsewhere on the same Windows drive', () => {
    expect(mergeScanDirectories('C:/work/app', ['C:/backend']).scanDirectories).toHaveLength(2)
  })

  test('lists each app configuration directory after the include directories', () => {
    expect(mergeScanDirectories('/work/app', ['/work/backend'], ['/work/shared/theme'])).toEqual({
      scanDirectories: [
        {directory: '/work/app', origin: 'app_directory'},
        {directory: '/work/backend', origin: 'include_dir'},
        {directory: '/work/shared/theme', origin: 'app_config_directory'},
      ],
      requestedScanDirectories: ['/work/app', '/work/backend', '/work/shared/theme'],
    })
  })

  test('counts an app configuration directory that is also an include directory as the include directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/shared/theme'], ['/work/shared/theme']).scanDirectories).toEqual([
      {directory: '/work/app', origin: 'app_directory'},
      {directory: '/work/shared/theme', origin: 'include_dir'},
    ])
  })

  test('drops an app configuration directory inside an include directory', () => {
    expect(mergeScanDirectories('/work/app', ['/work/shared'], ['/work/shared/theme']).scanDirectories).toEqual([
      {directory: '/work/app', origin: 'app_directory'},
      {directory: '/work/shared', origin: 'include_dir'},
    ])
  })

  test('rejects an app configuration directory on another Windows drive', () => {
    expect(() => mergeScanDirectories('C:/work/app', [], ['D:/shared/theme'])).toThrowError(
      new AbortError('Extension or web directory D:/shared/theme: must be on the same drive as the app directory.'),
    )
  })
})
