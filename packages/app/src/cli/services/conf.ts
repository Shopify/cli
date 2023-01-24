import {output} from '@shopify/cli-kit'
import {Conf} from '@shopify/cli-kit/node/conf'

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
  output.debug(output.content`Reading cached app information for directory ${output.token.path(directory)}...`)
  return config.get(directory)
}

export function clearAppInfo(directory: string, config: Conf<AppConfSchema> = appConf()): void {
  output.debug(output.content`Clearing app information for directory ${output.token.path(directory)}...`)
  config.delete(directory)
}

export function clearAllAppInfo(config: Conf<AppConfSchema> = appConf()): void {
  output.debug(output.content`Clearing all app information...`)
  config.clear()
}

export function setAppInfo(options: CachedAppInfo, config: Conf<AppConfSchema> = appConf()): void {
  output.debug(
    output.content`Storing app information for directory ${output.token.path(options.directory)}:${output.token.json(
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
