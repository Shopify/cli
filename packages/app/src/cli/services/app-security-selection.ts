import {localAppContext} from './app-context.js'
import {appCreationDefaults} from './app/config/link.js'
import {fetchOrCreateOrganizationApp} from './context.js'
import {NoAppConfigurationFoundError} from '../models/project/project.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, isDirectory} from '@shopify/cli-kit/node/fs'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export type AppSecuritySelection =
  | {
      kind: 'config'
      /** Absolute; the real path. */
      appDirectory: string
      /** Absolute path of the selected TOML, as found (not the symbolic link's target). */
      appConfigFilePath: string
      /** The TOML's `client_id`, if any. */
      configClientId?: string
      /** The `--client-id` value, if passed. */
      clientIdOverride?: string
    }
  | {
      kind: 'no-config'
      /** Absolute; the real path of `--path`. */
      appDirectory: string
      clientId: string
      clientIdSource: 'flag' | 'picker'
    }

/** A directory that is walked. Until `--include-dir` exists, the app directory is the only one. */
export interface AppSecurityScanDirectory {
  directory: string
  origin: 'app_directory' | 'include_dir'
}

interface AppSecuritySelectionOptions {
  path: string
  config?: string
  clientId?: string
  withoutAppConfig?: boolean
  allowPrompts: boolean
}

export interface AppSecuritySelectionDependencies {
  confirmScanWithoutAppConfig(directory: string): Promise<boolean>
  pickClientId(appDirectory: string): Promise<string>
}

const defaultDependencies: AppSecuritySelectionDependencies = {
  confirmScanWithoutAppConfig: (directory) =>
    renderConfirmationPrompt({
      message: `No app configuration found at or above ${directory}. Scan it without app configuration? Config checks will be skipped.`,
      confirmationMessage: 'Yes, scan without app configuration',
      cancellationMessage: 'No',
      defaultValue: false,
    }),
  pickClientId: async (appDirectory) => (await fetchOrCreateOrganizationApp(appCreationDefaults(appDirectory))).apiKey,
}

/** The name of the selected TOML, or undefined when there is none. */
export function selectedConfigFileName(selection: AppSecuritySelection): string | undefined {
  return selection.kind === 'config' ? basename(selection.appConfigFilePath) : undefined
}

/** The client ID to show people: `undefined` means the selected TOML isn't linked. */
export function effectiveClientId(selection: AppSecuritySelection): string | undefined {
  return selection.kind === 'no-config' ? selection.clientId : (selection.clientIdOverride ?? selection.configClientId)
}

/**
 * The name of the selection's results directory. The TOML's own `client_id` is never the key, so two
 * configurations of one app, and one configuration scanned as two apps, keep separate results.
 */
export function resultsKey(selection: AppSecuritySelection): string {
  if (selection.kind === 'no-config') return selection.clientId
  return selection.clientIdOverride ?? basename(selection.appConfigFilePath, '.toml')
}

export function clientIdSource(selection: AppSecuritySelection): 'config' | 'flag' | 'picker' | undefined {
  if (selection.kind === 'no-config') return selection.clientIdSource
  if (selection.clientIdOverride) return 'flag'
  return selection.configClientId ? 'config' : undefined
}

/**
 * The app directory alone, for `clean --all`, which needs no client ID and no results key. With
 * `--without-app-config` that's `--path` itself, so no client ID is required to find it.
 */
export async function resolveAppDirectory(options: Omit<AppSecuritySelectionOptions, 'allowPrompts'>): Promise<string> {
  if (options.withoutAppConfig) return realDirectory(options.path)
  return (await resolveAppSecuritySelection({...options, allowPrompts: false})).appDirectory
}

export async function resolveAppSecuritySelection(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies = defaultDependencies,
): Promise<AppSecuritySelection> {
  if (options.withoutAppConfig) {
    if (!options.clientId) throw new AbortError('--without-app-config requires --client-id.')
    return {
      kind: 'no-config',
      appDirectory: await realDirectory(options.path),
      clientId: options.clientId,
      clientIdSource: 'flag',
    }
  }

  // Walking up from a missing directory would find, and scan, the app above it.
  await realDirectory(options.path)

  try {
    const {app} = await localAppContext({
      directory: options.path,
      userProvidedConfigName: options.config,
      skipPrompts: !options.allowPrompts,
    })
    const appDirectory = await fileRealPath(app.directory)
    return {
      kind: 'config',
      appDirectory,
      // Re-rooted on the real app directory so the engine's containment check compares like with like.
      appConfigFilePath: joinPath(appDirectory, basename(app.configPath)),
      configClientId: app.configuration.client_id || undefined,
      clientIdOverride: options.clientId,
    }
  } catch (error) {
    if (!(error instanceof NoAppConfigurationFoundError)) throw error
    return resolveWithoutAppConfigurationFile(options, dependencies)
  }
}

async function resolveWithoutAppConfigurationFile(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies,
): Promise<AppSecuritySelection> {
  if (!options.allowPrompts) abortNoAppConfigurationFound(options.path)

  const appDirectory = await realDirectory(options.path)
  if (!(await dependencies.confirmScanWithoutAppConfig(options.path))) abortNoAppConfigurationFound(options.path)

  if (options.clientId) return {kind: 'no-config', appDirectory, clientId: options.clientId, clientIdSource: 'flag'}
  return {
    kind: 'no-config',
    appDirectory,
    clientId: await dependencies.pickClientId(appDirectory),
    clientIdSource: 'picker',
  }
}

function abortNoAppConfigurationFound(directory: string): never {
  throw new AbortError(
    `No app configuration found at or above ${directory}.`,
    'Pass `--path` to your app directory, or scan without app configuration with `--without-app-config --client-id <client-id>`.',
  )
}

async function realDirectory(path: string): Promise<string> {
  const realPath = await realPathIfExists(path)
  if (realPath === undefined || !(await isDirectory(realPath))) throw new AbortError(`--path ${path}: not a directory.`)
  return realPath
}

// On Windows, `fileExists` is true for a dangling symbolic link, so a successful realpath is what proves the path exists.
async function realPathIfExists(path: string): Promise<string | undefined> {
  return fileRealPath(path).catch(() => undefined)
}
