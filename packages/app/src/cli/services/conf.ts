import {Conf} from '@shopify/cli-kit/node/conf'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {normalizePath} from '@shopify/cli-kit/node/path'

export interface CachedAppInfo {
  directory: string
  appId?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}

// We store each app info using the directory as the key
export interface AppConfSchema {
  [key: string]: CachedAppInfo
}

let _instance: Conf<AppConfSchema> | undefined

function appConf() {
  if (!_instance) {
    _instance = new Conf<AppConfSchema>({projectName: 'shopify-cli-app'})
  }
  return _instance
}

export function getAppInfo(directory: string, config: Conf<AppConfSchema> = appConf()): CachedAppInfo | undefined {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Reading cached app information for directory ${outputToken.path(normalized)}...`)
  return config.get(normalized)
}

export function clearAppInfo(directory: string, config: Conf<AppConfSchema> = appConf()): void {
  const normalized = normalizePath(directory)
  outputDebug(outputContent`Clearing app information for directory ${outputToken.path(normalized)}...`)
  config.delete(normalized)
}

export function clearAllAppInfo(config: Conf<AppConfSchema> = appConf()): void {
  outputDebug(outputContent`Clearing all app information...`)
  config.clear()
}

export function setAppInfo(options: CachedAppInfo, config: Conf<AppConfSchema> = appConf()): void {
  const normalized = normalizePath(options.directory)
  outputDebug(
    outputContent`Storing app information for directory ${outputToken.path(normalized)}:${outputToken.json(options)}`,
  )
  const savedApp = config.get(normalized)
  if (savedApp) {
    config.set(normalized, {
      directory: normalized,
      appId: options.appId ?? savedApp.appId,
      title: options.title ?? savedApp.title,
      storeFqdn: options.storeFqdn ?? savedApp.storeFqdn,
      orgId: options.orgId ?? savedApp.orgId,
      updateURLs: options.updateURLs ?? savedApp.updateURLs,
      tunnelPlugin: options.tunnelPlugin ?? savedApp.tunnelPlugin,
    })
  } else {
    config.set(normalized, options)
  }
}
