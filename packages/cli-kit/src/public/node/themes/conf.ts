import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputDebug} from '@shopify/cli-kit/node/output'

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
  outputDebug('Getting host theme...')
  return hostThemeLocalStorage().get(storeFqdn)
}

export function setHostTheme(storeFqdn: StoreFqdn, themeId: HostThemeId): void {
  outputDebug('Setting host theme...')
  hostThemeLocalStorage().set(storeFqdn, themeId)
}

export function removeHostTheme(storeFqdn: StoreFqdn): void {
  outputDebug('Removing host theme...')
  hostThemeLocalStorage().delete(storeFqdn)
}
