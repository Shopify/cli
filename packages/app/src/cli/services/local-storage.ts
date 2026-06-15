import {AppConfigurationFileName} from '../models/app/loader.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {normalizePath} from '@shopify/cli-kit/node/path'

export interface CachedAppInfo {
  directory: string
  configFile?: string
  appId?: string
  appGid?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  previousAppId?: string
}

// We store each app info using the directory as the key
export interface AppLocalStorageSchema {
  [key: string]: CachedAppInfo
}

let _appLocalStorageInstance: LocalStorage<AppLocalStorageSchema> | undefined

function appLocalStorage() {
  _appLocalStorageInstance ??= new LocalStorage<AppLocalStorageSchema>({projectName: 'shopify-cli-app'})
  return _appLocalStorageInstance
}

export function getCachedAppInfo(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): CachedAppInfo | undefined {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Reading cached app information for directory ${outputToken.path(normalized)}...`)
  return config.get(normalized)
}

export function clearCachedAppInfo(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Clearing app information for directory ${outputToken.path(normalized)}...`)
  config.delete(normalized)
}

export function setCachedAppInfo(
  options: CachedAppInfo,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  options.directory = normalizePath(options.directory)
  outputDebug(
    outputContent`Storing app information for directory ${outputToken.path(options.directory)}:${outputToken.json(
      options,
    )}`,
  )
  const savedApp = config.get(options.directory)
  if (savedApp) {
    config.set(options.directory, {
      ...savedApp,
      ...options,
    })
  } else {
    config.set(options.directory, options)
  }
}

export function clearCurrentConfigFile(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalized = normalizePath(directory)
  const savedApp = config.get(normalized)
  if (!savedApp) {
    return
  }

  config.set(normalized, {
    ...savedApp,
    configFile: undefined,
  })
}

interface CommandLocalStorage {
  [key: string]: {[key: string]: unknown}
}

let _commandLocalStorageInstance: LocalStorage<CommandLocalStorage> | undefined

function commandLocalStorage() {
  _commandLocalStorageInstance ??= new LocalStorage<CommandLocalStorage>({projectName: 'shopify-cli-app-command'})
  return _commandLocalStorageInstance
}

function setCachedCommandInfo(data: {[key: string]: unknown}): void {
  const id = process.env.COMMAND_RUN_ID

  if (!id) return

  const store = commandLocalStorage()
  const info = store.get(id)

  store.set(id, {
    ...info,
    ...data,
  })
}

export function getCachedCommandInfo() {
  const id = process.env.COMMAND_RUN_ID

  if (!id) return

  const store = commandLocalStorage()
  return store.get(id)
}

export function clearCachedCommandInfo() {
  const store = commandLocalStorage()
  store.clear()
}

export function setCachedCommandTomlMap(tomls: {[clientId: string]: AppConfigurationFileName}) {
  setCachedCommandInfo({tomls})
}

export function setCachedCommandTomlPreference(selectedToml: AppConfigurationFileName) {
  setCachedCommandInfo({selectedToml})
}

// A snapshot of the app-context analytics metadata (api_key, project_type, the app_* and
// cmd_app_* fields, and the sensitive app_name) for the last app the CLI resolved. Unlike
// `getCachedAppInfo`, which is keyed by directory, this is a single global value so that
// commands run *outside* any app directory can still be attributed to the app the user was
// most recently working with — the whole snapshot is replayed onto the event. Used only for
// best-effort telemetry enrichment.
export interface MostRecentlyUsedAppContext {
  // Public metadata fields, keyed by their Monorail field name (e.g. `api_key`, `app_scopes`).
  public?: {[key: string]: unknown}
  // Sensitive metadata fields, keyed by their Monorail field name (currently just `app_name`).
  sensitive?: {[key: string]: unknown}
}

export interface AppContextLocalStorageSchema {
  mostRecentlyUsedApp?: MostRecentlyUsedAppContext
}

let _appContextLocalStorageInstance: LocalStorage<AppContextLocalStorageSchema> | undefined

function appContextLocalStorage() {
  _appContextLocalStorageInstance ??= new LocalStorage<AppContextLocalStorageSchema>({
    projectName: 'shopify-cli-app-context',
  })
  return _appContextLocalStorageInstance
}

export function getMostRecentlyUsedAppContext(
  config: LocalStorage<AppContextLocalStorageSchema> = appContextLocalStorage(),
): MostRecentlyUsedAppContext | undefined {
  return config.get('mostRecentlyUsedApp')
}

export function setMostRecentlyUsedAppContext(
  context: MostRecentlyUsedAppContext,
  config: LocalStorage<AppContextLocalStorageSchema> = appContextLocalStorage(),
): void {
  config.set('mostRecentlyUsedApp', context)
}
