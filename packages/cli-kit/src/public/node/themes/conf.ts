import {LocalStorage} from '../local-storage.js'
import {AdminSession} from '../session.js'
import {outputDebug, outputContent} from '../output.js'

type HostThemeId = string
type StoreFqdn = AdminSession['storeFqdn']

interface HostThemeLocalStorageSchema {
  [themeStore: StoreFqdn]: HostThemeId
}

let _hostThemeLocalStorageInstance: LocalStorage<HostThemeLocalStorageSchema> | undefined

export function hostThemeLocalStorage(): LocalStorage<HostThemeLocalStorageSchema> {
  if (!_hostThemeLocalStorageInstance) {
    _hostThemeLocalStorageInstance = new LocalStorage<HostThemeLocalStorageSchema>({
      projectName: 'shopify-cli-host-theme-conf',
    })
  }
  return _hostThemeLocalStorageInstance
}

export function getHostTheme(storeFqdn: StoreFqdn): string | undefined {
  outputDebug(outputContent`Getting host theme...`)
  return hostThemeLocalStorage().get(storeFqdn)
}

export function setHostTheme(storeFqdn: StoreFqdn, themeId: HostThemeId): void {
  outputDebug(outputContent`Setting host theme...`)
  hostThemeLocalStorage().set(storeFqdn, themeId)
}

export function removeHostTheme(storeFqdn: StoreFqdn): void {
  outputDebug(outputContent`Removing host theme...`)
  hostThemeLocalStorage().delete(storeFqdn)
}
