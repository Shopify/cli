import {Conf} from '@shopify/cli-kit/node/conf'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'

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
  outputDebug(outputContent`Reading cached app information for directory ${outputToken.path(directory)}...`)
  return config.get(directory)
}

export function clearAppInfo(directory: string, config: Conf<AppConfSchema> = appConf()): void {
  outputDebug(outputContent`Clearing app information for directory ${outputToken.path(directory)}...`)
  config.delete(directory)
}

export function clearAllAppInfo(config: Conf<AppConfSchema> = appConf()): void {
  outputDebug(outputContent`Clearing all app information...`)
  config.clear()
}

export function setAppInfo(options: CachedAppInfo, config: Conf<AppConfSchema> = appConf()): void {
  outputDebug(
    outputContent`Storing app information for directory ${outputToken.path(options.directory)}:${outputToken.json(
      options,
    )}`,
  )
  const savedApp = config.get(options.directory)
  if (savedApp) {
    config.set(options.directory, {
      directory: options.directory,
      appId: options.appId ?? savedApp.appId,
      title: options.title ?? savedApp.title,
      storeFqdn: options.storeFqdn ?? savedApp.storeFqdn,
      orgId: options.orgId ?? savedApp.orgId,
      updateURLs: options.updateURLs ?? savedApp.updateURLs,
      tunnelPlugin: options.tunnelPlugin ?? savedApp.tunnelPlugin,
    })
  } else {
    config.set(options.directory, options)
  }
}
