import {AppConfigurationFileName} from '../models/app/loader.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {normalizePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'

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
  if (!_appLocalStorageInstance) {
    _appLocalStorageInstance = new LocalStorage<AppLocalStorageSchema>({projectName: 'shopify-cli-app'})
  }
  return _appLocalStorageInstance
}

export function getCachedAppInfo(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): CachedAppInfo | undefined {
  const normalized = normalizePath(directory)
  outputDebug(`Reading cached app information for directory ${normalized}...`)
  return config.get(normalized)
}

export function clearCachedAppInfo(
  directory: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalized = normalizePath(directory)
  outputDebug(`Clearing app information for directory ${normalized}...`)
  config.delete(normalized)
}

export function setCachedAppInfo(
  options: CachedAppInfo,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  options.directory = normalizePath(options.directory)
  outputDebug(`Storing app information for directory ${options.directory}:${JSON.stringify(options)}`)
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
  if (!_commandLocalStorageInstance) {
    _commandLocalStorageInstance = new LocalStorage<CommandLocalStorage>({projectName: 'shopify-cli-app-command'})
  }
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
