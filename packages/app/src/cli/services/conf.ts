import {store, output} from '@shopify/cli-kit'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export interface CachedAppInfo {
  directory: string
  appId?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}

export function getAppInfo(directory: string): CachedAppInfo | undefined {
  output.debug(output.content`Reading cached app information for directory ${output.token.path(directory)}...`)
  const config = appConf()
  return config.get(directory) as CachedAppInfo | undefined
}

export function clearAppInfo(directory: string): void {
  output.debug(output.content`Clearing app information for directory ${output.token.path(directory)}...`)
  const config = appConf()
  config.reset(directory)
}

export function clearAllAppInfo(): void {
  output.debug(output.content`Clearing all app information...`)
  const config = appConf()
  config.clear()
}

export function setAppInfo(options: CachedAppInfo): void {
  const config = appConf()

  output.debug(
    output.content`Storing app information for directory ${output.token.path(options.directory)}:${output.token.json(
      options,
    )}`,
  )
  const savedApp = config.get(options.directory) as CachedAppInfo | undefined
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

let _instance: store.Conf | undefined

function appConf() {
  if (!_instance) {
    _instance = new store.Conf({
      projectName: 'shopify-cli-app-conf',
      projectVersion: CLI_KIT_VERSION,
    })
  }
  return _instance
}
