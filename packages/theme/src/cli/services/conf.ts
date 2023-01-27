import {getThemeStore} from '../utilities/theme-store.js'
import {Conf} from '@shopify/cli-kit/node/conf'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

type DevelopmentThemeId = string

export interface ThemeConfSchema {
  themeStore: string
  [developmentThemeStore: string]: DevelopmentThemeId
}

let _themeConfInstance: Conf<ThemeConfSchema> | undefined

export function themeConf() {
  if (!_themeConfInstance) {
    _themeConfInstance = new Conf<ThemeConfSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _themeConfInstance
}

export function getDevelopmentTheme(): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  return themeConf().get(getThemeStore({store: undefined}))
}

export function setDevelopmentTheme(theme: string): void {
  outputDebug(outputContent`Setting development theme...`)
  themeConf().set(getThemeStore({store: undefined}), theme)
}

export function removeDevelopmentTheme(): void {
  outputDebug(outputContent`Removing development theme...`)
  themeConf().reset(getThemeStore({store: undefined}))
}
