import {Conf} from '@shopify/cli-kit/node/conf'

export interface ThemeConfSchema {
  themeStore: string
}

let _instance: Conf<ThemeConfSchema> | undefined

export function getCachedThemeStore() {
  return themeConf().get('themeStore')
}

export function setCachedThemeStore(store: string) {
  themeConf().set('themeStore', store)
}

function themeConf() {
  if (!_instance) {
    _instance = new Conf<ThemeConfSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _instance
}
