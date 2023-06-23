import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'

export interface CachedAppInfo {
  directory: string
  configFile?: string
  appId?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}

// We store each app info using the directory as the key
export interface AppLocalStorageSchema {
  [key: string]: CachedAppInfo
}

export interface CurrentConfigLocalStorageSchema {
  [key: string]: string
}

let _appLocalStorageInstance: LocalStorage<AppLocalStorageSchema> | undefined
let _currentConfigLocalStorageInstance: LocalStorage<CurrentConfigLocalStorageSchema> | undefined

function appLocalStorage() {
  if (!_appLocalStorageInstance) {
    _appLocalStorageInstance = new LocalStorage<AppLocalStorageSchema>({projectName: 'shopify-cli-app'})
  }
  return _appLocalStorageInstance
}

function currentConfigLocalStorage() {
  if (!_currentConfigLocalStorageInstance) {
    _currentConfigLocalStorageInstance = new LocalStorage<CurrentConfigLocalStorageSchema>({
      projectName: 'shopify-cli-current-config',
    })
  }
  return _currentConfigLocalStorageInstance
}

export function getAppInfo(
  directory: string,
  configFileName?: string,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): CachedAppInfo | undefined {
  const normalized = configFileName ? normalizePath(joinPath(directory, configFileName)) : normalizePath(directory)
  outputDebug(outputContent`Reading cached app information for directory ${outputToken.path(normalized)}...`)
  return config.get(normalized)
}

export function clearAppInfo(directory: string, config: LocalStorage<AppLocalStorageSchema> = appLocalStorage()): void {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Clearing app information for directory ${outputToken.path(normalized)}...`)
  config.delete(normalized)
}

export function clearAllAppInfo(config: LocalStorage<AppLocalStorageSchema> = appLocalStorage()): void {
  outputDebug(outputContent`Clearing all app information...`)
  config.clear()
}

export function setAppInfo(
  options: CachedAppInfo,
  config: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
): void {
  const normalizedDirectory = normalizePath(options.directory)

  let normalizedKey
  let keyMessage
  if (options.configFile) {
    normalizedKey = normalizePath(joinPath(options.directory, options.configFile))
    keyMessage = `file ${outputToken.path(normalizedKey)}`
  } else {
    normalizedKey = normalizedDirectory
    keyMessage = `directory ${outputToken.path(normalizedDirectory)}`
  }

  outputDebug(outputContent`Storing app information for ${keyMessage}:${outputToken.json(options)}`)
  const savedApp = config.get(normalizedKey)
  if (savedApp) {
    config.set(normalizedKey, {
      directory: normalizedDirectory,
      configFile: options.configFile ?? savedApp.configFile,
      appId: options.appId ?? savedApp.appId,
      title: options.title ?? savedApp.title,
      storeFqdn: options.storeFqdn ?? savedApp.storeFqdn,
      orgId: options.orgId ?? savedApp.orgId,
      updateURLs: options.updateURLs ?? savedApp.updateURLs,
      tunnelPlugin: options.tunnelPlugin ?? savedApp.tunnelPlugin,
    })
  } else {
    config.set(normalizedKey, options)
  }
}

export function setCurrentConfigFile(
  options: CachedAppInfo,
  appStorage: LocalStorage<AppLocalStorageSchema> = appLocalStorage(),
  currentConfigStorage: LocalStorage<CurrentConfigLocalStorageSchema> = currentConfigLocalStorage(),
): void {
  const normalized = normalizePath(options.directory)
  setAppInfo(options, appStorage)
  currentConfigStorage.set(normalized, options.configFile)
}

export function clearCurrentConfigFile(
  directory: string,
  currentConfigStorage: LocalStorage<CurrentConfigLocalStorageSchema> = currentConfigLocalStorage(),
): void {
  const normalized = normalizePath(directory)
  currentConfigStorage.delete(normalized)
}
