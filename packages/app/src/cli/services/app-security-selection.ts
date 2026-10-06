import {localAppContext} from './app-context.js'
import {appCreationDefaults} from './app/config/link.js'
import {appFromIdentifiers, fetchOrCreateOrganizationApp} from './context.js'
import {getCachedAppInfo} from './local-storage.js'
import {extensionFilesForConfig, webFilesForConfig} from '../models/project/config-selection.js'
import {NoAppConfigurationFoundError, Project} from '../models/project/project.js'
import {getAppConfigurationShorthand} from '../models/app/config-file-naming.js'
import {findConfigFiles, selectConfigFile} from '../prompts/config.js'
import {configurationFileNames} from '../constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExistsSync, fileRealPath, isDirectory} from '@shopify/cli-kit/node/fs'
import {
  basename,
  cwd,
  dirname,
  isSubpath,
  joinPath,
  normalizePath,
  relativePath,
  resolvePath,
} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {lstat} from 'node:fs/promises'
import type {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'

export type AppSecuritySelection =
  | {
      kind: 'config'
      /** Absolute; the real path. */
      appDirectory: string
      /** Absolute path of the selected TOML, as found (not the symbolic link's target). */
      appConfigFilePath: string
      /**
       * Absolute real paths of the extension and web directories that the TOML's `extension_directories` and
       * `web_directories` add outside the app directory, if any.
       */
      appConfigDirectories?: string[]
      /** The TOML's `client_id`, if any. */
      configClientId?: string
      /** The `--client-id` value, if passed. */
      clientIdOverride?: string
      /** True when `check` asked which TOML to scan, because nothing else selected one. */
      appConfigFilePicked?: boolean
    }
  | {
      kind: 'no-config'
      /** Absolute; the real path of `--path`. */
      appDirectory: string
      clientId: string
      clientIdSource: 'flag' | 'picker'
    }

/** A directory that is walked. */
export interface AppSecurityScanDirectory {
  /** Absolute; the real path. */
  directory: string
  origin: 'app_directory' | 'include_dir' | 'app_config_directory'
}

export interface AppSecuritySelectionOptions {
  path: string
  config?: string
  clientId?: string
  withoutAppConfig?: boolean
  allowPrompts: boolean
  /** Look up the `--client-id` value in the user's account, which needs a login. Off by default. */
  validateClientIdFlag?: boolean
}

export interface AppSecuritySelectionDependencies {
  confirmScanWithoutAppConfig(directory: string): Promise<boolean>
  pickClientId(appDirectory: string): Promise<string>
  pickConfigFile(appDirectory: string): Promise<string>
  /** Aborts when the user's account has no app with this client ID. */
  lookUpApp(clientId: string): Promise<void>
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
  pickConfigFile: async (appDirectory) => (await selectConfigFile(appDirectory)).valueOrAbort(),
  lookUpApp: async (clientId) => {
    await appFromIdentifiers({apiKey: clientId})
  },
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
 * `--without-app-config` that's `--path` itself, so no client ID is required to find it. Otherwise it's the directory
 * that holds the TOMLs, found by walking up as for the other commands. No TOML is selected or validated: they all share
 * that directory, so `clean --all` also works with several TOMLs and none selected, or with a TOML that is invalid.
 */
export async function resolveAppDirectory(
  options: Pick<AppSecuritySelectionOptions, 'path' | 'withoutAppConfig'>,
): Promise<string> {
  // Checked before walking up: walking up from a missing directory would find, and clean, the app above it.
  const directory = await realDirectory(options.path)
  if (options.withoutAppConfig) return directory

  try {
    return await fileRealPath((await Project.load(options.path)).directory)
  } catch (error) {
    if (!(error instanceof NoAppConfigurationFoundError)) throw error
    abortNoAppConfigurationFound(options.path)
  }
}

export async function resolveAppSecuritySelection(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies = defaultDependencies,
): Promise<AppSecuritySelection> {
  if (options.withoutAppConfig) {
    if (!options.clientId) throw new AbortError('--without-app-config requires --client-id.')
    const appDirectory = await realDirectory(options.path)
    await lookUpClientIdFlag(options, dependencies)
    return {
      kind: 'no-config',
      appDirectory,
      clientId: options.clientId,
      clientIdSource: 'flag',
    }
  }

  // Walking up from a missing directory would find, and scan, the app above it.
  await realDirectory(options.path)

  try {
    const unselectedConfigFile = options.config ? undefined : await configFileWhenNoneIsSelected(options, dependencies)
    const {app, project, activeConfig} = await localAppContext({
      directory: options.path,
      userProvidedConfigName: options.config ?? unselectedConfigFile?.fileName,
      skipPrompts: !options.allowPrompts,
    })
    await lookUpClientIdFlag(options, dependencies)
    const appDirectory = await fileRealPath(app.directory)
    return {
      kind: 'config',
      appDirectory,
      // Re-rooted on the real app directory so the engine's containment check compares like with like.
      appConfigFilePath: joinPath(appDirectory, basename(app.configPath)),
      appConfigDirectories: await resolveAppConfigDirectories(project, activeConfig.file),
      configClientId: app.configuration.client_id || undefined,
      clientIdOverride: options.clientId,
      appConfigFilePicked: unselectedConfigFile?.picked,
    }
  } catch (error) {
    if (!(error instanceof NoAppConfigurationFoundError)) throw error
    return resolveWithoutAppConfigurationFile(options, dependencies)
  }
}

/**
 * The TOML to scan when there's no `--config`, no `app config use` choice whose file exists and no shopify.app.toml.
 * Other app commands abort then. With several TOMLs, `check` asks which one to scan instead, and doesn't save the
 * answer: the printed commands carry it as `--config`. Undefined when the usual selection applies.
 *
 * With a stale `app config use` choice, shopify.app.toml is named explicitly: otherwise `localAppContext` would run
 * `app config use`, which asks for a TOML and saves the answer.
 */
async function configFileWhenNoneIsSelected(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies,
): Promise<{fileName: string; picked: boolean} | undefined> {
  const {directory} = await Project.load(options.path)
  const cachedFileName = getCachedAppInfo(directory)?.configFile
  if (cachedFileName && fileExistsSync(joinPath(directory, cachedFileName))) return undefined
  if (fileExistsSync(joinPath(directory, configurationFileNames.app))) {
    return cachedFileName ? {fileName: configurationFileNames.app, picked: false} : undefined
  }

  const fileNames = (await findConfigFiles(directory)).map((path) => basename(path))
  if (fileNames.length === 1) return {fileName: fileNames[0]!, picked: false}
  // `--client-id` can't be combined with `--config`, so a picked TOML couldn't be repeated by the printed commands.
  if (!options.allowPrompts || options.clientId) abortNoAppConfigurationSelected(directory, fileNames, options.clientId)
  return {fileName: await dependencies.pickConfigFile(directory), picked: true}
}

async function resolveWithoutAppConfigurationFile(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies,
): Promise<AppSecuritySelection> {
  if (!options.allowPrompts) abortNoAppConfigurationFound(options.path)

  const appDirectory = await realDirectory(options.path)
  // Before the prompt, so a mistyped client ID fails without asking anything first.
  await lookUpClientIdFlag(options, dependencies)
  if (!(await dependencies.confirmScanWithoutAppConfig(options.path))) abortNoAppConfigurationFound(options.path)

  if (options.clientId) return {kind: 'no-config', appDirectory, clientId: options.clientId, clientIdSource: 'flag'}
  return {
    kind: 'no-config',
    appDirectory,
    clientId: await dependencies.pickClientId(appDirectory),
    clientIdSource: 'picker',
  }
}

/**
 * Only the `--client-id` value is looked up: the TOML's own `client_id` is never validated, and the picker's
 * client ID already comes from the API. An empty value is looked up too, because it was passed.
 */
async function lookUpClientIdFlag(
  options: AppSecuritySelectionOptions,
  dependencies: AppSecuritySelectionDependencies,
): Promise<void> {
  if (options.validateClientIdFlag && options.clientId !== undefined) await dependencies.lookUpApp(options.clientId)
}

/**
 * Resolves each `--include-dir` value, as typed, against the working directory. Returns real paths in the order
 * given. Another app's directory is allowed.
 */
export async function resolveIncludeDirectories(includeDirs: ReadonlyArray<string>): Promise<string[]> {
  const directories: string[] = []
  for (const typedValue of includeDirs) {
    const absolutePath = resolvePath(cwd(), typedValue)
    // eslint-disable-next-line no-await-in-loop
    const realPath = await realPathIfExists(absolutePath)
    if (realPath === undefined) throw new AbortError(`--include-dir ${typedValue}: directory doesn't exist.`)
    // eslint-disable-next-line no-await-in-loop
    if (!(await isDirectory(realPath))) throw new AbortError(`--include-dir ${typedValue}: not a directory.`)
    directories.push(realPath)
  }
  return directories
}

/**
 * The directories holding the extension and web TOMLs that the selected TOML's `extension_directories` and
 * `web_directories` match, as the CLI's loader matches them, when they are outside the app directory. Returns real
 * paths. Unlike `--include-dir`, these directories are implicit, so one reached through a symbolic link outside the
 * app directory is left out, the way gathering never follows a symbolic link.
 */
async function resolveAppConfigDirectories(project: Project, activeConfigFile: TomlFile): Promise<string[]> {
  const outsideDirectories = [
    ...extensionFilesForConfig(project, activeConfigFile),
    ...webFilesForConfig(project, activeConfigFile),
  ]
    .map((file) => dirname(file.path))
    .filter((directory) => !isSubpath(project.directory, directory))

  const directories: string[] = []
  for (const directory of new Set(outsideDirectories)) {
    // eslint-disable-next-line no-await-in-loop
    if (await isReachedThroughSymbolicLink(project.directory, directory)) continue
    // eslint-disable-next-line no-await-in-loop
    directories.push(await fileRealPath(directory))
  }
  return directories.sort()
}

/**
 * Whether a directory outside the app directory is reached through a symbolic link: checks each path segment below the
 * ancestor that the two directories share.
 */
async function isReachedThroughSymbolicLink(appDirectory: string, directory: string): Promise<boolean> {
  const segments = relativePath(appDirectory, directory).split('/')
  let path = joinPath(appDirectory, ...segments.filter((segment) => segment === '..'))
  for (const segment of segments.filter((segment) => segment !== '..')) {
    path = joinPath(path, segment)
    // eslint-disable-next-line no-await-in-loop
    if ((await lstat(path)).isSymbolicLink()) return true
  }
  return false
}

/**
 * The app directory, then each include directory, then each app configuration directory, compared by real path. A
 * duplicate is dropped, so a directory keeps the first origin it has. A directory inside another one is dropped too,
 * because walking the outer one covers it; that includes the app directory when another directory contains it.
 * `requestedScanDirectories` keeps the directories that were dropped for being nested, since each still gets the
 * ignored-scan-directory warning.
 *
 * Aborts on a directory on another Windows drive or network share. Gathered files are stored relative to the app
 * directory and read back with `joinPath`, which can't reach those, so their files would be silently left unscanned.
 */
export function mergeScanDirectories(
  appDirectory: string,
  includeDirectories: ReadonlyArray<string>,
  appConfigDirectories: ReadonlyArray<string> = [],
): {scanDirectories: AppSecurityScanDirectory[]; requestedScanDirectories: string[]} {
  const isOnAnotherDrive = (directory: string) =>
    joinPath(appDirectory, relativePath(appDirectory, directory)) !== normalizePath(directory)
  const otherDriveIncludeDirectory = includeDirectories.find(isOnAnotherDrive)
  if (otherDriveIncludeDirectory) {
    throw new AbortError(`--include-dir ${otherDriveIncludeDirectory}: must be on the same drive as the app directory.`)
  }
  const otherDriveAppConfigDirectory = appConfigDirectories.find(isOnAnotherDrive)
  if (otherDriveAppConfigDirectory) {
    throw new AbortError(
      `Extension or web directory ${otherDriveAppConfigDirectory}: must be on the same drive as the app directory.`,
    )
  }

  const requested = [
    {directory: appDirectory, origin: 'app_directory' as const},
    ...includeDirectories.map((directory) => ({directory, origin: 'include_dir' as const})),
    ...appConfigDirectories.map((directory) => ({directory, origin: 'app_config_directory' as const})),
  ].filter((candidate, index, all) => all.findIndex(({directory}) => directory === candidate.directory) === index)

  return {
    scanDirectories: requested.filter(
      (candidate) =>
        !requested.some(
          ({directory}) => directory !== candidate.directory && isSubpath(directory, candidate.directory),
        ),
    ),
    requestedScanDirectories: requested.map(({directory}) => directory),
  }
}

function abortNoAppConfigurationFound(directory: string): never {
  throw new AbortError(
    `No app configuration found at or above ${directory}.`,
    'Pass `--path` to your app directory, or scan without app configuration with `--without-app-config --client-id <client-id>`.',
  )
}

function abortNoAppConfigurationSelected(directory: string, fileNames: string[], clientId?: string): never {
  const configNames = fileNames.map((fileName) => getAppConfigurationShorthand(fileName) ?? fileName).join(', ')
  throw new AbortError(
    `${fileNames.length} app configurations found in ${directory}, and none is selected.`,
    clientId
      ? `\`--client-id\` can't be combined with \`--config\`, so first select one with \`shopify app config use <config>\`: ${configNames}.`
      : `Pass \`--config\` with one of: ${configNames}.`,
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
