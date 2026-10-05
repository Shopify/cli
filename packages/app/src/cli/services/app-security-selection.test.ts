import {
  clientIdSource,
  effectiveClientId,
  resolveAppDirectory,
  resolveAppSecuritySelection,
  resultsKey,
  selectedConfigFileName,
  type AppSecuritySelection,
  type AppSecuritySelectionDependencies,
} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {getCachedAppInfo} from './local-storage.js'
import {appCreationDefaults} from './app/config/link.js'
import {fetchOrCreateOrganizationApp} from './context.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {symlink} from 'node:fs/promises'
import type {OrganizationApp} from '../models/organization.js'

vi.mock('./local-storage.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./local-storage.js')>()),
  getCachedAppInfo: vi.fn(),
}))
vi.mock('./context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./context.js')>()),
  fetchOrCreateOrganizationApp: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConfirmationPrompt: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
})

async function writeConfiguration(directory: string, clientId: string, name = 'shopify.app.toml'): Promise<void> {
  await writeFile(joinPath(directory, name), validAppConfiguration(clientId))
}

function promptDependencies(overrides: Partial<AppSecuritySelectionDependencies> = {}) {
  return {
    confirmScanWithoutAppConfig: vi.fn(async (_directory: string) => true),
    pickClientId: vi.fn(async (_appDirectory: string) => 'picked-client-id'),
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

  test('aborts when no TOML is found, without prompting', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(resolveAppDirectory({path: directory})).rejects.toMatchObject({
        message: `No app configuration found at or above ${directory}.`,
      })
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    })
  })
})
