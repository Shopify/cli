import {Conf} from '@shopify/cli-kit/node/conf'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

type HostThemeId = string
type StoreFqdn = AdminSession['storeFqdn']

interface HostThemeConfSchema {
  [themeStore: StoreFqdn]: HostThemeId
}

let _hostThemeConfInstance: Conf<HostThemeConfSchema> | undefined

export function hostThemeConf(): Conf<HostThemeConfSchema> {
  if (!_hostThemeConfInstance) {
    _hostThemeConfInstance = new Conf<HostThemeConfSchema>({
      projectName: 'shopify-cli-host-theme-conf',
    })
  }
  return _hostThemeConfInstance
}

export function getHostTheme(storeFqdn: StoreFqdn): string | undefined {
  outputDebug(outputContent`Getting host theme...`)
  return hostThemeConf().get(storeFqdn)
}

export function setHostTheme(storeFqdn: StoreFqdn, themeId: HostThemeId): void {
  outputDebug(outputContent`Setting host theme...`)
  hostThemeConf().set(storeFqdn, themeId)
}

export function removeHostTheme(storeFqdn: StoreFqdn): void {
  outputDebug(outputContent`Removing host theme...`)
  hostThemeConf().reset(storeFqdn)
}
